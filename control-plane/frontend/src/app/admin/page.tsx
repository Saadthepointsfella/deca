"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../lib/apiClient";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody } from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";

type LeaderRow = { org_id:string; org_name:string; plan_tier:string|null; mtd_units:number };
type ApiKeyRow = { org_id:string; org_name:string; key_count:number };

type Overview = {
  usageLeaderboard: LeaderRow[];
  tickets: { openTickets:number; breachedTickets:number };
  decisions: { total:number; throttleCount:number; blockCount:number; throttlePct:number; blockPct:number };
  apiKeys: ApiKeyRow[];
};

const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_DASH_URL; // optional

export default function AdminPage() {
  const { data: session, status } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  if (status === "loading") {
    return <div className="text-sm text-ink-400">Checking session…</div>;
  }

  if (!canAdmin) {
    return (
      <div className="max-w-md">
        <h2 className="text-lg font-semibold mb-2">Forbidden</h2>
        <p className="text-sm text-ink-400">
          The admin dashboard is only available to <span className="font-mono">OWNER</span> or <span className="font-mono">ADMIN</span> roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-400">
        One-glance view of network health. Data is aggregated from usage, tickets, and API keys.
      </div>

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
                        {r.plan_tier ? r.plan_tier : <span className="text-ink-500">unassigned</span>}
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

function MetricCard(props: { label:string; value:number|string; hint?:string; loading:boolean }) {
  return (
    <Card>
      <CardHeader title={props.label} />
      <CardBody>
        <div className="text-2xl font-medium">
          {props.loading && typeof props.value === "number" && props.value === 0
            ? "…" : props.value}
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
