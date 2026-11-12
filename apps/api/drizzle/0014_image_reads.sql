CREATE TABLE "image_reads" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "image_reads_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "image_reads" ADD CONSTRAINT "image_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;