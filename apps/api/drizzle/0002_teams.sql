CREATE TYPE "public"."regulation" AS ENUM('M-A', 'M-B', 'M-C');--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"regulation" "regulation" DEFAULT 'M-C' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"pokemon" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_owner_created_idx" ON "team" USING btree ("owner_id","created_at");