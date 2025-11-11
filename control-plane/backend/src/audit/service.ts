// backend/src/audit/service.ts
import type { UsageDecision } from "../policy/usagePolicy";
import type { UsageSubjectType } from "../usage/types";
import type { Ticket } from "../support/types";
import { insertUsageDecisionLog, insertTicketActionLog } from "./repository";

export async function logUsageDecision(params: {
  orgId: string;
  subjectType: UsageSubjectType;
  subjectId: string | null;
  decision: UsageDecision;
  units: number;
  endpoint: string;
}): Promise<void> {
  await insertUsageDecisionLog({
    orgId: params.orgId,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    decision: params.decision.type,
    delayMs: params.decision.type === "THROTTLE" ? params.decision.delayMs : null,
    reason: params.decision.reason,
    units: params.units,
    endpoint: params.endpoint,
  });
}

export async function logTicketPicked(
  ticket: Ticket,
  agentUserId: string | null,
  score: number
): Promise<void> {
  await insertTicketActionLog({
    ticketId: ticket.id,
    orgId: ticket.org_id,
    agentUserId,
    action: "PICKED",
    metadata: { score },
  });
}
