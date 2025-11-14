import crypto from "crypto";
import { getDb } from "../shared/db";
import type { Agent } from "./types";

export async function listAgentsForOrg(orgId: string): Promise<Agent[]> {
  const db = getDb();
  const res = await db.query<Agent>(
    `SELECT id, org_id, name, description, model_key, created_at
     FROM agents
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [orgId]
  );
  return res.rows;
}

export async function createAgent(input: {
  orgId: string;
  name: string;
  description?: string | null;
  modelKey?: string | null;
}): Promise<Agent> {
  const db = getDb();
  const id = crypto.randomUUID();
  const res = await db.query<Agent>(
    `INSERT INTO agents (id, org_id, name, description, model_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, org_id, name, description, model_key, created_at`,
    [id, input.orgId, input.name, input.description ?? null, input.modelKey ?? null]
  );
  return res.rows[0];
}

export async function getAgentForOrg(
  orgId: string,
  agentId: string
): Promise<Agent | null> {
  const db = getDb();
  const res = await db.query<Agent>(
    `SELECT id, org_id, name, description, model_key, created_at
     FROM agents
     WHERE org_id = $1 AND id = $2
     LIMIT 1`,
    [orgId, agentId]
  );
  return res.rows[0] ?? null;
}
