-- backend/migrations/1XX_users_and_org_users.sql

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,    -- app-level ID, e.g. "user_xxx"
  supabase_user_id  UUID UNIQUE NOT NULL,
  email             TEXT NOT NULL,
  name              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_users (
  org_id   TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  role     TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'AGENT', 'VIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id),
  CONSTRAINT fk_org_users_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_users_user ON org_users(user_id);
