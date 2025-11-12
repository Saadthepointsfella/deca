// backend/src/policy/usagePolicy.ts
import type { Plan } from "../plans/types";
import type { UsageSubjectType } from "../usage/types";
import { policyEvalLatencyMs } from "../shared/metrics";
import type { PolicyConfig } from "./types";

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
  policy: PolicyConfig; // 🔹 new: current policy config snapshot
};

export function evaluateUsagePolicy(ctx: UsagePolicyContext): UsageDecision {
  const endTimer = policyEvalLatencyMs.startTimer();
  try {
    const { plan, recentUsage, spikeScore, policy } = ctx;
    const { daily, monthly } = recentUsage;

    // 🔹 effective overdraft = plan overdraft × global multiplier
    const effectiveOverdraft = plan.overdraft_factor * (policy.overdraft_factor || 1.0);
    const hardDaily = plan.daily_quota_units * effectiveOverdraft;
    const hardMonthly = plan.monthly_quota_units * effectiveOverdraft;

    if (monthly > hardMonthly) {
      return { type: "BLOCK", reason: "Monthly quota exceeded hard limit" };
    }

    // 🔹 spike sensitivity comes from policy config per tier
    const tierSensitivity =
      policy.spike_sensitivity[plan.tier] ??
      // fallback if config missing tier
      3.0;

    if (spikeScore > tierSensitivity && plan.tier === "FREE") {
      return { type: "BLOCK", reason: "Traffic spike on Free plan" };
    }
    if (spikeScore > tierSensitivity && plan.tier === "PRO") {
      return {
        type: "THROTTLE",
        delayMs: 500,
        reason: "Traffic spike on Pro plan",
      };
    }
    // ENTERPRISE: more tolerant; only blocked/throttled by quota rules below.

    if (daily > plan.daily_quota_units && daily <= hardDaily) {
      return {
        type: "THROTTLE",
        delayMs: 250,
        reason: "Over daily soft limit",
      };
    }
    if (daily > hardDaily) {
      return {
        type: "BLOCK",
        reason: "Daily quota exceeded hard limit",
      };
    }

    return { type: "ALLOW", reason: "Within usage policy" };
  } finally {
    endTimer();
  }
}
