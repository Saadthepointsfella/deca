import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validateBody } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";
import { loadPolicyConfig, savePolicyConfig } from "./config.store";
import type { PolicyConfigV2, Tier } from "./types";
import { evaluateUsagePolicy } from "./usagePolicy";
import { getPlanForOrgOrThrow } from "../plans/service";
import { getEffectiveAbuseScore } from "./abuse.store";
import { getDb } from "../shared/db";


// For now we accept any JSON object and rely on our own validation
const anyCfg = z.any();

export async function policyRoutes(app: FastifyInstance) {
  // Read current (merged) config (PolicyConfigV2)
  app.get(
    "/policy/config",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async () => {
      const cfg = await loadPolicyConfig();
      return { config: cfg };
    }
  );

  // Update config (ADMIN) — stores full PolicyConfigV2 object with guardrails
  app.put(
    "/policy/config",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const body = validateBody(req, anyCfg) as PolicyConfigV2;

      const errors = validatePolicyConfigV2(body);
      if (errors.length > 0) {
        // Surface as a 400 with a machine-readable payload
        throw app.httpErrors.badRequest(
          JSON.stringify({
            code: "INVALID_POLICY_CONFIG",
            errors,
          })
        );
      }

      await savePolicyConfig(body);
      return { ok: true };
    }
  );

  // Preview a decision under current config
  app.post(
    "/policy/preview",
    { preHandler: [requireAuth] },
    async (req) => {
      const body = validateBody(
        req,
        z.object({
          orgId: z.string().min(1),
          daily: z.number().min(0),
          monthly: z.number().min(0),
          spikeScore: z.number().min(0),
        })
      );

      const [cfg, plan] = await Promise.all([
        loadPolicyConfig(),
        getPlanForOrgOrThrow(body.orgId),
      ]);

      const abuseScore = await getEffectiveAbuseScore(body.orgId, cfg);

      const decision = evaluateUsagePolicy({
        orgId: body.orgId,
        plan,
        recentUsage: { daily: body.daily, monthly: body.monthly },
        spikeScore: body.spikeScore,
        policy: cfg,
        subjectType: "ORG",
        subjectId: null,
        abuseScore,
      });

      return {
        decision: decision.type,
        reason: decision.reason,
        planTier: plan.tier,
        cfg,
      };
    }
  );
}

// --- Guardrail validator for PolicyConfigV2 ---

function validatePolicyConfigV2(cfg: PolicyConfigV2): string[] {
  const errors: string[] = [];
  const tiers: Tier[] = ["FREE", "PRO", "ENTERPRISE"];

  // 1. FREE ≤ PRO ≤ ENTERPRISE for soft/hard multipliers & monthly ratios
  const arraysToCheck: Array<[string, Record<Tier, number>]> = [
    ["usage.soft_multiplier", cfg.usage.soft_multiplier],
    ["usage.hard_multiplier", cfg.usage.hard_multiplier],
    ["usage.monthly_block_ratio", cfg.usage.monthly_block_ratio],
  ];

  for (const [label, rec] of arraysToCheck) {
    const f = rec.FREE;
    const p = rec.PRO;
    const e = rec.ENTERPRISE;
    if (!(f <= p && p <= e)) {
      errors.push(
        `${label}: expected FREE ≤ PRO ≤ ENTERPRISE, got FREE=${f}, PRO=${p}, ENTERPRISE=${e}`
      );
    }
  }

  // 2. block_above >= throttle_above per tier when both set
  for (const tier of tiers) {
    const thr = cfg.spikes.throttle_above[tier];
    const blk = cfg.spikes.block_above[tier];
    if (thr != null && blk != null && blk < thr) {
      errors.push(
        `spikes.block_above[${tier}] (${blk}) must be >= spikes.throttle_above[${tier}] (${thr})`
      );
    }
  }

  // 3. 0 ≤ free_tier_reserve ≤ 0.5
  const r = cfg.fairness.free_tier_reserve;
  if (r < 0 || r > 0.5) {
    errors.push(
      `fairness.free_tier_reserve must be between 0 and 0.5, got ${r}`
    );
  }

  return errors;
}