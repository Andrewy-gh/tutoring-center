import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/tutoring_center';

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

try {
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle' });
  // eslint-disable-next-line no-console
  console.log('Drizzle migrations are up to date.');
} finally {
  await sql.end({ timeout: 5 });
}
