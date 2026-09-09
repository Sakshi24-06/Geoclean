import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';

export default function ProtectedRoute({ allowed, children }: { allowed: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // A session may exist while its profile/NGO record is still being loaded.
  // Do not redirect during that short window or a successful login bounces to /login.
  if (loading) return <div className="grid min-h-screen place-items-center bg-mint text-sm font-bold text-forest">Loading your account…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!allowed.includes(user.role)) {
    const home = user.role === 'admin' ? '/admin' : user.role === 'ngo' ? '/ngo' : '/user';
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}
