CREATE TABLE IF NOT EXISTS policy_config (
  key         TEXT PRIMARY KEY,    -- e.g. 'global'
  value       JSONB NOT NULL,      -- shape validated in app
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed a default row if empty
INSERT INTO policy_config(key, value)
SELECT 'global', '{"spike_sensitivity": {"FREE": 2.5, "PRO": 3.5, "ENTERPRISE": 4.5}, "overdraft_factor": 1.2, "free_tier_reserve": 0.05}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM policy_config WHERE key='global');
