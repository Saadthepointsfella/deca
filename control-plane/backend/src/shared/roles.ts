// backend/src/shared/roles.ts
export type Role = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

const order: Record<Role, number> = { OWNER: 4, ADMIN: 3, AGENT: 2, VIEWER: 1 };

export function roleAtLeast(role: Role, min: Role) {
  return order[role] >= order[min];
}
