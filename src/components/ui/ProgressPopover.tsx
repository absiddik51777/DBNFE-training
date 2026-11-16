import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, Circle, Loader2, Pause, X } from 'lucide-react';
import type { ActionPhase, StepState } from '../../hooks/useActionRunner';

export interface ProgressPopoverProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  steps?: StepState[];
  phase?: ActionPhase;
  summary?: string;
  title?: string;
  autoHideMs?: number;
  manualOpen?: boolean;
  toggleButtonRef?: React.RefObject<HTMLElement | null>;
  onAutoHide?: () => void;
}

const VIEWPORT_MARGIN = 14;
const TRIGGER_GAP = 8;
const MIN_POPOVER_WIDTH = 280;
const MAX_POPOVER_WIDTH = 340;
const MIN_POPOVER_HEIGHT = 120;
const MIN_TIGHT_POPOVER_HEIGHT = 64;
const PREFERRED_SPACE_ABOVE = 180;

interface SafeAreaInsets {
  top: number;
  left: number;
  right: number;
}

let cachedProbeEl: HTMLDivElement | null = null;

function readSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === 'undefined' || !document.body) {
    return { top: 0, left: 0, right: 0 };
  }

  try {
    if (!cachedProbeEl) {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '0';
      el.style.height = '0';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      el.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
      el.style.paddingRight = 'env(safe-area-inset-right, 0px)';
      document.body.appendChild(el);
      cachedProbeEl = el;
    }

    const cs = window.getComputedStyle(cachedProbeEl);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
      right: parseFloat(cs.paddingRight) || 0,
    };
  } catch {
    return { top: 0, left: 0, right: 0 };
  }
}

