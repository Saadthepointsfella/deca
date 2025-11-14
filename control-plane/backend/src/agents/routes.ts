import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validateBody } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";
import { listAgentsForOrg, createAgent } from "./store";

export async function agentsRoutes(app: FastifyInstance) {
  // List agents for an org (ADMIN/OWNER)
  app.get(
    "/agents",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const orgId = (req.query as any)?.orgId as string | undefined;
      if (!orgId) {
        return app.httpErrors.badRequest("Missing orgId");
      }
      const agents = await listAgentsForOrg(orgId);
      return { agents };
    }
  );

  // Create agent
  app.post(
    "/agents",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const body = validateBody(
        req,
        z.object({
          orgId: z.string().min(1),
          name: z.string().min(1),
          description: z.string().optional(),
          modelKey: z.string().optional(),
        })
      );
      const agent = await createAgent({
        orgId: body.orgId,
        name: body.name,
        description: body.description,
        modelKey: body.modelKey,
      });
      return { agent };
    }
  );
}
