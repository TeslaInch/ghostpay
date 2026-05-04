import { NextRequest, NextResponse } from "next/server";
import { ExecutionResponse } from "@/lib/agent-api";

/**
 * Mock /api/execute — mirrors the shape returned by /agent/src/execute.ts.
 */
export async function POST(_req: NextRequest) {
  // Simulate the time it takes to run run_payroll + transfers per contributor.
  await new Promise((r) => setTimeout(r, 1800));

  const fakeSig = (seed: number) =>
    `${seed.toString(16).padStart(4, "0")}MockSig${"X".repeat(76)}`;

  const response: ExecutionResponse = {
    results: [
      {
        contributor: "3Vu7F1So3WSXbWQ53TssHPpHoNu86RNA7TGmiPhU1jzx",
        wallet: "ChnwWgpe8oAo9bChs5t31c6mkm1bMXQHGnNyqHpCi4bk",
        payment_ct: "Bc85WBMqYP2NQA1dmtYABmM6dWzm3siqesYDLaFSDzzA",
        run_payroll_sig: fakeSig(0xabc1),
        sol_transfer_sig: fakeSig(0xabc2),
        sol_transferred_lamports: 16_400_000,
        notes: [],
      },
      {
        contributor: "HxnGN8MwngVcdPkqubyrK7W7rWPHdxvQZ2vye6JhgztP",
        wallet: "73pf8N86Pjzyyt9x19dxJAG3XGXGjravfujrjCPd4JPu",
        payment_ct: "Drzq8tvmXJFLWXuqArGPh3G3Hhus9CDHDzHXgWaSWPmJ",
        run_payroll_sig: fakeSig(0xdef1),
        sol_transfer_sig: null,
        sol_transferred_lamports: 0,
        notes: ["SOL slice = 0; skipped"],
      },
      {
        contributor: "6Qb1d6e8mSpvPYCn44CAN6etquq86uds7gimNDSqMMF9",
        wallet: "2w8g8WGsRNzFdEiH3kL3xAnEQg3RYnMcnGgK6UeeLFfu",
        payment_ct: "7aetPVQ5qPmAHwsVuRc3mSB52MDayjcAjtPaB2T7q8N4",
        run_payroll_sig: fakeSig(0x4321),
        sol_transfer_sig: fakeSig(0x4322),
        sol_transferred_lamports: 5_900_000,
        notes: [],
      },
    ],
  };

  return NextResponse.json(response);
}
