import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { USDC_MINT } from "./config";

export interface VaultSnapshot {
  vault: PublicKey;
  admin: PublicKey;
  vaultName: string;
  contributorCount: number;
  balanceCt: PublicKey;
  createdAt: Date;
  bump: number;
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
  /** Lamports held by the vault PDA itself. */
  vaultPdaSol: number;
  /** Lamports held by the admin wallet (the working treasury for transfers). */
  adminSol: number;
  /** USDC smallest units in the vault's ATA, or null if the ATA doesn't exist yet. */
  vaultUsdc: bigint | null;
  /** USDC smallest units in the admin wallet's ATA, or null. */
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
    bump: acct.bump,
  };
}

export async function fetchContributors(
  program: Program,
  vaultPubkey: PublicKey
): Promise<ContributorSnapshot[]> {
  // Anchor `memcmp` against the `vault` field. Account layout:
  //   8 (disc) + 32 (wallet) + 32 (vault) + ...
  // so the vault pubkey starts at offset 40.
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

  const [vaultAta, adminAta] = await Promise.all([
    getAssociatedTokenAddress(USDC_MINT, vault, true),
    getAssociatedTokenAddress(USDC_MINT, admin),
  ]);

  const [vaultUsdc, adminUsdc] = await Promise.all([
    readUsdcBalance(connection, vaultAta),
    readUsdcBalance(connection, adminAta),
  ]);

  return { vaultPdaSol, adminSol, vaultUsdc, adminUsdc };
}

async function readUsdcBalance(
  connection: Connection,
  ata: PublicKey
): Promise<bigint | null> {
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
