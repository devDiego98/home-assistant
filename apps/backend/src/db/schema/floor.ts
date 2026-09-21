import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, real, boolean, jsonb } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';

export const floorLights = pgTable('floor_lights', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  tuyaDeviceId: text('tuya_device_id').notNull(),
  positionX: real('position_x'),
  positionY: real('position_y'),
  isOn: boolean('is_on').notNull().default(false),
  brightness: real('brightness'),
  roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  // Cached local-LAN connection info (see services/tuyaLocal.ts) — fetched once via
  // read-only cloud calls, then used to control the device directly over the LAN,
  // bypassing Tuya's much smaller "controllable device pool" cloud quota.
  localKey: text('local_key'),
  localIp: text('local_ip'),
  localVersion: text('local_version'),
  localDpMap: jsonb('local_dp_map').$type<Record<string, number>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
