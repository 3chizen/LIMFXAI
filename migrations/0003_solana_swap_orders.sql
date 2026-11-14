CREATE TABLE solana_swap_orders (
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(input_mint <> output_mint),
  CHECK(length(message_hash) = 64),
  CHECK(used_at IS NULL OR used_at >= created_at)
);

CREATE INDEX idx_solana_swap_orders_wallet_created
  ON solana_swap_orders(wallet, created_at DESC);

CREATE INDEX idx_solana_swap_orders_expiry
  ON solana_swap_orders(expires_at);

CREATE UNIQUE INDEX idx_solana_swap_orders_execution_signature
  ON solana_swap_orders(execution_signature)
  WHERE execution_signature IS NOT NULL;
