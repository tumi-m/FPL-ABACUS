CREATE TABLE "cohort_ownership" (
	"snapshot_id" integer NOT NULL,
	"element" integer NOT NULL,
	"owned_pct" real NOT NULL,
	"started_pct" real NOT NULL,
	"captain_pct" real NOT NULL,
	"eo" real NOT NULL,
	CONSTRAINT "cohort_ownership_snapshot_id_element_pk" PRIMARY KEY("snapshot_id","element")
);
--> statement-breakpoint
CREATE TABLE "cohort_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" integer NOT NULL,
	"cohort" varchar(24) NOT NULL,
	"sample_size" integer NOT NULL,
	"built_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_snapshot_event_cohort_unique" UNIQUE("event","cohort")
);
--> statement-breakpoint
CREATE TABLE "entry_analysis" (
	"entry" integer NOT NULL,
	"event" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entry_analysis_entry_event_pk" PRIMARY KEY("entry","event")
);
--> statement-breakpoint
CREATE TABLE "price_change" (
	"id" serial PRIMARY KEY NOT NULL,
	"element" integer NOT NULL,
	"changed_at" timestamp NOT NULL,
	"direction" varchar(4) NOT NULL,
	"from" integer NOT NULL,
	"to" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"element" integer NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"now_cost" integer NOT NULL,
	"transfers_in" integer NOT NULL,
	"transfers_out" integer NOT NULL,
	"selected_by" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_archive" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" varchar(128) NOT NULL,
	"event" integer,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_distribution" (
	"event" integer NOT NULL,
	"kind" varchar(12) NOT NULL,
	"score" integer NOT NULL,
	"cum_count" integer NOT NULL,
	"total_pop" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "score_distribution_event_kind_score_pk" PRIMARY KEY("event","kind","score")
);
--> statement-breakpoint
ALTER TABLE "cohort_ownership" ADD CONSTRAINT "cohort_ownership_snapshot_id_cohort_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."cohort_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_el_time" ON "price_change" USING btree ("element","changed_at");--> statement-breakpoint
CREATE INDEX "price_el_time" ON "price_snapshot" USING btree ("element","captured_at");--> statement-breakpoint
CREATE INDEX "raw_ep_time" ON "raw_archive" USING btree ("endpoint","captured_at");