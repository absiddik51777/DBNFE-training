import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import type {
  AttendanceRecord,
  Batch,
  DocumentPrintConfig,
  Institute,
  Trade,
  Trainee,
  UserProfile,
  WeeklySignatureHeading,
} from '../../../types';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { downloadCSV } from '../../../lib/exportUtils';
import { formatBengaliDate, toBn } from '../../../lib/dateUtils';
import {
  mergeHeadingWithDefault,
  normalizeDocumentPrintConfig,
  readLocalDocHeading,
  readLocalDocPrintConfig,
  writeLocalDocHeading,
  writeLocalDocPrintConfig,
} from '../../../lib/documentFrameService';
import { DocumentPrintFrame } from '../../document-frame/DocumentPrintFrame';
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

const DEFAULT_MONTHLY_HEADING: WeeklySignatureHeading = {
  govtTitle: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  officeTitle: 'জেলা উপানুষ্ঠানিক শিক্ষা ব্যুরো',
  officeAddress: 'কালেক্টরেট ভবন, ময়মনসিংহ',
  programTitle:
    "উপানুষ্ঠানিক শিক্ষা ব্যুরো'র বিশেষ কার্যক্রম কার্যকর সাক্ষরতা ও ব্যবহারিক কর্মদক্ষতা প্রশিক্ষণ প্রাক বৃত্তিমূলক পর্যায়",
  sheetTitle: 'মাসিক হাজিরা প্রতিবেদন',
};

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
  const { isCourseDirector } = usePermissions();
  const { settings, updateSettings } = useSystemSettings();
  const isTrainer = userProfile?.role === 'Trainer';
  const canPersistGlobal =
    userProfile?.role === 'Course Director' || isCourseDirector;
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
  const [exportingCsv, setExportingCsv] = useState(false);

  const [localConfigOverride, setLocalConfigOverride] =
    useState<Partial<DocumentPrintConfig> | null>(() =>
      readLocalDocPrintConfig('monthly_attendance', userProfile?.id)
    );
  const [localHeadingOverride, setLocalHeadingOverride] =
    useState<Partial<WeeklySignatureHeading> | null>(() =>
      readLocalDocHeading('monthly_attendance', userProfile?.id)
    );

  const activeConfig = useMemo<DocumentPrintConfig>(
    () =>
      normalizeDocumentPrintConfig(
        {
          ...(settings.documentPrintConfig || {}),
          ...(localConfigOverride || {}),
          margins: {
            ...(settings.documentPrintConfig?.margins || {}),
            ...(localConfigOverride?.margins || {}),
          },
        } as Partial<DocumentPrintConfig>,
        'portrait'
      ),
    [settings.documentPrintConfig, localConfigOverride]
  );

  const activeHeading = useMemo<WeeklySignatureHeading>(
    () =>
      mergeHeadingWithDefault(
        DEFAULT_MONTHLY_HEADING,
        settings.weeklySignatureHeading,
        localHeadingOverride
      ),
    [settings.weeklySignatureHeading, localHeadingOverride]
  );

  const handleConfigChange = async (nextConfig: DocumentPrintConfig) => {
    setLocalConfigOverride(nextConfig);
    writeLocalDocPrintConfig('monthly_attendance', userProfile?.id, nextConfig);
    if (canPersistGlobal) {
      try {
        await updateSettings({ documentPrintConfig: nextConfig });
      } catch (err) {
        console.warn('Could not save documentPrintConfig globally:', err);
      }
    }
  };

  const handleHeadingChange = async (nextHeading: WeeklySignatureHeading) => {
    setLocalHeadingOverride(nextHeading);
    writeLocalDocHeading('monthly_attendance', userProfile?.id, nextHeading);
    if (canPersistGlobal) {
      try {
        await updateSettings({
          weeklySignatureHeading: {
            ...(settings.weeklySignatureHeading || DEFAULT_MONTHLY_HEADING),
            govtTitle: nextHeading.govtTitle,
            officeTitle: nextHeading.officeTitle,
            officeAddress: nextHeading.officeAddress,
            programTitle: nextHeading.programTitle,
            sheetTitle:
              settings.weeklySignatureHeading?.sheetTitle ||
              'প্রশিক্ষণার্থী হাজিরা সিট',
          },
        });
      } catch (err) {
        console.warn('Could not save heading globally:', err);
      }
    }
  };

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
    if (exportingCsv) return;
    setExportingCsv(true);
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
      setExportingCsv(false);
    }
  };

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="আগের মাস"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>

            <select
              aria-label="মাস নির্বাচন"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="min-h-[44px] px-3 rounded-xl border border-theme-border bg-theme-surface-subtle text-sm font-medium text-theme-text-primary cursor-pointer"
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
              className="min-h-[44px] px-3 rounded-xl border border-theme-border bg-theme-surface-subtle text-sm font-medium text-theme-text-primary tabular-nums cursor-pointer"
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
              className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {!isTrainer && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] px-3.5 rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs sm:text-sm font-medium text-theme-text-secondary inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>ফিল্টার রিসেট</span>
            </button>
          )}
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
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer"
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
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer"
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
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer"
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

      {/* MS-Word-Style Paginated Document Frame */}
      <DocumentPrintFrame
        documentTitle={`মাসিক হাজিরা প্রতিবেদন — ${monthLabel}`}
        fileNamePrefix={`BNFE_Monthly_Attendance_${monthPrefix}`}
        config={activeConfig}
        defaultOrientation="portrait"
        onConfigChange={handleConfigChange}
        heading={activeHeading}
        defaultHeading={DEFAULT_MONTHLY_HEADING}
        onHeadingChange={handleHeadingChange}
        supportsSignatures
        supportsGeneratedDate
        canExport={canExport}
        rowCount={rows.length}
        measureKey={`${monthPrefix}|${effectiveInstitute}|${effectiveTrade}|${effectiveBatch}|${rows.length}`}
        onNotify={onNotify}
        extraDownloadItems={
          canExport
            ? [
                {
                  id: 'csv',
                  label: exportingCsv ? 'CSV তৈরি হচ্ছে...' : 'CSV স্প্রেডশিট (.csv)',
                  subtitle: 'Excel-এ খোলার উপযোগী',
                  icon: <FileSpreadsheet size={16} />,
                  disabled: exportingCsv,
                  onClick: handleExportCSV,
                },
              ]
            : []
        }
        renderHeader={({ config, px }) => (
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-3.5 text-black">
            {activeHeading.govtTitle.trim() && (
              <p style={{ fontSize: px(10.5) }} className="leading-[1.35]">
                {activeHeading.govtTitle.trim()}
              </p>
            )}
            {activeHeading.officeTitle.trim() && (
              <h2
                style={{ fontSize: px(15) }}
                className="font-bold leading-[1.35] mt-0.5"
              >
                {activeHeading.officeTitle.trim()}
              </h2>
            )}
            {activeHeading.officeAddress.trim() && (
              <p style={{ fontSize: px(11.5) }} className="font-medium leading-[1.35]">
                {activeHeading.officeAddress.trim()}
              </p>
            )}
            {activeHeading.programTitle.trim() && (
              <p
                style={{ fontSize: px(11) }}
                className="font-semibold leading-[1.35] max-w-[92%] mx-auto mt-1"
              >
                {activeHeading.programTitle.trim()}
              </p>
            )}
            <div className="mt-2 inline-block px-3.5 py-1 bg-slate-100 border border-slate-300 rounded font-bold leading-[1.3]">
              <span style={{ fontSize: px(12.5) }}>
                {activeHeading.sheetTitle.trim() || 'মাসিক হাজিরা প্রতিবেদন'} — {monthLabel}
              </span>
            </div>
            <div
              style={{ fontSize: px(10.5) }}
              className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-slate-700"
            >
              <span>
                প্রতিষ্ঠান:{' '}
                <strong className="text-black">
                  {effectiveInstitute ? getInstituteName(effectiveInstitute) : 'সকল'}
                </strong>
              </span>
              <span>
                ট্রেড:{' '}
                <strong className="text-black">
                  {effectiveTrade ? getTradeName(effectiveTrade) : 'সকল'}
                </strong>
              </span>
              <span>
                ব্যাচ:{' '}
                <strong className="text-black">
                  {effectiveBatch ? getBatchName(effectiveBatch) : 'সকল'}
                </strong>
              </span>
              {config.showGeneratedDate && (
                <span className="tabular-nums">
                  তারিখ: <strong className="text-black">{formatBengaliDate(todayIso)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
        renderTable={({ rowIndices, includeTableFooter, px }) => (
          <table
            style={{ fontSize: px(10.5) }}
            className="w-full table-fixed border-collapse border border-slate-700 text-black"
          >
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead className="bg-slate-100 text-black">
              <tr>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  ক্রঃ
                </th>
                <th className="border border-slate-700 px-1.5 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  রেজিঃ নম্বর
                </th>
                <th className="border border-slate-700 px-2 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  প্রশিক্ষণার্থীর নাম
                </th>
                <th className="border border-slate-700 px-2 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  ট্রেড ও ব্যাচ
                </th>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  মোট ক্লাস
                </th>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  উপস্থিত
                </th>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  অনুপস্থিত
                </th>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  ছুটি
                </th>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  হার (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="border border-slate-700 py-8 text-center align-middle text-slate-600"
                  >
                    নির্বাচিত ফিল্টার অনুযায়ী কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                rowIndices.map((idx) => {
                  const r = rows[idx];
                  if (!r) return null;
                  return (
                    <tr key={r.trainee.id}>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                        {toBn(idx + 1)}
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[4px] pb-[6px] font-mono font-semibold align-middle leading-[1.25] tabular-nums break-all">
                        {r.trainee.registrationNumber || r.trainee.traineeId || '—'}
                      </td>
                      <td className="border border-slate-700 px-2 pt-[4px] pb-[6px] align-middle">
                        <div className="font-medium text-black leading-[1.25] break-words">
                          {r.trainee.nameBn || '—'}
                        </div>
                        {r.trainee.nameEn && (
                          <div
                            style={{ fontSize: px(9) }}
                            className="text-slate-600 leading-[1.2] break-words"
                          >
                            {r.trainee.nameEn}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-700 px-2 pt-[4px] pb-[6px] align-middle">
                        <div className="leading-[1.25] break-words">
                          {getTradeName(r.trainee.tradeId)}
                        </div>
                        <div
                          style={{ fontSize: px(9) }}
                          className="text-slate-600 leading-[1.2] break-words"
                        >
                          {getBatchName(r.trainee.batchId)}
                        </div>
                      </td>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                        {toBn(r.recorded)}
                      </td>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center font-semibold text-emerald-800 align-middle leading-[1.25] tabular-nums">
                        {toBn(r.present)}
                      </td>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center font-semibold text-rose-800 align-middle leading-[1.25] tabular-nums">
                        {toBn(r.absent)}
                      </td>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center text-amber-800 align-middle leading-[1.25] tabular-nums">
                        {toBn(r.leave)}
                      </td>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center font-semibold align-middle leading-[1.25] tabular-nums">
                        {r.rate !== null ? `${toBn(r.rate)}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {includeTableFooter && rows.length > 0 && (
              <tfoot className="bg-slate-100 font-semibold text-black">
                <tr>
                  <td
                    colSpan={4}
                    className="border border-slate-700 px-2 pt-[4px] pb-[6px] text-right align-middle leading-[1.25]"
                  >
                    সর্বমোট ({toBn(rows.length)} জন):
                  </td>
                  <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                    {toBn(
                      summary.totalPresent + summary.totalAbsent + summary.totalLeave
                    )}
                  </td>
                  <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center text-emerald-800 align-middle leading-[1.25] tabular-nums">
                    {toBn(summary.totalPresent)}
                  </td>
                  <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center text-rose-800 align-middle leading-[1.25] tabular-nums">
                    {toBn(summary.totalAbsent)}
                  </td>
                  <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center text-amber-800 align-middle leading-[1.25] tabular-nums">
                    {toBn(summary.totalLeave)}
                  </td>
                  <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                    {toBn(summary.avgRate)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
        renderFooter={({ config, px }) =>
          config.showSignatures ? (
            <div
              style={{ fontSize: px(10.5) }}
              className="grid grid-cols-3 gap-6 pt-12 text-center mt-4 text-black"
            >
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  প্রশিক্ষক / প্রস্তুতকারী
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  প্রতিষ্ঠান প্রধান
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  কোর্স পরিচালক / উপপরিচালক
                </div>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
};
