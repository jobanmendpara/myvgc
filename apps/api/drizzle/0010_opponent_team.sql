CREATE TABLE "opponent_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"opponent_id" uuid NOT NULL,
	"pokemon" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opponent_team_tournament_opponent_key" UNIQUE("tournament_id","opponent_id")
);
--> statement-breakpoint
ALTER TABLE "opponent_team" ADD CONSTRAINT "opponent_team_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opponent_team" ADD CONSTRAINT "opponent_team_opponent_id_opponent_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."opponent"("id") ON DELETE restrict ON UPDATE no action;