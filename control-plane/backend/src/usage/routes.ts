// backend/src/usage/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { recordUsageAndGetSummary } from "./service";
import { getPlanForOrgOrThrow } from "../plans/service";
import { evaluateUsagePolicy } from "../policy/usagePolicy";
import { logUsageDecision } from "../audit/service";
import { validateBody, validateQuery } from "../shared/validate";
import { usageBlockTotal, usageThrottleTotal } from "../shared/metrics";
import { getDailySeries, getMonthToDate, getRecentDecisions } from "./overview";

export async function usageRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.post("/usage/check", async (req) => {
    const body = validateBody(req, z.object({
      orgId: z.string().min(1),
      units: z.number().int().positive(),
      endpoint: z.string().min(1),
    }));

    const plan = await getPlanForOrgOrThrow(body.orgId);
    const { summary } = await recordUsageAndGetSummary({
      orgId: body.orgId, subjectType: "ORG", subjectId: null, units: body.units, endpoint: body.endpoint,
    });

    const decision = evaluateUsagePolicy({
      orgId: body.orgId,
      plan,
      recentUsage: { daily: summary.daily, monthly: summary.monthly },
      spikeScore: summary.spikeScore,
      subjectType: "ORG",
      subjectId: null,
    });

    if (decision.type === "THROTTLE") usageThrottleTotal.inc();
    if (decision.type === "BLOCK") usageBlockTotal.inc();

    await logUsageDecision({
      orgId: body.orgId, subjectType: "ORG", subjectId: null,
      decision, units: body.units, endpoint: body.endpoint,
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
