import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { ActivityLog } from '../../types';
import type { AuditActor } from '../../lib/auditLog';
import type { AuditSheetFilters } from '../../lib/auditQueryBuilder';
import type { AuditLogUserOption } from '../../hooks/useAuditFilters';
import { extractTimestampMs } from './auditFormatters';
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

interface DayGroup {
  key: string;
  label: string;
  items: ActivityLog[];
}

function getLocalDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayHeadingLabel(ms: number | null): string {
  if (!ms) return 'অন্যান্য';
  const now = new Date();
  const todayKey = getLocalDayKey(now.getTime());
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = getLocalDayKey(yest.getTime());
  const itemKey = getLocalDayKey(ms);

  if (itemKey === todayKey) return 'আজ';
  if (itemKey === yesterdayKey) return 'গতকাল';

  try {
    return new Intl.DateTimeFormat('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(ms));
  } catch {
    return format(ms, 'dd/MM/yyyy');
  }
}

export const AuditLogList: React.FC<AuditLogListProps> = ({
  logs,
  loadingLogs,
  loadingMoreLogs,
  hasMoreLogs,
  logsError,
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
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const rowTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSelectLog = (log: ActivityLog, triggerEl: HTMLButtonElement) => {
    rowTriggerRef.current = triggerEl;
    setSelectedLog(log);
  };

  const activeLog = selectedLog
    ? logs.find((l) => l.id === selectedLog.id) || selectedLog
    : null;

  const groupedDays: DayGroup[] = useMemo(() => {
    const groups: DayGroup[] = [];
    const byKey = new Map<string, DayGroup>();

    for (const log of logs) {
      const ms = extractTimestampMs(log.createdAt ?? log.timestamp);
      const key = ms ? getLocalDayKey(ms) : 'unknown';
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          label: formatDayHeadingLabel(ms),
          items: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(log);
    }

    return groups;
  }, [logs]);

  return (
    <div className="space-y-4">
      {/* Compact Closed Filter Bar */}
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
        /* Grouped by Day Headings without altering AuditLogRow design */
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
              <h3 className="text-xs font-semibold text-theme-text-secondary px-1">
                {group.label}
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
