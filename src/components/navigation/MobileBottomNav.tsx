import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Home, 
  Layers, 
  Users, 
  CalendarCheck, 
  MoreHorizontal
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMore: () => void;
  isMoreOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMore, isMoreOpen }) => {
  const { userProfile } = useAuth();
  const location = useLocation();

  const isTrainer = userProfile?.role === 'Trainer';
  const homePath = isTrainer ? '/trainer-dashboard' : '/';

  // Determine active tab based on current pathname
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
      '/settings'
    ];
    if (moreRoutes.some(route => p.startsWith(route))) {
      return 'more';
    }

    // Fallback: if at root or unspecified
    if (p === '/') return 'home';

    return '';
  }, [location.pathname, isTrainer, isMoreOpen]);

  return (
    <nav 
      aria-label="মোবাইল নেভিগেশন বার"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 shadow-[0_-4px_24px_rgba(0,0,0,0.35)] select-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {/* 1. Home Tab */}
        <Link
          to={homePath}
          className={`relative flex flex-col items-center justify-center h-full py-1 transition-all duration-200 active:scale-95 ${
            activeTab === 'home'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          {activeTab === 'home' && (
            <span className="absolute top-0 w-8 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          )}
          <Home size={20} className={`transition-transform duration-200 ${activeTab === 'home' ? 'scale-110' : ''}`} />
          <span className="text-[11px] leading-tight mt-1 tracking-tight">হোম</span>
        </Link>

        {/* 2. Batches Tab */}
        <Link
          to="/batches"
          className={`relative flex flex-col items-center justify-center h-full py-1 transition-all duration-200 active:scale-95 ${
            activeTab === 'batches'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          {activeTab === 'batches' && (
            <span className="absolute top-0 w-8 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          )}
          <Layers size={20} className={`transition-transform duration-200 ${activeTab === 'batches' ? 'scale-110' : ''}`} />
          <span className="text-[11px] leading-tight mt-1 tracking-tight">ব্যাচ</span>
        </Link>

        {/* 3. Trainees Tab */}
        <Link
          to="/trainees"
          className={`relative flex flex-col items-center justify-center h-full py-1 transition-all duration-200 active:scale-95 ${
            activeTab === 'trainees'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          {activeTab === 'trainees' && (
            <span className="absolute top-0 w-8 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          )}
          <Users size={20} className={`transition-transform duration-200 ${activeTab === 'trainees' ? 'scale-110' : ''}`} />
          <span className="text-[11px] leading-tight mt-1 tracking-tight">শিক্ষার্থী</span>
        </Link>

        {/* 4. Attendance Tab */}
        <Link
          to="/attendance"
          className={`relative flex flex-col items-center justify-center h-full py-1 transition-all duration-200 active:scale-95 ${
            activeTab === 'attendance'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          {activeTab === 'attendance' && (
            <span className="absolute top-0 w-8 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          )}
          <CalendarCheck size={20} className={`transition-transform duration-200 ${activeTab === 'attendance' ? 'scale-110' : ''}`} />
          <span className="text-[11px] leading-tight mt-1 tracking-tight">হাজিরা</span>
        </Link>

        {/* 5. More Tab */}
        <button
          type="button"
          onClick={onOpenMore}
          className={`relative flex flex-col items-center justify-center h-full py-1 transition-all duration-200 active:scale-95 cursor-pointer ${
            activeTab === 'more'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
          aria-label="আরও মেনু খুলুন"
        >
          {activeTab === 'more' && (
            <span className="absolute top-0 w-8 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          )}
          <MoreHorizontal size={20} className={`transition-transform duration-200 ${activeTab === 'more' ? 'scale-110' : ''}`} />
          <span className="text-[11px] leading-tight mt-1 tracking-tight">আরও</span>
        </button>
      </div>
    </nav>
  );
};
