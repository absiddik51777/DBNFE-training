import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUpDown,
  Search,
  Filter,
  Columns3,
  X,
  ChevronDown,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

export interface ColumnOption {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

export interface GroupByOption {
  id: string;
  label: string;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  valueLabel?: string;
  onRemove: () => void;
}

export interface DataTableToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  groupBy?: string;
  onGroupByChange?: (value: string) => void;
  groupByOptions?: GroupByOption[];
  groupByLabel?: string;

  filterCount: number;
  onClearAllFilters: () => void;
  activeFilterChips?: ActiveFilterChip[];
  renderFilterContent?: (closePopover: () => void) => React.ReactNode;

  columns?: ColumnOption[];
  onToggleColumn?: (columnId: string) => void;
  onResetColumns?: () => void;

  extraActions?: React.ReactNode;
}

export const DataTableToolbar: React.FC<DataTableToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'অনুসন্ধান করুন...',
  groupBy = 'none',
  onGroupByChange,
  groupByOptions = [],
  groupByLabel = 'Group by',
  filterCount,
  onClearAllFilters,
  activeFilterChips = [],
  renderFilterContent,
  columns = [],
  onToggleColumn,
  onResetColumns,
  extraActions,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [isGroupByOpen, setIsGroupByOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const groupByRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (columnsRef.current && !columnsRef.current.contains(target)) {
        setIsColumnsOpen(false);
      }
      if (groupByRef.current && !groupByRef.current.contains(target)) {
        setIsGroupByOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isFilterOpen || isColumnsOpen || isGroupByOpen) {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }
  }, [isFilterOpen, isColumnsOpen, isGroupByOpen]);

  const currentGroupLabel = groupByOptions.find((o) => o.id === groupBy)?.label;

  return (
    <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-2xs transition-all overflow-visible relative z-20">
      <div className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Group By Selector & Extra Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {groupByOptions.length > 0 && onGroupByChange && (
            <div className="relative" ref={groupByRef}>
              <button
                type="button"
                onClick={() => {
                  setIsGroupByOpen(!isGroupByOpen);
                  setIsFilterOpen(false);
                  setIsColumnsOpen(false);
                }}
                className={`h-9 px-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center space-x-2 transition cursor-pointer shrink-0 ${
                  groupBy !== 'none'
                    ? 'bg-theme-primary-soft border-theme-primary text-theme-primary-soft-fg'
                    : 'bg-theme-elevated border-theme-border text-theme-text-primary hover:bg-theme-surface-hover'
                }`}
                title="গ্রুপ বা ক্যাটাগরি অনুযায়ী সাজান"
              >
                <ArrowUpDown
                  size={14}
                  className={groupBy !== 'none' ? 'text-theme-primary' : 'text-theme-text-secondary'}
                />
                <span className="font-bold">
                  {groupBy !== 'none' && currentGroupLabel ? currentGroupLabel : groupByLabel}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-theme-text-muted transition-transform ${
                    isGroupByOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isGroupByOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
                    onClick={() => setIsGroupByOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="fixed inset-x-3 bottom-3 max-h-[75vh] md:max-h-none md:inset-auto md:absolute md:left-0 md:top-full md:mt-1.5 w-auto md:w-60 bg-theme-elevated rounded-2xl md:rounded-xl border border-theme-border shadow-2xl md:shadow-xl py-2 md:py-1.5 z-50 text-xs flex flex-col overflow-hidden">
                    <div className="w-10 h-1 bg-theme-border-strong rounded-full mx-auto my-1 md:hidden" />
                    <div className="px-3.5 py-2 text-[11px] font-bold text-theme-text-muted uppercase tracking-wider border-b border-theme-border mb-1 flex items-center justify-between">
                      <span>গ্রুপিং নির্বাচন করুন (Group By)</span>
                      <button
                        type="button"
                        onClick={() => setIsGroupByOpen(false)}
                        className="md:hidden text-theme-text-muted hover:text-theme-text-primary p-0.5 cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[60vh] md:max-h-none">
                      {groupByOptions.map((option) => {
                        const isSelected = groupBy === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              onGroupByChange(option.id);
                              setIsGroupByOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 md:py-2 text-left flex items-center justify-between hover:bg-theme-surface-hover transition cursor-pointer ${
                              isSelected
                                ? 'font-bold text-theme-primary bg-theme-primary-soft'
                                : 'text-theme-text-primary'
                            }`}
                          >
                            <span>{option.label}</span>
                            {isSelected && <Check size={14} className="text-theme-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {extraActions}
        </div>

        {/* Right: Search + Filter + Columns */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <div className="relative flex-1 md:w-64 lg:w-72 min-w-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted"
              size={15}
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-9 pl-9 pr-7 bg-theme-surface-subtle border border-theme-border rounded-xl text-xs sm:text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:bg-theme-elevated focus:outline-none focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text-primary p-0.5 rounded-full hover:bg-theme-surface-hover cursor-pointer text-xs"
                title="অনুসন্ধান মুছুন"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {renderFilterContent && (
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => {
                  setIsFilterOpen(!isFilterOpen);
                  setIsColumnsOpen(false);
                  setIsGroupByOpen(false);
                }}
                className={`relative h-9 px-2.5 sm:px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition cursor-pointer shrink-0 ${
                  filterCount > 0 || isFilterOpen
                    ? 'bg-theme-warning-soft border-theme-warning-border text-theme-warning'
                    : 'bg-theme-elevated border-theme-border text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text-primary'
                }`}
                title="ফিল্টার অপশন দেখুন"
              >
                <Filter size={15} />
                <span className="hidden sm:inline text-xs font-semibold">ফিল্টার</span>

                {filterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-theme-warning text-theme-warning-fg text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-theme-surface tabular-nums">
                    {filterCount}
                  </span>
                )}
              </button>

              {isFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
                    onClick={() => setIsFilterOpen(false)}
                    aria-hidden="true"
                  />

                  <div className="fixed inset-x-2 sm:inset-x-4 bottom-2 sm:bottom-4 max-h-[88vh] md:max-h-[640px] z-50 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 w-auto md:w-[480px] bg-theme-elevated rounded-2xl border border-theme-border shadow-2xl flex flex-col text-theme-text-primary overflow-hidden">
                    <div className="w-10 h-1 bg-theme-border-strong rounded-full mx-auto mt-2 md:hidden shrink-0" />

                    <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-theme-border shrink-0">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-theme-warning-soft text-theme-warning flex items-center justify-center shrink-0">
                          <Filter size={15} />
                        </div>
                        <h4 className="text-sm font-bold text-theme-text-primary">
                          ফিল্টারসমূহ (Filters)
                        </h4>
                        {filterCount > 0 && (
                          <span className="bg-theme-warning-soft text-theme-warning border border-theme-warning-border text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums">
                            {filterCount}টি সক্রিয়
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {filterCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onClearAllFilters()}
                            className="text-xs text-theme-danger font-semibold hover:underline cursor-pointer"
                          >
                            রিসেট করুন
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsFilterOpen(false)}
                          className="text-theme-text-muted hover:text-theme-text-primary p-1.5 rounded-lg hover:bg-theme-surface-hover cursor-pointer"
                          aria-label="ফিল্টার বন্ধ করুন"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 py-3 overflow-y-auto max-h-[60vh] space-y-3.5 flex-1">
                      {renderFilterContent(() => setIsFilterOpen(false))}
                    </div>

                    <div className="p-3.5 sm:p-5 pt-3 border-t border-theme-border flex items-center justify-between shrink-0 bg-theme-surface-subtle">
                      <button
                        type="button"
                        onClick={() => onClearAllFilters()}
                        disabled={filterCount === 0}
                        className="text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary disabled:opacity-40 cursor-pointer py-1.5 px-1"
                      >
                        ফিল্টার ক্লিয়ার
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                      >
                        প্রয়োগ করুন (Apply)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {columns.length > 0 && onToggleColumn && (
            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                onClick={() => {
                  setIsColumnsOpen(!isColumnsOpen);
                  setIsFilterOpen(false);
                  setIsGroupByOpen(false);
                }}
                className={`h-9 px-2.5 rounded-xl border flex items-center justify-center space-x-1.5 transition cursor-pointer shrink-0 ${
                  isColumnsOpen
                    ? 'bg-theme-surface-subtle border-theme-border-strong text-theme-text-primary'
                    : 'bg-theme-elevated border-theme-border text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text-primary'
                }`}
                title="কলাম দৃশ্যমানতা (Show / Hide Columns)"
              >
                <Columns3 size={15} />
                <span className="hidden sm:inline text-xs font-semibold">কলাম</span>
              </button>

              {isColumnsOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
                    onClick={() => setIsColumnsOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="fixed inset-x-3 bottom-3 max-h-[75vh] md:max-h-none md:inset-auto md:absolute md:right-0 md:top-full md:mt-2 w-auto md:w-64 bg-theme-elevated rounded-2xl border border-theme-border shadow-2xl p-4 md:p-3 z-50 text-xs text-theme-text-primary flex flex-col overflow-hidden">
                    <div className="w-10 h-1 bg-theme-border-strong rounded-full mx-auto mb-2 md:hidden shrink-0" />
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme-border shrink-0">
                      <div className="flex items-center space-x-1.5">
                        <SlidersHorizontal size={14} className="text-theme-text-secondary" />
                        <span className="font-bold text-theme-text-primary">কলাম প্রদর্শন নিয়ন্ত্রণ</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {onResetColumns && (
                          <button
                            type="button"
                            onClick={onResetColumns}
                            className="text-[11px] text-theme-primary font-semibold hover:underline flex items-center space-x-0.5 cursor-pointer"
                            title="ডিফল্ট কলাম ভিউতে ফিরে যান"
                          >
                            <RotateCcw size={11} />
                            <span>রিসেট</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsColumnsOpen(false)}
                          className="md:hidden text-theme-text-muted hover:text-theme-text-primary p-0.5 cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                      {columns.map((col) => (
                        <label
                          key={col.id}
                          className={`flex items-center space-x-2.5 px-2.5 py-2 md:py-1.5 rounded-lg transition cursor-pointer ${
                            col.visible
                              ? 'hover:bg-theme-surface-hover text-theme-text-primary'
                              : 'text-theme-text-muted hover:bg-theme-surface-hover'
                          } ${col.required ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={col.visible}
                            disabled={col.required}
                            onChange={() => !col.required && onToggleColumn(col.id)}
                            className="rounded border-theme-border text-theme-primary focus:ring-theme-primary w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium flex-1 select-none">{col.label}</span>
                          {col.required && (
                            <span className="text-[10px] text-theme-text-muted font-normal">
                              (বাধ্যতামূলক)
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Strip */}
      {activeFilterChips.length > 0 && (
        <div className="px-3.5 py-2 bg-theme-surface-subtle border-t border-theme-border flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-theme-text-secondary">Active filters:</span>

            {activeFilterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center space-x-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-theme-warning-soft text-theme-warning border border-theme-warning-border"
              >
                {chip.valueLabel ? (
                  <>
                    <span className="font-semibold text-theme-text-secondary">{chip.label}:</span>
                    <span className="font-bold">{chip.valueLabel}</span>
                  </>
                ) : (
                  <span className="font-bold">{chip.label}</span>
                )}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-theme-surface/50 transition cursor-pointer"
                  title="ফিল্টার সরান"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={onClearAllFilters}
            className="w-6 h-6 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover flex items-center justify-center transition cursor-pointer ml-auto"
            title="সকল ফিল্টার মুছুন (Clear all filters)"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DataTableToolbar;
