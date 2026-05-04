"use client";

import { useMemo } from "react";
import { ContributorSnapshot, VaultSnapshot } from "@/lib/state";

export type Role =
  | { kind: "treasurer"; admin: string }
  | { kind: "contributor"; record: ContributorSnapshot }
  | { kind: "guest" }
  | { kind: "unrecognized"; address: string };

export function detectRole(
  walletAddress: string | null,
  vault: VaultSnapshot | null,
  contributors: ContributorSnapshot[] | null
): Role {
  if (!walletAddress) return { kind: "guest" };
  if (!vault) return { kind: "guest" };

  if (vault.admin.toBase58() === walletAddress) {
    return { kind: "treasurer", admin: walletAddress };
  }

  const match = contributors?.find(
    (c) => c.wallet.toBase58() === walletAddress
  );
  if (match) {
    return { kind: "contributor", record: match };
  }

  return { kind: "unrecognized", address: walletAddress };
}

export function useRole(
  walletAddress: string | null,
  vault: VaultSnapshot | null,
  contributors: ContributorSnapshot[] | null
): Role {
  return useMemo(
    () => detectRole(walletAddress, vault, contributors),
    [walletAddress, vault, contributors]
  );
}
