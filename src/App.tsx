import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import Layout from './components/Layout';
import { TruncatedTextProvider } from './components/ui/TruncatedText';
import { RequireRole } from './components/auth/RequireRole';
import { SessionToast } from './components/SessionToast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TrainerDashboard from './pages/TrainerDashboard';
import Institutes from './pages/Institutes';
import Trades from './pages/Trades';
import Batches from './pages/Batches';
import Trainees from './pages/Trainees';
import ShikhonCalendar from './pages/ShikhonCalendar';
import TradeCalendar from './pages/TradeCalendar';
import Attendance from './pages/Attendance';
import AttendanceSheet from './pages/AttendanceSheet';
import Exams from './pages/Exams';
import Results from './pages/Results';
import Reports from './pages/Reports';
import WeeklySignatureSheet from './pages/WeeklySignatureSheet';
import Certificates from './pages/Certificates';
import UsersPage from './pages/Users';
import RolesPage from './pages/Roles';
import Settings from './pages/Settings';
import ThemeSettings from './pages/ThemeSettings';
import BrnVerification from './pages/BrnVerification';
import NotificationsPage from './pages/NotificationsPage';
import { NotificationsProvider } from './hooks/useNotifications';
import { PendingApproval } from './pages/PendingApproval';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex flex-col items-center justify-center text-theme-text-secondary">
        <div className="w-10 h-10 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">তথ্য যাচাই করা হচ্ছে (Authenticating)...</p>
      </div>
    );
  }

  // Strictly require authenticated Firebase user and profile
  if (!user || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  // Render dedicated pending approval experience for unapproved or Pending-role users
  if (userProfile.status === 'Pending Approval' || userProfile.role === 'Pending') {
    return <PendingApproval />;
  }

  if (userProfile.status !== 'Active') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RootRouteHandler = () => {
  const { userProfile } = useAuth();
  const { canViewPage, getDefaultLandingRoute, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span className="text-sm">লোড হচ্ছে...</span>
      </div>
    );
  }

  // Trainers always land on the dedicated Trainer Dashboard
  if (userProfile?.role === 'Trainer') {
    return <Navigate to="/trainer-dashboard" replace />;
  }

  if (canViewPage('/')) {
    return <Dashboard />;
  }

  const fallback = getDefaultLandingRoute('/');
  if (fallback && fallback !== '/') {
    return <Navigate to={fallback} replace />;
  }

  return <Navigate to="/notifications" replace />;
};

const CatchAllRedirect = () => {
  const { getDefaultLandingRoute } = usePermissions();
  const fallback = getDefaultLandingRoute('/');
  return <Navigate to={fallback} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RootRouteHandler />} />
        <Route
          path="trainer-dashboard"
          element={
            <RequireRole path="/trainer-dashboard" permission="view_dashboard">
              <TrainerDashboard />
            </RequireRole>
          }
        />
        <Route
          path="institutes"
          element={
            <RequireRole path="/institutes" permission="view_institutes">
              <Institutes />
            </RequireRole>
          }
        />
        <Route
          path="trades"
          element={
            <RequireRole path="/trades" permission="view_trades">
              <Trades />
            </RequireRole>
          }
        />
        <Route
          path="batches"
          element={
            <RequireRole path="/batches" permission="view_batches">
              <Batches />
            </RequireRole>
          }
        />
        <Route
          path="trainees/*"
          element={
            <RequireRole path="/trainees" permission="view_trainees">
              <Trainees />
            </RequireRole>
          }
        />
        <Route
          path="brn-verification"
          element={
            <RequireRole
              roles={['Course Director']}
              path="/brn-verification"
              permission="view_brn_verification"
            >
              <BrnVerification />
            </RequireRole>
          }
        />
        <Route
          path="shikhon-calendar"
          element={
            <RequireRole path="/shikhon-calendar" permission="view_shikhon_calendar">
              <ShikhonCalendar />
            </RequireRole>
          }
        />
        <Route
          path="trade-calendar"
          element={
            <RequireRole path="/trade-calendar" permission="view_trades">
              <TradeCalendar />
            </RequireRole>
          }
        />
        <Route
          path="attendance"
          element={
            <RequireRole path="/attendance" permission="view_attendance">
              <Attendance />
            </RequireRole>
          }
        />
        <Route
          path="attendance-sheet"
          element={
            <RequireRole path="/attendance-sheet" permission="view_attendance_sheet">
              <AttendanceSheet />
            </RequireRole>
          }
        />
        <Route
          path="exams"
          element={
            <RequireRole path="/exams" permission="view_exams">
              <Exams />
            </RequireRole>
          }
        />
        <Route
          path="results"
          element={
            <RequireRole path="/results" permission="view_results">
              <Results />
            </RequireRole>
          }
        />
        <Route
          path="reports"
          element={
            <RequireRole path="/reports" permission="view_reports">
              <Reports />
            </RequireRole>
          }
        />
        <Route
          path="reports/weekly-signature"
          element={
            <RequireRole permission={['view_reports', 'view_attendance_sheet']}>
              <WeeklySignatureSheet />
            </RequireRole>
          }
        />
        <Route
          path="certificates"
          element={
            <RequireRole path="/certificates" permission="view_certificates">
              <Certificates />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole path="/users" permission="view_users">
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="roles"
          element={
            <RequireRole
              roles={['Course Director']}
              path="/roles"
              permission="view_roles"
            >
              <RolesPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole path="/settings" permission="view_settings">
              <Settings />
            </RequireRole>
          }
        />
        <Route
          path="settings/access"
          element={
            <RequireRole path="/settings" permission="view_settings">
              <Settings />
            </RequireRole>
          }
        />
        <Route
          path="settings/logs"
          element={
            <RequireRole
              roles={['Course Director']}
              path="/settings"
              permission="view_settings"
              redirectTo="/settings"
            >
              <Settings />
            </RequireRole>
          }
        />
        <Route
          path="settings/theme"
          element={
            <RequireRole path="/settings" permission="view_settings">
              <ThemeSettings />
            </RequireRole>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="theme-settings" element={<Navigate to="/settings/theme" replace />} />
        <Route path="*" element={<CatchAllRedirect />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <PermissionsProvider>
            <SystemSettingsProvider>
              <ConfirmationProvider>
                <TruncatedTextProvider>
                  <BrowserRouter>
                    <SessionToast />
                    <AppRoutes />
                  </BrowserRouter>
                </TruncatedTextProvider>
              </ConfirmationProvider>
            </SystemSettingsProvider>
          </PermissionsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
