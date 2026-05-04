import axios from "axios";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:3001";

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

export interface VaultStatusResponse {
  vault_address: string;
  vault_name: string;
  admin: string;
  encrypted_balance_ct: string;
  contributor_count: number;
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
  budgeted_contributor_count: number;
  notes: string[];
}

export interface ExecutionResultRow {
  contributor: string;
  wallet: string;
  payment_ct: string;
  run_payroll_sig: string;
  sol_transfer_sig: string | null;
  sol_transferred_lamports: number;
  notes: string[];
}

export interface ExecutionResponse {
  success: boolean;
  transactions: string[];
  results: ExecutionResultRow[];
  error?: string;
}

export async function fetchVaultStatus(
  vaultAddress: string
): Promise<VaultStatusResponse> {
  const res = await axios.get<VaultStatusResponse>(
    `${AGENT_URL}/api/vault/${vaultAddress}/status`,
    { timeout: 12_000 }
  );
  return res.data;
}

export async function fetchPayrollPlan(
  vaultAddress: string
): Promise<PayrollPlanResponse> {
  const res = await axios.post<PayrollPlanResponse>(
    `${AGENT_URL}/api/payroll/plan`,
    { vault_address: vaultAddress },
    { timeout: 30_000 }
  );
  return res.data;
}

export async function executePayroll(
  vaultAddress: string
): Promise<ExecutionResponse> {
  const res = await axios.post<ExecutionResponse>(
    `${AGENT_URL}/api/payroll/execute`,
    { vault_address: vaultAddress },
    { timeout: 120_000 }
  );
  return res.data;
}
