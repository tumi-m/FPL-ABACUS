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

/** v3-10 Twin Study: per-entry squad snapshot within a sampled cohort.
 *  Elements as int array (15 ids), counts as [owned, started, captain] for
 *  the three arms. rankAt is the entry's overall rank at snapshot time. */
export const cohortEntry = pgTable(
  "cohort_entry",
  {
    snapshotId: integer("snapshot_id")
      .references(() => cohortSnapshot.id)
      .notNull(),
    entry: integer("entry").notNull(),
    elements: jsonb("elements").$type<number[]>().notNull(),
    /** [owned, started, caption] — compact counts for the arms. */
    counts: jsonb("counts").$type<[number, number, number]>().notNull(),
    squadCostTenths: integer("squad_cost_tenths").notNull(),
    bankTenths: integer("bank_tenths").notNull(),
    /** Free transfers available that GW — part of the twin pairing rule. */
    eventTransfers: integer("event_transfers"),
    // outcome, filled on finalise: gw points net of hits + decision arm
    gwPoints: integer("gw_points"),
    captainPoints: integer("captain_points"),
    arm: varchar("arm", { length: 12 }),
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.entry] })],
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

export const newsItem = pgTable(
  "news_item",
  {
    id: serial("id").primaryKey(),
    /** sha256 of the canonical URL — dedupe key across fetches. */
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    summary: varchar("summary", { length: 2048 }),
    publishedAt: timestamp("published_at").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    elementIds: integer("element_ids").array().notNull(),
    teamIds: integer("team_ids").array().notNull(),
    /** Generic ingest-time relevance — squad-specific ranking happens at read. */
    relevance: real("relevance").notNull(),
  },
  (t) => [unique("news_url_hash").on(t.urlHash), index("news_published").on(t.publishedAt)],
);
