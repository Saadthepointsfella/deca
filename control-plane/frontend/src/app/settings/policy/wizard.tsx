"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../../lib/apiClient";
import Button from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";

type Tier = "FREE" | "PRO" | "ENTERPRISE";
type Posture = "STRICT" | "BALANCED" | "GENEROUS";
type SpikeTolerance = "LOW" | "MEDIUM" | "HIGH";
type FreeExperience = "MINIMAL" | "STANDARD" | "STRONG";

type PolicyConfigV2 = any; // keep it loose on FE, backend is source of truth

const TIERS: Tier[] = ["FREE", "PRO", "ENTERPRISE"];

const BASE_TEMPLATE: PolicyConfigV2 = {
  usage: {
    soft_multiplier: { FREE: 1.0, PRO: 1.1, ENTERPRISE: 1.2 },
    hard_multiplier: { FREE: 1.2, PRO: 1.4, ENTERPRISE: 1.6 },
    throttle: {
      threshold_start: 1.0,
      threshold_full: 1.5,
      max_delay_ms: { FREE: 1000, PRO: 750, ENTERPRISE: 500 },
    },
    monthly_block_ratio: { FREE: 1.0, PRO: 1.1, ENTERPRISE: 1.2 },
  },
  spikes: {
    sensitivity: { FREE: 2.5, PRO: 3.5, ENTERPRISE: 4.5 },
    throttle_above: { FREE: 2.0, PRO: 2.5, ENTERPRISE: 3.0 },
    block_above: { FREE: 3.0, PRO: 4.0, ENTERPRISE: null },
    min_daily_volume_for_spike_check: 100,
  },
  overdraft: {
    base_overdraft_factor: { FREE: 1.0, PRO: 1.0, ENTERPRISE: 1.0 },
    max_overdraft_days: 7,
  },
  abuse: {
    suspicious_spike_score: 3.0,
    urgent_ticket_ratio_threshold: 0.4,
    decay_half_life_hours: 24,
  },
  fairness: {
    free_tier_reserve: 0.05,
    max_starvation_minutes: 120,
    enterprise_weight: 3,
    pro_weight: 2,
  },
  api_keys: {
    base_rate_per_min: 600,
    tier_rate_multiplier: { FREE: 0.5, PRO: 1.0, ENTERPRISE: 2.0 },
    burst_factor: 2.0,
  },
  misc: {
    global_block_switch: false,
    allow_free_on_zero_plan: true,
  },
};

function cloneCfg(cfg: PolicyConfigV2): PolicyConfigV2 {
  return JSON.parse(JSON.stringify(cfg));
}

