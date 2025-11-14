// backend/src/auth/guards.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "./service";
import { roleAtLeast, type Role } from "../shared/roles";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string; org_id: string; name: string; email: string; role: Role;
    };
  }
}

export function requireAuth(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing bearer token" } });
    return;
  }
  try {
    const token = h.slice("Bearer ".length);
    const u = verifyToken(token);
    req.user = u;
    done();
  } catch {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
  }
}

export function requireRole(min: Role) {
  return (req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    if (!req.user) return requireAuth(req, reply, done);
    if (!roleAtLeast(req.user.role, min)) {
      reply.code(403).send({ error: { code: "FORBIDDEN", message: `Requires role >= ${min}` } });
      return;
    }
    done();
  };
}

// Convenience: require ADMIN or OWNER
export const requireAdmin = requireRole("ADMIN");
