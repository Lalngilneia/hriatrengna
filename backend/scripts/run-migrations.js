#!/usr/bin/env node
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const rootDir = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(rootDir, 'schema.sql');
const migrationsDir = path.join(rootDir, 'migrations');
const migrationsTable = 'schema_migrations';

async function readSql(filePath) {
  return fs.promises.readFile(filePath, 'utf8');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(`
    SELECT filename
    FROM ${migrationsTable}
    ORDER BY filename ASC
  `);
  return new Set(result.rows.map((row) => row.filename));
}

async function recordMigration(client, filename) {
  await client.query(
    `INSERT INTO ${migrationsTable} (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
    [filename]
  );
}

async function getUserTableCount(client) {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> $1
    `,
    [migrationsTable]
  );
  return result.rows[0]?.count || 0;
}

async function baselineExistingDatabase(client, migrationFiles) {
  const baseline = process.env.MIGRATION_BASELINE;
  if (!baseline) {
    throw new Error(
      'Existing database detected without migration history. Set MIGRATION_BASELINE to the last already-applied migration filename, for example MIGRATION_BASELINE=021_new_pricing_plans.sql.'
    );
  }

  const baselineIndex = migrationFiles.indexOf(baseline);
  if (baselineIndex === -1) {
    throw new Error(`MIGRATION_BASELINE "${baseline}" does not match any file in /migrations.`);
  }

  console.log(`[migrate] Existing database detected. Marking migrations through ${baseline} as already applied.`);
  for (const file of migrationFiles.slice(0, baselineIndex + 1)) {
    await recordMigration(client, file);
  }

  return new Set(migrationFiles.slice(0, baselineIndex + 1));
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const migrationFiles = (await fs.promises.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const userTableCount = await getUserTableCount(client);
    let applied = await getAppliedMigrations(client);

    if (userTableCount === 0) {
      const schemaSql = await readSql(schemaPath);
      console.log(`[migrate] Empty database detected. Applying base schema: ${path.relative(rootDir, schemaPath)}`);
      await client.query(schemaSql);

      for (const file of migrationFiles) {
        await recordMigration(client, file);
      }
      applied = new Set(migrationFiles);
    } else if (applied.size === 0) {
      applied = await baselineExistingDatabase(client, migrationFiles);
    }

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        console.log(`[migrate] Skipping already applied migration: migrations/${file}`);
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = await readSql(fullPath);
      console.log(`[migrate] Applying migration: migrations/${file}`);
      await client.query(sql);
      await recordMigration(client, file);
    }

    console.log('[migrate] Complete.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate] Failed:', err.message);
  process.exitCode = 1;
});
