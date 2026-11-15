import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BellOff,
  CheckCheck,
  MoreVertical,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import {
  NOTIFICATIONS_PAGE_SIZE,
  useNotifications,
} from '../hooks/useNotifications';
import { formatCountBn, groupAuditLogsByDhakaDay } from '../lib/auditDate';
import { normalizeAuditModuleKey } from '../lib/auditQueryBuilder';
import {
  getNotifyMinorEditsPreference,
  setNotifyMinorEditsPreference,
} from '../lib/notificationRules';
import type { ActivityLog } from '../types';
import { AuditDetailSheet } from '../components/audit/AuditDetailSheet';
import { NotificationItem } from '../components/notifications/NotificationItem';
import { ConfirmClearDialog } from '../components/notifications/ConfirmClearDialog';
import { extractAttendanceNavigationTarget } from '../components/notifications/notificationHelpers';

const CD_MODULE_CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'ALL', label: 'সব' },
  { id: 'trainees', label: 'প্রশিক্ষণার্থী' },
  { id: 'attendance', label: 'হাজিরা' },
  { id: 'settings', label: 'সেটিংস' },
  { id: 'security', label: 'নিরাপত্তা' },
];

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { isCourseDirector } = usePermissions();
  const {
    notifications,
    unreadCount,
    unreadIds,
    loading,
    loadingMore,
    hasMore,
    error,
    soundEnabled,
    toggleSound,
    markAllSeen,
    clearAllNotifications,
    loadMore,
    refreshNotifications,
  } = useNotifications();

  const isAdmin = userProfile?.role === 'Course Director' || isCourseDirector;

  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(NOTIFICATIONS_PAGE_SIZE);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [minorEditsEnabled, setMinorEditsEnabled] = useState<boolean>(() =>
    getNotifyMinorEditsPreference()
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close overflow menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const filteredNotifications = useMemo(() => {
    if (!isAdmin || selectedModule === 'ALL') {
      return notifications;
    }
    return notifications.filter(
      (item) => normalizeAuditModuleKey(item.module) === selectedModule
    );
  }, [notifications, isAdmin, selectedModule]);

  const visibleNotifications = useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount]
  );

  const dayGroups = useMemo(
    () => groupAuditLogsByDhakaDay(visibleNotifications),
    [visibleNotifications]
  );

  const hasMoreToShow =
    visibleCount < filteredNotifications.length || hasMore;

  const handleLoadMore = async () => {
    const nextLimit = visibleCount + NOTIFICATIONS_PAGE_SIZE;
    setVisibleCount(nextLimit);
    if (nextLimit >= filteredNotifications.length && hasMore) {
      await loadMore();
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      window.setTimeout(() => setRefreshing(false), 300);
    }
  };

  const handleConfirmClear = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await clearAllNotifications();
      setConfirmClearOpen(false);
    } finally {
      setClearing(false);
    }
  };

  const handleSelectItem = (log: ActivityLog) => {
    const attendanceTarget = extractAttendanceNavigationTarget(log);
    if (attendanceTarget) {
      navigate(
        `/attendance?batchId=${encodeURIComponent(attendanceTarget.batchId)}&date=${encodeURIComponent(
          attendanceTarget.date
        )}`
      );
      return;
    }
    setSelectedLog(log);
  };

  const handleToggleMinorEdits = () => {
    const next = !minorEditsEnabled;
    setNotifyMinorEditsPreference(next);
    setMinorEditsEnabled(next);
  };

  return (
    <div className="w-full max-w-[780px] mx-auto space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[12px] border border-theme-success-border bg-theme-success-soft px-4 py-2.5 text-xs sm:text-sm font-medium text-theme-text-primary"
        >
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-theme-text-primary leading-snug">
            বিজ্ঞপ্তি
          </h1>
          <p className="text-xs sm:text-sm text-theme-text-secondary mt-0.5 tabular-nums">
            {unreadCount > 0
              ? `${formatCountBn(unreadCount)} অপঠিত বিজ্ঞপ্তি (সর্বশেষ ৩০ দিন)`
              : 'সাম্প্রতিক কার্যক্রম ও বিজ্ঞপ্তি (সর্বশেষ ৩০ দিন)'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => void markAllSeen()}
            disabled={unreadCount === 0}
            className="min-h-[44px] px-3 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs sm:text-sm font-medium text-theme-primary inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
          >
            <CheckCheck size={16} />
            <span>সব পঠিত করুন</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            disabled={notifications.length === 0}
            className="min-h-[44px] px-3 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-danger-soft/40 hover:border-theme-danger-border text-xs sm:text-sm font-medium text-theme-text-secondary hover:text-theme-danger inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
          >
            <Trash2 size={16} />
            <span>সব মুছুন</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            aria-label="রিফ্রেশ"
            title="রিফ্রেশ"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Header overflow menu (Sound + CD preference) */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="বিজ্ঞপ্তি সেটিংস মেনু"
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[12px] border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer ${
                menuOpen
                  ? 'border-theme-primary-border bg-theme-primary-soft text-theme-primary'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary'
              }`}
            >
              <MoreVertical size={17} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-64 rounded-[14px] border border-theme-border bg-theme-elevated shadow-md py-1.5 z-30"
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={soundEnabled}
                  onClick={() => {
                    toggleSound();
                    setMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between gap-2 text-left text-sm font-medium text-theme-text-primary hover:bg-theme-surface-hover cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    {soundEnabled ? (
                      <Volume2 size={16} className="text-theme-primary" />
                    ) : (
                      <VolumeX size={16} className="text-theme-text-muted" />
                    )}
                    <span>বিজ্ঞপ্তির শব্দ</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-[8px] text-[11px] font-medium border ${
                      soundEnabled
                        ? 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border'
                        : 'bg-theme-surface-subtle text-theme-text-muted border-theme-border'
                    }`}
                  >
                    {soundEnabled ? 'চালু' : 'বন্ধ'}
                  </span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={minorEditsEnabled}
                    onClick={() => {
                      handleToggleMinorEdits();
                      setMenuOpen(false);
                    }}
                    className="w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between gap-2 text-left text-sm font-medium text-theme-text-primary hover:bg-theme-surface-hover border-t border-theme-border cursor-pointer"
                  >
                    <span className="leading-snug">সাধারণ সম্পাদনায় বিজ্ঞপ্তি</span>
                    <span
                      className={`px-2 py-0.5 rounded-[8px] text-[11px] font-medium border shrink-0 ${
                        minorEditsEnabled
                          ? 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border'
                          : 'bg-theme-surface-subtle text-theme-text-muted border-theme-border'
                      }`}
                    >
                      {minorEditsEnabled ? 'চালু' : 'বন্ধ'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Module filter chips (Course Director only) */}
      {isAdmin && (
        <div
          role="tablist"
          aria-label="মডিউল অনুযায়ী বিজ্ঞপ্তি ফিল্টার"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
        >
          {CD_MODULE_CHIPS.map((chip) => {
            const active = selectedModule === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSelectedModule(chip.id);
                  setVisibleCount(NOTIFICATIONS_PAGE_SIZE);
                }}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-[12px] border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer ${
                  active
                    ? 'bg-theme-primary text-theme-primary-fg border-theme-primary'
                    : 'bg-theme-surface text-theme-text-secondary border-theme-border hover:bg-theme-surface-hover hover:text-theme-text-primary'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Error banner if index or query issue occurs */}
      {error && (
        <div className="rounded-[14px] border border-theme-warning-border bg-theme-warning-soft px-4 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-theme-text-primary">
          <AlertTriangle size={17} className="text-theme-warning shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      {loading && notifications.length === 0 ? (
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-8 text-center text-sm text-theme-text-secondary">
          বিজ্ঞপ্তি লোড হচ্ছে...
        </div>
      ) : dayGroups.length === 0 ? (
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-10 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-[14px] border border-theme-border bg-theme-surface-subtle text-theme-text-muted flex items-center justify-center mx-auto">
            <BellOff size={22} />
          </div>
          <p className="text-base font-medium text-theme-text-primary">
            কোনো বিজ্ঞপ্তি নেই
          </p>
          <p className="text-xs sm:text-sm text-theme-text-secondary">
            নতুন কোনো কার্যক্রম রেকর্ড হলে এখানে দেখা যাবে।
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dayGroups.map((group) => (
            <section key={group.key} className="space-y-1.5">
              <div className="px-1 flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-medium text-theme-text-secondary">
                  {group.label}
                </h2>
                <span className="text-xs text-theme-text-muted tabular-nums">
                  {formatCountBn(group.items.length)}
                </span>
              </div>

              <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
                {group.items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    log={item}
                    isUnread={unreadIds.has(item.id)}
                    showModuleChip
                    onSelect={handleSelectItem}
                  />
                ))}
              </div>
            </section>
          ))}

          {hasMoreToShow && (
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                className="min-h-[44px] px-6 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-sm font-medium text-theme-text-primary inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>লোড হচ্ছে...</span>
                  </>
                ) : (
                  <span>আরও দেখুন</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Read-only (for non-admin) or Admin detail sheet */}
      <AuditDetailSheet
        log={selectedLog}
        isAdmin={isAdmin}
        actor={
          userProfile
            ? {
                userId: userProfile.id || '',
                user: userProfile.name || 'User',
                userRole: userProfile.role || '',
              }
            : undefined
        }
        onClose={() => setSelectedLog(null)}
        onActionSuccess={async (msg) => {
          setSelectedLog(null);
          await refreshNotifications();
          setToastMsg(msg);
        }}
        onNavigateToData={() => navigate('/settings#data')}
      />

      <ConfirmClearDialog
        open={confirmClearOpen}
        clearing={clearing}
        onConfirm={handleConfirmClear}
        onClose={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};

export default NotificationsPage;
