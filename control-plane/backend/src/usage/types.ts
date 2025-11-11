// backend/src/usage/types.ts
export type UsageSubjectType = "ORG" | "AGENT" | "MODEL";

export type UsageRecord = {
  id: string;
  org_id: string;
  subject_type: UsageSubjectType;
  subject_id: string | null;
  timestamp: Date;
  units: number;
  endpoint: string;
};

export type UsageSummary = {
  daily: number;
  monthly: number;
  spikeScore: number;
};
