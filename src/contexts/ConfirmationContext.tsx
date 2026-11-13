import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Trash2,
  Info,
  CheckCircle2,
  X,
  Check,
} from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string | React.ReactNode;
  detail?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

export interface AlertOptions {
  title?: string;
  message: string | React.ReactNode;
  detail?: string | React.ReactNode;
  buttonText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface ConfirmationContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showAlert: (options: AlertOptions | string) => Promise<void>;
}

const ConfirmationContext = createContext<ConfirmationContextType | null>(null);

export const ConfirmationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    isAlert?: boolean;
    title: string;
    message: string | React.ReactNode;
    detail?: string | React.ReactNode;
    confirmText: string;
    cancelText: string;
    variant: 'danger' | 'warning' | 'info' | 'primary' | 'success';
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (typeof options === 'string') {
        setDialogState({
          isOpen: true,
          isAlert: false,
          title: 'নিশ্চিতকরণ প্রয়োজন',
          message: options,
          confirmText: 'হ্যাঁ, নিশ্চিত করুন',
          cancelText: 'বাতিল',
          variant: 'danger',
          resolve,
        });
      } else {
        setDialogState({
          isOpen: true,
          isAlert: false,
          title: options.title || 'নিশ্চিতকরণ প্রয়োজন',
          message: options.message,
          detail: options.detail,
          confirmText: options.confirmText || 'হ্যাঁ, নিশ্চিত করুন',
          cancelText: options.cancelText || 'বাতিল',
          variant: options.variant || 'danger',
          resolve,
        });
      }
    });
  }, []);

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (typeof options === 'string') {
        setDialogState({
          isOpen: true,
          isAlert: true,
          title: 'বিজ্ঞপ্তি / তথ্য',
          message: options,
          confirmText: 'ঠিক আছে',
          cancelText: '',
          variant: 'info',
          resolve: () => resolve(),
        });
      } else {
        setDialogState({
          isOpen: true,
          isAlert: true,
          title: options.title || 'বিজ্ঞপ্তি',
          message: options.message,
          detail: options.detail,
          confirmText: options.buttonText || 'ঠিক আছে',
          cancelText: '',
          variant: options.variant || 'info',
          resolve: () => resolve(),
        });
      }
    });
  }, []);

  const handleClose = () => {
    if (dialogState) {
      dialogState.resolve(false);
      setDialogState(null);
    }
  };

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true);
      setDialogState(null);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogState?.isOpen) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  const getVariantStyles = () => {
    if (!dialogState) return {};
    switch (dialogState.variant) {
      case 'danger':
        return {
          icon: <Trash2 size={25} className="text-theme-danger" />,
          ringColor: 'bg-theme-danger-soft border border-theme-danger-border text-theme-danger',
          confirmBtn:
            'bg-theme-danger hover:opacity-90 active:scale-95 text-theme-danger-fg shadow-xs',
          badgeText: 'সতর্কতা / ডিলিট অপারেশন',
          badgeClass: 'bg-theme-danger-soft text-theme-danger border-theme-danger-border',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={25} className="text-theme-warning" />,
          ringColor: 'bg-theme-warning-soft border border-theme-warning-border text-theme-warning',
          confirmBtn:
            'bg-theme-warning hover:opacity-90 active:scale-95 text-theme-warning-fg shadow-xs',
          badgeText: 'সতর্কতামূলক নির্দেশনা',
          badgeClass: 'bg-theme-warning-soft text-theme-warning border-theme-warning-border',
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={25} className="text-theme-success" />,
          ringColor: 'bg-theme-success-soft border border-theme-success-border text-theme-success',
          confirmBtn:
            'bg-theme-success hover:opacity-90 active:scale-95 text-theme-success-fg shadow-xs',
          badgeText: 'সফলতা',
          badgeClass: 'bg-theme-success-soft text-theme-success border-theme-success-border',
        };
      case 'info':
      case 'primary':
      default:
        return {
          icon: <Info size={25} className="text-theme-primary" />,
          ringColor: 'bg-theme-primary-soft border border-theme-primary-border text-theme-primary',
          confirmBtn:
            'bg-theme-primary hover:bg-theme-primary-hover active:scale-95 text-theme-primary-fg shadow-xs',
          badgeText: 'জরুরি তথ্য',
          badgeClass: 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border',
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <ConfirmationContext.Provider value={{ confirm, showAlert }}>
      {children}

      {dialogState?.isOpen && (
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden bg-slate-950/65 backdrop-blur-xs overscroll-contain animate-in fade-in duration-150"
          onClick={handleClose}
        >
          <div className="min-h-full w-full flex items-start sm:items-center justify-center p-3 sm:p-4 pt-6 sm:py-6 pb-16">
            <div
              className="bg-theme-elevated rounded-3xl shadow-2xl border border-theme-border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="relative pt-6 px-6 pb-2 text-center">
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-4 top-4 p-2 text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover rounded-xl transition cursor-pointer"
                  title="বন্ধ করুন"
                >
                  <X size={18} />
                </button>

                <div className="flex justify-center mb-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${vStyles.ringColor}`}
                  >
                    {vStyles.icon}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${vStyles.badgeClass}`}
                  >
                    {vStyles.badgeText}
                  </span>
                  <h3 className="text-lg font-bold text-theme-text-primary">
                    {dialogState.title}
                  </h3>
                </div>
              </div>

              <div className="px-6 py-3 text-center space-y-3">
                <div className="text-sm text-theme-text-secondary leading-relaxed whitespace-pre-line font-medium">
                  {dialogState.message}
                </div>

                {dialogState.detail && (
                  <div className="text-left text-xs p-3 rounded-2xl bg-theme-surface-subtle border border-theme-border text-theme-text-secondary leading-relaxed">
                    {dialogState.detail}
                  </div>
                )}
              </div>

              <div className="p-5 bg-theme-surface-subtle border-t border-theme-border flex items-center justify-center space-x-3">
                {!dialogState.isAlert && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 bg-theme-surface border border-theme-border hover:bg-theme-surface-hover active:scale-95 text-theme-text-primary rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    {dialogState.cancelText}
                  </button>
                )}

                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirm}
                  className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${vStyles.confirmBtn}`}
                >
                  <Check size={16} />
                  <span>{dialogState.confirmText}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmationProvider');
  }
  return context;
};
