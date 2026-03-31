#!/usr/bin/env node
/**
 * Database migration runner.
 * Runs all SQL files from supabase/migrations/ in order.
 * Tracks applied migrations in a _migrations table.
 *
 * Usage: node dist/migrate.js
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function migrate() {
  await client.connect();
  console.log('Connected to database.');

  // Create migrations tracking table
  await client.query(`
    create table if not exists _migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    )
  `);

  // Find migration files
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log(`Migrations directory not found: ${migrationsDir}`);
    console.log('No migrations to run.');
    await client.end();
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    await client.end();
    return;
  }

  // Check which migrations were already applied
  const { rows: applied } = await client.query<{ filename: string }>(
    'select filename from _migrations'
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  run   ${file} ...`);

    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into _migrations(filename) values($1)', [file]);
      await client.query('commit');
      console.log(`  done  ${file}`);
      ran++;
    } catch (err) {
      await client.query('rollback');
      console.error(`  FAIL  ${file}:`, (err as Error).message);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete. ${ran} new migration(s) applied.`);
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
