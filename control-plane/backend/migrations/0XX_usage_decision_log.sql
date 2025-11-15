-- Track each usage decision with type + tier for metrics

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usage_decision_type') THEN
    CREATE TYPE usage_decision_type AS ENUM ('ALLOW', 'THROTTLE', 'BLOCK');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS usage_decision_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  plan_tier   TEXT NOT NULL,
  decision_type usage_decision_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_decision_log_created
  ON usage_decision_log (created_at);

CREATE INDEX IF NOT EXISTS idx_usage_decision_log_tier_type
  ON usage_decision_log (plan_tier, decision_type, created_at);
