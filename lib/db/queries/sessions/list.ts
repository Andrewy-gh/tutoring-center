import 'server-only';
import { parents, sessions, students, users } from '@/lib/db/schema';
import { SessionWithJoinsListSchema, type SessionWithJoins } from '@/lib/validators/sessions';
import { and, asc, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export type SessionListKind = 'all' | 'upcoming' | 'past';

export type SessionListFilters = {
  kind: SessionListKind;
  nowIso: string;
  parentId?: number;
  tutorId?: number;
  studentId?: number;
  subjectId?: number;
  status?: typeof sessions.$inferSelect.status;
  excludeCompletedForUpcoming?: boolean;
};

export type SessionListJoinRow = {
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

export function buildSessionListFilters({
  kind,
  nowIso,
  parentId,
  tutorId,
  studentId,
  subjectId,
  status,
  excludeCompletedForUpcoming = false,
}: SessionListFilters) {
  const filters = [];

  if (parentId) filters.push(eq(sessions.parentId, parentId));
  if (tutorId) filters.push(eq(sessions.tutorId, tutorId));
  if (studentId) filters.push(eq(sessions.studentId, studentId));
  if (subjectId) filters.push(eq(sessions.subjectId, subjectId));
  if (status) filters.push(eq(sessions.status, status));
  if (kind === 'upcoming') {
    filters.push(gte(sessions.scheduledAt, nowIso));
    if (excludeCompletedForUpcoming) {
      filters.push(ne(sessions.status, 'Completed'));
    }
  }
  if (kind === 'past') filters.push(lt(sessions.scheduledAt, nowIso));

  return filters;
}

function getSessionListSelect(db: Awaited<ReturnType<typeof getDb>>) {
  const studentUsers = alias(users, 'session_student_users');
  const parentUsers = alias(users, 'session_parent_users');

  return db
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

export async function getSessionListCount(filters: ReturnType<typeof buildSessionListFilters>) {
  const db = await getDb();
  const rows = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(sessions)
    .where(filters.length === 0 ? undefined : and(...filters));

  return rows[0]?.count ?? 0;
}

export async function getSessionListRows(
  filters: ReturnType<typeof buildSessionListFilters>,
  options?: {
    page?: number;
    pageSize?: number;
    orderByKind?: SessionListKind;
  }
) {
  const db = await getDb();
  const query = getSessionListSelect(db).where(filters.length === 0 ? undefined : and(...filters));
  const orderedQuery =
    options?.orderByKind === 'upcoming'
      ? query.orderBy(asc(sessions.scheduledAt))
      : options?.orderByKind === 'all' || options?.orderByKind === 'past'
        ? query.orderBy(desc(sessions.scheduledAt))
        : query;

  if (options?.pageSize !== undefined) {
    return orderedQuery
      .limit(options.pageSize)
      .offset(options.page !== undefined ? (options.page - 1) * options.pageSize : 0);
  }

  return orderedQuery;
}

export function mapSessionListRow(row: SessionListJoinRow): SessionWithJoins {
  return {
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
  };
}

export function parseSessionListRows(rows: SessionListJoinRow[]) {
  return SessionWithJoinsListSchema.safeParse(rows.map(mapSessionListRow));
}
