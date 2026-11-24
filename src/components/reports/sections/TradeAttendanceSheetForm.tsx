import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
} from 'lucide-react';
import type {
  AttendanceRecord,
  Batch,
  Institute,
  Trade,
  Trainee,
  UserProfile,
} from '../../../types';
import {
  downloadCSV,
  printCustomHtmlDocument,
} from '../../../lib/exportUtils';
import { toBn } from '../../../lib/dateUtils';
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const isTrainer = userProfile?.role === 'Trainer';
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
  const [exporting, setExporting] = useState<boolean>(false);

  const activeTrades = useMemo(
    () => trades.filter((t) => !t.isArchived),
    [trades]
  );

  // Sync defaults once trades/batches load
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

  // O(1) lookup for filled attendance mode
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

  const buildPrintableHtml = (): string => {
    const dayHeadCells = daysList
      .map(
        (d) =>
          `<th class="${d.isFriday ? 'fri' : ''} day-col">${toBn(
            d.day
          )}<div class="wd">${escapeHtml(d.weekdayBn)}</div></th>`
      )
      .join('');

    const bodyRows =
      sheetTrainees.length === 0
        ? `<tr><td colspan="${
            daysList.length + 5
          }" style="padding:18px;text-align:center;color:#64748b;">এই ট্রেডে কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।</td></tr>`
        : sheetTrainees
            .map((t, idx) => {
              let presentCount = 0;
              const cells = daysList
                .map((d) => {
                  if (formMode === 'blank' || d.isFriday) {
                    return `<td class="${d.isFriday ? 'fri' : ''} day-cell"></td>`;
                  }
                  const code = attendanceMap.get(`${t.id}|${d.dateStr}`) || '';
                  if (code === 'P') presentCount++;
                  const cls =
                    code === 'P'
                      ? 'p'
                      : code === 'A'
                      ? 'a'
                      : code === 'L'
                      ? 'l'
                      : '';
                  return `<td class="day-cell ${cls}">${code}</td>`;
                })
                .join('');

              const reg = escapeHtml(t.registrationNumber || t.traineeId || '—');
              const name = escapeHtml(t.nameBn || t.nameEn || '—');
              const batchText = !selectedBatch
                ? `<div class="sub">${escapeHtml(getBatchName(t.batchId))}</div>`
                : '';

              return `<tr>
                <td>${toBn(idx + 1)}</td>
                <td class="reg">${reg}</td>
                <td class="name-col"><strong>${name}</strong>${batchText}</td>
                ${cells}
                <td class="tot">${formMode === 'filled' ? toBn(presentCount) : ''}</td>
                <td class="sig"></td>
              </tr>`;
            })
            .join('');

    return `<!doctype html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>মাসিক হাজিরা সিট (ট্রেড ভিত্তক) — ${escapeHtml(
    selectedTrade?.name || ''
  )}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Nikosh', 'SolaimanLipi', 'Noto Sans Bengali', Arial, sans-serif;
      margin: 14px;
      color: #0f172a;
      background: #fff;
      font-size: 11px;
    }
    .hdr {
      text-align: center;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .hdr h1 { margin: 0; font-size: 16px; }
    .hdr h2 { margin: 2px 0 0; font-size: 14px; }
    .hdr .sub-title { margin: 2px 0 6px; font-size: 11px; color: #475569; }
    .hdr .badge {
      display: inline-block;
      background: #f1f5f9;
      padding: 3px 12px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 12.5px;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #64748b;
      padding: 3px 2px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      font-size: 10px;
    }
    .day-col {
      min-width: 21px;
    }
    .wd {
      font-size: 8.5px;
      font-weight: 400;
      color: #475569;
    }
    .reg {
      font-family: monospace;
      font-weight: 600;
      padding: 3px 5px;
      white-space: nowrap;
      font-size: 10px;
    }
    .name-col {
      text-align: left;
      padding: 3px 6px;
      min-width: 135px;
    }
    .sub {
      font-size: 9px;
      color: #475569;
    }
    .day-cell {
      height: 22px;
      font-size: 10px;
    }
    .fri {
      background: #fff1f2;
      color: #be123c;
    }
    .p { color: #047857; font-weight: 700; }
    .a { color: #b91c1c; font-weight: 700; }
    .l { color: #b45309; font-weight: 700; }
    .tot {
      min-width: 34px;
      font-weight: 700;
    }
    .sig {
      min-width: 68px;
    }
    .sigs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 28px;
      margin-top: 38px;
      text-align: center;
      font-size: 11px;
    }
    .sigs .line {
      border-top: 1px solid #334155;
      padding-top: 4px;
      font-weight: 600;
    }
    @media print {
      @page { size: A4 landscape; margin: 7mm; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="hdr">
    <h1>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h1>
    <h2>উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)</h2>
    <div class="sub-title">ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কর্মসূচি</div>
    <div class="badge">মাসিক হাজিরা সিট (ট্রেড ভিত্তিক) — ${escapeHtml(monthName)} ${toBn(
      selectedYear
    )}</div>
  </div>
  <div class="meta">
    <div><strong>ট্রেড:</strong> ${escapeHtml(selectedTrade?.name || '—')}</div>
    <div><strong>ব্যাচ:</strong> ${escapeHtml(
      selectedBatch ? selectedBatch.name : 'সকল ব্যাচ (ট্রেড ভিত্তিক)'
    )}</div>
    <div><strong>প্রতিষ্ঠান:</strong> ${escapeHtml(derivedInstituteLabel)}</div>
    <div><strong>মোট প্রশিক্ষণার্থী:</strong> ${toBn(sheetTrainees.length)} জন</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:26px;">ক্রঃ</th>
        <th>রেজিঃ নং</th>
        <th>প্রশিক্ষণার্থীর নাম</th>
        ${dayHeadCells}
        <th>মোট উপস্থিত</th>
        <th>স্বাক্ষর / মন্তব্য</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="sigs">
    <div><div class="line">প্রশিক্ষকের স্বাক্ষর ও তারিখ</div></div>
    <div><div class="line">প্রতিষ্ঠান প্রধানের স্বাক্ষর</div></div>
    <div><div class="line">কোর্স পরিচালক</div></div>
  </div>
</body>
</html>`;
  };

  const handlePrintSheet = async () => {
    const html = buildPrintableHtml();
    await printCustomHtmlDocument({
      html,
      jobName: `BNFE_Trade_Attendance_Sheet_${monthPrefix}`,
      landscape: true,
    });
  };

  const handleExportCSV = async () => {
    if (exporting || !selectedTrade) return;
    setExporting(true);
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
      setExporting(false);
    }
  };

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
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
                className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <ChevronLeft size={17} />
              </button>

              <select
                aria-label="মাস নির্বাচন"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 min-w-0 min-h-[44px] px-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle text-xs sm:text-sm font-medium text-theme-text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
                className="w-[82px] min-h-[44px] px-2 rounded-xl border border-theme-border bg-theme-surface-subtle text-xs sm:text-sm font-medium text-theme-text-primary tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
                className="min-h-[44px] min-w-[44px] rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Mode toggle + Friday toggle + Export buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-theme-border">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="ফর্মের ধরন"
              className="inline-flex rounded-xl bg-theme-surface-subtle p-1 border border-theme-border"
            >
              <button
                type="button"
                onClick={() => setFormMode('blank')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
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
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
                  formMode === 'filled'
                    ? 'bg-theme-surface text-theme-text-primary shadow-xs border border-theme-border'
                    : 'text-theme-text-secondary hover:text-theme-text-primary'
                }`}
              >
                হাজিরাসহ শিট
              </button>
            </div>

            <label className="min-h-[44px] inline-flex items-center gap-2 px-2.5 rounded-xl text-xs sm:text-sm text-theme-text-secondary hover:text-theme-text-primary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideFridays}
                onChange={(e) => setHideFridays(e.target.checked)}
                className="w-4 h-4 accent-theme-primary rounded cursor-pointer"
              />
              <span>শুক্রবার বাদ দিন</span>
            </label>
          </div>

          {canExport && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={exporting || !selectedTrade}
                onClick={handleExportCSV}
                className="min-h-[44px] px-4 rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <Download size={16} />
                <span>{exporting ? 'সংরক্ষণ হচ্ছে...' : 'CSV এক্সপোর্ট'}</span>
              </button>
              <button
                type="button"
                disabled={!selectedTrade}
                onClick={handlePrintSheet}
                className="min-h-[44px] px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <Printer size={16} />
                <span>প্রিন্ট / PDF ফর্ম</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Printable Form Preview */}
      <div className="bg-theme-surface text-theme-text-primary p-4 sm:p-6 rounded-[14px] border border-theme-border print:bg-white print:text-slate-900 print:border-none print:p-0">
        <div className="text-center border-b-2 border-theme-border-strong print:border-slate-800 pb-4 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-theme-text-primary print:text-slate-900">
            গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
          </h2>
          <h3 className="text-sm sm:text-base font-semibold text-theme-text-primary print:text-slate-800 mt-0.5">
            উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
          </h3>
          <p className="text-xs text-theme-text-secondary print:text-slate-600 mt-0.5">
            ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কর্মসূচি
          </p>
          <div className="mt-2.5 inline-block px-4 py-1 bg-theme-surface-subtle print:bg-slate-100 rounded-md font-semibold text-xs sm:text-sm text-theme-text-primary print:text-slate-900">
            মাসিক হাজিরা সিট (ট্রেড ভিত্তিক) — {monthName} {toBn(selectedYear)}
          </div>
          <div className="mt-2.5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-theme-text-secondary print:text-slate-600">
            <span>
              ট্রেড:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {selectedTrade?.name || '—'}
              </strong>
            </span>
            <span>
              ব্যাচ:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {selectedBatch ? selectedBatch.name : 'সকল ব্যাচ'}
              </strong>
            </span>
            <span>
              প্রতিষ্ঠান:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {derivedInstituteLabel}
              </strong>
            </span>
            <span className="tabular-nums">
              প্রশিক্ষণার্থী:{' '}
              <strong className="text-theme-text-primary print:text-slate-900">
                {toBn(sheetTrainees.length)} জন
              </strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-theme-border-strong print:border-slate-400 text-[11px]">
            <thead className="bg-theme-surface-subtle print:bg-slate-100 text-theme-text-primary print:text-slate-900">
              <tr>
                <th className="border border-theme-border-strong print:border-slate-400 px-2 py-2 text-center w-9">
                  ক্রঃ
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-left whitespace-nowrap">
                  রেজিঃ নং
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-left min-w-[155px]">
                  প্রশিক্ষণার্থীর নাম
                </th>
                {daysList.map((d) => (
                  <th
                    key={d.day}
                    className={`border border-theme-border-strong print:border-slate-400 px-1 py-1.5 text-center min-w-[26px] tabular-nums ${
                      d.isFriday
                        ? 'bg-theme-danger-soft text-theme-danger print:bg-rose-50 print:text-rose-700'
                        : ''
                    }`}
                  >
                    <div className="font-semibold leading-none">{toBn(d.day)}</div>
                    <div className="text-[9px] font-normal opacity-80 mt-0.5">
                      {d.weekdayBn}
                    </div>
                  </th>
                ))}
                <th className="border border-theme-border-strong print:border-slate-400 px-2 py-2 text-center whitespace-nowrap">
                  উপস্থিত
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center min-w-[82px]">
                  স্বাক্ষর
                </th>
              </tr>
            </thead>
            <tbody>
              {sheetTrainees.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysList.length + 5}
                    className="border border-theme-border-strong print:border-slate-400 py-8 text-center text-theme-text-muted print:text-slate-500"
                  >
                    এই ট্রেডে কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                sheetTrainees.map((t, idx) => {
                  let presentCount = 0;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-theme-surface-hover print:hover:bg-transparent"
                    >
                      <td className="border border-theme-border-strong print:border-slate-400 px-2 py-2 text-center tabular-nums">
                        {toBn(idx + 1)}
                      </td>
                      <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 font-mono font-semibold tabular-nums whitespace-nowrap">
                        {t.registrationNumber || t.traineeId || '—'}
                      </td>
                      <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2">
                        <div className="font-medium text-theme-text-primary print:text-slate-900">
                          {t.nameBn || t.nameEn || '—'}
                        </div>
                        {!selectedBatch && (
                          <div className="text-[10px] text-theme-text-secondary print:text-slate-500">
                            {getBatchName(t.batchId)}
                          </div>
                        )}
                      </td>
                      {daysList.map((d) => {
                        if (formMode === 'blank' || d.isFriday) {
                          return (
                            <td
                              key={d.day}
                              className={`border border-theme-border-strong print:border-slate-400 h-7 text-center ${
                                d.isFriday
                                  ? 'bg-theme-danger-soft/60 print:bg-rose-50'
                                  : ''
                              }`}
                            />
                          );
                        }
                        const code = attendanceMap.get(`${t.id}|${d.dateStr}`) || '';
                        if (code === 'P') presentCount++;
                        const codeClass =
                          code === 'P'
                            ? 'text-theme-success print:text-emerald-700 font-semibold'
                            : code === 'A'
                            ? 'text-theme-danger print:text-red-700 font-semibold'
                            : code === 'L'
                            ? 'text-theme-warning print:text-amber-700 font-semibold'
                            : 'text-theme-text-muted';
                        return (
                          <td
                            key={d.day}
                            className={`border border-theme-border-strong print:border-slate-400 h-7 text-center ${codeClass}`}
                          >
                            {code}
                          </td>
                        );
                      })}
                      <td className="border border-theme-border-strong print:border-slate-400 px-2 py-2 text-center font-semibold tabular-nums">
                        {formMode === 'filled' ? toBn(presentCount) : ''}
                      </td>
                      <td className="border border-theme-border-strong print:border-slate-400 px-2 py-2" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Print Signatures */}
        <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs mt-5">
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              প্রশিক্ষকের স্বাক্ষর ও তারিখ
            </div>
          </div>
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              প্রতিষ্ঠান প্রধানের স্বাক্ষর
            </div>
          </div>
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              কোর্স পরিচালক
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
