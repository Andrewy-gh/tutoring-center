import 'server-only';
import { parents, sessions, students, users } from '@/lib/db/schema';
import { SessionListQueryRowListSchema, type SessionListQueryRow } from '@/lib/validators/sessions';
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
      tutor_id: sessions.tutorId,
      student_id: sessions.studentId,
      subject_id: sessions.subjectId,
      parent_id: sessions.parentId,
      slot_units: sessions.slotUnits,
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
      student_parent_id: students.parentId,
      student_learning_goals: students.learningGoals,
      student_first_name: studentUsers.firstName,
      student_last_name: studentUsers.lastName,
      student_email: studentUsers.email,
      parent_billing_address: parents.billingAddress,
      parent_notification_preferences: parents.notificationPreferences,
      parent_first_name: parentUsers.firstName,
      parent_last_name: parentUsers.lastName,
      parent_email: parentUsers.email,
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

export function parseSessionListRows(rows: SessionListQueryRow[]) {
  return SessionListQueryRowListSchema.safeParse(rows);
}
