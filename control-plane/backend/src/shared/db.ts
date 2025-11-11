// backend/src/shared/db.ts
import { Pool } from "pg";
import { config } from "../config";
import { logger } from "./logger";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
    });

    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected PG client error");
    });
  }
  return pool;
}

export async function assertDbConnection(): Promise<void> {
  const client = await getDb().connect();
  try {
    await client.query("SELECT 1");
    logger.info("Database connection OK");
  } finally {
    client.release();
  }
}
