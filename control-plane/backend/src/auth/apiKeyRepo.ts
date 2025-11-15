import crypto from "crypto";
import { getDb } from "../shared/db";

export type ApiKeyScope = "usage:write" | "policy:read" | "admin:metrics";

export type ApiKeyRecord = {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function generateApiKeySecret(env: "demo" | "live" = "live"): {
  secret: string;
  prefix: string;
  hash: string;
} {
  const raw = crypto.randomBytes(32).toString("base64url");
  const prefix = env === "demo" ? "cp_demo" : "cp_live";
  const secret = `${prefix}_${raw}`;
  const hash = sha256Hex(secret);
  return { secret, prefix: secret.slice(0, 12), hash };
}

export async function createApiKey(params: {
  orgId: string;
  name: string;
  scopes: ApiKeyScope[];
  createdByUser?: string;
  env?: "demo" | "live";
}): Promise<{ record: ApiKeyRecord; secret: string }> {
  const db = getDb();
  const id = randomId("key");
  const { secret, prefix, hash } = generateApiKeySecret(params.env ?? "live");

  const res = await db.query<{
    id: string;
    org_id: string;
    name: string;
    prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }>(
    `
    INSERT INTO api_keys (id, org_id, name, prefix, hash, scopes, created_by_user)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, org_id, name, prefix, scopes, created_at, last_used_at, revoked_at
    `,
    [id, params.orgId, params.name, prefix, hash, params.scopes, params.createdByUser ?? null]
  );

  const row = res.rows[0];
  const record: ApiKeyRecord = {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes as ApiKeyScope[],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };

  return { record, secret };
}

export async function listApiKeysForOrg(orgId: string): Promise<ApiKeyRecord[]> {
  const db = getDb();
  const res = await db.query<{
    id: string;
    org_id: string;
    name: string;
    prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }>(
    `
    SELECT id, org_id, name, prefix, scopes, created_at, last_used_at, revoked_at
    FROM api_keys
    WHERE org_id = $1
    ORDER BY created_at DESC
    `,
    [orgId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    prefix: r.prefix,
    scopes: r.scopes as ApiKeyScope[],
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
  }));
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const db = getDb();
  await db.query(
    `
    UPDATE api_keys
    SET revoked_at = now()
    WHERE id = $1 AND revoked_at IS NULL
    `,
    [keyId]
  );
}

export async function markApiKeyUsed(keyId: string): Promise<void> {
  const db = getDb();
  await db.query(
    `
    UPDATE api_keys
    SET last_used_at = now()
    WHERE id = $1
    `,
    [keyId]
  );
}

export async function findApiKeyBySecret(secret: string): Promise<{
  keyId: string;
  orgId: string;
  scopes: ApiKeyScope[];
} | null> {
  const db = getDb();
  const hash = sha256Hex(secret);

  const res = await db.query<{
    id: string;
    org_id: string;
    scopes: string[];
    revoked_at: string | null;
  }>(
    `
    SELECT id, org_id, scopes, revoked_at
    FROM api_keys
    WHERE hash = $1
    LIMIT 1
    `,
    [hash]
  );

  const row = res.rows[0];
  if (!row || row.revoked_at) return null;

  return {
    keyId: row.id,
    orgId: row.org_id,
    scopes: row.scopes as ApiKeyScope[],
  };
}
