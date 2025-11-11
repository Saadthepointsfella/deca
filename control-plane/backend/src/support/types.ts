// backend/src/support/types.ts
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketSlaStatus = "ON_TRACK" | "AT_RISK" | "BREACHED";

export type TicketSource = "EMAIL" | "INTERCOM" | "ZENDESK" | "MANUAL";

export type Ticket = {
  id: string;
  org_id: string;
  subject: string;
  body: string | null;
  status: TicketStatus;

  declared_priority: TicketPriority;
  sla_deadline: Date | null;

  created_at: Date;
  picked_at: Date | null;
  resolved_at: Date | null;

  abuse_flag: boolean;
  source: TicketSource;
  external_ref: string | null;
};
