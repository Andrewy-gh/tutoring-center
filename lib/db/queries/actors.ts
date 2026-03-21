import 'server-only';
import { parents, tutors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export async function getParentIdByUserId(userId: number) {
  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  return parent?.id ?? null;
}

export async function getTutorIdByUserId(userId: number) {
  const db = await getDb();
  const [tutor] = await db.select({ id: tutors.id }).from(tutors).where(eq(tutors.userId, userId)).limit(1);

  return tutor?.id ?? null;
}
