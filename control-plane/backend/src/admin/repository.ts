// backend/src/admin/repository.ts
import { getDb } from "../shared/db";

export async function getUsageLeaderboard(limit: number) {
  const db = getDb();
  const res = await db.query<{
    org_id: string;
    org_name: string;
    plan_tier: string | null;
    mtd_units: number;
  }>(
    `
    SELECT
      o.id   AS org_id,
      o.name AS org_name,
      p.tier AS plan_tier,
      COALESCE(SUM(m.units), 0) AS mtd_units
    FROM orgs o
    LEFT JOIN usage_monthly_aggregates m
      ON m.org_id = o.id
      AND m.month = to_char(now(), 'YYYY-MM')
    LEFT JOIN org_plans op ON op.org_id = o.id
    LEFT JOIN plans p      ON p.id = op.plan_id
    GROUP BY o.id, o.name, p.tier
    ORDER BY mtd_units DESC
    LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}

export async function getTicketCounts() {
  const db = getDb();
  const resOpen = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM tickets
     WHERE status IN ('OPEN','IN_PROGRESS')`
  );
  const resBreached = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM tickets
     WHERE status IN ('OPEN','IN_PROGRESS')
       AND sla_deadline IS NOT NULL
       AND sla_deadline < now()`
  );
  return {
    openTickets: Number(resOpen.rows[0]?.count ?? "0"),
    breachedTickets: Number(resBreached.rows[0]?.count ?? "0"),
  };
}

export async function getDecisionCountsLast24h() {
  const db = getDb();
  const res = await db.query<{ decision: string; count: string }>(
    `SELECT decision, COUNT(*)::text AS count
     FROM usage_decision_logs
     WHERE created_at >= now() - interval '24 hours'
     GROUP BY decision`
  );
  let total = 0;
  let throttle = 0;
  let block = 0;
  for (const r of res.rows) {
    const c = Number(r.count);
    total += c;
    if (r.decision === "THROTTLE") throttle += c;
    if (r.decision === "BLOCK") block += c;
  }
  return { totalDecisions: total, throttleCount: throttle, blockCount: block };
}

export async function getActiveApiKeysSummary(limit: number) {
  const db = getDb();
  const res = await db.query<{
    org_id: string;
    org_name: string;
    key_count: number;
  }>(
    `
    SELECT
      o.id   AS org_id,
      o.name AS org_name,
      COUNT(k.id) AS key_count
    FROM orgs o
    LEFT JOIN api_keys k
      ON k.org_id = o.id
      AND k.revoked_at IS NULL
    GROUP BY o.id, o.name
    HAVING COUNT(k.id) > 0
    ORDER BY key_count DESC
    LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}
