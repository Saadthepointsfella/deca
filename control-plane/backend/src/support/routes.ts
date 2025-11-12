// backend/src/support/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { createTicketWithSla, getNextTicket } from "./service";
import { listTickets, updateTicketStatus } from "./repository";
import { validateBody, validateParams, validateQuery } from "../shared/validate";
import type { TicketPriority, TicketStatus } from "./types";
import { requireAuth, requireRole } from "../auth/guards";
import { roleAtLeast, type Role } from "../shared/roles";

export async function supportRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // Any authenticated user can open a ticket.
  // Non-ADMIN users may only open tickets for their own org.
  app.post(
    "/support/tickets",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { orgId, subject, body, declaredPriority } = validateBody(
        req,
        z.object({
          orgId: z.string().min(1),
          subject: z.string().min(1),
          body: z.string().optional(),
          declaredPriority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        })
      );

      const user = req.user!;
      const isAdmin = roleAtLeast(user.role as Role, "ADMIN");
      if (!isAdmin && user.org_id !== orgId) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Cannot create tickets for another org" },
        });
      }

      const ticket = await createTicketWithSla({
        orgId,
        subject,
        body,
        declaredPriority: declaredPriority as TicketPriority,
      });
      return reply.code(201).send({ ticket });
    }
  );

  // List tickets requires AGENT+.
  // Non-ADMIN users are scoped to their own org.
  app.get(
    "/support/tickets",
    { preHandler: [requireAuth, requireRole("AGENT")] },
    async (req, reply) => {
      const { status, orgId, limit } = validateQuery(
        req,
        z.object({
          status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
          orgId: z.string().optional(),
          limit: z.coerce.number().int().positive().max(500).optional(),
        })
      );

      const user = req.user!;
      const isAdmin = roleAtLeast(user.role as Role, "ADMIN");

      // Enforce org scoping for non-admins
      if (!isAdmin) {
        if (orgId && orgId !== user.org_id) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot view tickets for another org" },
          });
        }
      }

      const effectiveOrgId = isAdmin ? orgId : user.org_id;
      const tickets = await listTickets({
        status: status as TicketStatus | undefined,
        orgId: effectiveOrgId,
        limit,
      });
      return { tickets };
    }
  );

  // Update ticket status requires AGENT+.
  // (For stricter org-scoping you can look up the ticket's org here and enforce match.)
  app.patch(
    "/support/tickets/:id",
    { preHandler: [requireAuth, requireRole("AGENT")] },
    async (req) => {
      const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
      const { status } = validateBody(
        req,
        z.object({
          status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
        })
      );
      await updateTicketStatus(id, status as TicketStatus);
      return { ok: true };
    }
  );

  // "Next ticket" triage requires AGENT+.
  // We pass the current agent's userId down to service.
  app.get(
    "/support/next",
    { preHandler: [requireAuth, requireRole("AGENT")] },
    async (req) => {
      const agentUserId: string | null = req.user?.id ?? null;
      const result = await getNextTicket(agentUserId);
      if (!result) return { ticket: null, score: null };
      return result;
    }
  );
}
