// backend/src/index.ts
import { adminRoutes } from "./admin/routes";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { policyRoutes } from "./policy/routes";
import { agentsRoutes } from "./agents/routes";
import { config } from "./config";
import { logger } from "./shared/logger";
import { assertDbConnection } from "./shared/db";
import { errorHandler } from "./shared/errorMapper";
import { registry, httpRequestDurationMs } from "./shared/metrics";

import { authRoutes } from "./auth/routes";
import { identityRoutes } from "./identity/routes";
import { plansRoutes } from "./plans/routes";
import { usageRoutes } from "./usage/routes";
import { supportRoutes } from "./support/routes";
import { auditRoutes } from "./audit/routes";

import { apiKeysRoutes } from "./apikeys/routes";
import { tryAttachApiKey } from "./auth/apiKeyGuard";
import { allow } from "./shared/rateLimit";
import { openapiSpec } from "./openapi/spec";
import { seedDemoData } from "./demo/seedDemo";
import { demoRoutes } from "./demo/routes";

async function buildServer() {
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

  // Attach API key context + basic per-IP rate limiting
  app.addHook("onRequest", async (req, reply) => {
    // Try to attach apiKey from Authorization: Bearer <secret>
    await tryAttachApiKey(req);

    // Simple in-memory IP rate limit (dev-friendly)
    const ip = req.ip || "0.0.0.0";
    if (!allow(`ip:${ip}`, config.ipRatePerMin)) {
      return reply
        .code(429)
        .send({ error: { code: "RATE_LIMIT", message: "IP rate limit exceeded" } });
    }
  });

  // Perf histogram: record duration per route/method/status
  app.addHook("onResponse", async (req, reply) => {
    try {
      const route =
        // @ts-expect-error fastify typings vary for context
        reply.context?.config?.url || (req as any).routerPath || req.url || "unknown";
      const method = req.method;
      const status = String(reply.statusCode);
      const durationMs =
        typeof (reply as any).getResponseTime === "function"
          ? (reply as any).getResponseTime()
          : Number((reply as any).elapsedTime || 0);
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

  // OpenAPI spec
  app.get("/api/openapi.json", async () => {
    return openapiSpec;
  });

  // Domain routes
  app.register(policyRoutes,  { prefix: "/api" });

  app.register(authRoutes, { prefix: "/api" });
  app.register(identityRoutes, { prefix: "/api" });
  app.register(plansRoutes, { prefix: "/api" });
    app.register(adminRoutes,  { prefix: "/api" });   // <— add this

  app.register(usageRoutes, { prefix: "/api" });
  app.register(supportRoutes, { prefix: "/api" });
  app.register(auditRoutes, { prefix: "/api" });
  app.register(apiKeysRoutes, { prefix: "/api" });
  app.register(agentsRoutes, { prefix: "/api" });
  app.register(demoRoutes, { prefix: "/api" });

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
