import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, Wrench } from 'lucide-react';
import type { ActivityLog } from '../../types';
import {
  backfillLegacyAuditCreatedAt,
  type AuditActor,
} from '../../lib/auditLog';
import { formatCountBn, groupAuditLogsByDhakaDay } from '../../lib/auditDate';
import type { AuditSheetFilters } from '../../lib/auditQueryBuilder';
import type { AuditLogUserOption } from '../../hooks/useAuditFilters';
import { useConfirm } from '../../contexts/ConfirmationContext';
import { AuditFilterBar } from './AuditFilterBar';
import { AuditFilterSheet } from './AuditFilterSheet';
import { AuditLogRow } from './AuditLogRow';
import { AuditDetailSheet } from './AuditDetailSheet';

interface AuditLogListProps {
  logs: ActivityLog[];
  loadingLogs: boolean;
  loadingMoreLogs: boolean;
  hasMoreLogs: boolean;
  logsError: string | null;
  legacyFixCount?: number;
  searchInput: string;
  selectedModule: string;
  activeSheetFilterCount: number;
  activeSheetSummaryText: string;
  hasAnyActiveFilter: boolean;
  sheetOpen: boolean;
  draftFilters: AuditSheetFilters;
  availableUsers: AuditLogUserOption[];
  customRangeError: string | null;
  pendingCount: number | null;
  pendingCountCapped: boolean;
  loadingPendingCount: boolean;
  isAdmin: boolean;
  actor?: AuditActor;
  onSearchChange: (value: string) => void;
  onSelectModule: (moduleKey: string) => void;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  onChangeDraft: React.Dispatch<React.SetStateAction<AuditSheetFilters>>;
  onResetDraft: () => void;
  onApplyDraft: () => void;
  onClearAllFilters: () => void;
  onRefreshLogs: () => Promise<void>;
  onLoadMore: () => Promise<void>;
  onActionSuccess?: (message: string) => Promise<void> | void;
  onNavigateToData?: () => void;
}

