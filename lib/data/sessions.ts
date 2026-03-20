import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { parents, sessionMetrics, sessionProgress, sessions, students, tutors, users } from '@/lib/db/schema';
import { SessionWithJoinsListSchema, type SessionWithJoins } from '@/lib/validators/sessions';
import { and, desc, eq, gte, lt, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';

export type SessionRow = {
  id: number;
  student_name: string;
  tutor_id: number;
  tutor_name: string;
  tutor_email: string;
  student_id: number;
  subject_id: number;
  subject_name: string;
  scheduled_at: string;
  ends_at: string;
  hours: number;
  status: string;
};

type SessionLoadErrorReason = 'database' | 'validation';

const SCHEDULED_SESSION_STATUSES = new Set(['Scheduled']);
const isValidRole = (value: unknown): value is UserRole => value === 'admin' || value === 'parent' || value === 'tutor';
async function getDb() {
  return (await import('@/lib/db/client')).db;
}

const SESSION_ERROR_MESSAGES: Record<UserRole, Record<SessionLoadErrorReason, string>> = {
  admin: {
    database: 'Session data is temporarily unavailable. Please retry in a moment.',
    validation: 'Session data format is invalid. Please try again later.',
  },
  parent: {
    database: 'Your session list is temporarily unavailable. Please retry in a moment.',
    validation: 'There was a problem preparing your students list. Please try again.',
  },
  tutor: {
    database: 'Your session list is temporarily unavailable. Please retry in a moment.',
    validation: 'Session data format is invalid. Please try again later.',
  },
};

type SessionListJoinRow = {
  id: unknown;
  tutorId: unknown;
  studentId: unknown;
  subjectId: unknown;
  parentId: unknown;
  slotUnits: unknown;
  scheduledAt: unknown;
  endsAt: unknown;
  status: unknown;
  studentParentId: unknown;
  studentLearningGoals: unknown;
  studentFirstName: unknown;
  studentLastName: unknown;
  studentEmail: unknown;
  parentBillingAddress: unknown;
  parentNotificationPreferences: unknown;
  parentFirstName: unknown;
  parentLastName: unknown;
  parentEmail: unknown;
};

const mapSessionJoinRow = (row: SessionListJoinRow): SessionWithJoins => ({
  id: row.id as number,
  tutor_id: row.tutorId as number,
  student_id: row.studentId as number,
  subject_id: row.subjectId as number,
  parent_id: row.parentId as number,
  slot_units: row.slotUnits as number,
  scheduled_at: row.scheduledAt as string,
  ends_at: row.endsAt as string,
  status: row.status as SessionWithJoins['status'],
  student: {
    id: row.studentId as number,
    parent_id: row.studentParentId as number | null,
    learning_goals: row.studentLearningGoals as string | null,
    users: {
      first_name: row.studentFirstName as string | null,
      last_name: row.studentLastName as string | null,
      email: row.studentEmail as string,
    },
  },
  parent: {
    id: row.parentId as number,
    billing_address: row.parentBillingAddress as string | null,
    notification_preferences: row.parentNotificationPreferences as string | null,
    users: {
      first_name: row.parentFirstName as string | null,
      last_name: row.parentLastName as string | null,
      email: row.parentEmail as string,
    },
  },
});

const parseStudentUser = (student: SessionWithJoins['student']) => {
  if (!student) return { name: '—' };

  const studentData = Array.isArray(student) ? student[0] : student;
  const user = studentData?.users
    ? Array.isArray(studentData.users)
      ? studentData.users[0]
      : studentData.users
    : null;

  return {
    name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—',
  };
};

const mapSessionRow = (
  session: SessionWithJoins,
  subjectMap: Map<number, { name: string }>,
  tutorMap: Map<number, { name: string; email: string }>
): SessionRow => {
  const student = parseStudentUser(session.student);
  const tutor = tutorMap.get(session.tutor_id) ?? { name: '—', email: '' };
  const subjectName = subjectMap.get(session.subject_id)?.name ?? 'Unknown';

  return {
    id: session.id,
    student_name: student.name,
    tutor_id: session.tutor_id,
    tutor_name: tutor.name,
    tutor_email: tutor.email,
    student_id: session.student_id,
    subject_id: session.subject_id,
    subject_name: subjectName,
    scheduled_at: session.scheduled_at,
    ends_at: session.ends_at,
    hours: session.slot_units,
    status: session.status,
  };
};

const compareSessionRows = (left: SessionRow, right: SessionRow) => {
  const leftBucket = SCHEDULED_SESSION_STATUSES.has(left.status) ? 0 : 1;
  const rightBucket = SCHEDULED_SESSION_STATUSES.has(right.status) ? 0 : 1;

  if (leftBucket !== rightBucket) {
    return leftBucket - rightBucket;
  }

  return new Date(right.scheduled_at).getTime() - new Date(left.scheduled_at).getTime();
};

async function getParentIdForUser(userId: number) {
  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  if (!parent) {
    notFound();
  }

  return parent.id;
}

async function getTutorIdForUser(userId: number) {
  const db = await getDb();
  const [tutor] = await db.select({ id: tutors.id }).from(tutors).where(eq(tutors.userId, userId)).limit(1);

  if (!tutor) {
    notFound();
  }

  return tutor.id;
}

function getSessionListBaseQuery(database: Awaited<ReturnType<typeof getDb>>) {
  const studentUsers = alias(users, 'session_student_users');
  const parentUsers = alias(users, 'session_parent_users');

  return database
    .select({
      id: sessions.id,
      tutorId: sessions.tutorId,
      studentId: sessions.studentId,
      subjectId: sessions.subjectId,
      parentId: sessions.parentId,
      slotUnits: sessions.slotUnits,
      scheduledAt: sessions.scheduledAt,
      endsAt: sessions.endsAt,
      status: sessions.status,
      studentParentId: students.parentId,
      studentLearningGoals: students.learningGoals,
      studentFirstName: studentUsers.firstName,
      studentLastName: studentUsers.lastName,
      studentEmail: studentUsers.email,
      parentBillingAddress: parents.billingAddress,
      parentNotificationPreferences: parents.notificationPreferences,
      parentFirstName: parentUsers.firstName,
      parentLastName: parentUsers.lastName,
      parentEmail: parentUsers.email,
    })
    .from(sessions)
    .innerJoin(students, eq(sessions.studentId, students.id))
    .innerJoin(studentUsers, eq(students.userId, studentUsers.id))
    .innerJoin(parents, eq(sessions.parentId, parents.id))
    .innerJoin(parentUsers, eq(parents.userId, parentUsers.id));
}

export async function getSessions(kind: 'all' | 'upcoming' | 'past' = 'all') {
  const role = await getUserRole();
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch sessions.');
  }

  const filters = [];
  if (kind === 'upcoming') {
    const now = new Date().toISOString();
    filters.push(gte(sessions.scheduledAt, now), ne(sessions.status, 'Completed'));
  } else if (kind === 'past') {
    filters.push(lt(sessions.scheduledAt, new Date().toISOString()));
  }

  if (role !== 'admin') {
    const userID = await getCurrentUserID();
    if (role === 'tutor') {
      filters.push(eq(sessions.tutorId, await getTutorIdForUser(userID)));
    } else {
      filters.push(eq(sessions.parentId, await getParentIdForUser(userID)));
    }
  }

  let rows: SessionListJoinRow[];
  try {
    const db = await getDb();
    const query = getSessionListBaseQuery(db);
    rows = await query.where(filters.length === 0 ? undefined : and(...filters));
  } catch {
    throw new Error(SESSION_ERROR_MESSAGES[role].database);
  }

  const parsedSessions = SessionWithJoinsListSchema.safeParse(rows.map(mapSessionJoinRow));
  if (!parsedSessions.success) {
    throw new Error(SESSION_ERROR_MESSAGES[role].validation);
  }

  const subjectMap = await getSubjectMapByIds(parsedSessions.data.map(session => session.subject_id));
  const tutorMap = await getTutorProfileMapByIds(parsedSessions.data.map(session => session.tutor_id));
  return parsedSessions.data.map(session => mapSessionRow(session, subjectMap, tutorMap)).sort(compareSessionRows);
}

