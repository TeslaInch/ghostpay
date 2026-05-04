import { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-sm p-6 transition-colors hover:border-[var(--border-strong)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-[var(--accent)] flex items-center justify-center">
            {icon}
          </span>
        )}
        <h3 className="text-sm font-medium tracking-wide text-[var(--fg-muted)] uppercase">
          {title}
        </h3>
      </div>
      {hint && (
        <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>
      )}
    </div>
  );
}

export function StatValue({
  value,
  unit,
  className = "",
}: {
  value: string | number;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-1.5 ${className}`}>
      <span className="text-3xl font-semibold tabular-nums text-[var(--fg)]">
        {value}
      </span>
      {unit && (
        <span className="text-sm text-[var(--fg-muted)]">{unit}</span>
      )}
    </div>
  );
}
