import React, { useEffect, useId, useRef } from 'react';
import { Lock, RotateCcw, X } from 'lucide-react';
import { ActionStep, useActionRunner } from '../../hooks/useActionRunner';
import { ActionButton } from '../ui/ActionButton';

interface ConfirmActionDialogProps {
  open: boolean;
  mode: 'undo' | 'restore' | 'settle';
  title: string;
  subtitle?: string;
  summaryLines: string[];
  warningNote?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  noteValue?: string;
  maxNoteLength?: number;
  onNoteChange?: (value: string) => void;
  confirmLabel: string;
  popoverTitle?: string;
  steps: ActionStep<any>[];
  onSuccessClose?: () => void;
  onClose: () => void;
}

export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  open,
  mode,
  title,
  subtitle,
  summaryLines,
  warningNote,
  noteLabel,
  notePlaceholder,
  noteValue = '',
  maxNoteLength = 500,
  onNoteChange,
  confirmLabel,
  popoverTitle,
  steps,
  onSuccessClose,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const noteInputId = useId();
  const runner = useActionRunner(steps);

  const isBusy = runner.phase === 'running' || runner.phase === 'waiting';
  const isSuccess = runner.phase === 'success';
  const lockInputs = isBusy || isSuccess || runner.doneCount > 0;

  useEffect(() => {
    if (open) {
      runner.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

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

  const isSettle = mode === 'settle';
  const defaultSubtitle =
    mode === 'undo'
      ? 'নিচের ক্ষেত্রগুলো পূর্বের অবস্থায় ফিরিয়ে নেওয়া হবে:'
      : mode === 'restore'
      ? 'নিচের মুছে ফেলা তথ্য পুনরুদ্ধার করা হবে:'
      : 'নিষ্পন্ন করলে এই এন্ট্রির পরিবর্তন আর ফেরত বা পুনরুদ্ধার করা যাবে না। এটি স্থায়ী।';

  const resolvedPopoverTitle =
    popoverTitle ||
    (isSettle ? 'নিষ্পত্তির ধাপ' : mode === 'undo' ? 'ফেরত নেওয়ার ধাপ' : 'পুনরুদ্ধারের ধাপ');

  const handleDismiss = () => {
    if (isBusy) return;
    if (isSuccess && onSuccessClose) {
      onSuccessClose();
    } else {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        handleDismiss();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleDismiss();
        }
      }}
      className="font-sans m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-[16px] border border-theme-border bg-theme-elevated text-theme-text-primary p-0 backdrop:bg-black/55 motion-reduce:transition-none"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${
                isSettle
                  ? 'border-theme-border-strong bg-theme-surface-subtle text-theme-text-primary'
                  : 'border-theme-primary/25 bg-theme-primary-soft text-theme-primary'
              }`}
            >
              {isSettle ? <Lock size={18} /> : <RotateCcw size={18} />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-theme-text-primary leading-snug">
                {title}
              </h3>
              <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed">
                {subtitle ?? defaultSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleDismiss}
            aria-label={isSuccess ? 'বন্ধ করুন' : 'বাতিল করুন'}
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

        {/* Optional note input (used by Settle) */}
        {onNoteChange && (
          <div className="space-y-1.5">
            <label
              htmlFor={noteInputId}
              className="block text-xs font-medium text-theme-text-secondary"
            >
              {noteLabel || 'মন্তব্য (ঐচ্ছিক)'}
            </label>
            <textarea
              id={noteInputId}
              rows={2}
              maxLength={maxNoteLength}
              disabled={lockInputs}
              value={noteValue}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={notePlaceholder || 'মন্তব্য লিখুন...'}
              className="w-full px-3 py-2 rounded-[12px] bg-theme-surface border border-theme-border text-xs sm:text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary disabled:opacity-60 resize-none"
            />
          </div>
        )}

        {warningNote && (
          <p className="text-xs text-theme-text-secondary leading-relaxed">
            {warningNote}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleDismiss}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs sm:text-sm font-medium text-theme-text-primary disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary shrink-0"
          >
            {isSuccess ? 'বন্ধ করুন' : 'বাতিল'}
          </button>

          <ActionButton
            runner={runner}
            idleLabel={confirmLabel}
            idleIcon={isSettle ? <Lock size={15} /> : <RotateCcw size={15} />}
            popoverTitle={resolvedPopoverTitle}
            variant={isSettle ? 'neutral' : 'primary'}
            className="w-full sm:flex-1 min-w-0"
          />
        </div>
      </div>
    </dialog>
  );
};
