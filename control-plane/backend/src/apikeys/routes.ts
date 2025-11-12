import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { validateBody, validateQuery } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";
import { listKeys, revokeKey } from "./repository";
import { createApiKey } from "./service";

export async function apiKeysRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // ADMIN+: list keys by org
  app.get("/api-keys", { preHandler: [requireAuth, requireRole("ADMIN")] }, async (req) => {
    const { orgId } = validateQuery(req, z.object({ orgId: z.string().min(1) }));
    const keys = await listKeys(orgId);
    return { keys };
  });

  // ADMIN+: create key -> returns secret once
  app.post("/api-keys", { preHandler: [requireAuth, requireRole("ADMIN")] }, async (req, reply) => {
    const { orgId, name } = validateBody(req, z.object({
      orgId: z.string().min(1),
      name: z.string().min(1)
    }));
    const { record, secret } = await createApiKey(orgId, name);
    return reply.code(201).send({
      key: { ...record, secret }, // show once
      note: "Store this secret now; it will not be shown again."
    });
  });

  // ADMIN+: revoke by id
  app.post("/api-keys/revoke", { preHandler: [requireAuth, requireRole("ADMIN")] }, async (req) => {
    const { orgId, id } = validateBody(req, z.object({
      orgId: z.string().min(1),
      id: z.string().min(1),
    }));
    await revokeKey(id, orgId);
    return { ok: true };
  });
}
