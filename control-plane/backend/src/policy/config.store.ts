// backend/src/policy/config.store.ts

import { getDb } from "../shared/db";
import type { PolicyConfigV2 } from "./types";
import { DEFAULT_POLICY_CONFIG_V2 } from "./types";

export async function loadPolicyConfig(): Promise<PolicyConfigV2> {
  const db = getDb();
  const res = await db.query<{ value: any }>(
    `SELECT value FROM policy_config WHERE key = 'global' LIMIT 1`
  );
  const row = res.rows[0]?.value ?? {};
  return deepMerge(DEFAULT_POLICY_CONFIG_V2, row);
}

export async function savePolicyConfig(value: PolicyConfigV2): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO policy_config(key, value)
     VALUES('global', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [value]
  );
}

// simple nested merge: config from DB overrides defaults, but keeps shape
function deepMerge<T extends object>(base: T, patch: any): T {
  if (!patch || typeof patch !== "object") return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const [k, pv] of Object.entries(patch)) {
    const bv = (base as any)[k];
    if (
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv) &&
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv)
    ) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out as T;
}
