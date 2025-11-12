"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../../lib/apiClient";
import Button from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";

type Cfg = {
  spike_sensitivity: { FREE: number; PRO: number; ENTERPRISE: number };
  overdraft_factor: number;
  free_tier_reserve: number;
};

export default function PolicyPage() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [mode, setMode] = useState<"sliders"|"json">("sliders");
  const [saving, setSaving] = useState(false);
  const [pvOrg, setPvOrg] = useState("");
  const [pvDaily, setPvDaily] = useState(0);
  const [pvMonthly, setPvMonthly] = useState(0);
  const [pvSpike, setPvSpike] = useState(1.0);
  const [preview, setPreview] = useState<{ decision:string; reason:string; planTier:string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api.getPolicyConfig();
      setCfg(res.config as Cfg);
      setRawJson(JSON.stringify(res.config, null, 2));
    })();
  }, []);

  const onSave = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await api.putPolicyConfig(cfg);
    } finally { setSaving(false); }
  };

  const fromJson = () => {
    try {
      const obj = JSON.parse(rawJson);
      setCfg(obj);
    } catch { /* ignore */ }
  };

  const doPreview = async () => {
    const res = await api.previewPolicy({
      orgId: pvOrg, daily: pvDaily, monthly: pvMonthly, spikeScore: pvSpike,
    });
    setPreview({ decision: res.decision, reason: res.reason, planTier: res.planTier });
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-400">Mechanism Designer — tune policy and preview decisions.</div>

      <Card>
        <CardHeader
          title="Policy configuration"
          aside={
            <div className="flex items-center gap-2">
              <select className="text-xs bg-ink-900 border border-ink-700 rounded px-2 py-1" value={mode} onChange={e => setMode(e.target.value as any)}>
                <option value="sliders">Sliders</option>
                <option value="json">JSON</option>
              </select>
              <Button onClick={onSave} disabled={!canAdmin || saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          }
        />
        <CardBody>
          {!cfg ? (
            <div className="text-sm text-ink-400">Loading…</div>
          ) : mode === "json" ? (
            <div className="space-y-2">
              <textarea className="w-full h-64" value={rawJson} onChange={e=>setRawJson(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={fromJson}>Apply JSON</Button>
                {!canAdmin && <span className="text-xs text-ink-500">ADMIN required to save.</span>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Spike sensitivity (higher tolerates larger spikes)</h4>
                {(["FREE","PRO","ENTERPRISE"] as const).map(tier => (
                  <div key={tier} className="mb-3">
                    <div className="flex items-center justify-between text-xs text-ink-400">
                      <span>{tier}</span><span>{cfg.spike_sensitivity[tier].toFixed(2)}</span>
                    </div>
                    <input type="range" min={1} max={10} step={0.1}
                      value={cfg.spike_sensitivity[tier]}
                      onChange={e => setCfg({...cfg, spike_sensitivity: { ...cfg.spike_sensitivity, [tier]: Number(e.target.value) }})}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Global multipliers</h4>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-ink-400">
                    <span>Overdraft factor ×</span><span>{cfg.overdraft_factor.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0.5} max={2.0} step={0.05}
                    value={cfg.overdraft_factor}
                    onChange={e => setCfg({ ...cfg, overdraft_factor: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-ink-400">
                    <span>Free-tier reserve</span><span>{(cfg.free_tier_reserve*100).toFixed(1)}%</span>
                  </div>
                  <input type="range" min={0} max={0.2} step={0.005}
                    value={cfg.free_tier_reserve}
                    onChange={e => setCfg({ ...cfg, free_tier_reserve: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-ink-500 mt-1">Reserved queue capacity for FREE tier (used in support fairness).</div>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preview usage decision" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input placeholder="Org ID" value={pvOrg} onChange={e=>setPvOrg(e.target.value)} />
            <input type="number" placeholder="Daily" value={pvDaily} onChange={e=>setPvDaily(Number(e.target.value))} />
            <input type="number" placeholder="Monthly" value={pvMonthly} onChange={e=>setPvMonthly(Number(e.target.value))} />
            <input type="number" step="0.1" placeholder="Spike score" value={pvSpike} onChange={e=>setPvSpike(Number(e.target.value))} />
          </div>
          <div className="mt-3">
            <Button onClick={doPreview} disabled={!pvOrg}>Run preview</Button>
          </div>
          {preview && (
            <div className="mt-4 text-sm">
              <div>Decision: <span className="font-medium">{preview.decision}</span></div>
              <div className="text-ink-300">Reason: {preview.reason}</div>
              <div className="text-ink-500 text-xs mt-1">Plan tier detected: {preview.planTier}</div>
            </div>
          )}
          <p className="text-xs text-ink-500 mt-3">Preview uses the current saved policy + the org’s actual plan.</p>
        </CardBody>
      </Card>
    </div>
  );
}
