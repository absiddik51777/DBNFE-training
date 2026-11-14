import React, { useId } from 'react';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import type { ActivityLog } from '../../../types';

interface AuditLogsSectionProps {
  logs: ActivityLog[];
  loadingLogs: boolean;
  loadingMoreLogs: boolean;
  hasMoreLogs: boolean;
  moduleFilter: string;
  availableModules: string[];
  onChangeModuleFilter: (module: string) => void;
  onRefreshLogs: () => Promise<void>;
  onLoadMore: () => Promise<void>;
}

export const AuditLogsSection: React.FC<AuditLogsSectionProps> = ({
  logs,
  loadingLogs,
  loadingMoreLogs,
  hasMoreLogs,
  moduleFilter,
  availableModules,
  onChangeModuleFilter,
  onRefreshLogs,
  onLoadMore,
}) => {
  const filterId = useId();

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
                {mod}
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
              : `${moduleFilter} মডিউলে কোনো লগ পাওয়া যায়নি।`}
          </div>
        ) : (
          <ul className="divide-y divide-theme-border">
            {logs.map((log) => {
              let formattedDate = '';
              try {
                formattedDate = log.timestamp
                  ? format(log.timestamp, 'dd/MM/yyyy, hh:mm a')
                  : '';
              } catch {
                formattedDate = '';
              }

              return (
                <li key={log.id} className="p-4 space-y-1.5">
                  {/* Line 1: Action Title */}
                  <p className="text-sm font-semibold text-theme-text-primary leading-snug">
                    {log.action}
                  </p>

                  {/* Line 2: User */}
                  <p className="text-xs text-theme-text-secondary">
                    ব্যবহারকারী:{' '}
                    <span className="font-medium text-theme-text-primary">
                      {log.userName || 'অজানা'}
                    </span>
                  </p>

                  {/* Line 3: Module Chip */}
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-theme-surface-subtle text-theme-text-secondary border border-theme-border">
                      {log.module || 'System'}
                    </span>
                  </div>

                  {/* Line 4: Date on its own separate line */}
                  {formattedDate && (
                    <time
                      dateTime={
                        log.timestamp ? new Date(log.timestamp).toISOString() : undefined
                      }
                      className="block text-[11px] text-theme-text-muted font-mono tabular-nums"
                    >
                      {formattedDate}
                    </time>
                  )}
                </li>
              );
            })}
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
    </div>
  );
};
