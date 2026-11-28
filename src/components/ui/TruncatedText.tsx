import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, X } from 'lucide-react';

export type TruncatedMode = 'pop' | 'exp' | 'sheet';

interface OverlayState {
  id: number;
  mode: 'pop' | 'sheet';
  text: string;
  title?: string;
  anchorEl: HTMLElement | null;
  anchorRect: DOMRect | null;
}

interface TruncatedTextContextValue {
  activeOverlayId: number | null;
  openPopover: (id: number, text: string, anchorEl: HTMLElement) => void;
  openSheet: (id: number, text: string, title?: string, anchorEl?: HTMLElement | null) => void;
  closeOverlay: () => void;
}

const TruncatedTextContext = createContext<TruncatedTextContextValue | null>(null);

let nextTriggerId = 1;

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to textarea copy fallback
  }

  try {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const TruncatedTextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [copied, setCopied] = useState(false);
  const [popPos, setPopPos] = useState<{ top: number; left: number; ready: boolean }>({
    top: -9999,
    left: -9999,
    ready: false,
  });

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const sheetCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeOverlay = useCallback(() => {
    setOverlay((prev) => {
      if (prev?.anchorEl && typeof prev.anchorEl.focus === 'function') {
        window.requestAnimationFrame(() => {
          prev.anchorEl?.focus({ preventScroll: true });
        });
      } else if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        const target = previousFocusRef.current;
        window.requestAnimationFrame(() => {
          target.focus({ preventScroll: true });
        });
      }
      return null;
    });
    setCopied(false);
  }, []);

  const openPopover = useCallback(
    (id: number, text: string, anchorEl: HTMLElement) => {
      setCopied(false);
      setOverlay((prev) => {
        if (prev && prev.id === id && prev.mode === 'pop') {
          return null;
        }
        previousFocusRef.current = anchorEl;
        return {
          id,
          mode: 'pop',
          text,
          anchorEl,
          anchorRect: anchorEl.getBoundingClientRect(),
        };
      });
    },
    []
  );

  const openSheet = useCallback(
    (id: number, text: string, title?: string, anchorEl: HTMLElement | null = null) => {
      setCopied(false);
      previousFocusRef.current = anchorEl || (document.activeElement as HTMLElement | null);
      setOverlay({
        id,
        mode: 'sheet',
        text,
        title,
        anchorEl,
        anchorRect: anchorEl ? anchorEl.getBoundingClientRect() : null,
      });
    },
    []
  );

  // Position & clamp popover inside viewport (flip above if insufficient space below)
  useLayoutEffect(() => {
    if (!overlay || overlay.mode !== 'pop') {
      setPopPos({ top: -9999, left: -9999, ready: false });
      return;
    }

    const rect = overlay.anchorEl?.isConnected
      ? overlay.anchorEl.getBoundingClientRect()
      : overlay.anchorRect;
    const popEl = popoverRef.current;
    if (!rect || !popEl) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;
    const gap = 8;

    const popRect = popEl.getBoundingClientRect();
    const popW = Math.min(320, Math.max(140, popRect.width || 280));
    const popH = popRect.height || 80;

    let left = rect.left;
    if (left + popW > vw - pad) {
      left = vw - pad - popW;
    }
    if (left < pad) {
      left = pad;
    }

    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    let top: number;
    if (spaceBelow >= popH + gap || spaceBelow >= spaceAbove) {
      top = Math.min(vh - pad - popH, rect.bottom + gap);
    } else {
      top = Math.max(pad, rect.top - gap - popH);
    }
    if (top < pad) top = pad;

    setPopPos({ top, left, ready: true });
  }, [overlay]);

  // Global close handlers: Escape, outside pointerdown, scroll
  useEffect(() => {
    if (!overlay) return;

    if (overlay.mode === 'sheet') {
      window.requestAnimationFrame(() => {
        sheetCloseRef.current?.focus({ preventScroll: true });
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (overlay.mode !== 'pop') return;
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (overlay.anchorEl?.contains(target)) return;
      closeOverlay();
    };

    const handleScroll = (e: Event) => {
      if (overlay.mode !== 'pop') return;
      const target = e.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      closeOverlay();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    if (overlay.mode === 'pop') {
      document.addEventListener('pointerdown', handlePointerDown, true);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', closeOverlay);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (overlay.mode === 'pop') {
        document.removeEventListener('pointerdown', handlePointerDown, true);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', closeOverlay);
      }
    };
  }, [overlay, closeOverlay]);

  // Android / Capacitor hardware Back button closes open popover/sheet first
  useEffect(() => {
    if (!overlay) return;

    let removed = false;
    let pluginHandle: { remove?: () => Promise<void> | void } | null = null;

    const handleBackEvent = (ev?: Event) => {
      ev?.preventDefault?.();
      closeOverlay();
    };

    document.addEventListener('backbutton', handleBackEvent);

    try {
      const capAny = Capacitor as unknown as {
        Plugins?: {
          App?: {
            addListener?: (
              eventName: 'backButton',
              listenerFunc: () => void
            ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
          };
        };
      };
      const windowCapAny = (window as unknown as {
        Capacitor?: typeof capAny;
      })?.Capacitor;
      const appPlugin = capAny?.Plugins?.App || windowCapAny?.Plugins?.App;

      if (appPlugin?.addListener) {
        const res = appPlugin.addListener('backButton', () => {
          closeOverlay();
        });
        if (res && typeof (res as Promise<{ remove: () => Promise<void> }>).then === 'function') {
          (res as Promise<{ remove: () => Promise<void> }>).then((handle) => {
            if (removed) {
              handle?.remove?.();
            } else {
              pluginHandle = handle;
            }
          });
        } else {
          pluginHandle = res as { remove?: () => void };
        }
      }
    } catch {
      // Ignore if App plugin is not bundled in web build
    }

    return () => {
      removed = true;
      document.removeEventListener('backbutton', handleBackEvent);
      try {
        pluginHandle?.remove?.();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [overlay, closeOverlay]);

  const handleCopy = useCallback(async () => {
    if (!overlay?.text) return;
    const ok = await copyTextWithFallback(overlay.text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [overlay?.text]);

  const value = useMemo<TruncatedTextContextValue>(
    () => ({
      activeOverlayId: overlay?.id ?? null,
      openPopover,
      openSheet,
      closeOverlay,
    }),
    [overlay?.id, openPopover, openSheet, closeOverlay]
  );

  return (
    <TruncatedTextContext.Provider value={value}>
      {children}

      {/* Shared Single Popover Host */}
      {overlay?.mode === 'pop' && (
        <div
          ref={popoverRef}
          data-truncated-overlay="true"
          role="dialog"
          aria-label="সম্পূর্ণ লেখা"
          onClick={(e) => e.stopPropagation()}
          style={{
            top: `${popPos.top}px`,
            left: `${popPos.left}px`,
            opacity: popPos.ready ? 1 : 0,
            letterSpacing: '0px',
          }}
          className="fixed z-[95] max-w-[min(320px,calc(100vw-24px))] max-h-[40vh] overflow-y-auto rounded-[14px] bg-theme-elevated text-theme-text-primary border border-theme-border-strong shadow-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed break-words whitespace-pre-wrap print:hidden"
        >
          {overlay.text}
        </div>
      )}

      {/* Shared Single Bottom Sheet Host */}
      {overlay?.mode === 'sheet' && (
        <div
          data-truncated-overlay="true"
          role="dialog"
          aria-modal="true"
          aria-label={overlay.title || 'বিস্তারিত তথ্য'}
          onClick={(e) => {
            e.stopPropagation();
            closeOverlay();
          }}
          className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-[1px] flex items-end justify-center print:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ letterSpacing: '0px' }}
            className="w-full max-w-[560px] bg-theme-elevated text-theme-text-primary border-t border-x border-theme-border rounded-t-[22px] shadow-2xl max-h-[82vh] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Drag Handle */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-theme-border-strong" />
            </div>

            {/* Header */}
            <div className="px-4 py-2.5 border-b border-theme-border flex items-center justify-between gap-3 shrink-0">
              <h2 className="text-[15.5px] font-medium text-theme-text-primary leading-snug">
                {overlay.title || 'বিস্তারিত তথ্য'}
              </h2>
              <button
                ref={sheetCloseRef}
                type="button"
                onClick={closeOverlay}
                aria-label="বন্ধ করুন"
                className="w-9 h-9 rounded-xl bg-theme-surface-subtle border border-theme-border text-theme-text-secondary hover:text-theme-text-primary flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
              >
                <X size={17} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto overscroll-contain text-[14.5px] text-theme-text-primary leading-relaxed break-words whitespace-pre-wrap">
              {overlay.text}
            </div>

            {/* Footer */}
            <div className="px-4 pt-2 border-t border-theme-border flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[42px] px-4 rounded-xl bg-theme-surface-subtle hover:bg-theme-surface-hover border border-theme-border text-theme-text-primary text-[13.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                {copied ? (
                  <>
                    <Check size={15} className="text-theme-success" />
                    <span>কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} />
                    <span>কপি করুন</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={closeOverlay}
                className="min-h-[42px] px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-[13.5px] font-medium cursor-pointer active:scale-95 transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </TruncatedTextContext.Provider>
  );
};

export interface TruncatedTextProps {
  text: string | null | undefined;
  lines?: number;
  mode?: TruncatedMode;
  title?: string;
  className?: string;
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3';
  children?: React.ReactNode;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  lines = 1,
  mode = 'pop',
  title,
  className = '',
  as = 'span',
  children,
}) => {
  const ctx = useContext(TruncatedTextContext);
  const triggerIdRef = useRef<number>(0);
  if (!triggerIdRef.current) {
    triggerIdRef.current = nextTriggerId++;
  }

  const elRef = useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wasTruncatedBeforeExpand, setWasTruncatedBeforeExpand] = useState(false);

  const normalizedText = (text ?? '').toString();
  const isSingleLine = lines <= 1;

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el || !normalizedText) {
      setIsTruncated(false);
      return;
    }

    if (mode === 'exp' && expanded) {
      return;
    }

    const overflowX = el.scrollWidth > el.clientWidth + 1;
    const overflowY = el.scrollHeight > el.clientHeight + 1;
    const next = isSingleLine ? overflowX || overflowY : overflowY || overflowX;
    setIsTruncated(next);
  }, [normalizedText, mode, expanded, isSingleLine]);

  useLayoutEffect(() => {
    measure();
  }, [measure, className, children]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        measure();
      });
      ro.observe(el);
    }

    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [measure]);

  // Reset inline expansion if text prop changes
  useEffect(() => {
    setExpanded(false);
    setWasTruncatedBeforeExpand(false);
  }, [normalizedText]);

  const isOverlayOpenForMe =
    mode !== 'exp' && ctx?.activeOverlayId === triggerIdRef.current;
  const interactive = isTruncated || (mode === 'exp' && expanded && wasTruncatedBeforeExpand);

  const activate = useCallback(
    (e: React.SyntheticEvent) => {
      if (!interactive) return;
      e.preventDefault();
      e.stopPropagation();

      if (mode === 'exp') {
        if (!expanded) {
          setWasTruncatedBeforeExpand(true);
          setExpanded(true);
        } else {
          setExpanded(false);
        }
        return;
      }

      const targetEl = elRef.current;
      if (!targetEl || !ctx) return;

      if (mode === 'sheet') {
        ctx.openSheet(triggerIdRef.current, normalizedText, title, targetEl);
      } else {
        ctx.openPopover(triggerIdRef.current, normalizedText, targetEl);
      }
    },
    [interactive, mode, expanded, ctx, normalizedText, title]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!interactive) return;
      if (e.key === 'Enter' || e.key === ' ') {
        activate(e);
      }
    },
    [interactive, activate]
  );

  // Base clamping classes/styles when not expanded
  const isClamped = !(mode === 'exp' && expanded);
  const needsBlockWrapper =
    as === 'span' &&
    !/\b(block|inline-block|flex|inline-flex|grid|table-cell)\b/.test(className);

  const clampClasses = isClamped
    ? isSingleLine
      ? `truncate max-w-full ${needsBlockWrapper ? 'inline-block align-bottom' : ''}`
      : `overflow-hidden break-words ${needsBlockWrapper ? 'block' : ''}`
    : `break-words ${needsBlockWrapper ? 'block' : ''}`;

  const clampStyle: React.CSSProperties =
    isClamped && !isSingleLine
      ? {
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          letterSpacing: '0px',
        }
      : { letterSpacing: '0px' };

  const interactiveClasses = interactive
    ? 'cursor-pointer underline decoration-dotted underline-offset-[3px] decoration-theme-text-muted/75 hover:decoration-theme-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary rounded-[3px] print:no-underline'
    : '';

  const Tag = as;
  const content = children ?? normalizedText;

  if (mode === 'exp') {
    const showExpControl = isTruncated || (expanded && wasTruncatedBeforeExpand);
    return (
      <span className="block min-w-0 max-w-full">
        <Tag
          ref={elRef as React.RefObject<never>}
          style={clampStyle}
          className={`${clampClasses} ${interactiveClasses} ${className}`.trim()}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-expanded={interactive ? expanded : undefined}
          onClick={interactive ? activate : undefined}
          onKeyDown={interactive ? handleKeyDown : undefined}
        >
          {content}
        </Tag>
        {showExpControl && (
          <button
            type="button"
            onClick={activate}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') activate(e);
            }}
            aria-expanded={expanded}
            className="mt-0.5 text-[11px] font-medium text-theme-primary hover:underline inline-block cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary rounded print:hidden"
          >
            {expanded ? 'কম দেখুন' : 'আরও দেখুন'}
          </button>
        )}
      </span>
    );
  }

  return (
    <Tag
      ref={elRef as React.RefObject<never>}
      style={clampStyle}
      className={`${clampClasses} ${interactiveClasses} ${className}`.trim()}
      title={interactive && mode === 'pop' ? normalizedText : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-expanded={interactive ? isOverlayOpenForMe : undefined}
      onClick={interactive ? activate : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {content}
    </Tag>
  );
};
