// backend/src/policy/usagePolicy.ts
import type { Plan } from "../plans/types";
import type { UsageSubjectType } from "../usage/types";
import { policyEvalLatencyMs } from "../shared/metrics";

export type UsageDecision =
  | { type: "ALLOW"; reason: string }
  | { type: "THROTTLE"; delayMs: number; reason: string }
  | { type: "BLOCK"; reason: string };

export type UsagePolicyContext = {
  orgId: string;
  plan: Plan;
  recentUsage: { daily: number; monthly: number };
  spikeScore: number;
  subjectType: UsageSubjectType;
  subjectId?: string | null;
};

export function evaluateUsagePolicy(ctx: UsagePolicyContext): UsageDecision {
  const endTimer = policyEvalLatencyMs.startTimer();
  try {
    const { plan, recentUsage, spikeScore } = ctx;
    const { daily, monthly } = recentUsage;

    const hardDaily = plan.daily_quota_units * plan.overdraft_factor;
    const hardMonthly = plan.monthly_quota_units * plan.overdraft_factor;

    if (monthly > hardMonthly) return { type: "BLOCK", reason: "Monthly quota exceeded hard limit" };

    const spikeThreshold = plan.spike_sensitivity;
    if (spikeScore > spikeThreshold && plan.tier === "FREE") return { type: "BLOCK", reason: "Traffic spike on Free plan" };
    if (spikeScore > spikeThreshold && plan.tier === "PRO") return { type: "THROTTLE", delayMs: 500, reason: "Traffic spike on Pro plan" };

    if (daily > plan.daily_quota_units && daily <= hardDaily) return { type: "THROTTLE", delayMs: 250, reason: "Over daily soft limit" };
    if (daily > hardDaily) return { type: "BLOCK", reason: "Daily quota exceeded hard limit" };

    return { type: "ALLOW", reason: "Within usage policy" };
  } finally {
    endTimer();
  }
}
