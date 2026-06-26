CREATE TABLE IF NOT EXISTS "floor_lights" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tuya_device_id" text NOT NULL,
	"position_x" real NOT NULL,
	"position_y" real NOT NULL,
	"is_on" boolean DEFAULT false NOT NULL,
	"brightness" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
