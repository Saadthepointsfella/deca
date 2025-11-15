import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { validateBody, validateQuery } from "../shared/validate";
import { requireAuth, requireRole } from "../auth/guards";
import { listKeys, revokeKey } from "./repository";
import { createApiKey } from "./service";
import { getDb } from "../shared/db";

async function ensureOrgAdmin(req: FastifyRequest, orgId: string) {
  // requireAuth + requireRole("ADMIN") should already have run,
  // but we still need to make sure the user is ADMIN/OWNER *for this org*.
  const user = req.user;
  if (!user) {
    throw {
      statusCode: 401,
      payload: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    };
  }

  const db = getDb();
  const res = await db.query<{ role: string }>(
    `
    SELECT role
    FROM org_users
    WHERE user_id = $1 AND org_id = $2
    `,
    [user.id, orgId]
  );

  const row = res.rows[0];
  if (!row || (row.role !== "ADMIN" && row.role !== "OWNER")) {
    throw {
      statusCode: 403,
      payload: {
        code: "FORBIDDEN",
        message: "Requires ADMIN or OWNER role on this org",
      },
    };
  }
}

export async function apiKeysRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // ADMIN+: list keys by org (must be ADMIN/OWNER on that org)
  app.get(
    "/api-keys",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req, reply) => {
      const { orgId } = validateQuery(req, z.object({ orgId: z.string().min(1) }));

      try {
        await ensureOrgAdmin(req, orgId);
      } catch (e: any) {
        return reply.status(e.statusCode ?? 403).send(e.payload ?? {
          code: "FORBIDDEN",
          message: "Requires ADMIN or OWNER role on this org",
        });
      }

      const keys = await listKeys(orgId);
      // IMPORTANT: listKeys should NOT return raw secrets, only metadata
      return { keys };
    }
  );

  // ADMIN+: create key -> returns secret once
  app.post(
    "/api-keys",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req, reply) => {
      const { orgId, name } = validateBody(
        req,
        z.object({
          orgId: z.string().min(1),
          name: z.string().min(1),
        })
      );

      try {
        await ensureOrgAdmin(req, orgId);
      } catch (e: any) {
        return reply.status(e.statusCode ?? 403).send(e.payload ?? {
          code: "FORBIDDEN",
          message: "Requires ADMIN or OWNER role on this org",
        });
      }

      const { record, secret } = await createApiKey(orgId, name);

      // record should NOT contain the secret; we attach it here once for the client
      return reply.code(201).send({
        key: {
          ...record, // id, orgId, name, prefix, scopes, createdAt, lastUsedAt, revokedAt...
          secret,    // full cp_* string, only here once
        },
        note: "Store this secret now; it will not be shown again.",
      });
    }
  );

  // ADMIN+: revoke by id (must be ADMIN/OWNER on that org)
  app.post(
    "/api-keys/revoke",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req, reply) => {
      const { orgId, id } = validateBody(
        req,
        z.object({
          orgId: z.string().min(1),
          id: z.string().min(1),
        })
      );

      try {
        await ensureOrgAdmin(req, orgId);
      } catch (e: any) {
        return reply.status(e.statusCode ?? 403).send(e.payload ?? {
          code: "FORBIDDEN",
          message: "Requires ADMIN or OWNER role on this org",
        });
      }

      await revokeKey(id, orgId);
      return { ok: true };
    }
  );
}
