import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getParentIdByUserId } from '@/db/queries/actors';
import { sessions, students, users } from '@/db/schema';
import { getTutorProfileMapByIds } from '@/features/tutors/tutors-service';
import { getCurrentUserID, type UserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import type { SessionStatus } from '@/lib/validators/sessions';
import {
  StudentDetailWithJoinsSchema,
  StudentWithJoinsListSchema,
  type StudentDetailSession,
  type StudentWithJoins,
} from '@/lib/validators/students';
import { and, desc, eq } from 'drizzle-orm';

export type StudentRow = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  grade: string;
};

export type StudentSessionRow = {
  id: number;
  scheduled_at: string;
  ends_at: string;
  status: SessionStatus;
  slot_units: number;
  subject_name: string;
  tutor_name: string;
};

export type StudentProfileDetail = {
  id: number;
  user_id: number;
  parent_id: number | null;
  name: string;
  email: string;
  phone: string;
  grade: string;
  birth_date: string | null;
  learning_goals: string | null;
  sessions: StudentSessionRow[];
};

type StudentLoadErrorReason = 'database' | 'validation';
type AllowedRole = Exclude<UserRole, 'tutor'>;

const STUDENT_ERROR_MESSAGES = {
  admin: {
    database: 'Student data is temporarily unavailable. Please retry in a moment.',
    validation: 'Student data format is invalid. Please try again later.',
  },
  parent: {
    database: 'Your student list is temporarily unavailable. Please try again in a moment.',
    validation: 'There was a problem preparing your students list. Please try again.',
  },
} as const satisfies Record<AllowedRole, Record<StudentLoadErrorReason, string>>;

function isNextControlFlowError(error: Error) {
  const digest = 'digest' in error && typeof error.digest === 'string' ? error.digest : error.message;

  return digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;') || digest.startsWith('NEXT_REDIRECT;');
}

const RECENT_SESSIONS_LIMIT = 5;
async function getDb() {
  return (await import('@/db/client')).db;
}

type StudentJoinRow = {
  id: number;
  userId: number;
  parentId: number | null;
  birthDate: string | null;
  grade: string | null;
  learningGoals: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
};

function mapStudentJoinRow(row: StudentJoinRow) {
  return {
    id: row.id,
    user_id: row.userId,
    parent_id: row.parentId,
    birth_date: row.birthDate,
    grade: row.grade,
    learning_goals: row.learningGoals,
    users: {
      first_name: row.firstName,
      last_name: row.lastName,
      email: row.email,
      phone: row.phone,
    },
  };
}

const parseStudentUser = (users: StudentWithJoins['users']) => {
  const user = Array.isArray(users) ? users[0] : users;

  return {
    name: [user?.first_name, user?.last_name].filter(Boolean).join(' '),
    email: user?.email ?? '',
    phone: user?.phone ?? '—',
  };
};

const mapStudentRow = (student: Pick<StudentWithJoins, 'id' | 'user_id' | 'grade' | 'users'>) => {
  const user = parseStudentUser(student.users);

  return {
    id: student.id,
    user_id: student.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    grade: student.grade ?? '—',
  };
};

const mapSessionRow = (
  session: StudentDetailSession,
  subjectMap: Map<number, { name: string }>,
  tutorMap: Map<number, { name: string }>
) => {
  return {
    id: session.id,
    scheduled_at: session.scheduled_at,
    ends_at: session.ends_at,
    status: session.status,
    slot_units: session.slot_units,
    subject_name: subjectMap.get(session.subject_id)?.name ?? '—',
    tutor_name: tutorMap.get(session.tutor_id)?.name ?? '—',
  };
};

async function getParentIdForCurrentUser() {
  const userID = await getCurrentUserID();
  const parentId = await getParentIdByUserId(userID);

  if (!parentId) {
    notFound();
  }

  return parentId;
}

export async function getStudents(role: UserRole) {
  if (role === 'tutor') forbidden();
  const allowedRole: AllowedRole = role;

  try {
    const db = await getDb();
    const parentId = role === 'admin' ? null : await getParentIdForCurrentUser();
    const rows = await db
      .select({
        id: students.id,
        userId: students.userId,
        parentId: students.parentId,
        birthDate: students.birthDate,
        grade: students.grade,
        learningGoals: students.learningGoals,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(parentId === null ? undefined : eq(students.parentId, parentId));

    const parsedStudents = StudentWithJoinsListSchema.safeParse(rows.map(mapStudentJoinRow));
    if (!parsedStudents.success) {
      throw new Error(STUDENT_ERROR_MESSAGES[allowedRole]['validation']);
    }

    return parsedStudents.data.map(mapStudentRow);
  } catch (error) {
    if (error instanceof Error && error.message === STUDENT_ERROR_MESSAGES[allowedRole]['validation']) {
      throw error;
    }

    if (error instanceof Error && isNextControlFlowError(error)) {
      throw error;
    }

    throw new Error(STUDENT_ERROR_MESSAGES[allowedRole]['database']);
  }
}

export async function getStudent(id: number, role: UserRole) {
  if (role === 'tutor') forbidden();
  const allowedRole: AllowedRole = role;

  try {
    const db = await getDb();
    const parentId = role === 'admin' ? null : await getParentIdForCurrentUser();
    const filters = [eq(students.id, id)];

    if (parentId !== null) {
      filters.push(eq(students.parentId, parentId));
    }

    const studentRows = await db
      .select({
        id: students.id,
        userId: students.userId,
        parentId: students.parentId,
        birthDate: students.birthDate,
        grade: students.grade,
        learningGoals: students.learningGoals,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(...filters))
      .limit(1);

    const [studentRow] = studentRows;
    if (!studentRow) {
      notFound();
    }

    const recentSessions = await db
      .select({
        id: sessions.id,
        subject_id: sessions.subjectId,
        tutor_id: sessions.tutorId,
        scheduled_at: sessions.scheduledAt,
        ends_at: sessions.endsAt,
        status: sessions.status,
        slot_units: sessions.slotUnits,
      })
      .from(sessions)
      .where(eq(sessions.studentId, id))
      .orderBy(desc(sessions.scheduledAt))
      .limit(RECENT_SESSIONS_LIMIT);

    const parsedStudent = StudentDetailWithJoinsSchema.safeParse({
      ...mapStudentJoinRow(studentRow),
      sessions: recentSessions,
    });

    if (!parsedStudent.success) {
      throw new Error(STUDENT_ERROR_MESSAGES[allowedRole]['validation']);
    }

    const student = parsedStudent.data;
    const subjectMap = await getSubjectMapByIds((student.sessions ?? []).map(session => session.subject_id));
    const tutorMap = await getTutorProfileMapByIds((student.sessions ?? []).map(session => session.tutor_id));
    const mappedSessions = (student.sessions ?? []).map(session => mapSessionRow(session, subjectMap, tutorMap));
    const user = parseStudentUser(student.users);

    return {
      id: student.id,
      user_id: student.user_id,
      parent_id: student.parent_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      grade: student.grade ?? '—',
      birth_date: student.birth_date,
      learning_goals: student.learning_goals,
      sessions: mappedSessions,
    };
  } catch (error) {
    if (error instanceof Error && error.message === STUDENT_ERROR_MESSAGES[allowedRole]['validation']) {
      throw error;
    }

    if (error instanceof Error && isNextControlFlowError(error)) {
      throw error;
    }

    throw new Error(STUDENT_ERROR_MESSAGES[allowedRole]['database']);
  }
}

export const studentDataService = {
  getStudents,
  getStudent,
};
