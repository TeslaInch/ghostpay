"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useVault } from "@/hooks/use-vault";
import { detectRole } from "@/hooks/use-role";
import { TreasurerView } from "./treasurer-view";
import { ContributorView } from "./contributor-view";
import { DEFAULT_VAULT_ADDRESS } from "@/lib/config";

export default function DashboardPage() {
  const [vaultAddress] = useState<string>(DEFAULT_VAULT_ADDRESS);

  let privy: ReturnType<typeof usePrivy> | null = null;
  try {
    privy = usePrivy();
  } catch {
    /* PrivyProvider absent (no NEXT_PUBLIC_PRIVY_APP_ID) */
  }

  const walletAddress = privy?.user?.wallet?.address ?? null;
  const { data, loading, error } = useVault(vaultAddress);

  const role = detectRole(walletAddress, data);

  const showLogin = privy && !privy.authenticated && privy.ready;
  const showSetupNotice = !privy;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {showSetupNotice ? (
          <SetupNotice />
        ) : showLogin ? (
          <LoginPrompt onLogin={() => privy?.login()} />
        ) : loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorPanel message={error} />
        ) : !data ? (
          <DashboardSkeleton />
        ) : role.kind === "treasurer" ? (
          <TreasurerView status={data} />
        ) : role.kind === "contributor" ? (
          <ContributorView contributor={role.record} />
        ) : (
          <UnrecognizedWallet
            walletAddress={walletAddress}
            adminAddress={data.admin}
            contributorCount={data.contributor_count}
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function SetupNotice() {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h2 className="text-xl font-semibold text-[var(--fg)]">
        Configure Privy to continue
      </h2>
      <p className="mt-3 text-sm text-[var(--fg-muted)]">
        Set{" "}
        <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent)]">
          NEXT_PUBLIC_PRIVY_APP_ID
        </code>{" "}
        in your{" "}
        <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs">
          .env.local
        </code>{" "}
        to enable wallet auth. See{" "}
        <a
          href="https://privy.io"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          privy.io
        </a>{" "}
        for an app id.
      </p>
    </Card>
  );
}

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h2 className="text-xl font-semibold text-[var(--fg)]">
        Connect your wallet
      </h2>
      <p className="mt-3 text-sm text-[var(--fg-muted)]">
        We auto-detect whether you're the treasurer or a contributor and route
        you to the right view.
      </p>
      <div className="mt-6">
        <Button onClick={onLogin} size="lg">
          Connect wallet
        </Button>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton width="120px" height="14px" />
        <div className="mt-3">
          <Skeleton width="240px" height="32px" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6"
          >
            <Skeleton width="80px" height="12px" />
            <div className="mt-4">
              <Skeleton width="120px" height="28px" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6"
          >
            <Skeleton width="100px" height="12px" />
            <div className="mt-4">
              <Skeleton width="160px" height="28px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card className="mx-auto max-w-xl border-[var(--danger)]/30 bg-[var(--danger)]/[0.04]">
      <h2 className="text-lg font-semibold text-[var(--danger)]">
        Couldn't load vault
      </h2>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">{message}</p>
      <p className="mt-3 text-xs text-[var(--fg-subtle)]">
        Make sure the agent server is running:{" "}
        <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs">
          cd agent && npm run serve
        </code>
      </p>
    </Card>
  );
}

function UnrecognizedWallet({
  walletAddress,
  adminAddress,
  contributorCount,
}: {
  walletAddress: string | null;
  adminAddress: string;
  contributorCount: number;
}) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h2 className="text-xl font-semibold text-[var(--fg)]">
        Wallet not recognized
      </h2>
      <p className="mt-3 text-sm text-[var(--fg-muted)]">
        Connected as{" "}
        <span className="font-mono text-xs">
          {walletAddress?.slice(0, 8)}…{walletAddress?.slice(-6)}
        </span>
        , but this wallet isn't the treasurer or one of the{" "}
        {contributorCount} registered contributors on this vault.
      </p>
      <p className="mt-3 text-xs text-[var(--fg-subtle)]">
        Treasurer:{" "}
        <span className="font-mono">
          {adminAddress.slice(0, 8)}…{adminAddress.slice(-6)}
        </span>
      </p>
    </Card>
  );
}
