import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { isValidRole, type UserRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { creditBalances, parents, students, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import {
  ParentDetailWithJoinsSchema,
  ParentWithJoinsListSchema,
  type ParentDetailStudent,
  type ParentDetailWithJoins,
  type ParentWithJoins,
} from '@/lib/validators/parents';
import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const MISSING_VALUE = '\u2014';

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
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch parents.');
  }

  if (role !== 'admin') {
    forbidden();
  }
};

const parseName = (firstName: string | null | undefined, lastName: string | null | undefined) =>
  [firstName, lastName].filter(Boolean).join(' ') || MISSING_VALUE;

const parseParentUser = (users: ParentWithJoins['users']) => {
  const user = pickFirstEmbedded(users);

  return {
    name: parseName(user?.first_name, user?.last_name),
    email: user?.email ?? MISSING_VALUE,
    phone: user?.phone ?? MISSING_VALUE,
  };
};

const getAvailableCredits = (creditBalances: ParentWithJoins['credit_balances']) =>
  pickFirstEmbedded(creditBalances)?.amount_available ?? 0;

const mapParentRow = (parent: ParentWithJoins): ParentRow => {
  const user = parseParentUser(parent.users);

  return {
    id: parent.id,
    user_id: parent.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    student_count: parent.students?.length ?? 0,
    credit_balance_info: getAvailableCredits(parent.credit_balances),
  };
};

const mapParentStudentRow = (student: ParentDetailStudent): ParentStudentRow => {
  const user = pickFirstEmbedded(student.users);

  return {
    id: student.id,
    user_id: student.user_id,
    name: parseName(user?.first_name, user?.last_name),
    email: user?.email ?? MISSING_VALUE,
    phone: user?.phone ?? MISSING_VALUE,
    grade: student.grade ?? MISSING_VALUE,
  };
};

const sortByName = <TRow extends { name: string }>(rows: TRow[]) =>
  rows.slice().sort((left, right) => left.name.localeCompare(right.name));

const getOptionalNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

type ParentListJoinRow = {
  id: unknown;
  userId: unknown;
  billingAddress: unknown;
  notificationPreferences: unknown;
  firstName: unknown;
  lastName: unknown;
  email: unknown;
  phone: unknown;
  amountAvailable: unknown;
  studentId: unknown;
};

type ParentDetailJoinRow = ParentListJoinRow & {
  studentUserId: unknown;
  studentGrade: unknown;
  studentFirstName: unknown;
  studentLastName: unknown;
  studentEmail: unknown;
  studentPhone: unknown;
};

const mapParentBase = (row: ParentListJoinRow) => ({
  id: row.id as number,
  user_id: row.userId as number,
  billing_address: row.billingAddress as string | null,
  notification_preferences: row.notificationPreferences as string | null,
  users: {
    first_name: row.firstName as string | null,
    last_name: row.lastName as string | null,
    email: row.email as string,
    phone: row.phone as string | null,
  },
  credit_balances:
    row.amountAvailable === null || row.amountAvailable === undefined
      ? null
      : { amount_available: row.amountAvailable as number },
});

const mapParentListRows = (rows: ParentListJoinRow[]) => {
  const parentsById = new Map<number, ParentWithJoins>();
  const studentIdsByParent = new Map<number, Set<number>>();

  for (const row of rows) {
    const parentId = Number(row.id);
    const existingParent = parentsById.get(parentId);

    if (!existingParent) {
      parentsById.set(parentId, {
        ...mapParentBase(row),
        students: [],
      });
    }

    const studentId = getOptionalNumber(row.studentId);
    if (studentId === null) {
      continue;
    }

    const parentStudentIds = studentIdsByParent.get(parentId) ?? new Set<number>();
    if (!studentIdsByParent.has(parentId)) {
      studentIdsByParent.set(parentId, parentStudentIds);
    }

    if (parentStudentIds.has(studentId)) {
      continue;
    }

    parentStudentIds.add(studentId);
    parentsById.get(parentId)?.students?.push({ id: row.studentId as number });
  }

  return Array.from(parentsById.values());
};

const mapParentDetailRows = (rows: ParentDetailJoinRow[]): ParentDetailWithJoins | null => {
  const [firstRow] = rows;
  if (!firstRow) {
    return null;
  }

  const parent: ParentDetailWithJoins = {
    ...mapParentBase(firstRow),
    students: [],
  };
  const studentIds = new Set<number>();

  for (const row of rows) {
    const studentId = getOptionalNumber(row.studentId);
    if (studentId === null || studentIds.has(studentId)) {
      continue;
    }

    studentIds.add(studentId);
    parent.students?.push({
      id: row.studentId as number,
      user_id: row.studentUserId as number,
      grade: row.studentGrade as string | null,
      users: {
        first_name: row.studentFirstName as string | null,
        last_name: row.studentLastName as string | null,
        email: row.studentEmail as string,
        phone: row.studentPhone as string | null,
      },
    });
  }

  return parent;
};

export async function getParents(role: UserRole) {
  ensureAdminRole(role);

  let rows: ParentListJoinRow[];
  try {
    rows = await db
      .select({
        id: parents.id,
        userId: parents.userId,
        billingAddress: parents.billingAddress,
        notificationPreferences: parents.notificationPreferences,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        amountAvailable: creditBalances.amountAvailable,
        studentId: students.id,
      })
      .from(parents)
      .innerJoin(users, eq(parents.userId, users.id))
      .leftJoin(creditBalances, eq(creditBalances.parentId, parents.id))
      .leftJoin(students, eq(students.parentId, parents.id))
      .orderBy(asc(parents.id), asc(students.id));
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const parsedParents = ParentWithJoinsListSchema.safeParse(mapParentListRows(rows));
  if (!parsedParents.success) {
    throw new Error(PARENT_ERROR_MESSAGES.admin.validation);
  }

  return sortByName(parsedParents.data.map(mapParentRow));
}

export async function getParent(userID: number, role: UserRole): Promise<ParentProfileDetail> {
  ensureAdminRole(role);

  const studentUsers = alias(users, 'student_users');
  let rows: ParentDetailJoinRow[];
  try {
    rows = await db
      .select({
        id: parents.id,
        userId: parents.userId,
        billingAddress: parents.billingAddress,
        notificationPreferences: parents.notificationPreferences,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        amountAvailable: creditBalances.amountAvailable,
        studentId: students.id,
        studentUserId: students.userId,
        studentGrade: students.grade,
        studentFirstName: studentUsers.firstName,
        studentLastName: studentUsers.lastName,
        studentEmail: studentUsers.email,
        studentPhone: studentUsers.phone,
      })
      .from(parents)
      .innerJoin(users, eq(parents.userId, users.id))
      .leftJoin(creditBalances, eq(creditBalances.parentId, parents.id))
      .leftJoin(students, eq(students.parentId, parents.id))
      .leftJoin(studentUsers, eq(students.userId, studentUsers.id))
      .where(eq(parents.userId, userID))
      .orderBy(asc(students.id));
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const data = mapParentDetailRows(rows);
  if (!data) {
    notFound();
  }

  const parsedParent = ParentDetailWithJoinsSchema.safeParse(data);
  if (!parsedParent.success) {
    throw new Error(PARENT_ERROR_MESSAGES.admin.validation);
  }

  const parent = parsedParent.data;
  const parentRow = mapParentRow(parent);

  return {
    ...parentRow,
    billing_address: parent.billing_address ?? MISSING_VALUE,
    notification_preferences: parent.notification_preferences ?? MISSING_VALUE,
    students: sortByName((parent.students ?? []).map(mapParentStudentRow)),
  };
}