export const AuditLogList: React.FC<AuditLogListProps> = ({
  logs,
  loadingLogs,
  loadingMoreLogs,
  hasMoreLogs,
  logsError,
  legacyFixCount = 0,
  searchInput,
  selectedModule,
  activeSheetFilterCount,
  activeSheetSummaryText,
  hasAnyActiveFilter,
  sheetOpen,
  draftFilters,
  availableUsers,
  customRangeError,
  pendingCount,
  pendingCountCapped,
  loadingPendingCount,
  isAdmin,
  actor,
  onSearchChange,
  onSelectModule,
  onOpenSheet,
  onCloseSheet,
  onChangeDraft,
  onResetDraft,
  onApplyDraft,
  onClearAllFilters,
  onRefreshLogs,
  onLoadMore,
  onActionSuccess,
  onNavigateToData,
}) => {
  const { confirm, showAlert } = useConfirm();
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [fixingLegacy, setFixingLegacy] = useState(false);
  const rowTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const filterBarContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rootEl = rootRef.current;
    const filterEl = filterBarContainerRef.current;
    if (!rootEl || !filterEl) return;

    const updateOffset = () => {
      // Top navbar is h-16 (64px)
      const topPx = 64 + Math.ceil(filterEl.getBoundingClientRect().height);
      rootEl.style.setProperty('--audit-sticky-top', `${topPx}px`);
    };

    updateOffset();

    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(updateOffset);
      ro.observe(filterEl);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  const handleSelectLog = (log: ActivityLog, triggerEl: HTMLButtonElement) => {
    rowTriggerRef.current = triggerEl;
    setSelectedLog(log);
  };

  const handleFixLegacyLogs = async () => {
    if (!isAdmin || fixingLegacy) return;
    const ok = await confirm({
      title: 'পুরনো লগ ঠিক করুন',
      message: `${formatCountBn(legacyFixCount)} পুরনো অডিট লগের পুরনো সময় createdAt ফিল্ডে কপি করা হবে। কোনো তথ্য মুছে ফেলা হবে না। আপনি কি এগিয়ে যেতে চান?`,
      confirmText: 'হ্যাঁ, ঠিক করুন',
      cancelText: 'বাতিল',
      variant: 'warning',
    });
    if (!ok) return;

    setFixingLegacy(true);
    try {
      const res = await backfillLegacyAuditCreatedAt();
      await onRefreshLogs();
      const msg = `${formatCountBn(res.updatedCount)} পুরনো লগ সফলভাবে হালনাগাদ করা হয়েছে।`;
      if (onActionSuccess) {
        await onActionSuccess(msg);
      } else {
        await showAlert({ title: 'সম্পন্ন', message: msg, variant: 'success' });
      }
    } catch (err: any) {
      await showAlert({
        title: 'ত্রুটি',
        message: err?.message || 'পুরনো লগ ঠিক করতে সমস্যা হয়েছে।',
        variant: 'danger',
      });
    } finally {
      setFixingLegacy(false);
    }
  };

  const activeLog = selectedLog
    ? logs.find((l) => l.id === selectedLog.id) || selectedLog
    : null;

  const groupedDays = useMemo(() => groupAuditLogsByDhakaDay(logs), [logs]);

  return (
    <div ref={rootRef} className="space-y-4">
      {/* Compact Closed Filter Bar (sticky below 64px top navbar) */}
      <div
        ref={filterBarContainerRef}
        className="sticky top-16 z-20 bg-theme-bg pt-1 pb-2 -mx-1 px-1"
      >
        <AuditFilterBar
          searchInput={searchInput}
          onSearchChange={onSearchChange}
          selectedModule={selectedModule}
          onSelectModule={onSelectModule}
          activeSheetFilterCount={activeSheetFilterCount}
          activeSheetSummaryText={activeSheetSummaryText}
          resultCount={logs.length}
          hasMoreLogs={hasMoreLogs}
          loadingLogs={loadingLogs}
          hasAnyActiveFilter={hasAnyActiveFilter}
          onOpenSheet={onOpenSheet}
          onRefresh={onRefreshLogs}
          onClearAll={onClearAllFilters}
          filterButtonRef={filterButtonRef}
        />
      </div>

      {/* One-time admin-only migration action for legacy entries missing valid createdAt */}
      {isAdmin && legacyFixCount > 0 && !loadingLogs && (
        <div className="rounded-[12px] border border-theme-border bg-theme-surface px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <span className="text-theme-text-secondary">
            {formatCountBn(legacyFixCount)} পুরনো লগে সার্ভার টাইমস্ট্যাম্প (createdAt) অনুপস্থিত।
          </span>
          <button
            type="button"
            disabled={fixingLegacy}
            onClick={handleFixLegacyLogs}
            className="min-h-[38px] px-3 py-1.5 rounded-[10px] border border-theme-primary bg-theme-primary-soft hover:bg-theme-primary text-theme-primary hover:text-theme-primary-fg font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <Wrench size={14} aria-hidden="true" />
            <span>{fixingLegacy ? 'ঠিক করা হচ্ছে...' : 'পুরনো লগ ঠিক করুন'}</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {loadingLogs ? (
        <div
          aria-busy="true"
          aria-label="অডিট লগ লোড হচ্ছে"
          className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border"
        >
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="p-4 space-y-2.5 animate-pulse motion-reduce:animate-none">
              <div className="h-4 w-3/4 rounded bg-theme-surface-subtle" />
              <div className="h-3 w-1/3 rounded bg-theme-surface-subtle" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 rounded-full bg-theme-surface-subtle" />
                <div className="h-5 w-16 rounded-full bg-theme-surface-subtle" />
              </div>
              <div className="h-3 w-28 rounded bg-theme-surface-subtle" />
            </div>
          ))}
        </div>
      ) : logsError && logs.length === 0 ? (
        /* Error State with Retry */
        <div
          role="alert"
          className="rounded-[14px] border border-theme-danger-border bg-theme-surface p-6 text-center space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-theme-danger-soft text-theme-danger border border-theme-danger-border flex items-center justify-center mx-auto">
            <AlertCircle size={20} />
          </div>
          <p className="text-sm font-medium text-theme-text-primary">{logsError}</p>
          <button
            type="button"
            onClick={onRefreshLogs}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs sm:text-sm font-semibold text-theme-text-primary inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <RefreshCw size={15} />
            <span>আবার চেষ্টা করুন</span>
          </button>
        </div>
      ) : logs.length === 0 ? (
        /* Empty Result State */
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-8 text-center space-y-3">
          <p className="text-sm font-medium text-theme-text-secondary">
            কোনো এন্ট্রি পাওয়া যায়নি
          </p>
          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs sm:text-sm font-semibold text-theme-primary inline-flex items-center justify-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              ফিল্টার মুছুন
            </button>
          )}
        </div>
      ) : (
        /* Grouped by Asia/Dhaka Day Headings (sticky below filter bar) */
        <div className="space-y-4">
          {logsError && (
            <div
              role="alert"
              className="rounded-[12px] border border-theme-danger-border bg-theme-danger-soft px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-theme-danger"
            >
              <span>{logsError}</span>
              <button
                type="button"
                onClick={onLoadMore}
                className="font-semibold underline shrink-0 py-1 px-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary rounded"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          )}

          {groupedDays.map((group) => (
            <section key={group.key} aria-label={group.label} className="space-y-1.5">
              <h3 className="sticky top-[var(--audit-sticky-top,12.5rem)] z-10 bg-theme-bg/95 backdrop-blur-xs py-1.5 px-1 flex items-center gap-2 text-xs font-semibold text-theme-text-secondary">
                <span>{group.label}</span>
                <span className="text-[11px] font-medium text-theme-text-muted tabular-nums">
                  {formatCountBn(group.items.length)}
                </span>
              </h3>
              <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden">
                <ul className="divide-y divide-theme-border">
                  {group.items.map((log) => (
                    <AuditLogRow key={log.id} log={log} onSelect={handleSelectLog} />
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}

      {hasMoreLogs && !loadingLogs && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMoreLogs}
            className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs sm:text-sm font-semibold text-theme-text-primary inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {loadingMoreLogs && (
              <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" />
            )}
            <span>{loadingMoreLogs ? 'লোড হচ্ছে...' : 'আরও দেখুন'}</span>
          </button>
        </div>
      )}

      {/* Filter Draft Sheet */}
      <AuditFilterSheet
        open={sheetOpen}
        draft={draftFilters}
        onChangeDraft={onChangeDraft}
        availableUsers={availableUsers}
        customRangeError={customRangeError}
        pendingCount={pendingCount}
        pendingCountCapped={pendingCountCapped}
        loadingPendingCount={loadingPendingCount}
        onResetDraft={onResetDraft}
        onApply={onApplyDraft}
        onClose={onCloseSheet}
        triggerRef={filterButtonRef}
      />

      {/* Detail Inspection & Admin Undo/Restore Sheet */}
      <AuditDetailSheet
        log={activeLog}
        isAdmin={isAdmin}
        actor={actor}
        onClose={() => setSelectedLog(null)}
        onActionSuccess={onActionSuccess}
        onNavigateToData={onNavigateToData}
        triggerRef={rowTriggerRef}
      />
    </div>
  );
};
