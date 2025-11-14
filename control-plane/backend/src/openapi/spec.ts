// backend/src/openapi/spec.ts

export const openapiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Control Plane API",
    version: "0.1.0",
    description:
      "Usage-based control plane for SaaS/API products. Meter usage, enforce quotas, and inspect policy behavior.",
  },
  servers: [
    {
      url: "/api",
      description: "Default API prefix",
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "APIKey",
        description:
          "Use an org-scoped API key: `Authorization: Bearer cp_xxx`.",
      },
    },
    schemas: {
      UsageDecision: {
        type: "string",
        enum: ["ALLOW", "THROTTLE", "BLOCK"],
      },
      UsageCheckRequest: {
        type: "object",
        properties: {
          orgId: {
            type: "string",
            nullable: true,
            description:
              "Optional. If omitted, org is inferred from the API key.",
          },
          units: {
            type: "number",
            description:
              "Normalized usage units for this request (e.g. tokens, credits).",
          },
          endpoint: {
            type: "string",
            nullable: true,
            description: "Label for the endpoint or product feature.",
          },
         subjectType: {
  type: "string",
  nullable: true,
  enum: ["ORG", "AGENT", "MODEL"],
  description:
    "What is being metered. ORG = default (whole org); AGENT = business agent; MODEL = specific model.",
},
subjectId: {
  type: "string",
  nullable: true,
  description:
    "When subjectType=AGENT or MODEL, the ID of that agent/model. For AGENT, must belong to the org bound to the API key.",
},
        },
        required: ["units"],
      },
      UsageCheckResponse: {
        type: "object",
        properties: {
          decision: { $ref: "#/components/schemas/UsageDecision" },
          delayMs: {
            type: "integer",
            nullable: true,
            description:
              "Suggested delay in milliseconds before retry when THROTTLED.",
          },
          reason: {
            type: "string",
            description: "Human-readable explanation of the decision.",
          },
        },
        required: ["decision", "reason"],
      },
      PolicyPreviewRequest: {
        type: "object",
        properties: {
          orgId: {
            type: "string",
            description: "Org to simulate against (plan will be loaded).",
          },
          daily: {
            type: "number",
            description: "Hypothetical daily usage units.",
          },
          monthly: {
            type: "number",
            description: "Hypothetical monthly usage units.",
          },
          spikeScore: {
            type: "number",
            description:
              "Hypothetical spike score (e.g. current hour / baseline hour).",
          },
        },
        required: ["orgId", "daily", "monthly", "spikeScore"],
      },
      PolicyPreviewResponse: {
        type: "object",
        properties: {
          decision: { $ref: "#/components/schemas/UsageDecision" },
          reason: { type: "string" },
          planTier: {
            type: "string",
            description: "Tier of the org's current plan (FREE/PRO/ENTERPRISE).",
          },
        },
        required: ["decision", "reason", "planTier"],
      },
      AdminMetricsSummary: {
        type: "object",
        properties: {
          windowHours: { type: "integer" },
          usage: {
            type: "object",
            properties: {
              total: { type: "integer" },
              byDecision: {
                type: "object",
                properties: {
                  ALLOW: { type: "integer" },
                  THROTTLE: { type: "integer" },
                  BLOCK: { type: "integer" },
                },
              },
              percentages: {
                type: "object",
                properties: {
                  ALLOW: { type: "number" },
                  THROTTLE: { type: "number" },
                  BLOCK: { type: "number" },
                },
              },
            },
          },
          support: {
            type: "object",
            properties: {
              openCount: { type: "integer" },
              breachedCount: { type: "integer" },
            },
          },
          abuse: {
            type: "object",
            properties: {
              buckets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  paths: {
    "/usage/check": {
      post: {
        tags: ["Usage"],
        summary: "Check whether a request should be allowed, throttled, or blocked.",
      description:
  "Main integration point. Call this from your API gateway or backend before processing a user request. Supports per-org and per-agent metering via subjectType/subjectId.",

        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UsageCheckRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Decision computed successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UsageCheckResponse" },
              },
            },
          },
          "401": { description: "Unauthorized (missing or invalid API key)." },
          "429": { description: "Control plane itself is rate-limiting you." },
        },
      },
    },
    "/policy/preview": {
      post: {
        tags: ["Policy"],
        summary: "Preview a usage decision under current policy.",
        description:
          "Simulate how the current policy would treat a hypothetical org with given daily/monthly usage and spike score.",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PolicyPreviewRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Preview decision computed successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PolicyPreviewResponse" },
              },
            },
          },
          "401": { description: "Unauthorized." },
        },
      },
    },
    "/admin/metrics/summary": {
      get: {
        tags: ["Admin"],
        summary: "High-level metrics for throttles, blocks, SLAs, and abuse.",
        description:
          "Returns aggregate metrics for the last N hours. Admin/Owner roles only.",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "Metrics summary.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminMetricsSummary" },
              },
            },
          },
          "401": { description: "Unauthorized." },
          "403": { description: "Forbidden (requires ADMIN/OWNER role)." },
        },
      },
    },
  },
};
