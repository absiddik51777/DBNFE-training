import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

interface NotificationBellProps {
  isOpen: boolean;
  onToggle: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  isOpen,
  onToggle,
  buttonRef,
}) => {
  const { unreadCount } = useNotifications();
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={
        unreadCount > 0 ? `বিজ্ঞপ্তি (${unreadCount} টি অপঠিত)` : 'বিজ্ঞপ্তি'
      }
      title="বিজ্ঞপ্তি"
      className={`relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none ${
        isOpen
          ? 'bg-theme-primary-soft text-theme-primary border-theme-primary-border'
          : 'bg-transparent text-theme-text-secondary border-transparent hover:text-theme-primary hover:bg-theme-surface-hover hover:border-theme-border'
      }`}
    >
      <Bell size={19} />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-theme-danger text-theme-danger-fg text-[10px] leading-none font-medium tabular-nums flex items-center justify-center border border-theme-nav"
        >
          {badgeLabel}
        </span>
      )}
    </button>
  );
};
