"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../lib/apiClient";

type Org = {
  id: string;
  name: string;
  created_at: string;
  plan_id?: string | null;
  plan_tier?: "FREE" | "PRO" | "ENTERPRISE" | null;
};

type Plan = { id: string; tier: "FREE" | "PRO" | "ENTERPRISE"; name: string };

export default function OrgsPage() {
  const { data: session, status } = useSession();
  const role = (session as any)?.role as "OWNER" | "ADMIN" | "AGENT" | "VIEWER" | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";
  const backendToken =
    (session as any)?.backendToken ??
    (session as any)?.user?.backendToken ??
    null;

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");

  const authHeaders = useMemo(
    () =>
      backendToken
        ? { Authorization: `Bearer ${backendToken}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" },
    [backendToken]
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [orgRes, planRes] = await Promise.all([api.getOrgs(), api.getPlans()]);
        setOrgs(orgRes.orgs as Org[]);
        setPlans(planRes.plans as Plan[]);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load orgs/plans");
      } finally {
        setLoading(false);
      }
    }
    // Only fetch once session is known (so apiClient can attach bearer)
    if (status !== "loading") void load();
  }, [status]);

  const reloadOrgs = async () => {
    const orgRes = await api.getOrgs();
    setOrgs(orgRes.orgs as Org[]);
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
          headers: authHeaders,
          body: JSON.stringify({ name: newOrgName }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to create org");
      }
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

      {/* Role banner */}
      <div className="mb-4 text-xs text-slate-400">
        Signed in as <span className="font-mono">{session?.user?.email ?? "unknown"}</span>
        {role ? <> • role: <span className="font-mono">{role}</span></> : null}
      </div>

      {/* Create org (ADMIN/OWNER only) */}
      <div className="mb-6 flex gap-2 items-center">
        <input
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm flex-1"
          placeholder="New org name"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          disabled={!canAdmin}
        />
        <button
          className="bg-emerald-600 hover:bg-emerald-500 text-sm px-4 py-2 rounded disabled:opacity-50"
          disabled={!canAdmin || !newOrgName.trim() || savingOrgId === "new"}
          onClick={handleCreateOrg}
        >
          {savingOrgId === "new" ? "Creating..." : "Create org"}
        </button>
      </div>
      {!canAdmin && (
        <p className="text-xs text-slate-500 -mt-4 mb-6">
          You need <span className="font-mono">ADMIN</span> (or <span className="font-mono">OWNER</span>) to create orgs or change plans.
        </p>
      )}

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
              <th className="px-3 py-2 text-left">Current plan</th>
              <th className="px-3 py-2 text-left">Change plan</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{org.name}</td>
                <td className="px-3 py-2">
                  {org.plan_id ? (
                    <span className="text-slate-300">
                      {plans.find((p) => p.id === org.plan_id)?.name ?? org.plan_id}
                      {org.plan_tier ? (
                        <span className="text-slate-500"> ({org.plan_tier})</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-slate-500">None</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                    disabled={savingOrgId === org.id || !canAdmin}
                    onChange={(e) => handleChangePlan(org.id, e.target.value)}
                    value={org.plan_id ?? ""}
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
                  {savingOrgId === org.id && (
                    <span className="ml-2 text-xs text-slate-400">Saving...</span>
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
