"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../lib/apiClient";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody } from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

type LeaderRow = { org_id: string; org_name: string; plan_tier: string | null; mtd_units: number };
type ApiKeyRow = { org_id: string; org_name: string; key_count: number };
type AbuseBucket = { label: string; count: number };

type Overview = {
  usageLeaderboard: LeaderRow[];
  tickets: { openTickets: number; breachedTickets: number };
  decisions: {
    total: number;
    throttleCount: number;
    blockCount: number;
    throttlePct: number;
    blockPct: number;
  };
  apiKeys: ApiKeyRow[];
  abuse?: { buckets: AbuseBucket[] }; // <- NEW, optional for backward compat
};

const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_DASH_URL; // optional
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoStatusLoading, setDemoStatusLoading] = useState(false);

  // Load demo status
  useEffect(() => {
    if (!canAdmin || !isDemoMode) return;
    (async () => {
      try {
        setDemoStatusLoading(true);
        const result = await api.getDemoStatus();
        setDemoEnabled(result.enabled);
      } catch (e: any) {
        console.error("Failed to load demo status:", e);
      } finally {
        setDemoStatusLoading(false);
      }
    })();
  }, [canAdmin, isDemoMode]);

  useEffect(() => {
    if (!canAdmin) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.getAdminOverview();
        setData(res);
      } catch (e: any) {
        setErr(e.message ?? "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [canAdmin]);

  const handleDemoToggle = async () => {
    try {
      setDemoLoading(true);
      setErr(null);

      if (demoEnabled) {
        await api.disableDemo();
      } else {
        await api.enableDemo();
      }

      setDemoEnabled(!demoEnabled);

      // Refresh overview data
      const overview = await api.getAdminOverview();
      setData(overview);
    } catch (e: any) {
      setErr(e.message ?? "Failed to toggle demo data");
    } finally {
      setDemoLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="text-sm text-ink-400">Checking session…</div>;
  }

  if (!canAdmin) {
    return (
      <div className="max-w-md">
        <h2 className="text-lg font-semibold mb-2">Forbidden</h2>
        <p className="text-sm text-ink-400">
          The admin dashboard is only available to <span className="font-mono">OWNER</span> or{" "}
          <span className="font-mono">ADMIN</span> roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-400">
        One-glance view of network health. Data is aggregated from usage, tickets, API keys, and abuse
        signals.
      </div>

      {/* Demo mode controls */}
      {isDemoMode && (
        <Card>
          <CardHeader title="Demo Mode" />
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-ink-400 mb-2">
                  Toggle demo mode to seed or clear demo data (3 orgs, usage history with spikes, and tickets).
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-500">Status:</span>
                  {demoStatusLoading ? (
                    <span className="text-ink-400">Loading...</span>
                  ) : (
                    <span className={demoEnabled ? "text-green-400" : "text-ink-500"}>
                      {demoEnabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoEnabled}
                  onChange={handleDemoToggle}
                  disabled={demoLoading || demoStatusLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-ink-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ink-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink-100 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                {demoLoading && (
                  <span className="ml-2 text-xs text-ink-400">
                    {demoEnabled ? "Disabling..." : "Enabling..."}
                  </span>
                )}
              </label>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Decisions (24h)"
          value={data?.decisions.total ?? 0}
          hint="Total ALLOW/THROTTLE/BLOCK decisions logged"
          loading={loading}
        />
        <MetricCard
          label="Throttle % (24h)"
          value={formatPct(data?.decisions.throttlePct)}
          hint={`${data?.decisions.throttleCount ?? 0} throttles`}
          loading={loading}
        />
        <MetricCard
          label="Block % (24h)"
          value={formatPct(data?.decisions.blockPct)}
          hint={`${data?.decisions.blockCount ?? 0} blocks`}
          loading={loading}
        />
        <MetricCard
          label="Open tickets"
          value={data?.tickets.openTickets ?? 0}
          hint={`${data?.tickets.breachedTickets ?? 0} breached`}
          loading={loading}
        />
      </div>

      {/* Usage leaderboard + API keys */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Usage per org (MTD)" />
          <CardBody>
            {loading && !data ? (
              <div className="text-sm text-ink-400">Loading…</div>
            ) : (
              <Table>
                <THead>
                  <th>Org</th>
                  <th>Plan</th>
                  <th className="text-right">MTD units</th>
                </THead>
                <TBody>
                  {data?.usageLeaderboard.map((r) => (
                    <tr key={r.org_id}>
                      <td className="text-sm">{r.org_name}</td>
                      <td className="text-xs text-ink-400">
                        {r.plan_tier ? (
                          r.plan_tier
                        ) : (
                          <span className="text-ink-500">unassigned</span>
                        )}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {r.mtd_units.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {data?.usageLeaderboard.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-sm text-ink-400 p-3">
                        No usage recorded yet.
                      </td>
                    </tr>
                  )}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Active API keys" />
          <CardBody>
            {loading && !data ? (
              <div className="text-sm text-ink-400">Loading…</div>
            ) : (
              <Table>
                <THead>
                  <th>Org</th>
                  <th className="text-right">Keys</th>
                </THead>
                <TBody>
                  {data?.apiKeys.map((k) => (
                    <tr key={k.org_id}>
                      <td className="text-sm">{k.org_name}</td>
                      <td className="text-right text-sm">{k.key_count}</td>
                    </tr>
                  ))}
                  {data?.apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-sm text-ink-400 p-3">
                        No active keys.
                      </td>
                    </tr>
                  )}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Abuse distribution */}
      {data?.abuse && (
        <Card>
          <CardHeader title="Abuse score distribution" />
          <CardBody>
            <div className="text-xs text-ink-400 mb-2">
              Buckets of <span className="font-mono">org_abuse_scores</span> showing how many orgs are
              clean vs under suspicion.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {data.abuse.buckets.map((b) => (
                <div
                  key={b.label}
                  className="border border-ink-800 rounded-lg p-3 flex flex-col gap-1"
                >
                  <div className="text-ink-500">Score {b.label}</div>
                  <div className="text-xl font-medium">{b.count}</div>
                  <div className="text-ink-500 mt-1">{renderAbuseHint(b.label)}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Grafana embed slot */}
      <Card>
        <CardHeader title="Grafana / Prometheus" />
        <CardBody>
          {grafanaUrl ? (
            <div className="h-72 border border-ink-800 rounded-xl2 overflow-hidden">
              <iframe
                src={grafanaUrl}
                className="w-full h-full"
                style={{ border: "none" }}
                title="Grafana dashboard"
              />
            </div>
          ) : (
            <div className="text-sm text-ink-400">
              Set <code className="font-mono">NEXT_PUBLIC_GRAFANA_DASH_URL</code> to embed your Grafana
              dashboard here (e.g. a panel showing <code>usage_throttle_total</code>,{" "}
              <code>usage_block_total</code>, request latency, etc.).
            </div>
          )}
        </CardBody>
      </Card>

      {err && <div className="text-xs text-red-400">{err}</div>}
    </div>
  );
}

function MetricCard(props: { label: string; value: number | string; hint?: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader title={props.label} />
      <CardBody>
        <div className="text-2xl font-medium">
          {props.loading && typeof props.value === "number" && props.value === 0 ? "…" : props.value}
        </div>
        {props.hint && <div className="text-xs text-ink-400 mt-1">{props.hint}</div>}
      </CardBody>
    </Card>
  );
}

function formatPct(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "0%";
  return `${v.toFixed(1)}%`;
}

function renderAbuseHint(label: string): string {
  switch (label) {
    case "0":
      return "No current abuse signal for these orgs.";
    case "0–3":
      return "Mild anomalies; keep an eye on them.";
    case "3–10":
      return "Repeated suspicious patterns; policy will start tightening.";
    case ">10":
      return "Persistent abuse; these orgs are heavily penalized.";
    default:
      return "Abuse score bucket.";
  }
}
