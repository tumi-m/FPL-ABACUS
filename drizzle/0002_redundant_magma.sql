CREATE TABLE "cohort_entry" (
	"snapshot_id" integer NOT NULL,
	"entry" integer NOT NULL,
	"elements" jsonb NOT NULL,
	"counts" jsonb NOT NULL,
	"squad_cost_tenths" integer NOT NULL,
	"bank_tenths" integer NOT NULL,
	"gw_points" integer,
	"captain_points" integer,
	CONSTRAINT "cohort_entry_snapshot_id_entry_pk" PRIMARY KEY("snapshot_id","entry")
);
--> statement-breakpoint
ALTER TABLE "cohort_entry" ADD CONSTRAINT "cohort_entry_snapshot_id_cohort_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."cohort_snapshot"("id") ON DELETE no action ON UPDATE no action;