"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../../lib/apiClient";
import Button from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Table, THead, TBody } from "../../../components/ui/Table";

type KeyRow = { id:string; name:string; secret_prefix:string; created_at:string; revoked_at:string|null };

export default function ApiKeysPage() {
  const { data: session } = useSession();
  const role = (session as any)?.role;
  const canAdmin = role === "OWNER" || role === "ADMIN";
  const defaultOrgId = (session as any)?.org_id || "";

  const [orgId, setOrgId] = useState(defaultOrgId);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null); // show once

  const load = async () => {
    if (!orgId) return;
    const res = await api.listApiKeys(orgId);
    setKeys(res.keys);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId]);

  const createKey = async () => {
    if (!canAdmin || !orgId || !newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createApiKey(orgId, newName.trim());
      setNewSecret(res.key.secret);
      setNewName("");
      await load();
    } finally { setCreating(false); }
  };

  const revoke = async (id: string) => {
    if (!canAdmin) return;
    await api.revokeApiKey(orgId, id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-400">
        Manage **org-scoped** API keys for server → server usage checks.
      </div>

      <Card>
        <CardHeader title="Create API key" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Org ID" value={orgId} onChange={e=>setOrgId(e.target.value)} />
            <input placeholder="Key name (e.g. prod-gateway)" value={newName} onChange={e=>setNewName(e.target.value)} />
            <Button onClick={createKey} disabled={!canAdmin || !orgId || !newName.trim() || creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
          {!canAdmin && <p className="text-xs text-ink-500 mt-2">ADMIN role required.</p>}

          {newSecret && (
            <div className="mt-4 text-xs">
              <div className="text-ink-300 mb-1">New secret (copy now; shown once):</div>
              <pre className="bg-ink-900 border border-ink-800 rounded p-3 overflow-x-auto">{newSecret}</pre>
              <div className="text-ink-500 mt-1">Use as <code>Authorization: Bearer {newSecret.slice(0, 6)}…</code></div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="API keys" />
        <CardBody>
          {!orgId ? (
            <div className="text-sm text-ink-400">Enter an org id.</div>
          ) : (
            <Table>
              <THead>
                <th>ID</th>
                <th>Name</th>
                <th>Prefix</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </THead>
              <TBody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td className="font-mono text-xs">{k.id}</td>
                    <td>{k.name}</td>
                    <td className="font-mono text-xs">{k.secret_prefix}</td>
                    <td className="text-xs text-ink-400">{new Date(k.created_at).toLocaleString()}</td>
                    <td className="text-xs">{k.revoked_at ? "revoked" : "active"}</td>
                    <td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => revoke(k.id)} disabled={!canAdmin || !!k.revoked_at}>
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr><td colSpan={6} className="text-sm text-ink-400 p-3">No keys yet.</td></tr>
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <div className="text-xs text-ink-500">
        Call <code>POST /usage/check</code> with <code>Authorization: Bearer &lt;api-key&gt;</code>.  
        The org is inferred from the key; the request body’s <code>orgId</code> is ignored.
      </div>
    </div>
  );
}
