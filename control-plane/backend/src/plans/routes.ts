// backend/src/plans/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { getAllPlans, changeOrgPlan } from "./service";
import { validateBody, validateParams } from "../shared/validate";

export async function plansRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/plans", async () => ({ plans: await getAllPlans() }));

  app.patch("/orgs/:id/plan", async (req) => {
    const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
    const { planId } = validateBody(req, z.object({ planId: z.string().min(1) }));
    const orgPlan = await changeOrgPlan(id, planId);
    return { orgPlan };
  });
}
