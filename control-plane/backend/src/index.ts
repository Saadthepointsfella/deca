// backend/src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { logger } from "./shared/logger";
import { assertDbConnection } from "./shared/db";
import { errorHandler } from "./shared/errorMapper";
import { registry, httpRequestDurationMs } from "./shared/metrics";

import { identityRoutes } from "./identity/routes";
import { plansRoutes } from "./plans/routes";
import { usageRoutes } from "./usage/routes";
import { supportRoutes } from "./support/routes";
import { auditRoutes } from "./audit/routes";

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === "production" ? "info" : "debug",
      transport: config.nodeEnv === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
            },
          },
    },
  });

  // Performance tracking hook
  app.addHook("onResponse", async (req, reply) => {
    try {
      const route = reply.context.config.url || req.routerPath || req.url || "unknown";
      const method = req.method;
      const status = reply.statusCode.toString();
      httpRequestDurationMs.labels({ route, method, status }).observe(reply.getResponseTime());
    } catch {}
  });

  // Enable CORS
  await app.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Metrics endpoint
  app.get("/metrics", async (_req, reply) => {
    if (!config.metricsEnabled) return reply.code(404).send();
    reply.header("Content-Type", registry.contentType);
    return reply.send(await registry.metrics());
  });

  // Healthcheck
  app.get("/health", async () => {
    return { status: "ok" };
  });

  // Domain routes
  app.register(identityRoutes, { prefix: "/api" });
  app.register(plansRoutes, { prefix: "/api" });
  app.register(usageRoutes, { prefix: "/api" });
  app.register(supportRoutes, { prefix: "/api" });
  app.register(auditRoutes, { prefix: "/api" });

  // Centralized error handler
  app.setErrorHandler(errorHandler);

  return app;
}

async function main() {
  try {
    await assertDbConnection();

    const app = await buildServer();
    await app.listen({ port: config.port, host: "0.0.0.0" });

    logger.info({ port: config.port }, "Backend listening");
  } catch (err) {
    logger.error({ err }, "Failed to start backend");
    process.exit(1);
  }
}

void main();
