"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";

type Plan = {
  id: string;
  tier: "FREE" | "PRO" | "ENTERPRISE";
  name: string;
  daily_quota_units: number;
  monthly_quota_units: number;
  support_sla_minutes: number;
};

export default function SettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.getPlans();
        // backend's /plans currently returns extra fields; we just show some
        setPlans(res.plans as any);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load plans");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Settings / Plans</h2>
      {loading && <p className="text-sm text-slate-400">Loading...</p>}
      {error && (
        <p className="text-sm text-red-400 mb-3">
          Error: <span className="font-mono">{error}</span>
        </p>
      )}
      {!loading && plans.length === 0 && (
        <p className="text-sm text-slate-400">No plans defined.</p>
      )}

      {plans.length > 0 && (
        <table className="min-w-full text-sm border border-slate-800">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">Daily quota</th>
              <th className="px-3 py-2 text-left">Monthly quota</th>
              <th className="px-3 py-2 text-left">Support SLA (min)</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.tier}</td>
                <td className="px-3 py-2">{p.daily_quota_units}</td>
                <td className="px-3 py-2">{p.monthly_quota_units}</td>
                <td className="px-3 py-2">{p.support_sla_minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-slate-500">
        In a later pass, this page becomes your surface for plan and policy
        knobs (e.g. quotas, SLA targets, maybe some weights).
      </p>
    </div>
  );
}
