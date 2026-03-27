import {
  bookSession,
  CreditBalanceNotFoundError,
  InsufficientCreditsError,
  InvalidSessionTimeError,
  ParentStudentMismatchError,
  SessionOverlapError,
  type BookSessionInput,
} from '@/lib/db/book-session';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {
    async execute() {
      throw new Error('Unexpected default db.execute call');
    },
    async transaction() {
      throw new Error('Unexpected default db.transaction call');
    },
  },
}));

type CreditBalanceRow = {
  amount_available: number;
  amount_pending: number;
};

type QueuedExecutor = {
  execute<T>(query: unknown): Promise<T>;
};

type BookingState = {
  studentOwned: boolean;
  overlap: boolean;
  balance: CreditBalanceRow | null;
  sessions: Array<{
    id: number;
    tutor_id: number;
    student_id: number;
    subject_id: number;
    parent_id: number;
    slot_units: number;
    scheduled_at: string;
    ends_at: string;
    status: string;
  }>;
  creditTransactions: Array<{
    session_id: number;
    available_delta: number;
    pending_delta: number;
    available_after: number;
    pending_after: number;
    type: string;
  }>;
  nextSessionId: number;
};

function createBookSessionDatabase(
  input: BookSessionInput,
  options: Partial<Pick<BookingState, 'studentOwned' | 'overlap' | 'balance'>> = {}
) {
  const hasBalanceOverride = Object.prototype.hasOwnProperty.call(options, 'balance');

  const state: BookingState = {
    studentOwned: options.studentOwned ?? true,
    overlap: options.overlap ?? false,
    balance: hasBalanceOverride ? (options.balance ?? null) : { amount_available: 10, amount_pending: 0 },
    sessions: [],
    creditTransactions: [],
    nextSessionId: 9001,
  };

  const database = {
    async execute() {
      throw new Error('Unexpected non-transactional execute');
    },
    async transaction<T>(callback: (tx: QueuedExecutor) => Promise<T>) {
      const draft = structuredClone(state);
      let executeCount = 0;
      let balanceUpdated = false;

      const tx: QueuedExecutor = {
        async execute<T>() {
          executeCount += 1;

          switch (executeCount) {
            case 1:
              return (draft.studentOwned ? [{ id: input.studentId }] : []) as T;
            case 2:
              return (draft.overlap ? [{ id: 7001 }] : []) as T;
            case 3: {
              const session = {
                id: draft.nextSessionId,
                tutor_id: input.tutorId,
                student_id: input.studentId,
                subject_id: input.subjectId,
                parent_id: input.parentId,
                slot_units: input.slotUnits,
                scheduled_at: input.scheduledAt,
                ends_at: input.endsAt,
                status: input.status ?? 'Scheduled',
              };

              draft.nextSessionId += 1;
              draft.sessions.push(session);
              return [session] as T;
            }
            case 4: {
              if (!draft.balance || draft.balance.amount_available < input.slotUnits) {
                return [] as T;
              }

              draft.balance = {
                amount_available: draft.balance.amount_available - input.slotUnits,
                amount_pending: draft.balance.amount_pending + input.slotUnits,
              };
              balanceUpdated = true;

              return [draft.balance] as T;
            }
            case 5: {
              if (!balanceUpdated) {
                return (draft.balance ? [{ id: 1 }] : []) as T;
              }

              if (!draft.balance || draft.sessions.length === 0) {
                throw new Error('Transaction state is incomplete');
              }

              draft.creditTransactions.push({
                session_id: draft.sessions[0]!.id,
                available_delta: input.slotUnits * -1,
                pending_delta: input.slotUnits,
                available_after: draft.balance.amount_available,
                pending_after: draft.balance.amount_pending,
                type: 'reservation',
              });

              return [] as T;
            }
            default:
              throw new Error(`Unexpected execute call ${executeCount}`);
          }
        },
      };

      const result = await callback(tx);
      state.studentOwned = draft.studentOwned;
      state.overlap = draft.overlap;
      state.balance = draft.balance;
      state.sessions = draft.sessions;
      state.creditTransactions = draft.creditTransactions;
      state.nextSessionId = draft.nextSessionId;
      return result;
    },
  };

  return {
    database,
    state,
  };
}

