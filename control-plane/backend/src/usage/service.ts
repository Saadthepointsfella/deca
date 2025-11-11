// backend/src/usage/service.ts
import type { UsageSubjectType, UsageSummary } from "./types";
import * as repo from "./repository";
import { updateDailyAndMonthlyAggregates } from "./aggregates";
import { getHourlyUsage } from "./repository";
import { computeSpikeScore } from "./spike";

export async function recordUsageAndGetSummary(params: {
  orgId: string; subjectType: UsageSubjectType; subjectId: string | null; units: number; endpoint: string;
}): Promise<{ summary: UsageSummary; recordId: string }> {
  const record = await repo.insertUsageRecord(params);
  await updateDailyAndMonthlyAggregates({
    orgId: params.orgId, subjectType: params.subjectType, subjectId: params.subjectId, units: params.units,
  });

  const basic = await repo.getUsageSummaryForOrg(params.orgId);

  // Spike score: current hour vs p95 of last 7 days hours
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const hourly = await getHourlyUsage(params.orgId, since);
  const currentBucket = hourly[hourly.length - 1]?.units ?? 0;
  const history = hourly.slice(0, -1); // exclude current hour from baseline
  const spikeScore = computeSpikeScore(Number(currentBucket), history);

  return { summary: { ...basic, spikeScore }, recordId: record.id };
}
