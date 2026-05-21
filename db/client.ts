import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function must(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createDatabase() {
  const sql = postgres(must('DATABASE_URL'), {
    max: 1,
    prepare: false,
  });

  return {
    sql,
    db: drizzle(sql, { schema }),
  };
}

type AppDatabase = ReturnType<typeof createDatabase>['db'];

const globalForDb = globalThis as typeof globalThis & {
  __tutoringCenterSql?: ReturnType<typeof postgres>;
  __tutoringCenterDb?: AppDatabase;
};

export const sql = globalForDb.__tutoringCenterSql ?? createDatabase().sql;
export const db = globalForDb.__tutoringCenterDb ?? drizzle(sql, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__tutoringCenterSql = sql;
  globalForDb.__tutoringCenterDb = db;
}
