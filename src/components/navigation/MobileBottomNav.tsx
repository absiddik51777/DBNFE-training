import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home,
  Layers,
  Users,
  CalendarCheck,
  MoreHorizontal,
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMore: () => void;
  isMoreOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenMore,
  isMoreOpen,
}) => {
  const { userProfile } = useAuth();
  const location = useLocation();

  const isTrainer = userProfile?.role === 'Trainer';
  const homePath = isTrainer ? '/trainer-dashboard' : '/';

  const activeTab = useMemo(() => {
    const p = location.pathname;

    if (isMoreOpen) return 'more';

    // 1. Home tab
    if (isTrainer) {
      if (p === '/trainer-dashboard') return 'home';
    } else {
      if (p === '/') return 'home';
    }

    // 2. Batches tab (Batches, Institutes, Trades, Calendars)
    if (
      p.startsWith('/batches') ||
      p.startsWith('/institutes') ||
      p.startsWith('/trades') ||
      p.startsWith('/trade-calendar') ||
      p.startsWith('/shikhon-calendar')
    ) {
      return 'batches';
    }

    // 3. Trainees tab (Trainees, or Trainer Dashboard if inspected by non-trainer)
    if (p.startsWith('/trainees') || (!isTrainer && p === '/trainer-dashboard')) {
      return 'trainees';
    }

    // 4. Attendance tab (Daily attendance and monthly sheet)
    if (p.startsWith('/attendance')) {
      return 'attendance';
    }

    // 5. More menu modules
    const moreRoutes = [
      '/exams',
      '/results',
      '/reports',
      '/certificates',
      '/users',
      '/brn-verification',
      '/roles',
      '/settings',
    ];
    if (moreRoutes.some((route) => p.startsWith(route))) {
      return 'more';
    }

    if (p === '/') return 'home';

    return '';
  }, [location.pathname, isTrainer, isMoreOpen]);

  const tabClass = (tabKey: string) =>
    `relative flex flex-col items-center justify-center min-h-[56px] h-full py-1.5 px-1 transition-colors duration-150 active:scale-95 ${
      activeTab === tabKey
        ? 'text-theme-primary font-semibold'
        : 'text-theme-text-muted hover:text-theme-text-secondary font-medium'
    }`;

  return (
    <nav
      aria-label="মোবাইল নেভিগেশন বার"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-theme-nav border-t border-theme-border shadow-[0_-1px_8px_rgba(15,23,42,0.05)] dark:shadow-[0_-1px_12px_rgba(0,0,0,0.35)] select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 items-stretch h-16 max-w-lg mx-auto">
        {/* 1. Home Tab */}
        <Link to={homePath} className={tabClass('home')}>
          {activeTab === 'home' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
          )}
          <Home size={20} strokeWidth={activeTab === 'home' ? 2.25 : 1.85} />
          <span
            className={`text-[11px] leading-tight mt-1 tracking-tight ${
              activeTab === 'home' ? 'text-theme-primary' : 'text-theme-text-secondary'
            }`}
          >
            হোম
          </span>
        </Link>

        {/* 2. Batches Tab */}
        <Link to="/batches" className={tabClass('batches')}>
          {activeTab === 'batches' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
          )}
          <Layers size={20} strokeWidth={activeTab === 'batches' ? 2.25 : 1.85} />
          <span
            className={`text-[11px] leading-tight mt-1 tracking-tight ${
              activeTab === 'batches' ? 'text-theme-primary' : 'text-theme-text-secondary'
            }`}
          >
            ব্যাচ
          </span>
        </Link>

        {/* 3. Trainees Tab */}
        <Link to="/trainees" className={tabClass('trainees')}>
          {activeTab === 'trainees' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
          )}
          <Users size={20} strokeWidth={activeTab === 'trainees' ? 2.25 : 1.85} />
          <span
            className={`text-[11px] leading-tight mt-1 tracking-tight ${
              activeTab === 'trainees' ? 'text-theme-primary' : 'text-theme-text-secondary'
            }`}
          >
            শিক্ষার্থী
          </span>
        </Link>

        {/* 4. Attendance Tab */}
        <Link to="/attendance" className={tabClass('attendance')}>
          {activeTab === 'attendance' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
          )}
          <CalendarCheck size={20} strokeWidth={activeTab === 'attendance' ? 2.25 : 1.85} />
          <span
            className={`text-[11px] leading-tight mt-1 tracking-tight ${
              activeTab === 'attendance' ? 'text-theme-primary' : 'text-theme-text-secondary'
            }`}
          >
            হাজিরা
          </span>
        </Link>

        {/* 5. More Tab */}
        <button
          type="button"
          onClick={onOpenMore}
          className={`${tabClass('more')} cursor-pointer`}
          aria-label="আরও মেনু খুলুন"
        >
          {activeTab === 'more' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
          )}
          <MoreHorizontal size={20} strokeWidth={activeTab === 'more' ? 2.25 : 1.85} />
          <span
            className={`text-[11px] leading-tight mt-1 tracking-tight ${
              activeTab === 'more' ? 'text-theme-primary' : 'text-theme-text-secondary'
            }`}
          >
            আরও
          </span>
        </button>
      </div>
    </nav>
  );
};
