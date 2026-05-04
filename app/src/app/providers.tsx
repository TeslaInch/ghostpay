"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useMemo } from "react";

const PRIVY_APP_ID =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "pending-configuration";

export function Providers({ children }: { children: React.ReactNode }) {
  const solanaConnectors = useMemo(() => toSolanaWalletConnectors(), []);

  if (PRIVY_APP_ID === "pending-configuration") {
    // Show a friendly setup message instead of crashing in dev when the
    // operator hasn't yet pasted their Privy app id.
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#00ff88",
          walletChainType: "solana-only",
          showWalletLoginFirst: true,
          logo: "/logo.svg",
        },
        loginMethods: ["wallet", "email"],
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
