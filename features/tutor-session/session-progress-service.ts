import { getTutorIdByUserId } from '@/db/queries/actors';
import { getSessionTutorId } from '@/db/queries/sessions/detail';
import { sessionProgress } from '@/db/schema';
import { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
import { assertTutorOwnsSession } from './tutor-session-authorization';

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
  return (await import('@/db/client')).db;
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
