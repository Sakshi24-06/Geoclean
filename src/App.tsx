import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/utils/supabase';
import type { Role } from '@/lib/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import AuthPage from '@/pages/AuthPage';
import CitizenDashboard from '@/pages/CitizenDashboard';
import ImpactPage from '@/pages/ImpactPage';
import HowItWorksPage from '@/pages/HowItWorksPage';
import AboutPage from '@/pages/AboutPage';
import NgoDashboard from '@/pages/NgoDashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import NgoDirectoryPage from '@/pages/NgoDirectoryPage';
import NotificationsPage from '@/pages/NotificationsPage';
import MyReportsPage from '@/pages/MyReportsPage';
import NgoProfilePage from '@/pages/NgoProfilePage';
import CitizenProfilePage from '@/pages/CitizenProfilePage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-mint text-sm font-bold text-forest">Loading your account…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const home = user.role === 'admin' ? '/admin' : user.role === 'ngo' ? '/ngo' : '/user';
  return <Navigate to={home} replace />;
}

function LoginRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-mint text-sm font-bold text-forest">Loading your account…</div>;
  if (!user) return <AuthPage />;
  const home = user.role === 'admin' ? '/admin' : user.role === 'ngo' ? '/ngo' : '/user';
  return <Navigate to={home} replace />;
}

function Protected({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <ProtectedRoute allowed={[role]}>
      {children}
    </ProtectedRoute>
  );
}

export default function App() {
  useEffect(() => {
    // Keep the current UI intact while confirming the frontend can read Supabase data.
    void supabase.from('todos').select('id, name').limit(1);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/user" element={<Protected role="user"><CitizenDashboard /></Protected>} />
            <Route path="/impact" element={<ProtectedRoute allowed={['user', 'ngo', 'admin']}><ImpactPage /></ProtectedRoute>} />
            <Route path="/how-it-works" element={<ProtectedRoute allowed={['user', 'ngo', 'admin']}><HowItWorksPage /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute allowed={['user', 'ngo', 'admin']}><AboutPage /></ProtectedRoute>} />
            <Route path="/ngos" element={<ProtectedRoute allowed={['user', 'ngo', 'admin']}><NgoDirectoryPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute allowed={['user', 'ngo', 'admin']}><NotificationsPage /></ProtectedRoute>} />
            <Route path="/user/notifications" element={<Protected role="user"><NotificationsPage /></Protected>} />
            <Route path="/notification-center" element={<ProtectedRoute allowed={['user', 'ngo', 'admin']}><NotificationsPage /></ProtectedRoute>} />
            <Route path="/my-reports" element={<Protected role="user"><MyReportsPage /></Protected>} />
            <Route path="/profile" element={<Protected role="user"><CitizenProfilePage /></Protected>} />
            <Route path="/user/profile" element={<Protected role="user"><CitizenProfilePage /></Protected>} />
            <Route path="/ngo" element={<Protected role="ngo"><NgoDashboard /></Protected>} />
            <Route path="/ngo/reports" element={<Protected role="ngo"><NgoDashboard /></Protected>} />
            <Route path="/ngo/tracking" element={<Navigate to="/ngo" replace />} />
            <Route path="/ngo/request-tracking" element={<Navigate to="/ngo" replace />} />
            <Route path="/ngo/profile" element={<Protected role="ngo"><NgoProfilePage /></Protected>} />
            <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
            <Route path="/admin/reports" element={<Protected role="admin"><AdminDashboard /></Protected>} />
            <Route path="/admin/users" element={<Protected role="admin"><AdminDashboard /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

