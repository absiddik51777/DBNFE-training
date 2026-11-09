import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  Info, 
  CheckCircle2, 
  HelpCircle, 
  X, 
  Check 
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

  // Keyboard shortcut listener for Esc and Enter
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

  // Determine icon & colors based on variant
  const getVariantStyles = () => {
    if (!dialogState) return {};
    switch (dialogState.variant) {
      case 'danger':
        return {
          icon: <Trash2 size={26} className="text-rose-600" />,
          ringColor: 'bg-rose-100 ring-8 ring-rose-50 text-rose-600',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md shadow-rose-600/30',
          badgeText: 'সতর্কতা / ডিলিট অপারেশন',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={26} className="text-amber-600" />,
          ringColor: 'bg-amber-100 ring-8 ring-amber-50 text-amber-600',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-md shadow-amber-600/30',
          badgeText: 'সতর্কতামূলক নির্দেশনা',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={26} className="text-emerald-600" />,
          ringColor: 'bg-emerald-100 ring-8 ring-emerald-50 text-emerald-600',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-600/30',
          badgeText: 'সফলতা',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'info':
      case 'primary':
      default:
        return {
          icon: <Info size={26} className="text-teal-600" />,
          ringColor: 'bg-teal-100 ring-8 ring-teal-50 text-teal-600',
          confirmBtn: 'bg-teal-600 hover:bg-teal-700 active:scale-95 text-white shadow-md shadow-teal-600/30',
          badgeText: 'জরুরি তথ্য',
          badgeClass: 'bg-teal-100 text-teal-800 border-teal-200'
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <ConfirmationContext.Provider value={{ confirm, showAlert }}>
      {children}

      {/* Confirmation Modal */}
      {dialogState?.isOpen && (
        <div 
          className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden bg-slate-900/60 backdrop-blur-xs overscroll-contain animate-in fade-in duration-200"
          onClick={handleClose}
        >
          <div className="min-h-full w-full flex items-start sm:items-center justify-center p-3 sm:p-4 pt-6 sm:py-6 pb-16">
            <div 
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
            {/* Top Close Button & Visual Accent */}
            <div className="relative pt-6 px-6 pb-2 text-center">
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X size={18} />
              </button>

              {/* Icon Container */}
              <div className="flex justify-center mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform hover:scale-105 ${vStyles.ringColor}`}>
                  {vStyles.icon}
                </div>
              </div>

              {/* Title & Badge */}
              <div className="space-y-1">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${vStyles.badgeClass}`}>
                  {vStyles.badgeText}
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {dialogState.title}
                </h3>
              </div>
            </div>

            {/* Message Body */}
            <div className="px-6 py-3 text-center space-y-3">
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                {dialogState.message}
              </div>

              {dialogState.detail && (
                <div className="text-left text-xs p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                  {dialogState.detail}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-center space-x-3">
              {!dialogState.isAlert && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
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
