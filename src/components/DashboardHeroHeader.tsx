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
  CheckCircle2,
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
  batchInfoBadge,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'শুভ সকাল';
    if (hour >= 12 && hour < 16) return 'শুভ দুপুর';
    if (hour >= 16 && hour < 19) return 'শুভ বিকেল';
    if (hour >= 19 && hour < 23) return 'শুভ সন্ধ্যা';
    return 'শুভ রাত্রি';
  };

  const getFormattedDateBn = (): string => {
    const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const monthsBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
    ];
    const now = new Date();
    const dayName = daysBn[now.getDay()];
    const dayNum = toBn(now.getDate());
    const monthName = monthsBn[now.getMonth()];
    return `${dayName} ${dayNum} ${monthName}`;
  };

  const getFormattedSyncTimeBn = (): string => {
    const hours = lastSyncTime.getHours();
    const minutes = lastSyncTime.getMinutes();
    const isPM = hours >= 12;
    const h12 = hours % 12 || 12;
    const minStr = minutes.toString().padStart(2, '0');
    return `${toBn(h12)}:${toBn(minStr)} ${isPM ? 'PM' : 'AM'}`;
  };

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
      return parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1);
    }
    return name.slice(0, 2);
  };

  const displayName = userProfile?.name || 'A.B. Siddik';
  const roleName =
    userProfile?.role === 'Trainer'
      ? 'Course Trainer'
      : userProfile?.role || 'Course Director';

  const getRoleBadgeClasses = () => {
    switch (userProfile?.role) {
      case 'Course Director':
        return {
          wrapper: 'bg-theme-accent-soft text-theme-accent border-theme-accent-border',
          icon: 'text-theme-accent fill-current',
        };
      case 'Trainer':
        return {
          wrapper: 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border',
          icon: 'text-theme-primary fill-current',
        };
      case 'FMA':
        return {
          wrapper: 'bg-theme-info-soft text-theme-info border-theme-info-border',
          icon: 'text-theme-info fill-current',
        };
      default:
        return {
          wrapper: 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border',
          icon: 'text-theme-text-secondary fill-current',
        };
    }
  };

  const roleStyles = getRoleBadgeClasses();

  return (
    <div className="relative">
      <div className="bg-theme-surface rounded-2xl p-5 sm:p-6 border border-theme-border shadow-xs transition-colors text-theme-text-primary relative">
        {/* Top Row: User Avatar, Name, Greeting, Role and 3-dots Menu Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 sm:space-x-4 min-w-0">
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-theme-primary p-0.5 flex items-center justify-center bg-theme-surface">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border font-bold text-lg sm:text-xl flex items-center justify-center tracking-tight">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>
              <span
                className="w-3.5 h-3.5 bg-theme-success rounded-full border-2 border-theme-surface absolute bottom-0.5 right-0.5"
                title="সক্রিয়"
              />
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-theme-primary tracking-wide">
                {getGreeting()}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-theme-text-primary tracking-tight leading-tight truncate">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <div
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleStyles.wrapper}`}
                >
                  <Bookmark size={12} className={`${roleStyles.icon} shrink-0`} />
                  <span>{roleName}</span>
                </div>
                {batchInfoBadge && (
                  <span className="text-xs font-medium text-theme-text-secondary bg-theme-surface-subtle px-2.5 py-0.5 rounded-full border border-theme-border">
                    {batchInfoBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover active:scale-95 text-theme-text-primary flex items-center justify-center transition cursor-pointer"
              title="অ্যাকশন মেনু"
              aria-label="অ্যাকশন মেনু"
            >
              <MoreVertical size={20} />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-12 sm:top-13 z-50 w-64 bg-theme-elevated rounded-2xl shadow-xl border border-theme-border p-2 text-theme-text-primary animate-in fade-in zoom-in-95 duration-150">
                <div className="space-y-1">
                  <Link
                    to="/attendance"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-theme-surface-hover transition group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-theme-primary text-theme-primary-fg flex items-center justify-center shrink-0">
                      <CalendarCheck size={18} />
                    </div>
                    <span className="text-sm font-bold text-theme-text-primary group-hover:text-theme-primary transition-colors">
                      হাজিরা এন্ট্রি
                    </span>
                  </Link>

                  <Link
                    to="/trainees/add"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-theme-surface-hover transition group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-theme-surface-subtle text-theme-text-primary border border-theme-border flex items-center justify-center shrink-0">
                      <Plus size={19} strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-theme-text-primary transition-colors">
                      নতুন ভর্তি
                    </span>
                  </Link>

                  <Link
                    to={isTrainerDashboard ? '/' : '/trainer-dashboard'}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-theme-surface-hover transition group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-theme-accent-soft text-theme-accent border border-theme-accent-border flex items-center justify-center shrink-0">
                      <UserCheck size={18} />
                    </div>
                    <span className="text-sm font-bold text-theme-text-primary group-hover:text-theme-accent transition-colors">
                      {isTrainerDashboard ? 'সার্বিক ড্যাশবোর্ড' : 'প্রশিক্ষক ড্যাশবোর্ড'}
                    </span>
                  </Link>

                  <div className="border-t border-theme-border my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRefresh();
                    }}
                    disabled={refreshing}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-theme-surface-hover transition text-left cursor-pointer disabled:opacity-60 group"
                  >
                    <div className="w-9 h-9 flex items-center justify-center shrink-0 text-theme-primary">
                      <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </div>
                    <span className="text-sm font-semibold text-theme-text-primary">
                      {refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিফ্রেশ'}
                    </span>
                  </button>

                  {onPrint && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onPrint();
                      }}
                      className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-theme-surface-hover transition text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center shrink-0 text-theme-text-secondary">
                        <Printer size={18} />
                      </div>
                      <span className="text-sm font-semibold text-theme-text-primary">
                        প্রিন্ট
                      </span>
                    </button>
                  )}

                  {onExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onExport();
                      }}
                      className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-theme-surface-hover transition text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center shrink-0 text-theme-text-secondary">
                        <Download size={18} />
                      </div>
                      <span className="text-sm font-semibold text-theme-text-primary">
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
        <div className="border-b border-dashed border-theme-border my-4 sm:my-5" />

        {/* Bottom Row: Calendar Date on Left, Sync Time on Right */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-theme-text-secondary">
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-theme-primary shrink-0" />
            <span className="font-semibold text-theme-text-primary tracking-wide">
              {getFormattedDateBn()}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="font-medium text-theme-text-secondary">সিঙ্ক:</span>
            <span className="font-bold text-theme-text-primary font-mono tabular-nums">
              {getFormattedSyncTimeBn()}
            </span>
          </div>
        </div>
      </div>

      {syncSuccessMsg && (
        <div className="mt-2.5 p-3 bg-theme-success-soft border border-theme-success-border text-theme-success rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};

export default DashboardHeroHeader;
