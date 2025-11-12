// backend/src/plans/routes.ts
import { requireAuth, requireRole } from "../auth/guards";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { getAllPlans, changeOrgPlan } from "./service";
import { validateBody, validateParams } from "../shared/validate";

export async function plansRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // Public read is fine for now
  app.get("/plans", async () => ({ plans: await getAllPlans() }));

  // Changing an org's plan requires ADMIN (or OWNER via ADMIN threshold)
  app.patch(
    "/orgs/:id/plan",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
      const { planId } = validateBody(req, z.object({ planId: z.string().min(1) }));
      const orgPlan = await changeOrgPlan(id, planId);
      return { orgPlan };
    }
  );
}
