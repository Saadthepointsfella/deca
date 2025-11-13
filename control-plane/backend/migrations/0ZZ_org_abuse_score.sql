CREATE TABLE IF NOT EXISTS org_abuse_scores (
  org_id       TEXT PRIMARY KEY,
  score        DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_abuse_scores_updated_at
  ON org_abuse_scores(updated_at);
