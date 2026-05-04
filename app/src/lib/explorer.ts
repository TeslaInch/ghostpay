/** Solana Explorer helpers — devnet by default. */

const CLUSTER =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export function txUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

export function accountUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}

export function shortSig(signature: string, size = 6): string {
  if (signature.length <= size * 2) return signature;
  return `${signature.slice(0, size)}…${signature.slice(-size)}`;
}
