import { getDb } from "../shared/db";
import type { ApiKey } from "./types";

export async function listKeys(orgId: string): Promise<ApiKey[]> {
  const db = getDb();
  const res = await db.query<ApiKey>(
    `SELECT * FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`, [orgId]
  );
  return res.rows;
}

export async function insertKey(k: {
  id: string; orgId: string; name: string; secretPrefix: string; secretHash: string;
}): Promise<ApiKey> {
  const db = getDb();
  const res = await db.query<ApiKey>(`
    INSERT INTO api_keys (id, org_id, name, secret_prefix, secret_hash)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *`,
    [k.id, k.orgId, k.name, k.secretPrefix, k.secretHash]
  );
  return res.rows[0];
}

export async function revokeKey(id: string, orgId: string): Promise<void> {
  const db = getDb();
  await db.query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

export async function getKeyByHash(secretHash: string) {
  const db = getDb();
  const res = await db.query<ApiKey>(
    `SELECT * FROM api_keys WHERE secret_hash = $1 AND revoked_at IS NULL LIMIT 1`, [secretHash]
  );
  return res.rows[0] || null;
}
