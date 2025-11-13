-- backend/migrations/0YY_policy_config_v2_seed.sql

UPDATE policy_config
SET value = '{
  "usage": {
    "soft_multiplier":    { "FREE": 1.0, "PRO": 1.1, "ENTERPRISE": 1.2 },
    "hard_multiplier":    { "FREE": 1.2, "PRO": 1.4, "ENTERPRISE": 1.6 },
    "throttle": {
      "threshold_start": 1.0,
      "threshold_full":  1.5,
      "max_delay_ms":    { "FREE": 1000, "PRO": 750, "ENTERPRISE": 500 }
    },
    "monthly_block_ratio": { "FREE": 1.0, "PRO": 1.1, "ENTERPRISE": 1.2 }
  },
  "spikes": {
    "sensitivity": { "FREE": 2.5, "PRO": 3.5, "ENTERPRISE": 4.5 },
    "throttle_above": { "FREE": 2.0, "PRO": 2.5, "ENTERPRISE": 3.0 },
    "block_above":    { "FREE": 3.0, "PRO": 4.0, "ENTERPRISE": null },
    "min_daily_volume_for_spike_check": 100
  },
  "overdraft": {
    "base_overdraft_factor": { "FREE": 1.0, "PRO": 1.0, "ENTERPRISE": 1.0 },
    "max_overdraft_days": 7
  },
  "abuse": {
    "suspicious_spike_score": 3.0,
    "urgent_ticket_ratio_threshold": 0.4,
    "decay_half_life_hours": 24
  },
  "fairness": {
    "free_tier_reserve": 0.05,
    "max_starvation_minutes": 120,
    "enterprise_weight": 3,
    "pro_weight": 2
  },
  "api_keys": {
    "base_rate_per_min": 600,
    "tier_rate_multiplier": { "FREE": 0.5, "PRO": 1.0, "ENTERPRISE": 2.0 },
    "burst_factor": 2.0
  },
  "misc": {
    "global_block_switch": false,
    "allow_free_on_zero_plan": true
  }
}'::jsonb
WHERE key = 'global';
