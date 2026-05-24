import { saveProgressReportAndCaptureRevenue } from '@/db/capture-session-revenue';
import { getTutorIdByUserId } from '@/db/queries/actors';
import { getSessionTutorId } from '@/db/queries/sessions/detail';
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
  saveProgressReportAndCaptureRevenue: (values: ProgressReportValues) => Promise<{ captured: boolean }>;
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
      await deps.saveProgressReportAndCaptureRevenue({
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
  saveProgressReportAndCaptureRevenue,
  now: () => new Date().toISOString(),
});
