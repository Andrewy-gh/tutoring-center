import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, type UserRole } from '@/lib/auth';
import type { SubjectForGradeForm } from '@/lib/data/subjects';
import { parents, studentGrades, students, subjects, users } from '@/lib/db/schema';
import { GradeInputSchema, type GradeInput } from '@/lib/validators/grades';
import { and, eq } from 'drizzle-orm';

export type StudentForGradeForm = {
  id: number;
  name: string;
};

export { SubjectForGradeForm };

type GradeErrorReason = 'database' | 'validation' | 'forbidden';
const GRADE_SUBJECT_KIND = 'leaf' as const;

const GRADE_ERROR_MESSAGES = {
  database: 'Failed to save grade. Please try again.',
  validation: 'Grade data is invalid. Please check your input.',
  forbidden: 'You do not have permission to add grades for this student.',
} as const satisfies Record<GradeErrorReason, string>;
const GRADE_KNOWN_ERRORS = new Set(Object.values(GRADE_ERROR_MESSAGES));

function isNextControlFlowError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const digest = 'digest' in error && typeof error.digest === 'string' ? error.digest : error.message;

  return digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;') || digest.startsWith('NEXT_REDIRECT;');
}

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export function percentageToLetterGrade(percentage: number): string {
  switch (true) {
    case percentage >= 97:
      return 'A+';
    case percentage >= 93:
      return 'A';
    case percentage >= 90:
      return 'A-';
    case percentage >= 87:
      return 'B+';
    case percentage >= 83:
      return 'B';
    case percentage >= 80:
      return 'B-';
    case percentage >= 77:
      return 'C+';
    case percentage >= 73:
      return 'C';
    case percentage >= 70:
      return 'C-';
    case percentage >= 67:
      return 'D+';
    case percentage >= 63:
      return 'D';
    case percentage >= 60:
      return 'D-';
    default:
      return 'F';
  }
}

export async function getStudentsForGradeForm(role: UserRole) {
  if (role === 'tutor') forbidden();

  const db = await getDb();
  let parentId: number | null = null;
  if (role !== 'admin') {
    const userID = await getCurrentUserID();

    try {
      const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userID)).limit(1);

      if (!parent) notFound();
      parentId = parent.id;
    } catch (error) {
      if (isNextControlFlowError(error)) {
        throw error;
      }

      throw new Error(GRADE_ERROR_MESSAGES.database);
    }
  }

  try {
    const rows = await db
      .select({
        id: students.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(parentId === null ? undefined : eq(students.parentId, parentId));

    return rows.map(student => ({
      id: student.id,
      name: [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Unknown',
    }));
  } catch {
    throw new Error(GRADE_ERROR_MESSAGES.database);
  }
}

export async function addGrade(input: GradeInput) {
  const parsed = GradeInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(GRADE_ERROR_MESSAGES.validation);
  }

  const { student_id, subject_id, grade } = parsed.data;

  const db = await getDb();
  const userID = await getCurrentUserID();
  try {
    const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userID)).limit(1);

    if (!parent) {
      throw new Error(GRADE_ERROR_MESSAGES.forbidden);
    }

    const [student] = await db
      .select({ id: students.id, parent_id: students.parentId })
      .from(students)
      .where(eq(students.id, student_id))
      .limit(1);

    if (!student) {
      throw new Error(GRADE_ERROR_MESSAGES.validation);
    }

    if (student.parent_id === null || student.parent_id !== parent.id) {
      throw new Error(GRADE_ERROR_MESSAGES.forbidden);
    }

    const [subjectData] = await db
      .select({ id: subjects.id, name: subjects.name, kind: subjects.kind })
      .from(subjects)
      .where(and(eq(subjects.id, subject_id), eq(subjects.kind, GRADE_SUBJECT_KIND)))
      .limit(1);

    if (!subjectData) {
      throw new Error(GRADE_ERROR_MESSAGES.validation);
    }

    const letterGrade = percentageToLetterGrade(grade);

    const [insertedGrade] = await db
      .insert(studentGrades)
      .values({
        studentId: student_id,
        subjectId: subject_id,
        subjectKind: GRADE_SUBJECT_KIND,
        grade: letterGrade,
      })
      .returning({
        id: studentGrades.id,
        student_id: studentGrades.studentId,
        subject_id: studentGrades.subjectId,
        subject_kind: studentGrades.subjectKind,
        grade: studentGrades.grade,
        created_at: studentGrades.createdAt,
      });

    return {
      ...insertedGrade,
      subject: subjectData.name,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      GRADE_KNOWN_ERRORS.has(error.message as (typeof GRADE_ERROR_MESSAGES)[GradeErrorReason])
    ) {
      throw error;
    }

    throw new Error(GRADE_ERROR_MESSAGES.database);
  }
}

export async function getSubjectsForGradeForm() {
  return (await import('@/lib/data/subjects')).getSubjectsForGradeForm();
}
