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

## Deployment (devnet)
- **Network**: Solana devnet
- **Ghostpay program ID**: `AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix`
- **Vault PDA** (TestDAO): `Ehj2W8srWBc2EoUAzNRncekxbVjHUZKCnCNnbMpUHLEq`
- **Batch PDA** (demo run): `B8USJhcT6Qu4XdRQ7H1DCDcSP4adY1Yi8Xf5XS6mg6Qf`
- **Encrypt program**: `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8`
- **Encrypt gRPC executor**: `pre-alpha-dev-1.encrypt.ika-network.net:443`
- E2E test: `bun tests/ghostpay-e2e.ts`

## Known SDK patch
The upstream `encrypt-anchor` SDK's `request_decryption` helper marks
`request_acct` with `is_signer=false` in its CPI account meta. The Encrypt
program then attempts to `system_program::create_account` for the request
account, and the runtime rejects with "signer privilege escalated" because
the calling program never granted signer status to the inner CPI.
Worked around by `request_decryption_with_signer` in
`programs/ghostpay/src/lib.rs:24`, which is a copy of the SDK helper with
that one AccountMeta flipped to `true`. Both `request_salary_decrypt` and
`request_burn_decrypt` route through the local helper. Worth flagging
upstream once dWallet Labs publishes an issue tracker.
