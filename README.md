# GhostPay

**Private payroll infrastructure for DAOs — powered by FHE on Solana.**

GhostPay encrypts individual salaries on-chain while keeping treasury analytics fully transparent. Aggregate metrics like monthly burn, runway, and compensation benchmarks are computed homomorphically — no decryption required. An AI agent handles swap routing via Jupiter and disburses payments to contributor wallets in each contributor's preferred token mix.

Treasurers get full visibility into spending. Contributors get full privacy over compensation. The blockchain gets zero plaintext salary data.

---

## Features

- **Encrypted salaries** — Individual compensation is stored as FHE ciphertexts on Solana. No contributor's salary is ever public on-chain.
- **Transparent treasury analytics** — Aggregate burn, runway, and benchmarks are computed homomorphically without decrypting any individual value.
- **AI-powered disbursement** — An agent reads encrypted vault state, fetches optimal swap routes via Jupiter, and executes payroll in a single flow.
- **Contributor preferences** — Each contributor sets their preferred payout split across SOL, USDC, or fiat off-ramps.
- **Role-aware dashboard** — The UI auto-detects whether the connected wallet belongs to a treasurer or contributor and renders the appropriate view.
- **Benchmark without revealing** — Compare salaries against market medians using FHE, so compensation stays private even during review.

---

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐
│    Frontend     │ ───▶ │     Agent       │ ───▶ │  Solana + FHE Layer │
│  Next.js · React│      │  Express · AI   │      │  Anchor · Encrypt   │
│  Privy Auth     │      │  Jupiter Routing│      │  On-chain Ciphertexts│
└─────────────────┘      └─────────────────┘      └─────────────────────┘
```

**Frontend** — Privy-authenticated dashboard for treasurers and contributors.
**Agent** — Orchestrates payroll: reads encrypted state, plans swaps, signs and submits transactions.
**Solana + FHE Layer** — Anchor program stores vaults and ciphertexts; Encrypt's FHE network handles homomorphic computation.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Anchor (Rust) · Encrypt FHE SDK |
| Agent | Node.js · Express · Anchor TS Client · Jupiter v6 |
| Frontend | Next.js 16 · React 19 · Tailwind CSS · Privy |
| Wallets | Phantom · Privy Embedded Wallets |
| Network | Solana · Encrypt FHE Network |

---

## Quick Start

### Prerequisites

- Rust 1.95+, Solana CLI 3.x, Anchor 1.0.1
- Node.js 22+
- A Solana devnet keypair funded with ~5 SOL ([faucet](https://faucet.solana.com/))

### 1. Build & deploy the program

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Start the agent

```bash
cd agent
cp .env.example .env          # configure your admin keypair path
cp salaries.example.json salaries.json
npm install && npm run serve
```

### 3. Start the frontend

```bash
cd app
cp .env.example .env.local    # add your Privy app ID
npm install && npm run dev
```

---

## Repo Structure

```
/programs/ghostpay    Anchor program — vaults, FHE graphs, payroll logic
/agent                Agent service — REST API, payroll orchestration
/app                  Next.js frontend — landing page, dashboard
/tests                End-to-end test suite
```

---

## Security Notice

GhostPay is in active development on Solana devnet. The FHE layer depends on Encrypt's pre-alpha network, which is not yet cryptographically hardened. **Do not use real funds or sensitive compensation data.** Cryptographic guarantees will be enforced when Encrypt reaches production.

---

## License

BSD-3-Clause-Clear
