import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RotateCcw,
} from 'lucide-react';
import type {
  AttendanceRecord,
  Batch,
  Institute,
  Trade,
  Trainee,
  UserProfile,
} from '../../../types';
import { downloadCSV, printCurrentDocument } from '../../../lib/exportUtils';
import { formatBengaliDate, toBn } from '../../../lib/dateUtils';
import { MONTH_NAMES_BN, ReportsToast } from '../types';

interface MonthlyAttendanceReportProps {
  userProfile: UserProfile | null;
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  trainees: Trainee[];
  attendance: AttendanceRecord[];
  canExport: boolean;
  onNotify: (toast: ReportsToast) => void;
}

export const MonthlyAttendanceReport: React.FC<MonthlyAttendanceReportProps> = ({
  userProfile,
  institutes,
  trades,
  batches,
  trainees,
  attendance,
  canExport,
  onNotify,
}) => {
  const isTrainer = userProfile?.role === 'Trainer';
  const now = useMemo(() => new Date(), []);

  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const trainerBatch = useMemo(
    () =>
      isTrainer && userProfile?.batchId
        ? batches.find((b) => b.id === userProfile.batchId) || null
        : null,
    [isTrainer, userProfile?.batchId, batches]
  );

  const [filterInstitute, setFilterInstitute] = useState<string>(() =>
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : ''
  );
  const [filterTrade, setFilterTrade] = useState<string>(() =>
    trainerBatch?.tradeId || ''
  );
  const [filterBatch, setFilterBatch] = useState<string>(() =>
    isTrainer && userProfile?.batchId ? userProfile.batchId : ''
  );
  const [exporting, setExporting] = useState(false);

  const effectiveInstitute =
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : filterInstitute;
  const effectiveBatch =
    isTrainer && userProfile?.batchId ? userProfile.batchId : filterBatch;
  const effectiveTrade =
    isTrainer && trainerBatch?.tradeId ? trainerBatch.tradeId : filterTrade;

  const yearOptions = useMemo(() => {
    const currentY = now.getFullYear();
    return [currentY - 1, currentY, currentY + 1];
  }, [now]);

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES_BN[selectedMonth - 1] || ''} ${toBn(selectedYear)}`;

  const availableBatches = useMemo(() => {
    return batches.filter((b) => {
      if (effectiveInstitute && b.instituteId !== effectiveInstitute) return false;
      if (effectiveTrade && b.tradeId !== effectiveTrade) return false;
      return true;
    });
  }, [batches, effectiveInstitute, effectiveTrade]);

  const scopedTrainees = useMemo(() => {
    return trainees
      .filter((t) => {
        if (t.status === 'Archived') return false;
        if (effectiveInstitute && t.instituteId !== effectiveInstitute) return false;
        if (effectiveTrade && t.tradeId !== effectiveTrade) return false;
        if (effectiveBatch && t.batchId !== effectiveBatch) return false;
        return true;
      })
      .sort((a, b) =>
        (a.registrationNumber || a.traineeId || a.id).localeCompare(
          b.registrationNumber || b.traineeId || b.id,
          undefined,
          { numeric: true }
        )
      );
  }, [trainees, effectiveInstitute, effectiveTrade, effectiveBatch]);

  const getInstituteName = (id?: string) =>
    institutes.find((i) => i.id === id)?.name || '—';
  const getTradeName = (id?: string) =>
    trades.find((t) => t.id === id)?.name || '—';
  const getBatchName = (id?: string) =>
    batches.find((b) => b.id === id)?.name || '—';

  const { rows, summary } = useMemo(() => {
    const traineeIds = new Set(scopedTrainees.map((t) => t.id));
    const monthlyAttendance = attendance.filter(
      (a) =>
        a.date &&
        a.date.startsWith(monthPrefix) &&
        traineeIds.has(a.traineeId)
    );

    const activeDates = new Set<string>();
    const perTrainee = new Map<
      string,
      { present: number; absent: number; leave: number }
    >();

    for (const rec of monthlyAttendance) {
      activeDates.add(rec.date);
      const entry = perTrainee.get(rec.traineeId) || {
        present: 0,
        absent: 0,
        leave: 0,
      };
      if (rec.status === 'Present') entry.present += 1;
      else if (rec.status === 'Absent') entry.absent += 1;
      else if (rec.status === 'Leave') entry.leave += 1;
      perTrainee.set(rec.traineeId, entry);
    }

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalRecorded = 0;

    const computedRows = scopedTrainees.map((trainee) => {
      const counts = perTrainee.get(trainee.id) || {
        present: 0,
        absent: 0,
        leave: 0,
      };
      const recorded = counts.present + counts.absent + counts.leave;
      const rate = recorded > 0 ? Math.round((counts.present / recorded) * 100) : null;

      totalPresent += counts.present;
      totalAbsent += counts.absent;
      totalLeave += counts.leave;
      totalRecorded += recorded;

      return {
        trainee,
        present: counts.present,
        absent: counts.absent,
        leave: counts.leave,
        recorded,
        rate,
      };
    });

    const avgRate =
      totalRecorded > 0 ? Math.round((totalPresent / totalRecorded) * 100) : 0;

    return {
      rows: computedRows,
      summary: {
        totalTrainees: computedRows.length,
        recordedDays: activeDates.size,
        avgRate,
        totalPresent,
        totalAbsent,
        totalLeave,
      },
    };
  }, [scopedTrainees, attendance, monthPrefix]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetFilters = () => {
    if (!isTrainer) {
      setFilterInstitute('');
      setFilterTrade('');
      setFilterBatch('');
    }
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const headers = [
        'ক্রঃ',
        'রেজিঃ নম্বর',
        'প্রশিক্ষণার্থীর নাম',
        'প্রতিষ্ঠান',
        'ট্রেড',
        'ব্যাচ',
        'মোট ক্লাস',
        'উপস্থিত',
        'অনুপস্থিত',
        'ছুটি',
        'উপস্থিতির হার (%)',
      ];
      const csvRows = rows.map((r, idx) => [
        idx + 1,
        r.trainee.registrationNumber || r.trainee.traineeId || '',
        r.trainee.nameBn || r.trainee.nameEn || '',
        getInstituteName(r.trainee.instituteId),
        getTradeName(r.trainee.tradeId),
        getBatchName(r.trainee.batchId),
        r.recorded,
        r.present,
        r.absent,
        r.leave,
        r.rate !== null ? `${r.rate}%` : '—',
      ]);

      const res = await downloadCSV(
        `bnfe_monthly_attendance_${monthPrefix}`,
        headers,
        csvRows
      );
      onNotify({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। আবার চেষ্টা করুন।';
      onNotify({ type: 'error', message });
    } finally {
      setExporting(false);
    }
  };

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* Filter & Export Bar */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="আগের মাস"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <ChevronLeft size={18} />
            </button>

            <select
              aria-label="মাস নির্বাচন"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="min-h-[44px] px-3 rounded-xl border border-theme-border bg-theme-surface-subtle text-sm font-medium text-theme-text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="min-h-[44px] px-3 rounded-xl border border-theme-border bg-theme-surface-subtle text-sm font-medium text-theme-text-primary tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
              className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isTrainer && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-3.5 rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs sm:text-sm font-medium text-theme-text-secondary inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <RotateCcw size={15} />
                <span>রিসেট</span>
              </button>
            )}

            {canExport && (
              <>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={handleExportCSV}
                  className="min-h-[44px] px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <Download size={16} />
                  <span>{exporting ? 'সংরক্ষণ হচ্ছে...' : 'CSV এক্সপোর্ট'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printCurrentDocument({
                      jobName: `BNFE_Monthly_Attendance_${monthPrefix}`,
                      landscape: true,
                    })
                  }
                  className="min-h-[44px] px-4 rounded-xl border border-theme-border-strong bg-theme-elevated hover:bg-theme-surface-hover text-theme-text-primary text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <Printer size={16} />
                  <span>প্রিন্ট করুন</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Institute / Trade / Batch Filters */}
        {!isTrainer && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-theme-border">
            <div>
              <label
                htmlFor="monthly-att-inst"
                className="block text-xs font-medium text-theme-text-secondary mb-1.5"
              >
                প্রতিষ্ঠান
              </label>
              <select
                id="monthly-att-inst"
                value={effectiveInstitute}
                onChange={(e) => {
                  setFilterInstitute(e.target.value);
                  setFilterBatch('');
                }}
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
              >
                <option value="">সকল প্রতিষ্ঠান</option>
                {institutes.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="monthly-att-trade"
                className="block text-xs font-medium text-theme-text-secondary mb-1.5"
              >
                ট্রেড
              </label>
              <select
                id="monthly-att-trade"
                value={effectiveTrade}
                onChange={(e) => {
                  setFilterTrade(e.target.value);
                  setFilterBatch('');
                }}
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
              >
                <option value="">সকল ট্রেড</option>
                {trades.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="monthly-att-batch"
                className="block text-xs font-medium text-theme-text-secondary mb-1.5"
              >
                ব্যাচ
              </label>
              <select
                id="monthly-att-batch"
                value={effectiveBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
              >
                <option value="">সকল ব্যাচ</option>
                {availableBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
          <div className="text-xs text-theme-text-secondary">মোট প্রশিক্ষণার্থী</div>
          <div className="text-xl font-semibold text-theme-text-primary mt-1 tabular-nums">
            {toBn(summary.totalTrainees)} জন
          </div>
        </div>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
          <div className="text-xs text-theme-text-secondary">কার্যদিবস (রেকর্ডকৃত)</div>
          <div className="text-xl font-semibold text-theme-text-primary mt-1 tabular-nums">
            {toBn(summary.recordedDays)} দিন
          </div>
        </div>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
          <div className="text-xs text-theme-text-secondary">গড় উপস্থিতির হার</div>
          <div className="text-xl font-semibold text-theme-primary mt-1 tabular-nums">
            {toBn(summary.avgRate)}%
          </div>
        </div>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
          <div className="text-xs text-theme-text-secondary">উপস্থিত / অনুপস্থিত</div>
          <div className="text-xl font-semibold text-theme-text-primary mt-1 tabular-nums">
            <span className="text-theme-success">{toBn(summary.totalPresent)}</span>
            <span className="text-theme-text-muted mx-1">/</span>
            <span className="text-theme-danger">{toBn(summary.totalAbsent)}</span>
          </div>
        </div>
      </div>

      {/* Printable Official Sheet */}
      <div className="bg-theme-surface text-theme-text-primary p-5 sm:p-8 rounded-[14px] border border-theme-border print:bg-white print:text-slate-900 print:border-none print:p-0">
        <div className="text-center border-b-2 border-theme-border-strong print:border-slate-800 pb-4 mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-theme-text-primary print:text-slate-900">
            গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
          </h2>
          <h3 className="text-base sm:text-lg font-semibold text-theme-text-primary print:text-slate-800 mt-0.5">
            উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
          </h3>
          <p className="text-xs text-theme-text-secondary print:text-slate-600 mt-0.5">
            ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কর্মসূচি
          </p>
          <div className="mt-3 inline-block px-4 py-1 bg-theme-surface-subtle print:bg-slate-100 rounded-md font-semibold text-sm text-theme-text-primary print:text-slate-900">
            মাসিক হাজিরা প্রতিবেদন — {monthLabel}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-theme-text-secondary print:text-slate-600">
            <span>
              প্রতিষ্ঠান:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {effectiveInstitute ? getInstituteName(effectiveInstitute) : 'সকল'}
              </strong>
            </span>
            <span>
              ট্রেড:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {effectiveTrade ? getTradeName(effectiveTrade) : 'সকল'}
              </strong>
            </span>
            <span>
              ব্যাচ:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {effectiveBatch ? getBatchName(effectiveBatch) : 'সকল'}
              </strong>
            </span>
            <span className="tabular-nums">তারিখ: {formatBengaliDate(todayIso)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-theme-border-strong print:border-slate-400 text-xs">
            <thead className="bg-theme-surface-subtle print:bg-slate-100 text-theme-text-primary print:text-slate-900">
              <tr>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2.5 text-center w-12">
                  ক্রঃ
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left">
                  রেজিঃ নম্বর
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left min-w-[160px]">
                  প্রশিক্ষণার্থীর নাম
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left min-w-[150px]">
                  ট্রেড ও ব্যাচ
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2.5 text-center">
                  মোট ক্লাস
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2.5 text-center">
                  উপস্থিত
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2.5 text-center">
                  অনুপস্থিত
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2.5 text-center">
                  ছুটি
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-center">
                  উপস্থিতির হার (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="border border-theme-border-strong print:border-slate-400 py-8 text-center text-theme-text-muted print:text-slate-500"
                  >
                    নির্বাচিত ফিল্টার অনুযায়ী কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.trainee.id}
                    className="hover:bg-theme-surface-hover print:hover:bg-transparent"
                  >
                    <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center tabular-nums">
                      {toBn(idx + 1)}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 font-mono font-semibold tabular-nums whitespace-nowrap">
                      {r.trainee.registrationNumber || r.trainee.traineeId || '—'}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2">
                      <div className="font-medium text-theme-text-primary print:text-slate-900">
                        {r.trainee.nameBn || '—'}
                      </div>
                      {r.trainee.nameEn && (
                        <div className="text-[11px] text-theme-text-secondary print:text-slate-500">
                          {r.trainee.nameEn}
                        </div>
                      )}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2">
                      <div>{getTradeName(r.trainee.tradeId)}</div>
                      <div className="text-[11px] text-theme-text-secondary print:text-slate-500">
                        {getBatchName(r.trainee.batchId)}
                      </div>
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center tabular-nums">
                      {toBn(r.recorded)}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center font-semibold text-theme-success print:text-emerald-700 tabular-nums">
                      {toBn(r.present)}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center font-semibold text-theme-danger print:text-red-700 tabular-nums">
                      {toBn(r.absent)}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center text-theme-warning print:text-amber-700 tabular-nums">
                      {toBn(r.leave)}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 text-center font-semibold tabular-nums">
                      {r.rate !== null ? `${toBn(r.rate)}%` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-theme-surface-subtle print:bg-slate-100 font-semibold">
                <tr>
                  <td
                    colSpan={4}
                    className="border border-theme-border-strong print:border-slate-400 px-3 py-2 text-right"
                  >
                    সর্বমোট ({toBn(rows.length)} জন):
                  </td>
                  <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center tabular-nums">
                    {toBn(
                      summary.totalPresent + summary.totalAbsent + summary.totalLeave
                    )}
                  </td>
                  <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center text-theme-success print:text-emerald-700 tabular-nums">
                    {toBn(summary.totalPresent)}
                  </td>
                  <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center text-theme-danger print:text-red-700 tabular-nums">
                    {toBn(summary.totalAbsent)}
                  </td>
                  <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center text-theme-warning print:text-amber-700 tabular-nums">
                    {toBn(summary.totalLeave)}
                  </td>
                  <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 text-center tabular-nums">
                    {toBn(summary.avgRate)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Official Print Signatures */}
        <div className="grid grid-cols-3 gap-6 pt-14 text-center text-xs mt-6">
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              প্রশিক্ষক / প্রস্তুতকারী
            </div>
          </div>
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              প্রতিষ্ঠান প্রধান
            </div>
          </div>
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              কোর্স পরিচালক / উপপরিচালক
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
