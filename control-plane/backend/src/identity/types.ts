// backend/src/identity/types.ts
export type Org = {
  id: string;
  name: string;
  created_at: Date;
};

export type UserRole = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

export type User = {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date;
};
