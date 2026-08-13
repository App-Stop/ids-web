// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth, type Role } from '../context/AuthContext';

export const ADMIN_LOGIN_PATH = '/';
/** Kept for the shelved crew screens, which are not routed at the moment. */
export const CREW_LOGIN_PATH = '/login';

/**
 * Where a signed-in user belongs once authenticated. With the crew side
 * shelved, only admins have somewhere to go; anyone else lands back on the
 * sign-in page.
 */
export function homePathForRole(role: Role | null | undefined) {
  return role === 'admin' ? '/schedule-board' : ADMIN_LOGIN_PATH;
}

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles allowed through. Defaults to admin-only (the desktop console). */
  roles?: Role[];
  /** Login page to bounce to when not signed in. */
  loginPath?: string;
}

export default function ProtectedRoute({
  children,
  roles = ['admin'],
  loginPath = ADMIN_LOGIN_PATH,
}: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return <Navigate to={loginPath} replace />;
  // Signed in but on the wrong side of the app — send them to their own home.
  if (!role || !roles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <>{children}</>;
}
