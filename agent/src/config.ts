import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";

dotenv.config();

export const GHOSTPAY_PROGRAM_ID = new PublicKey(
  "AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix"
);

export const ENCRYPT_PROGRAM_ID = new PublicKey(
  "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8"
);

export const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const JUPITER_QUOTE_URL =
  process.env.JUPITER_QUOTE_URL ?? "https://quote-api.jup.ag/v6/quote";

export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// Devnet USDC; mainnet is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
export const USDC_MINT = process.env.USDC_MINT
  ? new PublicKey(process.env.USDC_MINT)
  : new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

export interface SalaryRegistry {
  [walletPubkey: string]: number;
}

export function loadSalaries(): SalaryRegistry {
  const p =
    process.env.SALARIES_PATH ??
    path.join(__dirname, "..", "salaries.json");
  if (!fs.existsSync(p)) {
    throw new Error(
      `Salary registry not found at ${p}. Copy salaries.example.json → salaries.json (gitignored).`
    );
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as SalaryRegistry;
  const cleaned: SalaryRegistry = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue;
    cleaned[k] = v as number;
  }
  return cleaned;
}

export function loadAdminKeypair(): Keypair {
  const p =
    process.env.ADMIN_KEYPAIR_PATH ??
    path.join(__dirname, "..", "..", "tests", "admin-keypair.json");
  if (!fs.existsSync(p)) {
    throw new Error(
      `Admin keypair not found at ${p}. Set ADMIN_KEYPAIR_PATH or copy from tests/admin-keypair.json.`
    );
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8")))
  );
}

export function loadIdl(): any {
  const idlPath = path.join(__dirname, "..", "ghostpay-idl.json");
  return JSON.parse(fs.readFileSync(idlPath, "utf-8"));
}

export function buildProgram(): {
  connection: Connection;
  admin: Keypair;
  program: Program;
  provider: AnchorProvider;
} {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = loadAdminKeypair();
  const provider = new AnchorProvider(connection, new Wallet(admin), {
    commitment: "confirmed",
  });
  const program = new Program(loadIdl(), provider);
  return { connection, admin, program, provider };
}
