import {
  availability,
  creditBalances,
  creditTransactions,
  roles,
  sessionMetrics,
  sessionProgress,
  sessions,
  sessionStatusEnum,
  studentGrades,
  subjectKindEnum,
  subjects,
  transactionTypeEnum,
  tutorSubjects,
  weekDayEnum,
} from '@/lib/db/schema';
import { getTableName } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

describe('db schema exports', () => {
  it('exposes the core enums used by booking and scheduling', () => {
    expect(sessionStatusEnum.enumValues).toEqual([
      'Scheduled',
      'Pending-Notes',
      'Completed',
      'Canceled',
      'No-show',
      'Rescheduled',
    ]);
    expect(subjectKindEnum.enumValues).toEqual(['group', 'leaf']);
    expect(transactionTypeEnum.enumValues).toContain('reservation');
    expect(transactionTypeEnum.enumValues).toContain('reservation_release');
    expect(transactionTypeEnum.enumValues).toContain('session_debit');
    expect(weekDayEnum.enumValues).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('exports the main domain tables from the consolidated schema index', () => {
    expect(getTableName(roles)).toBe('roles');
    expect(getTableName(subjects)).toBe('subjects');
    expect(getTableName(tutorSubjects)).toBe('tutor_subjects');
    expect(getTableName(availability)).toBe('availability');
    expect(getTableName(sessions)).toBe('sessions');
    expect(getTableName(creditBalances)).toBe('credit_balances');
    expect(getTableName(creditTransactions)).toBe('credit_transactions');
    expect(getTableName(studentGrades)).toBe('student_grades');
    expect(getTableName(sessionProgress)).toBe('session_progress');
    expect(getTableName(sessionMetrics)).toBe('session_metrics');
  });

  it('defines credit transaction delta columns and the type-specific shape check', () => {
    const tableConfig = getTableConfig(creditTransactions);
    const shapeCheck = tableConfig.checks.find(check => check.name === 'credit_transactions_valid_delta_shape_by_type');
    const dialect = new PgDialect();

    expect(creditTransactions.availableDelta.name).toBe('available_delta');
    expect(creditTransactions.pendingDelta.name).toBe('pending_delta');
    expect(tableConfig.checks.map(check => check.name)).toContain('credit_transactions_valid_delta_shape_by_type');
    expect(shapeCheck).toBeDefined();
    expect(dialect.sqlToQuery(shapeCheck!.value).sql).toContain(
      `when "credit_transactions"."type" = 'cancellation_fee'`
    );
    expect(dialect.sqlToQuery(shapeCheck!.value).sql).toContain(
      '"credit_transactions"."available_delta" = 0 and "credit_transactions"."pending_delta" < 0'
    );
  });

  it('tracks subject parent metadata needed for group-only parent enforcement', () => {
    expect(subjects.kind.name).toBe('kind');
    expect(subjects.parentSubjectId.name).toBe('parent_subject_id');
    expect(subjects.parentSubjectKind.name).toBe('parent_subject_kind');
  });

  it('exposes the renamed linkage columns for the schema rewrite', () => {
    expect(tutorSubjects.subjectKind.name).toBe('subject_kind');
    expect(sessions.subjectId.name).toBe('subject_id');
    expect(studentGrades.subjectId.name).toBe('subject_id');
    expect(studentGrades.subjectKind.name).toBe('subject_kind');
    expect(creditTransactions.availableDelta.name).toBe('available_delta');
    expect(creditTransactions.pendingDelta.name).toBe('pending_delta');
    expect(creditTransactions.availableAfter.name).toBe('available_after');
    expect(creditTransactions.pendingAfter.name).toBe('pending_after');
    expect(creditTransactions.idempotencyKey.name).toBe('idempotency_key');
  });
});
