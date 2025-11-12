import crypto from "crypto";
import { insertKey, getKeyByHash } from "./repository";
import type { ApiKey } from "./types";

function ulid() {
  // simple ulid-ish: good enough for ids
  return crypto.randomUUID();
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function generateSecret(): { id: string; secret: string; prefix: string; hash: string } {
  // Format: cp_live_<random32>
  const raw = crypto.randomBytes(24).toString("base64url"); // 32-ish url-safe chars
  const secret = `cp_${raw}`;
  const prefix = secret.slice(0, 8);
  const hash = hashSecret(secret);
  return { id: ulid(), secret, prefix, hash };
}

export async function createApiKey(orgId: string, name: string): Promise<{ record: ApiKey; secret: string }> {
  const g = generateSecret();
  const record = await insertKey({ id: g.id, orgId, name, secretPrefix: g.prefix, secretHash: g.hash });
  return { record, secret: g.secret };
}

export async function authenticateApiKey(presentedSecret: string): Promise<ApiKey | null> {
  const hash = hashSecret(presentedSecret);
  return await getKeyByHash(hash);
}
