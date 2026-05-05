"use client";

export type DemoMode = "auto" | "treasurer" | "contributor";

interface Props {
  mode: DemoMode;
  onChange: (m: DemoMode) => void;
  /** Disables the contributor option when no contributors are available. */
  contributorsAvailable?: boolean;
}

const OPTIONS: { value: DemoMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "treasurer", label: "Treasurer" },
  { value: "contributor", label: "Contributor" },
];

/**
 * Demo override pill — for recording walkthroughs without juggling wallets.
 * Sits subtle in the corner; opacity bumps on hover.
 */
export function DemoToggle({
  mode,
  onChange,
  contributorsAvailable = true,
}: Props) {
  return (
    <div className="group flex items-center gap-2 opacity-50 transition-opacity hover:opacity-100">
      <span className="hidden text-[10px] font-medium uppercase tracking-wider text-[var(--fg-subtle)] sm:inline">
        Demo
      </span>
      <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]/70 p-0.5 backdrop-blur-sm">
        {OPTIONS.map((opt) => {
          const active = mode === opt.value;
          const disabled =
            opt.value === "contributor" && !contributorsAvailable;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
