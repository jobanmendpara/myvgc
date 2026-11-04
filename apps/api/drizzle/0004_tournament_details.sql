ALTER TABLE "tournament" ADD COLUMN "organizer" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "entry_fee_amount" integer;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "entry_fee_currency" char(3);--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "championship_points" integer;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "player_count" integer;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "placement" integer;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "dropped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_entry_fee_complete" CHECK (("tournament"."entry_fee_amount" is null) = ("tournament"."entry_fee_currency" is null));