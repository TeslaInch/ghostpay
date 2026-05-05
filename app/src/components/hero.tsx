"use client";

import Link from "next/link";
import { Button } from "./ui/button";

export function Hero() {
  const scrollToWaitlist = () => {
    document
      .getElementById("waitlist")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative pt-20 pb-24 sm:pt-32 sm:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] gp-pulse" />
            Live on Solana devnet
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-[var(--fg)] sm:text-5xl md:text-6xl">
            Private payroll
            <br />
            <span className="bg-gradient-to-r from-[var(--accent)] to-[#5fdcff] bg-clip-text text-transparent">
              for DAOs.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--fg-muted)]">
            Encrypted salaries. Transparent treasury.{" "}
            <span className="text-[var(--fg)]">
              Powered by FHE on Solana.
            </span>
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/dashboard">
              <Button size="lg">Launch app</Button>
            </Link>
            <Button onClick={scrollToWaitlist} variant="secondary" size="lg">
              Join waitlist
            </Button>
            <Link
              href="#how-it-works"
              className="ml-1 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              See how it works →
            </Link>
          </div>
        </div>

        {/* Faux dashboard preview */}
        <div className="mt-20 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-2 shadow-2xl backdrop-blur">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <PreviewStat
                label="Total monthly burn"
                value="🔒 Encrypted"
                hint="FHE-aggregated"
              />
              <PreviewStat label="Treasury runway" value="14.2 months" />
              <PreviewStat label="Active contributors" value="27" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--fg)]">
        {value}
      </p>
      {hint && <p className="text-xs text-[var(--accent)]">{hint}</p>}
    </div>
  );
}
