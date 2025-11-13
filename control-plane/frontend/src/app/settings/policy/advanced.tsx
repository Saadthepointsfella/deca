"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../../lib/apiClient";
import Button from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";

export function AdvancedConsole() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";

  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api.getPolicyConfig();
      setRaw(JSON.stringify(res.config, null, 2));
    })();
  }, []);

  const save = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(raw);
      setSaving(true);
      await api.putPolicyConfig(parsed);
    } catch (e: any) {
      setError(e.message ?? "Invalid JSON or save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Advanced console"
        aside={
          <Button onClick={save} disabled={!canAdmin || saving}>
            {saving ? "Saving…" : "Save JSON"}
          </Button>
        }
      />
      <CardBody>
        <p className="text-xs text-ink-500 mb-2">
          Full raw policy JSON. Use carefully; no guardrails yet.
        </p>
        <textarea
          className="w-full h-96 text-xs font-mono bg-ink-950 border border-ink-800 rounded p-3"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {!canAdmin && (
          <p className="mt-2 text-xs text-ink-500">
            ADMIN or OWNER role required to save changes.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
