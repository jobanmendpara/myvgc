CREATE TABLE "opponent_note_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opponent_id" uuid NOT NULL,
	"date" date NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opponent_note_entry" ADD CONSTRAINT "opponent_note_entry_opponent_id_opponent_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."opponent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opponent_note_entry_opponent_idx" ON "opponent_note_entry" USING btree ("opponent_id");