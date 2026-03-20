import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { asc, eq, ilike } from 'drizzle-orm';
import { parents, roles, tutors, users } from '@/lib/db/schema';

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

export async function getUserIdByRole(role: UserRole): Promise<string | null> {
  try {
    const { db } = await import('@/lib/db/client');

    if (role === 'parent') {
      const [parent] = await db.select({ userId: parents.userId }).from(parents).orderBy(asc(parents.userId)).limit(1);
      return parent?.userId?.toString() ?? null;
    }

    if (role === 'tutor') {
      const [tutor] = await db.select({ userId: tutors.userId }).from(tutors).orderBy(asc(tutors.userId)).limit(1);
      return tutor?.userId?.toString() ?? null;
    }

    if (role === 'admin') {
      const [adminUser] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.role, roles.id))
        .where(ilike(roles.name, 'admin'))
        .orderBy(asc(users.id))
        .limit(1);

      return adminUser?.id?.toString() ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function getCurrentUserName(): Promise<string | null> {
  const userId = await getCurrentUserID();
  try {
    const { db } = await import('@/lib/db/client');
    const [user] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user) {
      return `${user.firstName} ${user.lastName}`;
    }
  } catch {
    return null;
  }

  return null;
}

export async function login(formData: FormData) {
  'use server';

  const role = formData.get('role');
  if (!isUserRole(role)) {
    throw new Error('Invalid role');
  }

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
