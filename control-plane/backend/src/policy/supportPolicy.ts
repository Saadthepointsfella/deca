// backend/src/policy/supportPolicy.ts
import type { Plan } from "../plans/types";
import type { TicketPriority, TicketSlaStatus } from "../support/types";
import type { PlanTier } from "../plans/types";
import {
  PLAN_PRIORITY_WEIGHT,
  DECLARED_PRIORITY_WEIGHT,
  SLA_STATUS_BONUS,
  MAX_WAIT_CONTRIBUTION_MINUTES,
  ABUSE_PENALTY,
  MIN_FREE_SCORE,
} from "./config";

export type TicketPriorityScoreInput = {
  plan: Plan;
  waitMinutes: number;
  slaStatus: TicketSlaStatus;
  declaredPriority: TicketPriority;
  abuseFlag: boolean;
};

export function computeTicketPriorityScore(input: TicketPriorityScoreInput): number {
  let score = 0;

  score += PLAN_PRIORITY_WEIGHT[input.plan.tier as PlanTier];

  const wait = Math.min(input.waitMinutes, MAX_WAIT_CONTRIBUTION_MINUTES);
  score += wait;

  score += SLA_STATUS_BONUS[input.slaStatus];

  score += DECLARED_PRIORITY_WEIGHT[input.declaredPriority];

  if (input.abuseFlag) {
    score -= ABUSE_PENALTY;
  }

  if (input.plan.tier === "FREE" && score < MIN_FREE_SCORE) {
    score = MIN_FREE_SCORE;
  }

  return score;
}
