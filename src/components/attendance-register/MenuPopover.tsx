import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RotateCcw,
} from 'lucide-react';
import type { Batch } from '../../types';
import { toBn } from '../../lib/dateUtils';
import { MONTH_NAMES_BN } from './types';
import { TruncatedText } from '../ui/TruncatedText';

interface MenuPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  batches: Batch[];
  selectedBatchId: string;
  onSelectBatch: (batchId: string) => void;
  canSwitchBatch: boolean;
  year: number;
  month: number;
  onChangeYear: (year: number) => void;
  onChangeMonth: (month: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToCurrentMonth: () => void;
  hideFridays: boolean;
  onToggleHideFridays: () => void;
  hideSummary: boolean;
  onToggleHideSummary: () => void;
  compactRows: boolean;
  onToggleCompactRows: () => void;
  onPrint: () => void;
  canExport: boolean;
  onOpenExport: () => void;
}

export const MenuPopover: React.FC<MenuPopoverProps> = ({
  open,
  onClose,
  triggerRef,
  batches,
  selectedBatchId,
  onSelectBatch,
  canSwitchBatch,
  year,
  month,
  onChangeYear,
  onChangeMonth,
  onPrevMonth,
  onNextMonth,
  onJumpToCurrentMonth,
  hideFridays,
  onToggleHideFridays,
  hideSummary,
  onToggleHideSummary,
  compactRows,
  onToggleCompactRows,
  onPrint,
  canExport,
  onOpenExport,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [batchListExpanded, setBatchListExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setBatchListExpanded(false);
      return;
    }

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const currentBatch = batches.find((b) => b.id === selectedBatchId);
  const years = [2024, 2025, 2026, 2027, 2028];

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="রেজিস্টার সেটিংস ও এক্সপোর্ট মেনু"
      className="absolute right-0 top-[40px] z-40 w-[290px] max-w-[calc(100vw-24px)] rounded-[16px] bg-[var(--reg-surface)] text-[var(--reg-text)] border border-[var(--reg-border)] shadow-2xl p-3 space-y-3"
    >
      {/* 1. Expandable Batch Selector */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => canSwitchBatch && setBatchListExpanded((prev) => !prev)}
          aria-expanded={batchListExpanded}
          disabled={!canSwitchBatch && batches.length <= 1}
          className="w-full min-h-[38px] px-2.5 py-2 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] flex items-center justify-between gap-2 text-left cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
        >
          <span className="text-[13px] font-medium text-[var(--reg-muted)] shrink-0">
            ব্যাচ
          </span>
          <span className="flex items-center gap-1 min-w-0">
            <TruncatedText
              text={currentBatch?.name || 'নির্বাচিত নয়'}
              mode="pop"
              className="text-[13px] font-medium text-[var(--reg-text)] min-w-0"
            />
            {canSwitchBatch && batches.length > 1 && (
              <ChevronDown
                size={15}
                className={`text-[var(--reg-muted)] shrink-0 transition-transform ${
                  batchListExpanded ? 'rotate-180' : ''
                }`}
              />
            )}
          </span>
        </button>

        {batchListExpanded && (
          <div
            role="radiogroup"
            aria-label="ব্যাচ তালিকা"
            className="max-h-44 overflow-y-auto rounded-xl border border-[var(--reg-border)] bg-[var(--reg-bg)] p-1 space-y-0.5"
          >
            {batches.map((b) => {
              const active = b.id === selectedBatchId;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    onSelectBatch(b.id);
                    setBatchListExpanded(false);
                  }}
                  className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg text-[13px] flex items-center justify-between gap-2 text-left cursor-pointer ${
                    active
                      ? 'bg-[var(--reg-accent)]/14 text-[var(--reg-accent)] font-medium'
                      : 'text-[var(--reg-text)] hover:bg-[var(--reg-surface2)]'
                  }`}
                >
                  <TruncatedText text={b.name} mode="pop" className="min-w-0" />
                  {active && <Check size={15} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Year & Month Controls + Return to Current Month */}
      <div className="space-y-2 pt-2 border-t border-[var(--reg-border)]">
        <select
          value={year}
          onChange={(e) => onChangeYear(Number(e.target.value))}
          aria-label="বছর নির্বাচন"
          className="w-full min-h-[36px] px-2.5 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[13.5px] text-[var(--reg-text)] tabular-nums focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
        >
          {years.map((yr) => (
            <option key={yr} value={yr}>
              {toBn(yr)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="আগের মাস"
            className="w-9 h-9 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[var(--reg-text)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <ChevronLeft size={16} />
          </button>

          <select
            value={month}
            onChange={(e) => onChangeMonth(Number(e.target.value))}
            aria-label="মাস নির্বাচন"
            className="flex-1 min-w-0 min-h-[36px] px-2 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[13.5px] text-[var(--reg-text)] focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            {MONTH_NAMES_BN.map((mName, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {mName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onNextMonth}
            aria-label="পরের মাস"
            className="w-9 h-9 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[var(--reg-text)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onJumpToCurrentMonth();
            onClose();
          }}
          className="w-full min-h-[36px] px-3 rounded-xl bg-[var(--reg-accent)]/12 border border-[var(--reg-accent)]/30 text-[var(--reg-accent)] text-[13px] font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
        >
          <RotateCcw size={14} />
          <span>চলতি মাসে ফিরুন</span>
        </button>
      </div>

      {/* 3. Display Checkboxes */}
      <div className="space-y-1 pt-2 border-t border-[var(--reg-border)]">
        <label className="min-h-[34px] px-2 rounded-lg hover:bg-[var(--reg-surface2)] flex items-center justify-between gap-2 cursor-pointer text-[13.5px]">
          <span>শুক্রবারের কলাম লুকান</span>
          <input
            type="checkbox"
            checked={hideFridays}
            onChange={onToggleHideFridays}
            className="w-4 h-4 accent-[var(--reg-accent)] rounded cursor-pointer"
          />
        </label>

        <label className="min-h-[34px] px-2 rounded-lg hover:bg-[var(--reg-surface2)] flex items-center justify-between gap-2 cursor-pointer text-[13.5px]">
          <span>সারসংক্ষেপ কলাম লুকান</span>
          <input
            type="checkbox"
            checked={hideSummary}
            onChange={onToggleHideSummary}
            className="w-4 h-4 accent-[var(--reg-accent)] rounded cursor-pointer"
          />
        </label>

        <label className="min-h-[34px] px-2 rounded-lg hover:bg-[var(--reg-surface2)] flex items-center justify-between gap-2 cursor-pointer text-[13.5px]">
          <span>কমপ্যাক্ট সারি</span>
          <input
            type="checkbox"
            checked={compactRows}
            onChange={onToggleCompactRows}
            className="w-4 h-4 accent-[var(--reg-accent)] rounded cursor-pointer"
          />
        </label>
      </div>

      {/* 4. Print & Export Actions */}
      <div className="space-y-1.5 pt-2 border-t border-[var(--reg-border)]">
        <button
          type="button"
          onClick={() => {
            onClose();
            onPrint();
          }}
          className="w-full min-h-[38px] px-3 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[var(--reg-text)] text-[13.5px] font-medium flex items-center justify-center gap-2 hover:border-[var(--reg-accent)] cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
        >
          <Printer size={15} />
          <span>প্রিন্ট করুন</span>
        </button>

        {canExport && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenExport();
            }}
            className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--reg-accent)] text-white dark:text-slate-950 text-[13.5px] font-medium flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <Download size={15} />
            <span>এক্সপোর্ট</span>
          </button>
        )}
      </div>
    </div>
  );
};
