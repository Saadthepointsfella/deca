import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validateBody } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";
import { loadPolicyConfig, savePolicyConfig } from "./config.store";
import type { PolicyConfigV2 } from "./types";
import { evaluateUsagePolicy } from "./usagePolicy";
import { getPlanForOrgOrThrow } from "../plans/service";

// For now we accept any JSON object and rely on UI / future validation
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

  // Update config (ADMIN) — stores full PolicyConfigV2 object
  app.put(
    "/policy/config",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const body = validateBody(req, anyCfg) as PolicyConfigV2;
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

      const decision = evaluateUsagePolicy({
        orgId: body.orgId,
        plan,
        recentUsage: { daily: body.daily, monthly: body.monthly },
        spikeScore: body.spikeScore,
        policy: cfg,
        subjectType: "ORG",
        subjectId: null,
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
