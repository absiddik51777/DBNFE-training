import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, FileText, Globe, X } from 'lucide-react';
import { saveFile } from '../../lib/fileExportService';
import { toBn } from '../../lib/dateUtils';
import {
  MONTH_NAMES_BN,
  buildRegisterHtml,
  type GetAttendanceFn,
  type RegisterDay,
  type StudentRegisterRow,
} from './types';
import { TruncatedText } from '../ui/TruncatedText';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  batchId: string;
  batchName: string;
  tradeName: string;
  instituteName: string;
  daysList: RegisterDay[];
  rows: StudentRegisterRow[];
  getAttendance: GetAttendanceFn;
  dailyTotals: Record<number, { present: number; absent: number }>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  year,
  month,
  batchId,
  batchName,
  tradeName,
  instituteName,
  daysList,
  rows,
  getAttendance,
  dailyTotals,
}) => {
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'csv' | 'html' | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const monthPad = String(month).padStart(2, '0');
  const fileBase = `attendance-${year}-${monthPad}`;
  const monthLabel = MONTH_NAMES_BN[month - 1] || '';

  const buildTabularRows = () => {
    const header = [
      'ক্রমিক',
      'নাম',
      'আইডি',
      ...daysList.map((d) => String(d.day)),
      'উপস্থিত',
      'অনুপস্থিত',
      'ছুটি',
      'হার %',
    ];

    const body = rows.map((row, idx) => [
      idx + 1,
      (row.trainee.nameBn || row.trainee.nameEn || '-').trim(),
      (row.trainee.traineeId || row.trainee.id || '').trim(),
      ...daysList.map((d) => getAttendance(batchId, year, month, row.trainee.id, d.day)),
      row.present,
      row.absent,
      row.leave,
      row.rate !== null ? `${row.rate}%` : '',
    ]);

    return { header, body };
  };

  const handleExportExcel = async () => {
    try {
      setExportingFormat('xlsx');
      const { header, body } = buildTabularRows();
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${year}-${monthPad}`);
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await saveFile(`${fileBase}.xlsx`, blob);
      onClose();
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingFormat('csv');
      const { header, body } = buildTabularRows();
      const escapeCsvCell = (val: string | number) => {
        const str = String(val ?? '');
        if (/[",\n\r]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const lines = [header, ...body].map((row) =>
        row.map((cell) => escapeCsvCell(cell)).join(',')
      );
      const csvText = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      await saveFile(`${fileBase}.csv`, blob);
      onClose();
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportHtml = async () => {
    try {
      setExportingFormat('html');
      const html = buildRegisterHtml({
        year,
        month,
        batchId,
        batchName,
        tradeName,
        instituteName,
        daysList,
        rows,
        getAttendance,
        dailyTotals,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      await saveFile(`${fileBase}.html`, blob);
      onClose();
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end min-[600px]:items-center justify-center bg-black/55 backdrop-blur-[1px] min-[600px]:p-4 print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className="w-full max-w-[480px] bg-[var(--reg-surface)] text-[var(--reg-text)] border border-[var(--reg-border)] rounded-t-[20px] min-[600px]:rounded-[20px] shadow-2xl overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))] min-[600px]:pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--reg-border)] flex items-start justify-between gap-3">
          <div>
            <h2
              id="export-modal-title"
              className="text-[16px] font-semibold text-[var(--reg-text)]"
            >
              এক্সপোর্ট / ফাইলের ফরম্যাট বেছে নিন
            </h2>
            <p className="text-[12px] text-[var(--reg-muted)] mt-0.5">
              {monthLabel} {toBn(year)} · {batchName} ({toBn(rows.length)} জন)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="w-9 h-9 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[var(--reg-muted)] hover:text-[var(--reg-text)] flex items-center justify-center shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {/* Card 1: Excel */}
          <button
            type="button"
            disabled={Boolean(exportingFormat)}
            onClick={handleExportExcel}
            className="w-full min-h-[54px] px-3.5 py-2.5 rounded-[14px] bg-[var(--reg-surface2)] border border-[var(--reg-border)] hover:border-[var(--reg-accent)] flex items-center gap-3 text-left transition cursor-pointer active:scale-[0.99] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--reg-green)]/15 text-[var(--reg-green)] flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-medium text-[var(--reg-text)]">
                Excel (.xlsx)
              </div>
              <TruncatedText
                as="div"
                text={`${fileBase}.xlsx · পূর্ণাঙ্গ স্প্রেডশিট ফরম্যাট`}
                mode="pop"
                className="text-[12px] text-[var(--reg-muted)]"
              />
            </div>
          </button>

          {/* Card 2: CSV */}
          <button
            type="button"
            disabled={Boolean(exportingFormat)}
            onClick={handleExportCsv}
            className="w-full min-h-[54px] px-3.5 py-2.5 rounded-[14px] bg-[var(--reg-surface2)] border border-[var(--reg-border)] hover:border-[var(--reg-accent)] flex items-center gap-3 text-left transition cursor-pointer active:scale-[0.99] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--reg-amber)]/15 text-[var(--reg-amber)] flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-medium text-[var(--reg-text)]">
                CSV (.csv)
              </div>
              <TruncatedText
                as="div"
                text={`${fileBase}.csv · UTF-8 BOM (Excel-এ বাংলা সাপোর্ট)`}
                mode="pop"
                className="text-[12px] text-[var(--reg-muted)]"
              />
            </div>
          </button>

          {/* Card 3: HTML */}
          <button
            type="button"
            disabled={Boolean(exportingFormat)}
            onClick={handleExportHtml}
            className="w-full min-h-[54px] px-3.5 py-2.5 rounded-[14px] bg-[var(--reg-surface2)] border border-[var(--reg-border)] hover:border-[var(--reg-accent)] flex items-center gap-3 text-left transition cursor-pointer active:scale-[0.99] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--reg-accent)]/15 text-[var(--reg-accent)] flex items-center justify-center shrink-0">
              <Globe size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-medium text-[var(--reg-text)]">
                HTML (.html)
              </div>
              <TruncatedText
                as="div"
                text={`${fileBase}.html · প্রিন্ট-বান্ধব ওয়েব ডকুমেন্ট`}
                mode="pop"
                className="text-[12px] text-[var(--reg-muted)]"
              />
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[42px] mt-1 rounded-[14px] bg-[var(--reg-bg)] border border-[var(--reg-border)] text-[var(--reg-text)] text-[14px] font-medium cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            বাতিল
          </button>
        </div>
      </div>
    </div>
  );
};
