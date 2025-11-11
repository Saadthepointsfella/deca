"use client";

import { useState } from "react";
import { api } from "../../lib/apiClient";

type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export default function SupportPage() {
  const [orgId, setOrgId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  const [nextTicket, setNextTicket] = useState<any | null>(null);
  const [nextScore, setNextScore] = useState<number | null>(null);
  const [nextStatus, setNextStatus] = useState<string | null>(null);

  const handleCreateTicket = async () => {
    try {
      setCreateStatus("creating");
      await api.createTicket({
        orgId,
        subject,
        body,
        declaredPriority: priority
      });
      setCreateStatus("created");
      setSubject("");
      setBody("");
    } catch (err: any) {
      console.error(err);
      setCreateStatus(`error: ${err.message ?? "Failed"}`);
    }
  };

  const handleNextTicket = async () => {
    try {
      setNextStatus("loading");
      const res = await api.getNextTicket();
      setNextTicket(res.ticket);
      setNextScore(res.score);
      setNextStatus(null);
    } catch (err: any) {
      console.error(err);
      setNextStatus(`error: ${err.message ?? "Failed"}`);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">Create Ticket</h2>
        <div className="space-y-3 max-w-md">
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
            placeholder="Org ID (e.g. org_demo)"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          />
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
            placeholder="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <select
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button
            className="bg-blue-600 hover:bg-blue-500 text-sm px-4 py-2 rounded disabled:opacity-50"
            onClick={handleCreateTicket}
            disabled={!orgId || !subject || createStatus === "creating"}
          >
            {createStatus === "creating" ? "Creating..." : "Create ticket"}
          </button>
          {createStatus && (
            <p className="text-xs text-slate-400 mt-1">{createStatus}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Next Ticket</h2>
        <button
          className="bg-emerald-600 hover:bg-emerald-500 text-sm px-4 py-2 rounded disabled:opacity-50"
          onClick={handleNextTicket}
          disabled={nextStatus === "loading"}
        >
          {nextStatus === "loading" ? "Picking..." : "Get next ticket"}
        </button>
        {nextStatus && (
          <p className="text-xs text-slate-400 mt-2">{nextStatus}</p>
        )}

        {nextTicket && (
          <div className="mt-4 border border-slate-800 rounded p-4 text-sm">
            <p className="text-xs text-slate-400 mb-1">
              Ticket ID: <span className="font-mono">{nextTicket.id}</span>
            </p>
            <p className="font-medium mb-1">{nextTicket.subject}</p>
            <p className="text-slate-300 mb-2">{nextTicket.body}</p>
            <p className="text-xs text-slate-400">
              Org: <span className="font-mono">{nextTicket.org_id}</span>
            </p>
            <p className="text-xs text-slate-400">
              Status: {nextTicket.status} • Priority:{" "}
              {nextTicket.declared_priority}
            </p>
            {nextScore !== null && (
              <p className="text-xs text-slate-400 mt-1">
                Priority score: {nextScore}
              </p>
            )}
          </div>
        )}

        {!nextTicket && nextScore === null && !nextStatus && (
          <p className="mt-3 text-sm text-slate-400">
            No ticket selected yet. Click &ldquo;Get next ticket&rdquo;.
          </p>
        )}

        <p className="mt-4 text-xs text-slate-500">
          This exercises <code>GET /support/next</code> and the ticket priority
          policy.
        </p>
      </section>
    </div>
  );
}
