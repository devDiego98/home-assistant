ALTER TABLE "floor_lights" ADD COLUMN "local_key" text;--> statement-breakpoint
ALTER TABLE "floor_lights" ADD COLUMN "local_ip" text;--> statement-breakpoint
ALTER TABLE "floor_lights" ADD COLUMN "local_version" text;--> statement-breakpoint
ALTER TABLE "floor_lights" ADD COLUMN "local_dp_map" jsonb;