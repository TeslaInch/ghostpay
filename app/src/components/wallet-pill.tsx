"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";

export function WalletPill() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const privy = useTryPrivy();

  if (!mounted) return null;

  if (!privy) {
    return (
      <span className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--fg-subtle)]">
        Configure NEXT_PUBLIC_PRIVY_APP_ID
      </span>
    );
  }

  if (!privy.ready) {
    return (
      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--fg-subtle)]">
        Loading…
      </span>
    );
  }

  if (!privy.authenticated) {
    return (
      <Button onClick={() => privy.login()} size="sm">
        Connect wallet
      </Button>
    );
  }

  const address = privy.user?.wallet?.address;
  const short = address
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : "—";

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-1.5 font-mono text-xs text-[var(--fg)]">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        {short}
      </span>
      <Button onClick={() => privy.logout()} size="sm" variant="ghost">
        Disconnect
      </Button>
    </div>
  );
}

// Privy's hooks throw when not wrapped in PrivyProvider. We swallow that
// so the navbar can render in dev mode before the operator pastes their App ID.
function useTryPrivy() {
  try {
    return usePrivy();
  } catch {
    return null;
  }
}
