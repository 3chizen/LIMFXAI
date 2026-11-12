# Wallet auth test checklist

- [ ] Configure D1 schema including `auth_challenges`.
- [ ] Configure `SESSION_SECRET` (random 32+ characters) and provider API keys.
- [ ] EVM: connect MetaMask on Ethereum; request challenge; verify personal_sign; confirm session returned.
- [ ] Repeat EVM proof on BNB Chain, Base, and Arbitrum.
- [ ] Solana: connect wallet with `signMessage`; verify detached Ed25519 signature.
- [ ] Replay the same challenge: it must fail.
- [ ] Wait >5 minutes: expired challenge must fail.
- [ ] Try creating a trade intent without bearer token: must return 401.
- [ ] Try using another wallet's session: must return 403.
- [ ] Confirm no code path broadcasts a blockchain transaction.
- [ ] TON should remain disabled until TON Connect proof verification is added.
