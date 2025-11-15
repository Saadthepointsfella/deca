import type { FastifyRequest, FastifyReply } from "fastify";
import { findApiKeyBySecret, markApiKeyUsed, ApiKeyScope } from "./apiKeyRepo";

declare module "fastify" {
  interface FastifyRequest {
    apiKeyAuth?: {
      keyId: string;
      orgId: string;
      scopes: ApiKeyScope[];
    };
  }
}

export async function requireApiKey(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    return reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Missing Authorization bearer token",
    });
  }
  const token = header.slice("Bearer ".length).trim();

  // Only accept our cp_* keys here
  if (!token.startsWith("cp_")) {
    return reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Expected API key (cp_*) for this endpoint",
    });
  }

  const match = await findApiKeyBySecret(token);
  if (!match) {
    return reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Invalid or revoked API key",
    });
  }

  req.apiKeyAuth = {
    keyId: match.keyId,
    orgId: match.orgId,
    scopes: match.scopes,
  };
  // fire-and-forget
  void markApiKeyUsed(match.keyId);
}

export function requireApiKeyScope(scope: ApiKeyScope) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = req.apiKeyAuth;
    if (!auth) {
      return reply.status(401).send({
        code: "UNAUTHORIZED",
        message: "API key required",
      });
    }
    if (!auth.scopes.includes(scope)) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: `API key missing required scope: ${scope}`,
      });
    }
  };
}

