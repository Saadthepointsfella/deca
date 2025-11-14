"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/apiClient";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DailyPoint = { date: string; units: number };

type Decision = {
  decision: string;
  delay_ms: number | null;
  reason: string;
  units: number;
  endpoint: string | null;
  subject_type: "ORG" | "AGENT" | "MODEL" | null;
  subject_id: string | null;
  created_at: string;
};

type DecisionFilter = "ALL" | "ORG" | "AGENT";

export default function UsageOrgPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [mtd, setMtd] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<DecisionFilter>("ALL");

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
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const filteredDecisions = useMemo(() => {
    if (filter === "ALL") return decisions;
    if (filter === "AGENT") {
      return decisions.filter((d) => d.subject_type === "AGENT");
    }
    if (filter === "ORG") {
      return decisions.filter((d) => d.subject_type !== "AGENT");
    }
    return decisions;
  }, [filter, decisions]);

  return (
    <div className="space-y-6">
      <div className="text-xs text-ink-400">
        Org: <span className="text-ink-200">{String(orgId)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Daily usage (14d)" />
          <CardBody>
            {loading ? (
              <div className="text-sm text-ink-400">Loading…</div>
            ) : daily.length === 0 ? (
              <div className="text-sm text-ink-400">No data.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#a3a3a3", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#a3a3a3", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0a0a0a",
                        border: "1px solid #262626",
                        color: "#f5f5f5",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="units"
                      stroke="#ffffff"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Month to date" />
          <CardBody>
            <div className="text-3xl font-medium">
              {mtd.toLocaleString()}
            </div>
            <div className="text-xs text-ink-400 mt-1">normalized units</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent decisions"
          aside={
            <div className="flex items-center gap-2 text-2xs text-ink-500">
              <span>Filter:</span>
              <button
                className={`px-2 py-1 rounded ${
                  filter === "ALL"
                    ? "bg-white text-black"
                    : "border border-ink-700"
                }`}
                onClick={() => setFilter("ALL")}
              >
                All
              </button>
              <button
                className={`px-2 py-1 rounded ${
                  filter === "ORG"
                    ? "bg-white text-black"
                    : "border border-ink-700"
                }`}
                onClick={() => setFilter("ORG")}
              >
                Org
              </button>
              <button
                className={`px-2 py-1 rounded ${
                  filter === "AGENT"
                    ? "bg-white text-black"
                    : "border border-ink-700"
                }`}
                onClick={() => setFilter("AGENT")}
              >
                Agents
              </button>
            </div>
          }
        />
        <CardBody>
          {loading ? (
            <div className="text-sm text-ink-400">Loading…</div>
          ) : filteredDecisions.length === 0 ? (
            <div className="text-sm text-ink-400">No recent decisions.</div>
          ) : (
            <ul className="space-y-2">
              {filteredDecisions.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between border-b border-ink-800 pb-2"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {d.decision === "ALLOW" && (
                        <Badge tone="ok">ALLOW</Badge>
                      )}
                      {d.decision === "THROTTLE" && (
                        <Badge tone="warn">THROTTLE</Badge>
                      )}
                      {d.decision === "BLOCK" && (
                        <Badge tone="fail">BLOCK</Badge>
                      )}

                      {/* subject info */}
                      {d.subject_type === "AGENT" ? (
                        <span className="text-2xs px-2 py-0.5 rounded border border-ink-700">
                          AGENT ·{" "}
                          <span className="font-mono">
                            {truncateId(d.subject_id)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-2xs px-2 py-0.5 rounded border border-ink-900 text-ink-500">
                          ORG-level
                        </span>
                      )}
                    </div>

                    <div className="text-sm">{d.reason}</div>

                    <div className="text-2xs text-ink-500 flex gap-3">
                      <span>
                        units:{" "}
                        <span className="font-mono">
                          {d.units.toLocaleString()}
                        </span>
                      </span>
                      {d.endpoint && (
                        <span>
                          endpoint:{" "}
                          <span className="font-mono">{d.endpoint}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-ink-400 ml-4 whitespace-nowrap">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {err && <div className="text-xs text-red-400">{err}</div>}
    </div>
  );
}

function truncateId(id: string | null): string {
  if (!id) return "unknown";
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
