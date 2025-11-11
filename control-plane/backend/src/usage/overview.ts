// backend/src/usage/overview.ts
import { getDb } from "../shared/db";

export async function getDailySeries(orgId: string, days = 14) {
  const db = getDb();
  const res = await db.query(
    `SELECT date, units
     FROM usage_daily_aggregates
     WHERE org_id = $1
       AND date >= (now()::date - ($2::int - 1))
     ORDER BY date ASC`,
    [orgId, days]
  );
  return res.rows; // [{date, units}]
}

export async function getMonthToDate(orgId: string) {
  const db = getDb();
  const res = await db.query(
    `SELECT COALESCE(SUM(units),0) as mtd
     FROM usage_monthly_aggregates
     WHERE org_id = $1 AND month = to_char(now(), 'YYYY-MM')`,
    [orgId]
  );
  return Number(res.rows[0]?.mtd ?? 0);
}

export async function getRecentDecisions(orgId: string, limit = 25) {
  const db = getDb();
  const res = await db.query(
    `SELECT decision, delay_ms, reason, units, endpoint, created_at
     FROM usage_decision_logs
     WHERE org_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [orgId, limit]
  );
  return res.rows;
}
