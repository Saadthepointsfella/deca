// backend/src/support/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { createTicketWithSla, getNextTicket } from "./service";
import { listTickets, updateTicketStatus } from "./repository";
import { validateBody, validateParams, validateQuery } from "../shared/validate";
import type { TicketPriority, TicketStatus } from "./types";

export async function supportRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.post("/support/tickets", async (req, reply) => {
    const { orgId, subject, body, declaredPriority } = validateBody(req, z.object({
      orgId: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().optional(),
      declaredPriority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    }));
    const ticket = await createTicketWithSla({ orgId, subject, body, declaredPriority: declaredPriority as TicketPriority });
    return reply.code(201).send({ ticket });
  });

  app.get("/support/tickets", async (req) => {
    const { status, orgId, limit } = validateQuery(req, z.object({
      status: z.enum(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"]).optional(),
      orgId: z.string().optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    }));
    const tickets = await listTickets({ status: status as TicketStatus | undefined, orgId, limit });
    return { tickets };
  });

  app.patch("/support/tickets/:id", async (req) => {
    const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
    const { status } = validateBody(req, z.object({
      status: z.enum(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"]),
    }));
    await updateTicketStatus(id, status as TicketStatus);
    return { ok: true };
  });

  app.get("/support/next", async () => {
    const agentUserId: string | null = null;
    const result = await getNextTicket(agentUserId);
    if (!result) return { ticket: null, score: null };
    return result;
  });
}
