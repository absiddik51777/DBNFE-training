import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
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
import { ReportHeaderBanner } from '../ReportHeaderBanner';
import { DEFAULT_SHEET_PAGE_CONFIG } from '../../weekly-signature/utils';
import { MONTH_NAMES_BN, ReportsToast, WEEKDAY_NAMES_BN } from '../types';

type SheetFormMode = 'blank' | 'filled';

interface TradeAttendanceSheetFormProps {
  userProfile: UserProfile | null;
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  trainees: Trainee[];
  attendance: AttendanceRecord[];
  canExport: boolean;
  onNotify: (toast: ReportsToast) => void;
}

interface SheetDay {
  day: number;
  dateStr: string;
  weekdayBn: string;
  isFriday: boolean;
}

const DEFAULT_TRADE_SHEET_HEADING: WeeklySignatureHeading = {
  govtTitle: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  officeTitle: 'জেলা উপানুষ্ঠানিক শিক্ষা ব্যুরো',
  officeAddress: 'কালেক্টরেট ভবন, ময়মনসিংহ',
  programTitle:
    "উপানুষ্ঠানিক শিক্ষা ব্যুরো'র বিশেষ কার্যক্রম কার্যকর সাক্ষরতা ও ব্যবহারিক কর্মদক্ষতা প্রশিক্ষণ প্রাক বৃত্তিমূলক পর্যায়",
  sheetTitle: 'মাসিক হাজিরা সিট (ট্রেড ভিত্তিক)',
};

