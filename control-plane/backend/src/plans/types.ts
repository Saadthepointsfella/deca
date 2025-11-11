// backend/src/plans/types.ts
export type PlanTier = "FREE" | "PRO" | "ENTERPRISE";

export type Plan = {
  id: string;
  tier: PlanTier;
  name: string;

  daily_quota_units: number;
  monthly_quota_units: number;
  spike_sensitivity: number;   // 0–1
  overdraft_factor: number;    // e.g. 1.2
  support_sla_minutes: number;

  max_agents: number | null;
  max_models: number | null;
  max_agent_daily_units: number | null;
};

export type OrgPlan = {
  org_id: string;
  plan_id: string;
  overrides_json: unknown | null;
};
