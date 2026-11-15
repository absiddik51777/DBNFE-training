import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import type { ActivityLog } from '../../types';
import { NotificationItem } from './NotificationItem';
import { ConfirmClearDialog } from './ConfirmClearDialog';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNotification: (log: ActivityLog) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onSelectNotification,
  triggerRef,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    dropdownItems,
    unreadCount,
    unreadIds,
    loading,
    markAllSeen,
    scheduleAutoMarkSeen,
    cancelAutoMarkSeen,
    clearAllNotifications,
  } = useNotifications();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef<boolean>(false);
  const lastPathRef = useRef<string>(location.pathname + location.search);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [anchorPos, setAnchorPos] = useState<{
    top: number;
    desktopRight: number;
    mobileCaretRight: number;
    desktopCaretRight: number;
  }>({
    top: 68,
    desktopRight: 24,
    mobileCaretRight: 52,
    desktopCaretRight: 16,
  });

  // Measure bell button position so panel & caret align directly beneath it
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const btn = triggerRef.current;
      if (!btn || typeof window === 'undefined') return;
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const bellCenter = rect.left + rect.width / 2;
      const desktopRight = Math.max(16, Math.round(vw - rect.right));
      const mobilePanelRight = vw - 12;
      const mobileCaretRight = Math.max(16, Math.min(vw - 44, Math.round(mobilePanelRight - bellCenter - 6)));
      const desktopCaretRight = Math.max(14, Math.round(rect.width / 2 - 6));

      setAnchorPos({
        top: Math.round(rect.bottom + 8),
        desktopRight,
        mobileCaretRight,
        desktopCaretRight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen, triggerRef]);

  // Schedule 1s auto-mark-seen when opened, cancel on early close
  useEffect(() => {
    if (isOpen) {
      if (unreadCount > 0) {
        scheduleAutoMarkSeen(1000);
      }
      return () => {
        cancelAutoMarkSeen();
      };
    } else {
      cancelAutoMarkSeen();
    }
  }, [isOpen, unreadCount, scheduleAutoMarkSeen, cancelAutoMarkSeen]);

  // Focus management: focus inside panel when opening, return focus to bell when closing
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      window.setTimeout(() => {
        firstActionRef.current?.focus();
      }, 10);
    } else if (!isOpen && prevOpenRef.current) {
      setConfirmClearOpen(false);
      const btn = triggerRef.current;
      if (btn && typeof btn.focus === 'function') {
        window.setTimeout(() => btn.focus(), 10);
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, triggerRef]);

  // Close on route change
  useEffect(() => {
    const current = location.pathname + location.search;
    if (current !== lastPathRef.current) {
      lastPathRef.current = current;
      if (isOpen) {
        onClose();
      }
    }
  }, [location.pathname, location.search, isOpen, onClose]);

  // Keyboard Escape & Tab trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmClearOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !panelRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !panelRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmClearOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Dim scrim behind dropdown */}
      <div
        className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px] motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => {
          if (!confirmClearOpen) onClose();
        }}
      />

      {/* Dropdown Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label="বিজ্ঞপ্তি"
        style={
          {
            top: `${anchorPos.top}px`,
            '--notif-desktop-right': `${anchorPos.desktopRight}px`,
          } as React.CSSProperties
        }
        className="fixed left-3 right-3 md:left-auto md:right-[var(--notif-desktop-right)] md:w-[380px] z-[60] max-h-[60vh] md:max-h-[70vh] flex flex-col rounded-[14px] border border-theme-border bg-theme-elevated shadow-md motion-reduce:transition-none"
      >
        {/* Caret pointer */}
        <span
          aria-hidden="true"
          style={{ right: `${anchorPos.mobileCaretRight}px` }}
          className="md:hidden absolute -top-[7px] w-3 h-3 rotate-45 bg-theme-surface border-t border-l border-theme-border"
        />
        <span
          aria-hidden="true"
          style={{ right: `${anchorPos.desktopCaretRight}px` }}
          className="hidden md:block absolute -top-[7px] w-3 h-3 rotate-45 bg-theme-surface border-t border-l border-theme-border"
        />

        {/* Header */}
        <header className="relative z-10 px-4 py-2.5 rounded-t-[14px] border-b border-theme-border bg-theme-surface flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm sm:text-base font-medium text-theme-text-primary leading-snug">
              বিজ্ঞপ্তি
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-[8px] bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border text-[11px] font-medium tabular-nums">
                {unreadCount} নতুন
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              ref={firstActionRef}
              type="button"
              onClick={() => void markAllSeen()}
              disabled={unreadCount === 0}
              className="min-h-[38px] px-2.5 py-1.5 rounded-[10px] text-xs font-medium text-theme-primary hover:bg-theme-primary-soft/50 inline-flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
            >
              <CheckCheck size={14} />
              <span>সব পঠিত করুন</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              disabled={dropdownItems.length === 0}
              className="min-h-[38px] px-2.5 py-1.5 rounded-[10px] text-xs font-medium text-theme-text-secondary hover:text-theme-danger hover:bg-theme-danger-soft/50 inline-flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
            >
              <Trash2 size={14} />
              <span>সব মুছুন</span>
            </button>
          </div>
        </header>

        {/* Scrollable Body (latest 10 items) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-theme-border">
          {loading && dropdownItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-theme-text-secondary">
              বিজ্ঞপ্তি লোড হচ্ছে...
            </div>
          ) : dropdownItems.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-[12px] border border-theme-border bg-theme-surface-subtle text-theme-text-muted flex items-center justify-center mx-auto">
                <BellOff size={18} />
              </div>
              <p className="text-sm font-medium text-theme-text-secondary">
                কোনো বিজ্ঞপ্তি নেই
              </p>
            </div>
          ) : (
            dropdownItems.map((item) => (
              <NotificationItem
                key={item.id}
                log={item}
                isUnread={unreadIds.has(item.id)}
                onSelect={(selected) => {
                  onClose();
                  onSelectNotification(selected);
                }}
              />
            ))
          )}
        </div>

        {/* Sticky Footer */}
        <footer className="px-3 py-2 rounded-b-[14px] border-t border-theme-border bg-theme-surface shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/notifications');
            }}
            className="w-full min-h-[44px] px-4 py-2 rounded-[10px] text-sm font-medium text-theme-primary hover:bg-theme-primary-soft/45 transition-colors flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
          >
            সব বিজ্ঞপ্তি দেখুন
          </button>
        </footer>
      </div>

      <ConfirmClearDialog
        open={confirmClearOpen}
        clearing={clearing}
        onConfirm={handleConfirmClear}
        onClose={() => setConfirmClearOpen(false)}
      />
    </>
  );
};
