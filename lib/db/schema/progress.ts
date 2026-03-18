import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { students } from './core';
import { sessions } from './scheduling';

export const studentGrades = pgTable('student_grades', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  subject: text('subject').notNull(),
  grade: text('grade').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const sessionProgress = pgTable('session_progress', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id),
  topics: text('topics'),
  publicNotes: text('public_notes'),
  internalNotes: text('internal_notes'),
  homeworkAssigned: text('homework_assigned'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const sessionMetrics = pgTable('session_metrics', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id),
  studentId: integer('student_id').references(() => students.id),
  sessionPerformance: integer('session_performance'),
  confidenceScore: integer('confidence_score'),
  homeworkCompleted: boolean('homework_completed').notNull().default(false),
  tutorComments: text('tutor_comments'),
  recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
