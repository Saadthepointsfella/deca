-- 001_init.sql

-- UUID helper (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Enums =====

CREATE TYPE usage_subject_type AS ENUM ('ORG','AGENT','MODEL');

CREATE TYPE ticket_status AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
CREATE TYPE ticket_priority AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
CREATE TYPE ticket_source AS ENUM ('EMAIL','INTERCOM','ZENDESK','MANUAL');

CREATE TYPE usage_decision_type AS ENUM ('ALLOW','THROTTLE','BLOCK');

-- ===== Identity =====

CREATE TABLE orgs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','AGENT','VIEWER')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Plans =====

CREATE TABLE plans (
  id                     TEXT PRIMARY KEY,
  tier                   TEXT NOT NULL CHECK (tier IN ('FREE','PRO','ENTERPRISE')),
  name                   TEXT NOT NULL,
  daily_quota_units      BIGINT NOT NULL,
  monthly_quota_units    BIGINT NOT NULL,
  spike_sensitivity      DOUBLE PRECISION NOT NULL,
  overdraft_factor       DOUBLE PRECISION NOT NULL,
  support_sla_minutes    INTEGER NOT NULL,
  max_agents             INTEGER,
  max_models             INTEGER,
  max_agent_daily_units  BIGINT
);

CREATE TABLE org_plans (
  org_id         TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  plan_id        TEXT NOT NULL REFERENCES plans(id),
  overrides_json JSONB
);

-- optional seed plans
INSERT INTO plans (id, tier, name, daily_quota_units, monthly_quota_units,
                   spike_sensitivity, overdraft_factor, support_sla_minutes,
                   max_agents, max_models, max_agent_daily_units)
VALUES
  ('plan_free', 'FREE', 'Free',
   10000, 300000,
   0.5, 1.1,
   1440,
   NULL, NULL, NULL),
  ('plan_pro', 'PRO', 'Pro',
   100000, 3000000,
   0.7, 1.2,
   240,
   NULL, NULL, NULL),
  ('plan_ent', 'ENTERPRISE', 'Enterprise',
   1000000, 30000000,
   0.9, 1.5,
   60,
   NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ===== Usage =====

CREATE TABLE usage_records (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  subject_type  usage_subject_type NOT NULL,
  subject_id    TEXT,
  timestamp     TIMESTAMPTZ NOT NULL,
  units         BIGINT NOT NULL,
  endpoint      TEXT NOT NULL
);

CREATE INDEX idx_usage_org_time
  ON usage_records (org_id, timestamp);

CREATE INDEX idx_usage_subject_time
  ON usage_records (subject_type, subject_id, timestamp);

CREATE TABLE usage_daily_aggregates (
  org_id        TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  subject_type  usage_subject_type NOT NULL,
  subject_id    TEXT,
  units         BIGINT NOT NULL,
  PRIMARY KEY (org_id, date, subject_type, subject_id)
);

CREATE TABLE usage_monthly_aggregates (
  org_id        TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  month         TEXT NOT NULL, -- 'YYYY-MM'
  subject_type  usage_subject_type NOT NULL,
  subject_id    TEXT,
  units         BIGINT NOT NULL,
  PRIMARY KEY (org_id, month, subject_type, subject_id)
);

-- ===== Support / Tickets =====

CREATE TABLE tickets (
  id                 TEXT PRIMARY KEY,
  org_id             TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  subject            TEXT NOT NULL,
  body               TEXT,
  status             ticket_status NOT NULL,
  declared_priority  ticket_priority NOT NULL,
  sla_deadline       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_at          TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  abuse_flag         BOOLEAN NOT NULL DEFAULT false,
  source             ticket_source NOT NULL,
  external_ref       TEXT
);

CREATE INDEX idx_tickets_open
  ON tickets (status, sla_deadline, created_at);

-- ===== Audit =====

CREATE TABLE usage_decision_logs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  subject_type  usage_subject_type NOT NULL,
  subject_id    TEXT,
  decision      usage_decision_type NOT NULL,
  delay_ms      INTEGER,
  reason        TEXT NOT NULL,
  units         BIGINT NOT NULL,
  endpoint      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_action_logs (
  id            TEXT PRIMARY KEY,
  ticket_id     TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  org_id        TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  agent_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  metadata_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_action_logs (
  id            TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id        TEXT,
  action        TEXT NOT NULL,
  metadata_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO orgs (id, name)
VALUES ('org_demo', 'Demo Org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, org_id, name, email, role)
VALUES ('user_demo', 'org_demo', 'Demo User', 'demo@example.com', 'OWNER')
ON CONFLICT (id) DO NOTHING;

INSERT INTO org_plans (org_id, plan_id)
VALUES ('org_demo', 'plan_free')
ON CONFLICT (org_id) DO NOTHING;
