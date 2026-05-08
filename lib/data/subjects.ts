import { forbidden } from 'next/navigation';
import type { UserRole } from '@/lib/auth';
import { subjects, tutorSubjects } from '@/lib/db/schema';
import {
  ActiveLeafSubjectListSchema,
  SubjectOptionRowListSchema,
  SubjectRecordListSchema,
  type SubjectOptionRow,
  type SubjectRecord,
} from '@/lib/validators/subjects';
import { and, asc, eq, inArray } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

type SubjectLoadErrorReason = 'database' | 'validation';
type AllowedRole = Exclude<UserRole, 'tutor'>;

export type SubjectTutorAssignment = {
  tutorId: number;
  subjectId: number;
  subjectSlug: string;
};

export type SubjectOption = {
  slug: string;
  name: string;
  tutorCount: number;
  assignments: SubjectTutorAssignment[];
};

export type SelectedSubject = Pick<SubjectOption, 'slug' | 'name'>;

export type SubjectSelection = {
  subject: SelectedSubject;
  assignments: SubjectTutorAssignment[];
};

const SUBJECT_ERROR_MESSAGES = {
  admin: {
    database: 'Loading subject records for admin views failed due to a temporary backend issue. Please try again.',
    validation: 'Subject data format is invalid. Please try again later.',
  },
  parent: {
    database: 'Subjects are temporarily unavailable. Please try again in a moment.',
    validation: 'There was a problem preparing subjects. Please try again.',
  },
} as const satisfies Record<AllowedRole, Record<SubjectLoadErrorReason, string>>;

const sortNumberAsc = (a: number, b: number) => a - b;

type SubjectRecordRow = {
  id: number;
  name: string;
  slug: string;
  kind: typeof subjects.$inferSelect.kind;
  isActive: boolean;
};

type SubjectOptionJoinRow = SubjectRecordRow & {
  tutorId: number;
  subjectId: number;
};

type SubjectOptionRowCandidate = ReturnType<typeof mapSubjectRecordRow> & {
  tutor_subjects: Array<{
    tutor_id: number;
    subject_id: number;
  }>;
};

const mapSubjectRecordRow = (row: SubjectRecordRow) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  kind: row.kind,
  is_active: row.isActive,
});

const mapSubjectOptionRows = (rows: SubjectOptionJoinRow[]) => {
  const subjectsById = new Map<number, SubjectOptionRowCandidate>();

  for (const row of rows) {
    const subjectId = Number(row.id);
    const existingSubject = subjectsById.get(subjectId);

    if (existingSubject) {
      existingSubject.tutor_subjects ??= [];
      existingSubject.tutor_subjects.push({
        tutor_id: row.tutorId,
        subject_id: row.subjectId,
      });
      continue;
    }

    subjectsById.set(subjectId, {
      ...mapSubjectRecordRow(row),
      tutor_subjects: [
        {
          tutor_id: row.tutorId,
          subject_id: row.subjectId,
        },
      ],
    });
  }

  return Array.from(subjectsById.values());
};

export const mapSubjectOptions = (subjects: SubjectOptionRow[]) => {
  return subjects
    .map(subject => {
      const slug = subject.slug.trim();
      const name = subject.name.trim();
      const tutorToSubjectId = new Map<number, number>();

      for (const assignment of subject.tutor_subjects ?? []) {
        const assignedSubjectId = tutorToSubjectId.get(assignment.tutor_id);
        if (assignedSubjectId === undefined || assignment.subject_id < assignedSubjectId) {
          tutorToSubjectId.set(assignment.tutor_id, assignment.subject_id);
        }
      }

      return {
        slug,
        name,
        tutorCount: tutorToSubjectId.size,
        assignments: Array.from(tutorToSubjectId.entries())
          .sort(([leftTutorId], [rightTutorId]) => sortNumberAsc(leftTutorId, rightTutorId))
          .map(([tutorId, subjectId]) => ({ tutorId, subjectId, subjectSlug: slug })),
      };
    })
    .filter(subject => subject.slug !== '' && subject.name !== '' && subject.tutorCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
};

export async function getSubjectMapByIds(subjectIds: number[]) {
  const uniqueSubjectIds = [...new Set(subjectIds.filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueSubjectIds.length === 0) {
    return new Map<number, SubjectRecord>();
  }

  let rows: SubjectRecordRow[];
  try {
    const db = await getDb();
    rows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        slug: subjects.slug,
        kind: subjects.kind,
        isActive: subjects.isActive,
      })
      .from(subjects)
      .where(inArray(subjects.id, uniqueSubjectIds))
      .orderBy(asc(subjects.id));
  } catch {
    throw new Error('Subjects are temporarily unavailable. Please try again.');
  }

  const parsedSubjects = SubjectRecordListSchema.safeParse(rows.map(mapSubjectRecordRow));
  if (!parsedSubjects.success) {
    throw new Error('Subject data format is invalid. Please try again later.');
  }

  return new Map(parsedSubjects.data.map(subject => [subject.id, subject]));
}

export async function getSubjects(role: UserRole) {
  if (role === 'tutor') forbidden();
  const allowedRole: AllowedRole = role;

  let rows: SubjectOptionJoinRow[];
  try {
    const db = await getDb();
    rows = await db
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
  } catch {
    throw new Error(SUBJECT_ERROR_MESSAGES[allowedRole]['database']);
  }

  const parsedSubjects = SubjectOptionRowListSchema.safeParse(mapSubjectOptionRows(rows));
  if (!parsedSubjects.success) {
    throw new Error(SUBJECT_ERROR_MESSAGES[allowedRole]['validation']);
  }

  return mapSubjectOptions(parsedSubjects.data);
}

export type SubjectForGradeForm = {
  id: number;
  slug: string;
  name: string;
};

export async function getSubjectsForGradeForm() {
  let rows: SubjectRecordRow[];
  try {
    const db = await getDb();
    rows = await db
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
  } catch {
    throw new Error('Subjects are temporarily unavailable. Please try again.');
  }

  const parsedSubjects = ActiveLeafSubjectListSchema.safeParse(rows.map(mapSubjectRecordRow));
  if (!parsedSubjects.success) {
    throw new Error('There was a problem preparing subjects. Please try again.');
  }

  return parsedSubjects.data.map(subject => ({
    id: subject.id,
    slug: subject.slug.trim(),
    name: subject.name.trim(),
  }));
}
