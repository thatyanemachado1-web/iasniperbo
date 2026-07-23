CREATE TABLE IF NOT EXISTS validator_rounds (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL DEFAULT 'bac-bo',
  round_id INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('B', 'P', 'T')),
  banker_score INTEGER NOT NULL DEFAULT 0,
  player_score INTEGER NOT NULL DEFAULT 0,
  tie_multiplier INTEGER,
  round_time TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS validator_rounds_table_round_idx
  ON validator_rounds (table_id, round_id DESC);

CREATE INDEX IF NOT EXISTS validator_rounds_table_created_idx
  ON validator_rounds (table_id, created_at DESC, round_id DESC);
