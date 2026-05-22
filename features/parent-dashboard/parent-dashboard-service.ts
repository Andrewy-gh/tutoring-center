import 'server-only';
import { getParentIdByUserId } from '@/db/queries/actors';
import {
  getActiveLeafSubjectNameRows,
  getCompletedSessionMetricRows,
  getParentDashboardStudentRows,
  getStudentGradeRows,
  type ParentDashboardSessionMetricsRow,
} from '@/db/queries/parent-dashboard';
import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';

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

export type GradeDataPoint = {
  id: number;
  subject: string;
  subjectSlug: string;
  grade: string;
  createdAt: string;
};

type SubjectSummary = {
  name: string;
  slug: string;
};

function getSubjectSummary(subjectMap: Map<number, SubjectSummary>, subjectId: number) {
  return subjectMap.get(subjectId) ?? { name: 'Unknown', slug: 'unknown' };
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
  sessionRows: ParentDashboardSessionMetricsRow[],
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

function getStudentName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Student';
}

export async function getStudentProgressData(studentId: number, studentName: string, dateRange?: DateRange) {
  try {
    const sessionRows = await getCompletedSessionMetricRows(dateRange, [studentId]);
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
    const parentId = await getParentIdByUserId(userID);

    if (!parentId) {
      return [];
    }

    const studentRows = await getParentDashboardStudentRows(parentId);

    if (studentRows.length === 0) {
      return [];
    }

    studentMap = new Map<number, string>();
    for (const student of studentRows) {
      studentMap.set(student.id, getStudentName(student.firstName, student.lastName));
    }
  } catch {
    return [];
  }

  try {
    const sessionRows = await getCompletedSessionMetricRows(dateRange, Array.from(studentMap.keys()));
    const subjectMap = await getSubjectMapByIds(sessionRows.map(session => session.subject_id));
    const sessionsByStudent = new Map<number, ParentDashboardSessionMetricsRow[]>();

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

export async function getStudentGrades(studentId: number) {
  try {
    const rows = await getStudentGradeRows(studentId);
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
    const rows = await getActiveLeafSubjectNameRows();

    return rows.map(row => row.name).filter(Boolean);
  } catch {
    return [];
  }
}

export const parentDashboardDataService = {
  getAllSubjects,
  getParentDashboardData,
  getStudentGrades,
  getStudentProgressData,
  getStudentsWithProgress,
};
