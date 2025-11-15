// frontend/src/lib/apiClient.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

/**
 * Get the backend JWT from the NextAuth session.
 * - On the server: uses no-op (we only fetch from client in this setup)
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

    // Auto-redirect to login on 401 (expired/invalid token)
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      throw new Error("Session expired - redirecting to login");
    }

    throw new Error(
      `API ${path} failed: ${res.status} ${res.statusText} ${text}`
    );
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

// Shared type for policy config — now using PolicyConfigV2 shape from backend.
// We keep it loose on the frontend and let the backend be the source of truth.
type PolicyConfigDTO = any;

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
  checkUsage: (payload: {
    orgId: string;
    units: number;
    endpoint: string;
  }) =>
    request<{
      decision: "ALLOW" | "THROTTLE" | "BLOCK";
      delayMs: number;
      reason: string;
    }>("/usage/check", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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
    request<{ tickets: any[] }>(`/support/tickets${qs(opts)}`),

  updateTicketStatus: (
    id: string,
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
  ) =>
    request<{ ok: true }>(`/support/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // -------- API Keys (ADMIN+) --------
  listApiKeys: (orgId: string) =>
    request<{
      keys: Array<{
        id: string;
        name: string;
        secret_prefix: string;
        created_at: string;
        revoked_at: string | null;
      }>;
    }>(`/api-keys${qs({ orgId })}`),

  createApiKey: (orgId: string, name: string) =>
    request<{
      key: {
        id: string;
        org_id: string;
        name: string;
        secret: string;
        secret_prefix: string;
        created_at: string;
      };
      note: string;
    }>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ orgId, name }),
    }),

  revokeApiKey: (orgId: string, id: string) =>
    request<{ ok: true }>("/api-keys/revoke", {
      method: "POST",
      body: JSON.stringify({ orgId, id }),
    }),

  // -------- Policy Configurator (Mechanism Design) --------
  getPolicyConfig: () =>
    request<{ config: PolicyConfigDTO }>("/policy/config"),

  putPolicyConfig: (config: PolicyConfigDTO) =>
    request<{ ok: true }>("/policy/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  previewPolicy: (payload: {
    orgId: string;
    daily: number;
    monthly: number;
    spikeScore: number;
  }) =>
    request<{
      decision: "ALLOW" | "THROTTLE" | "BLOCK";
      reason: string;
      planTier: "FREE" | "PRO" | "ENTERPRISE";
      cfg: PolicyConfigDTO;
    }>("/policy/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // -------- Metrics / Operator console --------
  getMetricsSummary: () =>
    request<{
      usage_last_24h: {
        per_tier: Record<
          string,
          {
            total: number;
            allow: number;
            throttle: number;
            block: number;
            throttlePct: number;
            blockPct: number;
          }
        >;
      };
      support: {
        by_tier: Record<
          string,
          {
            open: number;
            breachedOpen: number;
            breachedResolved24h?: number;
          }
        >;
      };
      policy_changes_last_24h: {
        by_role: Record<string, number>;
      };
      abuse: {
        top_orgs: {
          org_id: string;
          name: string;
          plan_tier: string;
          score: number;
        }[];
      };
    }>("/metrics/summary"),

  // -------- Admin (OWNER/ADMIN) --------
  // (Legacy overview; can keep if your backend still serves it)
  getAdminOverview: () =>
    request<{
      usageLeaderboard: {
        org_id: string;
        org_name: string;
        plan_tier: string | null;
        mtd_units: number;
      }[];
      tickets: {
        openTickets: number;
        breachedTickets: number;
      };
      decisions: {
        total: number;
        throttleCount: number;
        blockCount: number;
        throttlePct: number;
        blockPct: number;
      };
      apiKeys: {
        org_id: string;
        org_name: string;
        key_count: number;
      }[];
    }>("/admin/overview"),

  // -------- Agents (V2 shape) --------
  listAgents: (orgId: string) =>
    request<{
      agents: {
        id: string;
        name: string;
        description: string | null;
        model_key: string | null;
      }[];
    }>(`/agents?orgId=${encodeURIComponent(orgId)}`),

  createAgent: (payload: {
    orgId: string;
    name: string;
    description?: string;
    modelKey?: string;
  }) =>
    request<{ agent: { id: string } }>(`/agents`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // -------- Demo Mode (ADMIN only) --------
  getDemoStatus: () =>
    request<{ enabled: boolean }>("/demo/status"),

  enableDemo: () =>
    request<{ success: true; message: string }>("/demo/enable", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  disableDemo: () =>
    request<{ success: true; message: string }>("/demo/disable", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
