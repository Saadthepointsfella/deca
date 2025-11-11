// backend/src/config/index.ts
import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.BACKEND_PORT ?? 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  metricsEnabled: process.env.METRICS_ENABLED !== "false",
  requestLogging: process.env.REQUEST_LOGGING !== "false",
};
