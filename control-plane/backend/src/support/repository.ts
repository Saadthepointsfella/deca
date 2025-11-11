// backend/src/support/repository.ts
import { getDb } from "../shared/db";
import type { Ticket } from "./types";

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

export async function markTicketPicked(ticketId: string, agentUserId: string | null): Promise<void> {
  const db = getDb();
  await db.query(
    `UPDATE tickets
     SET status = 'IN_PROGRESS', picked_at = now()
     WHERE id = $1 AND status = 'OPEN'`,
    [ticketId]
  );
}
