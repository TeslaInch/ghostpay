"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-dim)] active:scale-[0.98] disabled:bg-[var(--border-strong)] disabled:text-[var(--fg-subtle)] shadow-[0_0_0_0_var(--accent-glow)] hover:shadow-[0_8px_24px_-8px_var(--accent-glow)]",
  secondary:
    "bg-[var(--bg-card)] text-[var(--fg)] border border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent-dim)]",
  ghost:
    "bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)]",
  danger:
    "bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/25",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});
