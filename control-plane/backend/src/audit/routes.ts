// backend/src/audit/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { validateQuery } from "../shared/validate";
import { listUsageLogs, listTicketLogs } from "./query";

export async function auditRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/audit/usage", async (req) => {
    const { orgId, limit } = validateQuery(req, z.object({
      orgId: z.string().min(1),
      limit: z.coerce.number().int().positive().max(200).optional(),
    }));
    return { logs: await listUsageLogs(orgId, limit) };
  });

  app.get("/audit/tickets", async (req) => {
    const { orgId, limit } = validateQuery(req, z.object({
      orgId: z.string().min(1),
      limit: z.coerce.number().int().positive().max(200).optional(),
    }));
    return { logs: await listTicketLogs(orgId, limit) };
  });
}
