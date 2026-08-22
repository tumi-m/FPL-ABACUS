import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const cohortSnapshot = pgTable(
  "cohort_snapshot",
  {
    id: serial("id").primaryKey(),
    event: integer("event").notNull(),
    cohort: varchar("cohort", { length: 24 }).notNull(),
    sampleSize: integer("sample_size").notNull(),
    builtAt: timestamp("built_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.event, t.cohort)],
);

export const cohortOwnership = pgTable(
  "cohort_ownership",
  {
    snapshotId: integer("snapshot_id")
      .references(() => cohortSnapshot.id)
      .notNull(),
    element: integer("element").notNull(),
    ownedPct: real("owned_pct").notNull(),
    startedPct: real("started_pct").notNull(),
    captainPct: real("captain_pct").notNull(),
    eo: real("eo").notNull(),
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.element] })],
);

export const scoreDistribution = pgTable(
  "score_distribution",
  {
    event: integer("event").notNull(),
    kind: varchar("kind", { length: 12 }).notNull(),
    score: integer("score").notNull(),
    cumCount: integer("cum_count").notNull(),
    totalPop: integer("total_pop").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.event, t.kind, t.score] })],
);

export const priceSnapshot = pgTable(
  "price_snapshot",
  {
    id: serial("id").primaryKey(),
    element: integer("element").notNull(),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    nowCost: integer("now_cost").notNull(),
    transfersIn: integer("transfers_in").notNull(),
    transfersOut: integer("transfers_out").notNull(),
    selectedBy: real("selected_by").notNull(),
  },
  (t) => [index("price_el_time").on(t.element, t.capturedAt)],
);

export const priceChange = pgTable(
  "price_change",
  {
    id: serial("id").primaryKey(),
    element: integer("element").notNull(),
    changedAt: timestamp("changed_at").notNull(),
    direction: varchar("direction", { length: 4 }).notNull(),
    from: integer("from").notNull(),
    to: integer("to").notNull(),
  },
  (t) => [index("pc_el_time").on(t.element, t.changedAt)],
);

export const entryAnalysis = pgTable(
  "entry_analysis",
  {
    entry: integer("entry").notNull(),
    event: integer("event").notNull(),
    payload: jsonb("payload").notNull(),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.entry, t.event] })],
);

export const rawArchive = pgTable(
  "raw_archive",
  {
    id: serial("id").primaryKey(),
    endpoint: varchar("endpoint", { length: 128 }).notNull(),
    event: integer("event"),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    body: jsonb("body").notNull(),
  },
  (t) => [index("raw_ep_time").on(t.endpoint, t.capturedAt)],
);
