CREATE TYPE "public"."event_tier" AS ENUM('premier-challenge', 'regional', 'international', 'worlds', 'grassroots', 'online', 'other');--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"event_tier" "event_tier" NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"regulation" "regulation" NOT NULL,
	"default_best_of" smallint DEFAULT 1 NOT NULL,
	"location" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_owner_start_idx" ON "tournament" USING btree ("owner_id","start_date");