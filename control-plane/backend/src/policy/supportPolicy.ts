// backend/src/policy/supportPolicy.ts
import type { Plan, PlanTier } from "../plans/types";
import type { TicketPriority, TicketSlaStatus } from "../support/types";
import type { PolicyConfigV2, Tier } from "./types";

export type TicketPriorityScoreInput = {
  plan: Plan;
  waitMinutes: number;
  slaStatus: TicketSlaStatus;
  declaredPriority: TicketPriority;
  abuseFlag: boolean;          // legacy flag (kept)
  abuseScore?: number;         // decayed numeric abuse score for the org
  cfg: PolicyConfigV2;         // live policy knobs (fairness, etc.)
};

export function computeTicketPriorityScore(input: TicketPriorityScoreInput): number {
  const { plan, waitMinutes, slaStatus, declaredPriority, abuseFlag, abuseScore = 0, cfg } = input;
  const tier = plan.tier as Tier;

  let score = 0;

  // 1) Plan weight from fairness config
  // FREE is baseline 1; PRO/ENT are multipliers over that.
  let planWeight = 1;
  if (tier === "PRO") planWeight = cfg.fairness.pro_weight;
  if (tier === "ENTERPRISE") planWeight = cfg.fairness.enterprise_weight;

  // If free_tier_reserve is high, slightly boost FREE baseline so they are not starved.
  if (tier === "FREE" && cfg.fairness.free_tier_reserve > 0) {
    planWeight += cfg.fairness.free_tier_reserve * 2; // small nudge, not dominance
  }

  score += planWeight * 10; // anchor

  // 2) Wait time contribution (log-scale so very old tickets matter but don’t explode)
  const maxWait = Math.max(0, Math.min(waitMinutes, 24 * 60)); // cap at 24h
  const waitWeight = Math.log10(1 + maxWait) * 10;             // ~0–40ish
  score += waitWeight;

  // 3) SLA urgency
  let slaWeight = 0;
  switch (slaStatus) {
    case "AT_RISK":
      slaWeight = 20;
      break;
    case "BREACHED":
      slaWeight = 40;
      break;
    case "ON_TRACK":
    default:
      slaWeight = 0;
  }
  score += slaWeight;

  // 4) Declared priority weight
  let prioWeight = 0;
  switch (declaredPriority) {
    case "LOW":
      prioWeight = 0;
      break;
    case "MEDIUM":
      prioWeight = 10;
      break;
    case "HIGH":
      prioWeight = 20;
      break;
    case "URGENT":
      prioWeight = 30;
      break;
    default:
      prioWeight = 0;
  }
  score += prioWeight;

  // 5) Abuse penalty
  // - abuseFlag: coarse penalty for clearly abusive cases
  // - abuseScore: smooth penalty based on decayed numeric score
  const baseAbusePenalty = abuseFlag ? 10 : 0;
  const dynamicPenalty = Math.min(20, abuseScore * 2); // cap so it can’t fully zero-out
  score -= baseAbusePenalty + dynamicPenalty;

  // 6) Free-tier starvation guard — fairness.max_starvation_minutes
  // If a FREE ticket has waited beyond this, push it up heavily so it eventually wins.
  const maxStarve = cfg.fairness.max_starvation_minutes;
  if (tier === "FREE" && maxStarve > 0 && waitMinutes >= maxStarve) {
    score += 1000; // effectively guarantees it gets picked soon
  }

  return score;
}
