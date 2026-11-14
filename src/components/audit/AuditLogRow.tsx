import React from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import type { ActivityLog } from '../../types';
import {
  formatDhakaTime12h,
  getActionLabelBn,
  getLogDate,
  getModuleLabelBn,
  hasLogDetails,
  isStructuredAuditLog,
} from './auditFormatters';

interface AuditLogRowProps {
  log: ActivityLog;
  onSelect?: (log: ActivityLog, triggerEl: HTMLButtonElement) => void;
}

export const AuditLogRow: React.FC<AuditLogRowProps> = ({ log, onSelect }) => {
  const interactive = hasLogDetails(log);
  const structured = isStructuredAuditLog(log);
  const titleText = log.title || log.action || 'কার্যক্রম';
  const actorName = log.user || log.userName || 'অজানা';
  const moduleLabel = getModuleLabelBn(log.module);
  const actionLabel = structured ? getActionLabelBn(log.action) : '';
  const logDate = getLogDate(log);
  const formattedTime = formatDhakaTime12h(logDate);
  const changeCount = Array.isArray(log.changes) ? log.changes.length : 0;
  const hasGrantedLocation = log.location?.status === 'granted';

  const content = (
    <div className="flex items-start justify-between gap-3 w-full text-left">
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Line 1: Title + optional reverted badge */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-theme-text-primary leading-snug break-words">
            {titleText}
          </p>
          {log.reverted && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-theme-success-soft text-theme-success border border-theme-success-border">
              ফেরত নেওয়া
            </span>
          )}
          {log.settled && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/10 dark:bg-emerald-400/10 text-theme-text-secondary border border-theme-border-strong">
              নিষ্পন্ন
            </span>
          )}
        </div>

        {/* Line 2: User + right-aligned 12h Dhaka time */}
        <div className="flex items-center justify-between gap-2 text-xs text-theme-text-secondary">
          <p className="min-w-0 truncate">
            ব্যবহারকারী:{' '}
            <span className="font-medium text-theme-text-primary">{actorName}</span>
          </p>
          {(formattedTime || hasGrantedLocation) && (
            <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-theme-text-muted">
              {hasGrantedLocation && (
                <span
                  title="অবস্থান সংরক্ষিত"
                  className="inline-flex items-center text-theme-primary"
                >
                  <MapPin size={12} aria-hidden="true" />
                  <span className="sr-only">অবস্থান সংরক্ষিত</span>
                </span>
              )}
              {formattedTime && (
                <time
                  dateTime={logDate ? logDate.toISOString() : undefined}
                  className="font-mono tabular-nums"
                >
                  {formattedTime}
                </time>
              )}
            </div>
          )}
        </div>

        {/* Line 3: Module chip + action / diff summary */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-theme-surface-subtle text-theme-text-secondary border border-theme-border">
            {moduleLabel}
          </span>
          {actionLabel && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-theme-primary-soft text-theme-primary border border-theme-primary/20">
              {actionLabel}
            </span>
          )}
          {changeCount > 0 && (
            <span className="text-[11px] text-theme-text-muted tabular-nums">
              · {changeCount} টি পরিবর্তন
            </span>
          )}
          {log.action === 'bulk_delete' && typeof log.count === 'number' && (
            <span className="text-[11px] text-theme-text-muted tabular-nums">
              · মোট {log.count} টি
            </span>
          )}
        </div>
      </div>

      {interactive && (
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="text-theme-text-muted shrink-0 mt-1"
        />
      )}
    </div>
  );

  if (!interactive) {
    return (
      <li className="p-4">
        <div>{content}</div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={(e) => onSelect?.(log, e.currentTarget)}
        className="w-full min-h-[44px] p-4 text-left hover:bg-theme-surface-hover transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary motion-reduce:transition-none"
      >
        {content}
      </button>
    </li>
  );
};
