CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,              -- internal id (key_*)
  org_id          TEXT NOT NULL,                 -- which org this key belongs to
  name            TEXT NOT NULL,                 -- human label in UI
  prefix          TEXT NOT NULL,                 -- first ~8 chars, for display
  hash            TEXT NOT NULL,                 -- sha256 hash of secret
  scopes          TEXT[] NOT NULL,               -- e.g. '{usage:write,policy:read}'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user TEXT,                          -- users.id
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,

  CONSTRAINT fk_api_keys_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(hash);
