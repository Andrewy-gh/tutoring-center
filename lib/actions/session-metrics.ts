'use server';

import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { sessionMetrics, sessions, tutors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

export async function submitSessionMetrics(formData: SessionMetricsFormData) {
  const role = await getUserRole();
  if (role !== 'tutor') {
    throw new Error('Only tutors can submit session metrics');
  }

  const userId = await getCurrentUserID();
  const db = await getDb();

  const [session] = await db
    .select({ tutorId: sessions.tutorId })
    .from(sessions)
    .where(eq(sessions.id, formData.sessionId))
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

  try {
    await db
      .insert(sessionMetrics)
      .values({
        sessionId: formData.sessionId,
        confidenceScore: formData.confidenceScore,
        sessionPerformance: formData.sessionPerformance,
        homeworkCompleted: formData.homeworkCompleted,
        tutorComments: formData.tutorComments || null,
        recordedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: sessionMetrics.sessionId,
        set: {
          confidenceScore: formData.confidenceScore,
          sessionPerformance: formData.sessionPerformance,
          homeworkCompleted: formData.homeworkCompleted,
          tutorComments: formData.tutorComments || null,
          recordedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message || 'Failed to submit session metrics' : 'Failed to submit session metrics'
    );
  }

  return { success: true };
}
