import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validateBody } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";
import { loadPolicyConfig, savePolicyConfig } from "./config.store";
import type { PolicyConfig } from "./types";
import { evaluateUsagePolicy } from "./usagePolicy";
import { getPlanForOrgOrThrow } from "../plans/service";

const cfgSchema = z.object({
  spike_sensitivity: z.object({
    FREE: z.number().positive(),
    PRO: z.number().positive(),
    ENTERPRISE: z.number().positive(),
  }),
  overdraft_factor: z.number().positive(),
  free_tier_reserve: z.number().min(0).max(1),
}) satisfies z.ZodType<PolicyConfig>;

export async function policyRoutes(app: FastifyInstance) {
  // Read current (merged) config
  app.get("/policy/config", { preHandler: [requireAuth, requireRole("ADMIN")] }, async () => {
    const cfg = await loadPolicyConfig();
    return { config: cfg };
  });

  // Update config (ADMIN)
  app.put("/policy/config", { preHandler: [requireAuth, requireRole("ADMIN")] }, async (req) => {
    const body = validateBody(req, cfgSchema);
    await savePolicyConfig(body);
    return { ok: true };
  });

  // Preview a decision under current config
  app.post("/policy/preview", { preHandler: [requireAuth] }, async (req) => {
    const body = validateBody(req, z.object({
      orgId: z.string().min(1),
      daily: z.number().min(0),
      monthly: z.number().min(0),
      spikeScore: z.number().min(0),
    }));

    const [cfg, plan] = await Promise.all([
      loadPolicyConfig(),
      getPlanForOrgOrThrow(body.orgId),
    ]);

    const decision = evaluateUsagePolicy({
      orgId: body.orgId,
      plan,
      recentUsage: { daily: body.daily, monthly: body.monthly },
      spikeScore: body.spikeScore,
      policy: cfg,
      subjectType: "ORG",
      subjectId: null,
    });

    return { decision: decision.type, reason: decision.reason, planTier: plan.tier, cfg };
  });
}
