import {
  saveProgressReportAndCaptureRevenue,
  SessionRevenueCaptureError,
  type ProgressReportValues,
} from '@/db/capture-session-revenue';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({
  db: {
    async execute() {
      throw new Error('Unexpected default db.execute call');
    },
    async transaction() {
      throw new Error('Unexpected default db.transaction call');
    },
  },
}));

type CaptureState = {
  balance: {
    available_minutes: number;
    pending_minutes: number;
  };
  session: {
    id: number;
    parent_id: number;
    slot_units: number;
    status: string;
  };
  transactions: Array<{
    session_id: number;
    available_delta_minutes: number;
    pending_delta_minutes: number;
    available_after_minutes: number;
    pending_after_minutes: number;
    idempotency_key: string;
    type: string;
  }>;
  progressReports: ProgressReportValues[];
};

function createCaptureDatabase(state: CaptureState) {
  return {
    async execute() {
      throw new Error('Unexpected non-transactional execute');
    },
    async transaction<T>(callback: (tx: { execute: () => Promise<unknown> }) => Promise<T>) {
      const draft = structuredClone(state);
      let executeCount = 0;

      const tx = {
        async execute() {
          executeCount += 1;

          switch (executeCount) {
            case 1:
              draft.progressReports.push(PROGRESS_REPORT);
              return [];
            case 2:
              return [draft.session];
            case 3:
              return draft.transactions.some(tx => tx.idempotency_key === `session_debit:${draft.session.id}`)
                ? [{ id: 55 }]
                : [];
            case 4: {
              const sessionMinutes = draft.session.slot_units * 30;
              if (draft.balance.pending_minutes < sessionMinutes) {
                return [];
              }

              draft.balance.pending_minutes -= sessionMinutes;
              return [draft.balance];
            }
            case 5: {
              const sessionMinutes = draft.session.slot_units * 30;
              draft.transactions.push({
                session_id: draft.session.id,
                available_delta_minutes: 0,
                pending_delta_minutes: sessionMinutes * -1,
                available_after_minutes: draft.balance.available_minutes,
                pending_after_minutes: draft.balance.pending_minutes,
                idempotency_key: `session_debit:${draft.session.id}`,
                type: 'session_debit',
              });
              return [];
            }
            case 6:
              draft.session.status = 'Completed';
              return [];
            default:
              throw new Error(`Unexpected execute call ${executeCount}`);
          }
        },
      };

      const result = await callback(tx);
      state.balance = draft.balance;
      state.session = draft.session;
      state.transactions = draft.transactions;
      state.progressReports = draft.progressReports;
      return result;
    },
  };
}

const PROGRESS_REPORT: ProgressReportValues = {
  sessionId: 12,
  topics: 'Fractions',
  homeworkAssigned: null,
  publicNotes: 'Good progress',
  internalNotes: null,
  updatedAt: '2026-05-24T15:00:00.000Z',
};

describe('saveProgressReportAndCaptureRevenue', () => {
  it('captures pending revenue once and marks the session completed', async () => {
    const state: CaptureState = {
      balance: { available_minutes: 60, pending_minutes: 60 },
      session: { id: 12, parent_id: 7, slot_units: 2, status: 'Pending-Notes' },
      transactions: [],
      progressReports: [],
    };

    await expect(saveProgressReportAndCaptureRevenue(PROGRESS_REPORT, createCaptureDatabase(state))).resolves.toEqual({
      captured: true,
    });

    expect(state.balance).toEqual({ available_minutes: 60, pending_minutes: 0 });
    expect(state.session.status).toBe('Completed');
    expect(state.transactions).toEqual([
      {
        session_id: 12,
        available_delta_minutes: 0,
        pending_delta_minutes: -60,
        available_after_minutes: 60,
        pending_after_minutes: 0,
        idempotency_key: 'session_debit:12',
        type: 'session_debit',
      },
    ]);
  });

  it('updates notes without billing again when the session was already captured', async () => {
    const state: CaptureState = {
      balance: { available_minutes: 60, pending_minutes: 0 },
      session: { id: 12, parent_id: 7, slot_units: 2, status: 'Completed' },
      transactions: [
        {
          session_id: 12,
          available_delta_minutes: 0,
          pending_delta_minutes: -60,
          available_after_minutes: 60,
          pending_after_minutes: 0,
          idempotency_key: 'session_debit:12',
          type: 'session_debit',
        },
      ],
      progressReports: [],
    };

    await expect(saveProgressReportAndCaptureRevenue(PROGRESS_REPORT, createCaptureDatabase(state))).resolves.toEqual({
      captured: false,
    });

    expect(state.balance).toEqual({ available_minutes: 60, pending_minutes: 0 });
    expect(state.transactions).toHaveLength(1);
    expect(state.progressReports).toHaveLength(1);
  });

  it('rolls back notes when reserved credits are missing', async () => {
    const state: CaptureState = {
      balance: { available_minutes: 60, pending_minutes: 0 },
      session: { id: 12, parent_id: 7, slot_units: 2, status: 'Pending-Notes' },
      transactions: [],
      progressReports: [],
    };

    await expect(
      saveProgressReportAndCaptureRevenue(PROGRESS_REPORT, createCaptureDatabase(state))
    ).rejects.toBeInstanceOf(SessionRevenueCaptureError);
    expect(state.progressReports).toEqual([]);
    expect(state.transactions).toEqual([]);
  });

  it('rolls back notes and billing when the session is not pending notes', async () => {
    const state: CaptureState = {
      balance: { available_minutes: 60, pending_minutes: 60 },
      session: { id: 12, parent_id: 7, slot_units: 2, status: 'Scheduled' },
      transactions: [],
      progressReports: [],
    };

    await expect(
      saveProgressReportAndCaptureRevenue(PROGRESS_REPORT, createCaptureDatabase(state))
    ).rejects.toBeInstanceOf(SessionRevenueCaptureError);
    expect(state.balance).toEqual({ available_minutes: 60, pending_minutes: 60 });
    expect(state.session.status).toBe('Scheduled');
    expect(state.progressReports).toEqual([]);
    expect(state.transactions).toEqual([]);
  });
});
