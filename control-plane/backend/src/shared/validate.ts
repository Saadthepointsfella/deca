// backend/src/shared/validate.ts
import type { FastifyRequest } from "fastify";
import { z } from "zod";

export function validateBody<T extends z.ZodTypeAny>(req: FastifyRequest, schema: T): z.infer<T> {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const err = new Error("VALIDATION_ERROR");
    (err as any).__validation = issues;
    throw err;
  }
  return parsed.data;
}

export function validateQuery<T extends z.ZodTypeAny>(req: FastifyRequest, schema: T): z.infer<T> {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const err = new Error("VALIDATION_ERROR");
    (err as any).__validation = issues;
    throw err;
  }
  return parsed.data;
}

export function validateParams<T extends z.ZodTypeAny>(req: FastifyRequest, schema: T): z.infer<T> {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const err = new Error("VALIDATION_ERROR");
    (err as any).__validation = issues;
    throw err;
  }
  return parsed.data;
}
