import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, type UserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { parents, sessions, students, users } from '@/lib/db/schema';
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

const isValidRole = (value: unknown): value is UserRole => value === 'admin' || value === 'parent' || value === 'tutor';

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
const STUDENT_CONTROL_FLOW_ERRORS = new Set(['notFound', 'forbidden']);

const RECENT_SESSIONS_LIMIT = 5;
async function getDb() {
  return (await import('@/lib/db/client')).db;
}

type StudentJoinRow = {
  id: unknown;
  userId: unknown;
  parentId: unknown;
  birthDate: unknown;
  grade: unknown;
  learningGoals: unknown;
  firstName: unknown;
  lastName: unknown;
  email: unknown;
  phone: unknown;
};

function mapStudentJoinRow(row: StudentJoinRow): StudentWithJoins {
  return {
    id: row.id as number,
    user_id: row.userId as number,
    parent_id: row.parentId as number | null,
    birth_date: row.birthDate as string | null,
    grade: row.grade as string | null,
    learning_goals: row.learningGoals as string | null,
    users: {
      first_name: row.firstName as string | null,
      last_name: row.lastName as string | null,
      email: row.email as string,
      phone: row.phone as string | null,
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
): StudentSessionRow => {
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
  const db = await getDb();
  const userID = await getCurrentUserID();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userID)).limit(1);

  if (!parent) {
    notFound();
  }

  return parent.id;
}

export async function getStudents(role: UserRole) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch students.');
  }

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
    if (
      error instanceof Error &&
      (error.message === STUDENT_ERROR_MESSAGES[allowedRole]['validation'] ||
        STUDENT_CONTROL_FLOW_ERRORS.has(error.message))
    ) {
      throw error;
    }

    throw new Error(STUDENT_ERROR_MESSAGES[allowedRole]['database']);
  }
}

export async function getStudent(id: number, role: UserRole) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch students.');
  }

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
    if (
      error instanceof Error &&
      (error.message === STUDENT_ERROR_MESSAGES[allowedRole]['validation'] ||
        STUDENT_CONTROL_FLOW_ERRORS.has(error.message))
    ) {
      throw error;
    }

    throw new Error(STUDENT_ERROR_MESSAGES[allowedRole]['database']);
  }
}
