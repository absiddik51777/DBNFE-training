/**
 * Export Utility for CSV, Excel (XLSX), and Print-to-PDF
 * Designed specifically for Bengali and English text with UTF-8 BOM encoding,
 * formula injection prevention, and official BNFE document layout.
 */
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { safeHtml2Canvas } from './safeHtml2Canvas';
import {
  saveFileToDevice,
  saveCsvFile,
  printCustomHtmlDocument,
  FileExportResult
} from './fileExportService';
import {
  getAppFontCssStack,
  getGoogleFontsStylesheetUrl,
  getStoredGlobalFontFamily,
} from './theme';

/**
 * Format a cell value for CSV export.
 * Addresses Excel's 15-digit precision truncation and scientific notation:
 * For Birth Registration Numbers (17 digits), NID, mobile numbers, and numeric IDs,
 * wraps them in ="value" formula syntax so Microsoft Excel and other spreadsheet apps
 * open them strictly as text without losing precision or stripping leading zeroes.
 */
export function formatTextCellForCsv(val: any, forceTextFormula = false): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (!str) return '""';

  // Check if value already has ="..." or ` prefix
  if (str.startsWith('="') && str.endsWith('"')) {
    return str;
  }
  if (str.startsWith('`')) {
    str = str.slice(1);
    return `="""${str.replace(/"/g, '""')}"""`;
  }

  // Detect numeric ID / phone / UBRN (17 digits) / NID (10, 13, 17 digits) / reg number
  const isNumericOnly = /^\d+$/.test(str);
  const isPhoneNumber = /^0\d{8,}$/.test(str);
  const isLongDigits = isNumericOnly && str.length >= 6; // e.g. UBRN, NID, mobile, numeric registration numbers

  if (forceTextFormula || isPhoneNumber || isLongDigits) {
    // Formula syntax: ="12345678901234567"
    // Excel evaluates this formula as a literal text string, completely preserving all 17 digits!
    const cleanNum = str.replace(/"/g, '""');
    return `="""${cleanNum}"""`;
  }

  // Protect against CSV Formula Injection for non-numeric fields
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes inside string by doubling them
  return `"${str.replace(/"/g, '""')}"`;
}

export function sanitizeForCSV(val: any): string {
  return formatTextCellForCsv(val);
}

/**
 * Download as CSV with UTF-8 BOM encoding for proper Bengali text rendering in Excel.
 * Routed through centralized fileExportService (native MediaStore Downloads on Android APK, Blob anchor on Web).
 */
export async function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
): Promise<FileExportResult> {
  const headerRow = headers.map(h => formatTextCellForCsv(h)).join(',');
  const dataRows = rows.map(row => row.map(cell => formatTextCellForCsv(cell)).join(','));

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel recognizes UTF-8 encoding for Bengali script
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  return saveCsvFile(safeFilename, csvContent, 'csv');
}

/**
 * Download as formatted Microsoft Excel (.xlsx) file.
 * Enforces text cell type (t: 's', z: '@') for numeric IDs (UBRN, phone, NID) to prevent
 * Excel's 15-digit precision limit from truncating 17-digit birth registration numbers.
 * Generates binary ArrayBuffer via XLSX.write and routes through centralized fileExportService.
 */
