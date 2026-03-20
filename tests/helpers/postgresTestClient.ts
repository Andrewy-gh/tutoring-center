import 'dotenv/config';
import * as schema from '@/lib/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  return value;
}

export function createTestDatabase() {
  const sql = postgres(requireEnv('DATABASE_URL'), {
    max: 1,
    prepare: false,
  });

  return {
    sql,
    db: drizzle(sql, { schema }),
  };
}

export async function closeTestDatabase(client: ReturnType<typeof createTestDatabase>) {
  await client.sql.end({ timeout: 0 });
}
