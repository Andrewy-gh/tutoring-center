import 'dotenv/config';
import { parents, students, users } from '@/db/schema';
import { closeTestDatabase, createTestDatabase } from '@/tests/helpers/postgresTestClient';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUserID } = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
}));

vi.mock('@/lib/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getCurrentUserID: mockGetCurrentUserID,
}));

const HAS_DB_ENV = Boolean(process.env.DATABASE_URL);
const describeIfConfigured = HAS_DB_ENV ? describe : describe.skip;

type TestDb = ReturnType<typeof createTestDatabase>['db'];

async function insertUser(
  db: TestDb,
  params: {
    email: string;
    firstName: string;
    lastName: string;
  }
) {
  const [row] = await db
    .insert(users)
    .values({
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      timezone: 'UTC',
      isActive: true,
    })
    .returning({ id: users.id });

  expect(row).toBeDefined();
  if (!row) {
    throw new Error('Failed to insert user');
  }

  return row.id;
}

describeIfConfigured('getStudents integration', () => {
  beforeEach(() => {
    mockGetCurrentUserID.mockReset();
  });

  it('returns data from the real database for a newly inserted student', async () => {
    const { getStudents } = await import('@/features/students/students-service');
    const client = createTestDatabase();
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const email = `students-int-${unique}@example.com`;

    let userId: number | undefined;
    let studentId: number | undefined;

    try {
      userId = await insertUser(client.db, {
        email,
        firstName: 'Integration',
        lastName: 'Student',
      });

      const [insertedStudent] = await client.db
        .insert(students)
        .values({
          userId,
          parentId: null,
          grade: '11',
        })
        .returning({ id: students.id });

      expect(insertedStudent).toBeDefined();
      if (!insertedStudent) {
        throw new Error('Failed to insert test student');
      }

      studentId = insertedStudent.id;

      const studentRows = await getStudents('admin');
      const addedStudent = studentRows.find(student => student.id === studentId);

      expect(addedStudent).toEqual({
        id: studentId,
        user_id: userId,
        name: 'Integration Student',
        email,
        phone: '—',
        grade: '11',
      });
    } finally {
      if (studentId) {
        await client.db.delete(students).where(eq(students.id, studentId));
      }
      if (userId) {
        await client.db.delete(users).where(eq(users.id, userId));
      }
      await closeTestDatabase(client);
    }
  });

  it('scopes parent role to only the current parent students', async () => {
    const { getStudents } = await import('@/features/students/students-service');
    const client = createTestDatabase();
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

    const userIDs: number[] = [];
    const parentIDs: number[] = [];
    const studentIDs: number[] = [];

    let parentAUserID: number | undefined;
    let studentAID: number | undefined;
    let studentBID: number | undefined;
    let studentAUserID: number | undefined;

    try {
      parentAUserID = await insertUser(client.db, {
        email: `parent-a-${unique}@example.com`,
        firstName: 'Parent',
        lastName: 'A',
      });
      userIDs.push(parentAUserID);

      const parentBUserID = await insertUser(client.db, {
        email: `parent-b-${unique}@example.com`,
        firstName: 'Parent',
        lastName: 'B',
      });
      userIDs.push(parentBUserID);

      const [parentA] = await client.db.insert(parents).values({ userId: parentAUserID }).returning({ id: parents.id });
      expect(parentA).toBeDefined();
      if (!parentA) throw new Error('Failed to insert parent A');
      parentIDs.push(parentA.id);

      const [parentB] = await client.db.insert(parents).values({ userId: parentBUserID }).returning({ id: parents.id });
      expect(parentB).toBeDefined();
      if (!parentB) throw new Error('Failed to insert parent B');
      parentIDs.push(parentB.id);

      studentAUserID = await insertUser(client.db, {
        email: `student-a-${unique}@example.com`,
        firstName: 'Scoped',
        lastName: 'A',
      });
      userIDs.push(studentAUserID);

      const studentBUserID = await insertUser(client.db, {
        email: `student-b-${unique}@example.com`,
        firstName: 'Scoped',
        lastName: 'B',
      });
      userIDs.push(studentBUserID);

      const [studentA] = await client.db
        .insert(students)
        .values({ userId: studentAUserID, parentId: parentA.id, grade: '7' })
        .returning({ id: students.id });
      expect(studentA).toBeDefined();
      if (!studentA) throw new Error('Failed to insert student A');
      studentAID = studentA.id;
      studentIDs.push(studentAID);

      const [studentB] = await client.db
        .insert(students)
        .values({ userId: studentBUserID, parentId: parentB.id, grade: '8' })
        .returning({ id: students.id });
      expect(studentB).toBeDefined();
      if (!studentB) throw new Error('Failed to insert student B');
      studentBID = studentB.id;
      studentIDs.push(studentBID);

      mockGetCurrentUserID.mockResolvedValue(parentAUserID);

      const scopedStudents = await getStudents('parent');
      const scopedIDs = scopedStudents.map(student => student.id);

      expect(scopedIDs).toContain(studentAID);
      expect(scopedIDs).not.toContain(studentBID);
      expect(scopedStudents.find(student => student.id === studentAID)).toEqual({
        id: studentAID,
        user_id: studentAUserID,
        name: 'Scoped A',
        email: `student-a-${unique}@example.com`,
        phone: '—',
        grade: '7',
      });
    } finally {
      for (const studentID of studentIDs) {
        await client.db.delete(students).where(eq(students.id, studentID));
      }
      for (const parentID of parentIDs) {
        await client.db.delete(parents).where(eq(parents.id, parentID));
      }
      for (const userID of userIDs) {
        await client.db.delete(users).where(eq(users.id, userID));
      }
      await closeTestDatabase(client);
    }
  });
});
