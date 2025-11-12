// backend/src/admin/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireAuth, requireRole } from "../auth/guards";
import {
  getUsageLeaderboard,
  getTicketCounts,
  getDecisionCountsLast24h,
  getActiveApiKeysSummary,
} from "./repository";

export async function adminRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get(
    "/admin/overview",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async () => {
      const [leaderboard, tickets, decisions, apiKeys] = await Promise.all([
        getUsageLeaderboard(10),
        getTicketCounts(),
        getDecisionCountsLast24h(),
        getActiveApiKeysSummary(10),
      ]);

      const total = decisions.totalDecisions || 0;
      const throttlePct = total ? (decisions.throttleCount / total) * 100 : 0;
      const blockPct = total ? (decisions.blockCount / total) * 100 : 0;

      return {
        usageLeaderboard: leaderboard,
        tickets,
        decisions: {
          total: total,
          throttleCount: decisions.throttleCount,
          blockCount: decisions.blockCount,
          throttlePct,
          blockPct,
        },
        apiKeys,
      };
    }
  );
}