export const TradeAttendanceSheetForm: React.FC<TradeAttendanceSheetFormProps> = ({
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

  const trainerBatch = useMemo(
    () =>
      isTrainer && userProfile?.batchId
        ? batches.find((b) => b.id === userProfile.batchId) || null
        : null,
    [isTrainer, userProfile?.batchId, batches]
  );

  const [selectedTradeId, setSelectedTradeId] = useState<string>(() => {
    if (trainerBatch?.tradeId) return trainerBatch.tradeId;
    return trades.find((t) => !t.isArchived)?.id || '';
  });

  const [selectedBatchId, setSelectedBatchId] = useState<string>(() =>
    isTrainer && userProfile?.batchId ? userProfile.batchId : ''
  );

  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [formMode, setFormMode] = useState<SheetFormMode>('blank');
  const [hideFridays, setHideFridays] = useState<boolean>(false);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  const [localConfigOverride, setLocalConfigOverride] =
    useState<Partial<DocumentPrintConfig> | null>(() =>
      readLocalDocPrintConfig('trade_sheet', userProfile?.id)
    );
  const [localHeadingOverride, setLocalHeadingOverride] =
    useState<Partial<WeeklySignatureHeading> | null>(() =>
      readLocalDocHeading('trade_sheet', userProfile?.id)
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
        'landscape'
      ),
    [settings.documentPrintConfig, localConfigOverride]
  );

  const activeHeading = useMemo<WeeklySignatureHeading>(
    () =>
      mergeHeadingWithDefault(
        DEFAULT_TRADE_SHEET_HEADING,
        settings.weeklySignatureHeading,
        localHeadingOverride
      ),
    [settings.weeklySignatureHeading, localHeadingOverride]
  );

  const handleConfigChange = async (nextConfig: DocumentPrintConfig) => {
    setLocalConfigOverride(nextConfig);
    writeLocalDocPrintConfig('trade_sheet', userProfile?.id, nextConfig);
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
    writeLocalDocHeading('trade_sheet', userProfile?.id, nextHeading);
    if (canPersistGlobal) {
      try {
        await updateSettings({
          weeklySignatureHeading: {
            ...(settings.weeklySignatureHeading || DEFAULT_TRADE_SHEET_HEADING),
            govtTitle: nextHeading.govtTitle,
            officeTitle: nextHeading.officeTitle,
            officeAddress: nextHeading.officeAddress,
            programTitle: nextHeading.programTitle,
            sheetTitle:
              settings.weeklySignatureHeading?.sheetTitle ||
              'প্রশিক্ষণার্থী হাজিরা সিট',
            leftLogoUrl: nextHeading.leftLogoUrl || '',
            rightLogoUrl: nextHeading.rightLogoUrl || '',
            logoSizePx: nextHeading.logoSizePx,
          },
        });
      } catch (err) {
        console.warn('Could not save heading globally:', err);
      }
    }
  };

  const activeTrades = useMemo(
    () => trades.filter((t) => !t.isArchived),
    [trades]
  );

  useEffect(() => {
    if (isTrainer && trainerBatch?.tradeId) {
      setSelectedTradeId(trainerBatch.tradeId);
      setSelectedBatchId(trainerBatch.id);
      return;
    }
    if (!selectedTradeId && activeTrades.length > 0) {
      setSelectedTradeId(activeTrades[0].id);
    }
  }, [activeTrades, selectedTradeId, isTrainer, trainerBatch]);

  const effectiveTradeId =
    isTrainer && trainerBatch?.tradeId ? trainerBatch.tradeId : selectedTradeId;
  const effectiveBatchId =
    isTrainer && userProfile?.batchId ? userProfile.batchId : selectedBatchId;

  const tradeBatches = useMemo(() => {
    return batches.filter((b) => {
      if (b.isArchived) return false;
      if (effectiveTradeId && b.tradeId !== effectiveTradeId) return false;
      if (isTrainer && userProfile?.instituteId && b.instituteId !== userProfile.instituteId) {
        return false;
      }
      return true;
    });
  }, [batches, effectiveTradeId, isTrainer, userProfile?.instituteId]);

  const selectedTrade = useMemo(
    () => trades.find((t) => t.id === effectiveTradeId) || null,
    [trades, effectiveTradeId]
  );

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === effectiveBatchId) || null,
    [batches, effectiveBatchId]
  );

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const daysList = useMemo<SheetDay[]>(() => {
    const count = new Date(selectedYear, selectedMonth, 0).getDate();
    const list: SheetDay[] = [];
    for (let d = 1; d <= count; d++) {
      const dt = new Date(selectedYear, selectedMonth - 1, d);
      const dow = dt.getDay();
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(
        2,
        '0'
      )}-${String(d).padStart(2, '0')}`;
      list.push({
        day: d,
        dateStr,
        weekdayBn: WEEKDAY_NAMES_BN[dow] || '',
        isFriday: dow === 5,
      });
    }
    return hideFridays ? list.filter((d) => !d.isFriday) : list;
  }, [selectedYear, selectedMonth, hideFridays]);

  const sheetTrainees = useMemo(() => {
    if (!effectiveTradeId) return [];
    return trainees
      .filter((t) => {
        if (t.status === 'Archived' || t.status === 'Dropped Out') return false;
        if (t.tradeId !== effectiveTradeId) return false;
        if (effectiveBatchId && t.batchId !== effectiveBatchId) return false;
        if (isTrainer && userProfile?.instituteId && t.instituteId !== userProfile.instituteId) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.registrationNumber || a.traineeId || a.id).localeCompare(
          b.registrationNumber || b.traineeId || b.id,
          undefined,
          { numeric: true }
        )
      );
  }, [
    trainees,
    effectiveTradeId,
    effectiveBatchId,
    isTrainer,
    userProfile?.instituteId,
  ]);

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const attendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (formMode !== 'filled') return map;

    const traineeIds = new Set(sheetTrainees.map((t) => t.id));
    for (const rec of attendance) {
      if (!rec.date || !rec.date.startsWith(monthPrefix)) continue;
      if (!traineeIds.has(rec.traineeId)) continue;
      const code =
        rec.status === 'Present'
          ? 'P'
          : rec.status === 'Absent'
          ? 'A'
          : rec.status === 'Leave'
          ? 'L'
          : '';
      if (code) {
        map.set(`${rec.traineeId}|${rec.date}`, code);
      }
    }
    return map;
  }, [attendance, monthPrefix, sheetTrainees, formMode]);

  const getInstituteName = (id?: string) =>
    institutes.find((i) => i.id === id)?.name || '—';
  const getBatchName = (id?: string) =>
    batches.find((b) => b.id === id)?.name || '—';

  const derivedInstituteLabel = useMemo(() => {
    if (selectedBatch) return getInstituteName(selectedBatch.instituteId);
    const uniqueInstIds = Array.from(
      new Set(sheetTrainees.map((t) => t.instituteId).filter(Boolean))
    );
    if (uniqueInstIds.length === 1) return getInstituteName(uniqueInstIds[0]);
    if (uniqueInstIds.length > 1) return 'সংশ্লিষ্ট প্রতিষ্ঠানসমূহ';
    if (isTrainer && userProfile?.instituteId) {
      return getInstituteName(userProfile.instituteId);
    }
    return 'সকল প্রতিষ্ঠান';
  }, [selectedBatch, sheetTrainees, institutes, isTrainer, userProfile?.instituteId]);

  const monthName = MONTH_NAMES_BN[selectedMonth - 1] || '';

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

  const handleExportCSV = async () => {
    if (exportingCsv || !selectedTrade) return;
    setExportingCsv(true);
    try {
      const headers = [
        'ক্রঃ',
        'রেজিঃ নং',
        'প্রশিক্ষণার্থীর নাম',
        'ব্যাচ',
        ...daysList.map((d) => `${toBn(d.day)} (${d.weekdayBn})`),
        'মোট উপস্থিত',
        'স্বাক্ষর',
      ];

      const csvRows = sheetTrainees.map((t, idx) => {
        let present = 0;
        const dayVals = daysList.map((d) => {
          if (formMode === 'blank' || d.isFriday) return '';
          const code = attendanceMap.get(`${t.id}|${d.dateStr}`) || '';
          if (code === 'P') present++;
          return code;
        });

        return [
          idx + 1,
          t.registrationNumber || t.traineeId || '',
          t.nameBn || t.nameEn || '',
          getBatchName(t.batchId),
          ...dayVals,
          formMode === 'filled' ? present : '',
          '',
        ];
      });

      const safeTrade = (selectedTrade.code || selectedTrade.name || 'trade')
        .replace(/[^\w\u0980-\u09FF-]+/g, '_');

      const res = await downloadCSV(
        `bnfe_trade_attendance_sheet_${safeTrade}_${monthPrefix}`,
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

  // Proportional 100% usable-width column allocation across 31-day matrix
  const slPct = 3;
  const regPct = 8;
  const namePct = 15;
  const presentPct = 4.5;
  const sigPct = 6.5;
  const dayPct =
    daysList.length > 0
      ? (100 - slPct - regPct - namePct - presentPct - sigPct) / daysList.length
      : 0;

  return (
    <div className="space-y-4">
      {/* Form Controls */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="trade-sheet-trade"
              className="block text-xs font-medium text-theme-text-secondary mb-1.5"
            >
              ট্রেড নির্বাচন
            </label>
            <select
              id="trade-sheet-trade"
              value={effectiveTradeId}
              disabled={isTrainer && Boolean(trainerBatch?.tradeId)}
              onChange={(e) => {
                setSelectedTradeId(e.target.value);
                setSelectedBatchId('');
              }}
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 cursor-pointer"
            >
              {activeTrades.length === 0 ? (
                <option value="">কোনো ট্রেড নেই</option>
              ) : (
                activeTrades.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="trade-sheet-batch"
              className="block text-xs font-medium text-theme-text-secondary mb-1.5"
            >
              ব্যাচ (ঐচ্ছিক)
            </label>
            <select
              id="trade-sheet-batch"
              value={effectiveBatchId}
              disabled={isTrainer && Boolean(userProfile?.batchId)}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 cursor-pointer"
            >
              <option value="">সকল ব্যাচ (ট্রেড ভিত্তিক)</option>
              {tradeBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {getInstituteName(b.instituteId)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-theme-text-secondary mb-1.5">
              মাস ও বছর
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="আগের মাস"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <ChevronLeft size={17} />
              </button>

              <select
                aria-label="মাস নির্বাচন"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 min-w-0 min-h-[44px] px-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle text-xs sm:text-sm font-medium text-theme-text-primary cursor-pointer"
              >
                {MONTH_NAMES_BN.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                aria-label="বছর নির্বাচন"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-[82px] min-h-[44px] px-2 rounded-xl border border-theme-border bg-theme-surface-subtle text-xs sm:text-sm font-medium text-theme-text-primary tabular-nums cursor-pointer"
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
                className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Mode toggle + Friday toggle */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-theme-border">
          <div
            role="group"
            aria-label="ফর্মের ধরন"
            className="inline-flex rounded-xl bg-theme-surface-subtle p-1 border border-theme-border"
          >
            <button
              type="button"
              onClick={() => setFormMode('blank')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                formMode === 'blank'
                  ? 'bg-theme-surface text-theme-text-primary shadow-xs border border-theme-border'
                  : 'text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              খালি ফর্ম (স্বাক্ষরের জন্য)
            </button>
            <button
              type="button"
              onClick={() => setFormMode('filled')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                formMode === 'filled'
                  ? 'bg-theme-surface text-theme-text-primary shadow-xs border border-theme-border'
                  : 'text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              হাজিরাসহ শিট
            </button>
          </div>

          <label className="min-h-[40px] inline-flex items-center gap-2 px-2.5 rounded-xl text-xs sm:text-sm text-theme-text-secondary hover:text-theme-text-primary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideFridays}
              onChange={(e) => setHideFridays(e.target.checked)}
              className="w-4 h-4 accent-theme-primary rounded cursor-pointer"
            />
            <span>শুক্রবার বাদ দিন</span>
          </label>
        </div>
      </div>

      {/* MS-Word-Style Paginated Document Frame */}
      <DocumentPrintFrame
        documentTitle={`মাসিক হাজিরা সিট (ট্রেড ভিত্তিক) — ${monthName} ${toBn(
          selectedYear
        )}`}
        fileNamePrefix={`BNFE_Trade_Attendance_Sheet_${monthPrefix}`}
        config={activeConfig}
        defaultOrientation="landscape"
        onConfigChange={handleConfigChange}
        heading={activeHeading}
        defaultHeading={DEFAULT_TRADE_SHEET_HEADING}
        onHeadingChange={handleHeadingChange}
        supportsSignatures
        supportsGeneratedDate
        canExport={canExport && Boolean(selectedTrade)}
        rowCount={sheetTrainees.length}
        measureKey={`${effectiveTradeId}|${effectiveBatchId}|${monthPrefix}|${formMode}|${hideFridays}|${sheetTrainees.length}|${activeHeading.leftLogoUrl || ''}|${activeHeading.rightLogoUrl || ''}|${activeHeading.logoSizePx || ''}|${activeHeading.programTitle}`}
        onNotify={onNotify}
        extraDownloadItems={
          canExport && selectedTrade
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
          <div className="text-center border-b-2 border-slate-800 pb-2.5 mb-3 text-black">
            <ReportHeaderBanner
              leftLogoUrl={activeHeading.leftLogoUrl}
              rightLogoUrl={activeHeading.rightLogoUrl}
              logoSizePx={activeHeading.logoSizePx}
              scale={config.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt}
            >
              {activeHeading.govtTitle.trim() && (
                <p style={{ fontSize: px(10) }} className="leading-[1.3]">
                  {activeHeading.govtTitle.trim()}
                </p>
              )}
              {activeHeading.officeTitle.trim() && (
                <h2
                  style={{ fontSize: px(14) }}
                  className="font-bold leading-[1.3] mt-0.5"
                >
                  {activeHeading.officeTitle.trim()}
                </h2>
              )}
              {activeHeading.officeAddress.trim() && (
                <p style={{ fontSize: px(10.5) }} className="font-medium leading-[1.3]">
                  {activeHeading.officeAddress.trim()}
                </p>
              )}
              {activeHeading.programTitle.trim() && (
                <p
                  style={{ fontSize: px(10) }}
                  className="font-semibold leading-[1.3] max-w-[94%] mx-auto mt-0.5"
                >
                  {activeHeading.programTitle.trim()}
                </p>
              )}
            </ReportHeaderBanner>
            <div className="mt-1.5 inline-block px-3.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-bold leading-[1.3]">
              <span style={{ fontSize: px(12) }}>
                {activeHeading.sheetTitle.trim() || 'মাসিক হাজিরা সিট (ট্রেড ভিত্তিক)'} —{' '}
                {monthName} {toBn(selectedYear)}
              </span>
            </div>
            <div
              style={{ fontSize: px(10) }}
              className="mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-slate-700"
            >
              <span>
                ট্রেড: <strong className="text-black">{selectedTrade?.name || '—'}</strong>
              </span>
              <span>
                ব্যাচ:{' '}
                <strong className="text-black">
                  {selectedBatch ? selectedBatch.name : 'সকল ব্যাচ'}
                </strong>
              </span>
              <span>
                প্রতিষ্ঠান: <strong className="text-black">{derivedInstituteLabel}</strong>
              </span>
              <span className="tabular-nums">
                প্রশিক্ষণার্থী:{' '}
                <strong className="text-black">{toBn(sheetTrainees.length)} জন</strong>
              </span>
              {config.showGeneratedDate && (
                <span className="tabular-nums">
                  তারিখ: <strong className="text-black">{formatBengaliDate(todayIso)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
        renderTable={({ rowIndices, px }) => (
          <table
            style={{ fontSize: px(8.8) }}
            className="w-full table-fixed border-collapse border border-slate-700 text-black"
          >
            <colgroup>
              <col style={{ width: `${slPct}%` }} />
              <col style={{ width: `${regPct}%` }} />
              <col style={{ width: `${namePct}%` }} />
              {daysList.map((d) => (
                <col key={d.day} style={{ width: `${dayPct}%` }} />
              ))}
              <col style={{ width: `${presentPct}%` }} />
              <col style={{ width: `${sigPct}%` }} />
            </colgroup>
            <thead className="bg-slate-100 text-black">
              <tr>
                <th className="border border-slate-700 px-0.5 pt-1 pb-1.5 text-center align-middle leading-[1.2]">
                  ক্রঃ
                </th>
                <th className="border border-slate-700 px-1 pt-1 pb-1.5 text-left align-middle leading-[1.2]">
                  রেজিঃ নং
                </th>
                <th className="border border-slate-700 px-1.5 pt-1 pb-1.5 text-left align-middle leading-[1.2]">
                  প্রশিক্ষণার্থীর নাম
                </th>
                {daysList.map((d) => (
                  <th
                    key={d.day}
                    className={`border border-slate-700 px-0.5 pt-1 pb-1.5 text-center align-middle tabular-nums ${
                      d.isFriday ? 'bg-rose-50 text-rose-700' : ''
                    }`}
                  >
                    <div className="font-bold leading-none">{toBn(d.day)}</div>
                    <div
                      style={{ fontSize: px(7) }}
                      className="font-normal opacity-80 mt-0.5 leading-none"
                    >
                      {d.weekdayBn}
                    </div>
                  </th>
                ))}
                <th className="border border-slate-700 px-0.5 pt-1 pb-1.5 text-center align-middle leading-[1.2]">
                  উপস্থিত
                </th>
                <th className="border border-slate-700 px-1 pt-1 pb-1.5 text-center align-middle leading-[1.2]">
                  স্বাক্ষর
                </th>
              </tr>
            </thead>
            <tbody>
              {sheetTrainees.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysList.length + 5}
                    className="border border-slate-700 py-8 text-center align-middle text-slate-600"
                  >
                    এই ট্রেডে কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                rowIndices.map((idx) => {
                  const t = sheetTrainees[idx];
                  if (!t) return null;
                  let presentCount = 0;
                  return (
                    <tr key={t.id}>
                      <td className="border border-slate-700 px-0.5 pt-[3px] pb-[5px] text-center align-middle leading-[1.2] tabular-nums">
                        {toBn(idx + 1)}
                      </td>
                      <td className="border border-slate-700 px-1 pt-[3px] pb-[5px] font-mono font-semibold align-middle leading-[1.2] tabular-nums break-all">
                        {t.registrationNumber || t.traineeId || '—'}
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[3px] pb-[5px] align-middle">
                        <div className="font-medium text-black leading-[1.2] break-words">
                          {t.nameBn || t.nameEn || '—'}
                        </div>
                        {!selectedBatch && (
                          <div
                            style={{ fontSize: px(7.5) }}
                            className="text-slate-600 leading-[1.15] break-words"
                          >
                            {getBatchName(t.batchId)}
                          </div>
                        )}
                      </td>
                      {daysList.map((d) => {
                        if (formMode === 'blank' || d.isFriday) {
                          return (
                            <td
                              key={d.day}
                              className={`border border-slate-700 h-6 text-center align-middle ${
                                d.isFriday ? 'bg-rose-50/80' : ''
                              }`}
                            />
                          );
                        }
                        const code = attendanceMap.get(`${t.id}|${d.dateStr}`) || '';
                        if (code === 'P') presentCount++;
                        const codeClass =
                          code === 'P'
                            ? 'text-emerald-700 font-bold'
                            : code === 'A'
                            ? 'text-rose-700 font-bold'
                            : code === 'L'
                            ? 'text-amber-700 font-bold'
                            : 'text-slate-400';
                        return (
                          <td
                            key={d.day}
                            className={`border border-slate-700 h-6 text-center align-middle ${codeClass}`}
                          >
                            {code}
                          </td>
                        );
                      })}
                      <td className="border border-slate-700 px-0.5 pt-[3px] pb-[5px] text-center font-semibold align-middle leading-[1.2] tabular-nums">
                        {formMode === 'filled' ? toBn(presentCount) : ''}
                      </td>
                      <td className="border border-slate-700 px-1 pt-[3px] pb-[5px] align-middle" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
        renderFooter={({ config, px }) =>
          config.showSignatures ? (
            <div
              style={{ fontSize: px(10) }}
              className="grid grid-cols-3 gap-6 pt-10 text-center mt-4 text-black"
            >
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  প্রশিক্ষকের স্বাক্ষর ও তারিখ
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  প্রতিষ্ঠান প্রধানের স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  কোর্স পরিচালক
                </div>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
};
