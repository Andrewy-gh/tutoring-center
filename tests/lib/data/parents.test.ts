import type { UserRole } from '@/lib/auth';
import { getParent, getParents } from '@/lib/data/parents';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockForbidden, mockNotFound, mockDbSelect } = vi.hoisted(() => ({
  mockForbidden: vi.fn(),
  mockNotFound: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
  notFound: mockNotFound,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createRejectingSelectQuery(message: string) {
  const query = createSelectQuery([]);
  query.then.mockImplementationOnce((_resolve, reject) => Promise.reject(new Error(message)).then(undefined, reject));
  return query;
}

describe('getParents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('maps joined parent rows with student counts, credits, and fallbacks', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        {
          id: 2,
          user_id: 22,
          billing_address: null,
          notification_preferences: null,
          first_name: 'Alex',
          last_name: 'Brown',
          email: 'alex@example.com',
          phone: null,
          amount_available: 6,
          student_id: 8,
        },
        {
          id: 2,
          user_id: 22,
          billing_address: null,
          notification_preferences: null,
          first_name: 'Alex',
          last_name: 'Brown',
          email: 'alex@example.com',
          phone: null,
          amount_available: 6,
          student_id: 9,
        },
        {
          id: 1,
          user_id: 11,
          billing_address: '123 Main St',
          notification_preferences: 'email',
          first_name: 'Jamie',
          last_name: 'Adams',
          email: 'jamie@example.com',
          phone: '555-0100',
          amount_available: null,
          student_id: null,
        },
      ])
    );

    const result = await getParents('admin');

    expect(result).toEqual([
      {
        id: 2,
        user_id: 22,
        name: 'Alex Brown',
        email: 'alex@example.com',
        phone: '\u2014',
        student_count: 2,
        credit_balance_info: 6,
      },
      {
        id: 1,
        user_id: 11,
        name: 'Jamie Adams',
        email: 'jamie@example.com',
        phone: '555-0100',
        student_count: 0,
        credit_balance_info: 0,
      },
    ]);
  });

  it('rejects missing roles before querying', async () => {
    await expect(getParents(undefined as unknown as UserRole)).rejects.toThrow('Role is required to fetch parents.');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('blocks non-admin roles', async () => {
    await expect(getParents('parent')).rejects.toThrow('forbidden');
    await expect(getParents('tutor')).rejects.toThrow('forbidden');
    expect(mockForbidden).toHaveBeenCalledTimes(2);
  });

  it('throws a database error when parent list query fails', async () => {
    mockDbSelect.mockReturnValueOnce(createRejectingSelectQuery('db failed'));

    await expect(getParents('admin')).rejects.toThrow(
      'Parent data is temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws a validation error when parent list rows are malformed', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 'bad-id', user_id: 11 }]));

    await expect(getParents('admin')).rejects.toThrow('Parent data format is invalid. Please try again later.');
  });
});

describe('getParent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('maps a joined parent profile using user_id route params', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 7,
            user_id: 77,
            billing_address: null,
            notification_preferences: 'sms',
            first_name: 'Morgan',
            last_name: 'Lee',
            email: 'morgan@example.com',
            phone: null,
            amount_available: 4,
          },
        ])
      )
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 4,
            user_id: 404,
            grade: null,
            first_name: 'Zoe',
            last_name: 'Lee',
            email: 'zoe@example.com',
            phone: null,
          },
          {
            id: 3,
            user_id: 303,
            grade: '6',
            first_name: 'Ava',
            last_name: 'Lee',
            email: 'ava@example.com',
            phone: '555-2222',
          },
        ])
      );

    const result = await getParent(77, 'admin');

    expect(result).toEqual({
      id: 7,
      user_id: 77,
      name: 'Morgan Lee',
      email: 'morgan@example.com',
      phone: '\u2014',
      student_count: 2,
      credit_balance_info: 4,
      billing_address: '\u2014',
      notification_preferences: 'sms',
      students: [
        {
          id: 3,
          user_id: 303,
          name: 'Ava Lee',
          email: 'ava@example.com',
          phone: '555-2222',
          grade: '6',
        },
        {
          id: 4,
          user_id: 404,
          name: 'Zoe Lee',
          email: 'zoe@example.com',
          phone: '\u2014',
          grade: '\u2014',
        },
      ],
    });
  });

  it('throws notFound when the parent is missing', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    await expect(getParent(999, 'admin')).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('throws a validation error when the parent detail shape is invalid', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 7,
            user_id: 77,
            billing_address: null,
            notification_preferences: null,
            first_name: 'Morgan',
            last_name: 'Lee',
            email: 'morgan@example.com',
            phone: null,
            amount_available: 4,
          },
        ])
      )
      .mockReturnValueOnce(createSelectQuery([{ id: 'bad-id' }]));

    await expect(getParent(77, 'admin')).rejects.toThrow('Parent data format is invalid. Please try again later.');
  });
});
