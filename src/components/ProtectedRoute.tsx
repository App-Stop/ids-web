// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth, type Role } from '../context/AuthContext';

export const ADMIN_LOGIN_PATH = '/admin/login';
export const CREW_LOGIN_PATH = '/login';

/**
 * Where a signed-in user belongs once authenticated. Anything that isn't an
 * admin lands on the crew side — an unrecognised role must never dead-end back
 * on the login page, which just looks like a login that did nothing.
 */
export function homePathForRole(role: Role | null | undefined) {
  if (!role) return CREW_LOGIN_PATH;
  return role === 'admin' ? '/dashboard' : '/crew';
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
