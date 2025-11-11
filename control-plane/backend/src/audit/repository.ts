// backend/src/audit/repository.ts
import { getDb } from "../shared/db";
import type { UsageDecisionType } from "./types";
import type { UsageSubjectType } from "../usage/types";

export async function insertUsageDecisionLog(params: {
  orgId: string;
  subjectType: UsageSubjectType;
  subjectId: string | null;
  decision: UsageDecisionType;
  delayMs: number | null;
  reason: string;
  units: number;
  endpoint: string;
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO usage_decision_logs
       (id, org_id, subject_type, subject_id, decision, delay_ms, reason, units, endpoint, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      params.orgId,
      params.subjectType,
      params.subjectId,
      params.decision,
      params.delayMs,
      params.reason,
      params.units,
      params.endpoint,
    ]
  );
}

export async function insertTicketActionLog(params: {
  ticketId: string;
  orgId: string;
  agentUserId: string | null;
  action: string;
  metadata: unknown;
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO ticket_action_logs
       (id, ticket_id, org_id, agent_user_id, action, metadata_json, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
    [params.ticketId, params.orgId, params.agentUserId, params.action, params.metadata]
  );
}
