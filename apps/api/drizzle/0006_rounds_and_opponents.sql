CREATE TYPE "public"."round_phase" AS ENUM('swiss', 'top-cut');--> statement-breakpoint
CREATE TYPE "public"."round_result" AS ENUM('win', 'loss', 'tie');--> statement-breakpoint
CREATE TYPE "public"."top_cut_stage" AS ENUM('top-64', 'top-32', 'top-16', 'top-8', 'top-4', 'finals');--> statement-breakpoint
CREATE TABLE "opponent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"display_name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opponent_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opponent_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"phase" "round_phase" NOT NULL,
	"round_number" smallint,
	"stage" "top_cut_stage",
	"best_of" smallint NOT NULL,
	"bye" boolean DEFAULT false NOT NULL,
	"result" "round_result" NOT NULL,
	"games_won" smallint,
	"games_lost" smallint,
	"opponent_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_tournament_number_key" UNIQUE("tournament_id","round_number"),
	CONSTRAINT "round_tournament_stage_key" UNIQUE("tournament_id","stage")
);
--> statement-breakpoint
ALTER TABLE "opponent" ADD CONSTRAINT "opponent_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opponent_alias" ADD CONSTRAINT "opponent_alias_opponent_id_opponent_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."opponent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_opponent_id_opponent_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."opponent"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opponent_owner_idx" ON "opponent" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "opponent_alias_opponent_idx" ON "opponent_alias" USING btree ("opponent_id");--> statement-breakpoint
CREATE INDEX "round_tournament_idx" ON "round" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "round_opponent_idx" ON "round" USING btree ("opponent_id");