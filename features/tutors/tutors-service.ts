import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getTutorJoinRowById, getTutorJoinRows, getTutorProfileRowsByIds } from '@/db/queries/tutors';
import { getUserRole, type UserRole } from '@/lib/auth';
import { TutorJoinRowListSchema, TutorJoinRowSchema, type TutorJoinRow } from '@/lib/validators/tutors';

export { getUserRole };

export type TutorRow = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  education: string;
  verified: boolean;
  years_experience: number;
};

export type TutorProfile = {
  id: number;
  name: string;
  email: string;
  phone: string;
};

export type TutorDetailType = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  education: string;
  bio: string;
  tagline: string;
  verified: boolean;
  years_experience: number;
};

const MISSING_VALUE = '—';

const TUTOR_ERROR_MESSAGES = {
  admin: {
    database: 'Tutor data is temporarily unavailable. Please retry in a moment.',
    validation: 'Tutor data format is invalid. Please try again later.',
  },
} as const;

const mapTutorRow = (tutor: TutorJoinRow): TutorRow => ({
  id: tutor.id,
  user_id: tutor.userId,
  name: [tutor.firstName, tutor.lastName].filter(Boolean).join(' '),
  email: tutor.email,
  phone: tutor.phone ?? MISSING_VALUE,
  education: tutor.education ?? MISSING_VALUE,
  verified: tutor.verified,
  years_experience: tutor.yearsExperience ?? 0,
});

const mapTutorDetail = (tutor: TutorJoinRow): TutorDetailType => ({
  id: tutor.id,
  user_id: tutor.userId,
  first_name: tutor.firstName ?? '',
  last_name: tutor.lastName ?? '',
  email: tutor.email,
  phone: tutor.phone ?? MISSING_VALUE,
  education: tutor.education ?? MISSING_VALUE,
  bio: tutor.bio ?? MISSING_VALUE,
  tagline: tutor.tagline ?? MISSING_VALUE,
  verified: tutor.verified,
  years_experience: tutor.yearsExperience ?? 0,
});

export async function getTutorProfileMapByIds(tutorIds: number[]) {
  const uniqueTutorIds = [...new Set(tutorIds.filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueTutorIds.length === 0) {
    return new Map<number, TutorProfile>();
  }

  let rows: Awaited<ReturnType<typeof getTutorProfileRowsByIds>>;
  try {
    rows = await getTutorProfileRowsByIds(uniqueTutorIds);
  } catch {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.database);
  }

  return new Map(
    rows.map(tutor => [
      tutor.id,
      {
        id: tutor.id,
        name: [tutor.firstName, tutor.lastName].filter(Boolean).join(' ') || MISSING_VALUE,
        email: tutor.email,
        phone: tutor.phone ?? MISSING_VALUE,
      },
    ])
  );
}

export async function getTutors(role: UserRole) {
  if (role !== 'admin') {
    forbidden();
  }

  let rawRows: Awaited<ReturnType<typeof getTutorJoinRows>>;
  try {
    rawRows = await getTutorJoinRows();
  } catch {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.database);
  }

  const parsedTutors = TutorJoinRowListSchema.safeParse(rawRows);
  if (!parsedTutors.success) {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.validation);
  }

  return parsedTutors.data.map(mapTutorRow);
}

export async function getTutor(id: number) {
  let rawRow: Awaited<ReturnType<typeof getTutorJoinRowById>>;
  try {
    rawRow = await getTutorJoinRowById(id);
  } catch {
    notFound();
  }

  const parsedTutor = TutorJoinRowSchema.safeParse(rawRow);
  if (!parsedTutor.success) {
    notFound();
  }

  return mapTutorDetail(parsedTutor.data);
}

export const tutorDataService = {
  getTutorProfileMapByIds,
  getTutors,
  getTutor,
};
