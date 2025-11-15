"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../lib/apiClient";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody } from "../../components/ui/Table";

type Metrics = {
  usage_last_24h: {
    per_tier: Record<
      string,
      {
        total: number;
        allow: number;
        throttle: number;
        block: number;
        throttlePct: number;
        blockPct: number;
      }
    >;
  };
  support: {
    by_tier: Record<
      string,
      {
        open: number;
        breachedOpen: number;
        breachedResolved24h?: number;
      }
    >;
  };
  policy_changes_last_24h: {
    by_role: Record<string, number>;
  };
  abuse: {
    top_orgs: {
      org_id: string;
      name: string;
      plan_tier: string;
      score: number;
    }[];
  };
};

const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_DASH_URL; // optional
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";

  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoStatusLoading, setDemoStatusLoading] = useState(false);

  // Derived aggregates
  const {
    totalDecisions,
    throttlePct,
    blockPct,
    openTickets,
    breachedOpen,
  } = computeAggregates(data);

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
  }, [canAdmin]);

  // Load metrics summary
  useEffect(() => {
    if (!canAdmin) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await api.getMetricsSummary();
        setData(res);
      } catch (e: any) {
        setErr(e.message ?? "Failed to load metrics");
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

      // Refresh metrics after seeding/clearing demo data
      const overview = await api.getMetricsSummary();
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
        <h2 className="text-sm font-semibold mb-2 text-ink-50">Forbidden</h2>
        <p className="text-xs text-ink-400">
          The operator console is only available to{" "}
          <span className="font-mono">OWNER</span> or{" "}
          <span className="font-mono">ADMIN</span> roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-semibold text-ink-50">Operator console</h1>
        <p className="text-[11px] text-ink-500 mt-1 max-w-xl">
          One-glance view of network health across usage decisions, SLAs, and
          abuse scores. All metrics are aggregated over the last 24 hours unless
          stated otherwise.
        </p>
      </div>

      {/* Demo mode controls */}
      {isDemoMode && (
        <Card>
          <CardHeader title="Demo mode" />
          <CardBody>
            <div className="flex items-start justify-between gap-4 text-xs">
              <div className="flex-1">
                <p className="text-ink-400 mb-2">
                  Seed or clear demo data (orgs, usage with spikes, and tickets)
                  to quickly showcase the console.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-ink-500">Status:</span>
                  {demoStatusLoading ? (
                    <span className="text-ink-400">Loading…</span>
                  ) : (
                    <span className={demoEnabled ? "text-emerald-400" : "text-ink-500"}>
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
                  <span className="ml-2 text-[11px] text-ink-400">
                    {demoEnabled ? "Disabling…" : "Enabling…"}
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
          value={totalDecisions}
          hint="Total ALLOW/THROTTLE/BLOCK"
          loading={loading}
        />
        <MetricCard
          label="Throttle % (24h)"
          value={formatPct(throttlePct)}
          hint="Share of requests throttled"
          loading={loading}
        />
        <MetricCard
          label="Block % (24h)"
          value={formatPct(blockPct)}
          hint="Share of requests blocked"
          loading={loading}
        />
        <MetricCard
          label="Open tickets"
          value={openTickets}
          hint={`${breachedOpen} past SLA`}
          loading={loading}
        />
      </div>

      {/* Usage decisions by tier */}
      <Card>
        <CardHeader
          title="Usage decisions by tier (24h)"
          description="Throttle and block rates for each plan tier."
        />
        <CardBody>
          {loading && !data ? (
            <div className="text-xs text-ink-400">Loading…</div>
          ) : !data ? (
            <div className="text-xs text-ink-400">
              No usage decisions recorded in the last 24 hours.
            </div>
          ) : (
            <Table>
              <THead>
                <th className="text-left text-xs">Tier</th>
                <th className="text-right text-xs">Decisions</th>
                <th className="text-right text-xs">Throttle %</th>
                <th className="text-right text-xs">Block %</th>
              </THead>
              <TBody>
                {Object.entries(data.usage_last_24h.per_tier).map(
                  ([tier, v]) => (
                    <tr key={tier}>
                      <td className="text-xs text-ink-100">{tier}</td>
                      <td className="text-right text-xs font-mono">
                        {v.total.toLocaleString()}
                      </td>
                      <td className="text-right text-xs text-ink-100">
                        {v.throttlePct.toFixed(1)}%
                      </td>
                      <td className="text-right text-xs text-ink-100">
                        {v.blockPct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Support health */}
      <Card>
        <CardHeader
          title="Support health"
          description="Open tickets and SLA breaches by tier."
        />
        <CardBody>
          {loading && !data ? (
            <div className="text-xs text-ink-400">Loading…</div>
          ) : !data ? (
            <div className="text-xs text-ink-400">
              No ticket data available yet.
            </div>
          ) : (
            <Table>
              <THead>
                <th className="text-left text-xs">Tier</th>
                <th className="text-right text-xs">Open</th>
                <th className="text-right text-xs">Open &gt; SLA</th>
                <th className="text-right text-xs">Breached resolved (24h)</th>
              </THead>
              <TBody>
                {Object.entries(data.support.by_tier).map(([tier, v]) => (
                  <tr key={tier}>
                    <td className="text-xs text-ink-100">{tier}</td>
                    <td className="text-right text-xs">{v.open}</td>
                    <td className="text-right text-xs">{v.breachedOpen}</td>
                    <td className="text-right text-xs">
                      {v.breachedResolved24h ?? 0}
                    </td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Top abuse orgs */}
      <Card>
        <CardHeader
          title="Top abuse scores"
          description="Orgs with the highest abuse scores; policy will automatically tighten for them."
        />
        <CardBody>
          {!data || data.abuse.top_orgs.length === 0 ? (
            <div className="text-xs text-ink-400">
              No orgs with recorded abuse scores yet.
            </div>
          ) : (
            <Table>
              <THead>
                <th className="text-left text-xs">Org</th>
                <th className="text-left text-xs">Plan</th>
                <th className="text-right text-xs">Abuse score</th>
              </THead>
              <TBody>
                {data.abuse.top_orgs.map((o) => (
                  <tr key={o.org_id}>
                    <td className="text-xs text-ink-100">{o.name}</td>
                    <td className="text-xs text-ink-400">{o.plan_tier}</td>
                    <td className="text-right text-xs text-ink-100">
                      {o.score.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Policy changes last 24h */}
      <Card>
        <CardHeader
          title="Policy changes (24h)"
          description="Who has been editing the mechanism config."
        />
        <CardBody>
          {!data || Object.keys(data.policy_changes_last_24h.by_role).length === 0 ? (
            <div className="text-xs text-ink-400">
              No policy changes recorded in the last 24 hours.
            </div>
          ) : (
            <Table>
              <THead>
                <th className="text-left text-xs">Role</th>
                <th className="text-right text-xs">Changes</th>
              </THead>
              <TBody>
                {Object.entries(data.policy_changes_last_24h.by_role).map(
                  ([role, count]) => (
                    <tr key={role}>
                      <td className="text-xs text-ink-100">{role}</td>
                      <td className="text-right text-xs">{count}</td>
                    </tr>
                  )
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Grafana embed slot */}
      <Card>
        <CardHeader title="Grafana / Prometheus" />
        <CardBody>
          {grafanaUrl ? (
            <div className="h-72 border border-ink-800 rounded-xl overflow-hidden">
              <iframe
                src={grafanaUrl}
                className="w-full h-full"
                style={{ border: "none" }}
                title="Grafana dashboard"
              />
            </div>
          ) : (
            <div className="text-xs text-ink-400">
              Set{" "}
              <code className="font-mono">NEXT_PUBLIC_GRAFANA_DASH_URL</code>{" "}
              to embed your Grafana dashboard here (for deeper metrics like
              latency, error rates, etc).
            </div>
          )}
        </CardBody>
      </Card>

      {err && (
        <div className="text-[11px] text-red-400 border border-red-900 rounded px-3 py-2 bg-red-950/40">
          {err}
        </div>
      )}
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: number | string;
  hint?: string;
  loading: boolean;
}) {
  const { label, value, hint, loading } = props;
  return (
    <Card>
      <CardHeader title={label} />
      <CardBody>
        <div className="text-xl font-medium">
          {loading && typeof value === "number" && value === 0 ? "…" : value}
        </div>
        {hint && (
          <div className="text-[11px] text-ink-400 mt-1">
            {hint}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function formatPct(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "0%";
  return `${v.toFixed(1)}%`;
}

function computeAggregates(data: Metrics | null) {
  if (!data) {
    return {
      totalDecisions: 0,
      throttlePct: 0,
      blockPct: 0,
      openTickets: 0,
      breachedOpen: 0,
    };
  }

  let totalDecisions = 0;
  let totalThrottle = 0;
  let totalBlock = 0;

  for (const tierStats of Object.values(data.usage_last_24h.per_tier)) {
    totalDecisions += tierStats.total;
    totalThrottle += tierStats.throttle;
    totalBlock += tierStats.block;
  }

  let openTickets = 0;
  let breachedOpen = 0;
  for (const v of Object.values(data.support.by_tier)) {
    openTickets += v.open;
    breachedOpen += v.breachedOpen;
  }

  const throttlePct =
    totalDecisions > 0 ? (totalThrottle / totalDecisions) * 100 : 0;
  const blockPct =
    totalDecisions > 0 ? (totalBlock / totalDecisions) * 100 : 0;

  return {
    totalDecisions,
    throttlePct,
    blockPct,
    openTickets,
    breachedOpen,
  };
}
