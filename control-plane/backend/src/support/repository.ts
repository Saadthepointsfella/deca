// backend/src/support/repository.ts
import { getDb } from "../shared/db";
import type { Ticket, TicketStatus } from "./types";

export async function createTicket(params: {
  orgId: string;
  subject: string;
  body: string | null;
  declaredPriority: string;
  slaDeadline: Date | null;
  source: string;
  externalRef: string | null;
}): Promise<Ticket> {
  const db = getDb();
  const res = await db.query(
    `INSERT INTO tickets
      (id, org_id, subject, body, status, declared_priority,
       sla_deadline, created_at, abuse_flag, source, external_ref)
     VALUES (gen_random_uuid(), $1, $2, $3, 'OPEN', $4, $5, now(), false, $6, $7)
     RETURNING *`,
    [
      params.orgId,
      params.subject,
      params.body,
      params.declaredPriority,
      params.slaDeadline,
      params.source,
      params.externalRef,
    ]
  );
  return res.rows[0];
}

export async function getOpenTickets(limit = 100): Promise<Ticket[]> {
  const db = getDb();
  const res = await db.query(
    `SELECT * FROM tickets
     WHERE status = 'OPEN'
     ORDER BY sla_deadline NULLS LAST, created_at ASC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

/**
 * New: list tickets with optional filters (status, orgId) and a bounded limit.
 */
export async function listTickets(opts: {
  status?: TicketStatus;
  orgId?: string;
  limit?: number;
}): Promise<Ticket[]> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (opts.status) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  if (opts.orgId) {
    params.push(opts.orgId);
    clauses.push(`org_id = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);

  const res = await db.query(
    `SELECT *
     FROM tickets
     ${where}
     ORDER BY sla_deadline NULLS LAST, created_at ASC
     LIMIT $${params.length}`,
    params
  );

  return res.rows;
}

/**
 * New: update ticket status; when resolving, stamp resolved_at.
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<void> {
  const db = getDb();
  await db.query(
    `UPDATE tickets
     SET status = $2,
         resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE resolved_at END
     WHERE id = $1`,
    [ticketId, status]
  );
}

export async function markTicketPicked(
  ticketId: string,
  agentUserId: string | null
): Promise<void> {
  const db = getDb();
  await db.query(
    `UPDATE tickets
     SET status = 'IN_PROGRESS', picked_at = now()
     WHERE id = $1 AND status = 'OPEN'`,
    [ticketId]
  );
}
