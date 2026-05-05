import { FadeIn } from "./fade-in";

const PUBLIC_ROWS = [
  { label: "Senior Engineer", amount: "$12,000" },
  { label: "Lead Designer", amount: "$8,500" },
  { label: "Junior Dev", amount: "$3,200" },
  { label: "Community Lead", amount: "$5,100" },
];

export function Problem() {
  return (
    <section className="border-t border-[var(--border)] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <div className="mb-14 max-w-2xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--accent)]">
              The problem
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-[var(--fg)]">
              Every DAO has a hiring problem.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[var(--fg-muted)]">
              Salaries are public on every Solana payroll today. Contributors
              compare what everyone earns, resentment builds, and your best
              talent leaves for a Web2 job they can't be doxxed at. GhostPay
              fixes the leak at the chain level.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-2">
          <FadeIn delay={80}>
            <div className="overflow-hidden rounded-xl border border-[var(--danger)]/30 bg-[var(--bg-card)]/60">
              <ExplorerHeader
                domain="explorer.solana.com"
                tx="5fXp…YpEt"
                tone="danger"
              />
              <div className="p-5">
                <p className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--danger)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
                  Public payroll · everything visible
                </p>
                <ul className="space-y-2">
                  {PUBLIC_ROWS.map((r) => (
                    <li
                      key={r.label}
                      className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
                    >
                      <span className="text-[var(--fg-muted)]">{r.label}</span>
                      <span className="font-mono font-medium tabular-nums text-[var(--danger)]">
                        {r.amount}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-[var(--fg-subtle)]">
                  Anyone with a wallet can read these amounts forever.
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={160}>
            <div className="overflow-hidden rounded-xl border border-[var(--accent)]/30 bg-[var(--bg-card)]/60">
              <ExplorerHeader
                domain="ghostpay.app · encrypted"
                tx="EUint64 ciphertext"
                tone="accent"
              />
              <div className="p-5">
                <p className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] gp-pulse" />
                  GhostPay · sealed at the chain level
                </p>
                <ul className="space-y-2">
                  {PUBLIC_ROWS.map((r) => (
                    <li
                      key={r.label}
                      className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
                    >
                      <span className="text-[var(--fg-muted)]">{r.label}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/[0.08] px-2 py-0.5 font-mono text-xs font-medium text-[var(--accent)] gp-glow">
                        🔒 ENCRYPTED
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-[var(--fg-subtle)]">
                  Aggregates (burn, runway) computed homomorphically — never
                  decrypt to read.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function ExplorerHeader({
  domain,
  tx,
  tone,
}: {
  domain: string;
  tx: string;
  tone: "danger" | "accent";
}) {
  const dot =
    tone === "danger" ? "bg-[var(--danger)]" : "bg-[var(--accent)]";
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className={`h-2 w-2 rounded-full ${dot}`} />
        </div>
        <span className="ml-2 font-mono text-[10px] text-[var(--fg-subtle)]">
          {domain}
        </span>
      </div>
      <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
        tx · {tx}
      </span>
    </div>
  );
}
