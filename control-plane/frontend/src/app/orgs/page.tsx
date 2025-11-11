"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";

type Org = { id: string; name: string; created_at: string };
type Plan = { id: string; tier: "FREE" | "PRO" | "ENTERPRISE"; name: string };

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [orgRes, planRes] = await Promise.all([
          api.getOrgs(),
          api.getPlans()
        ]);
        setOrgs(orgRes.orgs);
        setPlans(planRes.plans);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load orgs/plans");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const reloadOrgs = async () => {
    const orgRes = await api.getOrgs();
    setOrgs(orgRes.orgs);
  };

  const handleChangePlan = async (orgId: string, planId: string) => {
    try {
      setSavingOrgId(orgId);
      await api.changeOrgPlan(orgId, planId);
      await reloadOrgs();
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to change plan");
    } finally {
      setSavingOrgId(null);
    }
  };

  const handleCreateOrg = async () => {
    try {
      setSavingOrgId("new");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"}/orgs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newOrgName })
        }
      );
      if (!res.ok) throw new Error("Failed to create org");
      setNewOrgName("");
      await reloadOrgs();
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to create org");
    } finally {
      setSavingOrgId(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Organizations</h2>

      <div className="mb-6 flex gap-2 items-center">
        <input
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm flex-1"
          placeholder="New org name"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
        />
        <button
          className="bg-emerald-600 hover:bg-emerald-500 text-sm px-4 py-2 rounded disabled:opacity-50"
          disabled={!newOrgName.trim() || savingOrgId === "new"}
          onClick={handleCreateOrg}
        >
          {savingOrgId === "new" ? "Creating..." : "Create org"}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading...</p>}
      {error && (
        <p className="text-sm text-red-400 mb-3">
          Error: <span className="font-mono">{error}</span>
        </p>
      )}
      {!loading && orgs.length === 0 && (
        <p className="text-sm text-slate-400">No orgs yet.</p>
      )}

      {orgs.length > 0 && (
        <table className="min-w-full text-sm border border-slate-800">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left">Org</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{org.name}</td>
                <td className="px-3 py-2">
                  <select
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                    disabled={savingOrgId === org.id}
                    onChange={(e) => handleChangePlan(org.id, e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select plan
                    </option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.tier})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {savingOrgId === org.id && (
                    <span className="text-xs text-slate-400">Saving...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
