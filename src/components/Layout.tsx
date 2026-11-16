import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  Building2,
  Wrench,
  Users,
  Layers,
  CalendarCheck,
  CalendarDays,
  FileText,
  Award,
  BarChart,
  Settings,
  LogOut,
  X,
  UserCheck,
  Shield,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  Sun,
  Moon,
} from 'lucide-react';

import { usePermissions } from '../contexts/PermissionsContext';
import { SHOW_CALENDAR_MODULES } from '../config/features';
import { MobileBottomNav } from './navigation/MobileBottomNav';
import { MobileMoreMenu } from './navigation/MobileMoreMenu';
import { NotificationBell } from './notifications/NotificationBell';
import { NotificationDropdown } from './notifications/NotificationDropdown';
import {
  NotificationBanner,
  UrgentNotificationModal,
} from './notifications/NotificationBanner';
import { extractAttendanceNavigationTarget } from './notifications/notificationHelpers';
import { AuditDetailSheet } from './audit/AuditDetailSheet';
import { useNotifications } from '../hooks/useNotifications';
import type { ActivityLog } from '../types';
import { TruncatedText } from './ui/TruncatedText';

const Layout: React.FC = () => {
  const { userProfile, signOut, permissionError } = useAuth();
  const { canViewPage, isCourseDirector } = usePermissions();
  const { resolvedMode, setMode } = useTheme();
  const { refreshNotifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [dismissPermNotice, setDismissPermNotice] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [selectedNotifLog, setSelectedNotifLog] = useState<ActivityLog | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);

  const isTrainer = userProfile?.role === 'Trainer';
  const isAttendanceRoute =
    location.pathname === '/attendance' || location.pathname === '/attendance-sheet';

  const handleSelectNotification = useCallback(
    (log: ActivityLog) => {
      const attTarget = extractAttendanceNavigationTarget(log);
      if (attTarget) {
        navigate(
          `/attendance?batchId=${encodeURIComponent(attTarget.batchId)}&date=${encodeURIComponent(
            attTarget.date
          )}`
        );
        return;
      }
      setSelectedNotifLog(log);
    },
    [navigate]
  );

  const baseMenuItems = useMemo(() => {
    const items = [];

    if (isTrainer) {
      items.push({
        path: '/trainer-dashboard',
        name: 'প্রশিক্ষক ড্যাশবোর্ড',
        sub: 'Trainer Dashboard',
        icon: <LayoutDashboard size={19} />,
      });
    } else {
      items.push({
        path: '/',
        name: 'সার্বিক ড্যাশবোর্ড',
        sub: 'Overview Dashboard',
        icon: <LayoutDashboard size={19} />,
      });
      items.push({
        path: '/trainer-dashboard',
        name: 'প্রশিক্ষক ড্যাশবোর্ড',
        sub: 'Trainer Dashboard',
        icon: <UserCheck size={19} />,
      });
    }

    items.push(
      { path: '/institutes', name: 'প্রতিষ্ঠান', sub: 'Institutes', icon: <Building2 size={19} /> },
      { path: '/trades', name: 'ট্রেড', sub: 'Trades', icon: <Wrench size={19} /> }
    );

    if (SHOW_CALENDAR_MODULES) {
      items.push({
        path: '/trade-calendar',
        name: 'ট্রেড কারিকুলাম',
        sub: 'Trade Curriculum',
        icon: <GraduationCap size={19} />,
      });
    }

    items.push(
      { path: '/batches', name: 'ব্যাচ', sub: 'Batches', icon: <Layers size={19} /> },
      { path: '/trainees', name: 'প্রশিক্ষণার্থী', sub: 'Trainees', icon: <Users size={19} /> }
    );

    if (SHOW_CALENDAR_MODULES) {
      items.push({
        path: '/shikhon-calendar',
        name: 'ব্যাচ শিখন ক্যালেন্ডার',
        sub: 'Batch Calendar',
        icon: <BookOpen size={19} />,
      });
    }

    items.push(
      { path: '/attendance', name: 'দৈনিক হাজিরা', sub: 'Daily Attendance', icon: <CalendarCheck size={19} /> },
      { path: '/attendance-sheet', name: 'হাজিরা শিট', sub: 'Attendance Sheet', icon: <CalendarDays size={19} /> },
      { path: '/exams', name: 'পরীক্ষা', sub: 'Exams', icon: <FileText size={19} /> },
      { path: '/results', name: 'ফলাফল', sub: 'Results', icon: <BarChart size={19} /> },
      { path: '/reports', name: 'প্রতিবেদন', sub: 'Reports', icon: <FileText size={19} /> },
      { path: '/reports/weekly-signature', name: 'সাপ্তাহিক স্বাক্ষর সিট', sub: 'Weekly Signature', icon: <CalendarDays size={19} /> },
      { path: '/certificates', name: 'সার্টিফিকেট', sub: 'Certificates', icon: <Award size={19} /> },
      { path: '/users', name: 'ব্যবহারকারী', sub: 'Users', icon: <UserCheck size={19} /> }
    );

    if (isCourseDirector) {
      items.push({
        path: '/brn-verification',
        name: 'BRN verification',
        sub: 'জন্ম নিবন্ধন যাচাই',
        icon: <ShieldCheck size={19} />,
      });
      items.push({
        path: '/roles',
        name: 'রোল ও পারমিশন',
        sub: 'Roles & Perms',
        icon: <Shield size={19} />,
      });
    }

    items.push({
      path: '/settings',
      name: 'সেটিংস',
      sub: 'Settings',
      icon: <Settings size={19} />,
    });

    return items;
  }, [isTrainer, isCourseDirector]);

  const menuItems = baseMenuItems.filter((item) => {
    if (item.path === '/reports/weekly-signature') {
      return canViewPage('/reports') || canViewPage('/attendance-sheet');
    }
    return canViewPage(item.path);
  });

  const toggleQuickMode = () => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary font-sans flex flex-col lg:flex-row antialiased">
      {/* Desktop and Large Tablet Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:shrink-0 w-72 bg-theme-nav border-r border-theme-border text-theme-text-primary justify-between z-30 print:hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header & Logo */}
          <div className="h-18 px-5 flex items-center justify-between border-b border-theme-border shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-theme-primary text-theme-primary-fg flex items-center justify-center shadow-xs">
                <GraduationCap size={22} />
              </div>
              <div>
                <span className="font-medium text-base text-theme-text-primary block leading-snug">
                  BNFE ট্রেইনিং
                </span>
                <span className="text-[11px] text-theme-primary font-medium block leading-snug">
                  উপানুষ্ঠানিক শিক্ষা ব্যুরো
                </span>
              </div>
            </div>
          </div>

          {/* User quick card in sidebar */}
          <div className="p-3.5 mx-4 my-3 rounded-xl bg-theme-surface-subtle border border-theme-border shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-theme-primary-soft text-theme-primary-soft-fg flex items-center justify-center font-medium text-sm border border-theme-primary-border shrink-0">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 overflow-hidden flex-1">
                <TruncatedText
                  as="p"
                  text={userProfile?.name}
                  mode="pop"
                  className="font-medium text-sm text-theme-text-primary leading-snug"
                />
                <div className="flex items-center space-x-1.5 mt-0.5 min-w-0">
                  <Shield size={12} className="text-theme-primary shrink-0" />
                  <TruncatedText
                    text={userProfile?.role}
                    mode="pop"
                    className="text-xs text-theme-text-secondary min-w-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 min-h-0 px-3 py-1 space-y-1 overflow-y-auto overscroll-contain">
            {menuItems.map((item) => {
              const isActive =
                item.path === '/reports'
                  ? location.pathname === '/reports'
                  : location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-theme-primary text-theme-primary-fg shadow-xs'
                      : 'text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text-primary'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      className={
                        isActive ? 'text-theme-primary-fg' : 'text-theme-text-muted'
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="leading-snug break-words">{item.name}</span>
                  </div>
                  <span
                    className={`text-[10px] shrink-0 ml-2 ${
                      isActive ? 'text-theme-primary-fg/80' : 'text-theme-text-muted'
                    }`}
                  >
                    {item.sub}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout bottom button */}
        <div className="p-4 border-t border-theme-border shrink-0">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-medium text-theme-danger bg-theme-danger-soft hover:opacity-90 transition-colors border border-theme-danger-border cursor-pointer"
          >
            <LogOut size={17} />
            <span>লগআউট (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar (hidden on mobile /attendance where page provides its own compact sticky header) */}
        <header
          className={`h-16 bg-theme-nav border-b border-theme-border px-4 sm:px-6 lg:px-8 items-center justify-between sticky top-0 z-30 print:hidden ${
            isAttendanceRoute ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center space-x-3 min-w-0">
            {/* Mobile Native App Branding */}
            <div className="flex items-center space-x-2.5 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-theme-primary text-theme-primary-fg flex items-center justify-center font-medium shadow-2xs shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="leading-snug">
                <span className="font-medium text-theme-text-primary text-sm block">
                  BNFE ট্রেইনিং
                </span>
                <span className="text-[10px] text-theme-primary font-medium block">
                  উপানুষ্ঠানিক শিক্ষা ব্যুরো
                </span>
              </div>
            </div>

            {/* Desktop Program Title */}
            <TruncatedText
              as="div"
              text="ঝরে পড়া শিক্ষার্থীদের দক্ষতা উন্নয়ন প্রশিক্ষণ কর্মসূচি (Class 8 Dropout Program)"
              mode="pop"
              className="hidden lg:block min-w-0 text-theme-text-primary font-medium text-sm"
            />
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-medium text-theme-text-primary">
                {userProfile?.name}
              </span>
              <span className="block text-[11px] text-theme-text-secondary tabular-nums">
                {userProfile?.phone}
              </span>
            </div>

            <NotificationBell
              isOpen={notifDropdownOpen}
              onToggle={() => setNotifDropdownOpen((prev) => !prev)}
              buttonRef={bellButtonRef}
            />

            <button
              type="button"
              onClick={toggleQuickMode}
              title={resolvedMode === 'dark' ? 'লাইট মোডে যান (Light Mode)' : 'ডার্ক মোডে যান (Dark Mode)'}
              aria-label={resolvedMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-theme-text-secondary hover:text-theme-primary hover:bg-theme-surface-hover rounded-xl border border-transparent hover:border-theme-border transition active:scale-95 cursor-pointer"
            >
              {resolvedMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Once-per-open Notification Banner */}
        <div className="print:hidden">
          <NotificationBanner onOpenNotifications={() => setNotifDropdownOpen(true)} />
        </div>

        {/* Page Container */}
        <main
          className={`flex-1 overflow-y-auto lg:pb-8 print:overflow-visible print:p-0! ${
            isAttendanceRoute ? 'p-0 lg:p-6' : 'p-3.5 sm:p-6 lg:p-8'
          }`}
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {permissionError && !dismissPermNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-theme-warning-soft border border-theme-warning-border text-theme-text-primary text-xs flex items-start justify-between gap-3 shadow-xs print:hidden">
              <div className="space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-theme-warning text-sm">
                  <span>ফায়ারবেস ডেটাবেস পারমিশন সংক্রান্ত নির্দেশনা (Firestore Rules Note):</span>
                </div>
                <p className="text-theme-text-secondary">
                  আপনার ফায়ারবেস কনসোলে Firestore Database তৈরি বা Rules আপডেট না থাকলে তথ্য লোড/সংরক্ষণ ব্যাহত হতে পারে। ফায়ারবেস কনসোলের <b>Firestore Database &gt; Rules</b> ট্যাবে{' '}
                  <code className="bg-theme-surface px-1.5 py-0.5 rounded border border-theme-border font-mono text-theme-text-primary">
                    allow read, write: if request.auth != null;
                  </code>{' '}
                  নিয়ম নিশ্চিত করুন।
                </p>
              </div>
              <button
                onClick={() => setDismissPermNotice(true)}
                className="text-theme-warning hover:opacity-80 font-bold p-1 shrink-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Mobile Native Bottom Navigation */}
      <MobileBottomNav
        onOpenMore={() => setMobileMoreOpen(true)}
        isMoreOpen={mobileMoreOpen}
      />

      {/* Mobile More Modules Sheet / Menu */}
      <MobileMoreMenu
        isOpen={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
      />

      {/* Notification Dropdown & Urgent Security Modal */}
      <NotificationDropdown
        isOpen={notifDropdownOpen}
        onClose={() => setNotifDropdownOpen(false)}
        onSelectNotification={handleSelectNotification}
        triggerRef={bellButtonRef}
      />

      <UrgentNotificationModal onViewDetails={handleSelectNotification} />

      {/* Read-only (or Admin) Detail Sheet triggered from Notification Dropdown/Modal */}
      <AuditDetailSheet
        log={selectedNotifLog}
        isAdmin={isCourseDirector}
        actor={
          userProfile
            ? {
                userId: userProfile.id || '',
                user: userProfile.name || 'User',
                userRole: userProfile.role || '',
              }
            : undefined
        }
        onClose={() => setSelectedNotifLog(null)}
        onActionSuccess={async () => {
          setSelectedNotifLog(null);
          await refreshNotifications();
        }}
        onNavigateToData={() => navigate('/settings#data')}
      />
    </div>
  );
};

export default Layout;
