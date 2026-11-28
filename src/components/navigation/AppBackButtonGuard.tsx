import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LogOut, X, Check } from 'lucide-react';

interface SentinelState {
  __bnfeRootSentinel?: boolean;
  __bnfeEntryHref?: string;
  __bnfeAppEntry?: boolean;
  idx?: number;
  [key: string]: unknown;
}

/**
 * Shared synchronous bridge between BackGuardPopstateBridge (mounted before BrowserRouter)
 * and AppBackButtonGuard (mounted inside BrowserRouter).
 */
const backGuardShared = {
  installed: false,
  initialHadHistory: false,
  allowExit: false,
  latestHref: typeof window !== 'undefined' ? window.location.href : '/',
  latestHistoryState: (typeof window !== 'undefined' ? window.history.state : null) as SentinelState | null,
  onRootBackAttempt: null as null | ((source: 'popstate' | 'native') => void),
};

function installHistorySentinelIfNeeded() {
  if (typeof window === 'undefined' || backGuardShared.installed) return;
  backGuardShared.installed = true;

  try {
    const currentState = (window.history.state || {}) as SentinelState;
    const currentIdx = typeof currentState.idx === 'number' ? currentState.idx : 0;
    const href = window.location.href;

    backGuardShared.initialHadHistory = window.history.length > 1;
    backGuardShared.latestHref = href;
    backGuardShared.latestHistoryState = currentState;

    // Only wrap the bottom of the SPA stack (idx === 0) or single-entry WebViews
    if (
      !currentState.__bnfeRootSentinel &&
      !currentState.__bnfeAppEntry &&
      (currentIdx === 0 || window.history.length <= 1)
    ) {
      window.history.replaceState(
        { __bnfeRootSentinel: true, __bnfeEntryHref: href } satisfies SentinelState,
        '',
        href
      );
      const restoredEntry: SentinelState = {
        ...currentState,
        idx: currentIdx,
        __bnfeAppEntry: true,
      };
      window.history.pushState(restoredEntry, '', href);
      backGuardShared.latestHistoryState = restoredEntry;
    }
  } catch {
    // Ignore history API restrictions in sandboxed frames
  }
}

/**
 * Must be rendered BEFORE <BrowserRouter> so its popstate listener registers
 * ahead of React Router's popstate listener and can stopImmediatePropagation()
 * when the user hits the root sentinel.
 */
export const BackGuardPopstateBridge: React.FC = () => {
  useLayoutEffect(() => {
    installHistorySentinelIfNeeded();

    const handlePopState = (event: PopStateEvent) => {
      if (backGuardShared.allowExit) return;

      const state = event.state as SentinelState | null;
      if (state?.__bnfeRootSentinel) {
        event.stopImmediatePropagation();
        event.preventDefault?.();

        try {
          const restoreHref = backGuardShared.latestHref || window.location.href;
          const restoreState: SentinelState = {
            ...(backGuardShared.latestHistoryState || { idx: 0 }),
            __bnfeAppEntry: true,
          };
          window.history.pushState(restoreState, '', restoreHref);
          backGuardShared.latestHistoryState = restoreState;
        } catch {
          // Ignore pushState errors
        }

        backGuardShared.onRootBackAttempt?.('popstate');
      }
    };

    window.addEventListener('popstate', handlePopState, true);

    return () => {
      window.removeEventListener('popstate', handlePopState, true);
    };
  }, []);

  return null;
};

/**
 * Global Back Button & Exit Confirmation Handler.
 * - Closes open modals, sheets, dropdowns, and popovers first.
 * - Navigates back in-app when there is navigation history.
 * - Prompts the user with a confirmation dialog before exiting the app.
 * Works across Capacitor Android APK, Cordova/WebView APK wrappers, PWA, and Web.
 */
