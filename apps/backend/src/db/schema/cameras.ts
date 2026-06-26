import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';

export const cameraStatusEnum = pgEnum('camera_status', ['online', 'offline', 'recording', 'error']);

export const cameras = pgTable('cameras', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  location: text('location').notNull(),
  status: cameraStatusEnum('status').notNull().default('offline'),
  rtspUrl: text('rtsp_url'),
  hasAudio: boolean('has_audio').notNull().default(false),
  hasNightVision: boolean('has_night_vision').notNull().default(false),
  resolutionWidth: integer('resolution_width').notNull().default(1920),
  resolutionHeight: integer('resolution_height').notNull().default(1080),
  frigateId: text('frigate_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
