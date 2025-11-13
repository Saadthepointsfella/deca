// backend/src/policy/usagePolicy.ts
import type { Plan } from "../plans/types";
import type { UsageSubjectType } from "../usage/types";
import { policyEvalLatencyMs } from "../shared/metrics";
import type { PolicyConfigV2, Tier } from "./types";

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
  policy: PolicyConfigV2;
};

export function evaluateUsagePolicy(ctx: UsagePolicyContext): UsageDecision {
  const endTimer = policyEvalLatencyMs.startTimer();
  try {
    const { plan, recentUsage, spikeScore, policy } = ctx;
    const tier = plan.tier as Tier; // "FREE" | "PRO" | "ENTERPRISE"
    const { daily, monthly } = recentUsage;

    // 1) Global panic switch
    if (policy.misc.global_block_switch && tier !== "ENTERPRISE") {
      return { type: "BLOCK", reason: "Global block switch enabled" };
    }

    // 2) Effective quotas with overdraft
    const qd = plan.daily_quota_units;
    const qm = plan.monthly_quota_units;

    const softMult = policy.usage.soft_multiplier[tier] ?? 1.0;
    const hardMult = policy.usage.hard_multiplier[tier] ?? 1.2;
    const monthlyRatio = policy.usage.monthly_block_ratio[tier] ?? 1.0;

    const baseSoftDaily = qd * softMult;
    const baseHardDaily = qd * hardMult;
    const baseHardMonthly = qm * monthlyRatio;

    const baseOverdraft = policy.overdraft.base_overdraft_factor[tier] ?? 1.0;
    const planOverdraft = (plan as any).overdraft_factor ?? 1.0; // if Plan has it typed, this is fine
    const overdraftFactor = baseOverdraft * planOverdraft;

    const softDailyCap = baseSoftDaily; // soft cap stays soft; overdraft mainly affects hard caps
    const hardDailyCap = baseHardDaily * overdraftFactor;
    const hardMonthlyCap = baseHardMonthly * overdraftFactor;

    // 3) Hard monthly block first
    if (hardMonthlyCap > 0 && monthly > hardMonthlyCap) {
      return { type: "BLOCK", reason: "Monthly quota exceeded hard cap" };
    }

    // 4) Throttle curve based on daily ratio
    const { threshold_start, threshold_full, max_delay_ms } = policy.usage.throttle;
    const tierMaxDelay = max_delay_ms[tier] ?? 500;

    const r = softDailyCap > 0 ? daily / softDailyCap : Infinity;
    let quotaDecision: UsageDecision | null = null;

    // Hard daily block
    if (hardDailyCap > 0 && daily > hardDailyCap) {
      quotaDecision = { type: "BLOCK", reason: "Daily quota exceeded hard cap" };
    } else if (softDailyCap > 0 && r > threshold_start) {
      // Within soft/hard, apply smooth throttle between threshold_start and threshold_full
      const start = threshold_start;
      const full = threshold_full;

      if (full > start) {
        const clampedR = Math.min(Math.max(r, start), full);
        const t = (clampedR - start) / (full - start); // 0..1
        const delay = Math.round(tierMaxDelay * t);
        if (delay > 0) {
          quotaDecision = {
            type: "THROTTLE",
            delayMs: delay,
            reason: "Over daily soft limit (throttle curve)",
          };
        }
      } else {
        // Degenerate config: treat anything above start as max delay
        quotaDecision = {
          type: "THROTTLE",
          delayMs: tierMaxDelay,
          reason: "Over daily soft limit (degenerate curve)",
        };
      }
    }

    // 5) Spike logic (additive)
    let spikeDecision: UsageDecision | null = null;
    if (daily >= policy.spikes.min_daily_volume_for_spike_check) {
      const s = spikeScore;
      const sens = policy.spikes.sensitivity[tier] ?? 3.0;
      const throttleAbove = policy.spikes.throttle_above[tier];
      const blockAbove = policy.spikes.block_above[tier];

      // Hard spike block
      if (blockAbove != null && s >= blockAbove) {
        spikeDecision = {
          type: "BLOCK",
          reason: `Unusual activity too high (spike block, score=${s.toFixed(2)})`,
        };
      } else if (throttleAbove != null && s >= throttleAbove) {
        // Extra delay scaled by spike severity vs sensitivity
        const baseDelay =
          quotaDecision?.type === "THROTTLE" ? quotaDecision.delayMs : 0;
        const spikeFactor = Math.min(2, s / sens); // cap at 2x
        const extra = Math.round((tierMaxDelay * 0.5) * spikeFactor);
        const totalDelay = Math.min(tierMaxDelay, baseDelay + extra);

        if (totalDelay > 0) {
          spikeDecision = {
            type: "THROTTLE",
            delayMs: totalDelay,
            reason: `Unusual activity (spike throttle, score=${s.toFixed(2)})`,
          };
        }
      }
    }

    // 6) Combine decisions: BLOCK dominates, then worst THROTTLE, else ALLOW
    if (quotaDecision?.type === "BLOCK" || spikeDecision?.type === "BLOCK") {
      return {
        type: "BLOCK",
        reason:
          quotaDecision?.type === "BLOCK"
            ? quotaDecision.reason
            : spikeDecision?.reason || "Blocked by policy",
      };
    }

    if (quotaDecision?.type === "THROTTLE" || spikeDecision?.type === "THROTTLE") {
      const quotaDelay =
        quotaDecision?.type === "THROTTLE" ? quotaDecision.delayMs : 0;
      const spikeDelay =
        spikeDecision?.type === "THROTTLE" ? spikeDecision.delayMs : 0;
      const delay = Math.max(quotaDelay, spikeDelay);

      const reasonParts = [
        quotaDecision?.type === "THROTTLE" ? quotaDecision.reason : null,
        spikeDecision?.type === "THROTTLE" ? spikeDecision.reason : null,
      ].filter(Boolean) as string[];

      return {
        type: "THROTTLE",
        delayMs: delay,
        reason: reasonParts.join(" + ") || "Throttled by policy",
      };
    }

    // 7) Default: allowed
    return { type: "ALLOW", reason: "Within usage policy" };
  } finally {
    endTimer();
  }
}
