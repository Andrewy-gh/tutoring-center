import { parseCreditTransactionRows } from '@/lib/db/queries/credits/transactions';
import { describe, expect, it } from 'vitest';

describe('parseCreditTransactionRows', () => {
  it('returns a failed parse instead of throwing for partial session joins', () => {
    expect(() =>
      parseCreditTransactionRows([
        {
          id: 1,
          parent_id: 2,
          session_id: 9,
          available_delta: 1,
          pending_delta: 0,
          available_after: 4,
          pending_after: 0,
          type: 'purchase',
          created_at: '2026-03-20T00:00:00.000Z',
          idempotency_key: null,
          note: null,
          parent_first_name: 'Pat',
          parent_last_name: 'Parent',
          session_subject_id: null,
          session_tutor_id: 5,
          scheduled_at: '2026-03-21T10:00:00.000Z',
          ends_at: '2026-03-21T11:00:00.000Z',
          status: 'Scheduled',
          student_id: 3,
          student_user_id: 6,
          student_grade: null,
          student_first_name: 'Sam',
          student_last_name: 'Student',
          student_email: 'sam@example.com',
          student_phone: null,
        },
      ])
    ).not.toThrow();

    const parsed = parseCreditTransactionRows([
      {
        id: 1,
        parent_id: 2,
        session_id: 9,
        available_delta: 1,
        pending_delta: 0,
        available_after: 4,
        pending_after: 0,
        type: 'purchase',
        created_at: '2026-03-20T00:00:00.000Z',
        idempotency_key: null,
        note: null,
        parent_first_name: 'Pat',
        parent_last_name: 'Parent',
        session_subject_id: null,
        session_tutor_id: 5,
        scheduled_at: '2026-03-21T10:00:00.000Z',
        ends_at: '2026-03-21T11:00:00.000Z',
        status: 'Scheduled',
        student_id: 3,
        student_user_id: 6,
        student_grade: null,
        student_first_name: 'Sam',
        student_last_name: 'Student',
        student_email: 'sam@example.com',
        student_phone: null,
      },
    ]);

    expect(parsed.success).toBe(false);
  });
});
