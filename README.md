# LIMFXAI Agent Engine v0.4

Starter Cloudflare Workers + D1 untuk fondasi riset AI multi-chain.

## Yang sudah ada
- Chat backend dengan pilihan OpenAI atau xAI; API keys hanya di environment server.
- Token screening berbasis data pair publik DexScreener untuk Solana, Ethereum, BNB Chain, TON, Base, dan Arbitrum.
- Pemeriksaan heuristik dasar: liquidity, volume, FDV/liquidity, dan volatilitas 24 jam.
- Skema proposal trading dengan status `proposed`, `approval_recorded`, `rejected`.
- UI futuristik LIMFXAI dan tautan X @LIMFXC.

## Batasan keamanan penting
- Token screening bukan audit kontrak, honeypot detection, atau jaminan keamanan.
- Tombol/status `approval_recorded` (jika dipanggil API) hanya mencatat status di database. Itu BUKAN tanda tangan wallet dan TIDAK mengirim transaksi.
- Belum ada wallet adapter, verifikasi signature, swap router, transaksi on-chain, TON Connect, atau eksekusi live.
- Jangan pernah memasukkan seed phrase/private key ke aplikasi.
- Model ID default dapat berubah/bergantung akses akun. Atur `OPENAI_MODEL` dan `XAI_MODEL` ke model yang tersedia di akun API Anda.

## Setup lokal
1. Install Node.js LTS.
2. Extract ZIP, jalankan `npm install`.
3. Salin `.dev.vars.example` menjadi `.dev.vars`, isi `OPENAI_API_KEY` dan/atau `XAI_API_KEY`.
4. `npx wrangler d1 create limfxai-db`, lalu masukkan `database_id` ke `wrangler.toml`.
5. Jalankan `npx wrangler d1 execute limfxai-db --local --file=./schema.sql`.
6. Jalankan `npm run dev`.

## Deploy
- Buat D1 production dan jalankan schema pada database tersebut.
- Atur secrets: `npx wrangler secret put OPENAI_API_KEY` dan/atau `XAI_API_KEY`.
- Deploy dengan `npm run deploy`.
- Gunakan domain yang memang Anda miliki atau subdomain `workers.dev`.

## API
- `GET /api/health`
- `GET /api/chains`
- `GET /api/research/token?chain=solana&address=...`
- `POST /api/chat` dengan `{provider,messages,research?}`
- `POST /api/trade-intents` untuk menyimpan proposal
- `GET /api/trade-intents?wallet=...`
- `POST /api/trade-intents/:id` dengan `{action:"approve"|"reject"}`

## Next production milestones
1. Wallet adapters + SIWS/EIP-4361/TonConnect signature verification.
2. Risk engine tambahan: holder concentration, liquidity lock/burn evidence, contract simulation, honeypot checks, proxy/admin privileges.
3. On-chain quote simulation and transaction construction.
4. Explicit wallet signature + chain-specific transaction confirmation.
5. Monitoring, rate limiting, audit logs, and security review.


## v0.5 — Wallet authentication security layer
- One-time, 5-minute challenges for EVM (Ethereum, BNB Chain, Base, Arbitrum) and Solana.
- EVM signatures are checked with `viem` personal-sign recovery.
- Solana detached Ed25519 signatures are verified against the base58 public key.
- Successful proof issues a one-hour HMAC-signed session token. Configure `SESSION_SECRET` (32+ random characters).
- Trade proposal creation, listing, and status changes now require a valid bearer session and enforce wallet/network ownership.
- The login message explicitly says it does not authorize token transfers or trading.

### Migration / setup for v0.5
1. Install dependencies: `npm install`.
2. Apply updated schema to both local and production D1: `npx wrangler d1 execute limfxai-db --local --file=./schema.sql` and repeat without `--local` for production.
3. For local dev, add `SESSION_SECRET` to `.dev.vars`. For production: `npx wrangler secret put SESSION_SECRET`.
4. Deploy after setting API keys and D1 binding.

### Important scope
- TON is intentionally disabled until official TON Connect `ton_proof` verification (domain binding, timestamp, payload, state-init and wallet public-key verification) is implemented. Do not treat a TON address string or a connect event as authentication.
- Solana wallet signing expects the standard wallet `signMessage` method. Some wallet providers may need an adapter-specific integration.
- Sessions are bearer tokens; production deployment should additionally use HTTPS, strict origin/CORS allowlists, rate limiting, secure client storage, logout/revocation, challenge cleanup, and security review.
- A login proof is NOT transaction approval. On-chain transaction construction, simulation, wallet signing, and confirmation remain separate future stages.


## v0.6 — Read-only transaction simulation
- EVM simulation for Ethereum, BNB Chain, Base, and Arbitrum: `eth_chainId`, `eth_call`, `eth_estimateGas`, `eth_gasPrice`, and latest block metadata.
- Returns gas estimate, a 20% gas-limit buffer suggestion, estimated network fee, and call revert reason where available.
- Solana simulation uses `simulateTransaction` with `sigVerify:false` and `replaceRecentBlockhash:true` for unsigned simulation only.
- Requires a valid one-hour LIMFXAI wallet-auth session; session wallet and selected chain are enforced.
- RPC URLs remain server-side environment variables: `RPC_ETHEREUM`, `RPC_BNB`, `RPC_BASE`, `RPC_ARBITRUM`, `RPC_SOLANA`.

