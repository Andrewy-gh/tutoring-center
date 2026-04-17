import 'dotenv/config';
import {
  availability,
  CANCELED_SESSION_STATUS,
  parents,
  sessions,
  students,
  subjects,
  tutors,
  tutorSubjects,
  users,
  type SessionStatus,
} from '@/lib/db/schema';
import { closeTestDatabase, createTestDatabase } from '@/tests/helpers/postgresTestClient';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

type Fixture = {
  tutorId: number;
  subjectId: number;
  tutorSubjectId: number;
  parentId: number;
  studentId: number;
  tutorUserId: number;
  parentUserId: number;
  studentUserId: number;
  availabilityIds: number[];
  sessionIds: number[];
};

const RANGE_FROM = '2026-03-02';
const RANGE_TO = '2026-03-03';
const RANGE_START_UTC = '2026-03-02T05:00:00.000Z';
const RANGE_END_UTC = '2026-03-03T05:00:00.000Z';
const HAS_DB_ENV = Boolean(process.env.DATABASE_URL);
const describeIfConfigured = HAS_DB_ENV ? describe : describe.skip;
const AVAILABLE_SLOTS_ERROR_MESSAGES = {
  database: 'Available slots are temporarily unavailable. Please retry in a moment.',
  tutorSubject: 'Tutor does not teach this subject',
} as const;

type TestDb = ReturnType<typeof createTestDatabase>['db'];

async function insertUser(db: TestDb, args: { email: string; firstName: string; lastName: string }): Promise<number> {
  const [row] = await db
    .insert(users)
    .values({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      timezone: 'UTC',
      isActive: true,
    })
    .returning({ id: users.id });

  expect(row).toBeDefined();
  if (!row) throw new Error('Failed to insert user');
  return row.id;
}

async function createFixture({
  db,
  unique,
  withAvailability,
}: {
  db: TestDb;
  unique: string;
  withAvailability: boolean;
}): Promise<Fixture> {
  const tutorUserId = await insertUser(db, {
    email: `available-slots-tutor-${unique}@example.com`,
    firstName: 'Available',
    lastName: 'Tutor',
  });
  const parentUserId = await insertUser(db, {
    email: `available-slots-parent-${unique}@example.com`,
    firstName: 'Available',
    lastName: 'Parent',
  });
  const studentUserId = await insertUser(db, {
    email: `available-slots-student-${unique}@example.com`,
    firstName: 'Available',
    lastName: 'Student',
  });

  const [tutor] = await db.insert(tutors).values({ userId: tutorUserId, verified: false }).returning({ id: tutors.id });
  expect(tutor).toBeDefined();
  if (!tutor) throw new Error('Failed to insert tutor');

  const [parent] = await db.insert(parents).values({ userId: parentUserId }).returning({ id: parents.id });
  expect(parent).toBeDefined();
  if (!parent) throw new Error('Failed to insert parent');

  const [student] = await db
    .insert(students)
    .values({ userId: studentUserId, parentId: parent.id, grade: '9' })
    .returning({ id: students.id });
  expect(student).toBeDefined();
  if (!student) throw new Error('Failed to insert student');

  const [subject] = await db
    .insert(subjects)
    .values({ name: 'Math', slug: `math-${unique}`, kind: 'leaf', isActive: true })
    .returning({ id: subjects.id });
  expect(subject).toBeDefined();
  if (!subject) throw new Error('Failed to insert subject');

  const [tutorSubject] = await db
    .insert(tutorSubjects)
    .values({ tutorId: tutor.id, subjectId: subject.id, subjectKind: 'leaf' })
    .returning({ id: tutorSubjects.id });
  expect(tutorSubject).toBeDefined();
  if (!tutorSubject) throw new Error('Failed to insert tutor subject');

  const fixture: Fixture = {
    tutorId: tutor.id,
    subjectId: subject.id,
    tutorSubjectId: tutorSubject.id,
    parentId: parent.id,
    studentId: student.id,
    tutorUserId,
    parentUserId,
    studentUserId,
    availabilityIds: [],
    sessionIds: [],
  };

  if (withAvailability) {
    const availabilityRows = await db
      .insert(availability)
      .values([{ tutorId: tutor.id, weekDay: 'Monday', startTime: '15:00:00', endTime: '18:00:00' }])
      .returning({ id: availability.id });

    fixture.availabilityIds = availabilityRows.map(row => row.id);
  }

  return fixture;
}

