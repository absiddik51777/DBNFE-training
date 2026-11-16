import React from 'react';
import { toBn } from '../../lib/dateUtils';

interface StatsProps {
  totalStudents: number;
  takenDaysCount: number;
  avgRate: number;
  totalAbsences: number;
}

export const Stats: React.FC<StatsProps> = ({
  totalStudents,
  takenDaysCount,
  avgRate,
  totalAbsences,
}) => {
  return (
    <section
      aria-label="মাসিক হাজিরার সারসংক্ষেপ"
      className="grid grid-cols-2 min-[700px]:grid-cols-4 gap-2.5 tabular-nums print:hidden"
    >
      <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-2 px-3">
        <div className="text-[12px] text-[var(--reg-muted)] leading-snug">
          মোট প্রশিক্ষণার্থী
        </div>
        <div className="text-[19px] font-semibold text-[var(--reg-text)] mt-0.5 leading-tight">
          {toBn(totalStudents)} জন
        </div>
      </div>

      <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-2 px-3">
        <div className="text-[12px] text-[var(--reg-muted)] leading-snug">
          হাজিরা নেওয়া দিন
        </div>
        <div className="text-[19px] font-semibold text-[var(--reg-text)] mt-0.5 leading-tight">
          {toBn(takenDaysCount)} দিন
        </div>
      </div>

      <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-2 px-3">
        <div className="text-[12px] text-[var(--reg-muted)] leading-snug">
          গড় উপস্থিতি হার
        </div>
        <div className="text-[19px] font-semibold text-[var(--reg-green)] mt-0.5 leading-tight">
          {toBn(avgRate)}%
        </div>
      </div>

      <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-2 px-3">
        <div className="text-[12px] text-[var(--reg-muted)] leading-snug">
          মোট অনুপস্থিতি
        </div>
        <div className="text-[19px] font-semibold text-[var(--reg-red)] mt-0.5 leading-tight">
          {toBn(totalAbsences)} বার
        </div>
      </div>
    </section>
  );
};
