import 'dotenv/config';
import { sessions } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { closeTestDatabase, createTestDatabase } from '../helpers/postgresTestClient';

const HAS_DB_ENV = Boolean(process.env.DATABASE_URL);
const describeIfConfigured = HAS_DB_ENV ? describe : describe.skip;

describeIfConfigured('database connection test', () => {
  it('can query sessions table', async () => {
    const client = createTestDatabase();

    try {
      const rows = await client.db
        .select({
          id: sessions.id,
          scheduled_at: sessions.scheduledAt,
          status: sessions.status,
        })
        .from(sessions)
        .orderBy(desc(sessions.scheduledAt))
        .limit(1);

      expect(Array.isArray(rows)).toBe(true);
    } finally {
      await closeTestDatabase(client);
    }
  });
});
