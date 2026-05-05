import { FadeIn } from "./fade-in";

const steps = [
  {
    icon: SlidersIcon,
    title: "Set preferences",
    body: "Each contributor picks the mix they want — SOL for upside, USDC for stability, fiat off-ramp for rent. Their slider, their split.",
  },
  {
    icon: SparkIcon,
    title: "Agent optimizes",
    body: "The AI agent reads encrypted treasury state, runs Jupiter quotes, plans the cheapest swap path that satisfies every contributor's preferred mix.",
  },
  {
    icon: SealIcon,
    title: "Private payment",
    body: "Batch payment executes through Encrypt's FHE network. Salaries stay sealed on-chain, transfers settle, the cleartext never leaves the contributor's wallet.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-[var(--border)] py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <div className="mb-16 max-w-2xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--accent)]">
              How it works
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-[var(--fg)]">
              Three steps. No public salaries.
            </h2>
          </div>
        </FadeIn>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <FadeIn key={i} delay={i * 90}>
              <div className="group h-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-7 transition-colors hover:border-[var(--accent)]/40">
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
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function SealIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 3 4-1 1 4 3 3-3 3 1 4-4-1-3 3-3-3-4 1-1-4-3-3 3-3-1-4 4 1 3-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
