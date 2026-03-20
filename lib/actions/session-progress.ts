'use server';

import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { sessionProgress, sessions, tutors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type ProgressReportFormData = {
  sessionId: number;
  topics: string;
  homeworkAssigned: string;
  publicNotes: string;
  internalNotes: string;
};

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export async function submitProgressReport(formData: ProgressReportFormData) {
  const role = await getUserRole();
  if (role !== 'tutor') {
    throw new Error('Only tutors can submit progress reports');
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
      .insert(sessionProgress)
      .values({
        sessionId: formData.sessionId,
        topics: formData.topics || null,
        homeworkAssigned: formData.homeworkAssigned || null,
        publicNotes: formData.publicNotes || null,
        internalNotes: formData.internalNotes || null,
      })
      .onConflictDoUpdate({
        target: sessionProgress.sessionId,
        set: {
          topics: formData.topics || null,
          homeworkAssigned: formData.homeworkAssigned || null,
          publicNotes: formData.publicNotes || null,
          internalNotes: formData.internalNotes || null,
          updatedAt: new Date().toISOString(),
        },
      });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message || 'Failed to submit progress report' : 'Failed to submit progress report'
    );
  }

  return { success: true };
}
