// backend/src/plans/service.ts
import { BadRequestError } from "../shared/errors";
import * as repo from "./repository";
import type { Plan } from "./types";

export async function getAllPlans(): Promise<Plan[]> {
  return repo.listPlans();
}

export async function getPlanForOrgOrThrow(orgId: string): Promise<Plan> {
  const plan = await repo.getPlanForOrg(orgId);
  if (!plan) throw new BadRequestError("Plan not assigned for org");
  return plan;
}

export async function changeOrgPlan(orgId: string, planId: string) {
  const plan = await repo.getPlanById(planId);
  if (!plan) throw new BadRequestError("Plan not found");
  return repo.assignPlanToOrg(orgId, planId);
}
