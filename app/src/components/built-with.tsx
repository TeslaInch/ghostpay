import { FadeIn } from "./fade-in";

const stack = [
  {
    name: "Solana",
    tagline: "Settlement",
    color: "from-[#9945ff] to-[#14f195]",
  },
  {
    name: "Encrypt",
    tagline: "FHE network",
    color: "from-[#00ff88] to-[#5fdcff]",
  },
  {
    name: "Jupiter",
    tagline: "Swap routing",
    color: "from-[#ff9d3a] to-[#ffd166]",
  },
  {
    name: "Privy",
    tagline: "Wallet auth",
    color: "from-[#5fdcff] to-[#a78bfa]",
  },
  {
    name: "Phantom",
    tagline: "Wallet",
    color: "from-[#a78bfa] to-[#ff7ad9]",
  },
];

export function BuiltWith() {
  return (
    <section className="border-t border-[var(--border)] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <div className="mb-10 text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-[var(--accent)]">
              Built with
            </p>
            <p className="mt-2 text-base text-[var(--fg-muted)]">
              Powered by Fully Homomorphic Encryption
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={80}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {stack.map((s) => (
              <div
                key={s.name}
                className="group rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 px-5 py-6 text-center transition-colors hover:border-[var(--accent)]/30"
              >
                <div
                  className={`mx-auto mb-3 h-1 w-8 rounded-full bg-gradient-to-r ${s.color} opacity-80 transition-opacity group-hover:opacity-100`}
                />
                <p className="text-base font-semibold tracking-tight text-[var(--fg)]">
                  {s.name}
                </p>
                <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                  {s.tagline}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
