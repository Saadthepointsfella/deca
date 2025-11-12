// frontend/src/lib/apiClient.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

/**
 * Get the backend JWT from the NextAuth session.
 * - On the server: uses getServerSession()
 * - On the client: calls /api/auth/session
 */
async function getBackendToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    // Server - skip server-side session check to avoid config issues
    // Pages will be client-side rendered with session
    return null;
  } else {
    // Client
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    // next-auth returns { user, expires, ... }; we also forwarded backendToken in the session callback
    return (data as any)?.backendToken ?? (data as any)?.user?.backendToken ?? null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getBackendToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }

  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const api = {
  // -------- Orgs / Plans --------
  getOrgs: () =>
    request<{
      orgs: Array<{
        id: string;
        name: string;
        created_at: string;
        plan_id?: string | null;
        plan_tier?: "FREE" | "PRO" | "ENTERPRISE" | null;
      }>;
    }>("/orgs"),

  getPlans: () =>
    request<{
      plans: Array<{
        id: string;
        tier: "FREE" | "PRO" | "ENTERPRISE";
        name: string;
        daily_quota_units?: number;
        monthly_quota_units?: number;
        support_sla_minutes?: number;
      }>;
    }>("/plans"),

  changeOrgPlan: (orgId: string, planId: string) =>
    request<{ orgPlan: { org_id: string; plan_id: string } }>(
      `/orgs/${orgId}/plan`,
      {
        method: "PATCH",
        body: JSON.stringify({ planId }),
      }
    ),

  // -------- Usage --------
  checkUsage: (payload: { orgId: string; units: number; endpoint: string }) =>
    request<{ decision: "ALLOW" | "THROTTLE" | "BLOCK"; delayMs: number; reason: string }>(
      "/usage/check",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getUsageOverview: (orgId: string) =>
    request<{
      dailySeries: Array<{ date: string; units: number }>;
      monthToDate: number;
      decisions: Array<{
        decision: "ALLOW" | "THROTTLE" | "BLOCK";
        delay_ms: number | null;
        reason: string;
        units: number;
        endpoint: string;
        created_at: string;
      }>;
    }>(`/usage/overview${qs({ orgId })}`),

  // -------- Support / Tickets --------
  createTicket: (payload: {
    orgId: string;
    subject: string;
    body?: string;
    declaredPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }) =>
    request<{ ticket: any }>("/support/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getNextTicket: () =>
    request<{
      ticket: any | null;
      score: number | null;
      explanation?: any;
    }>("/support/next"),

  listTickets: (opts: {
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    orgId?: string;
    limit?: number;
  } = {}) =>
    request<{ tickets: any[] }>(
      `/support/tickets${qs(opts)}`
    ),

  updateTicketStatus: (id: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") =>
    request<{ ok: true }>(`/support/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
