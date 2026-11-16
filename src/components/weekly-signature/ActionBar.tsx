import React, { useRef } from 'react';
import { CalendarRange, CheckCircle2, ChevronDown, Download, Printer } from 'lucide-react';
import { ExportPopover } from './ExportPopover';
import { formatSelectedRangeBn, toBnDigits, type WeekDayInfo } from './utils';

interface ActionBarProps {
  selectedDays: WeekDayInfo[];
  popoverOpen: boolean;
  onTogglePopover: () => void;
  onClosePopover: () => void;
  generating: 'pdf' | 'docx' | null;
  exportError: string;
  onSelectPdf: () => void;
  onSelectDocx: () => void;
  onPrint: () => void;
  onChangeDates: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  selectedDays,
  popoverOpen,
  onTogglePopover,
  onClosePopover,
  generating,
  exportError,
  onSelectPdf,
  onSelectDocx,
  onPrint,
  onChangeDates,
}) => {
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  const rangeLabel = formatSelectedRangeBn(selectedDays);

  return (
    <section className="max-w-[210mm] mx-auto rounded-[16px] bg-[var(--ws-surface)] border border-[var(--ws-border)] p-3.5 sm:p-4 space-y-3 print:hidden">
      <div className="flex items-start gap-2 text-[14.5px] font-medium text-[var(--ws-text)]">
        <CheckCircle2
          size={18}
          className="text-[var(--ws-accent)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <span className="leading-snug">
          সিট তৈরি হয়েছে: {rangeLabel} ({toBnDigits(selectedDays.length)} দিন)
        </span>
      </div>

      <div className="flex flex-col min-[480px]:flex-row min-[480px]:flex-wrap items-stretch min-[480px]:items-center gap-2.5">
        {/* 1. Export button + anchored popover */}
        <div className="relative w-full min-[480px]:w-auto">
          <button
            ref={exportBtnRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={popoverOpen}
            onClick={onTogglePopover}
            className="w-full min-[480px]:w-auto h-[48px] px-5 rounded-[12px] bg-[var(--ws-accent)] text-white dark:text-slate-950 text-[14.5px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
          >
            <Download size={17} />
            <span>এক্সপোর্ট</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${popoverOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <ExportPopover
            open={popoverOpen}
            onClose={onClosePopover}
            triggerRef={exportBtnRef}
            generating={generating}
            errorMessage={exportError}
            onSelectPdf={onSelectPdf}
            onSelectDocx={onSelectDocx}
          />
        </div>

        {/* 2. Print button */}
        <button
          type="button"
          onClick={onPrint}
          className="h-[44px] min-[480px]:h-[48px] px-4 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-text)] hover:border-[var(--ws-accent)] text-[14px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
        >
          <Printer size={16} />
          <span>প্রিন্ট করুন</span>
        </button>

        {/* 3. Change dates button */}
        <button
          type="button"
          onClick={onChangeDates}
          className="h-[44px] min-[480px]:h-[48px] px-4 rounded-[12px] bg-transparent border border-[var(--ws-border)] text-[var(--ws-text)] hover:bg-[var(--ws-surface2)] text-[14px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
        >
          <CalendarRange size={16} />
          <span>তারিখ বদলান</span>
        </button>
      </div>
    </section>
  );
};
