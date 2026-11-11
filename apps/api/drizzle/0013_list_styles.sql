CREATE TABLE "list_styles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tournaments" text NOT NULL,
	"teams" text NOT NULL,
	"opponents" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list_styles" ADD CONSTRAINT "list_styles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;