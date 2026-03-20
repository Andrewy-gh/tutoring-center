import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { isValidRole, type UserRole } from '@/lib/auth';
import { creditBalances, parents, students, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import {
  ParentDetailWithJoinsSchema,
  ParentWithJoinsListSchema,
  type ParentDetailStudent,
  type ParentWithJoins,
} from '@/lib/validators/parents';
import { eq } from 'drizzle-orm';

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

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

type ParentListRow = {
  id: number;
  user_id: number;
  billing_address: string | null;
  notification_preferences: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  amount_available: number | null;
  student_id: number | null;
};

function buildParentList(rows: ParentListRow[]): ParentWithJoins[] {
  const parentMap = new Map<number, ParentWithJoins>();

  for (const row of rows) {
    const existing = parentMap.get(row.id);
    if (existing) {
      if (row.student_id !== null) {
        existing.students = [...(existing.students ?? []), { id: row.student_id }];
      }
      continue;
    }

    parentMap.set(row.id, {
      id: row.id,
      user_id: row.user_id,
      billing_address: row.billing_address,
      notification_preferences: row.notification_preferences,
      users: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
      },
      credit_balances: row.amount_available === null ? null : { amount_available: row.amount_available },
      students: row.student_id === null ? [] : [{ id: row.student_id }],
    });
  }

  return Array.from(parentMap.values());
}

export async function getParents(role: UserRole) {
  ensureAdminRole(role);

  const db = await getDb();
  let rows: ParentListRow[];
  try {
    rows = await db
      .select({
        id: parents.id,
        user_id: parents.userId,
        billing_address: parents.billingAddress,
        notification_preferences: parents.notificationPreferences,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        phone: users.phone,
        amount_available: creditBalances.amountAvailable,
        student_id: students.id,
      })
      .from(parents)
      .innerJoin(users, eq(parents.userId, users.id))
      .leftJoin(creditBalances, eq(creditBalances.parentId, parents.id))
      .leftJoin(students, eq(students.parentId, parents.id));
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const parsedParents = ParentWithJoinsListSchema.safeParse(buildParentList(rows));
  if (!parsedParents.success) {
    throw new Error(PARENT_ERROR_MESSAGES.admin.validation);
  }

  return sortByName(parsedParents.data.map(mapParentRow));
}

export async function getParent(userID: number, role: UserRole): Promise<ParentProfileDetail> {
  ensureAdminRole(role);

  const db = await getDb();

  let parentRows: Array<{
    id: number;
    user_id: number;
    billing_address: string | null;
    notification_preferences: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    amount_available: number | null;
  }>;
  try {
    parentRows = await db
      .select({
        id: parents.id,
        user_id: parents.userId,
        billing_address: parents.billingAddress,
        notification_preferences: parents.notificationPreferences,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        phone: users.phone,
        amount_available: creditBalances.amountAvailable,
      })
      .from(parents)
      .innerJoin(users, eq(parents.userId, users.id))
      .leftJoin(creditBalances, eq(creditBalances.parentId, parents.id))
      .where(eq(parents.userId, userID))
      .limit(1);
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const [parentRow] = parentRows;
  if (!parentRow) {
    notFound();
  }

  let studentRows: Array<{
    id: number;
    user_id: number;
    grade: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
  }>;
  try {
    studentRows = await db
      .select({
        id: students.id,
        user_id: students.userId,
        grade: students.grade,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(students.parentId, parentRow.id));
  } catch {
    throw new Error(PARENT_ERROR_MESSAGES.admin.database);
  }

  const parsedParent = ParentDetailWithJoinsSchema.safeParse({
    id: parentRow.id,
    user_id: parentRow.user_id,
    billing_address: parentRow.billing_address,
    notification_preferences: parentRow.notification_preferences,
    users: {
      first_name: parentRow.first_name,
      last_name: parentRow.last_name,
      email: parentRow.email,
      phone: parentRow.phone,
    },
    credit_balances: parentRow.amount_available === null ? null : { amount_available: parentRow.amount_available },
    students: studentRows.map(student => ({
      id: student.id,
      user_id: student.user_id,
      grade: student.grade,
      users: {
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
      },
    })),
  });
  if (!parsedParent.success) {
    throw new Error(PARENT_ERROR_MESSAGES.admin.validation);
  }

  const parent = parsedParent.data;
  const mappedParent = mapParentRow(parent);

  return {
    ...mappedParent,
    billing_address: parent.billing_address ?? MISSING_VALUE,
    notification_preferences: parent.notification_preferences ?? MISSING_VALUE,
    students: sortByName((parent.students ?? []).map(mapParentStudentRow)),
  };
}
