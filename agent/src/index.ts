#!/usr/bin/env ts-node
/**
 * GhostPay payroll agent — CLI entry point.
 *
 *   ts-node src/index.ts plan    --vault <addr>
 *   ts-node src/index.ts execute --vault <addr>
 *   ts-node src/index.ts status  --vault <addr>
 */

import { PublicKey } from "@solana/web3.js";
import { buildProgram, loadSalaries } from "./config";
import { generatePlan } from "./plan";
import { executePayroll } from "./execute";

type Subcommand = "plan" | "execute" | "status";

function parseArgs(argv: string[]): {
  cmd: Subcommand;
  vault: string;
} {
  const [cmd, ...rest] = argv.slice(2);
  if (!cmd || !["plan", "execute", "status"].includes(cmd)) {
    usage();
    process.exit(1);
  }

  let vault: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--vault") {
      vault = rest[i + 1];
      i++;
    }
  }
  vault = vault ?? process.env.VAULT_ADDRESS;
  if (!vault) {
    console.error("Missing --vault <address> (or set VAULT_ADDRESS in .env)\n");
    usage();
    process.exit(1);
  }
  return { cmd: cmd as Subcommand, vault };
}

function usage() {
  console.error(
    [
      "Usage:",
      "  ts-node src/index.ts plan    --vault <address>",
      "  ts-node src/index.ts execute --vault <address>",
      "  ts-node src/index.ts status  --vault <address>",
      "",
      "Or set VAULT_ADDRESS in agent/.env.",
    ].join("\n")
  );
}

async function runPlan(vaultAddress: string): Promise<void> {
  const { connection, program } = buildProgram();
  const salaries = loadSalaries();
  const { plan } = await generatePlan({
    connection,
    program,
    vaultPubkey: new PublicKey(vaultAddress),
    salaries,
  });
  console.log(JSON.stringify(plan, null, 2));
}

async function runStatus(vaultAddress: string): Promise<void> {
  const { connection, program } = buildProgram();
  const salaries = loadSalaries();
  const { plan, contributors, holdings } = await generatePlan({
    connection,
    program,
    vaultPubkey: new PublicKey(vaultAddress),
    salaries,
  });
  console.log("\x1b[1m═══ GhostPay Status ═══\x1b[0m\n");
  console.log(`  Vault:               ${plan.vault_address}`);
  console.log(`  Name:                ${plan.vault_name}`);
  console.log(`  Contributors:        ${plan.contributors}`);
  console.log(`  Vault PDA SOL:       ${plan.vault_balance.vault_pda_sol}`);
  console.log(`  Admin SOL:           ${plan.vault_balance.admin_sol}`);
  console.log(
    `  Vault USDC:          ${plan.vault_balance.vault_usdc ?? "(no ATA)"}`
  );
  console.log(
    `  Admin USDC:          ${plan.vault_balance.admin_usdc ?? "(no ATA)"}`
  );
  console.log(
    `  SOL price (Jupiter): $${plan.vault_balance.sol_price_usd.toFixed(2)}`
  );
  console.log(
    `  Holdings mix:        SOL ${plan.vault_balance.holdings_breakdown_pct.sol}% / USDC ${plan.vault_balance.holdings_breakdown_pct.usdc}%`
  );
  console.log(
    `  Encrypted burn ct:   ${plan.total_monthly_burn_encrypted}`
  );
  console.log(
    `  Monthly burn (USD):  $${plan.total_monthly_burn_usd}`
  );
  console.log(
    `  Runway (months):     ${plan.treasury_runway_months ?? "n/a"}`
  );
  if (plan.notes.length) {
    console.log("\n  Notes:");
    for (const n of plan.notes) console.log(`    • ${n}`);
  }
  console.log("\n  Contributor preferences:");
  for (const c of contributors) {
    console.log(
      `    ${c.wallet.toBase58().slice(0, 8)}…  SOL ${c.solPercentage}% / USDC ${c.usdcPercentage}% / fiat ${c.fiatPercentage}%`
    );
  }
}

async function runExecute(vaultAddress: string): Promise<void> {
  const { connection, admin, program } = buildProgram();
  const salaries = loadSalaries();
  const { plan, vault, contributors, holdings } = await generatePlan({
    connection,
    program,
    vaultPubkey: new PublicKey(vaultAddress),
    salaries,
  });
  console.log("Plan summary:");
  console.log(`  Contributors: ${plan.contributors}`);
  console.log(`  Total burn: $${plan.total_monthly_burn_usd}`);
  console.log(`  Runway: ${plan.treasury_runway_months ?? "n/a"} months`);
  console.log(`  Estimated fees: $${plan.estimated_fees_usd}`);
  console.log("\nDispatching payroll on devnet...\n");

  const results = await executePayroll({
    connection,
    program,
    admin,
    vault,
    contributors,
    salaries,
    solPriceUsd: holdings.solPriceUsd,
  });

  console.log("\n\x1b[1mExecution result:\x1b[0m");
  for (const r of results) {
    console.log(`\n  Contributor ${r.wallet}`);
    console.log(`    payment_ct          ${r.payment_ct || "(skipped)"}`);
    console.log(`    run_payroll sig     ${r.run_payroll_sig || "(skipped)"}`);
    console.log(
      `    SOL transfer sig    ${r.sol_transfer_sig ?? "(none)"}  (${r.sol_transferred_lamports} lamports)`
    );
    if (r.notes.length) {
      console.log("    Notes:");
      for (const n of r.notes) console.log(`      • ${n}`);
    }
  }

  const totalLamports = results.reduce(
    (acc, r) => acc + r.sol_transferred_lamports,
    0
  );
  console.log(
    `\n\x1b[32m✓ Sent ${totalLamports} lamports across ${results.length} contributor(s)\x1b[0m\n`
  );
}

async function main() {
  const { cmd, vault } = parseArgs(process.argv);
  if (cmd === "plan") return runPlan(vault);
  if (cmd === "status") return runStatus(vault);
  if (cmd === "execute") return runExecute(vault);
}

main().catch((err) => {
  console.error("\x1b[31m✗ Agent error:\x1b[0m", err?.message ?? err);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
