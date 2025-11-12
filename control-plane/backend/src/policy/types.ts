export type Tier = "FREE" | "PRO" | "ENTERPRISE";

export type PolicyConfig = {
  // If > threshold, apply spike handling by tier (block/throttle).
  spike_sensitivity: Record<Tier, number>; // e.g., { FREE: 2.5, PRO: 3.5, ENTERPRISE: 4.5 }
  // Multiplies plan.overdraft_factor; keep at 1.0 to preserve plan.
  overdraft_factor: number;                // e.g., 1.2
  // Fraction (0..1) reservation for free tier fairness in queues (future use).
  free_tier_reserve: number;               // e.g., 0.05
};

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  spike_sensitivity: { FREE: 2.5, PRO: 3.5, ENTERPRISE: 4.5 },
  overdraft_factor: 1.0,
  free_tier_reserve: 0.05,
};
