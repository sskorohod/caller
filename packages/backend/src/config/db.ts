import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { env } from './env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
