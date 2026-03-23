import { sessionStatusEnum, transactionTypeEnum, weekDayEnum } from '@/lib/db/schema';
import {
  CANCELED_SESSION_STATUS,
  DEFAULT_SESSION_STATUS,
  FREE_SLOT_STATUSES,
  RESCHEDULED_SESSION_STATUS,
  SESSION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
  type EmbeddedUser,
  type UserRow,
} from '@/lib/db/types';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('db shared types', () => {
  it('derives shared enum constants from the Drizzle schema', () => {
    expect(SESSION_STATUS_OPTIONS).toEqual(sessionStatusEnum.enumValues);
    expect(TRANSACTION_TYPE_OPTIONS).toEqual(transactionTypeEnum.enumValues);
    expect(WEEKDAY_OPTIONS).toEqual(weekDayEnum.enumValues);
    expect(DEFAULT_SESSION_STATUS).toBe('Scheduled');
    expect(FREE_SLOT_STATUSES).toEqual([CANCELED_SESSION_STATUS, RESCHEDULED_SESSION_STATUS]);
  });

  it('exposes snake_case shared row aliases for embedded user shapes', () => {
    expectTypeOf<UserRow>().toMatchTypeOf<{
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string | null;
    }>();

    expectTypeOf<EmbeddedUser>().toEqualTypeOf<{
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string | null;
    }>();
  });
});
