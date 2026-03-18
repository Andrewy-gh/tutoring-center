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
  subjects,
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
    expect(getTableName(availability)).toBe('availability');
    expect(getTableName(sessions)).toBe('sessions');
    expect(getTableName(creditBalances)).toBe('credit_balances');
    expect(getTableName(creditTransactions)).toBe('credit_transactions');
    expect(getTableName(studentGrades)).toBe('student_grades');
    expect(getTableName(sessionProgress)).toBe('session_progress');
    expect(getTableName(sessionMetrics)).toBe('session_metrics');
  });
});
