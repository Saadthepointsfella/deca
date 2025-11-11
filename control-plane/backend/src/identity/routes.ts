// backend/src/identity/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { listAllOrgs, createNewOrg, fetchOrg, getOrgUsers } from "./service";
import { listOrgsWithPlan } from "./repository";
import { validateBody, validateParams } from "../shared/validate";

export async function identityRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/orgs", async () => {
    const orgs = await listOrgsWithPlan();
    return { orgs };
  });

  app.get("/orgs/:id", async (req) => {
    const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
    const org = await fetchOrg(id);
    const users = await getOrgUsers(id);
    return { org, users };
  });

  app.post("/orgs", async (req, reply) => {
    const { name } = validateBody(req, z.object({ name: z.string().min(1) }));
    const org = await createNewOrg(name);
    return reply.code(201).send({ org });
  });
}
