CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  model_key   TEXT, -- e.g. "gpt-4o-mini" or future HF identifier
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id   TEXT;

UPDATE usage_events
SET subject_type = 'ORG'
WHERE subject_type IS NULL;
