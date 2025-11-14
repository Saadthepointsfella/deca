// backend/src/demo/seedDemo.ts
import crypto from "crypto";
import { subDays, subHours } from "date-fns";
import { getDb } from "../shared/db";
import { logger } from "../shared/logger";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

const DEMO_PLANS = {
  FREE: "plan_demo_free",
  PRO: "plan_demo_pro",
  ENTERPRISE: "plan_demo_enterprise",
} as const;

const DEMO_ORGS = {
  FREE: "org_demo_free",
  PRO: "org_demo_pro",
  ENTERPRISE: "org_demo_ent",
} as const;

export async function seedDemoData() {
  const db = getDb();

  logger.info("[demo] seeding demo data…");

  await db.query("BEGIN");

  try {
    await ensurePlans(db);
    await ensureOrgs(db);
    await seedUsageHistory(db);
    await seedTickets(db);
    await seedDecisionLogs(db);
    await seedAbuseScores(db);

    await db.query("COMMIT");
    logger.info("[demo] demo data seeded successfully");
  } catch (e) {
    await db.query("ROLLBACK");
    logger.error({ err: e }, "[demo] failed to seed demo data");
    throw e;
  }
}

async function ensurePlans(db: ReturnType<typeof getDb>) {
  logger.info("[demo] ensuring plans");

  await db.query(
    `
    INSERT INTO plans (id, tier, name, daily_quota_units, monthly_quota_units,
                       spike_sensitivity, overdraft_factor, support_sla_minutes,
                       max_agents, max_models, max_agent_daily_units)
    VALUES
      ($1, 'FREE', 'Demo Free',       10000,  200000, 0.8, 1.0, 1440, NULL, NULL, NULL),
      ($2, 'PRO',  'Demo Pro',      100000, 2000000, 1.0, 1.1, 240,  NULL, NULL, NULL),
      ($3, 'ENTERPRISE', 'Demo Enterprise', 500000, 10000000, 1.2, 1.2, 60, NULL, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET
      tier = EXCLUDED.tier,
      name = EXCLUDED.name,
      daily_quota_units = EXCLUDED.daily_quota_units,
      monthly_quota_units = EXCLUDED.monthly_quota_units,
      spike_sensitivity = EXCLUDED.spike_sensitivity,
      overdraft_factor = EXCLUDED.overdraft_factor,
      support_sla_minutes = EXCLUDED.support_sla_minutes
  `,
    [DEMO_PLANS.FREE, DEMO_PLANS.PRO, DEMO_PLANS.ENTERPRISE]
  );
}

async function ensureOrgs(db: ReturnType<typeof getDb>) {
  logger.info("[demo] ensuring orgs");

  // Create orgs
  await db.query(
    `
    INSERT INTO orgs (id, name, created_at)
    VALUES
      ($1, 'Demo Free Org',        NOW() - INTERVAL '14 days'),
      ($2, 'Demo Pro Org',         NOW() - INTERVAL '14 days'),
      ($3, 'Demo Enterprise Org',  NOW() - INTERVAL '14 days')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name
  `,
    [
      DEMO_ORGS.FREE,
      DEMO_ORGS.PRO,
      DEMO_ORGS.ENTERPRISE,
    ]
  );

  // Assign plans to orgs
  await db.query(
    `
    INSERT INTO org_plans (org_id, plan_id)
    VALUES
      ($1, $4),
      ($2, $5),
      ($3, $6)
    ON CONFLICT (org_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id
  `,
    [
      DEMO_ORGS.FREE,
      DEMO_ORGS.PRO,
      DEMO_ORGS.ENTERPRISE,
      DEMO_PLANS.FREE,
      DEMO_PLANS.PRO,
      DEMO_PLANS.ENTERPRISE,
    ]
  );
}

