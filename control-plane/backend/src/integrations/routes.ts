// backend/src/integrations/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function integrationsRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // TODO: add webhook endpoints for Intercom/Zendesk/Stripe
  app.post("/integrations/intercom/webhook", async () => {
    return { status: "not_implemented" };
  });
}
