import { NextRequest, NextResponse } from "next/server";
import { PayrollPlanResponse } from "@/lib/agent-api";

/**
 * Mock /api/plan — mirrors the shape produced by the real agent service
 * (see /agent/src/plan.ts). Replace the body with a fetch to the agent's
 * REST endpoint once it's exposed.
 */
export async function GET(req: NextRequest) {
  const vault =
    req.nextUrl.searchParams.get("vault") ??
    "Ehj2W8srWBc2EoUAzNRncekxbVjHUZKCnCNnbMpUHLEq";

  // Add a small artificial delay so the loading skeleton/spinner is visible.
  await new Promise((r) => setTimeout(r, 600));

  const plan: PayrollPlanResponse = {
    vault_address: vault,
    vault_name: "TestDAO",
    contributors: 3,
    total_monthly_burn_encrypted:
      "37VbWEQ1CZ6W4xFx9JvjtrH46JfA19UNNxTWkevMGrjU",
    vault_balance: {
      vault_pda_sol: 0.00176088,
      admin_sol: 4.65,
      vault_usdc: null,
      admin_usdc: null,
      sol_price_usd: 152.34,
      holdings_breakdown_pct: { sol: 100, usdc: 0 },
    },
    total_monthly_burn_usd: 15.5,
    swaps_needed: [
      {
        from: "SOL",
        to: "USDC",
        amount: "20000000",
        amount_usd: 3.05,
        route: "Raydium → Orca",
        price_impact_pct: 0.04,
        min_out: "3043520",
      },
    ],
    estimated_fees_usd: 0.05,
    treasury_runway_months: 4.2,
    payments: [
      {
        contributor: "3Vu7F1So3WSXbWQ53TssHPpHoNu86RNA7TGmiPhU1jzx",
        wallet: "ChnwWgpe8oAo9bChs5t31c6mkm1bMXQHGnNyqHpCi4bk",
        sol: 2500,
        usdc: 2500,
        fiat_offramp: 0,
      },
      {
        contributor: "HxnGN8MwngVcdPkqubyrK7W7rWPHdxvQZ2vye6JhgztP",
        wallet: "73pf8N86Pjzyyt9x19dxJAG3XGXGjravfujrjCPd4JPu",
        sol: 0,
        usdc: 6000,
        fiat_offramp: 1500,
      },
      {
        contributor: "6Qb1d6e8mSpvPYCn44CAN6etquq86uds7gimNDSqMMF9",
        wallet: "2w8g8WGsRNzFdEiH3kL3xAnEQg3RYnMcnGgK6UeeLFfu",
        sol: 900,
        usdc: 900,
        fiat_offramp: 1200,
      },
    ],
    notes: [
      "Mocked response — replace with a fetch to the agent service once exposed.",
    ],
  };

  return NextResponse.json(plan);
}
