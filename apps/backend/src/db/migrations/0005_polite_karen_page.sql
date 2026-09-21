CREATE TABLE IF NOT EXISTS "room_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"hue" real,
	"saturation" real,
	"brightness" real NOT NULL,
	"color_temp" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "room_presets" ADD CONSTRAINT "room_presets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
