import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserIdForRole, getUserNameById } from '@/lib/db/queries/actors';

export type UserRole = 'admin' | 'parent' | 'tutor';

export const USER_ROLE_COOKIE_NAME = 'user-role';
export const USER_ID_COOKIE_NAME = 'user-id';
const USER_ROLE_COOKIE_MAX_AGE = 60 * 60 * 1; // 1 hour
const USER_ID_COOKIE_MAX_AGE = 60 * 60 * 1; // 1 hour

export const ADMIN_ONLY_ROUTES = ['/dashboard/tutors', '/dashboard/parents'];

export function isValidRole(value: unknown) {
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

export async function getUserIdByRole(role: UserRole) {
  try {
    const userId = await getUserIdForRole(role);
    return userId?.toString() ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserName() {
  const userId = await getCurrentUserID();
  try {
    return await getUserNameById(userId);
  } catch {
    return null;
  }
}

export async function login(formData: FormData) {
  'use server';

  const role = formData.get('role');
  if (!isValidRole(role)) {
    throw new Error('Invalid role');
  }

  const userId = await getUserIdByRole(role);
  if (!userId) {
    return redirect(`/login?error=missing-local-user&role=${role}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(USER_ROLE_COOKIE_NAME, role, {
    httpOnly: true,
    maxAge: USER_ROLE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  cookieStore.set(USER_ID_COOKIE_NAME, userId, {
    httpOnly: true,
    maxAge: USER_ID_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return redirect('/dashboard');
}

export function middleware(request: NextRequest) {
  const userRole = request.cookies.get(USER_ROLE_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  if (ADMIN_ONLY_ROUTES.includes(pathname) && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}
