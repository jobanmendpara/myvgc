CREATE TABLE "player_details" (
	"user_id" text PRIMARY KEY NOT NULL,
	"player_name" text DEFAULT '' NOT NULL,
	"trainer_name" text DEFAULT '' NOT NULL,
	"switch_profile_name" text DEFAULT '' NOT NULL,
	"player_id" text DEFAULT '' NOT NULL,
	"support_id" text DEFAULT '' NOT NULL,
	"age_division" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_details" ADD CONSTRAINT "player_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;