CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  secret_prefix   TEXT NOT NULL,              -- first 8 chars for display
  secret_hash     TEXT NOT NULL,              -- sha256 of the full secret
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id       ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at   ON api_keys(revoked_at);
