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
    orderBy: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

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
    const query = createSelectQuery([
      {
        id: 2,
        userId: 22,
        billingAddress: null,
        notificationPreferences: null,
        firstName: 'Alex',
        lastName: 'Brown',
        email: 'alex@example.com',
        phone: null,
        amountAvailable: 6,
        studentId: 8,
      },
      {
        id: 2,
        userId: 22,
        billingAddress: null,
        notificationPreferences: null,
        firstName: 'Alex',
        lastName: 'Brown',
        email: 'alex@example.com',
        phone: null,
        amountAvailable: 6,
        studentId: 9,
      },
      {
        id: 1,
        userId: 11,
        billingAddress: '123 Main St',
        notificationPreferences: 'email',
        firstName: 'Jamie',
        lastName: 'Adams',
        email: 'jamie@example.com',
        phone: '555-0100',
        amountAvailable: null,
        studentId: null,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getParents('admin')).resolves.toEqual([
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

    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.leftJoin).toHaveBeenCalledTimes(2);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('counts each student once when flat join rows repeat', async () => {
    const query = createSelectQuery([
      {
        id: 2,
        userId: 22,
        billingAddress: null,
        notificationPreferences: null,
        firstName: 'Alex',
        lastName: 'Brown',
        email: 'alex@example.com',
        phone: null,
        amountAvailable: 6,
        studentId: 8,
      },
      {
        id: 2,
        userId: 22,
        billingAddress: null,
        notificationPreferences: null,
        firstName: 'Alex',
        lastName: 'Brown',
        email: 'alex@example.com',
        phone: null,
        amountAvailable: 6,
        studentId: 8,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getParents('admin')).resolves.toEqual([
      {
        id: 2,
        user_id: 22,
        name: 'Alex Brown',
        email: 'alex@example.com',
        phone: '\u2014',
        student_count: 1,
        credit_balance_info: 6,
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
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('throws a database error when the parent list query fails', async () => {
    const query = createSelectQuery([]);
    query.then.mockImplementationOnce((_resolve, reject) =>
      Promise.reject(new Error('db failed')).then(undefined, reject)
    );
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getParents('admin')).rejects.toThrow(
      'Parent data is temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws a validation error when joined parent rows are malformed', async () => {
    const query = createSelectQuery([
      {
        id: 'bad-id',
        userId: 11,
        billingAddress: null,
        notificationPreferences: null,
        firstName: 'Jamie',
        lastName: 'Adams',
        email: 'jamie@example.com',
        phone: '555-0100',
        amountAvailable: null,
        studentId: null,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

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
    const query = createSelectQuery([
      {
        id: 7,
        userId: 77,
        billingAddress: null,
        notificationPreferences: 'sms',
        firstName: 'Morgan',
        lastName: 'Lee',
        email: 'morgan@example.com',
        phone: null,
        amountAvailable: 4,
        studentId: 4,
        studentUserId: 404,
        studentGrade: null,
        studentFirstName: 'Zoe',
        studentLastName: 'Lee',
        studentEmail: 'zoe@example.com',
        studentPhone: null,
      },
      {
        id: 7,
        userId: 77,
        billingAddress: null,
        notificationPreferences: 'sms',
        firstName: 'Morgan',
        lastName: 'Lee',
        email: 'morgan@example.com',
        phone: null,
        amountAvailable: 4,
        studentId: 3,
        studentUserId: 303,
        studentGrade: '6',
        studentFirstName: 'Ava',
        studentLastName: 'Lee',
        studentEmail: 'ava@example.com',
        studentPhone: '555-2222',
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getParent(77, 'admin')).resolves.toEqual({
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

    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.leftJoin).toHaveBeenCalledTimes(3);
  });

  it('throws notFound when the parent is missing', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    await expect(getParent(999, 'admin')).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('throws a validation error when the parent detail shape is invalid', async () => {
    const query = createSelectQuery([
      {
        id: 7,
        userId: 77,
        billingAddress: null,
        notificationPreferences: null,
        firstName: 'Morgan',
        lastName: 'Lee',
        email: 'morgan@example.com',
        phone: null,
        amountAvailable: 4,
        studentId: 3,
        studentUserId: 303,
        studentGrade: '6',
        studentFirstName: 'Ava',
        studentLastName: 'Lee',
        studentEmail: null,
        studentPhone: '555-2222',
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getParent(77, 'admin')).rejects.toThrow('Parent data format is invalid. Please try again later.');
  });
});
