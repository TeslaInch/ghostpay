"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  ContributorSnapshot,
  fetchBalances,
  fetchContributors,
  fetchVault,
  VaultBalances,
  VaultSnapshot,
} from "@/lib/state";
import { buildReadProgram, getConnection } from "@/lib/anchor";

export interface VaultData {
  vault: VaultSnapshot;
  contributors: ContributorSnapshot[];
  balances: VaultBalances;
}

export function useVault(vaultAddress: string | null) {
  const [data, setData] = useState<VaultData | null>(null);
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
        const program = buildReadProgram();
        const connection = getConnection();
        const vaultPubkey = new PublicKey(vaultAddress);
        const vault = await fetchVault(program, vaultPubkey);
        const [contributors, balances] = await Promise.all([
          fetchContributors(program, vaultPubkey),
          fetchBalances(connection, vault.vault, vault.admin),
        ]);
        if (!cancelled) setData({ vault, contributors, balances });
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? String(err));
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
