// backend/src/usage/aggregates.ts
import { getDb } from "../shared/db";
import type { UsageSubjectType } from "./types";

export async function updateDailyAndMonthlyAggregates(params: {
  orgId: string;
  subjectType: UsageSubjectType;
  subjectId: string | null;
  units: number;
}): Promise<void> {
  const db = getDb();
  const { orgId, subjectType, subjectId, units } = params;

  await db.query(
    `INSERT INTO usage_daily_aggregates (org_id, date, subject_type, subject_id, units)
     VALUES ($1, now()::date, $2, $3, $4)
     ON CONFLICT (org_id, date, subject_type, subject_id)
     DO UPDATE SET units = usage_daily_aggregates.units + EXCLUDED.units`,
    [orgId, subjectType, subjectId, units]
  );

  await db.query(
    `INSERT INTO usage_monthly_aggregates (org_id, month, subject_type, subject_id, units)
     VALUES ($1, to_char(now(), 'YYYY-MM'), $2, $3, $4)
     ON CONFLICT (org_id, month, subject_type, subject_id)
     DO UPDATE SET units = usage_monthly_aggregates.units + EXCLUDED.units`,
    [orgId, subjectType, subjectId, units]
  );
}
