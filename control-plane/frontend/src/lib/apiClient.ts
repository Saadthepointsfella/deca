// frontend/src/lib/apiClient.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API ${path} failed: ${res.status} ${res.statusText} ${text}`
    );
  }

  return (await res.json()) as T;
}

export const api = {
  getOrgs: () =>
    request<{ orgs: Array<{ id: string; name: string; created_at: string }> }>(
      "/orgs"
    ),

  getPlans: () =>
    request<{
      plans: Array<{
        id: string;
        tier: "FREE" | "PRO" | "ENTERPRISE";
        name: string;
      }>;
    }>("/plans"),

  changeOrgPlan: (orgId: string, planId: string) =>
    request<{ orgPlan: { org_id: string; plan_id: string } }>(
      `/orgs/${orgId}/plan`,
      {
        method: "PATCH",
        body: JSON.stringify({ planId })
      }
    ),

  checkUsage: (payload: { orgId: string; units: number; endpoint: string }) =>
    request<{ decision: string; delayMs: number; reason: string }>(
      "/usage/check",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    ),

  createTicket: (payload: {
    orgId: string;
    subject: string;
    body?: string;
    declaredPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }) =>
    request<{ ticket: any }>("/support/tickets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getNextTicket: () =>
    request<{
      ticket: any | null;
      score: number | null;
      explanation?: any;
    }>("/support/next")
};
