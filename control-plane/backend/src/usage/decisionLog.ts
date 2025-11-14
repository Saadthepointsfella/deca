import crypto from "crypto";
import { getDb } from "../shared/db";
import type { UsageDecision } from "../policy/usagePolicy";
import type { Plan } from "../plans/types";

function randomId() {
  return crypto.randomUUID();
}

export async function logUsageDecisionRow(params: {
  orgId: string;
  plan: Plan;
  decision: UsageDecision;
}) {
  const db = getDb();
  await db.query(
    `
    INSERT INTO usage_decisions (id, org_id, decision, tier)
    VALUES ($1, $2, $3, $4)
    `,
    [
      randomId(),
      params.orgId,
      params.decision.type, // 'ALLOW'|'THROTTLE'|'BLOCK'
      params.plan.tier,
    ]
  );
}
