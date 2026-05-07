import { LogoMark } from "./logo";

const links = [
  { label: "GitHub", href: "https://github.com/TeslaInch/ghostpay" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <LogoMark />
          <p className="text-xs text-[var(--fg-subtle)]">
            Built for the Colosseum Frontier Hackathon 2026 · Solana devnet ·
            Encrypt FHE pre-alpha
          </p>
        </div>
        <nav className="flex items-center gap-5">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="text-sm text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
