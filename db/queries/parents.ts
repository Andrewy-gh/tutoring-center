import 'server-only';
import { creditBalances, parents, students, users } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDb() {
  return (await import('@/db/client')).db;
}

const parentListJoinSelect = {
  id: parents.id,
  userId: parents.userId,
  billingAddress: parents.billingAddress,
  notificationPreferences: parents.notificationPreferences,
  firstName: users.firstName,
  lastName: users.lastName,
  email: users.email,
  phone: users.phone,
  availableMinutes: creditBalances.availableMinutes,
  studentId: students.id,
};

export async function getParentListJoinRows() {
  const db = await getDb();

  return db
    .select(parentListJoinSelect)
    .from(parents)
    .innerJoin(users, eq(parents.userId, users.id))
    .leftJoin(creditBalances, eq(creditBalances.parentId, parents.id))
    .leftJoin(students, eq(students.parentId, parents.id))
    .orderBy(asc(parents.id), asc(students.id));
}

export async function getParentDetailJoinRowsByUserId(userId: number) {
  const db = await getDb();
  const studentUsers = alias(users, 'student_users');

  return db
    .select({
      ...parentListJoinSelect,
      studentUserId: students.userId,
      studentGrade: students.grade,
      studentFirstName: studentUsers.firstName,
      studentLastName: studentUsers.lastName,
      studentEmail: studentUsers.email,
      studentPhone: studentUsers.phone,
    })
    .from(parents)
    .innerJoin(users, eq(parents.userId, users.id))
    .leftJoin(creditBalances, eq(creditBalances.parentId, parents.id))
    .leftJoin(students, eq(students.parentId, parents.id))
    .leftJoin(studentUsers, eq(students.userId, studentUsers.id))
    .where(eq(parents.userId, userId))
    .orderBy(asc(students.id));
}
