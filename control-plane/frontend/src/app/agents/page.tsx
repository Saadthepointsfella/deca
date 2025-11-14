"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../lib/apiClient";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import Button from "../../components/ui/Button";

type Agent = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  model_key: string | null;
  created_at?: string;
};

export default function AgentsPage() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";

  const [orgId, setOrgId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newModel, setNewModel] = useState("");

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api.listAgents(orgId);
      setAgents(res.agents);
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    if (!orgId || !newName) return;
    setCreating(true);
    try {
      await api.createAgent({
        orgId,
        name: newName,
        description: newDesc || undefined,
        modelKey: newModel || undefined,
      });
      setNewName("");
      setNewDesc("");
      setNewModel("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-medium">Agents</h1>
          <p className="text-xs text-ink-500">
            Business-facing agents that can be metered separately from their org.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader title="Org selection" />
        <CardBody>
          <div className="flex flex-col md:flex-row gap-3 text-xs">
            <div className="flex-1">
              <input
                className="w-full bg-ink-950 border border-ink-800 rounded px-2 py-1"
                placeholder="Org ID"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={!orgId || loading}>
              {loading ? "Loading…" : "Load agents"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {orgId && (
        <Card>
          <CardHeader title="Agents in org" />
          <CardBody>
            {agents.length === 0 ? (
              <p className="text-xs text-ink-500">No agents yet for this org.</p>
            ) : (
              <div className="text-xs border border-ink-800 rounded-lg divide-y divide-ink-800">
                {agents.map((a) => (
                  <div key={a.id} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.name}</div>
                      {a.description && (
                        <div className="text-ink-500">{a.description}</div>
                      )}
                      {a.model_key && (
                        <div className="text-ink-500 text-[10px] mt-0.5">
                          Model: {a.model_key}
                        </div>
                      )}
                    </div>
                    <div className="text-2xs font-mono text-ink-500">
                      {a.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canAdmin && orgId && (
        <Card>
          <CardHeader title="Create agent" />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block mb-1 text-ink-500">Name</label>
                <input
                  className="w-full bg-ink-950 border border-ink-800 rounded px-2 py-1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Billing assistant"
                />
              </div>
              <div>
                <label className="block mb-1 text-ink-500">Model key (optional)</label>
                <input
                  className="w-full bg-ink-950 border border-ink-800 rounded px-2 py-1"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                />
              </div>
              <div>
                <label className="block mb-1 text-ink-500">Description</label>
                <input
                  className="w-full bg-ink-950 border border-ink-800 rounded px-2 py-1"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Short description"
                />
              </div>
            </div>
            <div className="mt-3">
              <Button size="sm" onClick={create} disabled={creating || !newName}>
                {creating ? "Creating…" : "Create agent"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
