import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export const log = (step: string, msg: string) =>
  console.log(`\x1b[36m[${step}]\x1b[0m ${msg}`);

export const ok = (msg: string) =>
  console.log(`\x1b[32m  ✓\x1b[0m ${msg}`);

export const val = (label: string, v: string | number | bigint) =>
  console.log(`\x1b[33m  →\x1b[0m ${label}: ${v}`);

export const sig = (label: string, signature: string) =>
  console.log(`\x1b[35m  ⛓\x1b[0m ${label}: ${signature}`);

export async function sendTx(
  connection: Connection,
  payer: Keypair,
  ixs: TransactionInstruction[],
  signers: Keypair[] = []
): Promise<string> {
  const tx = new Transaction().add(...ixs);
  return sendAndConfirmTransaction(connection, tx, [payer, ...signers], {
    commitment: "confirmed",
  });
}

export function pda(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

export async function pollUntil(
  connection: Connection,
  account: PublicKey,
  check: (data: Buffer) => boolean,
  timeoutMs = 120_000,
  intervalMs = 1_000
): Promise<Buffer> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const info = await connection.getAccountInfo(account);
      if (info && check(info.data as Buffer)) {
        return info.data as Buffer;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timeout waiting for ${account.toBase58()}`);
}

/** Ciphertext account is VERIFIED (status byte at offset 99 == 1). */
export const isVerified = (d: Buffer) => d.length >= 100 && d[99] === 1;

/** Decryption request is complete (written == total > 0). */
export const isDecrypted = (d: Buffer) => {
  if (d.length < 107) return false;
  const total = d.readUInt32LE(99);
  const written = d.readUInt32LE(103);
  return written === total && total > 0;
};

/**
 * Encode a mock plaintext value for pre-alpha dev mode as the executor's
 * 17-byte input format: [fhe_type(1) || value_le(16)].
 */
export function mockCiphertext(value: bigint, fheType: number): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = fheType;
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

/** FHE type discriminators (mirrors encrypt-types). */
export const FheType = {
  EBool: 0,
  EUint8: 1,
  EUint16: 2,
  EUint32: 3,
  EUint64: 4,
  EUint128: 5,
} as const;
