#!/usr/bin/env ts-node
/**
 * GhostPay agent — REST API server.
 *
 *   POST /api/payroll/plan           { vault_address }   → PayrollPlan
 *   POST /api/payroll/execute        { vault_address }   → execution receipts
 *   GET  /api/vault/:address/status                       → VaultStatus
 *
 * In dev the server signs payroll-execute calls with the admin keypair on
 * disk. That's fine for hackathon demos but obviously not OK in production
 * — gate the execute endpoint behind real auth before exposing it to the
 * internet.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import { PublicKey } from "@solana/web3.js";
import { buildProgram, loadSalaries } from "./config";
import { generatePlan } from "./plan";
import { executePayroll } from "./execute";
import { buildVaultStatus } from "./status";

const PORT = Number(process.env.AGENT_PORT ?? 3001);
const DEV_MODE = (process.env.AGENT_DEV_MODE ?? "true").toLowerCase() === "true";

const app = express();
app.use(cors()); // wide-open for local dev; lock down via origin list in prod
app.use(express.json());

// --- health ---
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, devMode: DEV_MODE });
});

// --- vault status ---
app.get("/api/vault/:address/status", async (req: Request, res: Response) => {
  try {
    const vaultPubkey = new PublicKey(req.params.address);
    const { connection, program } = buildProgram();
    const salaries = loadSalaries();
    const status = await buildVaultStatus({
      connection,
      program,
      vaultPubkey,
      salaries,
    });
    res.json(status);
  } catch (err: any) {
    console.error("[status] error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// --- payroll plan ---
app.post("/api/payroll/plan", async (req: Request, res: Response) => {
  try {
    const vault = req.body?.vault_address;
    if (!vault) {
      return res.status(400).json({ error: "vault_address is required" });
    }
    const vaultPubkey = new PublicKey(vault);
    const { connection, program } = buildProgram();
    const salaries = loadSalaries();
    const { plan } = await generatePlan({
      connection,
      program,
      vaultPubkey,
      salaries,
    });
    res.json(plan);
  } catch (err: any) {
    console.error("[plan] error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// --- payroll execute ---
//
// Costs real devnet SOL on every call: per contributor it (a) creates a
// fresh payment ciphertext via the Encrypt gRPC executor and (b) signs
// run_payroll + a SystemProgram.transfer. The dev-mode flag is the only
// thing standing between a public deployment and an instant rug.
app.post("/api/payroll/execute", async (req: Request, res: Response) => {
  if (!DEV_MODE) {
    return res.status(403).json({
      error: "execute is disabled (AGENT_DEV_MODE=false)",
    });
  }
  try {
    const vault = req.body?.vault_address;
    if (!vault) {
      return res.status(400).json({ error: "vault_address is required" });
    }
    const vaultPubkey = new PublicKey(vault);
    const { connection, admin, program } = buildProgram();
    const salaries = loadSalaries();
    const planRun = await generatePlan({
      connection,
      program,
      vaultPubkey,
      salaries,
    });
    const results = await executePayroll({
      connection,
      program,
      admin,
      vault: planRun.vault,
      contributors: planRun.contributors,
      salaries,
      solPriceUsd: planRun.holdings.solPriceUsd,
    });
    res.json({
      success: true,
      transactions: results.flatMap((r) =>
        [r.run_payroll_sig, r.sol_transfer_sig].filter(
          (x): x is string => !!x
        )
      ),
      results,
    });
  } catch (err: any) {
    console.error("[execute] error:", err?.message ?? err);
    res
      .status(500)
      .json({ success: false, error: err?.message ?? String(err) });
  }
});

app.listen(PORT, () => {
  console.log(
    `\x1b[32m[agent]\x1b[0m API listening on http://localhost:${PORT}`
  );
  console.log(
    `\x1b[36m[agent]\x1b[0m DEV_MODE=${DEV_MODE} (execute is ${DEV_MODE ? "ENABLED" : "disabled"})`
  );
});
