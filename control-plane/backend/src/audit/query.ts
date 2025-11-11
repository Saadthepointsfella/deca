// backend/src/audit/query.ts
import { getDb } from "../shared/db";

export async function listUsageLogs(orgId: string, limit = 50) {
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

export async function listTicketLogs(orgId: string, limit = 50) {
  const db = getDb();
  const res = await db.query(
    `SELECT ticket_id, action, metadata_json, created_at
     FROM ticket_action_logs
     WHERE org_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [orgId, limit]
  );
  return res.rows;
}
