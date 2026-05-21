import 'server-only';
import { subjects } from '@/db/schema';
import { asc, inArray } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export type SubjectRecordRow = {
  id: number;
  name: string;
  slug: string;
  kind: typeof subjects.$inferSelect.kind;
  isActive: boolean;
};

export async function getSubjectRecordRowsByIds(subjectIds: number[]) {
  const db = await getDb();

  return db
    .select({
      id: subjects.id,
      name: subjects.name,
      slug: subjects.slug,
      kind: subjects.kind,
      isActive: subjects.isActive,
    })
    .from(subjects)
    .where(inArray(subjects.id, subjectIds))
    .orderBy(asc(subjects.id));
}
