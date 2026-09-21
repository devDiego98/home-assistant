import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, real } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';

export const roomPresets = pgTable('room_presets', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mode: text('mode').notNull(), // 'colour' | 'white'
  hue: real('hue'), // 0-360, colour mode only
  saturation: real('saturation'), // 0-1000, colour mode only
  brightness: real('brightness').notNull(), // 0-100, both modes
  colorTemp: real('color_temp'), // 0-1000 (0=warm, 1000=cool), white mode only
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
