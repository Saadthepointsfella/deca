"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react"; // keep as-is for now if you're still using it
import { api } from "../../../lib/apiClient";
import Button from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Table, THead, TBody } from "../../../components/ui/Table";

type KeyRow = {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const ALL_SCOPES = ["usage:write", "policy:read", "admin:metrics"] as const;

export default function ApiKeysPage() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";
  const defaultOrgId = (session as any)?.org_id || "";

  const [orgId, setOrgId] = useState(defaultOrgId);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(["usage:write"]);
  const [newSecret, setNewSecret] = useState<string | null>(null); // show once
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError(null);
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api.listApiKeys(orgId);
      setKeys(res.keys as KeyRow[]);
    } catch (e: any) {
      setError(e.message ?? "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const toggleScope = (scope: string) => {
    setNewScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const createKey = async () => {
    if (!canAdmin || !orgId || !newName.trim() || newScopes.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.createApiKey(orgId, {
        name: newName.trim(),
        scopes: newScopes,
      });
      setNewSecret(res.secret); // returned once
      setNewName("");
      setNewScopes(["usage:write"]);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!canAdmin) return;
    setError(null);
    try {
      await api.revokeApiKey(orgId, id);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to revoke API key");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-400">
        Manage <span className="font-semibold">org-scoped</span> API keys for server → server usage checks.
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-700 rounded px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Create API key" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              placeholder="Org ID"
              value={orgId}
              onChange={e => setOrgId(e.target.value)}
              className="bg-ink-950 border border-ink-800 rounded px-2 py-1 text-xs"
            />
            <input
              placeholder="Key name (e.g. prod-gateway)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-ink-950 border border-ink-800 rounded px-2 py-1 text-xs"
            />
            <Button
              onClick={createKey}
              disabled={
                !canAdmin || !orgId || !newName.trim() || newScopes.length === 0 || creating
              }
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>

          <div className="mb-3">
            <div className="text-xs text-ink-400 mb-1">Scopes</div>
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map(scope => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`text-2xs px-2 py-1 rounded border ${
                    newScopes.includes(scope)
                      ? "border-white text-white"
                      : "border-ink-700 text-ink-400"
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>

          {!canAdmin && (
            <p className="text-xs text-ink-500 mt-2">
              <span className="font-semibold">ADMIN</span> or{" "}
              <span className="font-semibold">OWNER</span> role required to create keys.
            </p>
          )}

          {newSecret && (
            <div className="mt-4 text-xs">
              <div className="text-ink-300 mb-1">New secret (copy now; shown once):</div>
              <pre className="bg-ink-900 border border-ink-800 rounded p-3 overflow-x-auto">
                {newSecret}
              </pre>
              <div className="text-ink-500 mt-1">
                Use as{" "}
                <code>
                  Authorization: Bearer {newSecret.slice(0, 6)}
                  …
                </code>
                . Store it in your secrets manager; it won&apos;t be visible again.
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="API keys" />
        <CardBody>
          {!orgId ? (
            <div className="text-sm text-ink-400">Enter an org id.</div>
          ) : loading ? (
            <div className="text-sm text-ink-400">Loading…</div>
          ) : (
            <Table>
              <THead>
                <th>ID</th>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Created</th>
                <th>Last used</th>
                <th>Status</th>
                <th></th>
              </THead>
              <TBody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td className="font-mono text-xs">{k.id}</td>
                    <td>{k.name}</td>
                    <td className="font-mono text-xs">{k.prefix}</td>
                    <td className="text-2xs">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map(scope => (
                          <span
                            key={scope}
                            className="border border-ink-800 rounded px-1.5 py-0.5 text-ink-400"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-xs text-ink-400">
                      {new Date(k.createdAt).toLocaleString()}
                    </td>
                    <td className="text-xs text-ink-400">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                    </td>
                    <td className="text-xs">
                      {k.revokedAt ? (
                        <span className="text-red-400">revoked</span>
                      ) : (
                        "active"
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revoke(k.id)}
                        disabled={!canAdmin || !!k.revokedAt}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-sm text-ink-400 p-3">
                      No keys yet.
                    </td>
                  </tr>
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <div className="text-xs text-ink-500">
        Call <code>POST /usage/check</code> with{" "}
        <code>Authorization: Bearer &lt;api-key&gt;</code>. The org is inferred from the key;
        any <code>orgId</code> in the request body is ignored.
      </div>
    </div>
  );
}
