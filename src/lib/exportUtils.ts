/**
 * Export Utility for CSV, Excel (XLSX), and Print-to-PDF
 * Designed specifically for Bengali and English text with UTF-8 BOM encoding,
 * formula injection prevention, and official BNFE document layout.
 */
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  saveFileToDevice,
  saveCsvFile,
  printCustomHtmlDocument,
  FileExportResult
} from './fileExportService';

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

  return saveFileToDevice({
    fileName: safeFilename,
    content: new Uint8Array(xlsxArrayBuffer),
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
 * Prints official BRN Report via browser iframe (Web) or native Android PrintManager (APK).
 */
export async function printBRNReportPDF(options: BRNPrintReportOptions): Promise<FileExportResult> {
  const {
    title = 'প্রশিক্ষণার্থীদের জন্ম নিবন্ধন অনলাইন যাচাইকরণ প্রতিবেদন (BRN Verification Report)',
    scopeLabel,
    generatedBy = 'Course Director',
    generatedDateStr = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }),
    filterDetails,
    stats,
    trainees
  } = options;

  // Build the HTML content
  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 14mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'SolaimanLipi', 'Kalpurush', 'Nikosh', 'Segoe UI', Arial, sans-serif;
      font-size: 10px;
      line-height: 1.35;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .header-box {
      text-align: center;
      margin-bottom: 12px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
    }
    .gov-heading {
      font-size: 16px;
      font-weight: bold;
      color: #047857;
      margin: 0;
    }
    .sub-heading {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin: 2px 0 0 0;
    }
    .program-heading {
      font-size: 11px;
      color: #475569;
      margin: 1px 0 0 0;
    }
    .report-title-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 18px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      color: #1e293b;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 10px;
      color: #334155;
      padding: 4px 6px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .stats-strip {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }
    .stat-card {
      flex: 1;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      text-align: center;
    }
    .stat-card.verified {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }
    .stat-card.invalid {
      background: #fff1f2;
      border-color: #fecdd3;
      color: #9f1239;
    }
    .stat-card.pending {
      background: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }
    .stat-card-title {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: bold;
      display: block;
    }
    .stat-card-num {
      font-size: 14px;
      font-weight: 800;
      display: block;
      margin-top: 2px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .data-table th {
      background-color: #1e293b !important;
      color: #ffffff !important;
      font-weight: bold;
      text-align: left;
      padding: 6px 7px;
      border: 1px solid #0f172a;
      white-space: nowrap;
    }
    .data-table td {
      padding: 5px 7px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge-verified {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      background-color: #d1fae5 !important;
      color: #065f46 !important;
      font-weight: bold;
      border: 1px solid #6ee7b7;
      font-size: 9px;
      white-space: nowrap;
    }
    .badge-invalid {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      background-color: #ffe4e6 !important;
      color: #9f1239 !important;
      font-weight: bold;
      border: 1px solid #fca5a5;
      font-size: 9px;
      white-space: nowrap;
    }
    .badge-pending {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      background-color: #fef3c7 !important;
      color: #92400e !important;
      font-weight: bold;
      border: 1px solid #fcd34d;
      font-size: 9px;
      white-space: nowrap;
    }
    .ubrn-cell {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .signatures-block {
      margin-top: 32px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 200px;
    }
    .sig-line {
      border-top: 1px dashed #64748b;
      margin-bottom: 4px;
    }
    .sig-title {
      font-weight: bold;
      font-size: 10px;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 8.5px;
      color: #64748b;
    }
    .footer-note {
      margin-top: 16px;
      font-size: 8px;
      color: #64748b;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <!-- Header Banner -->
  <div class="header-box">
    <div class="gov-heading">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
    <div class="sub-heading">উপানুষ্ঠানিক শিক্ষা ব্যুরো (বিএনএফই), প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়</div>
    <div class="program-heading">দারিদ্র্য বিমোচন ও কর্মসংস্থান সৃষ্টির লক্ষ্যে দক্ষতামূলক প্রশিক্ষণ কর্মসূচি</div>
    <div class="report-title-badge">${title}</div>
  </div>

  <!-- Meta Information -->
  <div class="meta-bar">
    <div>
      <strong>আওতা / ক্যাটাগরি:</strong> ${scopeLabel}
      ${filterDetails ? ` | <strong>ফিল্টার:</strong> ${filterDetails}` : ''}
    </div>
    <div>
      <strong>প্রতিবেদন প্রস্তুতকারী:</strong> ${generatedBy} | <strong>তারিখ:</strong> ${generatedDateStr}
    </div>
  </div>

  <!-- Summary Statistics -->
  <div class="stats-strip">
    <div class="stat-card">
      <span class="stat-card-title">তালিকাভুক্ত শিক্ষার্থী</span>
      <span class="stat-card-num">${trainees.length} জন</span>
    </div>
    <div class="stat-card verified">
      <span class="stat-card-title">বৈধ ও যাচাইকৃত (Valid)</span>
      <span class="stat-card-num">${stats.verified} জন</span>
    </div>
    <div class="stat-card invalid">
      <span class="stat-card-title">অবৈধ / অমিল (Invalid)</span>
      <span class="stat-card-num">${stats.invalid} জন</span>
    </div>
    <div class="stat-card pending">
      <span class="stat-card-title">অপেক্ষমাণ (Pending)</span>
      <span class="stat-card-num">${stats.pending} জন</span>
    </div>
  </div>

  <!-- Trainees Table -->
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">ক্রমিক</th>
        <th style="width: 70px;">আইডি</th>
        <th style="width: 80px;">রেজিঃ নম্বর</th>
        <th>শিক্ষার্থীর নাম (বাংলা ও ইংরেজি)</th>
        <th style="width: 140px;">জন্ম নিবন্ধন নম্বর (UBRN)</th>
        <th style="width: 80px;">জন্ম তারিখ</th>
        <th style="width: 50px;">লিঙ্গ</th>
        <th>প্রতিষ্ঠান ও ব্যাচ</th>
        <th style="width: 100px; text-align: center;">যাচাই স্ট্যাটাস</th>
        <th>যাচাই মন্তব্য (Remark)</th>
      </tr>
    </thead>
    <tbody>
      ${trainees.length === 0 ? `
        <tr>
          <td colspan="10" style="text-align: center; padding: 25px; color: #64748b;">
            কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
          </td>
        </tr>
      ` : trainees.map((t, idx) => `
        <tr>
          <td style="text-align: center; font-weight: bold;">${t.sl || (idx + 1)}</td>
          <td style="font-family: monospace; font-weight: bold;">${t.id}</td>
          <td style="font-family: monospace;">${t.regNo || '—'}</td>
          <td>
            <strong>${t.nameBn}</strong><br/>
            <span style="color: #64748b; font-size: 8.5px;">${t.nameEn}</span>
          </td>
          <td>
            <span class="ubrn-cell">${t.ubrn || 'অনুপস্থিত'}</span><br/>
            <span style="font-size: 8px; color: ${t.ubrnValidation.includes('সঠিক') ? '#047857' : '#b45309'};">
              ${t.ubrnValidation}
            </span>
          </td>
          <td style="font-family: monospace;">${t.dob || '—'}</td>
          <td>${t.gender}</td>
          <td>
            <strong>${t.batch}</strong><br/>
            <span style="color: #64748b; font-size: 8.5px;">${t.institute}</span>
          </td>
          <td style="text-align: center;">
            ${t.status === 'Verified' ? `
              <span class="badge-verified">✓ Valid (যাচাইকৃত)</span>
            ` : t.status === 'Invalid' ? `
              <span class="badge-invalid">✕ Invalid (অবৈধ)</span>
            ` : `
              <span class="badge-pending">⏳ Pending (অপেক্ষমাণ)</span>
            `}
          </td>
          <td style="font-size: 8.5px; color: #334155;">
            ${t.remark || '—'}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Official Signatures -->
  <div class="signatures-block">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-title">ট্রেড প্রশিক্ষক (Trainer)</div>
      <div class="sig-sub">স্বাক্ষর ও তারিখ</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-title">ফিল্ড মনিটরিং অফিসার (FMA)</div>
      <div class="sig-sub">স্বাক্ষর ও তারিখ</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-title">কোর্স পরিচালক (Course Director)</div>
      <div class="sig-sub">অনুমোদনকারী স্বাক্ষর ও সিল</div>
    </div>
  </div>

  <!-- Footer Note -->
  <div class="footer-note">
    * এই প্রতিবেদনটি BNFE প্রশিক্ষণার্থী ব্যবস্থাপনা সিস্টেম হতে স্বয়ংক্রিয়ভাবে প্রস্তুতকৃত। BDRIS পোর্টালে অনলাইন অনুসন্ধানের ভিত্তিতে ডেটা হালনাগাদকৃত।
  </div>
</body>
</html>`;

  return printCustomHtmlDocument({
    html,
    jobName: title,
    landscape: true,
    iframeId: 'brn-print-iframe'
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
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const startIdx = pageIdx * ROWS_PER_PAGE;
      const pageItems = trainees.slice(startIdx, startIdx + ROWS_PER_PAGE);

      const pageEl = document.createElement('div');
      pageEl.style.width = '1100px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = '18px 24px 20px 24px';
      pageEl.style.backgroundColor = '#ffffff';
      pageEl.style.fontFamily = "'Noto Sans Bengali', Arial, sans-serif";
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
                <td style="padding: 6px 7px; font-family: monospace; font-weight: bold; border-right: 1px solid #94a3b8;">
                  <div>${t.id || '-'}</div>
                  <div style="font-weight: normal; font-size: 8.5px;">${t.regNo || '—'}</div>
                </td>
                <td style="padding: 6px 7px; border-right: 1px solid #94a3b8;">
                  <div style="font-weight: bold;">${t.nameBn || '-'}</div>
                  <div style="font-size: 8.5px; color: #334155;">${t.nameEn || '-'}</div>
                </td>
                <td style="padding: 6px 7px; border-right: 1px solid #94a3b8;">
                  <div style="font-family: monospace; font-weight: bold; font-size: 10px;">${t.ubrn || 'অনুপস্থিত'}</div>
                  <div style="font-size: 8px; color: #334155;">${t.ubrnValidation}</div>
                </td>
                <td style="padding: 6px 7px; font-family: monospace; border-right: 1px solid #94a3b8;">${t.dob || '—'}</td>
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
      const canvas = await html2canvas(pageEl, {
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


