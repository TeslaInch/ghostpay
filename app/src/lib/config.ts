import { PublicKey } from "@solana/web3.js";

export const GHOSTPAY_PROGRAM_ID = new PublicKey(
  "AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix"
);

export const ENCRYPT_PROGRAM_ID = new PublicKey(
  "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8"
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const DEFAULT_VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_DEFAULT_VAULT_ADDRESS ??
  "Ehj2W8srWBc2EoUAzNRncekxbVjHUZKCnCNnbMpUHLEq";

export const USDC_MINT = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
);
