import 'server-only';
import { creditBalances, creditTransactions, parents, sessions, students, users } from '@/db/schema';
import { and, asc, desc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDb() {
  return (await import('@/db/client')).db;
}

function getAdminDashboardSessionSelect(db: Awaited<ReturnType<typeof getDb>>) {
  const studentUsers = alias(users, 'admin_dashboard_student_users');
  const parentUsers = alias(users, 'admin_dashboard_parent_users');

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

export async function getScheduledSessionsCountBetween(start: Date, end: Date) {
  const db = await getDb();

  return db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, 'Scheduled'),
        gte(sessions.scheduledAt, start.toISOString()),
        lte(sessions.scheduledAt, end.toISOString())
      )
    );
}

export async function getPendingNoteSessionRows() {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
    })
    .from(sessions)
    .where(eq(sessions.status, 'Pending-Notes'));
}

export async function getPendingNoteSessionRowsSince(start: Date) {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
    })
    .from(sessions)
    .where(and(eq(sessions.status, 'Pending-Notes'), gte(sessions.scheduledAt, start.toISOString())));
}

export async function getDebitTransactionRows() {
  const db = await getDb();

  return db
    .select({
      session_id: creditTransactions.sessionId,
      pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
    })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.type, 'session_debit'), isNotNull(creditTransactions.sessionId)));
}

export async function getDebitTransactionRowsSince(start: Date) {
  const db = await getDb();

  return db
    .select({
      session_id: creditTransactions.sessionId,
      pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.type, 'session_debit'),
        isNotNull(creditTransactions.sessionId),
        gte(creditTransactions.createdAt, start.toISOString())
      )
    );
}

export async function getCompletedSessionDebitRows() {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
      debit_transaction_id: creditTransactions.id,
    })
    .from(sessions)
    .leftJoin(
      creditTransactions,
      and(eq(creditTransactions.sessionId, sessions.id), eq(creditTransactions.type, 'session_debit'))
    )
    .where(eq(sessions.status, 'Completed'));
}

export async function getCompletedSessionDebitRowsSince(start: Date) {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
      debit_transaction_id: creditTransactions.id,
      pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
    })
    .from(sessions)
    .leftJoin(
      creditTransactions,
      and(eq(creditTransactions.sessionId, sessions.id), eq(creditTransactions.type, 'session_debit'))
    )
    .where(and(eq(sessions.status, 'Completed'), gte(sessions.scheduledAt, start.toISOString())));
}

export async function getAtRiskParentCountRows(thresholdMinutes: number) {
  const db = await getDb();

  return db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(creditBalances)
    .where(lt(creditBalances.availableMinutes, thresholdMinutes));
}

export async function getAtRiskParentRows(thresholdMinutes: number) {
  const db = await getDb();

  return db
    .select({
      parent_id: parents.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      available_minutes: creditBalances.availableMinutes,
    })
    .from(creditBalances)
    .innerJoin(parents, eq(creditBalances.parentId, parents.id))
    .innerJoin(users, eq(parents.userId, users.id))
    .where(lt(creditBalances.availableMinutes, thresholdMinutes))
    .orderBy(asc(creditBalances.availableMinutes));
}

export async function getDashboardSessionRowsBetween(start: Date, end: Date) {
  const db = await getDb();

  return getAdminDashboardSessionSelect(db)
    .where(and(gte(sessions.scheduledAt, start.toISOString()), lte(sessions.scheduledAt, end.toISOString())))
    .orderBy(asc(sessions.scheduledAt));
}

export async function getPendingNoteDashboardSessionRows() {
  const db = await getDb();

  return getAdminDashboardSessionSelect(db)
    .where(eq(sessions.status, 'Pending-Notes'))
    .orderBy(desc(sessions.scheduledAt));
}

export async function getPendingNoteDashboardSessionRowsSince(start: Date) {
  const db = await getDb();

  return getAdminDashboardSessionSelect(db)
    .where(and(eq(sessions.status, 'Pending-Notes'), gte(sessions.scheduledAt, start.toISOString())))
    .orderBy(desc(sessions.scheduledAt));
}

export async function getBilledDashboardSessionRowsSince(start: Date) {
  const db = await getDb();

  return getAdminDashboardSessionSelect(db)
    .where(
      and(
        eq(sessions.status, 'Completed'),
        gte(sessions.scheduledAt, start.toISOString()),
        sql`exists (
          select 1
          from ${creditTransactions}
          where ${creditTransactions.sessionId} = ${sessions.id}
            and ${creditTransactions.type} = 'session_debit'
        )`
      )
    )
    .orderBy(desc(sessions.scheduledAt));
}

export async function getPendingBillingDashboardSessionRowsSince(start: Date) {
  const db = await getDb();

  return getAdminDashboardSessionSelect(db)
    .where(
      and(
        eq(sessions.status, 'Completed'),
        gte(sessions.scheduledAt, start.toISOString()),
        sql`not exists (
          select 1
          from ${creditTransactions}
          where ${creditTransactions.sessionId} = ${sessions.id}
            and ${creditTransactions.type} = 'session_debit'
        )`
      )
    )
    .orderBy(desc(sessions.scheduledAt));
}
