import React from 'react';
import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { AUDIT_MODULE_CHIPS } from '../../lib/auditQueryBuilder';
import { FilterChip } from './FilterChip';

interface AuditFilterBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  selectedModule: string;
  onSelectModule: (moduleKey: string) => void;
  activeSheetFilterCount: number;
  activeSheetSummaryText: string;
  resultCount: number;
  hasMoreLogs: boolean;
  loadingLogs: boolean;
  hasAnyActiveFilter: boolean;
  onOpenSheet: () => void;
  onRefresh: () => void;
  onClearAll: () => void;
  filterButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export const AuditFilterBar: React.FC<AuditFilterBarProps> = ({
  searchInput,
  onSearchChange,
  selectedModule,
  onSelectModule,
  activeSheetFilterCount,
  activeSheetSummaryText,
  resultCount,
  hasMoreLogs,
  loadingLogs,
  hasAnyActiveFilter,
  onOpenSheet,
  onRefresh,
  onClearAll,
  filterButtonRef,
}) => {
  return (
    <div className="space-y-2.5">
      {/* Row 1: 44px compact Search + Filter + Refresh */}
      <div className="flex items-center gap-2 h-11 min-h-[44px]">
        <div className="relative flex-1 min-w-0 h-11">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
          />
          <input
            type="text"
            inputMode="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="নাম বা শিরোনাম খুঁজুন"
            aria-label="নাম বা শিরোনাম খুঁজুন"
            className={`w-full h-11 pl-9 ${
              searchInput ? 'pr-10' : 'pr-3'
            } rounded-[12px] bg-theme-surface border border-theme-border text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary`}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="অনুসন্ধান মুছুন"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-[10px] text-theme-text-muted hover:text-theme-text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Sheet Trigger with active sheet count badge */}
        <button
          ref={filterButtonRef}
          type="button"
          onClick={onOpenSheet}
          aria-label={
            activeSheetFilterCount > 0
              ? `ফিল্টার (${activeSheetFilterCount} টি সক্রিয়)`
              : 'ফিল্টার'
          }
          className="relative h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none"
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          {activeSheetFilterCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-theme-primary text-theme-primary-fg text-[10px] font-bold leading-none inline-flex items-center justify-center tabular-nums"
            >
              {activeSheetFilterCount}
            </span>
          )}
        </button>

        {/* Refresh Icon Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loadingLogs}
          aria-label="রিফ্রেশ"
          className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-[12px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition-colors disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none"
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
            className={loadingLogs ? 'animate-spin motion-reduce:animate-none' : ''}
          />
        </button>
      </div>

      {/* Row 2: Horizontally scrollable module chip row (wraps on md+ if space permits) */}
      <div
        role="group"
        aria-label="মডিউল ফিল্টার"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible py-0.5 -mx-0.5 px-0.5"
      >
        {AUDIT_MODULE_CHIPS.map((chip) => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            selected={selectedModule === chip.id}
            onClick={() => onSelectModule(chip.id)}
          />
        ))}
      </div>

      {/* Row 3: Compact summary line (active sheet filters text · N টি এন্ট্রি · ফিল্টার মুছুন) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-theme-text-secondary px-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
          {activeSheetSummaryText && (
            <>
              <span className="font-medium text-theme-text-primary truncate max-w-[240px] sm:max-w-none">
                {activeSheetSummaryText}
              </span>
              <span aria-hidden="true" className="text-theme-text-muted">
                ·
              </span>
            </>
          )}
          <span aria-live="polite" className="tabular-nums text-theme-text-secondary">
            {loadingLogs
              ? 'লোড হচ্ছে...'
              : `${resultCount}${hasMoreLogs ? '+' : ''} টি এন্ট্রি`}
          </span>
        </div>

        {hasAnyActiveFilter && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-theme-primary hover:underline py-1 px-1 -mr-1 rounded focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            ফিল্টার মুছুন
          </button>
        )}
      </div>
    </div>
  );
};
