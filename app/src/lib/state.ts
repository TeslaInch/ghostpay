import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { USDC_MINT } from "./config";

export interface VaultSnapshot {
  vault: PublicKey;
  admin: PublicKey;
  vaultName: string;
  contributorCount: number;
  balanceCt: PublicKey;
  createdAt: Date;
}

export interface ContributorSnapshot {
  pda: PublicKey;
  wallet: PublicKey;
  vault: PublicKey;
  solPercentage: number;
  usdcPercentage: number;
  fiatPercentage: number;
  isActive: boolean;
  salaryCt: PublicKey;
  pendingDecryptDigest: Buffer;
  registeredAt: Date;
}

export interface VaultBalances {
  vaultPdaSol: number;
  adminSol: number;
  vaultUsdc: bigint | null;
  adminUsdc: bigint | null;
}

export async function fetchVault(
  program: Program,
  vaultPubkey: PublicKey
): Promise<VaultSnapshot> {
  const acct = await (program.account as any).daoVault.fetch(vaultPubkey);
  return {
    vault: vaultPubkey,
    admin: acct.admin,
    vaultName: acct.vaultName,
    contributorCount: Number(acct.contributorCount),
    balanceCt: new PublicKey(acct.balanceCt),
    createdAt: new Date(Number(acct.createdAt) * 1000),
  };
}

export async function fetchContributors(
  program: Program,
  vaultPubkey: PublicKey
): Promise<ContributorSnapshot[]> {
  // ContributorRecord layout: 8 (disc) + 32 (wallet) + 32 (vault) + ...
  // Filter on the vault field at offset 8 + 32.
  const accounts = await (program.account as any).contributorRecord.all([
    {
      memcmp: {
        offset: 8 + 32,
        bytes: vaultPubkey.toBase58(),
      },
    },
  ]);
  return accounts.map((a: any) => ({
    pda: a.publicKey,
    wallet: a.account.wallet,
    vault: a.account.vault,
    solPercentage: a.account.solPercentage,
    usdcPercentage: a.account.usdcPercentage,
    fiatPercentage: a.account.fiatPercentage,
    isActive: a.account.isActive,
    salaryCt: new PublicKey(a.account.salaryCt),
    pendingDecryptDigest: Buffer.from(a.account.pendingDecryptDigest),
    registeredAt: new Date(Number(a.account.registeredAt) * 1000),
  }));
}

export async function fetchBalances(
  connection: Connection,
  vault: PublicKey,
  admin: PublicKey
): Promise<VaultBalances> {
  const [vaultPdaSol, adminSol] = await Promise.all([
    connection.getBalance(vault),
    connection.getBalance(admin),
  ]);
  const vaultUsdc = await readUsdcBalance(connection, vault);
  const adminUsdc = await readUsdcBalance(connection, admin);
  return { vaultPdaSol, adminSol, vaultUsdc, adminUsdc };
}

async function readUsdcBalance(
  connection: Connection,
  owner: PublicKey
): Promise<bigint | null> {
  // Derive the associated token address inline so we don't need to import
  // @solana/spl-token in the browser bundle just for one helper.
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
  );
  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  );
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  try {
    const info = await connection.getTokenAccountBalance(ata, "confirmed");
    return BigInt(info.value.amount);
  } catch {
    return null;
  }
}

export const lamportsToSol = (l: number) => l / LAMPORTS_PER_SOL;
export const usdcToFloat = (u: bigint | null) =>
  u === null ? null : Number(u) / 1_000_000;
