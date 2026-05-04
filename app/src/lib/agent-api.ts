import axios from "axios";

export interface PayrollPlanResponse {
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
  payments: {
    contributor: string;
    wallet: string;
    sol: number;
    usdc: number;
    fiat_offramp: number;
  }[];
  notes: string[];
}

/**
 * Calls the local mock endpoint at /api/plan today; will route through
 * the agent service once it's exposed as a REST endpoint.
 */
export async function fetchPayrollPlan(
  vault: string
): Promise<PayrollPlanResponse> {
  const res = await axios.get<PayrollPlanResponse>("/api/plan", {
    params: { vault },
    timeout: 12_000,
  });
  return res.data;
}

export interface ExecutionResponse {
  results: {
    contributor: string;
    wallet: string;
    payment_ct: string;
    run_payroll_sig: string;
    sol_transfer_sig: string | null;
    sol_transferred_lamports: number;
    notes: string[];
  }[];
}

export async function executePayroll(
  vault: string
): Promise<ExecutionResponse> {
  const res = await axios.post<ExecutionResponse>(
    "/api/execute",
    { vault },
    { timeout: 30_000 }
  );
  return res.data;
}
