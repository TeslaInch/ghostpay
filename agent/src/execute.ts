import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import {
  ENCRYPT_PROGRAM_ID,
  GHOSTPAY_PROGRAM_ID,
  SalaryRegistry,
} from "./config";
import { ContributorSnapshot, VaultSnapshot } from "./state";
import { Chain, createEncryptClient } from "./encrypt-client";

const ENCRYPT_GRPC_URL = "pre-alpha-dev-1.encrypt.ika-network.net:443";
const FHE_UINT64 = 4;
const NETWORK_KEY = Buffer.alloc(32, 0x55);

function pda(seeds: (Buffer | Uint8Array)[], programId: PublicKey) {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function deriveCpiAuthority() {
  return pda([Buffer.from("__encrypt_cpi_authority")], GHOSTPAY_PROGRAM_ID);
}

function deriveEncryptPdas(payer: PublicKey) {
  const [configPda] = pda(
    [Buffer.from("encrypt_config")],
    ENCRYPT_PROGRAM_ID
  );
  const [eventAuthority] = pda(
    [Buffer.from("__event_authority")],
    ENCRYPT_PROGRAM_ID
  );
  const [depositPda] = pda(
    [Buffer.from("encrypt_deposit"), payer.toBuffer()],
    ENCRYPT_PROGRAM_ID
  );
  const [networkKeyPda] = pda(
    [Buffer.from("network_encryption_key"), NETWORK_KEY],
    ENCRYPT_PROGRAM_ID
  );
  return { configPda, eventAuthority, depositPda, networkKeyPda };
}

function disc(idl: any, name: string): Buffer {
  const ix = idl.instructions.find((i: any) => i.name === name);
  if (!ix) throw new Error(`instruction ${name} missing from IDL`);
  return Buffer.from(ix.discriminator);
}

function mockCiphertext(value: bigint): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = FHE_UINT64;
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function encryptCpiAccountMetas(
  enc: ReturnType<typeof deriveEncryptPdas>,
  cpiAuthority: PublicKey
) {
  return [
    { pubkey: ENCRYPT_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: enc.configPda, isSigner: false, isWritable: true },
    { pubkey: enc.depositPda, isSigner: false, isWritable: true },
    { pubkey: cpiAuthority, isSigner: false, isWritable: false },
    { pubkey: GHOSTPAY_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: enc.networkKeyPda, isSigner: false, isWritable: false },
    { pubkey: enc.eventAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
}

export interface ExecutionResult {
  contributor: string;
  wallet: string;
  payment_ct: string;
  run_payroll_sig: string;
  sol_transfer_sig: string | null;
  sol_transferred_lamports: number;
  notes: string[];
}

interface ExecuteArgs {
  connection: Connection;
  program: Program;
  admin: Keypair;
  vault: VaultSnapshot;
  contributors: ContributorSnapshot[];
  salaries: SalaryRegistry;
  /** USD price used to convert payment-USDC-units → lamports for SOL transfers. */
  solPriceUsd: number;
}

export async function executePayroll(
  args: ExecuteArgs
): Promise<ExecutionResult[]> {
  const {
    connection,
    program,
    admin,
    vault,
    contributors,
    salaries,
    solPriceUsd,
  } = args;
  const idl = (program as any).idl;

  const encrypt = createEncryptClient(ENCRYPT_GRPC_URL);
  const enc = deriveEncryptPdas(admin.publicKey);
  const [cpiAuthority, cpiAuthorityBump] = deriveCpiAuthority();
  const results: ExecutionResult[] = [];

  try {
    for (const c of contributors) {
      const wallet = c.wallet.toBase58();
      const salaryRaw = salaries[wallet];
      if (salaryRaw === undefined) {
        results.push({
          contributor: c.pda.toBase58(),
          wallet,
          payment_ct: "",
          run_payroll_sig: "",
          sol_transfer_sig: null,
          sol_transferred_lamports: 0,
          notes: [`skipped — no salary registry entry for ${wallet}`],
        });
        continue;
      }

      // 1. Mint a fresh payment ciphertext authorized to ghostpay.
      const { ciphertextIdentifiers } = await encrypt.createInput({
        chain: Chain.Solana,
        inputs: [
          { ciphertextBytes: mockCiphertext(0n), fheType: FHE_UINT64 },
        ],
        authorized: Buffer.from(GHOSTPAY_PROGRAM_ID.toBytes()),
        networkEncryptionPublicKey: NETWORK_KEY,
      });
      const paymentCt = new PublicKey(ciphertextIdentifiers[0]);

      // 2. run_payroll — FHE verify_and_deduct on-chain.
      const runIxData = Buffer.concat([
        disc(idl, "run_payroll"),
        Buffer.from([cpiAuthorityBump]),
      ]);
      const runIx = new TransactionInstruction({
        programId: GHOSTPAY_PROGRAM_ID,
        data: runIxData,
        keys: [
          { pubkey: vault.vault, isSigner: false, isWritable: false },
          { pubkey: c.pda, isSigner: false, isWritable: false },
          { pubkey: vault.balanceCt, isSigner: false, isWritable: true },
          { pubkey: c.salaryCt, isSigner: false, isWritable: true },
          { pubkey: paymentCt, isSigner: false, isWritable: true },
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          ...encryptCpiAccountMetas(enc, cpiAuthority),
        ],
      });
      const runSig = await sendAndConfirmTransaction(
        connection,
        new Transaction().add(runIx),
        [admin],
        { commitment: "confirmed" }
      );

      // 3. Transfer the SOL slice from admin wallet to contributor.
      const solUsd = (salaryRaw / 1_000_000) * (c.solPercentage / 100);
      const lamports = Math.floor(
        (solUsd / solPriceUsd) * LAMPORTS_PER_SOL
      );

      let solSig: string | null = null;
      const notes: string[] = [];
      if (lamports > 0) {
        const transferIx = SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: c.wallet,
          lamports,
        });
        solSig = await sendAndConfirmTransaction(
          connection,
          new Transaction().add(transferIx),
          [admin],
          { commitment: "confirmed" }
        );
      } else {
        notes.push("SOL slice = 0 (or below 1 lamport rounding); skipping transfer");
      }

      const usdcSlice =
        (salaryRaw * c.usdcPercentage) / 100;
      if (usdcSlice > 0) {
        notes.push(
          `USDC slice ${usdcSlice / 1_000_000} skipped — no SPL transfer wired in this build`
        );
      }
      const fiatSlice =
        (salaryRaw * c.fiatPercentage) / 100;
      if (fiatSlice > 0) {
        notes.push(
          `Fiat off-ramp ${fiatSlice / 1_000_000} skipped — no off-ramp wired in this build`
        );
      }

      results.push({
        contributor: c.pda.toBase58(),
        wallet,
        payment_ct: paymentCt.toBase58(),
        run_payroll_sig: runSig,
        sol_transfer_sig: solSig,
        sol_transferred_lamports: lamports,
        notes,
      });
    }
  } finally {
    encrypt.close();
  }

  return results;
}
