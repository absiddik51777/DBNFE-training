import React, { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';

interface ConfirmClearDialogProps {
  open: boolean;
  clearing?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmClearDialog: React.FC<ConfirmClearDialogProps> = ({
  open,
  clearing = false,
  onConfirm,
  onClose,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !clearing) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, clearing, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px] motion-reduce:transition-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="clear-notifications-title"
      aria-describedby="clear-notifications-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !clearing) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-[14px] border border-theme-border bg-theme-elevated p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-[10px] border border-theme-danger-border bg-theme-danger-soft text-theme-danger flex items-center justify-center shrink-0">
              <Trash2 size={17} />
            </span>
            <h2
              id="clear-notifications-title"
              className="text-base font-medium text-theme-text-primary leading-snug"
            >
              সব বিজ্ঞপ্তি মুছবেন?
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={clearing}
            aria-label="বন্ধ করুন"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-[12px] text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p
          id="clear-notifications-desc"
          className="text-xs sm:text-sm text-theme-text-secondary leading-relaxed"
        >
          এটি শুধুমাত্র আপনার বিজ্ঞপ্তি তালিকা থেকে বর্তমান বিজ্ঞপ্তিগুলো সরিয়ে দেবে। মূল অডিট লগের কোনো তথ্য মুছে যাবে না।
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={clearing}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-sm font-medium text-theme-text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary disabled:opacity-50 cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={clearing}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-danger bg-theme-danger hover:opacity-90 text-sm font-medium text-theme-danger-fg transition-opacity focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-danger disabled:opacity-50 cursor-pointer"
          >
            {clearing ? 'মুছে ফেলা হচ্ছে...' : 'সব মুছুন'}
          </button>
        </div>
      </div>
    </div>
  );
};
