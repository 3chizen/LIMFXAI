CREATE TABLE trade_intents_new (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  chain TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('buy','sell')),
  amount TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','approval_recorded','wallet_approved','rejected')),
  approval_signature TEXT,
  approved_at INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO trade_intents_new
  (id,wallet,chain,asset,side,amount,rationale,status,created_at)
SELECT id,wallet,chain,asset,side,amount,rationale,status,created_at
FROM trade_intents;

DROP TABLE trade_intents;
ALTER TABLE trade_intents_new RENAME TO trade_intents;

CREATE INDEX IF NOT EXISTS idx_trade_intents_wallet
ON trade_intents(wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS trade_approval_challenges (
  id TEXT PRIMARY KEY,
  trade_intent_id TEXT NOT NULL REFERENCES trade_intents(id),
  wallet TEXT NOT NULL,
  chain TEXT NOT NULL,
  proposal_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_trade_approval_challenges_expiry
ON trade_approval_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_trade_approval_challenges_intent
ON trade_approval_challenges(trade_intent_id);
