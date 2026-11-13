import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { SHOW_CALENDAR_MODULES } from '../../config/features';
import {
  X,
  FileText,
  BarChart,
  Award,
  UserCheck,
  ShieldCheck,
  Shield,
  Settings,
  LogOut,
  Building2,
  Wrench,
  GraduationCap,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  ChevronRight,
} from 'lucide-react';

interface MobileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  path: string;
  name: string;
  sub: string;
  icon: React.ReactNode;
  badge?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const MobileMoreMenu: React.FC<MobileMoreMenuProps> = ({ isOpen, onClose }) => {
  const { userProfile, signOut } = useAuth();
  const { canViewPage, isCourseDirector } = usePermissions();
  const location = useLocation();

  const isTrainer = userProfile?.role === 'Trainer';

  // Lock body scroll when more menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sections: MenuSection[] = useMemo(() => {
    const result: MenuSection[] = [];

    const academicItems: MenuItem[] = [
      {
        path: '/exams',
        name: 'পরীক্ষা',
        sub: 'Exams & Assessment',
        icon: <FileText size={19} className="text-theme-info" />,
      },
      {
        path: '/results',
        name: 'ফলাফল',
        sub: 'Results & Grades',
        icon: <BarChart size={19} className="text-theme-warning" />,
      },
      {
        path: '/reports',
        name: 'প্রতিবেদন',
        sub: 'Reports & Analytics',
        icon: <FileText size={19} className="text-theme-accent" />,
      },
      {
        path: '/certificates',
        name: 'সার্টিফিকেট',
        sub: 'Certificates Issue',
        icon: <Award size={19} className="text-theme-primary" />,
      },
    ].filter((item) => canViewPage(item.path));

    if (academicItems.length > 0) {
      result.push({
        title: 'একাডেমিক ও মূল্যায়ন',
        items: academicItems,
      });
    }

    const curriculumItems: MenuItem[] = [
      {
        path: '/institutes',
        name: 'প্রতিষ্ঠান',
        sub: 'Institutes & Centers',
        icon: <Building2 size={19} className="text-theme-info" />,
      },
      {
        path: '/trades',
        name: 'ট্রেড',
        sub: 'Vocational Trades',
        icon: <Wrench size={19} className="text-theme-warning" />,
      },
      ...(SHOW_CALENDAR_MODULES
        ? [
            {
              path: '/trade-calendar',
              name: 'ট্রেড কারিকুলাম',
              sub: 'Trade Curriculum',
              icon: <GraduationCap size={19} className="text-theme-primary" />,
            },
            {
              path: '/shikhon-calendar',
              name: 'ব্যাচ শিখন ক্যালেন্ডার',
              sub: 'Batch Learning Calendar',
              icon: <BookOpen size={19} className="text-theme-accent" />,
            },
          ]
        : []),
      {
        path: '/attendance-sheet',
        name: 'মাসিক হাজিরা শিট',
        sub: 'Monthly Attendance Register',
        icon: <CalendarDays size={19} className="text-theme-primary" />,
      },
      ...(!isTrainer
        ? [
            {
              path: '/trainer-dashboard',
              name: 'প্রশিক্ষক ড্যাশবোর্ড',
              sub: 'Trainer Dashboard (Batch Inspect)',
              icon: <LayoutDashboard size={19} className="text-theme-info" />,
            },
          ]
        : []),
    ].filter((item) => canViewPage(item.path));

    if (curriculumItems.length > 0) {
      result.push({
        title: 'প্রতিষ্ঠান ও কারিকুলাম',
        items: curriculumItems,
      });
    }

    const adminItems: MenuItem[] = [
      {
        path: '/users',
        name: 'ব্যবহারকারী',
        sub: 'User Accounts & Staff',
        icon: <UserCheck size={19} className="text-theme-accent" />,
      },
      ...(isCourseDirector
        ? [
            {
              path: '/brn-verification',
              name: 'BRN verification',
              sub: 'জন্ম নিবন্ধন যাচাই',
              icon: <ShieldCheck size={19} className="text-theme-primary" />,
            },
            {
              path: '/roles',
              name: 'রোল ও পারমিশন',
              sub: 'Roles & Access Control',
              icon: <Shield size={19} className="text-theme-danger" />,
            },
          ]
        : []),
      {
        path: '/settings',
        name: 'সেটিংস ও থিম',
        sub: 'Settings & Theme',
        icon: <Settings size={19} className="text-theme-text-secondary" />,
      },
    ].filter((item) => canViewPage(item.path));

    if (adminItems.length > 0) {
      result.push({
        title: 'প্রশাসন ও নিরাপত্তা',
        items: adminItems,
      });
    }

    return result;
  }, [canViewPage, isCourseDirector, isTrainer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Container */}
      <div
        className="relative z-10 w-full max-h-[88vh] bg-theme-surface text-theme-text-primary rounded-t-3xl shadow-2xl border-t border-theme-border flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        {/* Drag Handle & Top Bar */}
        <div className="pt-3 px-5 pb-3 shrink-0 border-b border-theme-border bg-theme-surface-subtle">
          <div className="w-10 h-1 bg-theme-border-strong rounded-full mx-auto mb-3" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border flex items-center justify-center font-bold text-sm shrink-0">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-theme-text-primary truncate">
                    {userProfile?.name}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border shrink-0">
                    {userProfile?.role}
                  </span>
                </div>
                <p className="text-xs text-theme-text-secondary truncate mt-0.5">
                  {userProfile?.phone || userProfile?.email || 'উপানুষ্ঠানিক শিক্ষা ব্যুরো'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover transition active:scale-95 cursor-pointer"
              aria-label="মেনু বন্ধ করুন"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Module List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 overscroll-contain">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <span className="px-2 text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block">
                {section.title}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.99] ${
                        isActive
                          ? 'bg-theme-primary-soft border-theme-primary text-theme-text-primary shadow-2xs'
                          : 'bg-theme-surface-subtle hover:bg-theme-surface-hover border-theme-border text-theme-text-primary'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-theme-primary text-theme-primary-fg border-transparent [&>svg]:text-current'
                              : 'bg-theme-surface border-theme-border'
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-theme-text-primary truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-theme-text-secondary truncate">
                            {item.sub}
                          </p>
                        </div>
                      </div>

                      <ChevronRight
                        size={16}
                        className={`shrink-0 ml-2 ${
                          isActive ? 'text-theme-primary' : 'text-theme-text-muted'
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Logout Row */}
          <div className="pt-2">
            <button
              onClick={() => {
                onClose();
                signOut();
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-theme-danger bg-theme-danger-soft hover:opacity-90 border border-theme-danger-border transition active:scale-[0.99] cursor-pointer"
            >
              <LogOut size={16} />
              <span>লগআউট (Logout)</span>
            </button>
          </div>

          <div className="text-center pt-1 pb-2">
            <p className="text-[10px] text-theme-text-muted font-medium">
              উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) • ট্রেইনিং ম্যানেজমেন্ট সিস্টেম
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
