# GhostPay — Private payroll for DAOs

> **Encrypted salaries. Transparent treasury. Powered by FHE on Solana.**

GhostPay is an AI-powered private payroll system for DAOs. Salaries live on
Solana as encrypted FHE ciphertexts; aggregate metrics — total monthly burn,
runway, benchmarks — are computed homomorphically with zero decryption. An
agent service reads the encrypted state, plans optimal swaps via Jupiter,
and disburses payments to contributor wallets according to each
contributor's preferred token mix. Treasurers see exactly what they need to
see; no contributor's individual salary is ever public on-chain.

The protocol uses [Encrypt's pre-alpha FHE network](https://docs.encrypt.xyz/),
the [Anchor framework](https://www.anchor-lang.com/) for the on-chain
program, [Privy](https://privy.io/) for wallet auth, and Jupiter v6 for
swap routing. Built for the **Colosseum Frontier Hackathon 2026**.

> **Pre-alpha disclaimer**: Encrypt's pre-alpha network stores ciphertexts
> as plaintext under the hood — do not put real salaries here yet. The
> protocol's interfaces are stable; the cryptographic guarantees come at
> Alpha 1.

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │           BROWSER (Next.js)          │
                    │  Privy auth · Anchor IDL · sonner    │
                    └──────────┬─────────────┬─────────────┘
                               │             │
                       fetch   │             │  fetch
                  /api/vault/* │             │ /api/payroll/*
                               ▼             ▼
                    ┌──────────────────────────────────────┐
                    │    AGENT (Node + Express + ts-node)  │
                    │  ─ reads vault state via Anchor      │
                    │  ─ pulls Jupiter v6 quotes           │
                    │  ─ runs run_payroll on-chain         │
                    │  ─ SystemProgram.transfer disburses  │
                    └──────────┬───────────────┬───────────┘
                       Anchor  │               │   gRPC
                               ▼               ▼
                    ┌──────────────────┐  ┌─────────────────┐
                    │ Solana devnet    │  │ Encrypt FHE     │
                    │ ghostpay program │  │ pre-alpha       │
                    │ AgHtDZL7…ZaCix   │  │ executor + key  │
                    └──────────────────┘  └─────────────────┘

                                ▲
                                │ encrypted_fn graph evaluation +
                                │ ciphertext commits
                                ▼
                    ┌──────────────────────────────────────┐
                    │  Encrypt program: 4ebfzWdK…rND8      │
                    │  Stores EUint64 ciphertexts on-chain │
                    └──────────────────────────────────────┘
```

---

## Tech stack

| Layer       | Technology |
|-------------|------------|
| On-chain    | Anchor 1.0.1 · Rust 2021 · `encrypt-anchor` (pre-alpha) |
| FHE         | `#[encrypt_fn]` DSL · `EUint64` · Encrypt executor (gRPC) |
| Frontend    | Next.js 16 · React 19 · Tailwind v4 · Privy v3 · sonner |
| Agent       | Node 22 · Express 5 · ts-node · `@coral-xyz/anchor` · `@grpc/grpc-js` |
| Wallets     | Phantom (via Privy) · embedded Solana wallets (Privy) |
| Routing     | Jupiter v6 quote API |
| Cluster     | Solana devnet · Encrypt pre-alpha (`pre-alpha-dev-1.encrypt.ika-network.net:443`) |

---

## Repo layout

```
/programs/ghostpay   Anchor program (Rust) — vault + FHE graphs + payroll
/agent               Node service — REST API + payroll orchestration
/app                 Next.js frontend — landing + dashboard
/tests               TypeScript e2e suite (Bun) — full pipeline
/target              Anchor build artifacts (idl, types, keypair, .so)
```

---

## Devnet deployment

| Resource              | Address |
|-----------------------|---------|
| ghostpay program      | `AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix` |
| TestDAO vault PDA     | `Ehj2W8srWBc2EoUAzNRncekxbVjHUZKCnCNnbMpUHLEq` |
| Encrypt program       | `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8` |
| Encrypt gRPC          | `pre-alpha-dev-1.encrypt.ika-network.net:443` |
| RPC                   | `https://api.devnet.solana.com` |
| Cluster               | devnet |

The program is upgrade-authoritied to a single key. The vault state is
demo-only and gets re-initialized when we wipe between Encrypt epochs.

---

## Setup

### Prerequisites

- Rust 1.95+ (via rustup)
- Solana CLI 3.x (`cargo build-sbf`)
- Anchor 1.0.1 (`avm install latest`)
- Node 22+ and npm
- Bun (for the e2e suite)
- A devnet keypair with ~5 SOL — see https://faucet.solana.com/

### 1 · Build the on-chain program

```bash
anchor build              # produces target/deploy/ghostpay.so + IDL
anchor deploy --provider.cluster devnet
```

The keypair lives at `target/deploy/ghostpay-keypair.json`. Run
`anchor keys sync` if you ever rotate it.

### 2 · Run the agent

```bash
cd agent
cp .env.example .env       # path to your admin keypair lives here
cp salaries.example.json salaries.json
npm install
npm run serve              # http://localhost:3001
```

The agent needs:
- `ADMIN_KEYPAIR_PATH` — pointing at your devnet keypair
- `salaries.json` — off-chain registry mapping contributor wallets → USDC
  smallest units. Keep this private; the encrypted on-chain ciphertexts
  are derived from these numbers.

CLI alternatives (no server):

```bash
npm run plan    -- --vault Ehj2W8sr...HLEq
npm run status  -- --vault Ehj2W8sr...HLEq
npm run execute -- --vault Ehj2W8sr...HLEq    # signs real txs
```

### 3 · Run the frontend

```bash
cd app
cp .env.example .env.local
# paste NEXT_PUBLIC_PRIVY_APP_ID from privy.io
npm install
npm run dev                 # http://localhost:3000
```

The dashboard auto-detects whether the connected wallet is the treasurer
or a registered contributor and renders the matching view.

### 4 · Run the e2e suite

```bash
cd tests
bun install
bun ghostpay-e2e.ts
```

Walks the full pipeline against devnet: init vault → register 3
contributors → encrypt salaries via gRPC → `compute_payroll_burn` → decrypt
the aggregate (verify `5000 + 7500 + 3000 = 15500`) → `run_payroll` →
`request_salary_decrypt` for one contributor → assert cleartext.

---

## Key program instructions

```
initialize_vault          treasurer creates a vault
register_contributor      treasurer adds a contributor + their split %
set_salary                bind a salary ciphertext to a contributor
set_vault_balance         bind a balance ciphertext to the vault
compute_payroll_burn      FHE sum of 3 salaries → fresh burn-total ct
run_payroll               FHE verify_and_deduct → updates vault, mints payment ct
benchmark_salary          FHE compare against a market median
request_salary_decrypt    contributor-only: decrypt own salary
request_burn_decrypt      treasurer-only: decrypt the burn total
reveal_salary             emits SalaryRevealed event
reveal_burn_total         emits BurnTotalRevealed event
update_preferences        contributor edits SOL/USDC/fiat split
close_contributor         contributor leaves
```

---

## Known gotchas / patches we're carrying

1. **Encrypt SDK `request_decryption` patch** — upstream sets
   `is_signer=false` on the `request_acct` AccountMeta in the CPI, which
   trips a "signer privilege escalated" reject when the Encrypt program
   tries to create the account. Fixed locally by
   `request_decryption_with_signer` in `programs/ghostpay/src/lib.rs:24`.
2. **Anchor 0.32 dropped `Wallet`** — frontend builds the wallet shape
   inline in `app/src/lib/anchor.ts`.
3. **Privy v3 missing peer deps** — `@solana-program/memo` and
   `@solana/kit` had to be installed manually with `--legacy-peer-deps`.

---

## Demo / pitch

| Asset           | URL |
|-----------------|-----|
| Landing page    | _coming soon_ (deploy `/app` to Vercel) |
| Demo video      | _link_ |
| Pitch deck      | _link_ |
| Devnet vault UI | localhost: http://localhost:3000/dashboard |

Past e2e runs are visible on Solana Explorer:
https://explorer.solana.com/address/AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix?cluster=devnet

---

## Team

- **TBD** — fill in real team info before submission.

---

## License

BSD-3-Clause-Clear (matching Encrypt's pre-alpha SDK).
