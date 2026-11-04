ALTER TABLE "tournament" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "team_name" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "team_regulation" "regulation";--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "team_pokemon" jsonb;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "team_snapshot_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;