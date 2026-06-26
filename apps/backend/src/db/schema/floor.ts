import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, real, boolean } from 'drizzle-orm/pg-core';

export const floorLights = pgTable('floor_lights', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  tuyaDeviceId: text('tuya_device_id').notNull(),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),
  isOn: boolean('is_on').notNull().default(false),
  brightness: real('brightness'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
