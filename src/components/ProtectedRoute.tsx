// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';


interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}