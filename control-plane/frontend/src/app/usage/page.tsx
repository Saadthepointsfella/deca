"use client";

import { useState } from "react";
import { api } from "../../lib/apiClient";

export default function UsagePage() {
  const [orgId, setOrgId] = useState("");
  const [units, setUnits] = useState(100);
  const [endpoint, setEndpoint] = useState("completion");
  const [result, setResult] = useState<
    { decision: string; delayMs: number; reason: string } | string | null
  >(null);

  const handleCheck = async () => {
    try {
      const res = await api.checkUsage({ orgId, units, endpoint });
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setResult(`error: ${err.message ?? "Failed"}`);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Usage Check (Kernel)</h2>
      <div className="space-y-3 max-w-md">
        <input
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
          placeholder="Org ID (e.g. org_demo)"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        />
        <input
          type="number"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
          placeholder="Units"
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
        />
        <input
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
          placeholder="Endpoint (e.g. completion)"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
        />
        <button
          className="bg-blue-600 hover:bg-blue-500 text-sm px-4 py-2 rounded disabled:opacity-50"
          disabled={!orgId}
          onClick={handleCheck}
        >
          Check usage
        </button>
      </div>
      {result && (
        <pre className="mt-4 text-xs bg-slate-900 border border-slate-800 rounded p-3 overflow-x-auto">
          {typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2)}
        </pre>
      )}
      <p className="mt-4 text-xs text-slate-500">
        This is exercising <code>POST /usage/check</code> and the policy layer
        in the backend.
      </p>
    </div>
  );
}
