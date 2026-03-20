import { forbidden } from 'next/navigation';
import { isUserRole, type UserRole } from '@/lib/auth';
import { subjects, tutorSubjects } from '@/lib/db/schema';
import {
  ActiveLeafSubjectListSchema,
  SubjectOptionRowListSchema,
  SubjectRecordListSchema,
  type SubjectOptionRow,
  type SubjectRecord,
} from '@/lib/validators/subjects';
import { and, asc, eq, inArray } from 'drizzle-orm';

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

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

type SubjectRecordRow = {
  id: number;
  name: string;
  slug: string;
  kind: 'group' | 'leaf';
  is_active: boolean;
};

function mapSubjectRecordRow(row: SubjectRecordRow): SubjectRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    is_active: row.is_active,
  };
}

function buildSubjectOptionRows(
  rows: Array<SubjectRecordRow & { tutor_id: number; subject_id: number }>
): SubjectOptionRow[] {
  const subjectMap = new Map<number, SubjectOptionRow>();

  for (const row of rows) {
    const existing = subjectMap.get(row.id);
    if (existing) {
      existing.tutor_subjects = [
        ...(existing.tutor_subjects ?? []),
        { tutor_id: row.tutor_id, subject_id: row.subject_id },
      ];
      continue;
    }

    subjectMap.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: 'leaf',
      is_active: true,
      tutor_subjects: [{ tutor_id: row.tutor_id, subject_id: row.subject_id }],
    });
  }

  return Array.from(subjectMap.values());
}

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

  const db = await getDb();
  let rows: SubjectRecordRow[];
  try {
    rows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        slug: subjects.slug,
        kind: subjects.kind,
        is_active: subjects.isActive,
      })
      .from(subjects)
      .where(inArray(subjects.id, uniqueSubjectIds));
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
  if (!isUserRole(role)) {
    throw new Error('Role is required to fetch students.');
  }

  if (role === 'tutor') forbidden();
  const allowedRole: AllowedRole = role;

  const db = await getDb();
  let rows: Array<SubjectRecordRow & { tutor_id: number; subject_id: number }>;
  try {
    rows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        slug: subjects.slug,
        kind: subjects.kind,
        is_active: subjects.isActive,
        tutor_id: tutorSubjects.tutorId,
        subject_id: tutorSubjects.subjectId,
      })
      .from(subjects)
      .innerJoin(tutorSubjects, eq(tutorSubjects.subjectId, subjects.id))
      .where(and(eq(subjects.kind, 'leaf'), eq(subjects.isActive, true)))
      .orderBy(asc(subjects.name), asc(subjects.slug));
  } catch {
    throw new Error(SUBJECT_ERROR_MESSAGES[allowedRole]['database']);
  }

  const parsedSubjects = SubjectOptionRowListSchema.safeParse(buildSubjectOptionRows(rows));
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
  const db = await getDb();
  let rows: SubjectRecordRow[];
  try {
    rows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        slug: subjects.slug,
        kind: subjects.kind,
        is_active: subjects.isActive,
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