async function seedUsageHistory(db: ReturnType<typeof getDb>) {
  logger.info("[demo] seeding usage history");

  // Clear previous demo usage for idempotency
  await db.query(
    `
    DELETE FROM usage_records
    WHERE org_id = ANY($1)
  `,
    [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
  );

  const now = new Date();
  const rows: {
    id: string;
    org_id: string;
    subject_type: string;
    subject_id: string | null;
    timestamp: Date;
    units: number;
    endpoint: string;
  }[] = [];

  // 7 days of history per org
  for (let dayOffset = 7; dayOffset >= 0; dayOffset--) {
    const baseDate = subDays(now, dayOffset);

    // FREE: low steady usage + small spike one day
    rows.push({
      id: id("use"),
      org_id: DEMO_ORGS.FREE,
      subject_type: "ORG",
      subject_id: null,
      timestamp: subHours(baseDate, 2),
      units: dayOffset === 1 ? 8000 : 2000,
      endpoint: "completion",
    });

    // PRO: higher usage, one obvious spike
    rows.push({
      id: id("use"),
      org_id: DEMO_ORGS.PRO,
      subject_type: "ORG",
      subject_id: null,
      timestamp: subHours(baseDate, 1),
      units: dayOffset === 0 ? 120000 : 40000,
      endpoint: "completion",
    });

    // ENTERPRISE: consistently high but below hard caps
    rows.push({
      id: id("use"),
      org_id: DEMO_ORGS.ENTERPRISE,
      subject_type: "ORG",
      subject_id: null,
      timestamp: subHours(baseDate, 3),
      units: 80000,
      endpoint: "completion",
    });
  }

  // Bulk insert
  if (rows.length > 0) {
    const values = rows
      .map(
        (_, i) =>
          `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
      )
      .join(", ");

    const params: any[] = [];
    for (const r of rows) {
      params.push(
        r.id,
        r.org_id,
        r.subject_type,
        r.subject_id,
        r.timestamp,
        r.units,
        r.endpoint
      );
    }

    await db.query(
      `
      INSERT INTO usage_records (id, org_id, subject_type, subject_id, timestamp, units, endpoint)
      VALUES ${values}
    `,
      params
    );
  }

  logger.info(`[demo] seeded ${rows.length} usage_records`);
}

async function seedTickets(db: ReturnType<typeof getDb>) {
  logger.info("[demo] seeding tickets");

  // Remove old demo tickets
  await db.query(
    `
    DELETE FROM tickets
    WHERE org_id = ANY($1)
  `,
    [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
  );

  const now = new Date();

  const tickets = [
    // FREE: one old ticket slightly overdue
    {
      id: id("tkt"),
      org_id: DEMO_ORGS.FREE,
      subject: "Slow responses on Free plan",
      body: "Seeing occasional throttles.",
      status: "OPEN",
      declared_priority: "MEDIUM",
      created_at: subHours(now, 26),
      sla_deadline: subHours(now, 2),
      abuse_flag: false,
      source: "MANUAL",
      external_ref: null,
    },
    // PRO: one urgent at risk
    {
      id: id("tkt"),
      org_id: DEMO_ORGS.PRO,
      subject: "Production incident with Pro org",
      body: "Critical latency spike.",
      status: "OPEN",
      declared_priority: "URGENT",
      created_at: subHours(now, 2),
      sla_deadline: subHours(now, -1), // 1 hour from now
      abuse_flag: false,
      source: "MANUAL",
      external_ref: null,
    },
    // ENTERPRISE: high priority but still on track
    {
      id: id("tkt"),
      org_id: DEMO_ORGS.ENTERPRISE,
      subject: "Integration help",
      body: "Need guidance on rate limits.",
      status: "OPEN",
      declared_priority: "HIGH",
      created_at: subHours(now, 4),
      sla_deadline: subHours(now, -3),
      abuse_flag: false,
      source: "EMAIL",
      external_ref: null,
    },
  ];

  const values = tickets
    .map(
      (_, i) =>
        `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, ` +
        `$${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
    )
    .join(", ");

  const params: any[] = [];
  for (const t of tickets) {
    params.push(
      t.id,
      t.org_id,
      t.subject,
      t.body,
      t.status,
      t.declared_priority,
      t.sla_deadline,
      t.created_at,
      t.abuse_flag,
      t.source
    );
  }

  await db.query(
    `
    INSERT INTO tickets
      (id, org_id, subject, body, status, declared_priority,
       sla_deadline, created_at, abuse_flag, source)
    VALUES ${values}
  `,
    params
  );

  logger.info(`[demo] seeded ${tickets.length} tickets`);
}

async function seedDecisionLogs(db: ReturnType<typeof getDb>) {
  logger.info("[demo] seeding decision logs");

  // Clear previous demo decision logs for idempotency
  await db.query(
    `
    DELETE FROM usage_decision_logs
    WHERE org_id = ANY($1)
  `,
    [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
  );

  const now = new Date();
  const logs: {
    id: string;
    org_id: string;
    subject_type: string;
    subject_id: string | null;
    decision: "ALLOW" | "THROTTLE" | "BLOCK";
    delay_ms: number | null;
    reason: string;
    units: number;
    endpoint: string;
    created_at: Date;
  }[] = [];

  // Generate realistic decision logs over last 24 hours
  // Distribution: 80% ALLOW, 15% THROTTLE, 5% BLOCK
  for (let i = 0; i < 100; i++) {
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = subHours(now, hoursAgo);

    // Pick a random org
    const orgs = [DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE];
    const org_id = orgs[Math.floor(Math.random() * orgs.length)];

    // Decision distribution
    const rand = Math.random();
    let decision: "ALLOW" | "THROTTLE" | "BLOCK";
    let delay_ms: number | null;
    let reason: string;

    if (rand < 0.8) {
      decision = "ALLOW";
      delay_ms = null;
      reason = "Within quota";
    } else if (rand < 0.95) {
      decision = "THROTTLE";
      delay_ms = 1000 + Math.floor(Math.random() * 3000); // 1-4 seconds
      reason = "Approaching daily limit";
    } else {
      decision = "BLOCK";
      delay_ms = null;
      reason = "Daily quota exceeded";
    }

    logs.push({
      id: id("dec"),
      org_id,
      subject_type: "ORG",
      subject_id: null,
      decision,
      delay_ms,
      reason,
      units: 1000 + Math.floor(Math.random() * 5000),
      endpoint: "completion",
      created_at: timestamp,
    });
  }

  // Bulk insert
  if (logs.length > 0) {
    const values = logs
      .map(
        (_, i) =>
          `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, ` +
          `$${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
      )
      .join(", ");

    const params: any[] = [];
    for (const l of logs) {
      params.push(
        l.id,
        l.org_id,
        l.subject_type,
        l.subject_id,
        l.decision,
        l.delay_ms,
        l.reason,
        l.units,
        l.endpoint,
        l.created_at
      );
    }

    await db.query(
      `
      INSERT INTO usage_decision_logs
        (id, org_id, subject_type, subject_id, decision, delay_ms, reason, units, endpoint, created_at)
      VALUES ${values}
    `,
      params
    );
  }

  logger.info(`[demo] seeded ${logs.length} decision logs`);
}

async function seedAbuseScores(db: ReturnType<typeof getDb>) {
  logger.info("[demo] seeding abuse scores");

  // Clear previous demo abuse scores for idempotency
  await db.query(
    `
    DELETE FROM org_abuse_scores
    WHERE org_id = ANY($1)
  `,
    [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
  );

  // Create varied abuse scores for demo orgs to show distribution
  const scores = [
    { org_id: DEMO_ORGS.FREE, score: 0 }, // Clean org (bucket: 0)
    { org_id: DEMO_ORGS.PRO, score: 2 }, // Mild anomaly (bucket: 0-3)
    { org_id: DEMO_ORGS.ENTERPRISE, score: 5 }, // Suspicious (bucket: 3-10)
  ];

  const values = scores
    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, now())`)
    .join(", ");

  const params: any[] = [];
  for (const s of scores) {
    params.push(s.org_id, s.score);
  }

  await db.query(
    `
    INSERT INTO org_abuse_scores (org_id, score, updated_at)
    VALUES ${values}
  `,
    params
  );

  logger.info(`[demo] seeded ${scores.length} abuse scores`);
}

export async function clearDemoData() {
  const db = getDb();

  logger.info("[demo] clearing demo data…");

  await db.query("BEGIN");

  try {
    // Delete demo decision logs
    await db.query(
      `
      DELETE FROM usage_decision_logs
      WHERE org_id = ANY($1)
    `,
      [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
    );

    // Delete demo abuse scores
    await db.query(
      `
      DELETE FROM org_abuse_scores
      WHERE org_id = ANY($1)
    `,
      [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
    );

    // Delete demo usage records
    await db.query(
      `
      DELETE FROM usage_records
      WHERE org_id = ANY($1)
    `,
      [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
    );

    // Delete demo tickets
    await db.query(
      `
      DELETE FROM tickets
      WHERE org_id = ANY($1)
    `,
      [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
    );

    // Delete org_plans associations
    await db.query(
      `
      DELETE FROM org_plans
      WHERE org_id = ANY($1)
    `,
      [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
    );

    // Delete demo orgs
    await db.query(
      `
      DELETE FROM orgs
      WHERE id = ANY($1)
    `,
      [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
    );

    // Delete demo plans
    await db.query(
      `
      DELETE FROM plans
      WHERE id = ANY($1)
    `,
      [[DEMO_PLANS.FREE, DEMO_PLANS.PRO, DEMO_PLANS.ENTERPRISE]]
    );

    await db.query("COMMIT");
    logger.info("[demo] demo data cleared successfully");
  } catch (e) {
    await db.query("ROLLBACK");
    logger.error({ err: e }, "[demo] failed to clear demo data");
    throw e;
  }
}

export async function checkDemoDataExists(): Promise<boolean> {
  const db = getDb();
  const result = await db.query(
    `
    SELECT EXISTS(
      SELECT 1 FROM orgs
      WHERE id = ANY($1)
    ) as exists
  `,
    [[DEMO_ORGS.FREE, DEMO_ORGS.PRO, DEMO_ORGS.ENTERPRISE]]
  );
  return result.rows[0]?.exists ?? false;
}
