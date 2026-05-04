interface Props {
  size?: number;
  className?: string;
}

/**
 * Ghost-shield mark — a soft, hovering ghost silhouette inside a hardened
 * shield outline. Reads cleanly at small and large sizes; uses currentColor.
 */
export function Logo({ size = 28, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="GhostPay logo"
    >
      <defs>
        <linearGradient id="gp-shield" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#00ff88" stopOpacity="0.95" />
          <stop offset="1" stopColor="#00cc6a" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Shield outline */}
      <path
        d="M32 4l22 8v18c0 14-9.5 24-22 30C19.5 54 10 44 10 30V12l22-8z"
        stroke="url(#gp-shield)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Ghost body inside the shield */}
      <path
        d="M22 26c0-5.5 4.5-10 10-10s10 4.5 10 10v14l-3-2-3 2-2-2-2 2-2-2-3 2-3-2-2 2V26z"
        fill="url(#gp-shield)"
        opacity="0.9"
      />
      {/* Eyes */}
      <circle cx="28" cy="28" r="1.6" fill="#0a0e1a" />
      <circle cx="36" cy="28" r="1.6" fill="#0a0e1a" />
    </svg>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={28} />
      <span className="font-semibold tracking-tight text-[var(--fg)]">
        GhostPay
      </span>
    </div>
  );
}