const BOOKING_INPUT: BookSessionInput = {
  parentId: 1010,
  studentId: 1012,
  tutorId: 1011,
  subjectId: 1,
  slotUnits: 2,
  scheduledAt: '2026-03-20T10:00:00.000Z',
  endsAt: '2026-03-20T11:00:00.000Z',
};

describe('bookSession', () => {
  it('books a session transactionally and moves credits to pending', async () => {
    const { database, state } = createBookSessionDatabase(BOOKING_INPUT, {
      balance: { amount_available: 4, amount_pending: 0 },
    });

    await expect(bookSession(BOOKING_INPUT, database)).resolves.toEqual({
      session: {
        id: 9001,
        tutor_id: 1011,
        student_id: 1012,
        subject_id: 1,
        parent_id: 1010,
        slot_units: 2,
        scheduled_at: '2026-03-20T10:00:00.000Z',
        ends_at: '2026-03-20T11:00:00.000Z',
        status: 'Scheduled',
      },
      balance: {
        amount_available: 2,
        amount_pending: 2,
      },
    });
    expect(state.balance).toEqual({ amount_available: 2, amount_pending: 2 });
    expect(state.sessions).toHaveLength(1);
    expect(state.creditTransactions).toHaveLength(1);
  });

  it('rolls back the inserted session when credits are insufficient', async () => {
    const { database, state } = createBookSessionDatabase(BOOKING_INPUT, {
      balance: { amount_available: 1, amount_pending: 0 },
    });

    await expect(bookSession(BOOKING_INPUT, database)).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(state.balance).toEqual({ amount_available: 1, amount_pending: 0 });
    expect(state.sessions).toEqual([]);
    expect(state.creditTransactions).toEqual([]);
  });

  it('rolls back the inserted session when the parent has no balance row', async () => {
    const { database, state } = createBookSessionDatabase(BOOKING_INPUT, {
      balance: null,
    });

    await expect(bookSession(BOOKING_INPUT, database)).rejects.toBeInstanceOf(CreditBalanceNotFoundError);
    expect(state.balance).toBeNull();
    expect(state.sessions).toEqual([]);
    expect(state.creditTransactions).toEqual([]);
  });

  it('does not create any records when the tutor already has an overlapping session', async () => {
    const { database, state } = createBookSessionDatabase(BOOKING_INPUT, {
      overlap: true,
      balance: { amount_available: 4, amount_pending: 0 },
    });

    await expect(bookSession(BOOKING_INPUT, database)).rejects.toBeInstanceOf(SessionOverlapError);
    expect(state.balance).toEqual({ amount_available: 4, amount_pending: 0 });
    expect(state.sessions).toEqual([]);
    expect(state.creditTransactions).toEqual([]);
  });

  it('rejects bookings when the student does not belong to the parent', async () => {
    const { database, state } = createBookSessionDatabase(BOOKING_INPUT, {
      studentOwned: false,
      balance: { amount_available: 4, amount_pending: 0 },
    });

    await expect(bookSession(BOOKING_INPUT, database)).rejects.toBeInstanceOf(ParentStudentMismatchError);
    expect(state.balance).toEqual({ amount_available: 4, amount_pending: 0 });
    expect(state.sessions).toEqual([]);
    expect(state.creditTransactions).toEqual([]);
  });

  it('returns an explicit invalid time error before opening a transaction', async () => {
    const { database, state } = createBookSessionDatabase(BOOKING_INPUT, {
      balance: { amount_available: 4, amount_pending: 0 },
    });

    await expect(
      bookSession(
        {
          ...BOOKING_INPUT,
          scheduledAt: BOOKING_INPUT.endsAt,
          endsAt: BOOKING_INPUT.scheduledAt,
        },
        database
      )
    ).rejects.toEqual(new InvalidSessionTimeError('ends_at must be after scheduled_at'));
    expect(state.balance).toEqual({ amount_available: 4, amount_pending: 0 });
    expect(state.sessions).toEqual([]);
    expect(state.creditTransactions).toEqual([]);
  });
});
