import { getDb } from "../shared/db";
import { differenceInHours } from "date-fns";
import type { PolicyConfigV2 } from "./types";

type OrgAbuseRow = {
  org_id: string;
  score: number;
  updated_at: string;
};

export async function getEffectiveAbuseScore(
  orgId: string,
  cfg: PolicyConfigV2
): Promise<number> {
  const db = getDb();
  const res = await db.query<OrgAbuseRow>(
    `SELECT org_id, score, updated_at
     FROM org_abuse_scores
     WHERE org_id = $1
     LIMIT 1`,
    [orgId]
  );
  if (!res.rows[0]) return 0;

  const row = res.rows[0];
  const rawScore = row.score;
  const updatedAt = new Date(row.updated_at);
  const hours = Math.max(0, differenceInHours(new Date(), updatedAt));

  const halfLife = cfg.abuse.decay_half_life_hours || 24;
  if (halfLife <= 0) return rawScore;

  // Exponential decay: score * 0.5^(hours/halfLife)
  const decayFactor = Math.pow(0.5, hours / halfLife);
  return rawScore * decayFactor;
}

export async function bumpAbuseScore(
  orgId: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return;
  const db = getDb();
  await db.query(
    `
    INSERT INTO org_abuse_scores(org_id, score, updated_at)
    VALUES ($1, $2, now())
    ON CONFLICT (org_id)
    DO UPDATE SET
      score = org_abuse_scores.score + EXCLUDED.score,
      updated_at = now()
    `,
    [orgId, amount]
  );
}
