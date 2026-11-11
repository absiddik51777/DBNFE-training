import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MoreVertical, 
  Calendar, 
  CalendarCheck, 
  Plus, 
  UserCheck, 
  RefreshCw, 
  Printer, 
  Download, 
  Bookmark,
  CheckCircle2
} from 'lucide-react';
import { UserProfile } from '../types';
import { toBn } from '../lib/dateUtils';

interface DashboardHeroHeaderProps {
  userProfile: UserProfile | null;
  lastSyncTime: Date;
  onRefresh: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  isTrainerDashboard?: boolean;
  refreshing?: boolean;
  syncSuccessMsg?: string;
  batchInfoBadge?: string;
}

export const DashboardHeroHeader: React.FC<DashboardHeroHeaderProps> = ({
  userProfile,
  lastSyncTime,
  onRefresh,
  onPrint,
  onExport,
  isTrainerDashboard = false,
  refreshing = false,
  syncSuccessMsg,
  batchInfoBadge
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Greeting in Bengali based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'শুভ সকাল';
    if (hour >= 12 && hour < 16) return 'শুভ দুপুর';
    if (hour >= 16 && hour < 19) return 'শুভ বিকেল';
    if (hour >= 19 && hour < 23) return 'শুভ সন্ধ্যা';
    return 'শুভ রাত্রি';
  };

  // Format date in Bengali: e.g. "বৃহস্পতিবার ১২ নভেম্বর"
  const getFormattedDateBn = (): string => {
    const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const monthsBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const now = new Date();
    const dayName = daysBn[now.getDay()];
    const dayNum = toBn(now.getDate());
    const monthName = monthsBn[now.getMonth()];
    return `${dayName} ${dayNum} ${monthName}`;
  };

  // Format sync time in Bengali: e.g. "১২:৩৬ AM"
  const getFormattedSyncTimeBn = (): string => {
    const hours = lastSyncTime.getHours();
    const minutes = lastSyncTime.getMinutes();
    const isPM = hours >= 12;
    const h12 = hours % 12 || 12;
    const minStr = minutes.toString().padStart(2, '0');
    return `${toBn(h12)}:${toBn(minStr)} ${isPM ? 'PM' : 'AM'}`;
  };

  // Get user initials (e.g. A.B. Siddik -> AS, Md Bourhanuddin -> MB)
  const getInitials = (name?: string): string => {
    if (!name) return 'BN';
    const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
    if (clean.length >= 2) {
      const parts = clean.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return clean.slice(0, 2).toUpperCase();
    }
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1));
    }
    return name.slice(0, 2);
  };

  const displayName = userProfile?.name || 'A.B. Siddik';
  const roleName = userProfile?.role === 'Trainer' 
    ? 'Course Trainer' 
    : userProfile?.role || 'Course Director';

  // Role badge theme colors aligned with the app design system
  const getRoleBadgeClasses = () => {
    switch (userProfile?.role) {
      case 'Course Director':
        return {
          wrapper: 'bg-purple-50 text-purple-700 border-purple-200/80',
          icon: 'text-purple-700 fill-purple-700'
        };
      case 'Trainer':
        return {
          wrapper: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          icon: 'text-emerald-700 fill-emerald-700'
        };
      case 'FMA':
        return {
          wrapper: 'bg-blue-50 text-blue-700 border-blue-200/80',
          icon: 'text-blue-700 fill-blue-700'
        };
      default:
        return {
          wrapper: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: 'text-slate-600 fill-slate-600'
        };
    }
  };

  const roleStyles = getRoleBadgeClasses();

  return (
    <div className="relative">
      {/* Main Hero Card with Native Theme Colors (White card, slate-200 border, emerald theme) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all text-slate-800 relative">
        {/* Top Row: User Avatar, Name, Greeting, Role and 3-dots Menu Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 sm:space-x-4">
            {/* Avatar circle with emerald ring and active online status dot */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-emerald-500 p-0.5 flex items-center justify-center bg-white shadow-2xs">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-black text-lg sm:text-xl flex items-center justify-center tracking-tight shadow-inner">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>
              {/* Online Green Indicator Dot */}
              <span 
                className="w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0.5 right-0.5 shadow-2xs" 
                title="সক্রিয়"
              />
            </div>

            {/* User Greeting, Name & Role */}
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-semibold text-emerald-600 tracking-wide">
                {getGreeting()}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <div className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${roleStyles.wrapper}`}>
                  <Bookmark size={13} className={`${roleStyles.icon} shrink-0`} />
                  <span>{roleName}</span>
                </div>
                {batchInfoBadge && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                    {batchInfoBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Menu (3 Dots Button) */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 flex items-center justify-center transition cursor-pointer shadow-2xs hover:border-slate-300"
              title="অ্যাকশন মেনু"
              aria-label="অ্যাকশন মেনু"
            >
              <MoreVertical size={20} />
            </button>

            {/* Dropdown Popover matching User Action Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-12 sm:top-13 z-50 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                <div className="space-y-1">
                  {/* Option 1: হাজিরা এন্ট্রি (Emerald theme button) */}
                  <Link
                    to="/attendance"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:bg-emerald-700 group-hover:scale-105 transition-all">
                      <CalendarCheck size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      হাজিরা এন্ট্রি
                    </span>
                  </Link>

                  {/* Option 2: নতুন ভর্তি (Dark Slate theme button) */}
                  <Link
                    to="/trainees/add"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:bg-slate-800 group-hover:scale-105 transition-all">
                      <Plus size={20} strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
                      নতুন ভর্তি
                    </span>
                  </Link>

                  {/* Option 3: ড্যাশবোর্ড সুইচ (প্রশিক্ষক ড্যাশবোর্ড / সার্বিক ড্যাশবোর্ড) */}
                  <Link
                    to={isTrainerDashboard ? "/" : "/trainer-dashboard"}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-purple-100 group-hover:scale-105 transition-all">
                      <UserCheck size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                      {isTrainerDashboard ? 'সার্বিক ড্যাশবোর্ড' : 'প্রশিক্ষক ড্যাশবোর্ড'}
                    </span>
                  </Link>

                  {/* Divider line */}
                  <div className="border-t border-slate-100 my-1"></div>

                  {/* Option 4: রিফ্রেশ */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRefresh();
                    }}
                    disabled={refreshing}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer disabled:opacity-60 group"
                  >
                    <div className="w-9 h-9 flex items-center justify-center shrink-0 text-emerald-600 group-hover:text-emerald-700">
                      <RefreshCw size={19} className={refreshing ? 'animate-spin' : ''} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                      {refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিফ্রেশ'}
                    </span>
                  </button>

                  {/* Option 5: প্রিন্ট */}
                  {onPrint && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onPrint();
                      }}
                      className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center shrink-0 text-slate-600 group-hover:text-slate-800">
                        <Printer size={19} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                        প্রিন্ট
                      </span>
                    </button>
                  )}

                  {/* Option 6: এক্সপোর্ট */}
                  {onExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onExport();
                      }}
                      className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center shrink-0 text-slate-600 group-hover:text-slate-800">
                        <Download size={19} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                        এক্সপোর্ট
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Dashed Divider Line */}
        <div className="border-b border-dashed border-slate-200 my-4 sm:my-5"></div>

        {/* Bottom Row: Calendar Date on Left, Sync Time on Right */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-700 tracking-wide">
              {getFormattedDateBn()}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="font-medium text-slate-500">সিঙ্ক:</span>
            <span className="font-bold text-slate-800 font-mono">
              {getFormattedSyncTimeBn()}
            </span>
          </div>
        </div>
      </div>

      {/* Optional Sync Toast / Alert Banner */}
      {syncSuccessMsg && (
        <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center space-x-2 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};

export default DashboardHeroHeader;

