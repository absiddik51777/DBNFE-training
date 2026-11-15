import React, { useEffect, useRef, useState } from 'react';
import { Bell, ShieldAlert, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { toBnDigits } from '../../lib/auditDate';
import type { ActivityLog } from '../../types';
import {
  formatNotificationTimeDhaka,
  getNotificationSubtitle,
} from './notificationHelpers';

interface NotificationBannerProps {
  onOpenNotifications: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  onOpenNotifications,
}) => {
  const { bannerVisible, bannerUnreadCount, dismissBanner } = useNotifications();

  if (!bannerVisible || bannerUnreadCount <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-theme-primary-soft/65 border-b border-theme-primary-border px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-[9px] bg-theme-primary text-theme-primary-fg flex items-center justify-center shrink-0">
          <Bell size={15} />
        </span>
        <p className="text-xs sm:text-sm font-medium text-theme-text-primary leading-snug truncate tabular-nums">
          আপনার {toBnDigits(bannerUnreadCount)} টি নতুন বিজ্ঞপ্তি আছে
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            dismissBanner();
            onOpenNotifications();
          }}
          className="min-h-[38px] px-3 py-1.5 rounded-[10px] bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
        >
          দেখুন
        </button>
        <button
          type="button"
          onClick={dismissBanner}
          aria-label="বিজ্ঞপ্তি ব্যানার বন্ধ করুন"
          className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center rounded-[10px] text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface/60 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

interface UrgentNotificationModalProps {
  onViewDetails: (log: ActivityLog) => void;
}

export const UrgentNotificationModal: React.FC<UrgentNotificationModalProps> = ({
  onViewDetails,
}) => {
  const { activeUrgentNotification, acknowledgeUrgentNotification } =
    useNotifications();
  const [acknowledging, setAcknowledging] = useState(false);
  const ackButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeUrgentNotification) {
      window.setTimeout(() => {
        ackButtonRef.current?.focus();
      }, 10);
    }
  }, [activeUrgentNotification?.id]);

  if (!activeUrgentNotification) return null;

  const title = activeUrgentNotification.title || activeUrgentNotification.action || 'নিরাপত্তা সতর্কতা';
  const subtitle = getNotificationSubtitle(activeUrgentNotification);
  const timeText = formatNotificationTimeDhaka(activeUrgentNotification);
  const actorName = activeUrgentNotification.user || activeUrgentNotification.userName || '';

  const handleAcknowledge = async () => {
    if (acknowledging) return;
    setAcknowledging(true);
    try {
      await acknowledgeUrgentNotification(activeUrgentNotification.id);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleInspect = async () => {
    const target = activeUrgentNotification;
    await handleAcknowledge();
    onViewDetails(target);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px] motion-reduce:transition-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="urgent-notif-title"
      aria-describedby="urgent-notif-desc"
    >
      <div className="w-full max-w-md rounded-[14px] border border-theme-danger-border bg-theme-elevated overflow-hidden">
        <header className="px-5 py-3.5 bg-theme-danger-soft border-b border-theme-danger-border flex items-center gap-3">
          <span className="w-9 h-9 rounded-[10px] bg-theme-danger text-theme-danger-fg flex items-center justify-center shrink-0">
            <ShieldAlert size={19} />
          </span>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-theme-danger block leading-none">
              জরুরি নিরাপত্তা সতর্কতা
            </span>
            <h2
              id="urgent-notif-title"
              className="text-sm sm:text-base font-medium text-theme-text-primary leading-snug mt-1 break-words"
            >
              {title}
            </h2>
          </div>
        </header>

        <div id="urgent-notif-desc" className="p-5 space-y-3">
          {subtitle && (
            <p className="text-xs sm:text-sm text-theme-text-secondary leading-relaxed break-words">
              {subtitle}
            </p>
          )}

          <div className="rounded-[12px] border border-theme-border bg-theme-surface p-3 text-xs space-y-1">
            {actorName && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-theme-text-muted">ব্যবহারকারী</span>
                <span className="font-medium text-theme-text-primary">{actorName}</span>
              </div>
            )}
            {timeText && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-theme-text-muted">সময়</span>
                <span className="font-medium text-theme-text-primary tabular-nums">{timeText}</span>
              </div>
            )}
          </div>
        </div>

        <footer className="px-5 py-3.5 border-t border-theme-border bg-theme-surface flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleInspect()}
            disabled={acknowledging}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-sm font-medium text-theme-text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary disabled:opacity-50 cursor-pointer"
          >
            বিস্তারিত দেখুন
          </button>
          <button
            ref={ackButtonRef}
            type="button"
            onClick={() => void handleAcknowledge()}
            disabled={acknowledging}
            className="min-h-[44px] px-5 py-2 rounded-[12px] bg-theme-danger hover:opacity-90 text-sm font-medium text-theme-danger-fg transition-opacity focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-danger disabled:opacity-50 cursor-pointer"
          >
            {acknowledging ? 'সংরক্ষণ হচ্ছে...' : 'বুঝেছি'}
          </button>
        </footer>
      </div>
    </div>
  );
};
