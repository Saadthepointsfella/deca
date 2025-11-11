// backend/src/usage/repository.ts
import { getDb } from "../shared/db";
import type { UsageRecord, UsageSummary, UsageSubjectType } from "./types";

export async function insertUsageRecord(params: {
  orgId: string; subjectType: UsageSubjectType; subjectId: string | null; units: number; endpoint: string;
}): Promise<UsageRecord> {
  const db = getDb();
  const res = await db.query(
    `INSERT INTO usage_records (id, org_id, subject_type, subject_id, timestamp, units, endpoint)
     VALUES (gen_random_uuid(), $1, $2, $3, now(), $4, $5)
     RETURNING id, org_id, subject_type, subject_id, timestamp, units, endpoint`,
    [params.orgId, params.subjectType, params.subjectId, params.units, params.endpoint]
  );
  return res.rows[0];
}

export async function getUsageSummaryForOrg(orgId: string): Promise<UsageSummary> {
  const db = getDb();
  const todayRes = await db.query(
    `SELECT COALESCE(SUM(units), 0) AS daily
     FROM usage_records
     WHERE org_id = $1 AND timestamp::date = now()::date`,
    [orgId]
  );
  const monthRes = await db.query(
    `SELECT COALESCE(SUM(units), 0) AS monthly
     FROM usage_records
     WHERE org_id = $1 AND to_char(timestamp, 'YYYY-MM') = to_char(now(), 'YYYY-MM')`,
    [orgId]
  );
  const daily = Number(todayRes.rows[0]?.daily ?? 0);
  const monthly = Number(monthRes.rows[0]?.monthly ?? 0);
  return { daily, monthly, spikeScore: 0 };
}

export async function getHourlyUsage(orgId: string, since: Date) {
  const db = getDb();
  const res = await db.query(
    `SELECT to_char(date_trunc('hour', timestamp), 'YYYY-MM-DD HH24') as bucket,
            SUM(units) as units
     FROM usage_records
     WHERE org_id = $1 AND timestamp >= $2
     GROUP BY 1
     ORDER BY 1 ASC`,
    [orgId, since]
  );
  return res.rows as Array<{ bucket: string; units: number }>;
}
