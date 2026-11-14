CREATE TABLE IF NOT EXISTS trade_intents (
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

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits(window_start);

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


CREATE TABLE IF NOT EXISTS solana_swap_orders (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  wallet TEXT NOT NULL,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  input_amount TEXT NOT NULL,
  output_amount TEXT NOT NULL,
  unsigned_transaction TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  last_valid_block_height INTEGER,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  execution_signature TEXT,
  execution_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(execution_status IN ('pending','submitting','submitted','failed','unknown')),
  execution_started_at INTEGER,
  execution_updated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(input_mint <> output_mint),
  CHECK(length(message_hash) = 64),
  CHECK(used_at IS NULL OR used_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_solana_swap_orders_wallet_created
  ON solana_swap_orders(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solana_swap_orders_expiry
  ON solana_swap_orders(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_solana_swap_orders_execution_signature
  ON solana_swap_orders(execution_signature)
  WHERE execution_signature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solana_swap_orders_execution_status
  ON solana_swap_orders(execution_status, execution_updated_at);
