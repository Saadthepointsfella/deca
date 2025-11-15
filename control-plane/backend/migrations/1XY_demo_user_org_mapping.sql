-- backend/migrations/1XY_demo_user_org_mapping.sql

INSERT INTO users (id, supabase_user_id, email, name)
VALUES ('user_demo_owner', '00000000-0000-0000-0000-000000000000', 'demo@controlplane.demo', 'Demo Owner')
ON CONFLICT (supabase_user_id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO org_users (org_id, user_id, role)
VALUES
  ('org_demo_free', 'user_demo_owner', 'OWNER'),
  ('org_demo_pro', 'user_demo_owner', 'OWNER'),
  ('org_demo_ent', 'user_demo_owner', 'OWNER')
ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
