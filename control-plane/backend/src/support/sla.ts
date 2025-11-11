// backend/src/support/sla.ts
import type { TicketSlaStatus } from "./types";
import type { Ticket } from "./types";
import type { Plan } from "../plans/types";

export function computeSlaStatus(ticket: Ticket, plan: Plan): TicketSlaStatus {
  if (!ticket.sla_deadline) return "ON_TRACK";

  const now = new Date();
  if (ticket.resolved_at && ticket.resolved_at <= ticket.sla_deadline) {
    return "ON_TRACK";
  }

  if (now > ticket.sla_deadline) {
    return "BREACHED";
  }

  const totalMs = ticket.sla_deadline.getTime() - ticket.created_at.getTime();
  const elapsedMs = now.getTime() - ticket.created_at.getTime();
  const ratio = elapsedMs / totalMs;

  return ratio > 0.7 ? "AT_RISK" : "ON_TRACK";
}
