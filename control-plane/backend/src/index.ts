// backend/src/index.ts
import { authRoutes } from "./auth/routes";
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
  // Use a verbose logger in dev; quieter in prod
  const app = Fastify({
    logger: {
      level: config.nodeEnv === "production" ? "info" : "debug",
      transport:
        config.nodeEnv === "production"
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

  // CORS (dev: allow all; prod: restrict via env if you like)
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Perf histogram: record duration per route/method/status
  app.addHook("onResponse", async (req, reply) => {
    try {
      // Best-effort route id; fall back to URL if missing
      const route =
        // @ts-expect-error fastify typings vary for context
        reply.context?.config?.url || (req as any).routerPath || req.url || "unknown";
      const method = req.method;
      const status = String(reply.statusCode);
      // Fastify exposes response time when logger/timing is enabled
      const durationMs =
        typeof (reply as any).getResponseTime === "function"
          ? (reply as any).getResponseTime()
          : Number(reply.elapsedTime || 0);
      httpRequestDurationMs.labels({ route, method, status }).observe(durationMs);
    } catch {
      // never throw in hooks
    }
  });

  // Healthcheck
  app.get("/health", async () => ({ status: "ok" }));

  // Prometheus metrics
  app.get("/metrics", async (_req, reply) => {
    if (!config.metricsEnabled) return reply.code(404).send();
    reply.header("Content-Type", registry.contentType);
    return reply.send(await registry.metrics());
  });

  // Domain routes
  app.register(authRoutes, { prefix: "/api" });
  app.register(identityRoutes, { prefix: "/api" });
  app.register(plansRoutes, { prefix: "/api" });
  app.register(usageRoutes, { prefix: "/api" });
  app.register(supportRoutes, { prefix: "/api" });
  app.register(auditRoutes, { prefix: "/api" });

  // Centralized error handler (maps domain/validation → HTTP codes)
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
