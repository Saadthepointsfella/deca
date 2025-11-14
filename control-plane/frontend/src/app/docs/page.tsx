"use client";

import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function DocsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">API Integration Guide</h1>
        <p className="text-sm text-ink-400">
          Integrate Control Plane into your backend to meter usage, enforce quotas, and make policy-driven
          decisions in real-time — at both org and agent level.
        </p>
      </div>

      {/* Getting started */}
      <Card>
        <CardHeader title="1. Get an API key" />
        <CardBody>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                Go to <a href="/settings/apikeys" className="underline">Settings → API Keys</a> and create a new key
                for your organization.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                Copy the generated key. It will look like <code className="font-mono text-xs">cp_xxxxxxxx</code>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>Store it securely in your environment variables (never commit to version control).</span>
            </li>
          </ol>
        </CardBody>
      </Card>

      {/* Usage check */}
      <Card>
        <CardHeader title="2. Check usage before serving requests" />
        <CardBody>
          <p className="text-sm text-ink-400 mb-3">
            Before processing a user request, call <code className="font-mono">POST /api/usage/check</code> to get a
            real-time decision: <code className="font-mono">ALLOW</code>, <code className="font-mono">THROTTLE</code>,
            or <code className="font-mono">BLOCK</code>.
          </p>

          <div className="bg-ink-950 border border-ink-800 rounded-lg p-4 text-xs font-mono overflow-x-auto">
            <pre>{`curl -X POST https://your-control-plane.com/api/usage/check \\
  -H "Authorization: Bearer cp_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "units": 1000,
    "endpoint": "chat-completion"

    // Optional: meter a specific subject
    // "subjectType": "ORG",           // default
    // "subjectType": "AGENT",
    // "subjectId": "agent_123"
  }'

# Response:
{
  "decision": "ALLOW",
  "delayMs": 0,
  "reason": "Within quota"
}`}</pre>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-ink-400">
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">units</code>: Normalized usage (e.g. tokens, API credits).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">endpoint</code>: Label for the feature/product (optional but recommended).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">subjectType</code>: What you’re metering —{" "}
                <code className="font-mono">"ORG"</code> (default),{" "}
                <code className="font-mono">"AGENT"</code>, or <code className="font-mono">"MODEL"</code>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">subjectId</code>: The id of the agent/model when{" "}
                <code className="font-mono">subjectType</code> is not <code className="font-mono">"ORG"</code>. For
                agents, this must be an ID created in the{" "}
                <a href="/agents" className="underline">Agents</a> page and belong to the same org as the API key.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                If <code className="font-mono">THROTTLE</code>, respect <code className="font-mono">delayMs</code>{" "}
                before retrying.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                If <code className="font-mono">BLOCK</code>, reject the request with a 429 or custom error.
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>

      {/* Agent-level metering */}
      <Card>
        <CardHeader title="2.1 Per-agent metering (optional)" />
        <CardBody>
          <p className="text-sm text-ink-400 mb-3">
            You can meter usage for individual business agents (e.g. "Billing assistant", "Support bot") under an org.
            This lets you see which agent is consuming how much quota, while still enforcing org-level limits.
          </p>

          <ol className="space-y-2 text-sm text-ink-400 mb-3">
            <li className="flex gap-2">
              <span className="text-ink-500">1.</span>
              <span>
                Go to <a href="/agents" className="underline">Agents</a>, pick an org, and create one or more agents.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">2.</span>
              <span>
                Use the returned <code className="font-mono">agent.id</code> as{" "}
                <code className="font-mono">subjectId</code> when calling{" "}
                <code className="font-mono">/api/usage/check</code> with{" "}
                <code className="font-mono">"subjectType": "AGENT"</code>.
              </span>
            </li>
          </ol>

          <div className="bg-ink-950 border border-ink-800 rounded-lg p-4 text-xs font-mono overflow-x-auto">
            <pre>{`// Example payload (org + agent metering)
{
  "units": 350,
  "endpoint": "chat-completion",
  "subjectType": "AGENT",
  "subjectId": "agent_123"
}

// This contributes to:
// - org-level usage (for quota / throttling decisions)
// - agent-level usage (for per-agent dashboards and analytics)`}</pre>
          </div>
        </CardBody>
      </Card>

      {/* Example integration */}
      <Card>
        <CardHeader title="3. Sample Node.js integration" />
        <CardBody>
          <div className="bg-ink-950 border border-ink-800 rounded-lg p-4 text-xs font-mono overflow-x-auto">
            <pre>{`// In your API route (e.g. Next.js API handler or Express middleware)
import fetch from 'node-fetch';

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL; // e.g. https://your-cp.com
const CONTROL_PLANE_KEY = process.env.CONTROL_PLANE_KEY;

type SubjectConfig =
  | { subjectType?: "ORG"; subjectId?: undefined }
  | { subjectType: "AGENT"; subjectId: string }
  | { subjectType: "MODEL"; subjectId: string };

async function checkUsage(units: number, endpoint: string, subject?: SubjectConfig) {
  const body: any = { units, endpoint };
  if (subject?.subjectType) {
    body.subjectType = subject.subjectType;
    body.subjectId = subject.subjectId;
  }

  const res = await fetch(\`\${CONTROL_PLANE_URL}/api/usage/check\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${CONTROL_PLANE_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(\`Control plane error: \${res.status}\`);
  }

  return await res.json();
}

// Usage in your endpoint
export async function POST(req: Request) {
  const { prompt, agentId } = await req.json();
  const estimatedTokens = prompt.length * 1.3; // rough estimate

  // If you pass agentId, we meter this request under that agent
  const decision = await checkUsage(estimatedTokens, 'chat-completion', agentId ? {
    subjectType: "AGENT",
    subjectId: agentId,
  } : undefined);

  if (decision.decision === 'BLOCK') {
    return new Response('Quota exceeded', { status: 429 });
  }

  if (decision.decision === 'THROTTLE') {
    // Optional: add a Retry-After header
    return new Response('Rate limit', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((decision.delayMs ?? 0) / 1000)) },
    });
  }

  // Proceed with request
  const result = await callYourLLM(prompt);
  return new Response(JSON.stringify(result));
}`}</pre>
          </div>
        </CardBody>
      </Card>

      {/* Policy preview */}
      <Card>
        <CardHeader title="4. Preview policy decisions (optional)" />
        <CardBody>
          <p className="text-sm text-ink-400 mb-3">
            Use <code className="font-mono">POST /api/policy/preview</code> to simulate how the current policy would
            treat a hypothetical org with given usage metrics. Useful for debugging or what-if analysis.
          </p>

          <div className="bg-ink-950 border border-ink-800 rounded-lg p-4 text-xs font-mono overflow-x-auto">
            <pre>{`curl -X POST https://your-control-plane.com/api/policy/preview \\
  -H "Authorization: Bearer cp_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orgId": "org_abc123",
    "daily": 50000,
    "monthly": 1000000,
    "spikeScore": 1.2
  }'

# Response:
{
  "decision": "ALLOW",
  "reason": "Within PRO tier quota",
  "planTier": "PRO"
}`}</pre>
          </div>
        </CardBody>
      </Card>

      {/* OpenAPI spec */}
      <Card>
        <CardHeader title="Full OpenAPI spec" />
        <CardBody>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-400">
              Download the complete OpenAPI 3.0 spec (including{" "}
              <code className="font-mono">subjectType</code> and{" "}
              <code className="font-mono">subjectId</code> fields) to auto-generate client SDKs or explore all endpoints.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">
                Download spec
              </a>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Support CTA */}
      <Card>
        <CardHeader title="Need help?" />
        <CardBody>
          <p className="text-sm text-ink-400">
            If you run into issues or have questions about integrating with Control Plane, reach out to us via the{" "}
            <a href="/support" className="underline">
              Support page
            </a>{" "}
            or consult the{" "}
            <a href="https://github.com/your-org/control-plane" className="underline">
              GitHub repository
            </a>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
