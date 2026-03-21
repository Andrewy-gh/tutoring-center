import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sessionMetrics, sessionProgress, sessions, type SessionStatus } from '../lib/db/schema';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  return value;
}

const sql = postgres(requireEnv('DATABASE_URL'), {
  max: 1,
  prepare: false,
});
const db = drizzle(sql);

const TUTOR_IDS = [1, 2];

async function deleteOldSeedData() {
  const sessionsToDelete = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.parentId, 1), inArray(sessions.status, ['Completed', 'Scheduled'])));

  const sessionIds = sessionsToDelete.map(session => session.id);

  if (sessionIds.length > 0) {
    await db.delete(sessionMetrics).where(inArray(sessionMetrics.sessionId, sessionIds));
    await db.delete(sessionProgress).where(inArray(sessionProgress.sessionId, sessionIds));
    await db.delete(sessions).where(inArray(sessions.id, sessionIds));
  }
}

const subjectCatalog = [
  { id: 1, name: 'Math' },
  { id: 2, name: 'Reading' },
  { id: 3, name: 'Science' },
];

const studentSubjects = [
  { studentId: 1, subjectId: 1, type: 'happy' },
  { studentId: 1, subjectId: 2, type: 'happy' },
  { studentId: 1, subjectId: 3, type: 'happy' },
  { studentId: 2, subjectId: 1, type: 'struggling' },
  { studentId: 2, subjectId: 2, type: 'struggling' },
] as const;

type SeedSessionRow = {
  parentId: number;
  studentId: number;
  tutorId: number;
  subjectId: number;
  scheduledAt: string;
  endsAt: string;
  status: SessionStatus;
  slotUnits: number;
};

