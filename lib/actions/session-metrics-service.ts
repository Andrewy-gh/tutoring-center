import { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
import { getTutorIdByUserId } from '@/lib/db/queries/actors';
import { sessionMetrics, sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { assertTutorOwnsSession } from './tutor-session-authorization';

type SessionTutorLookup = {
  select: (fields: { tutorId: typeof sessions.tutorId }) => {
    from: (table: typeof sessions) => {
      where: (condition: ReturnType<typeof eq>) => {
        limit: (count: number) => Promise<Array<{ tutorId: number }>>;
      };
    };
  };
};

type SessionMetricsInsertValues = {
  sessionId: number;
  confidenceScore: number;
  sessionPerformance: number;
  homeworkCompleted: boolean;
  tutorComments: string | null;
  recordedAt: string;
  updatedAt: string;
};

export type SessionMetricsWriter = {
  saveSessionMetrics: (values: SessionMetricsInsertValues) => Promise<void>;
};

export type SessionMetricsServiceDeps = SessionMetricsWriter & {
  getUserRole: () => Promise<UserRole>;
  getCurrentUserID: () => Promise<number>;
  getTutorIdByUserId: (userId: number) => Promise<number | null>;
  getSessionTutorId: (sessionId: number) => Promise<number | null>;
  now: () => string;
};

export type SessionMetricsFormData = {
  sessionId: number;
  confidenceScore: number;
  sessionPerformance: number;
  homeworkCompleted: boolean;
  tutorComments: string;
};

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

async function getSessionTutorId(sessionId: number) {
  const db = (await getDb()) as unknown as SessionTutorLookup;
  const [session] = await db
    .select({ tutorId: sessions.tutorId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return session?.tutorId ?? null;
}

async function saveSessionMetrics(values: SessionMetricsInsertValues) {
  const db = await getDb();

  await db
    .insert(sessionMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: sessionMetrics.sessionId,
      set: {
        confidenceScore: values.confidenceScore,
        sessionPerformance: values.sessionPerformance,
        homeworkCompleted: values.homeworkCompleted,
        tutorComments: values.tutorComments,
        recordedAt: values.recordedAt,
        updatedAt: values.updatedAt,
      },
    });
}

export function createSessionMetricsService(deps: SessionMetricsServiceDeps) {
  return {
    async submitSessionMetrics(formData: SessionMetricsFormData) {
      const role = await deps.getUserRole();
      if (role !== 'tutor') {
        throw new Error('Only tutors can submit session metrics');
      }

      const userId = await deps.getCurrentUserID();
      await assertTutorOwnsSession(formData.sessionId, userId, {
        getSessionTutorId: deps.getSessionTutorId,
        getTutorIdByUserId: deps.getTutorIdByUserId,
      });

      const now = deps.now();
      await deps.saveSessionMetrics({
        sessionId: formData.sessionId,
        confidenceScore: formData.confidenceScore,
        sessionPerformance: formData.sessionPerformance,
        homeworkCompleted: formData.homeworkCompleted,
        tutorComments: formData.tutorComments || null,
        recordedAt: now,
        updatedAt: now,
      });

      return { success: true };
    },
  };
}

export const sessionMetricsService = createSessionMetricsService({
  getUserRole,
  getCurrentUserID,
  getTutorIdByUserId,
  getSessionTutorId,
  saveSessionMetrics,
  now: () => new Date().toISOString(),
});
