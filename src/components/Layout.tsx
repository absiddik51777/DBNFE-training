import React, { useState, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
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

const Layout: React.FC = () => {
  const { userProfile, signOut, permissionError } = useAuth();
  const { canViewPage, isCourseDirector } = usePermissions();
  const { resolvedMode, setMode } = useTheme();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [dismissPermNotice, setDismissPermNotice] = useState(false);

  const isTrainer = userProfile?.role === 'Trainer';

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

  const menuItems = baseMenuItems.filter((item) => canViewPage(item.path));

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'Course Director':
        return (
          <span className="bg-theme-accent-soft text-theme-accent border border-theme-accent-border text-xs px-2.5 py-0.5 rounded-full font-semibold">
            কোর্স পরিচালক
          </span>
        );
      case 'FMA':
        return (
          <span className="bg-theme-info-soft text-theme-info border border-theme-info-border text-xs px-2.5 py-0.5 rounded-full font-semibold">
            FMA
          </span>
        );
      case 'Trainer':
        return (
          <span className="bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border text-xs px-2.5 py-0.5 rounded-full font-semibold">
            প্রশিক্ষক
          </span>
        );
      default:
        return role ? (
          <span className="bg-theme-surface-subtle text-theme-text-secondary border border-theme-border text-xs px-2.5 py-0.5 rounded-full font-semibold">
            {role}
          </span>
        ) : null;
    }
  };

  const toggleQuickMode = () => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary flex flex-col lg:flex-row antialiased">
      {/* Desktop and Large Tablet Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:shrink-0 w-72 bg-theme-nav border-r border-theme-border text-theme-text-primary justify-between z-30">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header & Logo */}
          <div className="h-18 px-5 flex items-center justify-between border-b border-theme-border shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-theme-primary text-theme-primary-fg flex items-center justify-center shadow-xs">
                <GraduationCap size={22} />
              </div>
              <div>
                <span className="font-bold text-base text-theme-text-primary tracking-tight block">
                  BNFE ট্রেইনিং
                </span>
                <span className="text-[11px] text-theme-primary font-semibold block">
                  উপানুষ্ঠানিক শিক্ষা ব্যুরো
                </span>
              </div>
            </div>
          </div>

          {/* User quick card in sidebar */}
          <div className="p-3.5 mx-4 my-3 rounded-xl bg-theme-surface-subtle border border-theme-border shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-theme-primary-soft text-theme-primary-soft-fg flex items-center justify-center font-bold text-sm border border-theme-primary-border shrink-0">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm text-theme-text-primary truncate">
                  {userProfile?.name}
                </p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <Shield size={12} className="text-theme-primary shrink-0" />
                  <span className="text-xs text-theme-text-secondary truncate">
                    {userProfile?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 min-h-0 px-3 py-1 space-y-1 overflow-y-auto overscroll-contain">
            {menuItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-theme-primary text-theme-primary-fg shadow-xs font-semibold'
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
                    <span className="truncate">{item.name}</span>
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
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-theme-danger bg-theme-danger-soft hover:opacity-90 transition-colors border border-theme-danger-border cursor-pointer"
          >
            <LogOut size={17} />
            <span>লগআউট (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-theme-nav border-b border-theme-border px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Mobile Native App Branding */}
            <div className="flex items-center space-x-2.5 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-theme-primary text-theme-primary-fg flex items-center justify-center font-bold shadow-2xs shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="leading-tight">
                <span className="font-bold text-theme-text-primary text-sm block tracking-tight">
                  BNFE ট্রেইনিং
                </span>
                <span className="text-[10px] text-theme-primary font-semibold block">
                  উপানুষ্ঠানিক শিক্ষা ব্যুরো
                </span>
              </div>
            </div>

            {/* Desktop Program Title */}
            <div className="hidden lg:block text-theme-text-primary font-semibold text-sm truncate">
              ঝরে পড়া শিক্ষার্থীদের দক্ষতা উন্নয়ন প্রশিক্ষণ কর্মসূচি (Class 8 Dropout Program)
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {getRoleBadge(userProfile?.role)}
            <div className="h-4 w-px bg-theme-border mx-1 hidden sm:block" />
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-semibold text-theme-text-primary">
                {userProfile?.name}
              </span>
              <span className="block text-[11px] text-theme-text-secondary tabular-nums">
                {userProfile?.phone}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleQuickMode}
              title={resolvedMode === 'dark' ? 'লাইট মোডে যান (Light Mode)' : 'ডার্ক মোডে যান (Dark Mode)'}
              aria-label={resolvedMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 text-theme-text-secondary hover:text-theme-primary hover:bg-theme-surface-hover rounded-xl border border-transparent hover:border-theme-border transition active:scale-95 cursor-pointer"
            >
              {resolvedMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              title="লগআউট"
              aria-label="লগআউট"
              className="p-2 text-theme-text-secondary hover:text-theme-danger hover:bg-theme-danger-soft rounded-xl transition active:scale-95 cursor-pointer"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main
          className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto lg:pb-8"
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {permissionError && !dismissPermNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-theme-warning-soft border border-theme-warning-border text-theme-text-primary text-xs flex items-start justify-between gap-3 shadow-xs">
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
    </div>
  );
};

export default Layout;
