import 'server-only';
import { sessionMetrics, sessions, studentGrades, students, subjects, users } from '@/db/schema';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

export type ParentDashboardDateRange = {
  from: string | undefined;
  to: string | undefined;
};

export type ParentDashboardSessionMetricsRow = {
  id: number;
  scheduled_at: string;
  student_id: number;
  subject_id: number;
  session_performance: number | null;
  confidence_score: number | null;
  homework_completed: boolean;
};

export type ParentDashboardStudentRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
};

export type ParentDashboardGradeRow = {
  id: number;
  subject_id: number;
  grade: string;
  created_at: string;
};

async function getDb() {
  return (await import('@/db/client')).db;
}

function buildSessionMetricFilters(dateRange: ParentDashboardDateRange | undefined, studentIds?: number[]) {
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

export async function getParentDashboardStudentRows(parentId: number) {
  const db = await getDb();

  return db
    .select({
      id: students.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .where(eq(students.parentId, parentId));
}

export async function getCompletedSessionMetricRows(dateRange?: ParentDashboardDateRange, studentIds?: number[]) {
  if (studentIds && studentIds.length === 0) {
    return [];
  }

  const db = await getDb();

  return db
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
}

export async function getStudentGradeRows(studentId: number) {
  const db = await getDb();

  return db
    .select({
      id: studentGrades.id,
      subject_id: studentGrades.subjectId,
      grade: studentGrades.grade,
      created_at: studentGrades.createdAt,
    })
    .from(studentGrades)
    .where(eq(studentGrades.studentId, studentId))
    .orderBy(asc(studentGrades.createdAt));
}

export async function getActiveLeafSubjectNameRows() {
  const db = await getDb();

  return db
    .select({ name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.kind, 'leaf'), eq(subjects.isActive, true)))
    .orderBy(asc(subjects.name));
}
