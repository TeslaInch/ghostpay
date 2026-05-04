const steps = [
  {
    icon: LockIcon,
    title: "Encrypt salaries",
    body: "Treasurers commit each contributor's salary as an FHE ciphertext. Only the contributor — not the treasurer, not us, not Solana validators — can decrypt their own number.",
  },
  {
    icon: SumIcon,
    title: "Aggregate homomorphically",
    body: "compute_total_burn sums encrypted salaries on-chain without revealing any single value. The output is a fresh ciphertext anyone authorized can decrypt as the total.",
  },
  {
    icon: PayIcon,
    title: "Disburse with the agent",
    body: "The AI agent pulls live state, runs verify_and_deduct on encrypted balances, splits payments per contributor preferences, routes swaps via Jupiter, and disburses.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-[var(--border)] py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--accent)]">
            How it works
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-[var(--fg)]">
            Encrypted in. Encrypted through. Aggregates out.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="group rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-7 transition-colors hover:border-[var(--accent)]/40"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] transition-transform group-hover:scale-105">
                <s.icon />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[var(--fg)]">
                <span className="mr-2 text-[var(--fg-subtle)]">
                  0{i + 1}
                </span>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function SumIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h14L11 12l8 7H5l8-7z" />
    </svg>
  );
}
function PayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M5 9l7-7 7 7M5 15l7 7 7-7" />
    </svg>
  );
}
