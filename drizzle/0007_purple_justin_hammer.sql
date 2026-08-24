ALTER TABLE "cohort_entry" ADD COLUMN "match_id" integer;--> statement-breakpoint
UPDATE "cohort_entry" SET "match_id" = 0 WHERE "match_id" IS NULL;--> statement-breakpoint
ALTER TABLE "cohort_entry" DROP CONSTRAINT "cohort_entry_snapshot_id_entry_pk";--> statement-breakpoint
ALTER TABLE "cohort_entry" ALTER COLUMN "match_id" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "cohort_entry" ALTER COLUMN "match_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_entry" ADD CONSTRAINT "cohort_entry_snapshot_id_entry_match_id_pk" PRIMARY KEY("snapshot_id","entry","match_id");