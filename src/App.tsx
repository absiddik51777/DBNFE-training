import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext';
import Layout from './components/Layout';
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
import Certificates from './pages/Certificates';
import UsersPage from './pages/Users';
import RolesPage from './pages/Roles';
import Settings from './pages/Settings';
import BrnVerification from './pages/BrnVerification';

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

  if (userProfile.status === 'Inactive') {
    return <Navigate to="/login" replace />;
  }

  // Render dedicated pending approval experience for unapproved users
  if (userProfile.status === 'Pending Approval') {
    return <PendingApproval />;
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

  // If user is a Trainer, render the dedicated Trainer Dashboard
  if (userProfile?.role === 'Trainer') {
    return <TrainerDashboard />;
  }

  // If user has permission to view root Dashboard, render it
  if (canViewPage('/')) {
    return <Dashboard />;
  }

  // Otherwise, automatically redirect to the role's configured or first accessible landing page (e.g. /attendance)
  const fallback = getDefaultLandingRoute('/');
  if (fallback && fallback !== '/') {
    return <Navigate to={fallback} replace />;
  }

  // Graceful universal fallback
  return <Navigate to="/attendance" replace />;
};

const PageGuard = ({ path, children }: { path: string; children: React.ReactNode }) => {
  const { canViewPage, getDefaultLandingRoute, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span className="text-sm">যাচাই করা হচ্ছে...</span>
      </div>
    );
  }

  if (!canViewPage(path)) {
    const fallback = getDefaultLandingRoute(path);
    if (fallback && fallback !== path) {
      return <Navigate to={fallback} replace />;
    }
    return <Navigate to="/attendance" replace />;
  }

  return <>{children}</>;
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
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<RootRouteHandler />} />
        <Route path="trainer-dashboard" element={<PageGuard path="/trainer-dashboard"><TrainerDashboard /></PageGuard>} />
        <Route path="institutes" element={<PageGuard path="/institutes"><Institutes /></PageGuard>} />
        <Route path="trades" element={<PageGuard path="/trades"><Trades /></PageGuard>} />
        <Route path="batches" element={<PageGuard path="/batches"><Batches /></PageGuard>} />
        <Route path="trainees/*" element={<PageGuard path="/trainees"><Trainees /></PageGuard>} />
        <Route path="brn-verification" element={<PageGuard path="/brn-verification"><BrnVerification /></PageGuard>} />
        <Route path="shikhon-calendar" element={<PageGuard path="/shikhon-calendar"><ShikhonCalendar /></PageGuard>} />
        <Route path="trade-calendar" element={<PageGuard path="/trade-calendar"><TradeCalendar /></PageGuard>} />
        <Route path="attendance" element={<PageGuard path="/attendance"><Attendance /></PageGuard>} />
        <Route path="attendance-sheet" element={<PageGuard path="/attendance-sheet"><AttendanceSheet /></PageGuard>} />
        <Route path="exams" element={<PageGuard path="/exams"><Exams /></PageGuard>} />
        <Route path="results" element={<PageGuard path="/results"><Results /></PageGuard>} />
        <Route path="reports" element={<PageGuard path="/reports"><Reports /></PageGuard>} />
        <Route path="certificates" element={<PageGuard path="/certificates"><Certificates /></PageGuard>} />
        <Route path="users" element={<PageGuard path="/users"><UsersPage /></PageGuard>} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="settings" element={<PageGuard path="/settings"><Settings /></PageGuard>} />
        <Route path="*" element={<CatchAllRedirect />} />
      </Route>
    </Routes>
  );
};

import { ConfirmationProvider } from './contexts/ConfirmationContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <SystemSettingsProvider>
            <ConfirmationProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ConfirmationProvider>
          </SystemSettingsProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
