#!/usr/bin/env bun
/**
 * GhostPay end-to-end devnet demo.
 *
 *   1. Initialize a "TestDAO" vault
 *   2. Register 3 contributors (A: 50/50/0, B: 0/80/20, C: 30/30/40)
 *   3. Encrypt salaries (5000, 7500, 3000) + treasury (100000) via gRPC,
 *      bind them to the on-chain records
 *   4. compute_payroll_burn — homomorphically sum 3 salaries → burn_total_ct
 *   5. Decrypt the aggregate, assert == 15500
 *   6. run_payroll for contributor A — verify_and_deduct on the vault balance
 *   7. request_salary_decrypt + reveal_salary for A, assert == 5000
 *
 * All signatures + PDAs are printed at the end.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
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
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  Chain,
  encodeReadCiphertextMessage,
} from "./encrypt-client/index.ts";
import {
  setupEncrypt,
  encryptCpiAccountMetas,
  type EncryptAccounts,
} from "./encrypt-setup.ts";
import {
  log,
  ok,
  val,
  sig as printSig,
  sendTx,
  pda,
  pollUntil,
  isVerified,
  isDecrypted,
  mockCiphertext,
  FheType,
} from "./helpers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_URL = "https://api.devnet.solana.com";
const ENCRYPT_PROGRAM_ID = new PublicKey(
  "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8"
);
const GHOSTPAY_PROGRAM_ID = new PublicKey(
  "AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix"
);

// Demo values (USDC-like 6-decimal smallest units).
const VAULT_BALANCE = 100_000n;
const SALARY_A = 5_000n;
const SALARY_B = 7_500n;
const SALARY_C = 3_000n;
const EXPECTED_BURN_TOTAL = SALARY_A + SALARY_B + SALARY_C; // 15500

// ── Boot ──

const idl = JSON.parse(
  readFileSync(join(__dirname, "ghostpay-idl.json"), "utf-8")
);

const adminKp = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      readFileSync(join(__dirname, "admin-keypair.json"), "utf-8")
    )
  )
);

const connection = new Connection(RPC_URL, "confirmed");
const provider = new AnchorProvider(connection, new Wallet(adminKp), {
  commitment: "confirmed",
});
anchor.setProvider(provider);
const program = new Program(idl as any, provider);

// Track every signature for the final report.
const sigs: { label: string; signature: string }[] = [];
const record = (label: string, signature: string) => {
  sigs.push({ label, signature });
  printSig(label, signature);
};

// ── Helpers specific to ghostpay ──

function deriveCpiAuthority() {
  return pda(
    [Buffer.from("__encrypt_cpi_authority")],
    GHOSTPAY_PROGRAM_ID
  );
}

function deriveVaultPda(admin: PublicKey) {
  return pda([Buffer.from("vault"), admin.toBuffer()], GHOSTPAY_PROGRAM_ID);
}

function deriveContributorPda(vault: PublicKey, wallet: PublicKey) {
  return pda(
    [Buffer.from("contributor"), vault.toBuffer(), wallet.toBuffer()],
    GHOSTPAY_PROGRAM_ID
  );
}

function deriveBatchPda(vault: PublicKey, batchId: bigint) {
  const id = Buffer.alloc(8);
  id.writeBigUInt64LE(batchId);
  return pda(
    [Buffer.from("batch"), vault.toBuffer(), id],
    GHOSTPAY_PROGRAM_ID
  );
}

/** 8-byte Anchor instruction discriminator. */
function disc(name: string): Buffer {
  const hit = (idl.instructions as any[]).find((ix) => ix.name === name);
  if (!hit) throw new Error(`instruction ${name} not in IDL`);
  return Buffer.from(hit.discriminator);
}

