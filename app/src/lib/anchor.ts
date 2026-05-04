"use client";

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import idl from "./ghostpay-idl.json";
import { RPC_URL } from "./config";

/**
 * Build a read-only Anchor program client. Used by hooks that fetch state
 * via `program.account.<X>.fetch` — never used to send transactions, so we
 * pass a throwaway wallet built from a fresh keypair.
 *
 * Anchor 0.32 dropped the `Wallet` re-export, so we hand-roll the minimal
 * `Wallet` interface inline.
 */
export function buildReadProgram(): Program {
  const connection = new Connection(RPC_URL, "confirmed");
  const dummy = Keypair.generate();
  const wallet = {
    publicKey: dummy.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T
    ): Promise<T> => tx,
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> => txs,
    payer: dummy,
  };
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}

export function getConnection() {
  return new Connection(RPC_URL, "confirmed");
}

export { idl };
