import {
  availability,
  creditBalances,
  creditTransactions,
  roles,
  subjectKindEnum,
  sessionMetrics,
  sessionProgress,
  sessions,
  sessionStatusEnum,
  studentGrades,
  subjects,
  tutorSubjects,
  transactionTypeEnum,
  weekDayEnum,
} from '@/lib/db/schema';
import { getTableName } from 'drizzle-orm';
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
    expect(transactionTypeEnum.enumValues).toContain('Reservation');
    expect(transactionTypeEnum.enumValues).toContain('Reservation Release');
    expect(transactionTypeEnum.enumValues).toContain('Session Debit');
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

  it('tracks subject parent metadata needed for group-only parent enforcement', () => {
    expect(subjects.kind.name).toBe('kind');
    expect(subjects.parentSubjectId.name).toBe('parent_subject_id');
    expect(subjects.parentSubjectKind.name).toBe('parent_subject_kind');
  });
});
