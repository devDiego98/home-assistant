import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config';
import * as schema from './schema/index';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export const db = drizzle(pool, { schema });
export type Db = typeof db;
