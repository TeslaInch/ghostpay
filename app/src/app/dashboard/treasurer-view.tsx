"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader, StatValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExecutionResponse,
  PayrollPlanResponse,
  VaultStatusResponse,
  executePayroll,
  fetchPayrollPlan,
} from "@/lib/agent-api";
import { txUrl, shortSig } from "@/lib/explorer";

interface Props {
  status: VaultStatusResponse;
}

export function TreasurerView({ status }: Props) {
  const [plan, setPlan] = useState<PayrollPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<ExecutionResponse | null>(null);

  const handlePlan = async () => {
    setPlanLoading(true);
    try {
      const p = await fetchPayrollPlan(status.vault_address);
      setPlan(p);
      toast.success(
        `Plan ready · ${p.contributors} contributors · $${p.total_monthly_burn_usd} burn`
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? String(err);
      toast.error(`Plan failed: ${msg}`);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleExecute = async () => {
    if (
      !confirm(
        "This will sign run_payroll + SOL transfers on devnet for every contributor. Continue?"
      )
    )
      return;
    setExecuting(true);
    try {
      const r = await executePayroll(status.vault_address);
      setResults(r);
      toast.success(
        `Executed ${r.results.length} payments · ${r.transactions.length} transactions`
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? String(err);
      toast.error(`Execute failed: ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-[var(--accent)]">
          Treasurer view
        </p>
        <h1 className="text-3xl font-semibold text-[var(--fg)]">
          {status.vault_name}
        </h1>
        <p className="mt-1 font-mono text-xs text-[var(--fg-subtle)]">
          {status.vault_address}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Vault SOL" icon={<SolIcon />} />
          <StatValue
            value={status.balances.vault_pda_sol.toFixed(4)}
            unit="SOL (PDA)"
          />
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            +{status.balances.admin_sol.toFixed(2)} SOL in admin wallet
          </p>
        </Card>

        <Card>
          <CardHeader title="USDC" icon={<DollarIcon />} />
          <StatValue
            value={
              status.balances.vault_usdc !== null
                ? status.balances.vault_usdc.toFixed(2)
                : "—"
            }
            unit="USDC"
          />
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            {status.balances.vault_usdc === null &&
            status.balances.admin_usdc === null
              ? "No SPL token account yet"
              : "Vault + admin combined"}
          </p>
        </Card>

        <Card>
          <CardHeader title="Contributors" icon={<UsersIcon />} />
          <StatValue value={status.contributor_count} unit="active" />
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            {status.budgeted_contributor_count} budgeted in registry
          </p>
        </Card>

        <Card className="border-[var(--accent)]/40 bg-gradient-to-br from-[var(--bg-card)] to-[var(--accent)]/[0.04]">
          <CardHeader
            title="Total monthly burn"
            icon={<LockIcon />}
            hint="FHE"
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-[var(--accent)]">
              🔒
            </span>
            <span className="text-xl font-medium text-[var(--fg-muted)]">
              encrypted
            </span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-subtle)]">
            Computed on encrypted data via FHE.{" "}
            <span className="font-mono text-[var(--fg-muted)]">
              {status.encrypted_balance_ct.slice(0, 8)}…
            </span>
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Treasury runway" />
          <StatValue
            value={
              status.treasury_runway_months !== null
                ? status.treasury_runway_months.toFixed(1)
                : "—"
            }
            unit="months"
          />
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            at ${status.total_monthly_burn_usd}/mo budgeted burn
          </p>
        </Card>

        <Card>
          <CardHeader title="Salary benchmark" hint="vs. devs DAO median" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-[var(--warn)]">
              -15%
            </span>
            <span className="text-sm text-[var(--fg-muted)]">below market</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-subtle)]">
            Comparing encrypted compensation vs. anonymized DAO benchmark
            (preview — wired to a Supabase benchmarks table next).
          </p>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] p-4">
        <Button
          onClick={handlePlan}
          loading={planLoading}
          disabled={planLoading}
          variant="secondary"
        >
          Generate payroll plan
        </Button>
        <Button
          onClick={handleExecute}
          loading={executing}
          disabled={!plan || executing}
        >
          Execute payroll
        </Button>
        {plan && (
          <span className="text-xs text-[var(--fg-subtle)]">
            Plan loaded · {plan.contributors} payees · est. fees $
            {plan.estimated_fees_usd}
          </span>
        )}
      </div>

      {/* Plan output */}
      {plan && (
        <Card>
          <CardHeader
            title="Latest plan"
            hint={plan.vault_address.slice(0, 8) + "…"}
          />
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <KV k="Total burn" v={`$${plan.total_monthly_burn_usd}`} />
            <KV
              k="Runway"
              v={
                plan.treasury_runway_months
                  ? `${plan.treasury_runway_months} months`
                  : "n/a"
              }
            />
            <KV k="Estimated fees" v={`$${plan.estimated_fees_usd}`} />
          </div>
          {plan.swaps_needed.length > 0 && (
            <div className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                Swap recommended
              </p>
              {plan.swaps_needed.map((s, i) => (
                <p key={i} className="text-sm text-[var(--fg)]">
                  {s.from} → {s.to}: ${s.amount_usd}{" "}
                  {s.route && (
                    <span className="text-[var(--fg-muted)]">via {s.route}</span>
                  )}{" "}
                  {s.price_impact_pct !== null && (
                    <span className="text-[var(--fg-subtle)]">
                      (impact {s.price_impact_pct}%)
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Per-contributor split
          </h4>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--bg-elevated)]">
                <tr>
                  <Th>Contributor</Th>
                  <Th align="right">SOL</Th>
                  <Th align="right">USDC</Th>
                  <Th align="right">Fiat off-ramp</Th>
                </tr>
              </thead>
              <tbody>
                {plan.payments.map((p) => (
                  <tr
                    key={p.contributor}
                    className="border-t border-[var(--border)]"
                  >
                    <Td className="font-mono text-xs">
                      {p.wallet.slice(0, 8)}…{p.wallet.slice(-6)}
                    </Td>
                    <Td align="right">{p.sol.toLocaleString()}</Td>
                    <Td align="right">{p.usdc.toLocaleString()}</Td>
                    <Td align="right">{p.fiat_offramp.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.notes.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {plan.notes.map((n, i) => (
                <p key={i} className="text-xs text-[var(--fg-muted)]">
                  • {n}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Execution receipt */}
      {results && (
        <Card>
          <CardHeader
            title="Execution receipt"
            hint={`${results.transactions.length} txns · ${results.results.length} payees`}
          />
          <div className="space-y-2">
            {results.results.map((r) => (
              <div
                key={r.contributor}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--fg-muted)]">
                    {r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}
                  </span>
                  <span className="text-xs text-[var(--accent)]">
                    +{(r.sol_transferred_lamports / 1e9).toFixed(4)} SOL
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  <SignatureLink label="run_payroll" sig={r.run_payroll_sig} />
                  {r.sol_transfer_sig ? (
                    <SignatureLink label="transfer" sig={r.sol_transfer_sig} />
                  ) : (
                    <span className="text-[var(--fg-subtle)]">
                      transfer: skipped
                    </span>
                  )}
                </div>
                {r.notes.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {r.notes.map((n, i) => (
                      <p key={i} className="text-[10px] text-[var(--fg-subtle)]">
                        • {n}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent history (placeholder until we wire on-chain history) */}
      <Card>
        <CardHeader title="Recent payroll" />
        <p className="text-sm text-[var(--fg-muted)]">
          Wire to <span className="font-mono text-xs">PayrollBatch</span>{" "}
          accounts via{" "}
          <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent)]">
            program.account.payrollBatch.all(memcmp(vault))
          </code>
          . For now, executed batches show in the receipt above.
        </p>
      </Card>
    </div>
  );
}

function SignatureLink({ label, sig }: { label: string; sig: string }) {
  return (
    <a
      href={txUrl(sig)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-[var(--fg-muted)] transition-colors hover:text-[var(--accent)]"
    >
      <span className="text-[var(--fg-subtle)]">{label}:</span>
      <span>{shortSig(sig)}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M7 17L17 7M7 7h10v10" />
      </svg>
    </a>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">
        {k}
      </p>
      <p className="mt-0.5 text-lg font-medium tabular-nums text-[var(--fg)]">
        {v}
      </p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)] text-${align}`}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2.5 text-${align} tabular-nums text-[var(--fg)] ${className}`}
    >
      {children}
    </td>
  );
}

function SolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 8h12l2-2H7L5 8zm2 4h12l2-2H9l-2 2zm-2 4h12l2-2H7l-2 2z" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
