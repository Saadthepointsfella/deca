// backend/src/auth/service.ts
import jwt from "jsonwebtoken";
import { config } from "../config";
import { getDb } from "../shared/db";
import type { JwtUser } from "./types";

export async function findUserByEmail(email: string): Promise<JwtUser | null> {
  const db = getDb();
  const res = await db.query(
    `SELECT id, org_id, name, email, role FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  const row = res.rows[0];
  return row ? (row as JwtUser) : null;
}

// Dev-friendly token; no password for Phase-2 alpha.
// In prod, replace with proper provider (OAuth, magic links, etc.).
export function signToken(user: JwtUser): string {
  return jwt.sign(user, config.jwtSecret, { algorithm: "HS256", expiresIn: "12h" });
}

export function verifyToken(token: string): JwtUser {
  return jwt.verify(token, config.jwtSecret) as JwtUser;
}
