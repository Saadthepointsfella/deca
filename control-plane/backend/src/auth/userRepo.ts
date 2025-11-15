// backend/src/auth/userRepo.ts
import crypto from "crypto";
import { getDb } from "../shared/db";

export type AppRole = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

export type AppUser = {
  id: string;
  supabaseUserId: string;
  email: string;
  name: string | null;
};

export type OrgMembership = {
  orgId: string;
  role: AppRole;
};

function newUserId() {
  return `user_${crypto.randomUUID()}`;
}

export async function upsertUserFromSupabaseProfile(params: {
  supabaseUserId: string;
  email: string;
  name?: string | null;
}): Promise<AppUser> {
  const db = getDb();

  const res = await db.query<{
    id: string;
    supabase_user_id: string;
    email: string;
    name: string | null;
  }>(
    `
    INSERT INTO users (id, supabase_user_id, email, name)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (supabase_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, users.name)
    RETURNING id, supabase_user_id, email, name
    `,
    [newUserId(), params.supabaseUserId, params.email, params.name ?? null]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    supabaseUserId: row.supabase_user_id,
    email: row.email,
    name: row.name,
  };
}

export async function getOrgMemberships(userId: string): Promise<OrgMembership[]> {
  const db = getDb();
  const res = await db.query<{ org_id: string; role: AppRole }>(
    `
    SELECT org_id, role
    FROM org_users
    WHERE user_id = $1
    `,
    [userId]
  );
  return res.rows.map((r) => ({ orgId: r.org_id, role: r.role }));
}
