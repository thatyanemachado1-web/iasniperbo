CREATE INDEX IF NOT EXISTS validator_rounds_table_retention_idx
  ON validator_rounds (table_id, created_at DESC, id DESC);
