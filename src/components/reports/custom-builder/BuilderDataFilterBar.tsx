import React from 'react';
import { ChevronLeft, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import type { Batch, Institute, Trade, UserProfile } from '../../../types';
import { toBn } from '../../../lib/dateUtils';
import { MONTH_NAMES_BN } from '../types';

interface BuilderDataFilterBarProps {
  userProfile: UserProfile | null;
  showMonthFilter: boolean;
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  filterInstitute: string;
  onChangeInstitute: (val: string) => void;
  filterTrade: string;
  onChangeTrade: (val: string) => void;
  filterBatch: string;
  onChangeBatch: (val: string) => void;
  statusFilter: string;
  onChangeStatus: (val: string) => void;
  selectedYear: number;
  selectedMonth: number;
  onChangeYear: (val: number) => void;
  onChangeMonth: (val: number) => void;
  rowCount: number;
  onResetFilters: () => void;
}

export const BuilderDataFilterBar: React.FC<BuilderDataFilterBarProps> = ({
  userProfile,
  showMonthFilter,
  institutes,
  trades,
  batches,
  filterInstitute,
  onChangeInstitute,
  filterTrade,
  onChangeTrade,
  filterBatch,
  onChangeBatch,
  statusFilter,
  onChangeStatus,
  selectedYear,
  selectedMonth,
  onChangeYear,
  onChangeMonth,
  rowCount,
  onResetFilters,
}) => {
  const isTrainer = userProfile?.role === 'Trainer';
  const nowYear = new Date().getFullYear();
  const yearOptions = [nowYear - 1, nowYear, nowYear + 1];

  const availableBatches = batches.filter((b) => {
    if (b.isArchived) return false;
    if (isTrainer && userProfile?.batchId) return b.id === userProfile.batchId;
    if (filterInstitute && b.instituteId !== filterInstitute) return false;
    if (filterTrade && b.tradeId !== filterTrade) return false;
    return true;
  });

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      onChangeMonth(12);
      onChangeYear(selectedYear - 1);
    } else {
      onChangeMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onChangeMonth(1);
      onChangeYear(selectedYear + 1);
    } else {
      onChangeMonth(selectedMonth + 1);
    }
  };

  return (
    <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-theme-primary" />
          <span className="text-xs sm:text-sm font-medium text-theme-text-primary">
            ব্যাচ ও তথ্যের ফিল্টার
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-theme-primary/25 bg-theme-primary-soft text-theme-primary tabular-nums whitespace-nowrap">
            {toBn(rowCount)} জন
          </span>
        </div>

        <button
          type="button"
          onClick={onResetFilters}
          className="min-h-[36px] px-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs font-medium text-theme-text-secondary inline-flex items-center gap-1 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
        >
          <RotateCcw size={13} />
          <span>রিসেট</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {!isTrainer && (
          <div>
            <label
              htmlFor="crb-filter-inst"
              className="block text-[11.5px] font-medium text-theme-text-secondary mb-1"
            >
              প্রতিষ্ঠান
            </label>
            <select
              id="crb-filter-inst"
              value={filterInstitute}
              onChange={(e) => {
                onChangeInstitute(e.target.value);
                onChangeBatch('');
              }}
              className="w-full min-h-[42px] px-2.5 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <option value="">সকল প্রতিষ্ঠান</option>
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="crb-filter-trade"
            className="block text-[11.5px] font-medium text-theme-text-secondary mb-1"
          >
            ট্রেড
          </label>
          <select
            id="crb-filter-trade"
            value={filterTrade}
            onChange={(e) => {
              onChangeTrade(e.target.value);
              onChangeBatch('');
            }}
            className="w-full min-h-[42px] px-2.5 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <option value="">সকল ট্রেড</option>
            {trades
              .filter((tr) => !tr.isArchived)
              .map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="crb-filter-batch"
            className="block text-[11.5px] font-medium text-theme-text-secondary mb-1"
          >
            ব্যাচ
          </label>
          <select
            id="crb-filter-batch"
            value={filterBatch}
            disabled={isTrainer && Boolean(userProfile?.batchId)}
            onChange={(e) => onChangeBatch(e.target.value)}
            className="w-full min-h-[42px] px-2.5 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <option value="">সকল ব্যাচ</option>
            {availableBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="crb-filter-status"
            className="block text-[11.5px] font-medium text-theme-text-secondary mb-1"
          >
            স্ট্যাটাস
          </label>
          <select
            id="crb-filter-status"
            value={statusFilter}
            onChange={(e) => onChangeStatus(e.target.value)}
            className="w-full min-h-[42px] px-2.5 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <option value="all">সকল</option>
            <option value="Active">সক্রিয়</option>
            <option value="Completed">সম্পন্ন</option>
            <option value="Dropped Out">ঝরে পড়া</option>
          </select>
        </div>
      </div>

      {showMonthFilter && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-theme-border">
          <span className="text-xs font-medium text-theme-text-secondary">
            হাজিরার মাস:
          </span>
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="আগের মাস"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <select
            aria-label="মাস নির্বাচন"
            value={selectedMonth}
            onChange={(e) => onChangeMonth(Number(e.target.value))}
            className="min-h-[40px] px-3 rounded-xl border border-theme-border bg-theme-surface-subtle text-xs sm:text-sm font-medium text-theme-text-primary cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {MONTH_NAMES_BN.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="বছর নির্বাচন"
            value={selectedYear}
            onChange={(e) => onChangeYear(Number(e.target.value))}
            className="min-h-[40px] px-3 rounded-xl border border-theme-border bg-theme-surface-subtle text-xs sm:text-sm font-medium text-theme-text-primary tabular-nums cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {toBn(yr)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="পরের মাস"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
