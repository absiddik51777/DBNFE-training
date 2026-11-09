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
  SlidersHorizontal
} from 'lucide-react';

export interface ColumnOption {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean; // Cannot be hidden
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
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Group By
  groupBy?: string;
  onGroupByChange?: (value: string) => void;
  groupByOptions?: GroupByOption[];
  groupByLabel?: string;

  // Filters
  filterCount: number;
  onClearAllFilters: () => void;
  activeFilterChips?: ActiveFilterChip[];
  renderFilterContent?: (closePopover: () => void) => React.ReactNode;

  // Column Visibility
  columns?: ColumnOption[];
  onToggleColumn?: (columnId: string) => void;
  onResetColumns?: () => void;

  // Optional custom actions (e.g. view mode switcher, export buttons)
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
  extraActions
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [isGroupByOpen, setIsGroupByOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const groupByRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
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

  // Prevent background scroll on mobile when any modal/sheet is open
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

  const currentGroupLabel = groupByOptions.find(o => o.id === groupBy)?.label;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs transition-all overflow-visible relative z-20">
      {/* ======================================================== */}
      {/* 1. TOP TOOLBAR ROW (Group By | Search + Filter + Columns)*/}
      {/* ======================================================== */}
      <div className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Group By Selector & Extra Left Content */}
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
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                }`}
                title="গ্রুপ বা ক্যাটাগরি অনুযায়ী সাজান"
              >
                <ArrowUpDown size={14} className={groupBy !== 'none' ? 'text-emerald-700' : 'text-slate-500'} />
                <span className="font-bold text-slate-800">
                  {groupBy !== 'none' && currentGroupLabel ? currentGroupLabel : groupByLabel}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isGroupByOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Group By Dropdown Menu (Bottom Sheet on Mobile, Anchored on Desktop) */}
              {isGroupByOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
                    onClick={() => setIsGroupByOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="fixed inset-x-3 bottom-3 max-h-[75vh] md:max-h-none md:inset-auto md:absolute md:left-0 md:top-full md:mt-1.5 w-auto md:w-60 bg-white rounded-2xl md:rounded-xl border border-slate-200 shadow-2xl md:shadow-xl py-2 md:py-1.5 z-50 text-xs flex flex-col overflow-hidden">
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto my-1 md:hidden" />
                    <div className="px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>গ্রুপিং নির্বাচন করুন (Group By)</span>
                      <button
                        type="button"
                        onClick={() => setIsGroupByOpen(false)}
                        className="md:hidden text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[60vh] md:max-h-none">
                      {groupByOptions.map(option => {
                        const isSelected = groupBy === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              onGroupByChange(option.id);
                              setIsGroupByOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 md:py-2 text-left flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                              isSelected ? 'font-bold text-emerald-700 bg-emerald-50/60' : 'text-slate-700'
                            }`}
                          >
                            <span>{option.label}</span>
                            {isSelected && <Check size={14} className="text-emerald-600" />}
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

        {/* Right: Search + Filter Icon with Badge + Columns Toggle Icon */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64 lg:w-72 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-9 pl-9 pr-7 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50 cursor-pointer text-xs"
                title="অনুসন্ধান মুছুন"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Popover Trigger */}
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
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs ring-1 ring-amber-500/20'
                    : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                }`}
                title="ফিল্টার অপশন দেখুন"
              >
                <Filter size={15} className={filterCount > 0 ? 'text-amber-600 fill-amber-600/30' : 'text-slate-600'} />
                <span className="hidden sm:inline text-xs font-semibold">ফিল্টার</span>

                {/* Filter Count Badge (Orange/Amber badge matching screenshot) */}
                {filterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-amber-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs border-2 border-white">
                    {filterCount}
                  </span>
                )}
              </button>

              {/* Filter Sheet: Fixed bottom modal on Mobile, Anchored Popover on Desktop */}
              {isFilterOpen && (
                <>
                  {/* Backdrop on mobile */}
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
                    onClick={() => setIsFilterOpen(false)}
                    aria-hidden="true"
                  />

                  {/* Filter Container */}
                  <div className="fixed inset-x-2 sm:inset-x-4 bottom-2 sm:bottom-4 max-h-[88vh] md:max-h-[640px] z-50 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 w-auto md:w-[480px] bg-white rounded-2xl border border-slate-200/90 shadow-2xl flex flex-col text-slate-800 overflow-hidden">
                    {/* Mobile drag bar */}
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2 md:hidden shrink-0" />

                    {/* Popover Header */}
                    <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 shrink-0">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Filter size={15} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">ফিল্টারসমূহ (Filters)</h4>
                        {filterCount > 0 && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            {filterCount}টি সক্রিয়
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {filterCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onClearAllFilters();
                            }}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold hover:underline cursor-pointer"
                          >
                            রিসেট করুন
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsFilterOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                          aria-label="ফিল্টার বন্ধ করুন"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Render page-specific filter fields */}
                    <div className="p-4 sm:p-5 py-3 overflow-y-auto max-h-[60vh] space-y-3.5 flex-1">
                      {renderFilterContent(() => setIsFilterOpen(false))}
                    </div>

                    {/* Popover Footer */}
                    <div className="p-3.5 sm:p-5 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
                      <button
                        type="button"
                        onClick={() => onClearAllFilters()}
                        disabled={filterCount === 0}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:hover:text-slate-500 cursor-pointer py-1.5 px-1"
                      >
                        ফিল্টার ক্লিয়ার
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                      >
                        প্রয়োগ করুন (Apply)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Column Show/Hide Popover Trigger */}
          {columns.length > 0 && onToggleColumn && (
            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                onClick={() => {
                  setIsColumnsOpen(!isColumnsOpen);
                  setIsFilterOpen(false);
                  setIsGroupByOpen(false);
                }}
                className={`h-9 px-2.5 sm:px-2.5 rounded-xl border flex items-center justify-center space-x-1.5 transition cursor-pointer shrink-0 ${
                  isColumnsOpen
                    ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                }`}
                title="কলাম দৃশ্যমানতা (Show / Hide Columns)"
              >
                <Columns3 size={15} className="text-slate-600" />
                <span className="hidden sm:inline text-xs font-semibold">কলাম</span>
              </button>

              {/* Columns Visibility Dropdown (Bottom Sheet on Mobile, Anchored on Desktop) */}
              {isColumnsOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
                    onClick={() => setIsColumnsOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="fixed inset-x-3 bottom-3 max-h-[75vh] md:max-h-none md:inset-auto md:absolute md:right-0 md:top-full md:mt-2 w-auto md:w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 md:p-3 z-50 text-xs text-slate-800 flex flex-col overflow-hidden">
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2 md:hidden shrink-0" />
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
                      <div className="flex items-center space-x-1.5">
                        <SlidersHorizontal size={14} className="text-slate-500" />
                        <span className="font-bold text-slate-800">কলাম প্রদর্শন নিয়ন্ত্রণ</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {onResetColumns && (
                          <button
                            type="button"
                            onClick={onResetColumns}
                            className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold hover:underline flex items-center space-x-0.5 cursor-pointer"
                            title="ডিফল্ট কলাম ভিউতে ফিরে যান"
                          >
                            <RotateCcw size={11} />
                            <span>রিসেট</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsColumnsOpen(false)}
                          className="md:hidden text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                      {columns.map(col => {
                        return (
                          <label
                            key={col.id}
                            className={`flex items-center space-x-2.5 px-2.5 py-2 md:py-1.5 rounded-lg transition cursor-pointer ${
                              col.visible ? 'hover:bg-slate-50 text-slate-800' : 'text-slate-400 hover:bg-slate-50'
                            } ${col.required ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={col.visible}
                              disabled={col.required}
                              onChange={() => !col.required && onToggleColumn(col.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-medium flex-1 select-none">{col.label}</span>
                            {col.required && (
                              <span className="text-[10px] text-slate-400 font-normal">(বাধ্যতামূলক)</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. ACTIVE FILTERS STRIP (Matching screenshot)            */}
      {/* ======================================================== */}
      {activeFilterChips.length > 0 && (
        <div className="px-3.5 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-600">Active filters:</span>
            
            {activeFilterChips.map(chip => (
              <span
                key={chip.id}
                className="inline-flex items-center space-x-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-amber-50/90 text-amber-900 border border-amber-200/90 shadow-2xs"
              >
                {chip.valueLabel ? (
                  <>
                    <span className="font-semibold text-slate-600">{chip.label}:</span>
                    <span className="font-bold text-amber-950">{chip.valueLabel}</span>
                  </>
                ) : (
                  <span className="font-bold text-amber-950">{chip.label}</span>
                )}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-amber-700 hover:bg-amber-200/80 hover:text-amber-950 transition cursor-pointer"
                  title="ফিল্টার সরান"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          {/* Clear all active filters button (matching screenshot '✕' at right) */}
          <button
            type="button"
            onClick={onClearAllFilters}
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer ml-auto"
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
