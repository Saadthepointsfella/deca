import type { FastifyRequest } from "fastify";
import { authenticateApiKey } from "../apikeys/service";

export type ApiKeyContext = { apiKey?: { id: string; org_id: string } };

declare module "fastify" {
  interface FastifyRequest extends ApiKeyContext {}
}

export async function tryAttachApiKey(req: FastifyRequest) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return;
  const token = h.slice("Bearer ".length).trim();
  // If it looks like a JWT we'll skip (handled elsewhere)
  const isLikelyJwt = token.split(".").length === 3;
  if (isLikelyJwt) return;

  const record = await authenticateApiKey(token);
  if (record) {
    req.apiKey = { id: record.id, org_id: record.org_id };
  }
}
