CREATE TABLE "entry_directory" (
	"entry" integer PRIMARY KEY NOT NULL,
	"team_name" varchar(160) NOT NULL,
	"manager_name" varchar(160) DEFAULT '' NOT NULL,
	"rank" integer,
	"source" varchar(12) NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entry_dir_team" ON "entry_directory" USING btree ("team_name");--> statement-breakpoint
CREATE INDEX "entry_dir_manager" ON "entry_directory" USING btree ("manager_name");