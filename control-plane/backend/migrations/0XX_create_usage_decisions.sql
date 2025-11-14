CREATE TABLE IF NOT EXISTS usage_decisions (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  decision    TEXT NOT NULL,     -- 'ALLOW' | 'THROTTLE' | 'BLOCK'
  tier        TEXT NOT NULL,     -- 'FREE' | 'PRO' | 'ENTERPRISE' or similar
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_decisions_created_at
  ON usage_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_decisions_decision
  ON usage_decisions(decision);