export async function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
  colWidths?: number[]
): Promise<FileExportResult> {
  // Map rows: ensure null/undefined are empty strings and preserve raw values
  const aoa = [
    headers,
    ...rows.map(r => r.map(c => {
      if (c === null || c === undefined) return '';
      // If cell was wrapped with ="...", extract inner string
      const str = String(c).trim();
      if (str.startsWith('="') && str.endsWith('"')) {
        return str.slice(2, -1);
      }
      return c;
    }))
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: false });

  // Enforce string type on cells to prevent 15-digit truncation
  for (const cellAddress in ws) {
    if (cellAddress.startsWith('!')) continue;
    const cell = ws[cellAddress];
    if (!cell) continue;

    const valStr = String(cell.v ?? '').trim();
    const isLongNum = /^\d{6,}$/.test(valStr);
    const isPhone = /^0\d{8,}$/.test(valStr);

    if (isLongNum || isPhone || typeof cell.v === 'string') {
      cell.t = 's'; // string type in XLSX
      cell.v = valStr;
      cell.z = '@'; // text format
    }
  }

  if (colWidths && colWidths.length > 0) {
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
  } else {
    // Auto-compute column widths
    const maxCols = headers.length;
    const computedWidths = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      let maxLen = String(headers[colIdx] || '').length;
      for (const row of rows) {
        const cellVal = String(row[colIdx] || '');
        if (cellVal.length > maxLen) {
          maxLen = cellVal.length;
        }
      }
      computedWidths.push({ wch: Math.min(Math.max(maxLen + 4, 12), 40) });
    }
    ws['!cols'] = computedWidths;
  }

  const wb = XLSX.utils.book_new();
  const safeSheetName = sheetName.replace(/[:\\/?*\[\]]/g, '').substring(0, 31) || 'Trainees';
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const xlsxArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const xlsxBlob = new Blob([xlsxArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return saveFileToDevice({
    fileName: safeFilename,
    content: xlsxBlob,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'excel'
  });
}

/**
 * Types and helper for printable Official BNFE BRN Verification PDF Report
 */
export interface BRNPrintReportTraineeItem {
  sl: number | string;
  id: string;
  regNo?: string;
  nameBn: string;
  nameEn: string;
  ubrn: string;
  ubrnValidation: string;
  dob: string;
  gender: string;
  institute: string;
  batch: string;
  status: 'Verified' | 'Invalid' | 'Pending';
  remark?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface BRNPrintReportOptions {
  title?: string;
  scopeLabel: string;
  generatedBy?: string;
  generatedDateStr?: string;
  filterDetails?: string;
  stats: {
    total: number;
    verified: number;
    invalid: number;
    pending: number;
  };
  trainees: BRNPrintReportTraineeItem[];
}

/**
 * Opens official BRN Verification Report in the unified MS-Word DocumentPrintFrame
 * (with Zoom, Page Settings, PDF/HTML download, multi-page pagination & Print).
 */
export async function printBRNReportPDF(options: BRNPrintReportOptions): Promise<FileExportResult> {
  const {
    title = 'প্রশিক্ষণার্থীদের জন্ম নিবন্ধন অনলাইন যাচাইকরণ প্রতিবেদন (BRN Verification Report)',
    scopeLabel,
    generatedBy = 'Course Director',
    generatedDateStr = new Date().toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    filterDetails,
    stats,
    trainees,
  } = options;

  const esc = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const safeName =
    title
      .replace(/[^\w\u0980-\u09FF-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'BNFE_BRN_Verification_Report';

  const rowsHtml =
    trainees.length === 0
      ? `<tr><td colspan="9" style="text-align:center; padding:24px; color:#475569;">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</td></tr>`
      : trainees
          .map((t, idx) => {
            const statusText =
              t.status === 'Verified'
                ? 'Valid (যাচাইকৃত)'
                : t.status === 'Invalid'
                ? 'Invalid (অবৈধ)'
                : 'Pending (অপেক্ষমাণ)';
            const statusColor =
              t.status === 'Verified'
                ? '#065f46'
                : t.status === 'Invalid'
                ? '#9f1239'
                : '#92400e';

            return `<tr>
              <td style="text-align:center;font-weight:700;">${esc(t.sl || idx + 1)}</td>
              <td style="font-family:inherit;font-weight:700;">
                <div>${esc(t.id || '-')}</div>
                <div style="font-weight:400;font-size:0.88em;">${esc(t.regNo || '—')}</div>
              </td>
              <td>
                <div style="font-weight:700;">${esc(t.nameBn || '-')}</div>
                <div style="font-size:0.88em;color:#334155;">${esc(t.nameEn || '-')}</div>
              </td>
              <td>
                <div style="font-family:inherit;font-weight:700;">${esc(t.ubrn || 'অনুপস্থিত')}</div>
                <div style="font-size:0.84em;color:#334155;">${esc(t.ubrnValidation)}</div>
              </td>
              <td style="font-family:inherit;">${esc(t.dob || '—')}</td>
              <td>${esc(t.gender || '-')}</td>
              <td>
                <div style="font-weight:600;">${esc(t.batch || '-')}</div>
                <div style="font-size:0.88em;color:#334155;">${esc(t.institute || '-')}</div>
              </td>
              <td style="text-align:center;font-weight:700;color:${statusColor};">${esc(statusText)}</td>
              <td style="font-size:0.88em;">${esc(t.remark || '—')}</td>
            </tr>`;
          })
          .join('');

  const fontOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const activeGlobalFont = getStoredGlobalFontFamily();
  const fontCssStack = getAppFontCssStack(activeGlobalFont);
  const googleFontHref = getGoogleFontsStylesheetUrl(activeGlobalFont);
  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  ${googleFontHref ? `<link rel="stylesheet" href="${googleFontHref}" />` : ''}
  <style>
    @font-face { font-family: 'Nikosh'; src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh'); font-weight: 400; font-style: normal; }
    @font-face { font-family: 'Nikosh'; src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh'); font-weight: 500; font-style: normal; }
    @font-face { font-family: 'Nikosh'; src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh'); font-weight: 600; font-style: normal; }
    @font-face { font-family: 'Nikosh'; src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh'); font-weight: 700; font-style: normal; }
    body { font-family: ${fontCssStack}; color: #000000; }
    .brn-hdr { text-align:center; border-bottom: 1.5px solid #475569; padding-bottom: 8px; margin-bottom: 10px; }
    .brn-hdr h1 { margin:0; font-size: 1.35em; font-weight: 800; }
    .brn-hdr h2 { margin:2px 0 0; font-size: 1.05em; font-weight: 700; }
    .brn-hdr p { margin:3px 0 0; font-size: 1em; font-weight: 700; }
    .brn-meta { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; margin-bottom:8px; font-size:0.9em; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 0.85em; }
    th, td { border: 1px solid #64748b; padding: 5px 6px; vertical-align: middle; word-break: break-word; }
    th { background: #f1f5f9; font-weight: 700; text-align: left; }
    .brn-foot { margin-top: 10px; border-top: 1px solid #94a3b8; padding-top: 6px; display:flex; justify-content:space-between; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="brn-hdr">
    <h1>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h1>
    <h2>উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE), প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়</h2>
    <p>${esc(title)}</p>
  </div>
  <div class="brn-meta">
    <div><strong>আওতা:</strong> ${esc(scopeLabel)} ${filterDetails ? `• ${esc(filterDetails)}` : ''}</div>
    <div><strong>যাচাইকৃত:</strong> ${esc(stats.verified)} | <strong>অবৈধ:</strong> ${esc(stats.invalid)} | <strong>অপেক্ষমাণ:</strong> ${esc(stats.pending)} • <strong>তারিখ:</strong> ${esc(generatedDateStr)}</div>
  </div>
  <table>
    <colgroup>
      <col style="width:5%" />
      <col style="width:10%" />
      <col style="width:15%" />
      <col style="width:15%" />
      <col style="width:9%" />
      <col style="width:6%" />
      <col style="width:16%" />
      <col style="width:11%" />
      <col style="width:13%" />
    </colgroup>
    <thead>
      <tr>
        <th style="text-align:center;">ক্রমিক</th>
        <th>আইডি ও রেজিঃ</th>
        <th>শিক্ষার্থীর নাম</th>
        <th>জন্ম নিবন্ধন (UBRN)</th>
        <th>জন্ম তারিখ</th>
        <th>লিঙ্গ</th>
        <th>প্রতিষ্ঠান ও ব্যাচ</th>
        <th style="text-align:center;">যাচাই স্ট্যাটাস</th>
        <th>মন্তব্য</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="brn-foot">
    <div>* BNFE জন্ম নিবন্ধন যাচাই সিস্টেম</div>
    <div><strong>প্রস্তুতকারী:</strong> ${esc(generatedBy)}</div>
  </div>
</body>
</html>`;

  const { printCustomHtmlDocument } = await import('./fileExportService');
  return printCustomHtmlDocument({
    html,
    jobName: safeName,
    title,
    landscape: true,
  });
}

/**
 * Generates an actual binary PDF Blob for BRN Verification Report so both Web and Android APK
 * can save it directly into the user's Downloads folder without relying on browser Print dialogs.
 */
export async function generateBRNReportPDF(options: BRNPrintReportOptions): Promise<Blob> {
  const {
    title = 'প্রশিক্ষণার্থীদের জন্ম নিবন্ধন অনলাইন যাচাইকরণ প্রতিবেদন (BRN Verification Report)',
    scopeLabel,
    generatedBy = 'Course Director',
    generatedDateStr = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }),
    filterDetails,
    stats,
    trainees
  } = options;

  const ROWS_PER_PAGE = 9;
  const totalPages = Math.max(1, Math.ceil(trainees.length / ROWS_PER_PAGE));

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const container = document.createElement('div');
  container.id = 'brn-pdf-offscreen-container';
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '1140px';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-999';
  document.body.appendChild(container);

  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const startIdx = pageIdx * ROWS_PER_PAGE;
      const pageItems = trainees.slice(startIdx, startIdx + ROWS_PER_PAGE);

      const pageEl = document.createElement('div');
      pageEl.style.width = '1100px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = '18px 24px 20px 24px';
      pageEl.style.backgroundColor = '#ffffff';
      pageEl.style.fontFamily = getAppFontCssStack(getStoredGlobalFontFamily());
      pageEl.style.color = '#000000';

      const rowsHtml = pageItems.length === 0
        ? `<tr><td colspan="9" style="text-align:center; padding:24px; color:#475569;">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</td></tr>`
        : pageItems.map((t, idx) => {
            const statusText = t.status === 'Verified'
              ? 'Valid (যাচাইকৃত)'
              : t.status === 'Invalid'
                ? 'Invalid (অবৈধ)'
                : 'Pending (অপেক্ষমাণ)';
            const statusColor = t.status === 'Verified'
              ? '#065f46'
              : t.status === 'Invalid'
                ? '#9f1239'
                : '#92400e';

            return `
              <tr style="border-bottom: 1px solid #94a3b8; font-size: 9.5px; color: #000000;">
                <td style="padding: 6px 5px; text-align: center; font-weight: bold; border-right: 1px solid #94a3b8;">${t.sl || (startIdx + idx + 1)}</td>
                <td style="padding: 6px 7px; font-family: inherit; font-weight: bold; border-right: 1px solid #94a3b8;">
                  <div>${t.id || '-'}</div>
                  <div style="font-weight: normal; font-size: 8.5px;">${t.regNo || '—'}</div>
                </td>
                <td style="padding: 6px 7px; border-right: 1px solid #94a3b8;">
                  <div style="font-weight: bold;">${t.nameBn || '-'}</div>
                  <div style="font-size: 8.5px; color: #334155;">${t.nameEn || '-'}</div>
                </td>
                <td style="padding: 6px 7px; border-right: 1px solid #94a3b8;">
                  <div style="font-family: inherit; font-weight: bold; font-size: 10px;">${t.ubrn || 'অনুপস্থিত'}</div>
                  <div style="font-size: 8px; color: #334155;">${t.ubrnValidation}</div>
                </td>
                <td style="padding: 6px 7px; font-family: inherit; border-right: 1px solid #94a3b8;">${t.dob || '—'}</td>
                <td style="padding: 6px 7px; border-right: 1px solid #94a3b8;">${t.gender || '-'}</td>
                <td style="padding: 6px 7px; border-right: 1px solid #94a3b8;">
                  <div style="font-weight: 600;">${t.batch || '-'}</div>
                  <div style="font-size: 8.5px; color: #334155;">${t.institute || '-'}</div>
                </td>
                <td style="padding: 6px 7px; text-align: center; font-weight: bold; color: ${statusColor}; border-right: 1px solid #94a3b8;">${statusText}</td>
                <td style="padding: 6px 7px; font-size: 8.5px;">${t.remark || '—'}</td>
              </tr>
            `;
          }).join('');

      pageEl.innerHTML = `
        <div style="text-align: center; border-bottom: 1.5px solid #94a3b8; padding-bottom: 6px; margin-bottom: 8px;">
          <div style="font-size: 15px; font-weight: 900; color: #000000;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
          <div style="font-size: 12px; font-weight: bold; color: #000000; margin-top: 2px;">উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE), প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়</div>
          <div style="font-size: 11.5px; font-weight: 800; color: #000000; margin-top: 2px;">${title}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 9.5px;">
          <div><strong>আওতা:</strong> ${scopeLabel} ${filterDetails ? `• ${filterDetails}` : ''}</div>
          <div><strong>যাচাইকৃত:</strong> ${stats.verified} | <strong>অবৈধ:</strong> ${stats.invalid} | <strong>অপেক্ষমাণ:</strong> ${stats.pending} • <strong>তারিখ:</strong> ${generatedDateStr}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #94a3b8; table-layout: fixed;">
          <thead>
            <tr style="background-color: #f8fafc; color: #000000; font-size: 9px; font-weight: bold; border-bottom: 1.5px solid #94a3b8; text-align: left;">
              <th style="padding: 6px 4px; text-align: center; border-right: 1px solid #94a3b8; width: 40px;">ক্রমিক</th>
              <th style="padding: 6px 7px; border-right: 1px solid #94a3b8; width: 105px;">আইডি ও রেজিঃ</th>
              <th style="padding: 6px 7px; border-right: 1px solid #94a3b8; width: 175px;">শিক্ষার্থীর নাম</th>
              <th style="padding: 6px 7px; border-right: 1px solid #94a3b8; width: 165px;">জন্ম নিবন্ধন (UBRN)</th>
              <th style="padding: 6px 7px; border-right: 1px solid #94a3b8; width: 85px;">জন্ম তারিখ</th>
              <th style="padding: 6px 7px; border-right: 1px solid #94a3b8; width: 55px;">লিঙ্গ</th>
              <th style="padding: 6px 7px; border-right: 1px solid #94a3b8; width: 175px;">প্রতিষ্ঠান ও ব্যাচ</th>
              <th style="padding: 6px 7px; text-align: center; border-right: 1px solid #94a3b8; width: 110px;">যাচাই স্ট্যাটাস</th>
              <th style="padding: 6px 7px; width: 140px;">মন্তব্য</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="margin-top: 10px; border-top: 1px solid #94a3b8; padding-top: 5px; display: flex; justify-content: space-between; font-size: 8.5px;">
          <div>* BNFE জন্ম নিবন্ধন যাচাই সিস্টেম</div>
          <div><strong>প্রস্তুতকারী:</strong> ${generatedBy}</div>
          <div><strong>পৃষ্ঠা ${pageIdx + 1} এর ${totalPages}</strong></div>
        </div>
      `;

      container.replaceChildren(pageEl);
      const canvas = await safeHtml2Canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidthMm = 273;
      const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;

      if (pageIdx > 0) {
        pdf.addPage('a4', 'landscape');
      }
      pdf.addImage(imgData, 'JPEG', 12, 10, imgWidthMm, imgHeightMm, undefined, 'FAST');
    }

    return pdf.output('blob');
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

// Re-export direct PDF generation, centralized export service, and print helpers
export { generateTraineesPDF, downloadPdfBlob, sharePdfBlob } from './pdfExportService';
export type { TraineePdfExportOptions } from './pdfExportService';
export {
  saveFileToDevice,
  saveCsvFile,
  saveTextFile,
  shareExportedFile,
  printCurrentDocument,
  printCustomHtmlDocument
} from './fileExportService';
export type { FileExportInput, FileExportResult } from './fileExportService';


