// backend/src/usage/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

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

export async function usageRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.post("/usage/check", async (req) => {
    // orgId is optional here: if an API key is attached, we'll override it
    const body = validateBody(req, z.object({
      orgId: z.string().min(1).optional(),
      units: z.number().int().positive(),
      endpoint: z.string().min(1),
    }));

    let orgId = body.orgId;

    // If an API key was attached on onRequest (auth/apiKeyGuard), use it
    if (req.apiKey) {
      orgId = req.apiKey.org_id;

      // Per-key rate limit
      const ok = allow(`key:${req.apiKey.id}`, config.apiKeyRatePerMin);
      if (!ok) {
        const decision = {
          type: "THROTTLE" as const,
          delayMs: 1000,
          reason: "Per-key rate limit exceeded",
        };

        usageThrottleTotal.inc();

        await logUsageDecision({
          orgId,
          subjectType: "ORG",
          subjectId: null,
          decision,
          units: body.units,
          endpoint: body.endpoint,
        });

        return {
          decision: decision.type,
          delayMs: decision.delayMs,
          reason: decision.reason,
        };
      }
    }

    // No API key → require orgId in body
    if (!orgId) {
      const err: any = new Error("orgId is required when no API key is provided");
      err.name = "BadRequestError";
      throw err;
    }

    const [plan, { summary }, cfg] = await Promise.all([
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

    // Compute effective abuse score (with decay) for this org
    const abuseScore = await getEffectiveAbuseScore(orgId, cfg);

    // If spikeScore is above the suspicious threshold, bump abuse score slightly
    if (summary.spikeScore > cfg.abuse.suspicious_spike_score) {
      const overshoot = summary.spikeScore - cfg.abuse.suspicious_spike_score;
      // Small bump, capped to avoid runaway
      void bumpAbuseScore(orgId, Math.min(5, overshoot));
    }

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

    await logUsageDecision({
      orgId,
      subjectType: "ORG",
      subjectId: null,
      decision,
      units: body.units,
      endpoint: body.endpoint,
    });

    return {
      decision: decision.type,
      delayMs: decision.type === "THROTTLE" ? decision.delayMs : 0,
      reason: decision.reason,
    };
  });

  app.get("/usage/overview", async (req) => {
    const { orgId } = validateQuery(req, z.object({ orgId: z.string().min(1) }));
    const [dailySeries, mtd, decisions] = await Promise.all([
      getDailySeries(orgId, 14),
      getMonthToDate(orgId),
      getRecentDecisions(orgId, 25),
    ]);
    return { dailySeries, monthToDate: mtd, decisions };
  });
}
