import React, { useEffect, useRef } from 'react';
import { FileCode2, FileText, FileType2, Loader2 } from 'lucide-react';
import { TruncatedText } from '../ui/TruncatedText';

interface ExportPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  generating: 'pdf' | 'docx' | 'html' | null;
  errorMessage: string;
  onSelectPdf: () => void;
  onSelectDocx: () => void;
  onSelectHtml: () => void;
}

export const ExportPopover: React.FC<ExportPopoverProps> = ({
  open,
  onClose,
  triggerRef,
  generating,
  errorMessage,
  onSelectPdf,
  onSelectDocx,
  onSelectHtml,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Move keyboard focus into the popover when opened
    const raf = window.requestAnimationFrame(() => {
      firstItemRef.current?.focus();
    });

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const isBusy = Boolean(generating);

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="এক্সপোর্ট ফরম্যাট"
      className="absolute left-0 top-[calc(100%+8px)] z-40 w-[260px] max-w-[calc(100vw-2rem)] rounded-[14px] bg-[var(--ws-surface)] text-[var(--ws-text)] border border-[var(--ws-border)] shadow-xl p-2 space-y-1.5"
    >
      <button
        ref={firstItemRef}
        type="button"
        role="menuitem"
        disabled={isBusy}
        onClick={onSelectPdf}
        className="w-full min-h-[52px] px-3 py-2 rounded-[10px] hover:bg-[var(--ws-surface2)] flex items-center gap-3 text-left transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
      >
        <span className="w-9 h-9 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0">
          {generating === 'pdf' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileText size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-[var(--ws-text)] leading-snug">
            {generating === 'pdf' ? 'তৈরি হচ্ছে…' : 'PDF (.pdf)'}
          </span>
          <TruncatedText
            text="প্রিন্ট ও জমা দেওয়ার জন্য"
            mode="pop"
            className="block text-[12px] text-[var(--ws-muted)] leading-snug"
          />
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={isBusy}
        onClick={onSelectDocx}
        className="w-full min-h-[52px] px-3 py-2 rounded-[10px] hover:bg-[var(--ws-surface2)] flex items-center gap-3 text-left transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
      >
        <span className="w-9 h-9 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 border border-sky-500/25 flex items-center justify-center shrink-0">
          {generating === 'docx' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileType2 size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-[var(--ws-text)] leading-snug">
            {generating === 'docx' ? 'তৈরি হচ্ছে…' : 'Word (.docx)'}
          </span>
          <TruncatedText
            text="সম্পাদনা করা যাবে"
            mode="pop"
            className="block text-[12px] text-[var(--ws-muted)] leading-snug"
          />
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={isBusy}
        onClick={onSelectHtml}
        className="w-full min-h-[52px] px-3 py-2 rounded-[10px] hover:bg-[var(--ws-surface2)] flex items-center gap-3 text-left transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
      >
        <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
          {generating === 'html' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileCode2 size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-[var(--ws-text)] leading-snug">
            {generating === 'html' ? 'তৈরি হচ্ছে…' : 'HTML (.html)'}
          </span>
          <TruncatedText
            text="ব্রাউজার ও প্রিন্টের জন্য"
            mode="pop"
            className="block text-[12px] text-[var(--ws-muted)] leading-snug"
          />
        </span>
      </button>

      {errorMessage && (
        <div
          role="alert"
          className="px-2.5 py-2 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-[12.5px] text-rose-600 dark:text-rose-400 leading-snug"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
};
