ALTER TABLE solana_swap_orders
  ADD COLUMN execution_status TEXT NOT NULL DEFAULT 'pending'
  CHECK(execution_status IN ('pending','submitting','submitted','failed','unknown'));

ALTER TABLE solana_swap_orders
  ADD COLUMN execution_started_at INTEGER;

ALTER TABLE solana_swap_orders
  ADD COLUMN execution_updated_at INTEGER;

CREATE INDEX idx_solana_swap_orders_execution_status
  ON solana_swap_orders(execution_status, execution_updated_at);
