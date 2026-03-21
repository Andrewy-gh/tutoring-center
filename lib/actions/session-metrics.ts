'use server';

import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { sessionMetrics, sessions, tutors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type SessionMetricsFormData = {
  sessionId: number;
  confidenceScore: number;
  sessionPerformance: number;
  homeworkCompleted: boolean;
  tutorComments: string;
};

async function assertTutorCanSubmitSessionMetrics(sessionId: number, userId: number) {
  const [session] = await db
    .select({ tutorId: sessions.tutorId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error('Session not found');
  }

  const [tutor] = await db.select({ id: tutors.id }).from(tutors).where(eq(tutors.userId, userId)).limit(1);

  if (!tutor) {
    throw new Error('Tutor profile not found');
  }

  if (session.tutorId !== tutor.id) {
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
