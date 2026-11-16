import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const SessionToast: React.FC = () => {
  const { sessionToast, dismissSessionToast } = useAuth();

  if (!sessionToast) return null;

  const styleMap = {
    info: {
      container:
        'bg-theme-elevated border-theme-info-border text-theme-text-primary shadow-xl',
      badge: 'bg-theme-info-soft text-theme-info',
      Icon: Info,
    },
    warning: {
      container:
        'bg-theme-elevated border-theme-warning-border text-theme-text-primary shadow-xl',
      badge: 'bg-theme-warning-soft text-theme-warning',
      Icon: AlertTriangle,
    },
    error: {
      container:
        'bg-theme-elevated border-theme-danger-border text-theme-text-primary shadow-xl',
      badge: 'bg-theme-danger-soft text-theme-danger',
      Icon: AlertCircle,
    },
    success: {
      container:
        'bg-theme-elevated border-theme-success-border text-theme-text-primary shadow-xl',
      badge: 'bg-theme-success-soft text-theme-success',
      Icon: CheckCircle2,
    },
  }[sessionToast.type];

  const { Icon } = styleMap;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-[120] pointer-events-none flex justify-end print:hidden"
      style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
    >
      <div
        className={`pointer-events-auto w-full sm:w-auto flex items-center gap-3 px-3.5 py-3 rounded-2xl border ${styleMap.container} animate-in fade-in slide-in-from-top-2 duration-200`}
      >
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${styleMap.badge}`}
        >
          <Icon size={17} />
        </div>
        <p className="text-xs sm:text-sm font-semibold leading-snug flex-1">
          {sessionToast.message}
        </p>
        <button
          type="button"
          onClick={dismissSessionToast}
          className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover transition cursor-pointer shrink-0"
          aria-label="বন্ধ করুন"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export default SessionToast;
