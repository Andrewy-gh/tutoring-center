import 'server-only';
import { sessions } from '@/db/schema';
import { and, eq, lte } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export async function sweepEndedScheduledSessionsToPendingNotes(nowIso: string) {
  const db = await getDb();

  await db
    .update(sessions)
    .set({
      status: 'Pending-Notes',
      updatedAt: nowIso,
    })
    .where(and(eq(sessions.status, 'Scheduled'), lte(sessions.endsAt, nowIso)));
}
