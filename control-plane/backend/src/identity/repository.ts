// backend/src/identity/repository.ts
import { getDb } from "../shared/db";
import type { Org, User } from "./types";

export async function listOrgs(): Promise<Org[]> {
  const db = getDb();
  const res = await db.query("SELECT id, name, created_at FROM orgs ORDER BY created_at DESC");
  return res.rows;
}

export async function listOrgsWithPlan(): Promise<
  Array<Org & { plan_id: string | null; plan_tier: string | null }>
> {
  const db = getDb();
  const res = await db.query(
    `SELECT o.id, o.name, o.created_at, op.plan_id, p.tier as plan_tier
     FROM orgs o
     LEFT JOIN org_plans op ON op.org_id = o.id
     LEFT JOIN plans p ON p.id = op.plan_id
     ORDER BY o.created_at DESC`
  );
  return res.rows;
}

export async function getOrgById(id: string): Promise<Org | null> {
  const db = getDb();
  const res = await db.query("SELECT id, name, created_at FROM orgs WHERE id = $1", [id]);
  return res.rows[0] ?? null;
}

export async function createOrg(name: string): Promise<Org> {
  const db = getDb();
  const res = await db.query(
    "INSERT INTO orgs (id, name, created_at) VALUES (gen_random_uuid(), $1, now()) RETURNING id, name, created_at",
    [name]
  );
  return res.rows[0];
}

export async function listUsersByOrg(orgId: string): Promise<User[]> {
  const db = getDb();
  const res = await db.query(
    "SELECT id, org_id, name, email, role, created_at FROM users WHERE org_id = $1 ORDER BY created_at ASC",
    [orgId]
  );
  return res.rows;
}
