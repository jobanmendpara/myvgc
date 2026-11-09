ALTER TABLE "tournament" ADD COLUMN "teamsheet_key" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "teamsheet_file_name" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "teamsheet_size" integer;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "teamsheet_uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_teamsheet_complete" CHECK (num_nulls("tournament"."teamsheet_key", "tournament"."teamsheet_file_name", "tournament"."teamsheet_size", "tournament"."teamsheet_uploaded_at") in (0, 4));