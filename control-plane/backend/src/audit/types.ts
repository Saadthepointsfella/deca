// backend/src/audit/types.ts
import type { UsageSubjectType } from "../usage/types";

export type UsageDecisionType = "ALLOW" | "THROTTLE" | "BLOCK";

export type UsageDecisionLog = {
  id: string;
  org_id: string;
  subject_type: UsageSubjectType;
  subject_id: string | null;
  decision: UsageDecisionType;
  delay_ms: number | null;
  reason: string;
  units: number;
  endpoint: string;
  created_at: Date;
};

export type TicketActionLog = {
  id: string;
  ticket_id: string;
  org_id: string;
  agent_user_id: string | null;
  action: "PICKED" | "STATUS_CHANGED" | "SLA_BREACHED";
  metadata_json: unknown;
  created_at: Date;
};

export type AdminActionLog = {
  id: string;
  admin_user_id: string;
  org_id: string | null;
  action: string;
  metadata_json: unknown;
  created_at: Date;
};
