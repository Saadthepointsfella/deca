// backend/src/plans/repository.ts
import { getDb } from "../shared/db";
import type { Plan, OrgPlan } from "./types";

export async function listPlans(): Promise<Plan[]> {
  const db = getDb();
  const res = await db.query("SELECT * FROM plans ORDER BY tier");
  return res.rows;
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  const db = getDb();
  const res = await db.query("SELECT * FROM plans WHERE id = $1", [planId]);
  return res.rows[0] ?? null;
}

export async function getPlanForOrg(orgId: string): Promise<Plan | null> {
  const db = getDb();
  const res = await db.query(
    `SELECT p.*
     FROM org_plans op
     JOIN plans p ON p.id = op.plan_id
     WHERE op.org_id = $1`,
    [orgId]
  );
  return res.rows[0] ?? null;
}

export async function assignPlanToOrg(orgId: string, planId: string): Promise<OrgPlan> {
  const db = getDb();
  const res = await db.query(
    `INSERT INTO org_plans (org_id, plan_id, overrides_json)
     VALUES ($1, $2, NULL)
     ON CONFLICT (org_id)
     DO UPDATE SET plan_id = EXCLUDED.plan_id
     RETURNING org_id, plan_id, overrides_json`,
    [orgId, planId]
  );
  return res.rows[0];
}
