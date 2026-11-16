import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
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
  const { canViewPage } = usePermissions();
  const location = useLocation();

  const isTrainer = userProfile?.role === 'Trainer';
  const homePath = isTrainer ? '/trainer-dashboard' : '/';

  const visibleTabs = useMemo(() => {
    const items = [
      {
        key: 'home',
        to: homePath,
        label: 'হোম',
        Icon: Home,
        visible: canViewPage(homePath),
      },
      {
        key: 'batches',
        to: '/batches',
        label: 'ব্যাচ',
        Icon: Layers,
        visible: canViewPage('/batches'),
      },
      {
        key: 'trainees',
        to: '/trainees',
        label: 'শিক্ষার্থী',
        Icon: Users,
        visible: canViewPage('/trainees'),
      },
      {
        key: 'attendance',
        to: '/attendance',
        label: 'হাজিরা',
        Icon: CalendarCheck,
        visible: canViewPage('/attendance'),
      },
    ];
    return items.filter((item) => item.visible);
  }, [canViewPage, homePath]);

  const activeTab = useMemo(() => {
    const p = location.pathname;

    if (isMoreOpen) return 'more';

    if (isTrainer) {
      if (p === '/trainer-dashboard') return 'home';
    } else {
      if (p === '/') return 'home';
    }

    if (
      p.startsWith('/batches') ||
      p.startsWith('/institutes') ||
      p.startsWith('/trades') ||
      p.startsWith('/trade-calendar') ||
      p.startsWith('/shikhon-calendar')
    ) {
      return 'batches';
    }

    if (p.startsWith('/trainees') || (!isTrainer && p === '/trainer-dashboard')) {
      return 'trainees';
    }

    if (p.startsWith('/attendance')) {
      return 'attendance';
    }

    const moreRoutes = [
      '/exams',
      '/results',
      '/reports',
      '/certificates',
      '/users',
      '/brn-verification',
      '/roles',
      '/settings',
      '/notifications',
    ];
    if (moreRoutes.some((route) => p.startsWith(route))) {
      return 'more';
    }

    if (p === '/') return 'home';

    return '';
  }, [location.pathname, isTrainer, isMoreOpen]);

  const tabClass = (tabKey: string) =>
    `relative flex flex-col items-center justify-center min-h-[58px] h-full min-w-0 py-1.5 px-0.5 font-sans font-medium transition-colors duration-150 active:scale-95 ${
      activeTab === tabKey
        ? 'text-theme-primary'
        : 'text-theme-text-muted hover:text-theme-text-secondary'
    }`;

  const totalColumns = visibleTabs.length + 1;

  return (
    <nav
      aria-label="মোবাইল নেভিগেশন বার"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 font-sans bg-theme-nav border-t border-theme-border shadow-[0_-1px_8px_rgba(15,23,42,0.05)] dark:shadow-[0_-1px_12px_rgba(0,0,0,0.35)] select-none print:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="grid items-stretch min-h-16 max-w-lg mx-auto"
        style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))` }}
      >
        {visibleTabs.map(({ key, to, label, Icon }) => {
          const active = activeTab === key;
          return (
            <Link key={key} to={to} className={tabClass(key)}>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
              )}
              <Icon size={20} strokeWidth={active ? 2.15 : 1.85} />
              <span
                className={`text-[11px] leading-snug mt-1 whitespace-nowrap text-center ${
                  active ? 'text-theme-primary' : 'text-theme-text-secondary'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMore}
          className={`${tabClass('more')} cursor-pointer`}
          aria-label="আরও মেনু খুলুন"
        >
          {activeTab === 'more' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-theme-primary rounded-b-full transition-all" />
          )}
          <MoreHorizontal size={20} strokeWidth={activeTab === 'more' ? 2.15 : 1.85} />
          <span
            className={`text-[11px] leading-snug mt-1 whitespace-nowrap text-center ${
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
