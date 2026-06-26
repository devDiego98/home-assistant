import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const deviceTypeEnum = pgEnum('device_type', [
  'light', 'switch', 'plug', 'lock', 'thermostat',
  'sensor_motion', 'sensor_door', 'sensor_temperature', 'sensor_humidity',
]);

export const deviceProtocolEnum = pgEnum('device_protocol', ['zigbee', 'wifi', 'zwave', 'mqtt']);
export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline', 'unavailable']);

export const devices = pgTable('devices', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  type: deviceTypeEnum('type').notNull(),
  protocol: deviceProtocolEnum('protocol').notNull(),
  status: deviceStatusEnum('status').notNull().default('unavailable'),
  room: text('room'),
  mqttTopic: text('mqtt_topic'),
  capabilities: jsonb('capabilities').notNull().default({}),
  state: jsonb('state').notNull().default({}),
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
