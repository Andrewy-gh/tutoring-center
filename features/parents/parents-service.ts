import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getParentDetailJoinRowsByUserId, getParentListJoinRows } from '@/db/queries/parents';
import { minutesToCredits } from '@/features/credits/billing-units';
import type { UserRole } from '@/lib/auth';
import {
  ParentDetailJoinRowListSchema,
  ParentListJoinRowListSchema,
  type ParentDetailJoinRow,
  type ParentListJoinRow,
} from '@/lib/validators/parents';

const MISSING_VALUE = '—';

export type ParentRow = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  student_count: number;
  credit_balance_info: number;
};

export type ParentStudentRow = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  grade: string;
};

export type ParentProfileDetail = ParentRow & {
  billing_address: string;
  notification_preferences: string;
  students: ParentStudentRow[];
};

const PARENT_ERROR_MESSAGES = {
  admin: {
    database: 'Parent data is temporarily unavailable. Please retry in a moment.',
    validation: 'Parent data format is invalid. Please try again later.',
  },
} as const;

const ensureAdminRole = (role: UserRole) => {
  if (role !== 'admin') {
    forbidden();
  }
};

const parseName = (firstName: string | null, lastName: string | null) =>
  [firstName, lastName].filter(Boolean).join(' ') || MISSING_VALUE;

const sortByName = <TRow extends { name: string }>(rows: TRow[]) =>
  rows.slice().sort((left, right) => left.name.localeCompare(right.name));

const countStudentsByParent = (rows: ParentListJoinRow[]) => {
  const studentIdsByParent = new Map<number, Set<number>>();

  for (const row of rows) {
    if (row.studentId === null) {
      continue;
    }

    let studentIds = studentIdsByParent.get(row.id);
    if (!studentIds) {
      studentIds = new Set<number>();
      studentIdsByParent.set(row.id, studentIds);
    }

    studentIds.add(row.studentId);
  }

  return studentIdsByParent;
};

const mapParentRow = (parent: ParentListJoinRow, studentCount: number) => ({
  id: parent.id,
  user_id: parent.userId,
  name: parseName(parent.firstName, parent.lastName),
  email: parent.email,
  phone: parent.phone ?? MISSING_VALUE,
  student_count: studentCount,
  credit_balance_info: minutesToCredits(parent.availableMinutes ?? 0),
});

const mapParentStudentRow = (row: Extract<ParentDetailJoinRow, { studentId: number }>) => ({
  id: row.studentId,
  user_id: row.studentUserId,
  name: parseName(row.studentFirstName, row.studentLastName),
  email: row.studentEmail,
  phone: row.studentPhone ?? MISSING_VALUE,
  grade: row.studentGrade ?? MISSING_VALUE,
});

const mapParentDetail = (rows: ParentDetailJoinRow[]) => {
  const [parent] = rows;
  if (!parent) {
    return null;
  }

  const studentsById = new Map<number, ParentStudentRow>();

  for (const row of rows) {
    if (row.studentId === null || studentsById.has(row.studentId)) {
      continue;
    }

    studentsById.set(row.studentId, mapParentStudentRow(row));
  }

  return {
    ...mapParentRow(parent, studentsById.size),
    billing_address: parent.billingAddress ?? MISSING_VALUE,
    notification_preferences: parent.notificationPreferences ?? MISSING_VALUE,
    students: sortByName(Array.from(studentsById.values())),
  };
};

export async function getParents(role: UserRole) {
  ensureAdminRole(role);

  let rawRows: Awaited<ReturnType<typeof getParentListJoinRows>>;
  try {
    rawRows = await getParentListJoinRows();
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const parsedRows = ParentListJoinRowListSchema.safeParse(rawRows);
  if (!parsedRows.success) {
    throw new Error(PARENT_ERROR_MESSAGES.admin.validation);
  }

  const studentIdsByParent = countStudentsByParent(parsedRows.data);
  const parentsById = new Map<number, ParentListJoinRow>();

  for (const row of parsedRows.data) {
    if (!parentsById.has(row.id)) {
      parentsById.set(row.id, row);
    }
  }

  return sortByName(
    Array.from(parentsById.values()).map(parent => mapParentRow(parent, studentIdsByParent.get(parent.id)?.size ?? 0))
  );
}

export async function getParent(userId: number, role: UserRole) {
  ensureAdminRole(role);

  let rawRows: Awaited<ReturnType<typeof getParentDetailJoinRowsByUserId>>;
  try {
    rawRows = await getParentDetailJoinRowsByUserId(userId);
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const parsedRows = ParentDetailJoinRowListSchema.safeParse(rawRows);
  if (!parsedRows.success) {
    throw new Error(PARENT_ERROR_MESSAGES.admin.validation);
  }

  const parent = mapParentDetail(parsedRows.data);
  if (!parent) {
    notFound();
  }

  return parent;
}

export const parentDataService = {
  getParents,
  getParent,
};
