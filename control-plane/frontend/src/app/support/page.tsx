"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "../../lib/apiClient";

type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

type Ticket = {
  id: string;
  org_id: string;
  subject: string;
  body?: string | null;
  status: TicketStatus;
  declared_priority: TicketPriority;
  sla_deadline: string | null;
  created_at: string;
  abuse_flag: boolean;
};

export default function SupportPage() {
  const { data: session } = useSession();
  const role =
    (session as any)?.role ||
    ((session?.user as unknown as { role?: string })?.role ?? "VIEWER");
  const canAgent = role === "OWNER" || role === "ADMIN" || role === "AGENT";
  const canAdmin = role === "OWNER" || role === "ADMIN";

  // Create ticket form
  const [orgId, setOrgId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  // Next ticket & resolve
  const [nextTicket, setNextTicket] = useState<Ticket | null>(null);
  const [nextScore, setNextScore] = useState<number | null>(null);
  const [nextStatus, setNextStatus] = useState<string | null>(null);
  const [resolving, setResolving] = useState<boolean>(false);

  // Queue
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [sortKey, setSortKey] = useState<"sla" | "priority" | "created">("sla");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // ----- Actions -----

  const handleCreateTicket = async () => {
    try {
      setCreateStatus("creating");
      await api.createTicket({
        orgId,
        subject,
        body,
        declaredPriority: priority,
      });
      setCreateStatus("created");
      setSubject("");
      setBody("");
      await fetchTickets();
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

  const handleResolve = async () => {
    if (!nextTicket) return;
    try {
      setResolving(true);
      await api.updateTicketStatus(nextTicket.id, "RESOLVED");
      setNextTicket(null);
      setNextScore(null);
      await fetchTickets();
    } catch (err: any) {
      console.error(err);
      setNextStatus(`error: ${err.message ?? "Failed to resolve"}`);
    } finally {
      setResolving(false);
    }
  };

  // ----- Queue helpers -----

  const fetchTickets = async () => {
    setQueueLoading(true);
    try {
      const res = await api.listTickets({ status: "OPEN", limit: 200 });
      setTickets(res.tickets as Ticket[]);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const sortedTickets = useMemo(() => {
    const prRank = (p: TicketPriority) =>
      ({ URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[p]);
    return [...tickets].sort((a, b) => {
      if (sortKey === "created") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortKey === "priority") {
        return prRank(b.declared_priority) - prRank(a.declared_priority);
      }
      // SLA sort (soonest deadline first; nulls last)
      const A = a.sla_deadline ? new Date(a.sla_deadline).getTime() : Infinity;
      const B = b.sla_deadline ? new Date(b.sla_deadline).getTime() : Infinity;
      return A - B;
    });
  }, [tickets, sortKey]);

  const allSelected =
    sortedTickets.length > 0 &&
    sortedTickets.every((t) => selected[t.id] === true);

  const toggleOne = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      setSelected(
        Object.fromEntries(sortedTickets.map((t) => [t.id, true]) as any)
      );
    }
  };

  const bulkResolve = async () => {
    if (!canAgent) return;
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => api.updateTicketStatus(id, "RESOLVED")));
    setSelected({});
    await fetchTickets();
  };

  // ----- Render -----

  return (
    <div className="space-y-10">
      {/* Create Ticket */}
      <section className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800">
          <h2 className="text-sm font-medium tracking-wide">Create Ticket</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3 max-w-md">
            <input
              className="w-full bg-ink-900 border border-ink-700 rounded px-3 py-2 text-sm"
              placeholder="Org ID (e.g. org_demo)"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
            <input
              className="w-full bg-ink-900 border border-ink-700 rounded px-3 py-2 text-sm"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className="w-full bg-ink-900 border border-ink-700 rounded px-3 py-2 text-sm"
              placeholder="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <select
              className="bg-ink-900 border border-ink-700 rounded px-3 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <button
              className="bg-white text-black text-sm px-4 py-2 rounded hover:bg-ink-100 disabled:opacity-50"
              onClick={handleCreateTicket}
              disabled={!orgId || !subject || createStatus === "creating"}
            >
              {createStatus === "creating" ? "Creating..." : "Create ticket"}
            </button>
            {createStatus && (
              <p className="text-xs text-ink-400 mt-1">{createStatus}</p>
            )}
          </div>
        </div>
      </section>

      {/* Queue */}
      <section className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800">
          <h2 className="text-sm font-medium tracking-wide">Queue (OPEN)</h2>
          <div className="flex items-center gap-2">
            <select
              className="text-xs bg-ink-900 border border-ink-700 rounded px-2 py-1"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              title="Sort"
            >
              <option value="sla">Sort: SLA</option>
              <option value="priority">Sort: Priority</option>
              <option value="created">Sort: Oldest</option>
            </select>
            <button
              className="text-sm px-3 py-1.5 rounded border border-ink-600 hover:border-ink-400"
              onClick={fetchTickets}
            >
              Refresh
            </button>
            <button
              className="text-sm px-3 py-1.5 rounded bg-white text-black hover:bg-ink-100 disabled:opacity-50"
              onClick={bulkResolve}
              disabled={!canAgent}
              title={!canAgent ? "Requires AGENT role" : undefined}
            >
              Resolve selected
            </button>
          </div>
        </div>
        <div className="p-4">
          {queueLoading ? (
            <div className="text-sm text-ink-400">Loading…</div>
          ) : sortedTickets.length === 0 ? (
            <div className="text-sm text-ink-400">No open tickets.</div>
          ) : (
            <div className="overflow-x-auto border border-ink-800 rounded-xl2">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-900 text-ink-300">
                  <tr>
                    <th className="text-left px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="text-left px-3 py-2">Subject</th>
                    <th className="text-left px-3 py-2">Priority</th>
                    <th className="text-left px-3 py-2">SLA</th>
                    <th className="text-left px-3 py-2">Org</th>
                    <th className="text-left px-3 py-2">Abuse</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-ink-800">
                  {sortedTickets.map((t) => {
                    const atRisk =
                      t.sla_deadline &&
                      new Date(t.sla_deadline).getTime() < Date.now();
                    return (
                      <tr key={t.id} className="hover:bg-ink-900">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!selected[t.id]}
                            onChange={() => toggleOne(t.id)}
                          />
                        </td>
                        <td className="px-3 py-2 max-w-[420px] truncate">
                          {t.subject}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              t.declared_priority === "URGENT"
                                ? "bg-black text-white border border-ink-600"
                                : t.declared_priority === "HIGH"
                                ? "bg-ink-700 text-ink-100"
                                : t.declared_priority === "MEDIUM"
                                ? "bg-ink-800 text-ink-200"
                                : "bg-ink-900 text-ink-300"
                            }`}
                          >
                            {t.declared_priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {t.sla_deadline ? (
                            <span
                              className={atRisk ? "text-white" : "text-ink-400"}
                            >
                              {new Date(t.sla_deadline).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-ink-500">–</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-400">
                          {t.org_id}
                        </td>
                        <td className="px-3 py-2">
                          {t.abuse_flag ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-black text-white border border-ink-600">
                              flag
                            </span>
                          ) : (
                            <span className="text-ink-500">–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!canAgent && (
            <div className="text-xs text-ink-500 mt-2">
              Sign in as <b>AGENT</b> or higher to resolve.
            </div>
          )}
        </div>
      </section>

      {/* Next Ticket triage */}
      <section className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800">
          <h2 className="text-sm font-medium tracking-wide">Next Ticket</h2>
        </div>
        <div className="p-4">
          {!canAgent && (
            <p className="text-xs text-ink-500 mb-3">
              You need <span className="font-medium">AGENT</span> or higher to
              triage tickets.
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="bg-ink-900 text-white border border-ink-600 hover:border-ink-400 text-sm px-4 py-2 rounded disabled:opacity-50"
              onClick={handleNextTicket}
              disabled={!canAgent || nextStatus === "loading"}
              title={!canAgent ? "Requires AGENT role" : undefined}
            >
              {nextStatus === "loading" ? "Picking..." : "Get next ticket"}
            </button>

            {nextTicket && (
              <button
                className="bg-white text-black text-sm px-4 py-2 rounded hover:bg-ink-100 disabled:opacity-50"
                onClick={handleResolve}
                disabled={!canAgent || resolving}
                title={!canAgent ? "Requires AGENT role" : undefined}
              >
                {resolving ? "Resolving..." : "Resolve"}
              </button>
            )}
          </div>

          {nextStatus && (
            <p className="text-xs text-ink-400 mt-2">{nextStatus}</p>
          )}

          {nextTicket && (
            <div className="mt-4 border border-ink-800 rounded p-4 text-sm">
              <p className="text-xs text-ink-400 mb-1">
                Ticket ID: <span className="font-mono">{nextTicket.id}</span>
              </p>
              <p className="font-medium mb-1">{nextTicket.subject}</p>
              <p className="text-ink-200 mb-2">{nextTicket.body}</p>
              <p className="text-xs text-ink-400">
                Org: <span className="font-mono">{nextTicket.org_id}</span>
              </p>
              <p className="text-xs text-ink-400">
                Status: {nextTicket.status} • Priority:{" "}
                {nextTicket.declared_priority}
              </p>
              {nextScore !== null && (
                <p className="text-xs text-ink-400 mt-1">
                  Priority score: {nextScore}
                </p>
              )}
            </div>
          )}

          {!nextTicket && nextScore === null && !nextStatus && (
            <p className="mt-3 text-sm text-ink-400">
              No ticket selected yet. Click &ldquo;Get next ticket&rdquo;.
            </p>
          )}

          <p className="mt-4 text-xs text-ink-500">
            This exercises <code>GET /support/next</code> and the ticket
            priority policy. Resolving uses{" "}
            <code>PATCH /support/tickets/:id</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
