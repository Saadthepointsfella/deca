import { getDb } from "../shared/db";
import type { PolicyConfig } from "./types";
import { DEFAULT_POLICY_CONFIG } from "./types";

// Load from DB and merge over defaults
export async function loadPolicyConfig(): Promise<PolicyConfig> {
  const db = getDb();
  const res = await db.query<{ value: any }>(`SELECT value FROM policy_config WHERE key='global' LIMIT 1`);
  const row = res.rows[0]?.value ?? {};
  return deepMerge(DEFAULT_POLICY_CONFIG, row);
}

export async function savePolicyConfig(value: PolicyConfig): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO policy_config(key, value) VALUES('global', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [value]
  );
}

// simple shallow+nested merge for our keys
function deepMerge<T extends object>(base: T, patch: any): T {
  const out: any = { ...base };
  for (const k of Object.keys(patch || {})) {
    const bv: any = (base as any)[k];
    const pv: any = patch[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && pv && typeof pv === "object" && !Array.isArray(pv)) {
      out[k] = { ...bv, ...pv };
    } else {
      out[k] = pv;
    }
  }
  return out as T;
}
