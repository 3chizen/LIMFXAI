CREATE TABLE IF NOT EXISTS trade_intents (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  chain TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('buy','sell')),
  amount TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','approval_recorded','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trade_intents_wallet ON trade_intents(wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  chain TEXT NOT NULL,
  message TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expiry ON auth_challenges(expires_at);
