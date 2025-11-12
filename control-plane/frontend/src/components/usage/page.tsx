"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/apiClient";
import Button from "../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";

export default function UsagePage() {
  const [orgId, setOrgId] = useState("");
  const [units, setUnits] = useState<number>(100);
  const [endpoint, setEndpoint] = useState("completion");
  const [result, setResult] = useState<
    | { decision: string; delayMs: number; reason: string }
    | string
    | null
  >(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    try {
      setLoading(true);
      const res = await api.checkUsage({ orgId, units, endpoint });
      setResult(res);
    } catch (e: any) {
      setResult(`error: ${e.message ?? "Failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const dashboardHref = `/usage/${encodeURIComponent(orgId || "org_demo")}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader
          title={
            <div className="flex items-center justify-between w-full">
              <span>Usage check (manual)</span>
              <span className="text-xs text-ink-400">
                View org dashboard:{" "}
                <Link className="underline" href={dashboardHref}>
                  {dashboardHref}
                </Link>
              </span>
            </div>
          }
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="Org ID (e.g. org_demo)"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
            <input
              type="number"
              placeholder="Units"
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
            <input
              placeholder="Endpoint (e.g. completion)"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleCheck} disabled={!orgId || loading}>
              {loading ? "Checking…" : "Check usage"}
            </Button>
            <Link href={dashboardHref}>
              <Button variant="outline">Open org dashboard</Button>
            </Link>
          </div>

          {result && (
            <pre className="mt-4 text-xs bg-ink-900 border border-ink-800 rounded p-3 overflow-x-auto">
              {typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2)}
            </pre>
          )}

          <p className="mt-3 text-xs text-ink-500">
            This calls <code>POST /usage/check</code> on the backend and shows
            the policy decision (ALLOW/THROTTLE/BLOCK) and reason.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tips" />
        <CardBody>
          <ul className="text-sm text-ink-300 space-y-2">
            <li>
              Use <code>org_demo</code> if you seeded it.
            </li>
            <li>
              After checks, open the org dashboard to see daily series & recent
              decisions.
            </li>
            <li>
              For service-to-service calls, you’ll later use API keys on{" "}
              <code>/usage/check</code>.
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
