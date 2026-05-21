import 'server-only';
import { sessions } from '@/db/schema';
import { FREE_SLOT_STATUSES } from '@/db/types';
import { and, eq, gt, lt, ne } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export type AvailableSessionBookedRow = {
  scheduled_at: string;
  ends_at: string;
  status: typeof sessions.$inferSelect.status;
};

export async function getBookedSessionRowsForAvailableSessions(tutorId: number, fromUtc: string, toUtc: string) {
  const db = await getDb();

  return db
    .select({
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, tutorId),
        ne(sessions.status, FREE_SLOT_STATUSES[0]),
        ne(sessions.status, FREE_SLOT_STATUSES[1]),
        lt(sessions.scheduledAt, toUtc),
        gt(sessions.endsAt, fromUtc)
      )
    );
}
