// backend/src/identity/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { createNewOrg, fetchOrg, getOrgUsers } from "./service";
import { listOrgsWithPlan } from "./repository";
import { validateBody, validateParams } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";

/**
 * Identity routes
 *
 * Policy:
 * - GET /orgs          → public (read-only list with plan snapshot)
 * - GET /orgs/:id      → authenticated (any logged-in role can view)
 * - POST /orgs         → ADMIN+ only
 */
export async function identityRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // Public list (safe metadata). If you prefer, add requireAuth here too.
  app.get("/orgs", async () => {
    const orgs = await listOrgsWithPlan();
    return { orgs };
  });

  // View a single org + its users → requires auth
  app.get(
    "/orgs/:id",
    { preHandler: [requireAuth] },
    async (req) => {
      const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
      const org = await fetchOrg(id);
      const users = await getOrgUsers(id);
      return { org, users };
    }
  );

  // Create org → ADMIN+
  app.post(
    "/orgs",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req, reply) => {
      const { name } = validateBody(req, z.object({ name: z.string().min(1) }));
      const org = await createNewOrg(name);
      return reply.code(201).send({ org });
    }
  );
}
