// backend/src/support/service.ts
import type { Ticket, TicketPriority } from "./types";
import { createTicket, getOpenTickets, markTicketPicked } from "./repository";
import { getPlanForOrgOrThrow } from "../plans/service";
import { computeSlaStatus } from "./sla";
import { computeTicketPriorityScore } from "../policy/supportPolicy";
import { logTicketPicked } from "../audit/service";

export async function createTicketWithSla(params: {
  orgId: string;
  subject: string;
  body?: string;
  declaredPriority: TicketPriority;
  source?: string;
  externalRef?: string | null;
}): Promise<Ticket> {
  const plan = await getPlanForOrgOrThrow(params.orgId);
  const slaMinutes = plan.support_sla_minutes;
  const slaDeadline = slaMinutes > 0 ? new Date(Date.now() + slaMinutes * 60 * 1000) : null;

  return createTicket({
    orgId: params.orgId,
    subject: params.subject,
    body: params.body ?? null,
    declaredPriority: params.declaredPriority,
    slaDeadline,
    source: params.source ?? "MANUAL",
    externalRef: params.externalRef ?? null,
  });
}

export async function getNextTicket(agentUserId: string | null) {
  const tickets = await getOpenTickets(100);
  if (tickets.length === 0) return null;

  const scored: Array<{
    ticket: Ticket;
    score: number;
  }> = [];

  for (const t of tickets) {
    const plan = await getPlanForOrgOrThrow(t.org_id);
    const waitMinutes = (Date.now() - t.created_at.getTime()) / 1000 / 60;
    const slaStatus = computeSlaStatus(t, plan);

    const score = computeTicketPriorityScore({
      plan,
      waitMinutes,
      slaStatus,
      declaredPriority: t.declared_priority,
      abuseFlag: t.abuse_flag,
    });

    scored.push({ ticket: t, score });
  }

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));

  await markTicketPicked(best.ticket.id, agentUserId);
  await logTicketPicked(best.ticket, agentUserId, best.score);

  return {
    ticket: best.ticket,
    score: best.score,
    explanation: {
      planTier: (await getPlanForOrgOrThrow(best.ticket.org_id)).tier,
      waitMinutes:
        (Date.now() - best.ticket.created_at.getTime()) / 1000 / 60,
      // recompute SLA quickly or reuse from above if refactored
    },
  };
}
