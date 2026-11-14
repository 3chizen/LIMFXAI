# LIMFXAI Agent Engine v0.9

Cloudflare Workers + D1 untuk riset AI multi-chain, wallet authentication, quote, simulasi, analisis keamanan, dan persetujuan trading.

## Fitur yang tersedia
- AI chat dengan OpenAI dan xAI; API keys disimpan di environment server.
- Token research, screening, dan forensics berbasis data publik.
- Wallet authentication EVM dan Solana menggunakan challenge, verifikasi signature, dan sesi HMAC.
- EVM dan Solana read-only transaction simulation.
- DEX quote melalui Jupiter dan 0x.
- EVM transaction inspection dan spender intelligence.
- Trade proposal, approval challenge, dan verifikasi persetujuan wallet.
- D1 rate limiting dan proteksi request pada Worker.

## Batasan keamanan dan eksekusi
- Token screening, forensics, dan spender intelligence bukan audit kontrak atau jaminan keamanan.
- Wallet login membuktikan kontrol wallet, bukan persetujuan transaksi.
- Trade approval tidak mengirim atau mengeksekusi transaksi.
- Quote dan simulasi bersifat informasional dan tidak menjamin hasil eksekusi.
- Belum tersedia live transaction construction, broadcast, atau on-chain execution.
- Solana simulation menggunakan transaksi unsigned dan tidak memverifikasi signature.
- TON authentication dan quote belum diaktifkan.
- Jangan pernah memasukkan seed phrase atau private key ke aplikasi.

## Setup lokal
1. Install Node.js LTS dan jalankan `npm install`.
2. Salin `.dev.vars.example` menjadi `.dev.vars`.
3. Isi `SESSION_SECRET`, API keys AI, RPC endpoints, dan API keys provider yang diperlukan.
4. Buat D1 jika belum tersedia: `npx wrangler d1 create limfxai-db`.
5. Masukkan `database_id` ke `wrangler.toml`.
6. Terapkan migration lokal secara berurutan:
   `npx wrangler d1 migrations apply limfxai-db --local`
7. Jalankan `npm run dev`.

`migrations/` adalah sumber migration. `schema.sql` merupakan snapshot skema akhir.

## Database yang sudah ada
Jangan jalankan migration secara membabi buta pada database yang sebelumnya dibuat langsung dari `schema.sql`. Migration `0002` membangun ulang `trade_intents` dari skema lama dan tidak menyalin kolom approval yang sudah ada. Periksa skema dan riwayat migration terlebih dahulu.

## Deploy
- Backup dan periksa database production sebelum perubahan skema.
- Terapkan migration production hanya setelah persetujuan eksplisit:
  `npx wrangler d1 migrations apply limfxai-db --remote`
- Atur Worker secrets yang diperlukan.
- Deploy dengan `npm run deploy`.
- Gunakan domain milik sendiri atau subdomain `workers.dev`.

Jangan menaruh API keys, session secrets, atau RPC credentials privat di browser maupun repository.

## API
- Health: `GET /api/health`, `GET /api/rpc/health`, `GET /api/chains`
- Authentication: `POST /api/auth/challenge`, `POST /api/auth/verify`
- Research: `GET /api/research/token`, `GET /api/forensics/token`
- AI: `POST /api/chat`
- Quote: `POST /api/quote`
- Simulation: `POST /api/simulate/evm`, `POST /api/simulate/solana`
- Security: `POST /api/security/inspect-evm`, `POST /api/security/spender-intel`
- Trade: `POST /api/trade-intents`, `GET /api/trade-intents`
- Approval: `POST /api/trade-intents/:id/approval-challenge`, `POST /api/trade-intents/:id/approve`
- Reject proposal: `POST /api/trade-intents/:id` dengan `action: reject`

Endpoint yang memerlukan autentikasi menggunakan bearer session dan pemeriksaan kepemilikan wallet/network sesuai operasi.

## Development milestones
1. Memperluas analisis risiko token dan validasi metadata.
2. Memperkuat verifikasi spender, ABI, proxy, dan contract behavior.
3. Memperkuat simulasi serta validasi transaksi per chain.
4. Membangun transaction construction dan execution dengan konfirmasi eksplisit wallet.
5. Menambah monitoring, audit logs, session revocation, dan security review independen.


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
