// backend/src/shared/metrics.ts
import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in ms",
  labelNames: ["route", "method", "status"] as const,
  buckets: [10, 25, 50, 100, 250, 500, 1000, 3000],
});
export const policyEvalLatencyMs = new client.Histogram({
  name: "policy_eval_latency_ms",
  help: "Policy evaluation latency in ms",
  buckets: [1, 5, 10, 25, 50, 100, 250],
});
export const usageThrottleTotal = new client.Counter({
  name: "usage_throttle_total",
  help: "Total throttled usage decisions",
});
export const usageBlockTotal = new client.Counter({
  name: "usage_block_total",
  help: "Total blocked usage decisions",
});
export const ticketSlaBreachedTotal = new client.Counter({
  name: "ticket_sla_breached_total",
  help: "Total ticket SLA breaches observed",
});

registry.registerMetric(httpRequestDurationMs);
registry.registerMetric(policyEvalLatencyMs);
registry.registerMetric(usageThrottleTotal);
registry.registerMetric(usageBlockTotal);
registry.registerMetric(ticketSlaBreachedTotal);
