# GhostPay — Private Payroll for DAOs

## Overview
AI-powered private payroll agent for DAOs on Solana using
Encrypt's FHE infrastructure. Salaries are stored as encrypted
ciphertexts. Aggregates (total burn, averages, runway) are
computed homomorphically without decrypting individual salaries.
Contributors can request decryption of only their own salary.

## Architecture
- /programs/ghostpay — Anchor program with encrypt-anchor FHE integration
- /app — Next.js 14 frontend (Privy auth, Phantom wallet, dashboard)
- /agent — Node.js TypeScript agent service (treasury optimization, batch execution)

## Tech Stack
- Solana (Anchor framework + encrypt-anchor crate)
- Encrypt FHE SDK (#[encrypt_fn] DSL, EUint64 ciphertext accounts)
- Next.js 14 + TypeScript + Tailwind CSS
- Privy (@privy-io/react-auth) for wallet auth
- Phantom wallet adapter
- Jupiter API (https://quote-api.jup.ag/v6) for swap optimization
- Supabase for off-chain metadata, waitlist, benchmarks
- @solana/web3.js + @coral-xyz/anchor

## Conventions
- All TypeScript, strict mode
- Anchor program in Rust with encrypt-anchor
- PDAs for all program accounts
- Target: Solana devnet
- Git commit after each major milestone

## Encrypt SDK Notes (Pre-Alpha)
- Crate: encrypt-anchor
- DSL: #[encrypt_fn] compiles to FHE computation graphs
- Types: EUint64 for encrypted unsigned 64-bit integers
- Flow: execute_graph → executor evaluates → results committed on-chain
- Decryption: request_decryption → decryptor network responds
- Docs: https://docs.encrypt.xyz/
