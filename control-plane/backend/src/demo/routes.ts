// backend/src/demo/routes.ts
import type { FastifyPluginAsync } from "fastify";
import { config } from "../config";
import { seedDemoData, clearDemoData, checkDemoDataExists } from "./seedDemo";
import { requireAuth, requireRole } from "../auth/guards";

export const demoRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/demo/status - Check if demo data exists
  app.get(
    "/demo/status",
    {
      preHandler: [requireAuth, requireRole("ADMIN")],
    },
    async (_req, reply) => {
      if (!config.demoMode) {
        return reply.code(403).send({
          error: {
            code: "DEMO_MODE_DISABLED",
            message: "Demo mode is not enabled",
          },
        });
      }

      try {
        const exists = await checkDemoDataExists();
        return { enabled: exists };
      } catch (err) {
        app.log.error({ err }, "[demo] failed to check demo status");
        return reply.code(500).send({
          error: {
            code: "STATUS_CHECK_FAILED",
            message: "Failed to check demo status",
          },
        });
      }
    }
  );

  // POST /api/demo/enable - Seed demo data
  app.post(
    "/demo/enable",
    {
      preHandler: [requireAuth, requireRole("ADMIN")],
    },
    async (_req, reply) => {
      if (!config.demoMode) {
        return reply.code(403).send({
          error: {
            code: "DEMO_MODE_DISABLED",
            message: "Demo mode is not enabled",
          },
        });
      }

      try {
        await seedDemoData();
        return { success: true, message: "Demo data enabled successfully" };
      } catch (err) {
        app.log.error({ err }, "[demo] failed to enable demo data");
        return reply.code(500).send({
          error: {
            code: "ENABLE_FAILED",
            message: "Failed to enable demo data",
          },
        });
      }
    }
  );

  // POST /api/demo/disable - Clear demo data
  app.post(
    "/demo/disable",
    {
      preHandler: [requireAuth, requireRole("ADMIN")],
    },
    async (_req, reply) => {
      if (!config.demoMode) {
        return reply.code(403).send({
          error: {
            code: "DEMO_MODE_DISABLED",
            message: "Demo mode is not enabled",
          },
        });
      }

      try {
        await clearDemoData();
        return { success: true, message: "Demo data disabled successfully" };
      } catch (err) {
        app.log.error({ err }, "[demo] failed to disable demo data");
        return reply.code(500).send({
          error: {
            code: "DISABLE_FAILED",
            message: "Failed to disable demo data",
          },
        });
      }
    }
  );
};
