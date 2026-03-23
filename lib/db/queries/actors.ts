import 'server-only';
import { parents, roles, tutors, users } from '@/lib/db/schema';
import { asc, eq, ilike } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

type ActorRole = 'admin' | 'parent' | 'tutor';

export async function getParentIdByUserId(userId: number) {
  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  return parent?.id ?? null;
}

export async function parentExists(parentId: number) {
  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.id, parentId)).limit(1);

  return Boolean(parent);
}

export async function getTutorIdByUserId(userId: number) {
  const db = await getDb();
  const [tutor] = await db.select({ id: tutors.id }).from(tutors).where(eq(tutors.userId, userId)).limit(1);

  return tutor?.id ?? null;
}

export async function getUserIdForRole(role: ActorRole) {
  const db = await getDb();

  if (role === 'parent') {
    const [parent] = await db.select({ userId: parents.userId }).from(parents).orderBy(asc(parents.userId)).limit(1);
    return parent?.userId ?? null;
  }

  if (role === 'tutor') {
    const [tutor] = await db.select({ userId: tutors.userId }).from(tutors).orderBy(asc(tutors.userId)).limit(1);
    return tutor?.userId ?? null;
  }

  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.role, roles.id))
    .where(ilike(roles.name, 'admin'))
    .orderBy(asc(users.id))
    .limit(1);

  return adminUser?.id ?? null;
}

export async function getUserNameById(userId: number) {
  const db = await getDb();
  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}
