// backend/src/auth/guards.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./service";
import type { JwtUser } from "./types";
import type { Role } from "../shared/roles";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtUser;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing Authorization bearer token",
      },
    });
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const user = verifyToken(token);
    req.user = user;
  } catch (e: any) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
        details: e?.message ?? String(e),
      },
    });
  }
}

// Require that the user has at least `minRole`.
const ROLE_ORDER: Role[] = ["VIEWER", "AGENT", "ADMIN", "OWNER"];

export function requireRole(minRole: Role) {
  return (req: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const u = req.user;
    if (!u) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    const userRoleIdx = ROLE_ORDER.indexOf(u.role);
    const neededIdx = ROLE_ORDER.indexOf(minRole);

    if (userRoleIdx < neededIdx) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: `Requires role ${minRole} or higher`,
        },
      });
    }

    done();
  };
}

// Convenience: require ADMIN or OWNER
export const requireAdmin = requireRole("ADMIN");
