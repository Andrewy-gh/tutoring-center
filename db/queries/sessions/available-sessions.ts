import 'server-only';
import { sessions } from '@/db/schema';
import { FREE_SLOT_STATUSES } from '@/db/types';
import { and, eq, gt, lt, notInArray } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

const FREE_SLOT_STATUS_VALUES = [...FREE_SLOT_STATUSES];

export type AvailableSessionBookedRow = {
  scheduled_at: string;
  ends_at: string;
};

export async function getBookedSessionRowsForAvailableSessions(tutorId: number, fromUtc: string, toUtc: string) {
  const db = await getDb();

  return db
    .select({
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, tutorId),
        notInArray(sessions.status, FREE_SLOT_STATUS_VALUES),
        lt(sessions.scheduledAt, toUtc),
        gt(sessions.endsAt, fromUtc)
      )
    );
}
