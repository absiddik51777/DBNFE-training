import React, { useEffect, useRef } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw, X } from 'lucide-react';

interface ConfirmActionDialogProps {
  open: boolean;
  mode: 'undo' | 'restore';
  title: string;
  summaryLines: string[];
  warningNote?: string;
  confirmLabel: string;
  isProcessing: boolean;
  errorMessage?: string | null;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  open,
  mode,
  title,
  summaryLines,
  warningNote,
  confirmLabel,
  isProcessing,
  errorMessage,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!isProcessing) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !isProcessing) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[16px] border border-theme-border bg-theme-elevated text-theme-text-primary p-0 backdrop:bg-black/55 motion-reduce:transition-none"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[12px] border border-theme-primary/25 bg-theme-primary-soft text-theme-primary flex items-center justify-center shrink-0">
              <RotateCcw size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-theme-text-primary leading-snug">
                {title}
              </h3>
              <p className="text-xs text-theme-text-secondary mt-0.5">
                {mode === 'undo'
                  ? 'নিচের ক্ষেত্রগুলো পূর্বের অবস্থায় ফিরিয়ে নেওয়া হবে:'
                  : 'নিচের মুছে ফেলা তথ্য পুনরুদ্ধার করা হবে:'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            aria-label="বাতিল করুন"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-[12px] text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Exact list of fields or records affected */}
        {summaryLines.length > 0 && (
          <div className="rounded-[12px] border border-theme-border bg-theme-surface p-3 max-h-48 overflow-y-auto space-y-1.5">
            {summaryLines.map((line, idx) => (
              <div
                key={idx}
                className="text-xs text-theme-text-primary leading-relaxed flex items-start gap-2"
              >
                <span className="text-theme-primary font-bold">•</span>
                <span className="break-words min-w-0 flex-1">{line}</span>
              </div>
            ))}
          </div>
        )}

        {warningNote && (
          <p className="text-xs text-theme-text-secondary leading-relaxed">
            {warningNote}
          </p>
        )}

        {/* Conflict / error message */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-[12px] border border-theme-danger-border bg-theme-danger-soft px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-theme-danger"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="whitespace-pre-line leading-relaxed break-words min-w-0 flex-1 font-medium">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs sm:text-sm font-semibold text-theme-text-primary disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            বাতিল
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onConfirm}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-primary bg-theme-primary hover:bg-theme-primary-hover text-xs sm:text-sm font-semibold text-theme-primary-fg inline-flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {isProcessing ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <RotateCcw size={15} />
            )}
            <span>{isProcessing ? 'প্রক্রিয়াকরণ হচ্ছে...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};