async function insertSessions(
  db: TestDb,
  fixture: Fixture,
  rows: Array<{ scheduled_at: string; ends_at: string; status: SessionStatus }>
) {
  if (!rows.length) return;

  const insertedRows = await db
    .insert(sessions)
    .values(
      rows.map(row => {
        const durationMinutes = (new Date(row.ends_at).getTime() - new Date(row.scheduled_at).getTime()) / (60 * 1000);

        return {
          tutorId: fixture.tutorId,
          subjectId: fixture.subjectId,
          parentId: fixture.parentId,
          studentId: fixture.studentId,
          scheduledAt: row.scheduled_at,
          endsAt: row.ends_at,
          status: row.status,
          slotUnits: durationMinutes / 30,
        };
      })
    )
    .returning({ id: sessions.id });

  fixture.sessionIds.push(...insertedRows.map(row => row.id));
}

async function cleanupFixture(db: TestDb, fixture: Fixture) {
  for (const id of fixture.sessionIds) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  for (const id of fixture.availabilityIds) {
    await db.delete(availability).where(eq(availability.id, id));
  }
  await db.delete(tutorSubjects).where(eq(tutorSubjects.id, fixture.tutorSubjectId));
  await db.delete(subjects).where(eq(subjects.id, fixture.subjectId));
  await db.delete(students).where(eq(students.id, fixture.studentId));
  await db.delete(parents).where(eq(parents.id, fixture.parentId));
  await db.delete(tutors).where(eq(tutors.id, fixture.tutorId));
  await db.delete(users).where(eq(users.id, fixture.studentUserId));
  await db.delete(users).where(eq(users.id, fixture.parentUserId));
  await db.delete(users).where(eq(users.id, fixture.tutorUserId));
}

describeIfConfigured('getAvailableSlots integration', () => {
  it('returns expected slots when canceled and boundary-touching sessions exist', async () => {
    const { getAvailableSlots } = await import('@/lib/data/available-sessions');
    const client = createTestDatabase();
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const fixture = await createFixture({ db: client.db, unique, withAvailability: true });

    try {
      await insertSessions(client.db, fixture, [
        {
          scheduled_at: '2026-03-02T20:00:00.000Z',
          ends_at: '2026-03-02T21:00:00.000Z',
          status: CANCELED_SESSION_STATUS,
        },
        { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z', status: 'Scheduled' },
        { scheduled_at: '2026-03-02T04:00:00.000Z', ends_at: RANGE_START_UTC, status: 'Scheduled' },
        { scheduled_at: RANGE_END_UTC, ends_at: '2026-03-03T06:00:00.000Z', status: 'Scheduled' },
      ]);

      const result = await getAvailableSlots(fixture.tutorId, fixture.subjectId, RANGE_FROM, RANGE_TO);

      expect(result).toEqual([
        { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z' },
        { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
      ]);
    } finally {
      await cleanupFixture(client.db, fixture);
      await closeTestDatabase(client);
    }
  }, 10000);

  it('throws tutor-subject error when subject does not belong to tutor', async () => {
    const { getAvailableSlots } = await import('@/lib/data/available-sessions');
    const client = createTestDatabase();
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const fixture = await createFixture({ db: client.db, unique, withAvailability: true });

    try {
      await expect(
        getAvailableSlots(fixture.tutorId, fixture.subjectId + 999_999, RANGE_FROM, RANGE_TO)
      ).rejects.toThrow(AVAILABLE_SLOTS_ERROR_MESSAGES.tutorSubject);
    } finally {
      await cleanupFixture(client.db, fixture);
      await closeTestDatabase(client);
    }
  }, 10000);
});
