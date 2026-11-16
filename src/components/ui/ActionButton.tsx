import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pause, RotateCcw } from 'lucide-react';
import type { UseActionRunnerReturn } from '../../hooks/useActionRunner';
import { toBn } from '../../lib/dateUtils';
import { ProgressPopover } from './ProgressPopover';

export interface ActionButtonProps {
  runner: UseActionRunnerReturn;
  idleLabel: string;
  idleIcon?: React.ReactNode;
  popoverTitle?: string;
  variant?: 'primary' | 'danger' | 'neutral';
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  onBeforeRun?: () => boolean | Promise<boolean>;
  onAutoHide?: () => void;
  type?: 'button' | 'submit';
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  runner,
  idleLabel,
  idleIcon,
  popoverTitle = 'কাজের ধাপ',
  variant = 'primary',
  disabled = false,
  className = '',
  buttonClassName = '',
  onBeforeRun,
  onAutoHide,
  type = 'button',
}) => {
  const { run, retry, steps, phase, doneCount, total, failedStep, summary } = runner;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const prevPhaseRef = useRef(phase);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const toggleLinkRef = useRef<HTMLButtonElement | null>(null);

  // Sync popover visibility automatically on phase transitions
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === 'idle') {
      setPopoverOpen(false);
      setManualOpen(false);
      return;
    }

    if (prev === 'idle' && (phase === 'running' || phase === 'waiting')) {
      setManualOpen(false);
      setPopoverOpen(true);
    } else if (prev === 'failed' && (phase === 'running' || phase === 'waiting')) {
      setManualOpen(false);
      setPopoverOpen(true);
    } else if (phase === 'failed' || phase === 'waiting') {
      setManualOpen(false);
      setPopoverOpen(true);
    }
  }, [phase]);

  const isBusy = phase === 'running' || phase === 'waiting';
  const remainingCount = Math.max(0, total - doneCount);

  const handleClick = async () => {
    if (isBusy || disabled) return;

    if (phase === 'failed') {
      setManualOpen(false);
      setPopoverOpen(true);
      await retry();
      return;
    }

    if (onBeforeRun) {
      const proceed = await onBeforeRun();
      if (!proceed) return;
    }

    setManualOpen(false);
    setPopoverOpen(true);
    await run();
  };

  let appearanceClasses = '';
  if (phase === 'waiting') {
    appearanceClasses =
      'border-theme-warning-border bg-theme-warning text-theme-warning-fg';
  } else if (phase === 'failed') {
    appearanceClasses =
      'border-theme-danger bg-theme-danger hover:opacity-95 text-theme-danger-fg';
  } else if (phase === 'success') {
    appearanceClasses =
      'border-theme-success bg-theme-success text-theme-success-fg';
  } else if (variant === 'danger') {
    appearanceClasses =
      'border-theme-danger bg-theme-danger hover:opacity-95 text-theme-danger-fg';
  } else if (variant === 'neutral') {
    appearanceClasses =
      'border-theme-border-strong bg-theme-text-primary hover:opacity-90 text-theme-bg';
  } else {
    appearanceClasses =
      'border-theme-primary bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg';
  }

  let labelText = idleLabel;
  let iconNode: React.ReactNode = idleIcon ?? null;

  if (phase === 'running') {
    labelText = `চলছে… (${toBn(doneCount)}/${toBn(total)} ধাপ সম্পন্ন)`;
    iconNode = (
      <Loader2 size={15} className="animate-spin motion-reduce:animate-none shrink-0" />
    );
  } else if (phase === 'waiting') {
    labelText = 'ইন্টারনেটের অপেক্ষায়…';
    iconNode = <Pause size={15} className="shrink-0" />;
  } else if (phase === 'failed') {
    labelText = `আবার চেষ্টা করুন (বাকি ${toBn(remainingCount)}টি ধাপ)`;
    iconNode = <RotateCcw size={15} className="shrink-0" />;
  } else if (phase === 'success') {
    labelText = 'সম্পন্ন';
    iconNode = <Check size={16} strokeWidth={2.5} className="shrink-0" />;
  }

  let hintText = '';
  let hintTone = 'text-theme-text-secondary';

  if (phase === 'failed') {
    hintTone = 'text-theme-danger';
    if (doneCount > 0) {
      hintText = `${toBn(doneCount)}টি ধাপ সম্পন্ন হয়েছে। শুধু বাকি ${toBn(remainingCount)}টি ধাপ আবার চলবে।`;
    } else if (failedStep?.detail) {
      hintText = failedStep.detail;
    }
  } else if (phase === 'waiting') {
    hintTone = 'text-theme-warning';
    hintText = 'ইন্টারনেট সংযোগ ফিরে এলে বাকি কাজ স্বয়ংক্রিয়ভাবে চলবে।';
  }

  const showDetailsLink = phase !== 'idle';

  return (
    <div className={`relative ${className}`}>
      <ProgressPopover
        triggerRef={buttonRef}
        open={popoverOpen}
        onClose={() => {
          setPopoverOpen(false);
          setManualOpen(false);
        }}
        steps={steps}
        phase={phase}
        summary={summary}
        title={popoverTitle}
        manualOpen={manualOpen}
        toggleButtonRef={toggleLinkRef}
        onAutoHide={onAutoHide}
      />

      <button
        ref={buttonRef}
        type={type}
        disabled={disabled || isBusy || phase === 'success'}
        aria-busy={isBusy}
        onClick={handleClick}
        className={`min-h-[44px] w-full px-4 py-2 rounded-[12px] border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-75 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${appearanceClasses} ${buttonClassName}`}
      >
        {iconNode}
        <span className="truncate">{labelText}</span>
      </button>

      {(hintText || showDetailsLink) && (
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-[11px] leading-snug">
          {hintText ? (
            <span className={`${hintTone} min-w-0 flex-1 break-words font-medium`}>
              {hintText}
            </span>
          ) : (
            <span />
          )}

          {showDetailsLink && !popoverOpen && (
            <button
              ref={toggleLinkRef}
              type="button"
              onClick={() => {
                setManualOpen(true);
                setPopoverOpen(true);
              }}
              className="text-theme-primary hover:underline font-medium shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary rounded"
            >
              বিবরণ দেখুন
            </button>
          )}
        </div>
      )}
    </div>
  );
};
