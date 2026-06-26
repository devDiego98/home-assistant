import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { cameras } from './cameras';
import { devices } from './devices';

export const alertTypeEnum = pgEnum('alert_type', [
  'detection', 'device_offline', 'motion', 'door_open', 'lock_tamper', 'system',
]);

export const alertSeverityEnum = pgEnum('alert_severity', ['info', 'warning', 'critical']);

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  type: alertTypeEnum('type').notNull(),
  severity: alertSeverityEnum('severity').notNull().default('info'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  cameraId: text('camera_id').references(() => cameras.id, { onDelete: 'set null' }),
  deviceId: text('device_id').references(() => devices.id, { onDelete: 'set null' }),
  snapshotUrl: text('snapshot_url'),
  clipUrl: text('clip_url'),
  detectedObjects: jsonb('detected_objects'),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
