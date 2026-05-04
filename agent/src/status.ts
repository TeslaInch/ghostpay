import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { SalaryRegistry } from "./config";
import {
  ContributorSnapshot,
  fetchBalances,
  fetchContributors,
  fetchVault,
  lamportsToSol,
  usdcToFloat,
} from "./state";
import { quoteSolToUsdc, aggregateDemand } from "./treasury";

export interface VaultStatus {
  vault_address: string;
  vault_name: string;
  admin: string;
  encrypted_balance_ct: string;
  contributor_count: number;
  /** Subset of contributor data needed for browser-side role detection. */
  contributors: {
    pda: string;
    wallet: string;
    sol_percentage: number;
    usdc_percentage: number;
    fiat_percentage: number;
    salary_ct: string;
  }[];
  balances: {
    vault_pda_sol: number;
    admin_sol: number;
    vault_usdc: number | null;
    admin_usdc: number | null;
    sol_price_usd: number;
  };
  total_monthly_burn_usd: number;
  treasury_runway_months: number | null;
  /** Salaries the agent has registry entries for (counted in demand). */
  budgeted_contributor_count: number;
  notes: string[];
}

export async function buildVaultStatus(args: {
  connection: Connection;
  program: Program;
  vaultPubkey: PublicKey;
  salaries: SalaryRegistry;
}): Promise<VaultStatus> {
  const { connection, program, vaultPubkey, salaries } = args;
  const vault = await fetchVault(program, vaultPubkey);
  const [contributors, balances] = await Promise.all([
    fetchContributors(program, vaultPubkey),
    fetchBalances(connection, vault.vault, vault.admin),
  ]);

  const solSpotQuote = await quoteSolToUsdc(1_000_000_000, 50);
  const solPriceUsd = solSpotQuote
    ? Number(solSpotQuote.outAmount) / 1_000_000
    : 150;

  const solUsd = lamportsToSol(balances.adminSol + balances.vaultPdaSol) * solPriceUsd;
  const usdcUsd =
    Number((balances.adminUsdc ?? 0n) + (balances.vaultUsdc ?? 0n)) /
    1_000_000;
  const totalUsd = solUsd + usdcUsd;

  const demand = aggregateDemand(contributors, salaries);
  const runway = demand.totalUsd > 0 ? totalUsd / demand.totalUsd : null;

  const budgetedCount = contributors.filter(
    (c) => salaries[c.wallet.toBase58()] !== undefined
  ).length;

  const notes: string[] = [];
  if (budgetedCount < contributors.length) {
    notes.push(
      `${contributors.length - budgetedCount} contributor(s) on-chain have no entry in the salary registry`
    );
  }
  if (balances.vaultUsdc === null && balances.adminUsdc === null) {
    notes.push(
      "No USDC associated token accounts; USDC payouts will be skipped"
    );
  }

  return {
    vault_address: vault.vault.toBase58(),
    vault_name: vault.vaultName,
    admin: vault.admin.toBase58(),
    encrypted_balance_ct: vault.balanceCt.toBase58(),
    contributor_count: contributors.length,
    contributors: contributors.map(toContributorWire),
    balances: {
      vault_pda_sol: lamportsToSol(balances.vaultPdaSol),
      admin_sol: lamportsToSol(balances.adminSol),
      vault_usdc: usdcToFloat(balances.vaultUsdc),
      admin_usdc: usdcToFloat(balances.adminUsdc),
      sol_price_usd: round2(solPriceUsd),
    },
    total_monthly_burn_usd: round2(demand.totalUsd),
    treasury_runway_months: runway === null ? null : round2(runway),
    budgeted_contributor_count: budgetedCount,
    notes,
  };
}

function toContributorWire(c: ContributorSnapshot) {
  return {
    pda: c.pda.toBase58(),
    wallet: c.wallet.toBase58(),
    sol_percentage: c.solPercentage,
    usdc_percentage: c.usdcPercentage,
    fiat_percentage: c.fiatPercentage,
    salary_ct: c.salaryCt.toBase58(),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
