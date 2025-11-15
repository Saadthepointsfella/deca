"use client";

import { Card, CardHeader, CardBody } from "../../components/ui/Card";

export default function DocsPage() {
  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-sm font-semibold text-ink-50">
          API integration guide
        </h1>
        <p className="mt-1 text-[11px] text-ink-500 max-w-xl">
          Integrate the Control Plane into your backend to meter usage,
          enforce quotas, and make policy-driven decisions in real time.
          Today the system meters at org level, with reserved fields for
          future agent/model-level metering.
        </p>
      </div>

      {/* 1. API key */}
      <Card>
        <CardHeader
          title="1. Get an API key"
          description="Admin-only. Keys are scoped to an org and used by your gateway or backend services."
        />
        <CardBody>
          <ol className="space-y-2 text-[11px]">
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                Go to{" "}
                <a href="/settings/apikeys" className="underline">
                  Settings → API keys
                </a>{" "}
                and create a new key for your organization.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                Copy the generated key. It will look like{" "}
                <code className="font-mono text-[10px]">cp_xxxxxxxx</code>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                Store it securely in environment variables (never commit to
                version control).
              </span>
            </li>
          </ol>
        </CardBody>
      </Card>

      {/* 2. Usage check */}
      <Card>
        <CardHeader
          title="2. Check usage before serving requests"
          description='Call POST /api/usage/check before a billable operation to get "ALLOW", "THROTTLE", or "BLOCK".'
        />
        <CardBody>
          <p className="text-[11px] text-ink-400 mb-3">
            Typical flow: your gateway or backend service calls{" "}
            <code className="font-mono">/api/usage/check</code>, interprets
            the decision, and only then hits your model or core API.
          </p>

          <div className="bg-ink-950 border border-ink-800 rounded-lg p-3 text-[11px] font-mono overflow-x-auto">
            <pre>{`curl -X POST https://your-control-plane.com/api/usage/check \\
  -H "Authorization: Bearer cp_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "units": 1000,
    "endpoint": "chat-completion"

    // Reserved for future subject-level metering:
    // "subjectType": "ORG",   // default today
    // "subjectType": "AGENT",
    // "subjectType": "MODEL",
    // "subjectId": "agent_123"
  }'

# Response:
{
  "decision": "ALLOW",
  "delayMs": 0,
  "reason": "Within quota"
}`}</pre>
          </div>

          <ul className="mt-3 space-y-1.5 text-[11px] text-ink-400">
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">units</code>: normalized usage
                (tokens, credits, requests). This is what quotas apply to.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">endpoint</code>: label for the
                feature (e.g. <code className="font-mono">"chat"</code>,{" "}
                <code className="font-mono">"embedding"</code>). Used for
                analytics and future per-endpoint policies.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                <code className="font-mono">subjectType</code> /{" "}
                <code className="font-mono">subjectId</code>: reserved fields
                for future per-agent/model metering. Today, the system
                treats everything as{" "}
                <code className="font-mono">ORG</code>-level usage.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                If <code className="font-mono">decision === "THROTTLE"</code>,{" "}
                respect <code className="font-mono">delayMs</code> (sleep /
                backoff, or return a 429 with{" "}
                <code className="font-mono">Retry-After</code>).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-500">•</span>
              <span>
                If <code className="font-mono">decision === "BLOCK"</code>, do
                not perform the operation. Return a 4xx (e.g. 429/402) to
                the caller.
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>

      {/* 3. Sample integration */}
      <Card>
        <CardHeader
          title="3. Sample Node.js integration"
          description="A simple helper that checks usage before hitting your model or core API."
        />
        <CardBody>
          <div className="bg-ink-950 border border-ink-800 rounded-lg p-3 text-[11px] font-mono overflow-x-auto">
            <pre>{`// In your API route (e.g. Next.js API handler or Express middleware)
import fetch from "node-fetch";

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL; // e.g. https://your-cp.com
const CONTROL_PLANE_KEY = process.env.CONTROL_PLANE_KEY;

async function checkUsage(units: number, endpoint: string) {
  const res = await fetch(\`\${CONTROL_PLANE_URL}/api/usage/check\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${CONTROL_PLANE_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ units, endpoint }),
  });

  if (!res.ok) {
    throw new Error(\`Control plane error: \${res.status}\`);
  }

  return await res.json(); // { decision, delayMs, reason }
}

// Usage in your endpoint
export async function POST(req: Request) {
  const { prompt } = await req.json();
  const estimatedTokens = prompt.length * 1.3; // rough estimate

  const decision = await checkUsage(estimatedTokens, "chat-completion");

  if (decision.decision === "BLOCK") {
    return new Response("Quota exceeded", { status: 429 });
  }

  if (decision.decision === "THROTTLE") {
    return new Response("Rate limit", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((decision.delayMs ?? 0) / 1000)),
      },
    });
  }

  // Proceed with your model call
  const result = await callYourLLM(prompt);
  return new Response(JSON.stringify(result));
}`}</pre>
          </div>
        </CardBody>
      </Card>

      {/* 4. Policy preview */}
      <Card>
        <CardHeader
          title="4. Preview policy decisions"
          description="Simulate how the current policy would treat a hypothetical org and usage profile."
        />
        <CardBody>
          <p className="text-[11px] text-ink-400 mb-3">
            Use <code className="font-mono">POST /api/policy/preview</code>{" "}
            for what-if analysis and debugging when tuning the Mechanism
            Designer.
          </p>

          <div className="bg-ink-950 border border-ink-800 rounded-lg p-3 text-[11px] font-mono overflow-x-auto">
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

      {/* 5. OpenAPI & support */}
      <Card>
        <CardHeader
          title="OpenAPI & support"
          description="Export the API surface and find help when integrating."
        />
        <CardBody>
          <p className="text-[11px] text-ink-400 mb-2">
            If you expose an OpenAPI 3.0 spec from your deployment, the
            conventional path is:
          </p>
          <p className="text-[11px] text-ink-200 font-mono mb-3">
            GET /api/openapi.json
          </p>
          <p className="text-[11px] text-ink-400 mb-3">
            You can then use this to generate client SDKs or explore all
            endpoints in tools like Insomnia or Postman.
          </p>
          <p className="text-[11px] text-ink-400">
            For questions about integrating with the Control Plane, check the{" "}
            <a href="/support" className="underline">
              Support
            </a>{" "}
            section or your project&apos;s README / GitHub repo.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
