import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
