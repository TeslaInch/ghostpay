import axios from "axios";
import { JUPITER_QUOTE_URL, SOL_MINT, USDC_MINT } from "./config";
import {
  ContributorSnapshot,
  VaultBalances,
  lamportsToSol,
  usdcToFloat,
} from "./state";

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: { swapInfo: { label?: string; ammKey?: string } }[];
}

/**
 * Mainnet Jupiter quote — devnet doesn't have routable liquidity, so we fetch
 * the quote off-chain purely to demo the routing logic and swap-fee estimate.
 */
export async function quoteSolToUsdc(
  solAmountLamports: number,
  slippageBps = 50
): Promise<JupiterQuote | null> {
  if (solAmountLamports <= 0) return null;
  try {
    const res = await axios.get(JUPITER_QUOTE_URL, {
      params: {
        inputMint: SOL_MINT.toBase58(),
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // mainnet USDC
        amount: solAmountLamports,
        slippageBps,
      },
      timeout: 8_000,
    });
    return res.data as JupiterQuote;
  } catch (err: any) {
    console.warn(
      `[treasury] Jupiter quote failed (${err?.message ?? err}); skipping route`
    );
    return null;
  }
}

export interface HoldingsBreakdown {
  /** Combined SOL across vault PDA + admin wallet (USD via SOL-USD price). */
  solUsd: number;
  /** Combined USDC across vault ATA + admin ATA. */
  usdcUsd: number;
  /** SOL reserve in lamports (admin wallet, used for fees + transfers). */
  solLamports: number;
  /** USDC raw smallest units (admin or vault ATA). */
  usdcRaw: bigint;
  /** Approx SOL price in USD used for the breakdown. */
  solPriceUsd: number;
  totalUsd: number;
  solPct: number;
  usdcPct: number;
}

export async function buildHoldingsBreakdown(
  balances: VaultBalances
): Promise<HoldingsBreakdown> {
  // 1 SOL = 1e9 lamports → quote 1 SOL to mainnet USDC (6 decimals) for spot price.
  const solSpotQuote = await quoteSolToUsdc(1_000_000_000, 50);
  const solPriceUsd = solSpotQuote
    ? Number(solSpotQuote.outAmount) / 1_000_000
    : 150; // fallback so the demo still produces output if Jupiter is down

  const solLamports = balances.vaultPdaSol + balances.adminSol;
  const usdcRaw =
    (balances.vaultUsdc ?? 0n) + (balances.adminUsdc ?? 0n);

  const solUsd = lamportsToSol(solLamports) * solPriceUsd;
  const usdcUsd = Number(usdcRaw) / 1_000_000;
  const totalUsd = solUsd + usdcUsd;

  return {
    solUsd,
    usdcUsd,
    solLamports,
    usdcRaw,
    solPriceUsd,
    totalUsd,
    solPct: totalUsd > 0 ? (solUsd / totalUsd) * 100 : 0,
    usdcPct: totalUsd > 0 ? (usdcUsd / totalUsd) * 100 : 0,
  };
}

export interface SwapNeed {
  from: "SOL" | "USDC";
  to: "SOL" | "USDC";
  /** Amount in `from`'s smallest unit (lamports for SOL, 1e-6 for USDC). */
  amount: bigint;
  /** Same amount expressed in USD for human-readable output. */
  amountUsd: number;
  /** Jupiter-quoted route description, if available. */
  route?: string;
  /** Estimated price impact as percent. */
  priceImpactPct?: number;
  /** Estimated min received in `to`'s smallest unit. */
  minOut?: bigint;
}

/**
 * Match holdings against the demanded mix from contributor preferences.
 * If demand-USDC > holdings-USDC, propose a SOL→USDC swap of the gap (and
 * vice versa). One swap-need at most.
 */
export async function diagnoseSwaps(args: {
  holdings: HoldingsBreakdown;
  demands: { solUsd: number; usdcUsd: number };
}): Promise<SwapNeed[]> {
  const { holdings, demands } = args;
  const usdcGap = demands.usdcUsd - holdings.usdcUsd;
  const solGap = demands.solUsd - holdings.solUsd;

  if (usdcGap > 1 && solGap < -1) {
    // Need more USDC; sell SOL.
    const lamports = BigInt(
      Math.floor((usdcGap / holdings.solPriceUsd) * 1_000_000_000)
    );
    if (lamports <= 0n) return [];
    const quote = await quoteSolToUsdc(Number(lamports));
    return [
      {
        from: "SOL",
        to: "USDC",
        amount: lamports,
        amountUsd: usdcGap,
        route: quote?.routePlan
          .map((r) => r.swapInfo.label ?? r.swapInfo.ammKey ?? "?")
          .join(" → "),
        priceImpactPct: quote ? Number(quote.priceImpactPct) : undefined,
        minOut: quote ? BigInt(quote.otherAmountThreshold) : undefined,
      },
    ];
  }
  if (solGap > 1 && usdcGap < -1) {
    // Need more SOL; sell USDC. Skip Jupiter (we'd need the reverse direction).
    const usdcSmallest = BigInt(Math.floor(solGap * 1_000_000));
    return [
      {
        from: "USDC",
        to: "SOL",
        amount: usdcSmallest,
        amountUsd: solGap,
      },
    ];
  }
  return [];
}

/** Sum each contributor's preferred SOL/USDC/fiat slices in USD terms. */
export function aggregateDemand(
  contributors: ContributorSnapshot[],
  salaries: { [wallet: string]: number }
) {
  let solUsd = 0;
  let usdcUsd = 0;
  let fiatUsd = 0;

  for (const c of contributors) {
    const salaryRaw = salaries[c.wallet.toBase58()];
    if (salaryRaw === undefined) continue; // contributor without a registry entry — skip in plan
    const salaryUsd = salaryRaw / 1_000_000;
    solUsd += salaryUsd * (c.solPercentage / 100);
    usdcUsd += salaryUsd * (c.usdcPercentage / 100);
    fiatUsd += salaryUsd * (c.fiatPercentage / 100);
  }

  return { solUsd, usdcUsd, fiatUsd, totalUsd: solUsd + usdcUsd + fiatUsd };
}