/** Hand-build a compute_payroll_burn instruction. */
function computePayrollBurnIx(args: {
  vault: PublicKey;
  batch: PublicKey;
  contributorA: PublicKey;
  contributorB: PublicKey;
  contributorC: PublicKey;
  salaryA: PublicKey;
  salaryB: PublicKey;
  salaryC: PublicKey;
  burnTotalCt: PublicKey;
  enc: EncryptAccounts;
  cpiAuthority: PublicKey;
  cpiAuthorityBump: number;
  payer: PublicKey;
  batchId: bigint;
}): TransactionInstruction {
  const data = Buffer.concat([
    disc("compute_payroll_burn"),
    (() => {
      const b = Buffer.alloc(8);
      b.writeBigUInt64LE(args.batchId);
      return b;
    })(),
    Buffer.from([args.cpiAuthorityBump]),
  ]);

  return new TransactionInstruction({
    programId: GHOSTPAY_PROGRAM_ID,
    data,
    keys: [
      { pubkey: args.vault, isSigner: false, isWritable: false },
      { pubkey: args.batch, isSigner: false, isWritable: true },
      { pubkey: args.contributorA, isSigner: false, isWritable: false },
      { pubkey: args.contributorB, isSigner: false, isWritable: false },
      { pubkey: args.contributorC, isSigner: false, isWritable: false },
      { pubkey: args.salaryA, isSigner: false, isWritable: true },
      { pubkey: args.salaryB, isSigner: false, isWritable: true },
      { pubkey: args.salaryC, isSigner: false, isWritable: true },
      { pubkey: args.burnTotalCt, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      ...encryptCpiAccountMetas(
        args.enc,
        GHOSTPAY_PROGRAM_ID,
        args.cpiAuthority
      ),
    ],
  });
}

function runPayrollIx(args: {
  vault: PublicKey;
  contributor: PublicKey;
  vaultBalanceCt: PublicKey;
  salaryCt: PublicKey;
  paymentCt: PublicKey;
  enc: EncryptAccounts;
  cpiAuthority: PublicKey;
  cpiAuthorityBump: number;
  payer: PublicKey;
}): TransactionInstruction {
  const data = Buffer.concat([
    disc("run_payroll"),
    Buffer.from([args.cpiAuthorityBump]),
  ]);

  return new TransactionInstruction({
    programId: GHOSTPAY_PROGRAM_ID,
    data,
    keys: [
      { pubkey: args.vault, isSigner: false, isWritable: false },
      { pubkey: args.contributor, isSigner: false, isWritable: false },
      { pubkey: args.vaultBalanceCt, isSigner: false, isWritable: true },
      { pubkey: args.salaryCt, isSigner: false, isWritable: true },
      { pubkey: args.paymentCt, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      ...encryptCpiAccountMetas(
        args.enc,
        GHOSTPAY_PROGRAM_ID,
        args.cpiAuthority
      ),
    ],
  });
}

function requestBurnDecryptIx(args: {
  vault: PublicKey;
  batch: PublicKey;
  burnTotalCt: PublicKey;
  requestAcct: PublicKey;
  enc: EncryptAccounts;
  cpiAuthority: PublicKey;
  cpiAuthorityBump: number;
  payer: PublicKey;
}): TransactionInstruction {
  const data = Buffer.concat([
    disc("request_burn_decrypt"),
    Buffer.from([args.cpiAuthorityBump]),
  ]);

  return new TransactionInstruction({
    programId: GHOSTPAY_PROGRAM_ID,
    data,
    keys: [
      { pubkey: args.vault, isSigner: false, isWritable: false },
      { pubkey: args.batch, isSigner: false, isWritable: true },
      { pubkey: args.burnTotalCt, isSigner: false, isWritable: false },
      { pubkey: args.requestAcct, isSigner: true, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      ...encryptCpiAccountMetas(
        args.enc,
        GHOSTPAY_PROGRAM_ID,
        args.cpiAuthority
      ),
    ],
  });
}

function requestSalaryDecryptIx(args: {
  vault: PublicKey;
  contributor: PublicKey;
  wallet: PublicKey;
  salaryCt: PublicKey;
  requestAcct: PublicKey;
  enc: EncryptAccounts;
  cpiAuthority: PublicKey;
  cpiAuthorityBump: number;
  payer: PublicKey;
}): TransactionInstruction {
  const data = Buffer.concat([
    disc("request_salary_decrypt"),
    Buffer.from([args.cpiAuthorityBump]),
  ]);

  return new TransactionInstruction({
    programId: GHOSTPAY_PROGRAM_ID,
    data,
    keys: [
      { pubkey: args.vault, isSigner: false, isWritable: false },
      { pubkey: args.contributor, isSigner: false, isWritable: true },
      { pubkey: args.wallet, isSigner: true, isWritable: false },
      { pubkey: args.salaryCt, isSigner: false, isWritable: false },
      { pubkey: args.requestAcct, isSigner: true, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      ...encryptCpiAccountMetas(
        args.enc,
        GHOSTPAY_PROGRAM_ID,
        args.cpiAuthority
      ),
    ],
  });
}

// ── Main ──

async function main() {
  console.log("\n\x1b[1m═══ GhostPay E2E Demo ═══\x1b[0m\n");
  val("Program ID", GHOSTPAY_PROGRAM_ID.toBase58());
  val("Admin / payer", adminKp.publicKey.toBase58());
  val(
    "Admin balance",
    `${(await connection.getBalance(adminKp.publicKey)) / LAMPORTS_PER_SOL} SOL`
  );

  // ── Encrypt setup ──
  log("setup", "Connecting to Encrypt executor...");
  const { accounts: enc, encrypt, setupSig } = await setupEncrypt(
    connection,
    adminKp,
    ENCRYPT_PROGRAM_ID
  );
  if (setupSig) record("encrypt_deposit", setupSig);

  const [cpiAuthority, cpiAuthorityBump] = deriveCpiAuthority();
  val("ghostpay cpi_authority", cpiAuthority.toBase58());

  // ── 1. Initialize vault "TestDAO" ──
  log("1/7", "Initializing vault 'TestDAO'...");
  const [vaultPda] = deriveVaultPda(adminKp.publicKey);

  const existingVault = await connection.getAccountInfo(vaultPda);
  if (existingVault) {
    ok(`Vault already exists at ${vaultPda.toBase58()} — reusing`);
  } else {
    const sigInit = await program.methods
      .initializeVault("TestDAO")
      .accounts({
        vault: vaultPda,
        admin: adminKp.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    record("initialize_vault", sigInit);
  }
  val("Vault PDA", vaultPda.toBase58());

  // ── 2. Register 3 contributors ──
  log("2/7", "Registering 3 contributors...");
  const contributorA = Keypair.generate();
  const contributorB = Keypair.generate();
  const contributorC = Keypair.generate();
  val("Contributor A wallet", contributorA.publicKey.toBase58());
  val("Contributor B wallet", contributorB.publicKey.toBase58());
  val("Contributor C wallet", contributorC.publicKey.toBase58());

  const [pdaA] = deriveContributorPda(vaultPda, contributorA.publicKey);
  const [pdaB] = deriveContributorPda(vaultPda, contributorB.publicKey);
  const [pdaC] = deriveContributorPda(vaultPda, contributorC.publicKey);

  const regs: [Keypair, PublicKey, [number, number, number]][] = [
    [contributorA, pdaA, [50, 50, 0]],
    [contributorB, pdaB, [0, 80, 20]],
    [contributorC, pdaC, [30, 30, 40]],
  ];

  for (const [kp, pdaContrib, [sol, usdc, fiat]] of regs) {
    const s = await program.methods
      .registerContributor(kp.publicKey, sol, usdc, fiat)
      .accounts({
        vault: vaultPda,
        contributor: pdaContrib,
        admin: adminKp.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    record(`register_contributor (${sol}/${usdc}/${fiat})`, s);
  }

  // Fund contributor A so they can pay tx fees for request_salary_decrypt.
  log("2/7", "Funding contributor A with 0.05 SOL for self-decrypt fees...");
  const fundSig = await sendTx(connection, adminKp, [
    SystemProgram.transfer({
      fromPubkey: adminKp.publicKey,
      toPubkey: contributorA.publicKey,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    }),
  ]);
  record("fund_contributor_a", fundSig);

  // ── 3. Encrypt salaries + treasury via gRPC, bind to records ──
  log("3/7", "Encrypting treasury + salaries via Encrypt gRPC...");

  // Pre-create all input AND output ciphertexts so they exist on-chain
  // before any execute_graph call. Outputs start at 0 and get overwritten.
  const ctInputs = [
    { ciphertextBytes: mockCiphertext(VAULT_BALANCE, FheType.EUint64), fheType: FheType.EUint64 },
    { ciphertextBytes: mockCiphertext(SALARY_A, FheType.EUint64), fheType: FheType.EUint64 },
    { ciphertextBytes: mockCiphertext(SALARY_B, FheType.EUint64), fheType: FheType.EUint64 },
    { ciphertextBytes: mockCiphertext(SALARY_C, FheType.EUint64), fheType: FheType.EUint64 },
    { ciphertextBytes: mockCiphertext(0n, FheType.EUint64), fheType: FheType.EUint64 }, // burn_total
    { ciphertextBytes: mockCiphertext(0n, FheType.EUint64), fheType: FheType.EUint64 }, // payment
  ];
  const { ciphertextIdentifiers } = await encrypt.createInput({
    chain: Chain.Solana,
    inputs: ctInputs,
    authorized: GHOSTPAY_PROGRAM_ID.toBytes(),
    networkEncryptionPublicKey: enc.networkKey,
  });

  const vaultBalanceCt = new PublicKey(ciphertextIdentifiers[0]);
  const salaryACt = new PublicKey(ciphertextIdentifiers[1]);
  const salaryBCt = new PublicKey(ciphertextIdentifiers[2]);
  const salaryCCt = new PublicKey(ciphertextIdentifiers[3]);
  const burnTotalCt = new PublicKey(ciphertextIdentifiers[4]);
  const paymentCt = new PublicKey(ciphertextIdentifiers[5]);
  ok(`vault_balance_ct: ${vaultBalanceCt.toBase58()}`);
  ok(`salary_a_ct:      ${salaryACt.toBase58()}`);
  ok(`salary_b_ct:      ${salaryBCt.toBase58()}`);
  ok(`salary_c_ct:      ${salaryCCt.toBase58()}`);
  ok(`burn_total_ct:    ${burnTotalCt.toBase58()}`);
  ok(`payment_ct:       ${paymentCt.toBase58()}`);

  // Wait for executor to commit each input ciphertext on-chain.
  await Promise.all(
    [vaultBalanceCt, salaryACt, salaryBCt, salaryCCt, burnTotalCt, paymentCt].map(
      (ct) => pollUntil(connection, ct, isVerified, 60_000)
    )
  );
  ok("All ciphertexts committed (status=VERIFIED)");

  log("3/7", "Binding ciphertexts to on-chain records...");
  const sBindBal = await program.methods
    .setVaultBalance()
    .accounts({
      vault: vaultPda,
      admin: adminKp.publicKey,
      balanceCt: vaultBalanceCt,
    } as any)
    .rpc();
  record("set_vault_balance", sBindBal);

  for (const [pdaContrib, ct, label] of [
    [pdaA, salaryACt, "A"],
    [pdaB, salaryBCt, "B"],
    [pdaC, salaryCCt, "C"],
  ] as const) {
    const s = await program.methods
      .setSalary()
      .accounts({
        vault: vaultPda,
        contributor: pdaContrib,
        admin: adminKp.publicKey,
        salaryCt: ct,
      } as any)
      .rpc();
    record(`set_salary (${label})`, s);
  }

  // ── 4. compute_payroll_burn ──
  log("4/7", "Homomorphically summing salaries (compute_total_burn)...");
  const batchId = BigInt(Math.floor(Date.now() / 1000));
  const [batchPda] = deriveBatchPda(vaultPda, batchId);

  const burnIx = computePayrollBurnIx({
    vault: vaultPda,
    batch: batchPda,
    contributorA: pdaA,
    contributorB: pdaB,
    contributorC: pdaC,
    salaryA: salaryACt,
    salaryB: salaryBCt,
    salaryC: salaryCCt,
    burnTotalCt,
    enc,
    cpiAuthority,
    cpiAuthorityBump,
    payer: adminKp.publicKey,
    batchId,
  });
  const sBurn = await sendTx(connection, adminKp, [burnIx]);
  record("compute_payroll_burn", sBurn);

  log("4/7", "Waiting for executor to commit summed ciphertext...");
  await pollUntil(connection, burnTotalCt, isVerified, 90_000);
  ok("burn_total_ct re-committed with homomorphic sum");

  // ── 5. Decrypt aggregate, verify == 15500 ──
  log("5/7", "Requesting burn-total decryption...");
  const burnReq = Keypair.generate();
  const reqBurnIx = requestBurnDecryptIx({
    vault: vaultPda,
    batch: batchPda,
    burnTotalCt,
    requestAcct: burnReq.publicKey,
    enc,
    cpiAuthority,
    cpiAuthorityBump,
    payer: adminKp.publicKey,
  });
  const sReqBurn = await sendTx(connection, adminKp, [reqBurnIx], [burnReq]);
  record("request_burn_decrypt", sReqBurn);

  log("5/7", "Waiting for decryptor network to respond...");
  await pollUntil(connection, burnReq.publicKey, isDecrypted, 120_000);
  ok("Burn-total decrypted");

  log("5/7", "Revealing burn total on-chain (event-only)...");
  const sRevealBurn = await program.methods
    .revealBurnTotal()
    .accounts({
      vault: vaultPda,
      batch: batchPda,
      payer: adminKp.publicKey,
      requestAcct: burnReq.publicKey,
    } as any)
    .rpc();
  record("reveal_burn_total", sRevealBurn);

  const burnTx = await connection.getTransaction(sRevealBurn, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const burnEvent = parseEvent(burnTx?.meta?.logMessages ?? [], "BurnTotalRevealed");
  val("Revealed burn total", burnEvent?.total ?? "(event missing)");
  if (burnEvent && BigInt(burnEvent.total) === EXPECTED_BURN_TOTAL) {
    ok(`✓ aggregate ${burnEvent.total} == ${EXPECTED_BURN_TOTAL} (5000+7500+3000)`);
  } else {
    throw new Error(
      `Expected burn total ${EXPECTED_BURN_TOTAL}, got ${burnEvent?.total}`
    );
  }

  // ── 6. run_payroll for contributor A ──
  log("6/7", "Running payroll for contributor A (verify_and_deduct)...");
  const runIx = runPayrollIx({
    vault: vaultPda,
    contributor: pdaA,
    vaultBalanceCt,
    salaryCt: salaryACt,
    paymentCt,
    enc,
    cpiAuthority,
    cpiAuthorityBump,
    payer: adminKp.publicKey,
  });
  const sRun = await sendTx(connection, adminKp, [runIx]);
  record("run_payroll (A)", sRun);

  log("6/7", "Waiting for vault_balance_ct + payment_ct re-commit...");
  await Promise.all([
    pollUntil(connection, vaultBalanceCt, isVerified, 90_000),
    pollUntil(connection, paymentCt, isVerified, 90_000),
  ]);
  ok("Vault balance deducted and payment_ct minted (cleartext stays sealed)");

  // ── 7. request_salary_decrypt for A + reveal ──
  log("7/7", "Contributor A requesting salary decryption...");
  const salaryReq = Keypair.generate();
  const reqSalaryIx = requestSalaryDecryptIx({
    vault: vaultPda,
    contributor: pdaA,
    wallet: contributorA.publicKey,
    salaryCt: salaryACt,
    requestAcct: salaryReq.publicKey,
    enc,
    cpiAuthority,
    cpiAuthorityBump,
    payer: contributorA.publicKey, // contributor pays for their own decrypt
  });
  const sReqSal = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(reqSalaryIx),
    [contributorA, salaryReq],
    { commitment: "confirmed" }
  );
  record("request_salary_decrypt (A)", sReqSal);

  log("7/7", "Waiting for decryptor network...");
  await pollUntil(connection, salaryReq.publicKey, isDecrypted, 120_000);
  ok("Salary decrypted");

  const sRevealSalary = await program.methods
    .revealSalary()
    .accounts({
      vault: vaultPda,
      contributor: pdaA,
      wallet: contributorA.publicKey,
      requestAcct: salaryReq.publicKey,
    } as any)
    .signers([contributorA])
    .rpc();
  record("reveal_salary (A)", sRevealSalary);

  const salaryTx = await connection.getTransaction(sRevealSalary, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const salEvent = parseEvent(salaryTx?.meta?.logMessages ?? [], "SalaryRevealed");
  val("Contributor A revealed salary", salEvent?.salary ?? "(event missing)");
  if (salEvent && BigInt(salEvent.salary) === SALARY_A) {
    ok(`✓ salary ${salEvent.salary} == ${SALARY_A}`);
  } else {
    throw new Error(`Expected salary ${SALARY_A}, got ${salEvent?.salary}`);
  }

  // ── Summary ──
  console.log("\n\x1b[1m═══ Summary ═══\x1b[0m\n");
  val("Program ID", GHOSTPAY_PROGRAM_ID.toBase58());
  val("Vault PDA", vaultPda.toBase58());
  val("Batch PDA", batchPda.toBase58());
  console.log("\n\x1b[1mTransaction signatures:\x1b[0m");
  for (const { label, signature } of sigs) {
    console.log(`  ${label.padEnd(34)} ${signature}`);
  }
  console.log(
    `\n\x1b[32m✓ All 7 stages completed. Aggregate ${EXPECTED_BURN_TOTAL} verified, salary ${SALARY_A} verified.\x1b[0m\n`
  );

  encrypt.close();
}

/**
 * Anchor emits events as base64-encoded `Program data:` log lines.
 * Decoded events use the IDL's BorshCoder. This is a brittle but small parser
 * that pulls `<EventName>` from the IDL and decodes the matching payload.
 */
function parseEvent(logs: string[], name: string): any | null {
  const eventCoder = new anchor.BorshEventCoder(idl as any);
  for (const line of logs) {
    if (!line.startsWith("Program data: ")) continue;
    const b64 = line.slice("Program data: ".length).trim();
    try {
      const decoded = eventCoder.decode(b64);
      if (decoded?.name === name || decoded?.name === decapitalize(name)) {
        return jsonifyBigInts(decoded.data);
      }
    } catch {}
  }
  return null;
}

function decapitalize(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function jsonifyBigInts(o: any): any {
  if (typeof o === "bigint") return o.toString();
  if (o instanceof BN) return o.toString();
  if (Array.isArray(o)) return o.map(jsonifyBigInts);
  if (o && typeof o === "object") {
    const out: any = {};
    for (const k of Object.keys(o)) out[k] = jsonifyBigInts(o[k]);
    return out;
  }
  return o;
}

main().catch((err) => {
  console.error("\n\x1b[31m✗ Error:\x1b[0m", err);
  process.exit(1);
});
