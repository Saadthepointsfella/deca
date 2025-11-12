"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/apiClient";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";

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
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Settings</h2>

      {/* Settings Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/settings/policy">
          <Card className="hover:border-ink-600 transition-colors cursor-pointer">
            <CardBody>
              <div className="text-base font-medium mb-1">Policy Configuration</div>
              <div className="text-xs text-ink-400">
                Tune spike sensitivity, overdraft factors, and fairness parameters
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link href="/settings/api-keys">
          <Card className="hover:border-ink-600 transition-colors cursor-pointer">
            <CardBody>
              <div className="text-base font-medium mb-1">API Keys</div>
              <div className="text-xs text-ink-400">
                Manage org-scoped API keys for service-to-service authentication
              </div>
            </CardBody>
          </Card>
        </Link>

        <Card className="opacity-50">
          <CardBody>
            <div className="text-base font-medium mb-1">Plans</div>
            <div className="text-xs text-ink-400">
              View available subscription plans and quotas
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader title="Available Plans" />
        <CardBody>
          {loading && <p className="text-sm text-ink-400">Loading...</p>}
          {error && (
            <p className="text-sm text-red-400 mb-3">
              Error: <span className="font-mono">{error}</span>
            </p>
          )}
          {!loading && plans.length === 0 && (
            <p className="text-sm text-ink-400">No plans defined.</p>
          )}

          {plans.length > 0 && (
            <table className="min-w-full text-sm border border-ink-800">
              <thead className="bg-ink-900 text-ink-300">
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
                  <tr key={p.id} className="border-t border-ink-800 hover:bg-ink-900">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.tier}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.daily_quota_units.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.monthly_quota_units.toLocaleString()}</td>
                    <td className="px-3 py-2">{p.support_sla_minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
