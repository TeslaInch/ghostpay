"use client";

import Link from "next/link";
import { LogoMark } from "./logo";
import { WalletPill } from "./wallet-pill";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <LogoMark />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/#how-it-works"
            className="hidden text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] sm:block"
          >
            How it works
          </Link>
          <Link
            href="/dashboard"
            className="hidden text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] sm:block"
          >
            Dashboard
          </Link>
          <WalletPill />
        </nav>
      </div>
    </header>
  );
}