export function GuidedWizard() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";

  const [current, setCurrent] = useState<PolicyConfigV2 | null>(null);

  // Wizard state
  const [posture, setPosture] = useState<Record<Tier, Posture>>({
    FREE: "STRICT",
    PRO: "BALANCED",
    ENTERPRISE: "GENEROUS",
  });
  const [spikeTolerance, setSpikeTolerance] = useState<SpikeTolerance>("MEDIUM");
  const [freeExperience, setFreeExperience] = useState<FreeExperience>("STANDARD");

  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [risk, setRisk] = useState<{ level: "LOW" | "MEDIUM" | "HIGH"; reason: string } | null>(
    null
  );
  const [hasUndo, setHasUndo] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api.getPolicyConfig();
      setCurrent(res.config);
      setPreview(summaryFromConfig(res.config));
      setRisk(computeRisk(res.config));

      if (typeof window !== "undefined") {
        const prev = window.localStorage.getItem("policy:lastConfig");
        if (prev) setHasUndo(true);
      }
    })();
  }, []);

  const applyWizard = async () => {
    if (!canAdmin) return;
    setSaving(true);
    try {
      const cfg = buildConfigFromWizard(posture, spikeTolerance, freeExperience, current);

      // Save current config for undo
      if (typeof window !== "undefined" && current) {
        window.localStorage.setItem("policy:lastConfig", JSON.stringify(current));
        setHasUndo(true);
      }

      await api.putPolicyConfig(cfg);
      setCurrent(cfg);
      setPreview(summaryFromConfig(cfg));
      setRisk(computeRisk(cfg));
    } finally {
      setSaving(false);
    }
  };

  const undoLast = async () => {
    if (!canAdmin) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("policy:lastConfig");
    if (!raw) return;
    try {
      const prev = JSON.parse(raw);
      setSaving(true);
      await api.putPolicyConfig(prev);
      setCurrent(prev);
      setPreview(summaryFromConfig(prev));
      setRisk(computeRisk(prev));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Step 1 — Posture per tier" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TIERS.map((tier) => (
              <div key={tier} className="border border-ink-800 rounded-lg p-3">
                <div className="text-xs text-ink-400 mb-1">{tier}</div>
                <div className="flex flex-col gap-1 text-xs">
                  <button
                    className={`px-2 py-1 rounded text-left ${
                      posture[tier] === "STRICT"
                        ? "bg-white text-black"
                        : "border border-ink-700"
                    }`}
                    onClick={() => setPosture({ ...posture, [tier]: "STRICT" })}
                  >
                    Strict
                    <span className="block text-ink-600">Aggressive throttling, low grace.</span>
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-left ${
                      posture[tier] === "BALANCED"
                        ? "bg-white text-black"
                        : "border border-ink-700"
                    }`}
                    onClick={() => setPosture({ ...posture, [tier]: "BALANCED" })}
                  >
                    Balanced
                    <span className="block text-ink-600">Standard SaaS behavior.</span>
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-left ${
                      posture[tier] === "GENEROUS"
                        ? "bg-white text-black"
                        : "border border-ink-700"
                    }`}
                    onClick={() => setPosture({ ...posture, [tier]: "GENEROUS" })}
                  >
                    Generous
                    <span className="block text-ink-600">
                      More cushion and spike tolerance.
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Step 2 — Spikes & Free-tier fairness" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <div className="mb-2 font-medium">Spike tolerance</div>
              <div className="flex flex-col gap-1">
                <button
                  className={`px-2 py-1 rounded text-left ${
                    spikeTolerance === "LOW"
                      ? "bg-white text-black"
                      : "border border-ink-700"
                  }`}
                  onClick={() => setSpikeTolerance("LOW")}
                >
                  Low
                  <span className="block text-ink-600">Clamp spikes quickly.</span>
                </button>
                <button
                  className={`px-2 py-1 rounded text-left ${
                    spikeTolerance === "MEDIUM"
                      ? "bg-white text-black"
                      : "border border-ink-700"
                  }`}
                  onClick={() => setSpikeTolerance("MEDIUM")}
                >
                  Medium
                  <span className="block text-ink-600">Balanced response to spikes.</span>
                </button>
                <button
                  className={`px-2 py-1 rounded text-left ${
                    spikeTolerance === "HIGH"
                      ? "bg-white text-black"
                      : "border border-ink-700"
                  }`}
                  onClick={() => setSpikeTolerance("HIGH")}
                >
                  High
                  <span className="block text-ink-600">
                    Let spikes through unless extreme.
                  </span>
                </button>
              </div>
            </div>
            <div>
              <div className="mb-2 font-medium">Free-tier experience</div>
              <div className="flex flex-col gap-1">
                <button
                  className={`px-2 py-1 rounded text-left ${
                    freeExperience === "MINIMAL"
                      ? "bg-white text-black"
                      : "border border-ink-700"
                  }`}
                  onClick={() => setFreeExperience("MINIMAL")}
                >
                  Minimal
                  <span className="block text-ink-600">
                    Free can be starved under load.
                  </span>
                </button>
                <button
                  className={`px-2 py-1 rounded text-left ${
                    freeExperience === "STANDARD"
                      ? "bg-white text-black"
                      : "border border-ink-700"
                  }`}
                  onClick={() => setFreeExperience("STANDARD")}
                >
                  Standard
                  <span className="block text-ink-600">
                    Some reserved capacity for Free.
                  </span>
                </button>
                <button
                  className={`px-2 py-1 rounded text-left ${
                    freeExperience === "STRONG"
                      ? "bg-white text-black"
                      : "border border-ink-700"
                  }`}
                  onClick={() => setFreeExperience("STRONG")}
                >
                  Strong
                  <span className="block text-ink-600">
                    Free can’t be starved, ever.
                  </span>
                </button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Step 3 — Apply & summarize"
          aside={
            <div className="flex items-center gap-2">
              {risk && (
                <span
                  className={`text-2xs px-2 py-1 rounded border ${
                    risk.level === "LOW"
                      ? "border-emerald-500 text-emerald-400"
                      : risk.level === "MEDIUM"
                      ? "border-amber-500 text-amber-400"
                      : "border-red-500 text-red-400"
                  }`}
                >
                  Risk: {risk.level}
                </span>
              )}
              {hasUndo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={undoLast}
                  disabled={!canAdmin || saving}
                >
                  Undo last
                </Button>
              )}
              <Button onClick={applyWizard} disabled={!canAdmin || saving}>
                {saving ? "Applying…" : "Apply policy"}
              </Button>
            </div>
          }
        />
        <CardBody>
          <p className="text-xs text-ink-400 mb-2">
            This will overwrite the current policy with a configuration derived from your
            choices.
          </p>
          {preview && (
            <pre className="text-xs bg-ink-900 border border-ink-800 rounded p-3 whitespace-pre-wrap">
              {preview}
            </pre>
          )}
          {!preview && (
            <p className="text-xs text-ink-500">
              After you apply once, a human-readable summary of the resulting policy will
              appear here.
            </p>
          )}
          {risk && (
            <p className="text-xs text-ink-500 mt-2">
              {risk.reason}
            </p>
          )}
          {!canAdmin && (
            <p className="text-xs text-ink-500 mt-2">
              ADMIN or OWNER role required to apply changes.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function buildConfigFromWizard(
  posture: Record<Tier, Posture>,
  spikeTol: SpikeTolerance,
  freeExp: FreeExperience,
  current: PolicyConfigV2 | null
): PolicyConfigV2 {
  const cfg = cloneCfg(current ?? BASE_TEMPLATE);

  // Start from base template
  let out = cloneCfg(BASE_TEMPLATE);

  // 1) Per-tier posture → usage multipliers and max delay
  for (const tier of TIERS) {
    const p = posture[tier];
    if (p === "STRICT") {
      out.usage.soft_multiplier[tier] = 0.9;
      out.usage.hard_multiplier[tier] = 1.1;
      out.usage.throttle.max_delay_ms[tier] = tier === "FREE" ? 1200 : 800;
    } else if (p === "BALANCED") {
      out.usage.soft_multiplier[tier] = BASE_TEMPLATE.usage.soft_multiplier[tier];
      out.usage.hard_multiplier[tier] = BASE_TEMPLATE.usage.hard_multiplier[tier];
      out.usage.throttle.max_delay_ms[tier] =
        BASE_TEMPLATE.usage.throttle.max_delay_ms[tier];
    } else {
      // GENEROUS
      out.usage.soft_multiplier[tier] = 1.1;
      out.usage.hard_multiplier[tier] = 1.8;
      out.usage.throttle.max_delay_ms[tier] =
        tier === "ENTERPRISE" ? 400 : 600;
    }
  }

  // 2) Spike tolerance → sensitivity + thresholds
  if (spikeTol === "LOW") {
    out.spikes.sensitivity = { FREE: 2.0, PRO: 2.5, ENTERPRISE: 3.0 };
    out.spikes.throttle_above = { FREE: 1.5, PRO: 2.0, ENTERPRISE: 2.5 };
    out.spikes.block_above = { FREE: 2.5, PRO: 3.0, ENTERPRISE: 3.5 };
  } else if (spikeTol === "MEDIUM") {
    out.spikes.sensitivity = BASE_TEMPLATE.spikes.sensitivity;
    out.spikes.throttle_above = BASE_TEMPLATE.spikes.throttle_above;
    out.spikes.block_above = BASE_TEMPLATE.spikes.block_above;
  } else {
    // HIGH
    out.spikes.sensitivity = { FREE: 3.5, PRO: 4.0, ENTERPRISE: 5.0 };
    out.spikes.throttle_above = { FREE: 2.5, PRO: 3.0, ENTERPRISE: 3.5 };
    out.spikes.block_above = { FREE: 4.0, PRO: 5.0, ENTERPRISE: null };
  }

  // 3) Free-tier experience → fairness
  if (freeExp === "MINIMAL") {
    out.fairness.free_tier_reserve = 0.0;
    out.fairness.max_starvation_minutes = 240;
  } else if (freeExp === "STANDARD") {
    out.fairness.free_tier_reserve = 0.05;
    out.fairness.max_starvation_minutes = 120;
  } else {
    // STRONG
    out.fairness.free_tier_reserve = 0.15;
    out.fairness.max_starvation_minutes = 60;
  }

  // Carry over some fields from current config if present (api_keys etc.)
  if (cfg) {
    out.api_keys = cfg.api_keys ?? out.api_keys;
    out.abuse = cfg.abuse ?? out.abuse;
    out.overdraft = cfg.overdraft ?? out.overdraft;
    out.misc = cfg.misc ?? out.misc;
  }

  return out;
}

function summaryFromConfig(cfg: PolicyConfigV2): string {
  const lines: string[] = [];
  lines.push("Usage posture:");
  for (const tier of TIERS) {
    lines.push(
      `  ${tier}: soft≈${cfg.usage.soft_multiplier[tier]}×, hard≈${cfg.usage.hard_multiplier[tier]}×, maxDelay≈${cfg.usage.throttle.max_delay_ms[tier]}ms`
    );
  }
  lines.push("");
  lines.push("Spike handling:");
  lines.push(
    `  FREE: throttle>${cfg.spikes.throttle_above.FREE}, block>${cfg.spikes.block_above.FREE}`
  );
  lines.push(
    `  PRO:  throttle>${cfg.spikes.throttle_above.PRO}, block>${cfg.spikes.block_above.PRO}`
  );
  lines.push(
    `  ENT:  throttle>${cfg.spikes.throttle_above.ENTERPRISE}, block>${
      cfg.spikes.block_above.ENTERPRISE ?? "none"
    }`
  );
  lines.push("");
  lines.push(
    `Free-tier reserve: ${(cfg.fairness.free_tier_reserve * 100).toFixed(
      1
    )}% of support capacity; max starvation ~${cfg.fairness.max_starvation_minutes} minutes.`
  );
  return lines.join("\n");
}

function computeRisk(cfg: PolicyConfigV2): {
  level: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
} {
  const soft = cfg.usage.soft_multiplier;
  const hard = cfg.usage.hard_multiplier;

  let level: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  const reasons: string[] = [];

  // FREE very generous above plan → some cost risk
  if (soft.FREE > 1.2 || hard.FREE > 1.5) {
    level = "MEDIUM";
    reasons.push("Free tier has high grace above plan limits.");
  }

  // Inverted monotonicity FREE ≤ PRO ≤ ENT
  if (!(soft.FREE <= soft.PRO && soft.PRO <= soft.ENTERPRISE)) {
    level = "HIGH";
    reasons.push("Free / Pro / Enterprise multipliers are inverted (FREE > PRO or PRO > ENT).");
  }

  if (!(hard.FREE <= hard.PRO && hard.PRO <= hard.ENTERPRISE)) {
    level = "HIGH";
    reasons.push("Hard caps are stricter for paid tiers than for Free.");
  }

  // Free fairness harshness
  if (cfg.fairness.free_tier_reserve === 0 && cfg.fairness.max_starvation_minutes > 180) {
    level = "HIGH";
    reasons.push("Free-tier tickets can be starved for a long time under load.");
  }

  if (reasons.length === 0) {
    reasons.push("Configuration is within conservative bounds.");
  }

  return { level, reason: reasons.join(" ") };
}
