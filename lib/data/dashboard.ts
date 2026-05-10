import 'server-only';
import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import { sessionMetrics, sessions, studentGrades, students, subjects, users } from '@/lib/db/schema';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

export type DateRange = {
  from: string | undefined;
  to: string | undefined;
};

export type PerformanceDataPoint = {
  date: string;
  score: number;
  sessionId: number;
  subject: string;
  subjectSlug: string;
};

export type ConfidenceDataPoint = {
  date: string;
  score: number;
  sessionId: number;
  subject: string;
  subjectSlug: string;
};

export type HomeworkDataPoint = {
  date: string;
  completed: boolean;
  sessionId: number;
  subject: string;
  subjectSlug: string;
};

export type StudentProgressData = {
  studentId: number;
  studentName: string;
  performance: PerformanceDataPoint[];
  confidence: ConfidenceDataPoint[];
  homework: HomeworkDataPoint[];
};

type SessionMetricsRow = {
  id: number;
  scheduled_at: string;
  student_id: number;
  subject_id: number;
  session_performance: number | null;
  confidence_score: number | null;
  homework_completed: boolean;
};

type SubjectSummary = {
  name: string;
  slug: string;
};

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

function getSubjectSummary(subjectMap: Map<number, SubjectSummary>, subjectId: number) {
  return subjectMap.get(subjectId) ?? { name: 'Unknown', slug: 'unknown' };
}

function buildSessionMetricFilters(dateRange: DateRange | undefined, studentIds?: number[]) {
  const filters = [eq(sessions.status, 'Completed')];

  if (studentIds && studentIds.length > 0) {
    filters.push(inArray(sessions.studentId, studentIds));
  }

  if (dateRange?.from) {
    filters.push(gte(sessions.scheduledAt, dateRange.from));
  }

  if (dateRange?.to) {
    filters.push(lte(sessions.scheduledAt, dateRange.to));
  }

  return filters;
}

async function getCompletedSessionMetrics(dateRange?: DateRange, studentIds?: number[]) {
  if (studentIds && studentIds.length === 0) {
    return [] as SessionMetricsRow[];
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: sessions.id,
      scheduled_at: sessions.scheduledAt,
      student_id: sessions.studentId,
      subject_id: sessions.subjectId,
      session_performance: sessionMetrics.sessionPerformance,
      confidence_score: sessionMetrics.confidenceScore,
      homework_completed: sessionMetrics.homeworkCompleted,
    })
    .from(sessions)
    .innerJoin(sessionMetrics, eq(sessionMetrics.sessionId, sessions.id))
    .where(and(...buildSessionMetricFilters(dateRange, studentIds)))
    .orderBy(asc(sessions.scheduledAt));

  return rows;
}

function getEmptyStudentProgress(studentId: number, studentName: string) {
  return {
    studentId,
    studentName,
    performance: [],
    confidence: [],
    homework: [],
  };
}

function buildStudentProgress(
  studentId: number,
  studentName: string,
  sessionRows: SessionMetricsRow[],
  subjectMap: Map<number, SubjectSummary>
) {
  const performance: PerformanceDataPoint[] = [];
  const confidence: ConfidenceDataPoint[] = [];
  const homework: HomeworkDataPoint[] = [];

  for (const session of sessionRows) {
    const subject = getSubjectSummary(subjectMap, session.subject_id);

    if (session.session_performance !== null && session.session_performance !== undefined) {
      performance.push({
        date: session.scheduled_at,
        score: session.session_performance,
        sessionId: session.id,
        subject: subject.name,
        subjectSlug: subject.slug,
      });
    }

    if (session.confidence_score !== null && session.confidence_score !== undefined) {
      confidence.push({
        date: session.scheduled_at,
        score: session.confidence_score,
        sessionId: session.id,
        subject: subject.name,
        subjectSlug: subject.slug,
      });
    }

    if (session.homework_completed !== null && session.homework_completed !== undefined) {
      homework.push({
        date: session.scheduled_at,
        completed: session.homework_completed,
        sessionId: session.id,
        subject: subject.name,
        subjectSlug: subject.slug,
      });
    }
  }

  return {
    studentId,
    studentName,
    performance,
    confidence,
    homework,
  };
}

