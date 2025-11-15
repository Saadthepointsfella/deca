CREATE TABLE IF NOT EXISTS policy_config_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    TEXT,
  actor_role  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  diff        JSONB
);

CREATE INDEX IF NOT EXISTS idx_policy_config_audit_created
  ON policy_config_audit (created_at);
