// backend/src/shared/http.ts
import type { FastifyReply } from "fastify";

export function ok<T>(reply: FastifyReply, payload: T) {
  return reply.code(200).send(payload);
}
export function created<T>(reply: FastifyReply, payload: T) {
  return reply.code(201).send(payload);
}

export type ErrorShape = { code: string; message: string; details?: unknown };

export function error(reply: FastifyReply, status: number, err: ErrorShape) {
  return reply.code(status).send({ error: err });
}
