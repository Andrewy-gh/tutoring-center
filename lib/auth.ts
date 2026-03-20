import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parents, roles, tutors, users } from '@/lib/db/schema';
import { asc, eq, ilike } from 'drizzle-orm';

export type UserRole = 'admin' | 'parent' | 'tutor';

export const USER_ROLE_COOKIE_NAME = 'user-role';
export const USER_ID_COOKIE_NAME = 'user-id';
const USER_ROLE_COOKIE_MAX_AGE = 60 * 60 * 1; // 1 hour
const USER_ID_COOKIE_MAX_AGE = 60 * 60 * 1; // 1 hour

export const ADMIN_ONLY_ROUTES = ['/dashboard/tutors', '/dashboard/parents'];

export function isValidRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'parent' || value === 'tutor';
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'parent' || value === 'tutor';
}

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export async function getUserRole() {
  const cookieStore = await cookies();
  const role = cookieStore.get(USER_ROLE_COOKIE_NAME)?.value;
  if (!isValidRole(role)) {
    redirect('/login?redirect=/auth/logout');
  }
  return role;
}

export async function getCurrentUserID() {
  const cookieStore = await cookies();
  const id = cookieStore.get(USER_ID_COOKIE_NAME)?.value;
  if (!id) {
    redirect('/login?redirect=/auth/logout');
  }

  return parseInt(id, 10);
}

/**
 * Get a real user ID from the database based on the selected role.
 * Returns the first user with the specified role, sorted by user ID for determinism.
 */
export async function getUserIdByRole(role: UserRole): Promise<string | null> {
  const db = await getDb();

  if (role === 'parent') {
    try {
      const [parent] = await db.select({ userId: parents.userId }).from(parents).orderBy(asc(parents.userId)).limit(1);

      return parent?.userId?.toString() ?? null;
    } catch {
      return null;
    }
  }

  if (role === 'tutor') {
    try {
      const [tutor] = await db.select({ userId: tutors.userId }).from(tutors).orderBy(asc(tutors.userId)).limit(1);

      return tutor?.userId?.toString() ?? null;
    } catch {
      return null;
    }
  }

  if (role === 'admin') {
    try {
      const [adminRole] = await db.select({ id: roles.id }).from(roles).where(ilike(roles.name, 'admin')).limit(1);
      if (!adminRole) {
        return null;
      }

      const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, adminRole.id))
        .orderBy(asc(users.id))
        .limit(1);

      return admin?.id?.toString() ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get the current user's name from the database.
 */
export async function getCurrentUserName(): Promise<string | null> {
  const userId = await getCurrentUserID();
  const db = await getDb();

  try {
    const [user] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null;
  } catch {
    return null;
  }
}

export async function login(formData: FormData) {
  'use server';

  const role = formData.get('role');
  if (!isUserRole(role)) {
    throw new Error('Invalid role');
  }

  // Get a real user ID from the database based on role.
  const userId = await getUserIdByRole(role);

  // Fallback to temp user if no user found for role
  let finalUserId = userId;
  if (!finalUserId) {
    finalUserId = '2'; // Fallback temp user
  }

  const cookieStore = await cookies();
  cookieStore.set(USER_ROLE_COOKIE_NAME, role, {
    httpOnly: true,
    maxAge: USER_ROLE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  cookieStore.set(USER_ID_COOKIE_NAME, finalUserId, {
    httpOnly: true,
    maxAge: USER_ID_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/dashboard');
}

export function middleware(request: NextRequest) {
  const userRole = request.cookies.get(USER_ROLE_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  if (ADMIN_ONLY_ROUTES.includes(pathname) && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}
