import React from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  RotateCcw,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { getModuleLabelBn } from '../audit/auditFormatters';
import type { ActivityLog } from '../../types';
import {
  formatNotificationTimeDhaka,
  getNotificationSubtitle,
  getNotificationVisualType,
  NotificationIconTone,
} from './notificationHelpers';

interface NotificationItemProps {
  log: ActivityLog;
  isUnread: boolean;
  onSelect: (log: ActivityLog) => void;
  showModuleChip?: boolean;
}

const TONE_CLASSES: Record<NotificationIconTone, string> = {
  danger: 'bg-theme-danger-soft text-theme-danger border-theme-danger-border',
  warning: 'bg-theme-warning-soft text-theme-warning border-theme-warning-border',
  success: 'bg-theme-success-soft text-theme-success border-theme-success-border',
  primary: 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border',
  info: 'bg-theme-info-soft text-theme-info border-theme-info-border',
  neutral: 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border',
};

function renderNotificationIcon(kind: ReturnType<typeof getNotificationVisualType>['kind']) {
  switch (kind) {
    case 'security':
      return <ShieldAlert size={17} />;
    case 'undo_restore':
      return <RotateCcw size={17} />;
    case 'delete':
      return <Trash2 size={17} />;
    case 'settle':
      return <CheckCircle2 size={17} />;
    case 'attendance':
      return <CalendarCheck size={17} />;
    case 'trainees':
      return <Users size={17} />;
    case 'settings':
      return <Settings size={17} />;
    default:
      return <Bell size={17} />;
  }
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  log,
  isUnread,
  onSelect,
  showModuleChip = false,
}) => {
  const { kind, tone } = getNotificationVisualType(log);
  const title = log.title || log.action || 'সিস্টেম আপডেট';
  const subtitle = getNotificationSubtitle(log);
  const timeText = formatNotificationTimeDhaka(log);
  const moduleLabel = getModuleLabelBn(log.module);

  return (
    <button
      type="button"
      onClick={() => onSelect(log)}
      className={`w-full min-h-[56px] px-3.5 py-3 flex items-start gap-3 text-left border-l-[3px] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary motion-reduce:transition-none ${
        isUnread
          ? 'border-l-theme-primary bg-theme-primary-soft/25 hover:bg-theme-primary-soft/40'
          : 'border-l-transparent bg-theme-surface hover:bg-theme-surface-hover'
      }`}
    >
      <span
        className={`w-[34px] h-[34px] rounded-[10px] border flex items-center justify-center shrink-0 mt-0.5 ${TONE_CLASSES[tone]}`}
        aria-hidden="true"
      >
        {renderNotificationIcon(kind)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-theme-text-primary leading-snug line-clamp-2 break-words">
          {title}
        </p>

        {subtitle && (
          <p className="text-xs text-theme-text-secondary leading-snug truncate mt-0.5">
            {subtitle}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-1">
          {showModuleChip && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] border border-theme-border bg-theme-surface-subtle text-[11px] font-medium text-theme-text-secondary leading-none">
              {moduleLabel}
            </span>
          )}
          {timeText && (
            <span className="text-[11px] text-theme-text-muted tabular-nums leading-snug">
              {timeText}
            </span>
          )}
        </div>
      </div>

      {isUnread && (
        <span
          className="w-2 h-2 rounded-full bg-theme-primary shrink-0 mt-2"
          aria-label="অপঠিত"
        />
      )}
    </button>
  );
};
