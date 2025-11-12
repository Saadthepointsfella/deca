"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/apiClient";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type DailyPoint = { date: string; units: number };
type Decision = { decision: string; delay_ms: number | null; reason: string; units: number; endpoint: string; created_at: string };

export default function UsageOrgPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [mtd, setMtd] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.getUsageOverview(String(orgId));
        setDaily(res.dailySeries);
        setMtd(res.monthToDate);
        setDecisions(res.decisions);
      } catch (e: any) {
        setErr(e.message ?? "Failed");
      } finally { setLoading(false); }
    })();
  }, [orgId]);

  return (
    <div className="space-y-6">
      <div className="text-xs text-ink-400">Org: <span className="text-ink-200">{String(orgId)}</span></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Daily usage (14d)" />
          <CardBody>
            {loading ? <div className="text-sm text-ink-400">Loading…</div> : (
              daily.length === 0 ? <div className="text-sm text-ink-400">No data.</div> :
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily}>
                    <XAxis dataKey="date" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", color: "#f5f5f5" }}/>
                    <Line type="monotone" dataKey="units" stroke="#ffffff" dot={false} strokeWidth={1.5}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Month to date" />
          <CardBody>
            <div className="text-3xl font-medium">{mtd.toLocaleString()}</div>
            <div className="text-xs text-ink-400 mt-1">normalized units</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent decisions" />
        <CardBody>
          {loading ? <div className="text-sm text-ink-400">Loading…</div> : decisions.length === 0 ?
            <div className="text-sm text-ink-400">No recent decisions.</div> :
            <ul className="space-y-2">
              {decisions.map((d, i) => (
                <li key={i} className="flex items-center justify-between border-b border-ink-800 pb-2">
                  <div className="flex items-center gap-3">
                    {d.decision === "ALLOW"   && <Badge tone="ok">ALLOW</Badge>}
                    {d.decision === "THROTTLE"&& <Badge tone="warn">THROTTLE</Badge>}
                    {d.decision === "BLOCK"   && <Badge tone="fail">BLOCK</Badge>}
                    <div className="text-sm">{d.reason}</div>
                  </div>
                  <div className="text-xs text-ink-400">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          }
        </CardBody>
      </Card>

      {err && <div className="text-xs text-red-400">{err}</div>}
    </div>
  );
}