function generateSessionsForStudent(studentId: number, subjectId: number, startWeek: number, hourOffset: number) {
  const sessionRows: SeedSessionRow[] = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const daysAgo = startWeek * 7 + i * 14;
    const baseTime = now.getTime() - daysAgo * 24 * 60 * 60 * 1000;
    const tutorId = TUTOR_IDS[i % TUTOR_IDS.length];
    sessionRows.push({
      parentId: 1,
      studentId,
      tutorId,
      subjectId,
      scheduledAt: new Date(baseTime + hourOffset * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(baseTime + hourOffset * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      status: 'Completed',
      slotUnits: 2,
    });
  }

  const futureTime = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  sessionRows.push({
    parentId: 1,
    studentId,
    tutorId: TUTOR_IDS[0],
    subjectId,
    scheduledAt: new Date(futureTime + hourOffset * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(futureTime + hourOffset * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    status: 'Scheduled',
    slotUnits: 2,
  });

  return sessionRows;
}

async function seedSessions() {
  const allSessions: SeedSessionRow[] = [];
  let startWeek = 26;

  for (let index = 0; index < studentSubjects.length; index++) {
    const subjectRow = studentSubjects[index];
    allSessions.push(...generateSessionsForStudent(subjectRow.studentId, subjectRow.subjectId, startWeek, index * 3));
    startWeek -= 2;
  }

  const recentSessions: SeedSessionRow[] = [];
  for (let subjectIndex = 0; subjectIndex < studentSubjects.length; subjectIndex++) {
    const subjectRow = studentSubjects[subjectIndex];
    for (let sessionIndex = 0; sessionIndex < 3; sessionIndex++) {
      const daysAgo = sessionIndex * 10;
      const baseTime = new Date().getTime() - daysAgo * 24 * 60 * 60 * 1000;
      recentSessions.push({
        parentId: 1,
        studentId: subjectRow.studentId,
        tutorId: TUTOR_IDS[sessionIndex % TUTOR_IDS.length],
        subjectId: subjectRow.subjectId,
        scheduledAt: new Date(baseTime + subjectIndex * 3 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(baseTime + subjectIndex * 3 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        status: 'Completed',
        slotUnits: 2,
      });
    }
  }

  const insertedSessions: Array<{
    id: number;
    subject_id: number;
    student_id: number;
    scheduled_at: string;
  }> = [];

  for (const sessionRow of [...recentSessions, ...allSessions]) {
    try {
      const [inserted] = await db.insert(sessions).values(sessionRow).returning({
        id: sessions.id,
        subject_id: sessions.subjectId,
        student_id: sessions.studentId,
        scheduled_at: sessions.scheduledAt,
      });

      if (inserted) {
        insertedSessions.push(inserted);
      }
    } catch {
      continue;
    }
  }

  return insertedSessions;
}

function getMetricsForStudent(sessionIndex: number, studentType: 'happy' | 'struggling') {
  if (studentType === 'happy') {
    const happyPath = [
      { performance: 1, confidence: 1, completed: false },
      { performance: 2, confidence: 2, completed: true },
      { performance: 2, confidence: 3, completed: true },
      { performance: 3, confidence: 3, completed: true },
      { performance: 4, confidence: 4, completed: true },
      { performance: 4, confidence: 4, completed: false },
      { performance: 5, confidence: 5, completed: true },
    ];
    return happyPath[sessionIndex % happyPath.length];
  }

  const strugglingPath = [
    { performance: 1, confidence: 1, completed: false },
    { performance: 1, confidence: 1, completed: false },
    { performance: 2, confidence: 2, completed: true },
    { performance: 1, confidence: 1, completed: false },
    { performance: 2, confidence: 2, completed: true },
    { performance: 2, confidence: 1, completed: false },
    { performance: 3, confidence: 2, completed: true },
  ];
  return strugglingPath[sessionIndex % strugglingPath.length];
}

async function seedSessionMetrics(
  seededSessions: Array<{ id: number; subject_id: number; student_id: number; scheduled_at: string }>
) {
  const sessionsByStudent = new Map<number, typeof seededSessions>();
  for (const sessionRow of seededSessions) {
    const existing = sessionsByStudent.get(sessionRow.student_id) ?? [];
    existing.push(sessionRow);
    sessionsByStudent.set(sessionRow.student_id, existing);
  }

  for (const [studentId, studentSessionRows] of sessionsByStudent) {
    const completedSessions = studentSessionRows
      .filter(sessionRow => new Date(sessionRow.scheduled_at) < new Date())
      .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime());

    for (const [index, sessionRow] of completedSessions.slice(0, -2).entries()) {
      const studentType: 'happy' | 'struggling' = studentId === 1 ? 'happy' : 'struggling';
      const metrics = getMetricsForStudent(index, studentType);
      const subject = subjectCatalog.find(item => item.id === sessionRow.subject_id);

      try {
        await db.insert(sessionMetrics).values({
          sessionId: sessionRow.id,
          sessionPerformance: metrics.performance,
          confidenceScore: metrics.confidence,
          homeworkCompleted: metrics.completed,
          tutorComments:
            studentType === 'happy'
              ? `Great progress in ${subject?.name}!`
              : `Working on improving in ${subject?.name}.`,
          recordedAt: sessionRow.scheduled_at,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        continue;
      }
    }
  }
}

async function seedSessionProgress(seededSessions: Array<{ id: number; subject_id: number; scheduled_at: string }>) {
  const topicsBySubject: Record<number, string[]> = {
    1: ['Algebra basics', 'Linear equations', 'Variables', 'Solving equations', 'Graphing', 'Quadratics', 'Review'],
    2: [
      'Reading comprehension',
      'Vocabulary',
      'Phonics',
      'Story structure',
      'Main idea',
      'Literary analysis',
      'Analysis',
    ],
    3: [
      'Scientific method',
      'Physics basics',
      'Biology intro',
      'Chemistry fundamentals',
      'Earth science',
      'Lab skills',
      'Review',
    ],
  };

  for (const [index, sessionRow] of seededSessions.slice(0, -10).entries()) {
    if (new Date(sessionRow.scheduled_at) > new Date()) {
      continue;
    }

    const topics = topicsBySubject[sessionRow.subject_id] ?? ['General review'];
    const topic = topics[index % topics.length];
    const subject = subjectCatalog.find(item => item.id === sessionRow.subject_id);

    try {
      await db.insert(sessionProgress).values({
        sessionId: sessionRow.id,
        topics: `${subject?.name}: ${topic}`,
        homeworkAssigned: `Practice ${topic.toLowerCase()}`,
        publicNotes: `Covered ${topic} in ${subject?.name}.`,
        internalNotes: 'Regular session.',
        createdAt: sessionRow.scheduled_at,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }
}

async function main() {
  try {
    await deleteOldSeedData();

    const seededSessions = await seedSessions();
    if (seededSessions.length > 0) {
      await seedSessionMetrics(seededSessions);
      await seedSessionProgress(seededSessions);
    }
  } finally {
    await sql.end({ timeout: 0 });
  }
}

void main();
