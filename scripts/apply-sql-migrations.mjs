import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL');
}

const migrationsDir = path.resolve(process.cwd(), 'drizzle');
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
});

async function ensureMigrationsTable() {
  await sql`
    create table if not exists app_sql_migrations (
      id serial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    )
  `;
}

async function getMigrationFiles() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations() {
  const rows = await sql`select name from app_sql_migrations order by name asc`;
  return new Set(rows.map(row => row.name));
}

try {
  await ensureMigrationsTable();

  const [files, applied] = await Promise.all([getMigrationFiles(), getAppliedMigrations()]);

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, file);
    const migrationSql = await readFile(migrationPath, 'utf8');

    console.log(`Applying ${file}`);

    await sql.begin(async tx => {
      await tx.unsafe(migrationSql);
      await tx`insert into app_sql_migrations (name) values (${file})`;
    });
  }

  console.log('SQL migrations are up to date.');
} finally {
  await sql.end({ timeout: 5 });
}
