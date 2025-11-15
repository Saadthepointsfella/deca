import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/guards";
import { getDb } from "../shared/db";

export async function metricsRoutes(app: FastifyInstance) {
  app.get(
    "/metrics/summary",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async () => {
      const db = getDb();

      // Usage decisions last 24h
      const usageRes = await db.query<{
        plan_tier: string;
        decision_type: "ALLOW" | "THROTTLE" | "BLOCK";
        count: string;
      }>(
        `
        SELECT plan_tier, decision_type, COUNT(*)::bigint AS count
        FROM usage_decision_log
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY plan_tier, decision_type
      `
      );

      const usageByTier: Record<
        string,
        { total: number; allow: number; throttle: number; block: number; throttlePct: number; blockPct: number }
      > = {};

      for (const row of usageRes.rows) {
        const tier = row.plan_tier;
        if (!usageByTier[tier]) {
          usageByTier[tier] = {
            total: 0,
            allow: 0,
            throttle: 0,
            block: 0,
            throttlePct: 0,
            blockPct: 0,
          };
        }
        const c = Number(row.count);
        usageByTier[tier].total += c;
        if (row.decision_type === "ALLOW") usageByTier[tier].allow += c;
        if (row.decision_type === "THROTTLE") usageByTier[tier].throttle += c;
        if (row.decision_type === "BLOCK") usageByTier[tier].block += c;
      }

      for (const tier of Object.keys(usageByTier)) {
        const t = usageByTier[tier];
        const denom = t.total || 1;
        t.throttlePct = (t.throttle / denom) * 100;
        t.blockPct = (t.block / denom) * 100;
      }

      // Support tickets: open + SLA breaches
      const supportOpen = await db.query<{
        plan_tier: string;
        open_count: string;
        breached_open: string;
      }>(
        `
        SELECT p.tier AS plan_tier,
               COUNT(*) FILTER (WHERE t.status = 'OPEN')::bigint AS open_count,
               COUNT(*) FILTER (WHERE t.status = 'OPEN' AND t.sla_deadline IS NOT NULL AND t.sla_deadline < now())::bigint AS breached_open
        FROM tickets t
        JOIN orgs o ON o.id = t.org_id
        JOIN plans p ON p.id = o.plan_id
        GROUP BY p.tier
      `
      );

      const supportByTier: Record<
        string,
        { open: number; breachedOpen: number }
      > = {};
      for (const row of supportOpen.rows) {
        supportByTier[row.plan_tier] = {
          open: Number(row.open_count),
          breachedOpen: Number(row.breached_open),
        };
      }

      // Breached SLAs resolved in last 24h
      const supportResolved = await db.query<{
        plan_tier: string;
        breached_resolved_24h: string;
      }>(
        `
        SELECT p.tier AS plan_tier,
               COUNT(*)::bigint AS breached_resolved_24h
        FROM tickets t
        JOIN orgs o ON o.id = t.org_id
        JOIN plans p ON p.id = o.plan_id
        WHERE t.resolved_at IS NOT NULL
          AND t.sla_deadline IS NOT NULL
          AND t.resolved_at > t.sla_deadline
          AND t.resolved_at >= now() - interval '24 hours'
        GROUP BY p.tier
      `
      );

      for (const row of supportResolved.rows) {
        const tier = row.plan_tier;
        if (!supportByTier[tier]) {
          supportByTier[tier] = { open: 0, breachedOpen: 0 };
        }
        (supportByTier[tier] as any).breachedResolved24h = Number(
          row.breached_resolved_24h
        );
      }

      // Policy changes last 24h
      const policyRes = await db.query<{
        actor_role: string | null;
        count: string;
      }>(
        `
        SELECT COALESCE(actor_role, 'UNKNOWN') AS actor_role,
               COUNT(*)::bigint AS count
        FROM policy_config_audit
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY COALESCE(actor_role, 'UNKNOWN')
      `
      );

      const policyByRole: Record<string, number> = {};
      for (const row of policyRes.rows) {
        policyByRole[row.actor_role!] = Number(row.count);
      }

      // Top 5 orgs by abuse score
      const abuseTop = await db.query<{
        org_id: string;
        name: string;
        plan_tier: string;
        score: number;
      }>(
        `
        SELECT a.org_id,
               o.name,
               p.tier AS plan_tier,
               a.score
        FROM org_abuse_scores a
        JOIN orgs o ON o.id = a.org_id
        JOIN plans p ON p.id = o.plan_id
        ORDER BY a.score DESC
        LIMIT 5
      `
      );

      return {
        usage_last_24h: {
          per_tier: usageByTier,
        },
        support: {
          by_tier: supportByTier,
        },
        policy_changes_last_24h: {
          by_role: policyByRole,
        },
        abuse: {
          top_orgs: abuseTop.rows,
        },
      };
    }
  );
}