export type SessionDetailType = {
  id: number;
  scheduled_at: string;
  ends_at: string;
  slot_units: number;
  status: string;
  subject_id: number;
  subject_name: string;
  tutor: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  student: {
    id: number;
    name: string;
    parent_id: number;
    parent_name: string;
    parent_email: string;
  };
  progress: {
    topics: string | null;
    homework_assigned: string | null;
    public_notes: string | null;
    internal_notes: string | null;
  } | null;
  metrics: {
    confidence_score: number | null;
    session_performance: number | null;
    homework_completed: boolean;
    tutor_comments: string | null;
  } | null;
};

export async function getSession(id: number): Promise<SessionDetailType> {
  const role = await getUserRole();
  const db = await getDb();
  const studentUsers = alias(users, 'session_detail_student_users');
  const parentUsers = alias(users, 'session_detail_parent_users');

  const rows = await db
    .select({
      id: sessions.id,
      tutor_id: sessions.tutorId,
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      slot_units: sessions.slotUnits,
      status: sessions.status,
      subject_id: sessions.subjectId,
      parent_id: sessions.parentId,
      student_id: students.id,
      student_parent_id: students.parentId,
      student_first_name: studentUsers.firstName,
      student_last_name: studentUsers.lastName,
      parent_first_name: parentUsers.firstName,
      parent_last_name: parentUsers.lastName,
      parent_email: parentUsers.email,
      topics: sessionProgress.topics,
      homework_assigned: sessionProgress.homeworkAssigned,
      public_notes: sessionProgress.publicNotes,
      internal_notes: sessionProgress.internalNotes,
      confidence_score: sessionMetrics.confidenceScore,
      session_performance: sessionMetrics.sessionPerformance,
      homework_completed: sessionMetrics.homeworkCompleted,
      tutor_comments: sessionMetrics.tutorComments,
    })
    .from(sessions)
    .innerJoin(students, eq(sessions.studentId, students.id))
    .innerJoin(studentUsers, eq(students.userId, studentUsers.id))
    .innerJoin(parents, eq(sessions.parentId, parents.id))
    .innerJoin(parentUsers, eq(parents.userId, parentUsers.id))
    .leftJoin(sessionProgress, eq(sessionProgress.sessionId, sessions.id))
    .leftJoin(sessionMetrics, eq(sessionMetrics.sessionId, sessions.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const [data] = rows;
  if (!data) {
    notFound();
  }

  if (role !== 'admin' && role !== 'tutor') {
    const userID = await getCurrentUserID();
    const parentId = await getParentIdForUser(userID);

    if (data.parent_id !== parentId) {
      redirect('/dashboard/sessions');
    }
  }

  const subjectMap = await getSubjectMapByIds([data.subject_id]);
  const tutorMap = await getTutorProfileMapByIds([data.tutor_id]);
  const tutorProfile = tutorMap.get(data.tutor_id);

  return {
    id: data.id,
    scheduled_at: data.scheduled_at,
    ends_at: data.ends_at,
    slot_units: data.slot_units,
    status: data.status,
    subject_id: data.subject_id,
    subject_name: subjectMap.get(data.subject_id)?.name ?? 'Unknown',
    tutor: {
      id: data.tutor_id,
      name: tutorProfile?.name ?? '—',
      email: tutorProfile?.email || '—',
      phone: tutorProfile?.phone || '—',
    },
    student: {
      id: data.student_id,
      name: [data.student_first_name, data.student_last_name].filter(Boolean).join(' ') || '—',
      parent_id: data.student_parent_id ?? 0,
      parent_name: [data.parent_first_name, data.parent_last_name].filter(Boolean).join(' ') || '—',
      parent_email: data.parent_email || '—',
    },
    progress:
      data.topics !== null ||
      data.homework_assigned !== null ||
      data.public_notes !== null ||
      data.internal_notes !== null
        ? {
            topics: data.topics,
            homework_assigned: data.homework_assigned,
            public_notes: data.public_notes,
            internal_notes: data.internal_notes,
          }
        : null,
    metrics:
      data.confidence_score !== null ||
      data.session_performance !== null ||
      data.homework_completed !== null ||
      data.tutor_comments !== null
        ? {
            confidence_score: data.confidence_score,
            session_performance: data.session_performance,
            homework_completed: data.homework_completed ?? false,
            tutor_comments: data.tutor_comments,
          }
        : null,
  };
}

export type TutorAssignedSession = {
  id: number;
  student_name: string;
  student_id: number;
  tutor_id: number;
  subject_name: string;
  scheduled_at: string;
  ends_at: string;
  status: string;
  needsProgressReport: boolean;
  needsMetrics: boolean;
};

export async function getTutorAssignedSessions(): Promise<TutorAssignedSession[]> {
  const role = await getUserRole();
  if (role !== 'tutor') {
    return [];
  }

  const db = await getDb();
  const tutorUserId = await getCurrentUserID();
  let tutorId: number;

  try {
    tutorId = await getTutorIdForUser(tutorUserId);
  } catch {
    return [];
  }

  const studentUsers = alias(users, 'assigned_student_users');

  const rows = await db
    .select({
      id: sessions.id,
      tutor_id: sessions.tutorId,
      student_id: sessions.studentId,
      subject_id: sessions.subjectId,
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
      progress_id: sessionProgress.id,
      metrics_id: sessionMetrics.id,
      student_first_name: studentUsers.firstName,
      student_last_name: studentUsers.lastName,
    })
    .from(sessions)
    .innerJoin(students, eq(sessions.studentId, students.id))
    .innerJoin(studentUsers, eq(students.userId, studentUsers.id))
    .leftJoin(sessionProgress, eq(sessionProgress.sessionId, sessions.id))
    .leftJoin(sessionMetrics, eq(sessionMetrics.sessionId, sessions.id))
    .where(eq(sessions.tutorId, tutorId));

  if (rows.length === 0) {
    return [];
  }

  const subjectMap = await getSubjectMapByIds(rows.map(session => session.subject_id));

  return rows
    .map(row => ({
      id: row.id,
      student_name: [row.student_first_name, row.student_last_name].filter(Boolean).join(' ').trim() || 'Student',
      student_id: row.student_id,
      tutor_id: row.tutor_id,
      subject_name: subjectMap.get(row.subject_id)?.name ?? 'Subject',
      scheduled_at: row.scheduled_at,
      ends_at: row.ends_at,
      status: row.status,
      needsProgressReport: row.progress_id === null,
      needsMetrics: row.metrics_id === null,
    }))
    .filter(session => session.needsProgressReport || session.needsMetrics);
}

export type StudentProgressHistory = {
  sessionId: number;
  date: string;
  tutorName: string;
};

export async function getStudentRecentProgress(
  studentId: number,
  sessionIdToExclude: number,
  limit: number = 5
): Promise<StudentProgressHistory[]> {
  const db = await getDb();
  const now = new Date().toISOString();

  const rows = await db
    .select({
      id: sessions.id,
      scheduled_at: sessions.scheduledAt,
      tutor_id: sessions.tutorId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.studentId, studentId),
        eq(sessions.status, 'Completed'),
        ne(sessions.id, sessionIdToExclude),
        lt(sessions.scheduledAt, now)
      )
    )
    .orderBy(desc(sessions.scheduledAt))
    .limit(limit);

  const tutorMap = await getTutorProfileMapByIds(rows.map(session => session.tutor_id));

  return rows.map(session => ({
    sessionId: session.id,
    date: session.scheduled_at,
    tutorName: tutorMap.get(session.tutor_id)?.name ?? 'Unknown Tutor',
  }));
}
