// backend/src/config/index.ts
import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: toNumber("BACKEND_PORT", 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",

  // Feature flags
  metricsEnabled: process.env.METRICS_ENABLED !== "false",
  requestLogging: process.env.REQUEST_LOGGING !== "false",
  demoMode: process.env.DEMO_MODE === "true",

  // 🔐 Auth (Phase 2)
  jwtSecret: requireEnv("JWT_SECRET"),

  // 🚦 Rate limiting (Phase 2: API Keys + Service Access)
  // Requests/minute limits; used by in-memory token buckets (swap to Redis later).
  apiKeyRatePerMin: toNumber("APIKEY_RATE_PER_MIN", 600),
  ipRatePerMin: toNumber("IP_RATE_PER_MIN", 1200),
};
