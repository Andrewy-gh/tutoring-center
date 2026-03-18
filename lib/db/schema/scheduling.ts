import { integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { parents, students, tutors } from './core';

export const weekDayEnum = pgEnum('week_day', [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'Scheduled',
  'Pending-Notes',
  'Completed',
  'Canceled',
  'No-show',
  'Rescheduled',
]);

export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  tutorId: integer('tutor_id')
    .notNull()
    .references(() => tutors.id),
  category: text('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const availability = pgTable('availability', {
  id: serial('id').primaryKey(),
  tutorId: integer('tutor_id')
    .notNull()
    .references(() => tutors.id),
  weekDay: weekDayEnum('week_day').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id')
    .notNull()
    .references(() => parents.id),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  tutorId: integer('tutor_id')
    .notNull()
    .references(() => tutors.id),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id),
  slotUnits: integer('slot_units').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'string' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }).notNull(),
  status: sessionStatusEnum('status').notNull().default('Scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
