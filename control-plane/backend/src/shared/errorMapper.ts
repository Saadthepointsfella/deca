// backend/src/shared/errorMapper.ts
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { error } from "./http";
import { logger } from "./logger";

export function errorHandler(err: FastifyError & any, _req: FastifyRequest, reply: FastifyReply) {
  // Validation
  if (err?.message === "VALIDATION_ERROR") {
    return error(reply, 400, { code: "VALIDATION_ERROR", message: "Invalid request", details: err.__validation });
  }

  // Domain-ish
  if (err?.name === "BadRequestError") {
    return error(reply, 400, { code: "BAD_REQUEST", message: err.message });
  }
  if (err?.name === "NotFoundError") {
    return error(reply, 404, { code: "NOT_FOUND", message: err.message });
  }

  // Fallback
  logger.error({ err }, "Unhandled error");
  return error(reply, 500, { code: "INTERNAL", message: "Unexpected server error" });
}
