import React, { useId, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ActivityLog } from '../../types';
import type { AuditActor } from '../../lib/auditLog';
import { getModuleLabelBn } from './auditFormatters';
import { AuditLogRow } from './AuditLogRow';
import { AuditDetailSheet } from './AuditDetailSheet';

interface AuditLogListProps {
  logs: ActivityLog[];
  loadingLogs: boolean;
  loadingMoreLogs: boolean;
  hasMoreLogs: boolean;
  moduleFilter: string;
  availableModules: string[];
  isAdmin: boolean;
  actor?: AuditActor;
  onChangeModuleFilter: (module: string) => void;
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
  moduleFilter,
  availableModules,
  isAdmin,
  actor,
  onChangeModuleFilter,
  onRefreshLogs,
  onLoadMore,
  onActionSuccess,
  onNavigateToData,
}) => {
  const filterId = useId();
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleSelectLog = (log: ActivityLog, triggerEl: HTMLButtonElement) => {
    triggerRef.current = triggerEl;
    setSelectedLog(log);
  };

  const activeLog = selectedLog
    ? logs.find((l) => l.id === selectedLog.id) || selectedLog
    : null;

  return (
    <div className="space-y-4">
      {/* Module filter & Refresh bar */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor={filterId}
            className="block text-[11px] font-semibold text-theme-text-secondary mb-1"
          >
            মডিউল অনুযায়ী ফিল্টার
          </label>
          <select
            id={filterId}
            value={moduleFilter}
            onChange={(e) => onChangeModuleFilter(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-hidden focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
          >
            <option value="ALL">সব মডিউল</option>
            {availableModules.map((mod) => (
              <option key={mod} value={mod}>
                {getModuleLabelBn(mod)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onRefreshLogs}
          disabled={loadingLogs}
          className="min-h-[44px] px-4 py-2 sm:mt-5 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs font-semibold text-theme-text-primary inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
        >
          <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
          <span>রিফ্রেশ</span>
        </button>
      </div>

      {/* Logs List */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden">
        {loadingLogs ? (
          <div className="p-8 text-center text-xs text-theme-text-muted">
            অডিট লগ লোড হচ্ছে...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-theme-text-muted">
            {moduleFilter === 'ALL'
              ? 'এখনো কোনো অডিট লগ জমা হয়নি।'
              : `${getModuleLabelBn(moduleFilter)} মডিউলে কোনো লগ পাওয়া যায়নি।`}
          </div>
        ) : (
          <ul className="divide-y divide-theme-border">
            {logs.map((log) => (
              <AuditLogRow key={log.id} log={log} onSelect={handleSelectLog} />
            ))}
          </ul>
        )}
      </div>

      {hasMoreLogs && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMoreLogs}
            className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs sm:text-sm font-semibold text-theme-text-primary inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {loadingMoreLogs && <RefreshCw size={14} className="animate-spin" />}
            <span>{loadingMoreLogs ? 'লোড হচ্ছে...' : 'আরও দেখুন'}</span>
          </button>
        </div>
      )}

      {/* Detail Inspection & Admin Undo/Restore Sheet */}
      <AuditDetailSheet
        log={activeLog}
        isAdmin={isAdmin}
        actor={actor}
        onClose={() => setSelectedLog(null)}
        onActionSuccess={onActionSuccess}
        onNavigateToData={onNavigateToData}
        triggerRef={triggerRef}
      />
    </div>
  );
};
