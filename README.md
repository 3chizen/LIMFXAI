# LIMFXAI

LIMFXAI is a multi-chain AI application and blockchain infrastructure project. The repository contains the LIMFXAI Agent Engine and the development implementation of the LIMFXAI Layer 1 blockchain.

## Project Overview

LIMFXAI consists of two major development areas:

- **LIMFXAI Agent Engine** — an AI-powered backend built with Cloudflare Workers and D1.
- **LIMFXAI Layer 1** — an independent blockchain implementation based on the Cosmos ecosystem, with EVM compatibility and IBC integration.

The Agent Engine provides application services. The Layer 1 project focuses on blockchain runtime, modules, state management, and network infrastructure.

---

## 1. LIMFXAI Agent Engine

The Agent Engine provides AI assistance, multi-chain research, wallet authentication, transaction inspection, and trading-related workflows.

### Features

- AI chat integration with OpenAI and xAI.
- Multi-chain token research, screening, and forensic data retrieval.
- EVM and Solana wallet authentication.
- Challenge-based signature verification and HMAC-backed sessions.
- Read-only EVM and Solana transaction simulation.
- DEX quote retrieval through Jupiter and 0x.
- EVM transaction authorization inspection.
- EVM spender intelligence and contract bytecode checks.
- Trade proposals, approval challenges, and wallet approval verification.
- Cloudflare D1 rate limiting and request protection.

### Network coverage

- Ethereum
- BNB Chain
- Base
- Arbitrum
- Solana
- TON integration is not enabled for the documented authentication and quote workflows.

Provider availability and supported networks may change.

### Security and execution boundaries

- Wallet authentication proves wallet control, not transaction authorization.
- Trade approval workflows do not independently broadcast or execute transactions.
- Quotes and simulations are informational and do not guarantee execution.
- Token screening and spender intelligence are not independent security audits.
- Solana simulation does not verify transaction signatures.
- The documented Agent Engine workflows do not provide live transaction signing or broadcast.
- Never enter seed phrases or private keys into the application.

---

## 2. LIMFXAI Layer 1

LIMFXAI Layer 1 is under active development using the Cosmos blockchain ecosystem.

### Technology

- Cosmos SDK
- Cosmos EVM
- IBC-Go
- Go

Exact dependency versions are maintained in `chain/go.mod`.

### Blockchain components

Current implementation work includes:

- Account and bank keepers.
- Staking and distribution keepers.
- Mint, governance, and slashing keepers.
- Consensus parameters keeper.
- Authz and feegrant integration.
- Cosmos EVM keeper and module integration.
- ERC-20 and fee market integration.
- IBC core and transfer keepers.
- Upgrade keeper integration.
- EVM network configuration and denomination validation.
- Static precompile configuration.
- Genesis validation and module account checks.
- Persistent ledger implementation and integrity tests.

### Native asset

The intended native asset is **LFX**.

The current denomination configuration uses:

- Base denomination: `ulfx`
- Display denomination: `lfx`

These values are development configuration. Final chain parameters must be established and validated through genesis configuration before a network launch.

### Runtime integration status

The Layer 1 implementation has several keeper and module components, but the complete application bootstrap is not finished.

Remaining integration work includes:

- Runtime application construction.
- Dependency injection and module provider registration.
- Store key registration and mounting.
- Complete module lifecycle configuration.
- IBC and EVM module registration through the runtime builder.
- Genesis initialization and validation.
- Node executable and validator configuration.
- End-to-end application and network testing.

The current codebase must not be treated as a production-ready or publicly launched blockchain network.

---

## 3. Architecture

The project separates application services from blockchain infrastructure.

| Area | Responsibility |
|---|---|
| Agent Engine | AI, research, wallet sessions, quotes, and security inspection |
| Cloudflare Worker | HTTP API and server-side application logic |
| Cloudflare D1 | Application database and persistent workflow data |
| Cosmos SDK | Layer 1 application framework |
| Cosmos EVM | EVM execution and Ethereum-compatible integration |
| IBC-Go | Inter-blockchain communication |
| Chain ledger | Persistent block and transaction state component |

The Agent Engine and Layer 1 have separate deployment and runtime requirements.

---

## 4. Agent Engine Setup

### Requirements

- Node.js LTS
- npm
- Cloudflare Wrangler
- Cloudflare account for remote deployment

### Installation

```bash
npm install
```

Create the local environment file:

```bash
cp .dev.vars.example .dev.vars
```

Configure the required server-side values:

- `SESSION_SECRET`
- AI provider API keys
- RPC endpoint URLs
- Provider API keys where required

Create the D1 database if it does not already exist:

```bash
npx wrangler d1 create limfxai-db
```

Set the database ID in `wrangler.toml`.

Apply local migrations in order:

```bash
npx wrangler d1 migrations apply limfxai-db --local
```

Start local development:

```bash
npm run dev
```

The `migrations/` directory is the migration source of truth. `schema.sql` is a snapshot of the final schema.

### Existing database warning

Do not blindly apply migrations to a database previously created directly from `schema.sql`.

Inspect the existing schema and migration history first. Migration `0002` rebuilds `trade_intents` from an older schema and may not preserve approval columns already present in an existing database.

