import { LogoMark } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <LogoMark />
        <p className="text-xs text-[var(--fg-subtle)]">
          Solana devnet · Encrypt FHE pre-alpha · Not for production yet
        </p>
      </div>
    </footer>
  );
}
