import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  profilePic: text('profile_pic'),
  role: integer('role').references(() => roles.id),
  timezone: text('timezone').notNull(),
  isActive: boolean('is_active').notNull(),
  lastLogin: timestamp('last_login', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const parents = pgTable('parents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  billingAddress: text('billing_address'),
  notificationPreferences: text('notification_preferences'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  parentId: integer('parent_id').references(() => parents.id),
  birthDate: timestamp('birth_date', { mode: 'string' }),
  grade: text('grade'),
  learningGoals: text('learning_goals'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const tutors = pgTable('tutors', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  verified: boolean('verified').notNull(),
  education: text('education'),
  bio: text('bio'),
  tagline: text('tagline'),
  yearsExperience: integer('years_experience'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
