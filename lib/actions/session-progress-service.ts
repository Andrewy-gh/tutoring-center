import { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
import { getTutorIdByUserId } from '@/lib/db/queries/actors';
import { sessionProgress, sessions } from '@/lib/db/schema';
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

type ProgressReportValues = {
  sessionId: number;
  topics: string | null;
  homeworkAssigned: string | null;
  publicNotes: string | null;
  internalNotes: string | null;
  updatedAt: string;
};

export type ProgressReportWriter = {
  saveProgressReport: (values: ProgressReportValues) => Promise<void>;
};

export type ProgressReportFormData = {
  sessionId: number;
  topics: string;
  homeworkAssigned: string;
  publicNotes: string;
  internalNotes: string;
};

export type SessionProgressServiceDeps = ProgressReportWriter & {
  getUserRole: () => Promise<UserRole>;
  getCurrentUserID: () => Promise<number>;
  getTutorIdByUserId: (userId: number) => Promise<number | null>;
  getSessionTutorId: (sessionId: number) => Promise<number | null>;
  now: () => string;
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

async function saveProgressReport(values: ProgressReportValues) {
  const db = await getDb();

  await db
    .insert(sessionProgress)
    .values(values)
    .onConflictDoUpdate({
      target: sessionProgress.sessionId,
      set: {
        topics: values.topics,
        homeworkAssigned: values.homeworkAssigned,
        publicNotes: values.publicNotes,
        internalNotes: values.internalNotes,
        updatedAt: values.updatedAt,
      },
    });
}

export function createSessionProgressService(deps: SessionProgressServiceDeps) {
  return {
    async submitProgressReport(formData: ProgressReportFormData) {
      const role = await deps.getUserRole();
      if (role !== 'tutor') {
        throw new Error('Only tutors can submit progress reports');
      }

      const userId = await deps.getCurrentUserID();
      await assertTutorOwnsSession(formData.sessionId, userId, {
        getSessionTutorId: deps.getSessionTutorId,
        getTutorIdByUserId: deps.getTutorIdByUserId,
      });

      const updatedAt = deps.now();
      await deps.saveProgressReport({
        sessionId: formData.sessionId,
        topics: formData.topics || null,
        homeworkAssigned: formData.homeworkAssigned || null,
        publicNotes: formData.publicNotes || null,
        internalNotes: formData.internalNotes || null,
        updatedAt,
      });

      return { success: true };
    },
  };
}

export const sessionProgressService = createSessionProgressService({
  getUserRole,
  getCurrentUserID,
  getTutorIdByUserId,
  getSessionTutorId,
  saveProgressReport,
  now: () => new Date().toISOString(),
});
