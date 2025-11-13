"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { GuidedWizard } from "./wizard";
import { AdvancedConsole } from "./advanced";

export default function PolicyPage() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;
  const canAdmin = role === "OWNER" || role === "ADMIN";
  const [mode, setMode] = useState<"guided" | "advanced">("guided");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Mechanism Designer</h2>
          <p className="text-xs text-ink-500">
            Configure usage limits, spike handling, and fairness. Guided mode is
            recommended; Advanced exposes the full JSON config.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink-400">Mode</span>
          <button
            className={`px-2 py-1 rounded ${
              mode === "guided"
                ? "bg-white text-black"
                : "border border-ink-700 text-ink-300"
            }`}
            onClick={() => setMode("guided")}
          >
            Guided
          </button>
          <button
            className={`px-2 py-1 rounded ${
              mode === "advanced"
                ? "bg-white text-black"
                : "border border-ink-700 text-ink-300"
            }`}
            onClick={() => setMode("advanced")}
          >
            Advanced
          </button>
        </div>
      </header>

      {mode === "guided" ? <GuidedWizard /> : <AdvancedConsole />}

      {!canAdmin && (
        <p className="text-xs text-ink-500">
          You can view the current policy, but only <span className="font-medium">OWNER</span> or{" "}
          <span className="font-medium">ADMIN</span> can save changes.
        </p>
      )}
    </div>
  );
}
