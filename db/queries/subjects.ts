import 'server-only';
import { subjects, tutorSubjects } from '@/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';

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

export type ActiveLeafSubjectOptionRow = SubjectRecordRow & {
  tutorId: number;
  subjectId: number;
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

export async function getActiveLeafSubjectOptionRowsWithTutorAssignments() {
  const db = await getDb();

  return db
    .select({
      id: subjects.id,
      name: subjects.name,
      slug: subjects.slug,
      kind: subjects.kind,
      isActive: subjects.isActive,
      tutorId: tutorSubjects.tutorId,
      subjectId: tutorSubjects.subjectId,
    })
    .from(subjects)
    .innerJoin(
      tutorSubjects,
      and(eq(tutorSubjects.subjectId, subjects.id), eq(tutorSubjects.subjectKind, subjects.kind))
    )
    .where(and(eq(subjects.kind, 'leaf'), eq(subjects.isActive, true)))
    .orderBy(asc(subjects.name), asc(subjects.slug), asc(tutorSubjects.tutorId), asc(tutorSubjects.subjectId));
}

export async function getActiveLeafSubjectRowsForGradeForm() {
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
    .where(and(eq(subjects.kind, 'leaf'), eq(subjects.isActive, true)))
    .orderBy(asc(subjects.name), asc(subjects.slug));
}
