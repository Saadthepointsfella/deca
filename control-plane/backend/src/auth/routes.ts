// backend/src/auth/routes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { validateBody } from "../shared/validate";
import { findUserByEmail, signToken } from "./service";

export async function authRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // Dev login: email only. Returns { token, user }.
  app.post("/auth/login", async (req, reply) => {
    const { email } = validateBody(req, z.object({ email: z.string().email() }));
    const user = await findUserByEmail(email);
    if (!user) return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "User not found" } });
    const token = signToken(user);
    return reply.code(200).send({ token, user });
  });
}
