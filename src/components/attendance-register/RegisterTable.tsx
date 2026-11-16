import React, { useEffect, useRef } from 'react';
import { Check, X, Umbrella, Users } from 'lucide-react';
import { toBn } from '../../lib/dateUtils';
import type {
  GetAttendanceFn,
  RegisterDay,
  StudentRegisterRow,
} from './types';
import { TruncatedText } from '../ui/TruncatedText';

interface RegisterTableProps {
  batchId: string;
  year: number;
  month: number;
  daysList: RegisterDay[];
  rows: StudentRegisterRow[];
  getAttendance: GetAttendanceFn;
  dailyTotals: Record<number, { present: number; absent: number }>;
  hideFridays: boolean;
  hideSummary: boolean;
  compactRows: boolean;
  loading: boolean;
  scrollTrigger: number;
}

export const RegisterTable: React.FC<RegisterTableProps> = ({
  batchId,
  year,
  month,
  daysList,
  rows,
  getAttendance,
  dailyTotals,
  hideFridays,
  hideSummary,
  compactRows,
  loading,
  scrollTrigger,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const todayColRef = useRef<HTMLTableCellElement | null>(null);

  const visibleDays = hideFridays
    ? daysList.filter((d) => !d.isFriday)
    : daysList;

  // Auto-scroll horizontally to today's column on load / month change / jump-to-current
  useEffect(() => {
    const container = scrollContainerRef.current;
    const todayTh = todayColRef.current;
    if (!container || !todayTh) return;

    const rafId = window.requestAnimationFrame(() => {
      const stickyLeftWidth = 212;
      const targetLeft = Math.max(0, todayTh.offsetLeft - stickyLeftWidth - 36);
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [year, month, hideFridays, scrollTrigger, rows.length]);

  const rowHeightClass = compactRows ? 'h-[32px]' : 'h-[36px]';
  const totalPresentAll = rows.reduce((sum, r) => sum + r.present, 0);
  const totalAbsentAll = rows.reduce((sum, r) => sum + r.absent, 0);

  if (loading) {
    return (
      <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-14 px-4 flex flex-col items-center justify-center text-[var(--reg-muted)]">
        <div className="w-7 h-7 border-3 border-[var(--reg-accent)] border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-[13px]">মাসিক হাজিরা রেজিস্টার তৈরি হচ্ছে...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-12 px-4 text-center text-[var(--reg-muted)]">
        <Users size={30} className="mx-auto mb-2 opacity-70" />
        <p className="text-[14.5px] font-medium text-[var(--reg-text)]">
          এই ফিল্টারে কোনো প্রশিক্ষণার্থী পাওয়া যায়নি
        </p>
        <p className="text-[12.5px] mt-1">
          অন্য ফিল্টার বা মেনু থেকে ব্যাচ/মাস পরিবর্তন করে দেখুন।
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-auto max-h-[75vh] relative"
      >
        <table className="w-max min-w-full table-fixed border-collapse text-[12.5px] tabular-nums select-none">
          <thead>
            <tr className="bg-[var(--reg-surface2)] text-[var(--reg-text)] border-b border-[var(--reg-border)]">
              <th
                scope="col"
                className="sticky top-0 left-0 z-30 w-[40px] px-2 py-2 text-center font-semibold bg-[var(--reg-surface2)] border-r border-[var(--reg-border)]"
              >
                #
              </th>
              <th
                scope="col"
                className="sticky top-0 left-[40px] z-30 w-[192px] px-2 py-2 text-left font-semibold bg-[var(--reg-surface2)] border-r border-[var(--reg-border)] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]"
              >
                নাম ও আইডি
              </th>

              {visibleDays.map((d) => (
                <th
                  key={d.day}
                  ref={d.isToday ? todayColRef : undefined}
                  scope="col"
                  aria-label={`${toBn(d.day)} তারিখ, ${d.dayOfWeekBn}${
                    d.isFriday ? ' (সাপ্তাহিক ছুটি)' : ''
                  }${d.isToday ? ' (আজ)' : ''}`}
                  className={`sticky top-0 z-20 w-[36px] px-2 py-1.5 text-center font-semibold border-r border-[var(--reg-border)] ${
                    d.isFriday
                      ? 'bg-[color-mix(in_srgb,var(--reg-red)_12%,var(--reg-surface2))] text-[var(--reg-red)]'
                      : 'bg-[var(--reg-surface2)] text-[var(--reg-text)]'
                  } ${
                    d.isToday
                      ? 'border-b-2 border-b-[var(--reg-accent)] bg-[color-mix(in_srgb,var(--reg-accent)_14%,var(--reg-surface2))] text-[var(--reg-accent)]'
                      : ''
                  }`}
                >
                  <div className="leading-none text-[12.5px]">{toBn(d.day)}</div>
                  <div
                    className={`text-[10px] font-normal mt-0.5 leading-none ${
                      d.isFriday
                        ? 'text-[var(--reg-red)]'
                        : d.isToday
                          ? 'text-[var(--reg-accent)] font-medium'
                          : 'text-[var(--reg-muted)]'
                    }`}
                  >
                    {d.dayOfWeekBn}
                  </div>
                </th>
              ))}

              {!hideSummary && (
                <>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 w-[56px] px-2 py-2 text-center font-semibold bg-[color-mix(in_srgb,var(--reg-green)_12%,var(--reg-surface2))] text-[var(--reg-green)] border-r border-[var(--reg-border)]"
                  >
                    উপস্থিত
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 w-[60px] px-2 py-2 text-center font-semibold bg-[color-mix(in_srgb,var(--reg-red)_12%,var(--reg-surface2))] text-[var(--reg-red)] border-r border-[var(--reg-border)]"
                  >
                    অনুপস্থিত
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 w-[44px] px-2 py-2 text-center font-semibold bg-[color-mix(in_srgb,var(--reg-amber)_12%,var(--reg-surface2))] text-[var(--reg-amber)] border-r border-[var(--reg-border)]"
                  >
                    ছুটি
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 w-[62px] px-2 py-2 text-center font-semibold bg-[var(--reg-surface2)] text-[var(--reg-text)]"
                  >
                    হার
                  </th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const t = row.trainee;
              const displayName = (t.nameBn || t.nameEn || '-').trim();
              const displayCode = (t.traineeId || t.id || '').trim();
              const isAlt = idx % 2 === 1;
              const stickyRowBg = isAlt
                ? 'bg-[color-mix(in_srgb,var(--reg-surface2)_58%,var(--reg-surface))]'
                : 'bg-[var(--reg-surface)]';

              const rateBadgeClass =
                row.rate === null
                  ? 'bg-[var(--reg-surface2)] text-[var(--reg-muted)] border-[var(--reg-border)]'
                  : row.rate >= 90
                    ? 'bg-[var(--reg-green)]/15 text-[var(--reg-green)] border-[var(--reg-green)]/30'
                    : row.rate >= 75
                      ? 'bg-[var(--reg-amber)]/15 text-[var(--reg-amber)] border-[var(--reg-amber)]/30'
                      : 'bg-[var(--reg-red)]/15 text-[var(--reg-red)] border-[var(--reg-red)]/30';

              return (
                <tr
                  key={t.id}
                  className={`${rowHeightClass} border-b border-[var(--reg-border)]/80 transition-colors ${
                    isAlt ? 'bg-[var(--reg-surface2)]/45' : 'bg-[var(--reg-surface)]'
                  } hover:bg-[var(--reg-accent)]/[0.07]`}
                >
                  {/* Sticky # */}
                  <td
                    className={`sticky left-0 z-10 px-2 text-center text-[var(--reg-muted)] border-r border-[var(--reg-border)] ${stickyRowBg}`}
                  >
                    {toBn(idx + 1)}
                  </td>

                  {/* Sticky Name & ID */}
                  <td
                    className={`sticky left-[40px] z-10 px-2 text-left border-r border-[var(--reg-border)] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.1)] ${stickyRowBg}`}
                  >
                    <div className="flex items-baseline justify-between gap-2 min-w-0 max-w-[184px]">
                      <TruncatedText
                        text={displayName}
                        mode="pop"
                        className="font-medium text-[var(--reg-text)] text-[12.5px] min-w-0 flex-1"
                      />
                      <span className="font-mono text-[10.5px] text-[var(--reg-muted)] shrink-0">
                        {displayCode}
                      </span>
                    </div>
                  </td>

                  {/* Day Status Icon Cells */}
                  {visibleDays.map((d) => {
                    const code = getAttendance(batchId, year, month, t.id, d.day);

                    let cellInner: React.ReactNode;
                    if (code === 'P') {
                      cellInner = (
                        <span
                          role="img"
                          aria-label={`${displayName}, ${toBn(d.day)} তারিখ: উপস্থিত`}
                          className="inline-flex items-center justify-center text-[var(--reg-green)]"
                        >
                          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      );
                    } else if (code === 'A') {
                      cellInner = (
                        <span
                          role="img"
                          aria-label={`${displayName}, ${toBn(d.day)} তারিখ: অনুপস্থিত`}
                          className="inline-flex items-center justify-center text-[var(--reg-red)]"
                        >
                          <X size={14} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      );
                    } else if (code === 'L') {
                      cellInner = (
                        <span
                          role="img"
                          aria-label={`${displayName}, ${toBn(d.day)} তারিখ: ছুটি`}
                          className="inline-flex items-center justify-center text-[var(--reg-amber)]"
                        >
                          <Umbrella size={13.5} strokeWidth={2.2} aria-hidden="true" />
                        </span>
                      );
                    } else {
                      cellInner = (
                        <span
                          role="img"
                          aria-label={`${displayName}, ${toBn(d.day)} তারিখ: ${
                            d.isFriday ? 'সাপ্তাহিক ছুটি' : 'তথ্য নেই'
                          }`}
                          className="text-[var(--reg-gray)]/65 font-normal"
                        >
                          -
                        </span>
                      );
                    }

                    return (
                      <td
                        key={d.day}
                        className={`px-2 text-center border-r border-[var(--reg-border)]/70 ${
                          d.isFriday
                            ? 'bg-[var(--reg-red)]/[0.08]'
                            : d.isToday
                              ? 'bg-[var(--reg-accent)]/[0.05]'
                              : ''
                        }`}
                      >
                        {cellInner}
                      </td>
                    );
                  })}

                  {/* Summary Columns */}
                  {!hideSummary && (
                    <>
                      <td className="px-2 text-center font-medium text-[var(--reg-green)] border-r border-[var(--reg-border)]/70">
                        {toBn(row.present)}
                      </td>
                      <td className="px-2 text-center font-medium text-[var(--reg-red)] border-r border-[var(--reg-border)]/70">
                        {toBn(row.absent)}
                      </td>
                      <td className="px-2 text-center font-medium text-[var(--reg-amber)] border-r border-[var(--reg-border)]/70">
                        {toBn(row.leave)}
                      </td>
                      <td className="px-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium border leading-tight ${rateBadgeClass}`}
                        >
                          {row.rate !== null ? `${toBn(row.rate)}%` : '-'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            {/* Pinned Bottom Row 1: Daily Total Present */}
            <tr className="h-[34px] text-[12px] font-medium text-[var(--reg-green)] border-t-2 border-[var(--reg-border)]">
              <td
                colSpan={2}
                className="sticky bottom-[34px] left-0 z-30 h-[34px] px-2 text-right border-r border-b border-[var(--reg-border)] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.1)] bg-[color-mix(in_srgb,var(--reg-green)_14%,var(--reg-surface))]"
              >
                দৈনিক মোট উপস্থিত
              </td>
              {visibleDays.map((d) => {
                const c = dailyTotals[d.day]?.present || 0;
                return (
                  <td
                    key={d.day}
                    className={`sticky bottom-[34px] z-20 h-[34px] px-2 text-center border-r border-b border-[var(--reg-border)] ${
                      d.isFriday
                        ? 'bg-[color-mix(in_srgb,var(--reg-red)_12%,var(--reg-surface))] text-[var(--reg-muted)]'
                        : 'bg-[color-mix(in_srgb,var(--reg-green)_14%,var(--reg-surface))]'
                    }`}
                  >
                    {!d.isFriday && c > 0 ? toBn(c) : '-'}
                  </td>
                );
              })}
              {!hideSummary && (
                <>
                  <td className="sticky bottom-[34px] z-20 h-[34px] px-2 text-center font-semibold border-r border-b border-[var(--reg-border)] bg-[color-mix(in_srgb,var(--reg-green)_22%,var(--reg-surface))]">
                    {toBn(totalPresentAll)}
                  </td>
                  <td
                    colSpan={3}
                    className="sticky bottom-[34px] z-20 h-[34px] px-2 text-center border-b border-[var(--reg-border)] bg-[color-mix(in_srgb,var(--reg-green)_14%,var(--reg-surface))]"
                  />
                </>
              )}
            </tr>

            {/* Pinned Bottom Row 2: Daily Total Absent */}
            <tr className="h-[34px] text-[12px] font-medium text-[var(--reg-red)]">
              <td
                colSpan={2}
                className="sticky bottom-0 left-0 z-30 h-[34px] px-2 text-right border-r border-[var(--reg-border)] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.1)] bg-[color-mix(in_srgb,var(--reg-red)_14%,var(--reg-surface))]"
              >
                দৈনিক মোট অনুপস্থিত
              </td>
              {visibleDays.map((d) => {
                const c = dailyTotals[d.day]?.absent || 0;
                return (
                  <td
                    key={d.day}
                    className={`sticky bottom-0 z-20 h-[34px] px-2 text-center border-r border-[var(--reg-border)] ${
                      d.isFriday
                        ? 'bg-[color-mix(in_srgb,var(--reg-red)_16%,var(--reg-surface))] text-[var(--reg-muted)]'
                        : 'bg-[color-mix(in_srgb,var(--reg-red)_14%,var(--reg-surface))]'
                    }`}
                  >
                    {!d.isFriday && c > 0 ? toBn(c) : '-'}
                  </td>
                );
              })}
              {!hideSummary && (
                <>
                  <td className="sticky bottom-0 z-20 h-[34px] px-2 text-center border-r border-[var(--reg-border)] bg-[color-mix(in_srgb,var(--reg-red)_14%,var(--reg-surface))]" />
                  <td className="sticky bottom-0 z-20 h-[34px] px-2 text-center font-semibold border-r border-[var(--reg-border)] bg-[color-mix(in_srgb,var(--reg-red)_22%,var(--reg-surface))]">
                    {toBn(totalAbsentAll)}
                  </td>
                  <td
                    colSpan={2}
                    className="sticky bottom-0 z-20 h-[34px] px-2 text-center bg-[color-mix(in_srgb,var(--reg-red)_14%,var(--reg-surface))]"
                  />
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