### v0.6 configuration
Add RPC endpoint URLs to `.dev.vars` locally. In production, configure them as Worker secrets or protected vars:
`wrangler secret put RPC_ETHEREUM` (repeat for each endpoint). Never put provider API keys or RPC URLs containing secrets in browser JavaScript or public source.

### Simulation limits
- EVM `eth_call` and gas estimates are read-only point-in-time checks; they do not guarantee mining/inclusion or future execution.
- EVM calldata must be constructed by a trusted client/protocol integration; this release does not fetch DEX quotes, build router calldata, decode token approvals, or calculate price impact.
- Fee estimate uses `eth_gasPrice` and a 20% gas limit buffer. EIP-1559 max-fee/tip strategy and L2-specific fees (e.g. Arbitrum/Base L1 data fees) are not fully modeled; treat displayed fee as partial estimate.
- Solana simulation does not validate signatures (`sigVerify:false`) and is not approval. Do not send signed transactions here.
- TON simulation is not implemented.
- No route in this release calls `eth_sendRawTransaction`, `sendTransaction`, or Solana `sendTransaction`; no broadcast/execution.

## v0.7 — DEX quote & route preview

This release adds an authenticated, quote-only endpoint: `POST /api/quote`.

### Provider coverage

- **Solana:** Jupiter Swap API v2 `GET https://api.jup.ag/swap/v2/order`.
- **Ethereum, BNB Chain, Base, Arbitrum:** 0x Swap API v2 AllowanceHolder price endpoint (`/swap/allowance-holder/price`).
- **TON:** quote adapter is not enabled yet; do not treat TON as tradable in this build.

Set the following server-side secrets (never expose them in browser code):

```dotenv
ZEROX_API_KEY=your-0x-api-key
JUPITER_API_KEY=your-jupiter-api-key
```

Jupiter may allow low-rate keyless prototyping; configure a production API key for reliable usage. 0x requires an API key. The API keys belong in `.dev.vars` for local development or Cloudflare Worker secrets for deployment.

### Quote request

Requires a valid `Authorization: Bearer <sessionToken>` and the requested chain must match the wallet-authenticated session.

```json
{
  "chain": "base",
  "inputToken": "0x...",
  "outputToken": "0x...",
  "amount": "1000000"
}
```

`amount` is an integer string in the input token's smallest unit (base units), not a human decimal amount. The response is curated and does not return an executable transaction or calldata. Quotes are indicative and marked with a short 20-second freshness window. Token symbols/decimals and USD price normalization are not yet resolved by this endpoint, so the current UI deliberately displays raw provider output.

### Safety boundary

- Quote endpoint never signs, broadcasts, approves, or executes a swap.
- No token allowance is requested. Any allowance target returned by the provider is informational only.
- The endpoint does not yet build a final transaction, decode/validate approval calldata, or automatically feed router calldata into v0.6 simulation.
- Before production trading, add token metadata/decimal verification, firm quote refresh, spender allowlisting, exact-amount approval flow, calldata inspection, fresh simulation, wallet signature review, and chain-specific execution tests.
- Aggregator availability and supported chains can change; verify provider documentation and API responses before deployment.

### Provider references

- Jupiter Swap API v2: https://developers.jup.ag/docs/swap
- 0x API overview and authentication: https://docs.0x.org/api-reference/api-overview
- 0x Swap API quickstart: https://docs.0x.org/docs/introduction/quickstart/swap-tokens-with-0x-swap-api


## v0.8 — Transaction authorization inspection

Adds authenticated `POST /api/security/inspect-evm` for EVM sessions. The basic selector decoder recognizes ERC-20 `approve`, `increaseAllowance`, `transfer`, `transferFrom`, and ERC-721-style `setApprovalForAll`; it flags unlimited allowance and broad operator approval. It also reports unknown selectors as unknown rather than guessing. When the matching chain RPC is configured, it checks `eth_chainId` before returning the inspection.

### Request

```json
{ "to": "0x...", "data": "0x095ea7b3...", "value": "0" }
```

`value` is an unsigned integer string in wei. This endpoint is informational only: it does not submit an approval, construct a wallet prompt, sign, or broadcast. A recognized selector is not a trusted spender allowlist or a contract audit. Proxy logic, delegatecall, malicious bytecode, token tax, and non-standard ABI behavior are not comprehensively analyzed. Never sign solely based on a low-risk label.

### Production gaps

- No verified token metadata/decimals or USD normalization.
- No curated spender allowlist, verified source/ABI lookup, proxy implementation analysis, or full simulation of approval state changes.
- No EIP-712 permit decoding, Solana instruction decoder, TON transaction inspection, wallet signing, or transaction broadcast.
- Add strict CORS/origin allowlists, rate limits, audit logs, session revocation, RPC provider controls, and independent security review before production.

## v0.9 — Protocol & Spender Intelligence

`POST /api/security/spender-intel` requires an EVM wallet session. It verifies RPC chain ID, checks token and spender bytecode, reads the EIP-1967 implementation slot, and optionally compares spender bytecode SHA-256 against an operator-maintained registry. Configure `TRUSTED_SPENDER_REGISTRY` as JSON keyed by `chain:lowercase-address`. A registry match only means bytecode matches the operator's pin; it is not an audit or certification. Only EIP-1967 proxy storage is checked. No signature, approval, or broadcast is performed.
