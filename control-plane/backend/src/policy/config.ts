// backend/src/policy/config.ts
import type { PlanTier } from "../plans/types";
import type { TicketPriority } from "../support/types";
import type { TicketSlaStatus } from "../support/types";

export const PLAN_PRIORITY_WEIGHT: Record<PlanTier, number> = {
  FREE: 10,
  PRO: 30,
  ENTERPRISE: 60,
};

export const DECLARED_PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  LOW: 0,
  MEDIUM: 10,
  HIGH: 20,
  URGENT: 30,
};

export const SLA_STATUS_BONUS: Record<TicketSlaStatus, number> = {
  ON_TRACK: 0,
  AT_RISK: 40,
  BREACHED: 80,
};

export const MAX_WAIT_CONTRIBUTION_MINUTES = 120;
export const ABUSE_PENALTY = 10;
export const MIN_FREE_SCORE = 5;
