CREATE TABLE "news_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"url_hash" varchar(64) NOT NULL,
	"url" varchar(1024) NOT NULL,
	"source" varchar(32) NOT NULL,
	"title" varchar(512) NOT NULL,
	"summary" varchar(2048),
	"published_at" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"element_ids" integer[] NOT NULL,
	"team_ids" integer[] NOT NULL,
	"relevance" real NOT NULL,
	CONSTRAINT "news_url_hash" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE INDEX "news_published" ON "news_item" USING btree ("published_at");