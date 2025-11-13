// backend/src/support/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { createTicketWithSla } from "./service";
import { listTickets, updateTicketStatus } from "./repository";
import { validateBody, validateParams, validateQuery } from "../shared/validate";
import type { TicketPriority, TicketStatus } from "./types";
import { requireAuth, requireRole } from "../auth/guards";
import { roleAtLeast, type Role } from "../shared/roles";

import { loadPolicyConfig } from "../policy/config.store";
import { getEffectiveAbuseScore, bumpAbuseScore } from "../policy/abuse.store";
import { computeTicketPriorityScore, type TicketSlaStatus } from "../policy/supportPolicy";
import type { Tier } from "../policy/types";
import { getPlanForOrgOrThrow } from "../plans/service";
import { getDb } from "../shared/db";

export async function supportRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // Any authenticated user can open a ticket.
  // Non-ADMIN users may only open tickets for their own org.
  app.post(
    "/support/tickets",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { orgId, subject, body, declaredPriority } = validateBody(
        req,
        z.object({
          orgId: z.string().min(1),
          subject: z.string().min(1),
          body: z.string().optional(),
          declaredPriority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        })
      );

      const user = req.user!;
      const isAdmin = roleAtLeast(user.role as Role, "ADMIN");
      if (!isAdmin && user.org_id !== orgId) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Cannot create tickets for another org" },
        });
      }

      const ticket = await createTicketWithSla({
        orgId,
        subject,
        body,
        declaredPriority: declaredPriority as TicketPriority,
      });

      // --- Abuse: urgent-ticket ratio bump (simple) ---
      try {
        const cfg = await loadPolicyConfig();
        const threshold = cfg.abuse.urgent_ticket_ratio_threshold;
        if (threshold > 0) {
          const db = getDb();
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
          const res = await db.query<{
            total: number;
            urgent: number;
          }>(
            `
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE declared_priority = 'URGENT')::int AS urgent
            FROM tickets
            WHERE org_id = $1 AND created_at >= $2
            `,
            [orgId, since.toISOString()]
          );
          const row = res.rows[0] ?? { total: 0, urgent: 0 };
          if (row.total > 0) {
            const ratio = row.urgent / row.total;
            if (ratio > threshold) {
              const overshoot = ratio - threshold;
              // Bump abuse a bit, capped
              await bumpAbuseScore(orgId, Math.min(5, overshoot * 10));
            }
          }
        }
      } catch {
        // best-effort; do not block ticket creation on abuse scoring errors
      }

      return reply.code(201).send({ ticket });
    }
  );

  // List tickets requires AGENT+.
  // Non-ADMIN users are scoped to their own org.
  app.get(
    "/support/tickets",
    { preHandler: [requireAuth, requireRole("AGENT")] },
    async (req, reply) => {
      const { status, orgId, limit } = validateQuery(
        req,
        z.object({
          status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
          orgId: z.string().optional(),
          limit: z.coerce.number().int().positive().max(500).optional(),
        })
      );

      const user = req.user!;
      const isAdmin = roleAtLeast(user.role as Role, "ADMIN");

      // Enforce org scoping for non-admins
      if (!isAdmin) {
        if (orgId && orgId !== user.org_id) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "Cannot view tickets for another org" },
          });
        }
      }

      const effectiveOrgId = isAdmin ? orgId : user.org_id;
      const tickets = await listTickets({
        status: status as TicketStatus | undefined,
        orgId: effectiveOrgId,
        limit,
      });
      return { tickets };
    }
  );

  // Update ticket status requires AGENT+.
  // (For stricter org-scoping you can look up the ticket's org here and enforce match.)
  app.patch(
    "/support/tickets/:id",
    { preHandler: [requireAuth, requireRole("AGENT")] },
    async (req) => {
      const { id } = validateParams(req, z.object({ id: z.string().min(1) }));
      const { status } = validateBody(
        req,
        z.object({
          status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
        })
      );
      await updateTicketStatus(id, status as TicketStatus);
      return { ok: true };
    }
  );

  // "Next ticket" triage requires AGENT+.
  // Uses policy config, fairness knobs, and org abuse score to pick the best ticket.
  app.get(
    "/support/next",
    { preHandler: [requireAuth, requireRole("AGENT")] },
    async (req) => {
      const agentUserId: string | null = req.user?.id ?? null;
      void agentUserId; // reserved for future attribution

      // For triage we look at OPEN tickets across orgs (limited).
      const tickets = await listTickets({
        status: "OPEN" as TicketStatus,
        orgId: undefined,
        limit: 100,
      });

      if (!tickets || tickets.length === 0) {
        return { ticket: null, score: null };
      }

      const cfg = await loadPolicyConfig();

      // Preload plans and abuse scores by org
      const orgIds = Array.from(new Set(tickets.map((t: any) => t.org_id as string)));
      const planByOrg = new Map<string, { tier: Tier }>();
      const abuseByOrg = new Map<string, number>();

      await Promise.all(
        orgIds.map(async (orgId) => {
          const plan = await getPlanForOrgOrThrow(orgId);
          planByOrg.set(orgId, { tier: plan.tier as Tier });

          const abuse = await getEffectiveAbuseScore(orgId, cfg);
          abuseByOrg.set(orgId, abuse);
        })
      );

      const now = Date.now();

      let bestTicket: any = null;
      let bestScore = -Infinity;

      for (const t of tickets as any[]) {
        const orgId = t.org_id as string;
        const plan = planByOrg.get(orgId);
        if (!plan) continue;

        const createdAt = new Date(t.created_at).getTime();
        const waitMinutes = (now - createdAt) / 60000;

        const slaDeadline = t.sla_deadline ? new Date(t.sla_deadline).getTime() : null;
        let slaStatus: TicketSlaStatus = "ON_TRACK";
        if (slaDeadline != null) {
          if (now > slaDeadline) slaStatus = "BREACHED";
          else if (now > slaDeadline - 15 * 60 * 1000) slaStatus = "AT_RISK"; // within 15 minutes
        }

        const abuseScore = abuseByOrg.get(orgId) ?? 0;
        const isFreeTier = plan.tier === "FREE";

        const score = computeTicketPriorityScore({
          planTier: plan.tier,
          waitMinutes,
          slaStatus,
          declaredPriority: t.declared_priority,
          abuseScore,
          cfg,
          isFreeTier,
        });

        if (score > bestScore) {
          bestScore = score;
          bestTicket = t;
        }
      }

      if (!bestTicket) return { ticket: null, score: null };
      return { ticket: bestTicket, score: bestScore };
    }
  );
}
