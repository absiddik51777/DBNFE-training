import React, { useRef } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Download,
  Printer,
  Settings,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ExportPopover } from './ExportPopover';
import { formatSelectedRangeBn, toBnDigits, type WeekDayInfo } from './utils';

interface ActionBarProps {
  batchName?: string;
  paperWidthMm?: number;
  selectedDays: WeekDayInfo[];
  popoverOpen: boolean;
  onTogglePopover: () => void;
  onClosePopover: () => void;
  generating: 'pdf' | 'docx' | 'html' | null;
  exportError: string;
  onSelectPdf: () => void;
  onSelectDocx: () => void;
  onSelectHtml: () => void;
  onPrint: () => void;
  onChangeDates: () => void;
  onOpenHeadingSettings: () => void;
  zoomMode: 'fit' | 'manual';
  effectiveZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFitZoom: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  batchName,
  paperWidthMm = 210,
  selectedDays,
  popoverOpen,
  onTogglePopover,
  onClosePopover,
  generating,
  exportError,
  onSelectPdf,
  onSelectDocx,
  onSelectHtml,
  onPrint,
  onChangeDates,
  onOpenHeadingSettings,
  zoomMode,
  effectiveZoom,
  onZoomIn,
  onZoomOut,
  onToggleFitZoom,
}) => {
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  const rangeLabel = formatSelectedRangeBn(selectedDays);
  const zoomPercent = Math.round(effectiveZoom * 100);

  return (
    <section
      style={{ maxWidth: `${Math.max(paperWidthMm, 260)}mm` }}
      className="mx-auto rounded-[16px] bg-[var(--ws-surface)] border border-[var(--ws-border)] p-3.5 sm:p-4 space-y-3 print:hidden"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2 text-[14.5px] font-medium text-[var(--ws-text)] min-w-0">
          <CheckCircle2
            size={18}
            className="text-[var(--ws-accent)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span className="leading-snug">
            সিট তৈরি হয়েছে: {batchName ? `${batchName} · ` : ''}
            {rangeLabel} ({toBnDigits(selectedDays.length)} দিন)
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 -mt-1 -mr-1">
          {/* Zoom Controls */}
          <div
            role="group"
            aria-label="জুম নিয়ন্ত্রণ"
            className="hidden sm:inline-flex items-center rounded-[10px] border border-[var(--ws-border)] bg-[var(--ws-surface2)] p-0.5"
          >
            <button
              type="button"
              onClick={onZoomOut}
              disabled={effectiveZoom <= 0.4}
              aria-label="জুম কমান"
              className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[var(--ws-muted)] hover:text-[var(--ws-text)] hover:bg-[var(--ws-surface)] transition disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              onClick={onToggleFitZoom}
              title={zoomMode === 'fit' ? '১০০% জুম করুন' : 'ফ্রেমে ফিট করুন'}
              className="h-8 px-2 rounded-[8px] text-[11.5px] font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface)] tabular-nums transition cursor-pointer min-w-[54px]"
            >
              {zoomMode === 'fit'
                ? `ফিট (${toBnDigits(zoomPercent)}%)`
                : `${toBnDigits(zoomPercent)}%`}
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={effectiveZoom >= 1.8}
              aria-label="জুম বাড়ান"
              className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[var(--ws-muted)] hover:text-[var(--ws-text)] hover:bg-[var(--ws-surface)] transition disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenHeadingSettings}
            aria-label="পেইজ ও হেডিং সেটিংস"
            title="পেইজ, ফন্ট ও হেডিং সেটিংস"
            className="w-10 h-10 rounded-[10px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)] hover:border-[var(--ws-accent)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
          >
            <Settings size={17} />
          </button>
        </div>
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
            onSelectHtml={onSelectHtml}
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
          <span>ব্যাচ ও তারিখ বদলান</span>
        </button>

        {/* Mobile Zoom Controls */}
        <div
          role="group"
          aria-label="জুম নিয়ন্ত্রণ"
          className="flex sm:hidden items-center justify-between rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface2)] p-1"
        >
          <button
            type="button"
            onClick={onZoomOut}
            disabled={effectiveZoom <= 0.4}
            aria-label="জুম কমান"
            className="w-10 h-9 rounded-[8px] inline-flex items-center justify-center text-[var(--ws-text)] disabled:opacity-40 cursor-pointer"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleFitZoom}
            className="h-9 px-3 rounded-[8px] text-[12.5px] font-semibold text-[var(--ws-text)] tabular-nums cursor-pointer"
          >
            {zoomMode === 'fit'
              ? `ফিট (${toBnDigits(zoomPercent)}%)`
              : `${toBnDigits(zoomPercent)}%`}
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={effectiveZoom >= 1.8}
            aria-label="জুম বাড়ান"
            className="w-10 h-9 rounded-[8px] inline-flex items-center justify-center text-[var(--ws-text)] disabled:opacity-40 cursor-pointer"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
