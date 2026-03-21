'use server';

import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { getTutorIdByUserId } from '@/lib/db/queries/actors';
import { sessionMetrics, sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export type SessionMetricsFormData = {
  sessionId: number;
  confidenceScore: number;
  sessionPerformance: number;
  homeworkCompleted: boolean;
  tutorComments: string;
};

async function assertTutorCanSubmitSessionMetrics(sessionId: number, userId: number) {
  const db = await getDb();
  const [session] = await db
    .select({ tutorId: sessions.tutorId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error('Session not found');
  }

  const tutorId = await getTutorIdByUserId(userId);
  if (!tutorId) {
    throw new Error('Tutor profile not found');
  }

  if (session.tutorId !== tutorId) {
    throw new Error('You are not assigned to this session');
  }
}

export async function submitSessionMetrics(formData: SessionMetricsFormData) {
  const role = await getUserRole();
  if (role !== 'tutor') {
    throw new Error('Only tutors can submit session metrics');
  }

  const userId = await getCurrentUserID();
  await assertTutorCanSubmitSessionMetrics(formData.sessionId, userId);

  const now = new Date().toISOString();
  const db = await getDb();
  const values = {
    sessionId: formData.sessionId,
    confidenceScore: formData.confidenceScore,
    sessionPerformance: formData.sessionPerformance,
    homeworkCompleted: formData.homeworkCompleted,
    tutorComments: formData.tutorComments || null,
    recordedAt: now,
    updatedAt: now,
  };

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

  return { success: true };
}
