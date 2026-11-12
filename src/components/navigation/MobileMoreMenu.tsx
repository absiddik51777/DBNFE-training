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
  ExternalLink
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

  // Build categorized sections respecting permissions
  const sections: MenuSection[] = useMemo(() => {
    const result: MenuSection[] = [];

    // 1. একাডেমিক ও মূল্যায়ন (Academic & Evaluation)
    const academicItems: MenuItem[] = [
      {
        path: '/exams',
        name: 'পরীক্ষা',
        sub: 'Exams & Assessment',
        icon: <FileText size={20} className="text-blue-400" />
      },
      {
        path: '/results',
        name: 'ফলাফল',
        sub: 'Results & Grades',
        icon: <BarChart size={20} className="text-amber-400" />
      },
      {
        path: '/reports',
        name: 'প্রতিবেদন',
        sub: 'Reports & Analytics',
        icon: <FileText size={20} className="text-teal-400" />
      },
      {
        path: '/certificates',
        name: 'সার্টিফিকেট',
        sub: 'Certificates Issue',
        icon: <Award size={20} className="text-yellow-400" />
      }
    ].filter(item => canViewPage(item.path));

    if (academicItems.length > 0) {
      result.push({
        title: 'একাডেমিক ও মূল্যায়ন',
        items: academicItems
      });
    }

    // 2. প্রতিষ্ঠান, ট্রেড ও কারিকুলাম (Institutes, Trades & Curriculum)
    const curriculumItems: MenuItem[] = [
      {
        path: '/institutes',
        name: 'প্রতিষ্ঠান',
        sub: 'Institutes & Centers',
        icon: <Building2 size={20} className="text-indigo-400" />
      },
      {
        path: '/trades',
        name: 'ট্রেড',
        sub: 'Vocational Trades',
        icon: <Wrench size={20} className="text-orange-400" />
      },
      ...(SHOW_CALENDAR_MODULES ? [
        {
          path: '/trade-calendar',
          name: 'ট্রেড কারিকুলাম',
          sub: 'Trade Curriculum',
          icon: <GraduationCap size={20} className="text-emerald-400" />
        },
        {
          path: '/shikhon-calendar',
          name: 'ব্যাচ শিখন ক্যালেন্ডার',
          sub: 'Batch Learning Calendar',
          icon: <BookOpen size={20} className="text-cyan-400" />
        }
      ] : []),
      {
        path: '/attendance-sheet',
        name: 'মাসিক হাজিরা শিট',
        sub: 'Monthly Attendance Register',
        icon: <CalendarDays size={20} className="text-emerald-400" />
      },
      ...(!isTrainer ? [
        {
          path: '/trainer-dashboard',
          name: 'প্রশিক্ষক ড্যাশবোর্ড',
          sub: 'Trainer Dashboard (Batch Inspect)',
          icon: <LayoutDashboard size={20} className="text-sky-400" />
        }
      ] : [])
    ].filter(item => canViewPage(item.path));

    if (curriculumItems.length > 0) {
      result.push({
        title: 'প্রতিষ্ঠান ও কারিকুলাম',
        items: curriculumItems
      });
    }

    // 3. প্রশাসন ও নিরাপত্তা (Administration & Security)
    const adminItems: MenuItem[] = [
      {
        path: '/users',
        name: 'ব্যবহারকারী',
        sub: 'User Accounts & Staff',
        icon: <UserCheck size={20} className="text-purple-400" />
      },
      ...(isCourseDirector ? [
        {
          path: '/brn-verification',
          name: 'BRN verification',
          sub: 'জন্ম নিবন্ধন যাচাই',
          icon: <ShieldCheck size={20} className="text-emerald-400" />
        },
        {
          path: '/roles',
          name: 'রোল ও পারমিশন',
          sub: 'Roles & Access Control',
          icon: <Shield size={20} className="text-rose-400" />
        }
      ] : []),
      {
        path: '/settings',
        name: 'সেটিংস',
        sub: 'System Configuration',
        icon: <Settings size={20} className="text-slate-400" />
      }
    ].filter(item => canViewPage(item.path));

    if (adminItems.length > 0) {
      result.push({
        title: 'প্রশাসন ও নিরাপত্তা',
        items: adminItems
      });
    }

    return result;
  }, [canViewPage, isCourseDirector, isTrainer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet / Full-Screen Menu Container */}
      <div 
        className="relative z-10 w-full max-h-[90vh] bg-slate-900 text-white rounded-t-3xl shadow-2xl border-t border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        {/* Drag Handle & Top Bar */}
        <div className="pt-3 px-6 pb-2 shrink-0 border-b border-slate-800/80 bg-slate-950/40">
          <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-3" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-slate-100 truncate">{userProfile?.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {userProfile?.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {userProfile?.phone || userProfile?.email || 'উপানুষ্ঠানিক শিক্ষা ব্যুরো'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
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
              <span className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {section.title}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-98 ${
                        isActive
                          ? 'bg-emerald-600/25 border-emerald-500/60 text-white shadow-xs'
                          : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/50 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isActive 
                            ? 'bg-emerald-500 text-white border-emerald-400' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {item.sub}
                          </p>
                        </div>
                      </div>

                      <ChevronRight size={16} className={`shrink-0 ml-2 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
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
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-rose-400 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/50 transition active:scale-98"
            >
              <LogOut size={16} />
              <span>লগআউট (Logout)</span>
            </button>
          </div>

          <div className="text-center pt-1 pb-2">
            <p className="text-[10px] text-slate-500 font-medium">
              উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) • ট্রেইনিং ম্যানেজমেন্ট সিস্টেম
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
