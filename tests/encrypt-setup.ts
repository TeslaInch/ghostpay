/**
 * Encrypt program setup: derives PDAs, creates the per-payer fee deposit, and
 * exposes the gRPC client. Mirrors the upstream encrypt-pre-alpha setup.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { createEncryptClient } from "./encrypt-client/index.ts";
import { log, ok, pda, sendTx } from "./helpers.ts";

export interface EncryptAccounts {
  encryptProgram: PublicKey;
  configPda: PublicKey;
  eventAuthority: PublicKey;
  depositPda: PublicKey;
  networkKeyPda: PublicKey;
  networkKey: Buffer;
}

export interface EncryptSetup {
  accounts: EncryptAccounts;
  encrypt: ReturnType<typeof createEncryptClient>;
  setupSig?: string;
}

/**
 * Connect to executor gRPC, derive Encrypt PDAs, and ensure the deposit
 * exists for `payer`. Skips deposit creation if already initialized.
 */
export async function setupEncrypt(
  connection: Connection,
  payer: Keypair,
  encryptProgram: PublicKey,
  grpcUrl = "pre-alpha-dev-1.encrypt.ika-network.net:443"
): Promise<EncryptSetup> {
  const encrypt = createEncryptClient(grpcUrl);
  log("setup", `gRPC executor: ${grpcUrl}`);

  const [configPda] = pda([Buffer.from("encrypt_config")], encryptProgram);
  const [eventAuthority] = pda(
    [Buffer.from("__event_authority")],
    encryptProgram
  );
  const [depositPda, depositBump] = pda(
    [Buffer.from("encrypt_deposit"), payer.publicKey.toBuffer()],
    encryptProgram
  );
  const networkKey = Buffer.alloc(32, 0x55);
  const [networkKeyPda] = pda(
    [Buffer.from("network_encryption_key"), networkKey],
    encryptProgram
  );

  const accounts: EncryptAccounts = {
    encryptProgram,
    configPda,
    eventAuthority,
    depositPda,
    networkKeyPda,
    networkKey,
  };

  const existing = await connection.getAccountInfo(depositPda);
  if (existing) {
    ok(`Deposit already initialized: ${depositPda.toBase58()}`);
    return { accounts, encrypt };
  }

  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    throw new Error(
      `Encrypt config not found at ${configPda.toBase58()} — wrong program ID?`
    );
  }
  const encVault = new PublicKey(
    (configInfo.data as Buffer).subarray(100, 132)
  );
  const vaultPk = encVault.equals(SystemProgram.programId)
    ? payer.publicKey
    : encVault;

  log("setup", `Creating deposit at ${depositPda.toBase58()}...`);
  // Layout matches the upstream pre-alpha helper: 18 bytes with trailing zeros
  // reserved for the deposit u128 amount (defaults to 0 for the dev faucet).
  const ixData = Buffer.alloc(18);
  ixData[0] = 14; // IX_CREATE_DEPOSIT
  ixData[1] = depositBump;

  const setupSig = await sendTx(connection, payer, [
    new TransactionInstruction({
      programId: encryptProgram,
      data: ixData,
      keys: [
        { pubkey: depositPda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        {
          pubkey: vaultPk,
          isSigner: vaultPk.equals(payer.publicKey),
          isWritable: true,
        },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    }),
  ]);
  ok(`Deposit created: ${setupSig}`);

  return { accounts, encrypt, setupSig };
}

/**
 * Encrypt-CPI accounts in the order ghostpay declares them after `payer`.
 * (Note: ghostpay's structs put `payer` BEFORE this block, unlike upstream
 * examples that interleave it.)
 */
export function encryptCpiAccountMetas(
  enc: EncryptAccounts,
  callerProgram: PublicKey,
  cpiAuthority: PublicKey
) {
  return [
    { pubkey: enc.encryptProgram, isSigner: false, isWritable: false },
    { pubkey: enc.configPda, isSigner: false, isWritable: true },
    { pubkey: enc.depositPda, isSigner: false, isWritable: true },
    { pubkey: cpiAuthority, isSigner: false, isWritable: false },
    { pubkey: callerProgram, isSigner: false, isWritable: false },
    { pubkey: enc.networkKeyPda, isSigner: false, isWritable: false },
    { pubkey: enc.eventAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
}
