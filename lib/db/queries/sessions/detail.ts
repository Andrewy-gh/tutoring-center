import 'server-only';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export async function getSessionTutorId(sessionId: number) {
  const db = await getDb();
  const [session] = await db
    .select({ tutorId: sessions.tutorId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return session?.tutorId ?? null;
}