---

## 5. Agent Engine Configuration

### RPC endpoints

Configure RPC endpoints on the server side:

- `RPC_ETHEREUM`
- `RPC_BNB`
- `RPC_BASE`
- `RPC_ARBITRUM`
- `RPC_SOLANA`

### DEX provider credentials

```dotenv
ZEROX_API_KEY=your-0x-api-key
JUPITER_API_KEY=your-jupiter-api-key
```

Use `.dev.vars` for local development and Cloudflare Worker secrets for production.

Never expose provider credentials or private RPC URLs in browser code or public repositories.

---

## 6. API Reference

### Health and network information

- `GET /api/health`
- `GET /api/rpc/health`
- `GET /api/chains`

### Authentication

- `POST /api/auth/challenge`
- `POST /api/auth/verify`

### Research

- `GET /api/research/token`
- `GET /api/forensics/token`

### AI

- `POST /api/chat`

### DEX quote

- `POST /api/quote`

### Transaction simulation

- `POST /api/simulate/evm`
- `POST /api/simulate/solana`

### Security

- `POST /api/security/inspect-evm`
- `POST /api/security/spender-intel`

### Trade proposals

- `POST /api/trade-intents`
- `GET /api/trade-intents`
- `POST /api/trade-intents/:id/approval-challenge`
- `POST /api/trade-intents/:id/approve`
- `POST /api/trade-intents/:id` with `action: reject`

Authenticated endpoints require a valid bearer session. Wallet ownership and network matching are enforced according to the operation.

---

## 7. Transaction and Simulation Details

### EVM simulation

The EVM simulation workflow uses read-only RPC methods, including:

- `eth_chainId`
- `eth_call`
- `eth_estimateGas`
- `eth_gasPrice`

Gas and network fee estimates are informational. They do not guarantee transaction inclusion or execution.

### Solana simulation

Solana simulation uses unsigned transaction simulation with signature verification disabled.

It does not authorize or execute a transaction.

### DEX quote providers

- **Solana:** Jupiter Swap API v2.
- **Ethereum, BNB Chain, Base, and Arbitrum:** 0x Swap API v2 AllowanceHolder price endpoint.

Quotes are indicative and time-sensitive. Provider output must not be treated as an executable transaction.

### Spender intelligence

The EVM spender inspection workflow checks contract bytecode and EIP-1967 proxy implementation storage where applicable.

An optional operator-maintained registry can compare spender bytecode hashes using `TRUSTED_SPENDER_REGISTRY`.

A registry match indicates a bytecode match against an operator-maintained reference. It is not an audit, certification, or guarantee of safety.

---

## 8. Layer 1 Development

The blockchain implementation is maintained in the `chain/` directory.

```bash
cd chain
```

Run the Go test suite:

```bash
go test -ldflags=-checklinkname=0 -count=1 ./...
```

The linker flag is used for the current development environment and dependency compatibility.

The chain must complete runtime application integration, store mounting, module registration, genesis initialization, and node bootstrap before it can be considered a runnable Layer 1 network.

---

## 9. Deployment

Before deploying the Agent Engine:

1. Back up and inspect the production D1 database.
2. Review pending migrations.
3. Apply production migrations only after explicit approval.
4. Configure required Worker secrets.
5. Verify RPC endpoints and provider credentials.
6. Deploy the Worker.

Apply remote migrations:

```bash
npx wrangler d1 migrations apply limfxai-db --remote
```

Deploy:

```bash
npm run deploy
```

Use an owned domain or a Cloudflare `workers.dev` subdomain.

Never commit API keys, session secrets, or private RPC credentials.

---

## 10. Development Priorities

Current development priorities include:

- Completing Cosmos SDK runtime and application bootstrap.
- Integrating EVM and IBC modules into the runtime application.
- Completing store key registration and mounting.
- Finalizing module lifecycle configuration.
- Completing genesis initialization and validation.
- Building the node executable and validator configuration.
- Improving token metadata and decimal validation.
- Expanding contract and spender analysis.
- Improving transaction simulation and chain-specific validation.
- Developing explicit wallet-authorized transaction construction.
- Adding monitoring, audit logs, and session revocation.
- Conducting independent security reviews before production use.

---

## 11. Project Status

| Component | Status |
|---|---|
| Agent Engine | Active development |
| Cloudflare Worker and D1 | Implemented application workflows |
| EVM wallet authentication | Implemented |
| Solana wallet authentication | Implemented |
| EVM and Solana simulation | Read-only |
| DEX quote integration | Quote-only |
| EVM security inspection | Implemented development workflows |
| Cosmos SDK keeper components | Under development |
| Cosmos EVM integration | Under development |
| ERC-20 and fee market integration | Under development |
| IBC integration | Under development |
| Runtime application bootstrap | In progress |
| Genesis and node initialization | Not complete |
| Production Layer 1 network | Not launched |

---

## Security Notice

LIMFXAI is an actively developed software and blockchain infrastructure project.

Features, provider integrations, and network configurations may change. No security inspection, simulation, quote, or registry match guarantees that an asset, contract, transaction, or network is safe.

Do not use development deployments as production infrastructure without appropriate testing, operational safeguards, and independent security review.
