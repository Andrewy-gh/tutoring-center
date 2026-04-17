import { notFound, redirect } from 'next/navigation';
import { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { getParentIdByUserId, getTutorIdByUserId } from '@/lib/db/queries/actors';
import { buildSessionListFilters, getSessionListRows, parseSessionListRows } from '@/lib/db/queries/sessions/list';
import { parents, sessionMetrics, sessionProgress, sessions, students, users } from '@/lib/db/schema';
import { slotUnitsToHours } from '@/lib/billing-units';
import { type SessionListQueryRow } from '@/lib/validators/sessions';
import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

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

export type StudentProgressHistory = {
  sessionId: number;
  date: string;
  tutorName: string;
};

type SessionLoadErrorReason = 'database' | 'validation';
type SubjectSummary = { name: string };
type TutorSummary = { name: string; email: string; phone: string };
type SessionDetailRow = {
  id: number;
  tutor_id: number;
  scheduled_at: string;
  ends_at: string;
  slot_units: number;
  status: string;
  subject_id: number;
  parent_id: number;
  student_id: number;
  student_parent_id: number | null;
  student_first_name: string | null;
  student_last_name: string | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_email: string | null;
  topics: string | null;
  homework_assigned: string | null;
  public_notes: string | null;
  internal_notes: string | null;
  confidence_score: number | null;
  session_performance: number | null;
  homework_completed: boolean | null;
  tutor_comments: string | null;
};
type TutorAssignedSessionRow = {
  id: number;
  tutor_id: number;
  student_id: number;
  subject_id: number;
  scheduled_at: string;
  ends_at: string;
  status: string;
  progress_id: number | null;
  metrics_id: number | null;
  student_first_name: string | null;
  student_last_name: string | null;
};
type StudentRecentProgressRow = {
  id: number;
  scheduled_at: string;
  tutor_id: number;
};

export type SessionDataServiceDeps = {
  getUserRole: () => Promise<UserRole>;
  getCurrentUserID: () => Promise<number>;
  getParentIdByUserId: (userId: number) => Promise<number | null>;
  getTutorIdByUserId: (userId: number) => Promise<number | null>;
  getSessionListRows: (filters: ReturnType<typeof buildSessionListFilters>) => Promise<SessionListQueryRow[]>;
  getSubjectMapByIds: (ids: number[]) => Promise<Map<number, SubjectSummary>>;
  getTutorProfileMapByIds: (ids: number[]) => Promise<Map<number, TutorSummary>>;
  getSessionDetail: (id: number) => Promise<SessionDetailRow | null>;
  getTutorAssignedSessionRows: (tutorId: number) => Promise<TutorAssignedSessionRow[]>;
  getStudentRecentProgressRows: (
    studentId: number,
    sessionIdToExclude: number,
    limit: number,
    nowIso: string
  ) => Promise<StudentRecentProgressRow[]>;
  now: () => string;
  notFound: () => never;
  redirect: (path: string) => never;
};

const SCHEDULED_SESSION_STATUSES = new Set(['Scheduled']);
const isValidRole = (value: unknown): value is UserRole => value === 'admin' || value === 'parent' || value === 'tutor';

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

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

const mapSessionRow = (
  session: SessionListQueryRow,
  subjectMap: Map<number, SubjectSummary>,
  tutorMap: Map<number, Pick<TutorSummary, 'name' | 'email'>>
): SessionRow => {
  const tutor = tutorMap.get(session.tutor_id) ?? { name: '—', email: '' };
  const subjectName = subjectMap.get(session.subject_id)?.name ?? 'Unknown';

  return {
    id: session.id,
    student_name: [session.student_first_name, session.student_last_name].filter(Boolean).join(' ') || '—',
    tutor_id: session.tutor_id,
    tutor_name: tutor.name,
    tutor_email: tutor.email,
    student_id: session.student_id,
    subject_id: session.subject_id,
    subject_name: subjectName,
    scheduled_at: session.scheduled_at,
    ends_at: session.ends_at,
    hours: slotUnitsToHours(session.slot_units),
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

async function getSessionDetail(id: number): Promise<SessionDetailRow | null> {
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

  return rows[0] ?? null;
}

async function getTutorAssignedSessionRows(tutorId: number): Promise<TutorAssignedSessionRow[]> {
  const db = await getDb();
  const studentUsers = alias(users, 'assigned_student_users');

  return db
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
}

async function getStudentRecentProgressRows(
  studentId: number,
  sessionIdToExclude: number,
  limit: number,
  nowIso: string
): Promise<StudentRecentProgressRow[]> {
  const db = await getDb();

  return db
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
        lt(sessions.scheduledAt, nowIso)
      )
    )
    .orderBy(desc(sessions.scheduledAt))
    .limit(limit);
}

export function createSessionDataService(deps: SessionDataServiceDeps) {
  return {
    async getSessions(kind: 'all' | 'upcoming' | 'past' = 'all') {
      const role = await deps.getUserRole();
      if (!isValidRole(role)) {
        throw new Error('Role is required to fetch sessions.');
      }

      let parentId: number | undefined;
      let tutorId: number | undefined;

      if (role !== 'admin') {
        const userId = await deps.getCurrentUserID();
        if (role === 'tutor') {
          tutorId = (await deps.getTutorIdByUserId(userId)) ?? undefined;
          if (!tutorId) {
            deps.notFound();
          }
        } else {
          parentId = (await deps.getParentIdByUserId(userId)) ?? undefined;
          if (!parentId) {
            deps.notFound();
          }
        }
      }

      const filters = buildSessionListFilters({
        kind,
        nowIso: deps.now(),
        parentId,
        tutorId,
        excludeCompletedForUpcoming: true,
      });

      let rows;
      try {
        rows = await deps.getSessionListRows(filters);
      } catch {
        throw new Error(SESSION_ERROR_MESSAGES[role].database);
      }

      const parsedSessions = parseSessionListRows(rows);
      if (!parsedSessions.success) {
        throw new Error(SESSION_ERROR_MESSAGES[role].validation);
      }

      const subjectMap = await deps.getSubjectMapByIds(parsedSessions.data.map(session => session.subject_id));
      const tutorMap = await deps.getTutorProfileMapByIds(parsedSessions.data.map(session => session.tutor_id));

      return parsedSessions.data.map(session => mapSessionRow(session, subjectMap, tutorMap)).sort(compareSessionRows);
    },

    async getSession(id: number): Promise<SessionDetailType> {
      const role = await deps.getUserRole();
      const data = await deps.getSessionDetail(id);

      if (!data) {
        deps.notFound();
      }

      if (role !== 'admin' && role !== 'tutor') {
        const userId = await deps.getCurrentUserID();
        const parentId = await deps.getParentIdByUserId(userId);

        if (!parentId) {
          deps.notFound();
        }

        if (data.parent_id !== parentId) {
          deps.redirect('/dashboard/sessions');
        }
      }

      const subjectMap = await deps.getSubjectMapByIds([data.subject_id]);
      const tutorMap = await deps.getTutorProfileMapByIds([data.tutor_id]);
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
    },

    async getTutorAssignedSessions(): Promise<TutorAssignedSession[]> {
      const role = await deps.getUserRole();
      if (role !== 'tutor') {
        return [];
      }

      const tutorUserId = await deps.getCurrentUserID();
      let tutorId: number;

      try {
        const resolvedTutorId = await deps.getTutorIdByUserId(tutorUserId);
        if (!resolvedTutorId) {
          return [];
        }

        tutorId = resolvedTutorId;
      } catch {
        return [];
      }

      const rows = await deps.getTutorAssignedSessionRows(tutorId);
      if (rows.length === 0) {
        return [];
      }

      const subjectMap = await deps.getSubjectMapByIds(rows.map(session => session.subject_id));

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
    },

    async getStudentRecentProgress(
      studentId: number,
      sessionIdToExclude: number,
      limit: number = 5
    ): Promise<StudentProgressHistory[]> {
      try {
        const rows = await deps.getStudentRecentProgressRows(studentId, sessionIdToExclude, limit, deps.now());
        const tutorMap = await deps.getTutorProfileMapByIds(rows.map(session => session.tutor_id));

        return rows.map(session => ({
          sessionId: session.id,
          date: session.scheduled_at,
          tutorName: tutorMap.get(session.tutor_id)?.name ?? 'Unknown Tutor',
        }));
      } catch {
        return [];
      }
    },
  };
}

export const sessionDataService = createSessionDataService({
  getUserRole,
  getCurrentUserID,
  getParentIdByUserId,
  getTutorIdByUserId,
  getSessionListRows,
  getSubjectMapByIds,
  getTutorProfileMapByIds,
  getSessionDetail,
  getTutorAssignedSessionRows,
  getStudentRecentProgressRows,
  now: () => new Date().toISOString(),
  notFound,
  redirect: path => redirect(path as Parameters<typeof redirect>[0]),
});