export async function getStudentProgressData(studentId: number, studentName: string, dateRange?: DateRange) {
  try {
    const sessionRows = await getCompletedSessionMetrics(dateRange, [studentId]);
    if (sessionRows.length === 0) {
      return getEmptyStudentProgress(studentId, studentName);
    }

    const subjectMap = await getSubjectMapByIds(sessionRows.map(session => session.subject_id));
    return buildStudentProgress(studentId, studentName, sessionRows, subjectMap);
  } catch {
    return getEmptyStudentProgress(studentId, studentName);
  }
}

export async function getStudentsWithProgress(dateRange?: DateRange, subject?: string) {
  const role = await getUserRole();
  if (role !== 'parent') {
    return [];
  }

  const userID = await getCurrentUserID();
  if (!userID) {
    return [];
  }

  let studentMap: Map<number, string>;

  try {
    const db = await getDb();
    const parentId = await getParentIdByUserId(userID);

    if (!parentId) {
      return [];
    }

    const studentRows = await db
      .select({
        id: students.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(students.parentId, parentId));

    if (studentRows.length === 0) {
      return [];
    }

    studentMap = new Map<number, string>();
    for (const student of studentRows) {
      studentMap.set(student.id, [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Student');
    }
  } catch {
    return [];
  }

  try {
    const sessionRows = await getCompletedSessionMetrics(dateRange, Array.from(studentMap.keys()));
    const subjectMap = await getSubjectMapByIds(sessionRows.map(session => session.subject_id));
    const sessionsByStudent = new Map<number, SessionMetricsRow[]>();

    for (const session of sessionRows) {
      if (subject) {
        const sessionSubject = getSubjectSummary(subjectMap, session.subject_id);
        if (sessionSubject.slug !== subject) {
          continue;
        }
      }

      const existing = sessionsByStudent.get(session.student_id) ?? [];
      existing.push(session);
      sessionsByStudent.set(session.student_id, existing);
    }

    return Array.from(studentMap.entries()).map(([studentId, studentName]) =>
      buildStudentProgress(studentId, studentName, sessionsByStudent.get(studentId) ?? [], subjectMap)
    );
  } catch {
    return Array.from(studentMap.entries()).map(([studentId, studentName]) =>
      getEmptyStudentProgress(studentId, studentName)
    );
  }
}

export async function getParentDashboardData(dateRange?: DateRange, subject?: string) {
  const studentsWithProgress = await getStudentsWithProgress(dateRange, subject);

  return {
    students: studentsWithProgress,
    defaultStudentId: studentsWithProgress[0]?.studentId ?? null,
  };
}

export type GradeDataPoint = {
  id: number;
  subject: string;
  subjectSlug: string;
  grade: string;
  createdAt: string;
};

export async function getStudentGrades(studentId: number) {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        id: studentGrades.id,
        subject_id: studentGrades.subjectId,
        grade: studentGrades.grade,
        created_at: studentGrades.createdAt,
      })
      .from(studentGrades)
      .where(eq(studentGrades.studentId, studentId))
      .orderBy(asc(studentGrades.createdAt));

    const subjectMap = await getSubjectMapByIds(rows.map(row => row.subject_id));

    return rows.map(row => {
      const subject = getSubjectSummary(subjectMap, row.subject_id);

      return {
        id: row.id,
        subject: subject.name,
        subjectSlug: subject.slug,
        grade: row.grade,
        createdAt: row.created_at,
      };
    });
  } catch {
    return [];
  }
}

export async function getAllSubjects() {
  try {
    const db = await getDb();
    const rows = await db
      .select({ name: subjects.name })
      .from(subjects)
      .where(and(eq(subjects.kind, 'leaf'), eq(subjects.isActive, true)))
      .orderBy(asc(subjects.name));

    return rows.map(row => row.name).filter(Boolean);
  } catch {
    return [];
  }
}
