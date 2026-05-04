"use client";

import { useEffect, useState } from "react";
import {
  VaultStatusResponse,
  fetchVaultStatus,
} from "@/lib/agent-api";

/**
 * Loads vault state via the agent's `GET /api/vault/:address/status` endpoint.
 * Returns everything the dashboard needs in one round-trip — including the
 * contributor list used for browser-side role detection — so the dashboard
 * doesn't need a direct on-chain Anchor read.
 */
export function useVault(vaultAddress: string | null) {
  const [data, setData] = useState<VaultStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!vaultAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const status = await fetchVaultStatus(vaultAddress);
        if (!cancelled) setData(status);
      } catch (err: any) {
        if (!cancelled) {
          const msg =
            err?.response?.data?.error ?? err?.message ?? String(err);
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vaultAddress, refreshKey]);

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
