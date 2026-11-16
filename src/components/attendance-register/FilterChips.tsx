import React from 'react';
import { toBn } from '../../lib/dateUtils';
import { MONTH_NAMES_BN, type RateFilterValue } from './types';

interface FilterChipsProps {
  year: number;
  month: number;
  activeFilter: RateFilterValue;
  onChangeFilter: (next: RateFilterValue) => void;
}

const FILTER_OPTIONS: Array<{ value: RateFilterValue; label: string }> = [
  { value: 'all', label: 'সব উপস্থিতি হার' },
  { value: 'high_90', label: '৯০% বা বেশি' },
  { value: 'low_75', label: '৭৫% এর কম' },
  { value: 'no_data', label: 'এখনও তথ্য নেই' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({
  year,
  month,
  activeFilter,
  onChangeFilter,
}) => {
  const monthLabel = MONTH_NAMES_BN[month - 1] || '';

  return (
    <section className="space-y-2">
      <h2 className="text-[16px] font-semibold text-[var(--reg-text)] leading-snug">
        {monthLabel} {toBn(year)} — মাসিক হাজিরা রেজিস্টার
      </h2>

      <div
        role="radiogroup"
        aria-label="উপস্থিতি হার অনুযায়ী ফিল্টার"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 print:hidden"
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = activeFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChangeFilter(opt.value)}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 border transition cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)] ${
                active
                  ? 'bg-[var(--reg-accent)] text-white dark:text-slate-950 border-[var(--reg-accent)]'
                  : 'bg-[var(--reg-surface)] text-[var(--reg-muted)] border-[var(--reg-border)] hover:text-[var(--reg-text)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};
