import 'server-only';
import { sessions } from '@/db/schema';
import { type SessionUpdateInput } from '@/lib/validators/sessions';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export type UpdatedSessionStatusRow = {
  id: number;
  tutor_id: number;
  student_id: number;
  subject_id: number;
  parent_id: number;
  slot_units: number;
  scheduled_at: string;
  ends_at: string;
  status: typeof sessions.$inferSelect.status;
};

export async function updateSessionStatusById(input: SessionUpdateInput) {
  const db = await getDb();
  const [session] = await db.update(sessions).set({ status: input.status }).where(eq(sessions.id, input.id)).returning({
    id: sessions.id,
    tutor_id: sessions.tutorId,
    student_id: sessions.studentId,
    subject_id: sessions.subjectId,
    parent_id: sessions.parentId,
    slot_units: sessions.slotUnits,
    scheduled_at: sessions.scheduledAt,
    ends_at: sessions.endsAt,
    status: sessions.status,
  });

  return session ?? null;
}
