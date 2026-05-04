"use client";

import { useMemo } from "react";
import { VaultStatusResponse } from "@/lib/agent-api";

export type RoleContributor = VaultStatusResponse["contributors"][number];

export type Role =
  | { kind: "treasurer"; admin: string }
  | { kind: "contributor"; record: RoleContributor }
  | { kind: "guest" }
  | { kind: "unrecognized"; address: string };

export function detectRole(
  walletAddress: string | null,
  status: VaultStatusResponse | null
): Role {
  if (!walletAddress || !status) return { kind: "guest" };

  if (status.admin === walletAddress) {
    return { kind: "treasurer", admin: walletAddress };
  }

  const match = status.contributors.find((c) => c.wallet === walletAddress);
  if (match) {
    return { kind: "contributor", record: match };
  }

  return { kind: "unrecognized", address: walletAddress };
}

export function useRole(
  walletAddress: string | null,
  status: VaultStatusResponse | null
): Role {
  return useMemo(
    () => detectRole(walletAddress, status),
    [walletAddress, status]
  );
}
