// backend/src/usage/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { requireApiKey, requireApiKeyScope } from "../auth/serviceAuth";
import { requireAuth } from "../auth/guards";

import { loadPolicyConfig } from "../policy/config.store";
import { recordUsageAndGetSummary } from "./service";
import { getPlanForOrgOrThrow } from "../plans/service";
import { evaluateUsagePolicy } from "../policy/usagePolicy";
import { logUsageDecision } from "../audit/service";
import { validateBody, validateQuery } from "../shared/validate";
import { usageBlockTotal, usageThrottleTotal } from "../shared/metrics";
import { getDailySeries, getMonthToDate, getRecentDecisions } from "./overview";
import { allow } from "../shared/rateLimit";
import { config } from "../config";
import { getEffectiveAbuseScore, bumpAbuseScore } from "../policy/abuse.store";
import { logUsageDecisionRow } from "./decisionLog";
import { getAgentForOrg } from "../agents/store";

type UsageSubjectType = "ORG" | "AGENT" | "MODEL";

export async function usageRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  /**
   * Main service endpoint — must be called with an org-scoped API key.
   * - Auth: API key (cp_...) only
   * - Scope: usage:write
   * - Org is derived from the key, not from the body
   */
  app.post(
    "/usage/check",
    {
      preHandler: [requireApiKey, requireApiKeyScope("usage:write")],
    },
    async (req) => {
      const body = validateBody(
        req,
        z.object({
          // orgId is now optional and, if present, must match the API key's org
          orgId: z.string().min(1).optional(),
          units: z.number().int().positive(),
          endpoint: z.string().min(1),
          subjectType: z.enum(["ORG", "AGENT", "MODEL"]).optional(),
          subjectId: z.string().optional(),
        })
      );

      if (!req.apiKeyAuth) {
        const err: any = new Error("Missing apiKeyAuth on request");
        err.name = "InternalAuthError";
        throw err;
      }

      const apiKey = req.apiKeyAuth;
      const orgId = apiKey.orgId;

      // If caller provided orgId, enforce that it matches the key's org
      if (body.orgId && body.orgId !== orgId) {
        const err: any = new Error("orgId does not match API key org");
        err.name = "BadRequestError";
        throw err;
      }

      // Determine requested subject (for metering + audit)
      let subjectType: UsageSubjectType = body.subjectType ?? "ORG";
      let subjectId: string | null = body.subjectId ?? null;

      // Per-key rate limit
      const ok = allow(`key:${apiKey.keyId}`, config.apiKeyRatePerMin);
      if (!ok) {
        const decision = {
          type: "THROTTLE" as const,
          delayMs: 1000,
          reason: "Per-key rate limit exceeded",
        };

        usageThrottleTotal.inc();

        // Audit log for rate-limit throttles, using requested subject
        await logUsageDecision({
          orgId,
          subjectType,
          subjectId,
          decision,
          units: body.units,
          endpoint: body.endpoint,
        });

        // ✅ NEW: also log into the analytics table (ORG-level) so /admin sees these throttles
        try {
          const plan = await getPlanForOrgOrThrow(orgId);
          await logUsageDecisionRow({
            orgId,
            plan,
            decision,
          });
        } catch {
          // best-effort logging; don't fail the request
        }

        return {
          decision: decision.type,
          delayMs: decision.delayMs,
          reason: decision.reason,
        };
      }

      // If caller wants AGENT metering, verify agent belongs to org
      if (subjectType === "AGENT") {
        if (!subjectId) {
          const err: any = new Error("subjectId is required when subjectType=AGENT");
          err.name = "BadRequestError";
          throw err;
        }
        const agent = await getAgentForOrg(orgId, subjectId);
        if (!agent) {
          const err: any = new Error("Agent not found for this org");
          err.name = "BadRequestError";
          throw err;
        }
        // Normalize subjectId to canonical ID
        subjectId = agent.id;
      }

      // 1) Always record + summarize at ORG level for quota & policy
      const [plan, orgUsageResult, cfg] = await Promise.all([
        getPlanForOrgOrThrow(orgId),
        recordUsageAndGetSummary({
          orgId,
          subjectType: "ORG",
          subjectId: null,
          units: body.units,
          endpoint: body.endpoint,
        }),
        loadPolicyConfig(),
      ]);

      const { summary } = orgUsageResult;

      // 2) If this call is for an AGENT (or MODEL), also record per-subject usage
      if (subjectType === "AGENT" || subjectType === "MODEL") {
        // Best-effort; we don't depend on its result
        void recordUsageAndGetSummary({
          orgId,
          subjectType,
          subjectId,
          units: body.units,
          endpoint: body.endpoint,
        });
      }

      // Compute effective abuse score (with decay) for this org
      const abuseScore = await getEffectiveAbuseScore(orgId, cfg);

      // If spikeScore is above the suspicious threshold, bump abuse score slightly
      if (summary.spikeScore > cfg.abuse.suspicious_spike_score) {
        const overshoot = summary.spikeScore - cfg.abuse.suspicious_spike_score;
        // Small bump, capped to avoid runaway
        void bumpAbuseScore(orgId, Math.min(5, overshoot));
      }

      // Policy decision is still ORG-level
      const decision = evaluateUsagePolicy({
        orgId,
        plan,
        recentUsage: { daily: summary.daily, monthly: summary.monthly },
        spikeScore: summary.spikeScore,
        subjectType: "ORG",
        subjectId: null,
        policy: cfg,
        abuseScore,
      });

      if (decision.type === "THROTTLE") usageThrottleTotal.inc();
      if (decision.type === "BLOCK") usageBlockTotal.inc();

      // Log to audit trail with the *call's* subject (ORG or AGENT/MODEL)
      await logUsageDecision({
        orgId,
        subjectType,
        subjectId,
        decision,
        units: body.units,
        endpoint: body.endpoint,
      });

      // Log to usage_decisions table for analytics (ORG-level)
      try {
        await logUsageDecisionRow({
          orgId,
          plan,
          decision,
        });
      } catch {
        // Best-effort logging; don't fail the request
      }

      return {
        decision: decision.type,
        delayMs: decision.type === "THROTTLE" ? decision.delayMs : 0,
        reason: decision.reason,
      };
    }
  );

  /**
   * Usage overview for dashboards.
   * - Auth: Supabase user (requireAuth)
   * - Typically filtered by orgId that the user has access to
   */
  app.get(
    "/usage/overview",
    {
      preHandler: [requireAuth],
    },
    async (req) => {
      const { orgId } = validateQuery(req, z.object({ orgId: z.string().min(1) }));

      // TODO (optional): enforce that req.user has membership in this orgId

      const [dailySeries, mtd, decisions] = await Promise.all([
        getDailySeries(orgId, 14),
        getMonthToDate(orgId),
        getRecentDecisions(orgId, 25),
      ]);
      return { dailySeries, monthToDate: mtd, decisions };
    }
  );
}
