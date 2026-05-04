import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { SalaryRegistry } from "./config";
import {
  fetchVault,
  fetchContributors,
  fetchBalances,
  lamportsToSol,
  usdcToFloat,
  ContributorSnapshot,
  VaultSnapshot,
  VaultBalances,
} from "./state";
import {
  buildHoldingsBreakdown,
  diagnoseSwaps,
  aggregateDemand,
  HoldingsBreakdown,
  SwapNeed,
} from "./treasury";

export interface PaymentSlice {
  contributor: string;
  wallet: string;
  /** USDC smallest units (1e-6) the contributor wants in SOL value. */
  sol: number;
  /** USDC smallest units (1e-6) the contributor wants in USDC. */
  usdc: number;
  /** Smallest units routed to off-chain fiat rails. */
  fiat_offramp: number;
}

export interface PayrollPlan {
  vault_address: string;
  vault_name: string;
  contributors: number;
  total_monthly_burn_encrypted: string;
  vault_balance: {
    vault_pda_sol: number;
    admin_sol: number;
    vault_usdc: number | null;
    admin_usdc: number | null;
    sol_price_usd: number;
    holdings_breakdown_pct: { sol: number; usdc: number };
  };
  total_monthly_burn_usd: number;
  swaps_needed: {
    from: string;
    to: string;
    amount: string;
    amount_usd: number;
    route: string | null;
    price_impact_pct: number | null;
    min_out: string | null;
  }[];
  estimated_fees_usd: number;
  treasury_runway_months: number | null;
  payments: PaymentSlice[];
  notes: string[];
}

export async function generatePlan(args: {
  connection: Connection;
  program: Program;
  vaultPubkey: PublicKey;
  salaries: SalaryRegistry;
}): Promise<{
  plan: PayrollPlan;
  vault: VaultSnapshot;
  contributors: ContributorSnapshot[];
  balances: VaultBalances;
  holdings: HoldingsBreakdown;
  swaps: SwapNeed[];
}> {
  const { connection, program, vaultPubkey, salaries } = args;
  const vault = await fetchVault(program, vaultPubkey);
  const contributors = await fetchContributors(program, vaultPubkey);
  const balances = await fetchBalances(connection, vaultPubkey, vault.admin);

  const holdings = await buildHoldingsBreakdown(balances);
  const demand = aggregateDemand(contributors, salaries);
  const swaps = await diagnoseSwaps({ holdings, demands: demand });

  // Per-contributor breakdown.
  const payments: PaymentSlice[] = contributors.map((c) => {
    const salaryRaw = salaries[c.wallet.toBase58()] ?? 0;
    return {
      contributor: c.pda.toBase58(),
      wallet: c.wallet.toBase58(),
      sol: Math.round(salaryRaw * (c.solPercentage / 100)),
      usdc: Math.round(salaryRaw * (c.usdcPercentage / 100)),
      fiat_offramp: Math.round(salaryRaw * (c.fiatPercentage / 100)),
    };
  });

  // Crude fee estimate: 0.0005 SOL/tx × (1 burn + N payroll + N transfers + 1 swap)
  const txCount = 1 + 2 * contributors.length + (swaps.length > 0 ? 1 : 0);
  const estimatedFeesUsd = 0.0005 * txCount * holdings.solPriceUsd;

  // Runway: total holdings / monthly burn (in USD).
  const runway =
    demand.totalUsd > 0 ? holdings.totalUsd / demand.totalUsd : null;

  const notes: string[] = [];
  if (balances.vaultUsdc === null && balances.adminUsdc === null) {
    notes.push(
      "No USDC associated token accounts found. Run a token-creation step before USDC payouts."
    );
  }
  const missingSalaryFor = contributors.filter(
    (c) => salaries[c.wallet.toBase58()] === undefined
  );
  if (missingSalaryFor.length > 0) {
    notes.push(
      `${missingSalaryFor.length} contributor(s) have no entry in the salary registry: ${missingSalaryFor
        .map((c) => c.wallet.toBase58())
        .join(", ")}`
    );
  }
  if (holdings.solPriceUsd === 150 && holdings.totalUsd === 0) {
    notes.push("SOL price fell back to default $150 (Jupiter quote unavailable).");
  }

  const plan: PayrollPlan = {
    vault_address: vault.vault.toBase58(),
    vault_name: vault.vaultName,
    contributors: contributors.length,
    total_monthly_burn_encrypted: vault.balanceCt.toBase58(),
    vault_balance: {
      vault_pda_sol: lamportsToSol(balances.vaultPdaSol),
      admin_sol: lamportsToSol(balances.adminSol),
      vault_usdc: usdcToFloat(balances.vaultUsdc),
      admin_usdc: usdcToFloat(balances.adminUsdc),
      sol_price_usd: holdings.solPriceUsd,
      holdings_breakdown_pct: {
        sol: round2(holdings.solPct),
        usdc: round2(holdings.usdcPct),
      },
    },
    total_monthly_burn_usd: round2(demand.totalUsd),
    swaps_needed: swaps.map((s) => ({
      from: s.from,
      to: s.to,
      amount: s.amount.toString(),
      amount_usd: round2(s.amountUsd),
      route: s.route ?? null,
      price_impact_pct: s.priceImpactPct ?? null,
      min_out: s.minOut?.toString() ?? null,
    })),
    estimated_fees_usd: round4(estimatedFeesUsd),
    treasury_runway_months: runway === null ? null : round2(runway),
    payments,
    notes,
  };

  return { plan, vault, contributors, balances, holdings, swaps };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10_000) / 10_000;
}