export const ProgressPopover: React.FC<ProgressPopoverProps> = ({
  triggerRef,
  open,
  onClose,
  children,
  steps = [],
  phase = 'idle',
  summary = '',
  title = 'কাজের ধাপ',
  autoHideMs = 2000,
  manualOpen = false,
  toggleButtonRef,
  onAutoHide,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const countdownBarRef = useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [countdownProgress, setCountdownProgress] = useState(1); // 1 -> 0
  const [isVisible, setIsVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);

  const didScrollCheckForOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onAutoHideRef = useRef(onAutoHide);
  onAutoHideRef.current = onAutoHide;

  // Handle mount/unmount animation cleanly while respecting prefers-reduced-motion
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      return;
    }

    didScrollCheckForOpenRef.current = false;
    if (!isVisible) {
      setIsPositioned(false);
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setIsVisible(false);
      setIsClosing(false);
      setIsPositioned(false);
      return;
    }

    setIsClosing(true);
    const id = window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      setIsPositioned(false);
    }, 180);
    return () => window.clearTimeout(id);
  }, [open, isVisible]);

  // Reset pause state whenever popover opens or phase changes away from success
  useEffect(() => {
    if (!open || phase !== 'success' || manualOpen) {
      setIsPaused(false);
      setCountdownProgress(1);
    }
  }, [open, phase, manualOpen]);

  // Auto-hide 2s countdown ONLY when open + phase === 'success' + not manually reopened
  useEffect(() => {
    if (!open || phase !== 'success' || manualOpen) return;

    if (isPaused) {
      // Hold full bar dimmed while paused, and start a fresh 2s countdown when hover/focus ends
      setCountdownProgress(1);
      return;
    }

    let rafId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.max(0, 1 - elapsed / autoHideMs);
      setCountdownProgress(ratio);

      if (elapsed >= autoHideMs) {
        onCloseRef.current();
        onAutoHideRef.current?.();
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [open, phase, manualOpen, isPaused, autoHideMs]);

  // Outside tap closes after success (or when manually reopened)
  useEffect(() => {
    if (!open || phase !== 'success') return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      if (toggleButtonRef?.current?.contains(target)) return;
      onCloseRef.current();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, phase, triggerRef, toggleButtonRef]);

  // Escape key closes popover cleanly whether focus is inside popover or on trigger
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const computeViewportMetrics = useCallback(() => {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    const vvLeft = vv ? vv.offsetLeft : 0;
    const vvTop = vv ? vv.offsetTop : 0;
    const insets = readSafeAreaInsets();
    const marginLeft = VIEWPORT_MARGIN + insets.left;
    const marginRight = VIEWPORT_MARGIN + insets.right;
    const marginTop = VIEWPORT_MARGIN + insets.top;

    // Fixed width: 340px on normal screens, 100vw - 28px below 368px, never < 280px (unless viewport itself < 280px)
    const width = Math.max(
      Math.min(MIN_POPOVER_WIDTH, vw),
      Math.min(MAX_POPOVER_WIDTH, vw - marginLeft - marginRight)
    );

    return { vw, vh, vvLeft, vvTop, marginLeft, marginRight, marginTop, width };
  }, []);

  const updatePosition = useCallback(
    (allowInitialScroll = false) => {
      const popover = popoverRef.current;
      const scrollEl = scrollContainerRef.current;
      const trigger = triggerRef.current;
      if (!popover || !scrollEl || !trigger) return;

      let metrics = computeViewportMetrics();
      popover.style.width = `${Math.round(metrics.width)}px`;

      const chromeHeight =
        2 + (countdownBarRef.current ? countdownBarRef.current.offsetHeight : 0);

      // Measure desired content height first (up to 60vh) before checking scroll room
      scrollEl.style.maxHeight = `${Math.max(48, Math.floor(metrics.vh * 0.6 - chromeHeight))}px`;

      let r = trigger.getBoundingClientRect();
      let minTop = metrics.vvTop + metrics.marginTop;
      let spaceAbove = r.top - minTop - TRIGGER_GAP;

      if (allowInitialScroll && !didScrollCheckForOpenRef.current) {
        didScrollCheckForOpenRef.current = true;
        const desiredHeight = Math.max(MIN_POPOVER_HEIGHT, popover.offsetHeight);
        const neededAbove = Math.min(Math.max(desiredHeight, PREFERRED_SPACE_ABOVE), metrics.vh * 0.6);
        const isTriggerClipped =
          r.top < minTop || r.bottom > metrics.vvTop + metrics.vh - TRIGGER_GAP;

        if (spaceAbove < neededAbove || isTriggerClipped) {
          try {
            trigger.scrollIntoView({
              block: 'center',
              inline: 'nearest',
              behavior: 'instant' as ScrollBehavior,
            });
          } catch {
            trigger.scrollIntoView({ block: 'center' });
          }
          metrics = computeViewportMetrics();
          popover.style.width = `${Math.round(metrics.width)}px`;
          r = trigger.getBoundingClientRect();
          minTop = metrics.vvTop + metrics.marginTop;
          spaceAbove = r.top - minTop - TRIGGER_GAP;
        }
      }

      // Compute final maxH: min(60vh, spaceAbove), minimum 120px when >=120px fits; shrink without overlapping if tighter
      const availableCap = Math.min(Math.max(0, spaceAbove), metrics.vh * 0.6);
      const maxH =
        spaceAbove >= MIN_POPOVER_HEIGHT
          ? Math.min(spaceAbove, Math.max(MIN_POPOVER_HEIGHT, availableCap))
          : Math.max(Math.min(MIN_TIGHT_POPOVER_HEIGHT, Math.max(36, spaceAbove)), availableCap);

      scrollEl.style.maxHeight = `${Math.max(32, Math.floor(maxH - chromeHeight))}px`;

      const popoverHeight = popover.offsetHeight;

      const minLeft = metrics.vvLeft + metrics.marginLeft;
      const maxLeft = metrics.vvLeft + metrics.vw - metrics.width - metrics.marginRight;
      const left =
        maxLeft < minLeft
          ? Math.max(0, metrics.vvLeft + (metrics.vw - metrics.width) / 2)
          : Math.min(Math.max(minLeft, r.left), maxLeft);

      // Always directly above trigger (8px gap). Keep bottom inside visual viewport only if trigger itself is pushed past bottom.
      const anchorTop = Math.min(r.top, metrics.vvTop + metrics.vh);
      const top = Math.max(minTop, anchorTop - TRIGGER_GAP - popoverHeight);

      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
      setIsPositioned((prev) => (prev ? prev : true));
    },
    [computeViewportMetrics, triggerRef]
  );

  // Synchronously position before paint and keep attached on scroll/resize/keyboard/content changes
  useLayoutEffect(() => {
    if (!isVisible) return;

    updatePosition(open);

    const handleViewportUpdate = () => updatePosition(false);

    window.addEventListener('scroll', handleViewportUpdate, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', handleViewportUpdate, { passive: true });
    window.addEventListener('orientationchange', handleViewportUpdate, {
      passive: true,
    });

    const vv = window.visualViewport;
    vv?.addEventListener('resize', handleViewportUpdate);
    vv?.addEventListener('scroll', handleViewportUpdate);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updatePosition(false);
      });
      if (popoverRef.current) ro.observe(popoverRef.current);
      if (triggerRef.current) ro.observe(triggerRef.current);
    }

    return () => {
      window.removeEventListener('scroll', handleViewportUpdate, {
        capture: true,
      });
      window.removeEventListener('resize', handleViewportUpdate);
      window.removeEventListener('orientationchange', handleViewportUpdate);
      vv?.removeEventListener('resize', handleViewportUpdate);
      vv?.removeEventListener('scroll', handleViewportUpdate);
      ro?.disconnect();
    };
  }, [isVisible, open, steps, phase, summary, children, updatePosition, triggerRef]);

  if (!isVisible || typeof document === 'undefined') return null;

  // If the trigger is inside an open native <dialog> (Top Layer), portal inside that <dialog> so it stays above the dialog/backdrop;
  // otherwise portal directly to document.body so no ancestor can clip or trap it.
  const openDialog = triggerRef.current?.closest('dialog[open]') as HTMLElement | null;
  const portalTarget = openDialog ?? document.body;

  const showCountdownBar = phase === 'success' && !manualOpen;

  const content = (
    <div
      ref={popoverRef}
      role="status"
      aria-live="polite"
      tabIndex={0}
      onMouseEnter={() => {
        if (phase === 'success' && !manualOpen) {
          setIsPaused(true);
        }
      }}
      onMouseLeave={() => {
        if (phase === 'success' && !manualOpen) {
          setIsPaused(false);
        }
      }}
      onFocus={() => {
        if (phase === 'success' && !manualOpen) {
          setIsPaused(true);
        }
      }}
      onBlur={(e) => {
        if (
          phase === 'success' &&
          !manualOpen &&
          !e.currentTarget.contains(e.relatedTarget as Node | null)
        ) {
          setIsPaused(false);
        }
      }}
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
      }}
      className={`font-sans z-[110] rounded-[14px] border border-theme-border bg-theme-elevated text-theme-text-primary shadow-xl overflow-hidden focus:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
        !isPositioned || isClosing
          ? 'opacity-0 translate-y-1.5 pointer-events-none'
          : 'opacity-100 translate-y-0'
      }`}
    >
      <div ref={scrollContainerRef} className="overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-theme-border bg-theme-surface flex items-center justify-between gap-2 sticky top-0 z-10">
          <span className="text-xs sm:text-sm font-semibold text-theme-text-primary truncate">
            {title}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="ধাপের বিবরণ বন্ধ করুন"
            className="min-h-[32px] min-w-[32px] -mr-1 inline-flex items-center justify-center rounded-[10px] text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <X size={15} />
          </button>
        </div>

        {children ? (
          children
        ) : (
          <>
            {/* Step rows */}
            <ul className="p-3 space-y-2.5">
              {steps.map((step) => {
                const isDone = step.status === 'done';
                const isRunning = step.status === 'running';
                const isWaiting = step.status === 'waiting';
                const isFailed = step.status === 'failed';

                return (
                  <li key={step.id} className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-4 h-4">
                      {isDone ? (
                        <Check size={15} className="text-theme-success" strokeWidth={2.5} />
                      ) : isRunning ? (
                        <Loader2
                          size={15}
                          className="text-theme-primary animate-spin motion-reduce:animate-none"
                        />
                      ) : isWaiting ? (
                        <Pause size={14} className="text-theme-warning" />
                      ) : isFailed ? (
                        <X size={15} className="text-theme-danger" strokeWidth={2.5} />
                      ) : (
                        <Circle size={13} className="text-theme-text-muted" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-medium leading-snug break-words ${
                          isDone
                            ? 'text-theme-text-primary'
                            : isFailed
                            ? 'text-theme-danger'
                            : isWaiting
                            ? 'text-theme-warning'
                            : isRunning
                            ? 'text-theme-primary'
                            : 'text-theme-text-secondary'
                        }`}
                      >
                        {step.label}
                      </div>
                      {step.detail && (
                        <div
                          className={`mt-0.5 text-[11px] leading-relaxed break-words ${
                            isDone
                              ? 'text-theme-success'
                              : isFailed
                              ? 'text-theme-danger'
                              : isWaiting
                              ? 'text-theme-warning'
                              : 'text-theme-text-secondary'
                          }`}
                        >
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* One-line truthful summary on success */}
            {phase === 'success' && summary && (
              <div className="mx-3 mb-3 rounded-[10px] border border-theme-success-border bg-theme-success-soft px-3 py-2 flex items-start gap-2 text-[11px] sm:text-xs text-theme-success font-medium leading-snug">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1 break-words">{summary}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Thin 3px countdown bar for 2s auto-hide after success */}
      {showCountdownBar && (
        <div
          ref={countdownBarRef}
          className={`h-[3px] w-full bg-theme-surface-subtle overflow-hidden transition-opacity ${
            isPaused ? 'opacity-40' : 'opacity-100'
          }`}
        >
          <div
            className="h-full bg-theme-success origin-left"
            style={{ width: `${Math.max(0, Math.min(100, countdownProgress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );

  return createPortal(content, portalTarget);
};
