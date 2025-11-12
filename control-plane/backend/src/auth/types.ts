// backend/src/auth/types.ts
import type { Role } from "../shared/roles";

export type JwtUser = {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: Role;
};
