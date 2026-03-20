import { forbidden } from 'next/navigation';
import { isUserRole, type UserRole } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/serverClient';
import {
  ActiveLeafSubjectListSchema,
  SubjectOptionRowListSchema,
  SubjectRecordListSchema,
  type SubjectOptionRow,
  type SubjectRecord,
} from '@/lib/validators/subjects';

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

const ACTIVE_SUBJECT_SELECT = 'id,name,slug,kind,is_active' as const;

const SUBJECT_OPTIONS_SELECT = `
  id,
  name,
  slug,
  kind,
  is_active,
  tutor_subjects!inner (
    tutor_id,
    subject_id
  )
` as const;

const sortNumberAsc = (a: number, b: number) => a - b;

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

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from('subjects').select(ACTIVE_SUBJECT_SELECT).in('id', uniqueSubjectIds);

  if (error) {
    throw new Error('Subjects are temporarily unavailable. Please try again.');
  }

  const parsedSubjects = SubjectRecordListSchema.safeParse(data ?? []);
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

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('subjects')
    .select(SUBJECT_OPTIONS_SELECT)
    .eq('kind', 'leaf')
    .eq('is_active', true)
    .order('name')
    .order('slug');

  if (error) {
    throw new Error(SUBJECT_ERROR_MESSAGES[allowedRole]['database']);
  }

  const parsedSubjects = SubjectOptionRowListSchema.safeParse(data ?? []);
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
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('subjects')
    .select(ACTIVE_SUBJECT_SELECT)
    .eq('kind', 'leaf')
    .eq('is_active', true)
    .order('name')
    .order('slug');

  if (error) {
    throw new Error('Subjects are temporarily unavailable. Please try again.');
  }

  const parsedSubjects = ActiveLeafSubjectListSchema.safeParse(data ?? []);
  if (!parsedSubjects.success) {
    throw new Error('There was a problem preparing subjects. Please try again.');
  }

  return parsedSubjects.data.map(subject => ({
    id: subject.id,
    slug: subject.slug.trim(),
    name: subject.name.trim(),
  }));
}