export const AppBackButtonGuard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [browserExitHint, setBrowserExitHint] = useState(false);
  const exitPromptOpenRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    exitPromptOpenRef.current = exitPromptOpen;
  }, [exitPromptOpen]);

  // Keep latest URL and React Router history state synced for sentinel restoration
  useEffect(() => {
    backGuardShared.latestHref = window.location.href;
    backGuardShared.latestHistoryState = (window.history.state || { idx: 0 }) as SentinelState;
  }, [location.pathname, location.search, location.hash]);

  const tryCloseOpenOverlay = useCallback((): boolean => {
    // 1. If our own exit prompt is open, pressing Back cancels it (stay in app)
    if (exitPromptOpenRef.current) {
      setExitPromptOpen(false);
      return true;
    }

    // 2. Check if any TruncatedText overlay or modal/dialog/drawer is open
    const openDialogs = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-truncated-overlay="true"], [aria-modal="true"], [role="dialog"]'
      )
    ).filter((el) => el.dataset.backGuardModal !== 'true');

    if (openDialogs.length > 0) {
      try {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
            cancelable: true,
          })
        );
      } catch {
        // Ignore synthetic event errors
      }
      return true;
    }

    return false;
  }, []);

  const handleRootBackAttempt = useCallback(() => {
    if (tryCloseOpenOverlay()) {
      return;
    }
    setBrowserExitHint(false);
    setExitPromptOpen(true);
  }, [tryCloseOpenOverlay]);

  useEffect(() => {
    backGuardShared.onRootBackAttempt = handleRootBackAttempt;
    return () => {
      if (backGuardShared.onRootBackAttempt === handleRootBackAttempt) {
        backGuardShared.onRootBackAttempt = null;
      }
    };
  }, [handleRootBackAttempt]);

  // Handle native Capacitor hardware Back button & Cordova/WebView 'backbutton' event
  useEffect(() => {
    let removed = false;
    let capHandle: { remove: () => Promise<void> | void } | null = null;

    const handleBackAction = () => {
      if (tryCloseOpenOverlay()) {
        return;
      }

      const routerIdx =
        typeof (window.history.state as SentinelState | null)?.idx === 'number'
          ? (window.history.state as SentinelState).idx!
          : 0;

      if (routerIdx > 0) {
        navigate(-1);
        return;
      }

      setBrowserExitHint(false);
      setExitPromptOpen(true);
    };

    const handleDomBackButton = (ev: Event) => {
      ev.preventDefault?.();
      handleBackAction();
    };

    document.addEventListener('backbutton', handleDomBackButton);

    const registerCapacitorListener = async () => {
      try {
        // Register using @capacitor/app plugin (works on Capacitor native Android/iOS)
        const handle = await CapApp.addListener('backButton', () => {
          handleBackAction();
        });
        if (removed) {
          await handle.remove();
        } else {
          capHandle = handle;
        }
      } catch {
        // Fallback to window.Capacitor.Plugins.App if @capacitor/app bridge isn't registered on web
        try {
          const winCap = (
            window as unknown as {
              Capacitor?: {
                Plugins?: {
                  App?: {
                    addListener?: (
                      event: 'backButton',
                      cb: () => void
                    ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
                  };
                };
              };
            }
          )?.Capacitor;
          const res = winCap?.Plugins?.App?.addListener?.('backButton', () => {
            handleBackAction();
          });
          if (res && typeof (res as Promise<{ remove: () => Promise<void> }>).then === 'function') {
            const awaited = await (res as Promise<{ remove: () => Promise<void> }>);
            if (removed) {
              await awaited.remove();
            } else {
              capHandle = awaited;
            }
          } else if (res) {
            capHandle = res as { remove: () => void };
          }
        } catch {
          // Ignore on plain web browsers
        }
      }
    };

    void registerCapacitorListener();

    return () => {
      removed = true;
      document.removeEventListener('backbutton', handleDomBackButton);
      try {
        void capHandle?.remove?.();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [navigate, tryCloseOpenOverlay]);

  // Escape & Enter keyboard support while exit prompt is open
  useEffect(() => {
    if (!exitPromptOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setExitPromptOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [exitPromptOpen]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const handleCancelExit = () => {
    setExitPromptOpen(false);
    setBrowserExitHint(false);
  };

  const handleConfirmExit = async () => {
    setExitPromptOpen(false);

    // 1. Native Capacitor App exit (Android APK)
    if (Capacitor.isNativePlatform()) {
      try {
        await CapApp.exitApp();
        return;
      } catch {
        try {
          const winCap = (
            window as unknown as {
              Capacitor?: { Plugins?: { App?: { exitApp?: () => Promise<void> | void } } };
            }
          )?.Capacitor;
          await winCap?.Plugins?.App?.exitApp?.();
          return;
        } catch {
          // Continue to WebView fallbacks below
        }
      }
    }

    // 2. Cordova / custom Android WebView JS bridge exit
    const winAny = window as unknown as {
      Android?: { exitApp?: () => void; closeApp?: () => void };
      AndroidBridge?: { exitApp?: () => void };
      AndroidInterface?: { exitApp?: () => void };
    };
    const navAny = navigator as unknown as {
      app?: { exitApp?: () => void };
    };

    if (typeof navAny?.app?.exitApp === 'function') {
      navAny.app.exitApp();
      return;
    }
    if (typeof winAny?.Android?.exitApp === 'function') {
      winAny.Android.exitApp();
      return;
    }
    if (typeof winAny?.Android?.closeApp === 'function') {
      winAny.Android.closeApp();
      return;
    }
    if (typeof winAny?.AndroidBridge?.exitApp === 'function') {
      winAny.AndroidBridge.exitApp();
      return;
    }
    if (typeof winAny?.AndroidInterface?.exitApp === 'function') {
      winAny.AndroidInterface.exitApp();
      return;
    }

    // 3. PWA / TWA / Generic WebView / Browser exit fallback
    backGuardShared.allowExit = true;
    try {
      window.close();
    } catch {
      // Ignore if browser restricts window.close()
    }

    try {
      if (backGuardShared.initialHadHistory && window.history.length > 2) {
        window.history.go(-2);
      } else {
        // Step back onto the root sentinel so webView.canGoBack() becomes false
        window.history.go(-1);
      }
    } catch {
      // Ignore history errors
    }

    // If still open after 350ms (e.g. desktop browser tab), keep guard ready & show brief hint
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = window.setTimeout(() => {
      if (!window.closed && !document.hidden) {
        backGuardShared.allowExit = false;
        setBrowserExitHint(true);
        window.setTimeout(() => setBrowserExitHint(false), 4500);
      }
    }, 350);
  };

  return (
    <>
      {exitPromptOpen && (
        <div
          data-back-guard-modal="true"
          className="fixed inset-0 z-[10000] overflow-y-auto overflow-x-hidden bg-slate-950/65 backdrop-blur-xs overscroll-contain animate-in fade-in duration-150 print:hidden"
          onClick={handleCancelExit}
        >
          <div className="min-h-full w-full flex items-center justify-center p-4 pb-16">
            <div
              data-back-guard-modal="true"
              className="bg-theme-elevated rounded-3xl shadow-2xl border border-theme-border w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-confirm-title"
            >
              <div className="relative pt-6 px-6 pb-2 text-center">
                <button
                  type="button"
                  onClick={handleCancelExit}
                  className="absolute right-4 top-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover rounded-xl transition cursor-pointer"
                  aria-label="বন্ধ করুন"
                  title="বন্ধ করুন"
                >
                  <X size={18} />
                </button>

                <div className="flex justify-center mb-3.5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-theme-warning-soft border border-theme-warning-border text-theme-warning">
                    <LogOut size={24} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-snug border bg-theme-warning-soft text-theme-warning border-theme-warning-border">
                    অ্যাপ প্রস্থান নিশ্চিতকরণ
                  </span>
                  <h3
                    id="exit-confirm-title"
                    className="text-lg font-bold text-theme-text-primary leading-snug"
                  >
                    আপনি কি অ্যাপ থেকে বের হতে চান?
                  </h3>
                </div>
              </div>

              <div className="px-6 py-2.5 text-center">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                  অ্যাপটি বন্ধ করতে চাইলে &ldquo;হ্যাঁ, বের হোন&rdquo; বাটনে চাপ দিন, অথবা অ্যাপে থাকতে &ldquo;না, থাকুন&rdquo; নির্বাচন করুন।
                </p>
              </div>

              <div className="p-5 bg-theme-surface-subtle border-t border-theme-border flex items-center justify-center space-x-3">
                <button
                  type="button"
                  autoFocus
                  onClick={handleCancelExit}
                  className="flex-1 min-h-[44px] px-4 py-2.5 bg-theme-surface border border-theme-border hover:bg-theme-surface-hover active:scale-95 text-theme-text-primary rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  না, থাকুন
                </button>

                <button
                  type="button"
                  onClick={() => void handleConfirmExit()}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center justify-center space-x-1.5 cursor-pointer bg-theme-danger hover:opacity-90 active:scale-95 text-theme-danger-fg shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <Check size={16} />
                  <span>হ্যাঁ, বের হোন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {browserExitHint && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[10001] max-w-[92vw] sm:max-w-md px-4 py-2.5 rounded-[14px] bg-theme-elevated border border-theme-border shadow-xl text-xs font-medium text-theme-text-primary text-center print:hidden"
        >
          অ্যাপ থেকে বের হতে আবার ব্যাক বাটন চাপুন অথবা ব্রাউজার ট্যাবটি বন্ধ করুন।
        </div>
      )}
    </>
  );
};
