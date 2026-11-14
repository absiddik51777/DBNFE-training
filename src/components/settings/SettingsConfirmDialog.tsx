import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface SettingsConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  impactDetail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  requireKeyword?: 'DELETE' | 'RESET';
  tone?: 'danger' | 'warning';
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  children?: React.ReactNode;
}

export const SettingsConfirmDialog: React.FC<SettingsConfirmDialogProps> = ({
  open,
  title,
  description,
  impactDetail,
  confirmLabel,
  cancelLabel = 'বাতিল করুন',
  requireKeyword,
  tone = 'danger',
  isProcessing = false,
  onConfirm,
  onClose,
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [typedText, setTypedText] = useState('');
  const titleId = useId();
  const descId = useId();
  const inputId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setTypedText('');
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Fallback if browser environment already considers dialog open
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const keywordMatched = !requireKeyword || typedText.trim() === requireKeyword;

  const handleNativeCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (!isProcessing) {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && !isProcessing) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywordMatched || isProcessing) return;
    await onConfirm();
  };

  const isDanger = tone === 'danger';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={handleNativeCancel}
      onClick={handleBackdropClick}
      className="settings-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-[14px] border border-theme-border bg-theme-elevated p-0 text-theme-text-primary shadow-none"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                  : 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-theme-text-primary leading-snug">
                {title}
              </h2>
              <p className="text-xs text-theme-text-secondary mt-0.5">
                {isDanger ? 'এই কাজটি স্থায়ী এবং বাতিল করা যাবে না' : 'নিশ্চিত হয়ে এগিয়ে যান'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="ডায়ালগ বন্ধ করুন"
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 inline-flex items-center justify-center rounded-xl text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <X size={18} />
          </button>
        </div>

        <p id={descId} className="text-sm text-theme-text-secondary leading-relaxed">
          {description}
        </p>

        {impactDetail && (
          <div
            className={`p-3.5 rounded-[12px] border text-xs leading-relaxed ${
              isDanger
                ? 'bg-theme-danger-soft border-theme-danger-border text-theme-text-primary'
                : 'bg-theme-warning-soft border-theme-warning-border text-theme-text-primary'
            }`}
          >
            {impactDetail}
          </div>
        )}

        {children}

        {requireKeyword && (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-xs font-semibold text-theme-text-primary">
              নিশ্চিত করতে নিচের ঘরে <code className="font-mono text-theme-danger font-bold">{requireKeyword}</code> লিখুন
            </label>
            <input
              id={inputId}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={requireKeyword}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-surface border border-theme-border-strong font-mono text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-danger focus:border-theme-danger"
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-theme-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border text-sm font-semibold text-theme-text-primary bg-theme-surface hover:bg-theme-surface-hover transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!keywordMatched || isProcessing}
            className={`min-h-[44px] px-5 py-2 rounded-[12px] text-sm font-semibold inline-flex items-center justify-center gap-2 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-elevated disabled:opacity-45 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-theme-danger text-theme-danger-fg hover:opacity-90 focus-visible:ring-theme-danger'
                : 'bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover focus-visible:ring-theme-primary'
            }`}
          >
            {isProcessing && <RefreshCw size={15} className="animate-spin" />}
            <span>{isProcessing ? 'অপেক্ষা করুন...' : confirmLabel}</span>
          </button>
        </div>
      </form>
    </dialog>
  );
};
