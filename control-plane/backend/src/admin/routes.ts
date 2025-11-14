// backend/src/admin/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireAuth, requireRole } from "../auth/guards";
import {
  getUsageLeaderboard,
  getTicketCounts,
  getDecisionCountsLast24h,
  getActiveApiKeysSummary,
  getAbuseBuckets,        // ⬅️ NEW: import abuse metrics
} from "./repository";

export async function adminRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get(
    "/admin/overview",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async () => {
      const [leaderboard, tickets, decisions, apiKeys, abuse] = await Promise.all([
        getUsageLeaderboard(10),
        getTicketCounts(),
        getDecisionCountsLast24h(),
        getActiveApiKeysSummary(10),
        getAbuseBuckets(),            // ⬅️ NEW
      ]);

      const total = decisions.totalDecisions || 0;
      const throttlePct = total ? (decisions.throttleCount / total) * 100 : 0;
      const blockPct = total ? (decisions.blockCount / total) * 100 : 0;

      return {
        usageLeaderboard: leaderboard,
        tickets,
        decisions: {
          total,
          throttleCount: decisions.throttleCount,
          blockCount: decisions.blockCount,
          throttlePct,
          blockPct,
        },
        apiKeys,
        abuse: {
          // normalize into an array the FE can render as cards/bars
          buckets: [
            { label: "0",   count: abuse.zero ?? 0 },
            { label: "0–3", count: abuse.low ?? 0 },
            { label: "3–10", count: abuse.medium ?? 0 },
            { label: ">10", count: abuse.high ?? 0 },
          ],
        },
      };
    }
  );
}
