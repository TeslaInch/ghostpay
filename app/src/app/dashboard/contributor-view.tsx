"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleContributor } from "@/hooks/use-role";

interface Props {
  contributor: RoleContributor;
}

export function ContributorView({ contributor }: Props) {
  const [sol, setSol] = useState(contributor.sol_percentage);
  const [usdc, setUsdc] = useState(contributor.usdc_percentage);
  const [fiat, setFiat] = useState(contributor.fiat_percentage);

  const [salary, setSalary] = useState<number | null>(null);
  const [decryptState, setDecryptState] = useState<
    "idle" | "requesting" | "waiting" | "revealed"
  >("idle");

  const [updating, setUpdating] = useState(false);

  const total = sol + usdc + fiat;
  const valid = total === 100;

  const handleUpdate = async () => {
    if (!valid) {
      toast.error("Splits must sum to 100");
      return;
    }
    setUpdating(true);
    try {
      // TODO: route through Privy-signed update_preferences. Mocked for now —
      // requires the contributor wallet to sign the tx, which means we need
      // Privy's solana signing hooks wired here.
      await new Promise((r) => setTimeout(r, 800));
      toast.success("Preferences saved on-chain (mock)");
    } finally {
      setUpdating(false);
    }
  };

  const handleRevealSalary = async () => {
    // Real flow: contributor wallet signs request_salary_decrypt via Privy →
    // agent brokers gRPC poll → reveal_salary tx parsed for the cleartext.
    // Mocked here so the UX still demos cleanly. Plan/execute on the
    // treasurer side already use the real agent endpoint.
    setDecryptState("requesting");
    await new Promise((r) => setTimeout(r, 900));
    setDecryptState("waiting");
    await new Promise((r) => setTimeout(r, 1800));
    setSalary(5000);
    setDecryptState("revealed");
    toast.success("Salary decrypted via Encrypt network (mock)");
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-[var(--accent)]">
          Contributor view
        </p>
        <h1 className="text-3xl font-semibold text-[var(--fg)]">
          Hello, contributor
        </h1>
        <p className="mt-1 font-mono text-xs text-[var(--fg-subtle)]">
          {contributor.wallet}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Salary card */}
        <Card>
          <CardHeader title="Your salary" hint="EUint64 ciphertext" />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            {decryptState === "idle" && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔒</span>
                  <div>
                    <p className="text-xl font-semibold text-[var(--fg)]">
                      ENCRYPTED
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
                      Stored as ciphertext on-chain
                    </p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[10px] text-[var(--fg-subtle)]">
                  {contributor.salary_ct}
                </p>
              </>
            )}
            {decryptState === "requesting" && (
              <div className="flex items-center gap-3">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                <p className="text-[var(--fg)]">
                  Submitting decryption request…
                </p>
              </div>
            )}
            {decryptState === "waiting" && (
              <div className="flex items-center gap-3">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                <p className="text-[var(--fg)]">
                  Waiting for decryptor network…
                </p>
              </div>
            )}
            {decryptState === "revealed" && salary !== null && (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tabular-nums text-[var(--accent)]">
                    {(salary / 1_000_000).toFixed(2)}
                  </span>
                  <span className="text-lg text-[var(--fg-muted)]">USDC</span>
                </div>
                <p className="mt-2 text-xs text-[var(--fg-subtle)]">
                  Verified against{" "}
                  <span className="font-mono">pending_decrypt_digest</span>;
                  cleartext lives only in the transaction log
                </p>
              </>
            )}
          </div>
          <div className="mt-4">
            {decryptState === "idle" && (
              <Button onClick={handleRevealSalary}>View my salary</Button>
            )}
            {decryptState === "revealed" && (
              <Button
                onClick={() => {
                  setSalary(null);
                  setDecryptState("idle");
                }}
                variant="ghost"
              >
                Re-encrypt
              </Button>
            )}
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader title="Payment preferences" />
          <div className="space-y-5">
            <PrefSlider
              label="SOL"
              value={sol}
              onChange={setSol}
              accent="#00ff88"
            />
            <PrefSlider
              label="USDC"
              value={usdc}
              onChange={setUsdc}
              accent="#5fdcff"
            />
            <PrefSlider
              label="Fiat off-ramp"
              value={fiat}
              onChange={setFiat}
              accent="#ffb547"
            />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
            <p
              className={`text-sm ${
                valid ? "text-[var(--fg-muted)]" : "text-[var(--danger)]"
              }`}
            >
              Total: <span className="font-medium tabular-nums">{total}%</span>
              {!valid && <span className="ml-2">(must sum to 100)</span>}
            </p>
            <Button
              onClick={handleUpdate}
              loading={updating}
              disabled={!valid}
            >
              Update preferences
            </Button>
          </div>
        </Card>
      </div>

      {/* Payment history (mocked) */}
      <Card>
        <CardHeader title="Payment history" hint="Last 6 payouts" />
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-elevated)]">
              <tr>
                <Th>Date</Th>
                <Th align="right">SOL</Th>
                <Th align="right">USDC</Th>
                <Th align="right">Fiat</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <Td className="text-[var(--fg-muted)]">
                    {new Date(
                      Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000
                    ).toLocaleDateString()}
                  </Td>
                  <Td align="right">2.50</Td>
                  <Td align="right">2,500.00</Td>
                  <Td align="right">—</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                      Settled
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--fg-subtle)]">
          Wire to PayrollBatch + per-contributor payment ciphertext indexer.
        </p>
      </Card>
    </div>
  );
}

function PrefSlider({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: accent }}
          />
          {label}
        </span>
        <span className="font-mono tabular-nums text-sm text-[var(--fg-muted)]">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="gp-slider"
      />
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
