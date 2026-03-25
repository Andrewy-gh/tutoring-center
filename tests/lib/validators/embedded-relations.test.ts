import { SessionWithJoinsSchema } from '@/lib/validators/sessions';
import { ParentWithJoinsSchema } from '@/lib/validators/parents';
import { StudentWithJoinsSchema } from '@/lib/validators/students';
import { TransactionsWithJoinsSchema } from '@/lib/validators/transactions';
import { TutorWithJoinsSchema } from '@/lib/validators/tutors';
import { describe, expect, it } from 'vitest';

describe('embedded relation schemas', () => {
  it('rejects array-shaped session relations', () => {
    const parsed = SessionWithJoinsSchema.safeParse({
      id: 1,
      tutor_id: 2,
      student_id: 3,
      subject_id: 4,
      parent_id: 5,
      slot_units: 1,
      scheduled_at: '2026-03-01T15:00:00.000Z',
      ends_at: '2026-03-01T16:00:00.000Z',
      status: 'Scheduled',
      student: [
        {
          id: 3,
          parent_id: 5,
          learning_goals: null,
          users: {
            first_name: 'Ada',
            last_name: 'Student',
            email: 'ada@example.com',
          },
        },
      ],
      parent: {
        id: 5,
        billing_address: null,
        notification_preferences: null,
        users: {
          first_name: 'Pat',
          last_name: 'Parent',
          email: 'pat@example.com',
        },
      },
      session_progress: null,
      session_metrics: null,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects missing required user joins for parents, students, and tutors', () => {
    expect(
      ParentWithJoinsSchema.safeParse({
        id: 1,
        user_id: 2,
        billing_address: null,
        notification_preferences: null,
        credit_balances: null,
        students: [],
      }).success
    ).toBe(false);

    expect(
      StudentWithJoinsSchema.safeParse({
        id: 1,
        user_id: 2,
        parent_id: null,
        birth_date: null,
        grade: null,
        learning_goals: null,
        users: [{ first_name: 'Sam', last_name: 'Student', email: 'sam@example.com', phone: null }],
      }).success
    ).toBe(false);

    expect(
      TutorWithJoinsSchema.safeParse({
        id: 1,
        user_id: 2,
        verified: true,
        education: null,
        bio: null,
        tagline: null,
        years_experience: null,
        users: null,
      }).success
    ).toBe(false);
  });

  it('allows nullable optional one-to-one relations but rejects arrays for them', () => {
    expect(
      ParentWithJoinsSchema.safeParse({
        id: 1,
        user_id: 2,
        billing_address: null,
        notification_preferences: null,
        users: {
          first_name: 'Pat',
          last_name: 'Parent',
          email: 'pat@example.com',
          phone: null,
        },
        credit_balances: null,
        students: [],
      }).success
    ).toBe(true);

    expect(
      ParentWithJoinsSchema.safeParse({
        id: 1,
        user_id: 2,
        billing_address: null,
        notification_preferences: null,
        users: {
          first_name: 'Pat',
          last_name: 'Parent',
          email: 'pat@example.com',
          phone: null,
        },
        credit_balances: [{ amount_available: 10 }],
        students: [],
      }).success
    ).toBe(false);
  });

  it('rejects array-shaped transaction parents and students', () => {
    expect(
      TransactionsWithJoinsSchema.safeParse({
        id: 1,
        parent_id: 2,
        session_id: null,
        available_delta: 1,
        pending_delta: 0,
        available_after: 3,
        pending_after: 0,
        type: 'purchase',
        created_at: '2026-03-01T15:00:00.000Z',
        idempotency_key: null,
        note: null,
        parent: [{ users: { first_name: 'Pat', last_name: 'Parent' } }],
        session: null,
      }).success
    ).toBe(false);

    expect(
      TransactionsWithJoinsSchema.safeParse({
        id: 1,
        parent_id: 2,
        session_id: 9,
        available_delta: 1,
        pending_delta: 0,
        available_after: 3,
        pending_after: 0,
        type: 'purchase',
        created_at: '2026-03-01T15:00:00.000Z',
        idempotency_key: null,
        note: null,
        parent: { users: { first_name: 'Pat', last_name: 'Parent' } },
        session: {
          id: 9,
          subject_id: 4,
          tutor_id: 5,
          scheduled_at: '2026-03-01T15:00:00.000Z',
          ends_at: '2026-03-01T16:00:00.000Z',
          status: 'Scheduled',
          student_id: 3,
          student: [
            {
              id: 3,
              user_id: 6,
              grade: null,
              users: {
                first_name: 'Sam',
                last_name: 'Student',
                email: 'sam@example.com',
                phone: null,
              },
            },
          ],
        },
      }).success
    ).toBe(false);
  });
});
