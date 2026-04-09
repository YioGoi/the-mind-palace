CREATE TABLE IF NOT EXISTS users (
  install_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  quota_profile TEXT NOT NULL DEFAULT 'standard',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monthly_usage (
  install_id TEXT NOT NULL,
  period TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (install_id, period)
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_install_id_created_at
ON usage_logs (install_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_period
ON monthly_usage (period);
