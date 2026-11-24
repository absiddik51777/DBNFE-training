import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import { saveFile } from '../../lib/fileExportService';
import type {
  WeeklySignatureFontFamily,
  WeeklySignatureOrientation,
  WeeklySignaturePageConfig,
  WeeklySignaturePaperSize,
} from '../../types';

/**
 * Weekend / closed days in Bangladesh BNFE centers (5 = Friday, 6 = Saturday)
 */
export const OFF_DAYS: readonly number[] = [5, 6];

export interface SignatureTrainee {
  id: string;
  name: string;
}

export interface SignatureSheetHeading {
  govtTitle: string;
  officeTitle: string;
  officeAddress: string;
  programTitle: string;
  sheetTitle: string;
}

export const DEFAULT_SHEET_HEADING: SignatureSheetHeading = {
  govtTitle: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  officeTitle: 'জেলা উপানুষ্ঠানিক শিক্ষা ব্যুরো',
  officeAddress: 'কালেক্টরেট ভবন, ময়মনসিংহ',
  programTitle:
    "উপানুষ্ঠানিক শিক্ষা ব্যুরো'র বিশেষ কার্যক্রম কার্যকর সাক্ষরতা ও ব্যবহারিক কর্মদক্ষতা প্রশিক্ষণ প্রাক বৃত্তিমূলক পর্যায়",
  sheetTitle: 'প্রশিক্ষণার্থী হাজিরা সিট',
};

export const DEFAULT_SHEET_PAGE_CONFIG: WeeklySignaturePageConfig = {
  paperSize: 'a4',
  orientation: 'portrait',
  margins: {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  },
  fontFamily: 'Nikosh',
  fontSizePt: 11,
};

export const PAPER_SIZE_OPTIONS: ReadonlyArray<{
  value: WeeklySignaturePaperSize;
  label: string;
  subtitle: string;
  portraitWidthMm: number;
  portraitHeightMm: number;
  jsPdfFormat: 'a4' | 'legal' | 'letter';
  cssPageSize: string;
}> = [
  {
    value: 'a4',
    label: 'A4',
    subtitle: '২১০ × ২৯৭ মিমি',
    portraitWidthMm: 210,
    portraitHeightMm: 297,
    jsPdfFormat: 'a4',
    cssPageSize: 'A4',
  },
  {
    value: 'legal',
    label: 'Legal',
    subtitle: '২১৬ × ৩৫৬ মিমি',
    portraitWidthMm: 215.9,
    portraitHeightMm: 355.6,
    jsPdfFormat: 'legal',
    cssPageSize: 'legal',
  },
  {
    value: 'letter',
    label: 'Letter',
    subtitle: '২১৬ × ২৭৯ মিমি',
    portraitWidthMm: 215.9,
    portraitHeightMm: 279.4,
    jsPdfFormat: 'letter',
    cssPageSize: 'letter',
  },
];

export const FONT_FAMILY_OPTIONS: ReadonlyArray<{
  value: WeeklySignatureFontFamily;
  label: string;
  cssStack: string;
  docxFont: string;
}> = [
  {
    value: 'Nikosh',
    label: 'Nikosh (নিকষ - ডিফল্ট)',
    cssStack: "'Nikosh', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    docxFont: 'Nikosh',
  },
  {
    value: 'Hind Siliguri',
    label: 'Hind Siliguri',
    cssStack: "'Hind Siliguri', 'Noto Sans Bengali', 'Nikosh', sans-serif",
    docxFont: 'Hind Siliguri',
  },
  {
    value: 'Noto Sans Bengali',
    label: 'Noto Sans Bengali',
    cssStack: "'Noto Sans Bengali', 'Hind Siliguri', 'Nikosh', sans-serif",
    docxFont: 'Noto Sans Bengali',
  },
  {
    value: 'SolaimanLipi',
    label: 'SolaimanLipi (সোলাইমানলিপি)',
    cssStack: "'SolaimanLipi', 'Nikosh', 'Noto Sans Bengali', sans-serif",
    docxFont: 'SolaimanLipi',
  },
  {
    value: 'Kalpurush',
    label: 'Kalpurush (কালপুরুষ)',
    cssStack: "'Kalpurush', 'Nikosh', 'Noto Sans Bengali', sans-serif",
    docxFont: 'Kalpurush',
  },
  {
    value: 'system-ui',
    label: 'System Sans (সিস্টেম ফন্ট)',
    cssStack: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Bengali', sans-serif",
    docxFont: 'Vrinda',
  },
];

const VALID_PAPER_SIZES = new Set<WeeklySignaturePaperSize>(['a4', 'legal', 'letter']);
const VALID_ORIENTATIONS = new Set<WeeklySignatureOrientation>(['portrait', 'landscape']);
const VALID_FONTS = new Set<WeeklySignatureFontFamily>(
  FONT_FAMILY_OPTIONS.map((f) => f.value)
);

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num * 2) / 2));
}

export function normalizePageConfig(
  raw?: Partial<WeeklySignaturePageConfig> | null
): WeeklySignaturePageConfig {
  const paperSize: WeeklySignaturePaperSize =
    raw?.paperSize && VALID_PAPER_SIZES.has(raw.paperSize)
      ? raw.paperSize
      : DEFAULT_SHEET_PAGE_CONFIG.paperSize;

  const orientation: WeeklySignatureOrientation =
    raw?.orientation && VALID_ORIENTATIONS.has(raw.orientation)
      ? raw.orientation
      : DEFAULT_SHEET_PAGE_CONFIG.orientation;

  const fontFamily: WeeklySignatureFontFamily =
    raw?.fontFamily && VALID_FONTS.has(raw.fontFamily)
      ? raw.fontFamily
      : DEFAULT_SHEET_PAGE_CONFIG.fontFamily;

  return {
    paperSize,
    orientation,
    margins: {
      top: clampNumber(raw?.margins?.top, 4, 35, DEFAULT_SHEET_PAGE_CONFIG.margins.top),
      right: clampNumber(raw?.margins?.right, 4, 35, DEFAULT_SHEET_PAGE_CONFIG.margins.right),
      bottom: clampNumber(raw?.margins?.bottom, 4, 35, DEFAULT_SHEET_PAGE_CONFIG.margins.bottom),
      left: clampNumber(raw?.margins?.left, 4, 35, DEFAULT_SHEET_PAGE_CONFIG.margins.left),
    },
    fontFamily,
    fontSizePt: clampNumber(raw?.fontSizePt, 8, 16, DEFAULT_SHEET_PAGE_CONFIG.fontSizePt),
  };
}

export function getPaperDimensionsMm(
  paperSize: WeeklySignaturePaperSize,
  orientation: WeeklySignatureOrientation
) {
  const spec =
    PAPER_SIZE_OPTIONS.find((p) => p.value === paperSize) || PAPER_SIZE_OPTIONS[0];
  const isLandscape = orientation === 'landscape';
  return {
    portraitWidthMm: spec.portraitWidthMm,
    portraitHeightMm: spec.portraitHeightMm,
    widthMm: isLandscape ? spec.portraitHeightMm : spec.portraitWidthMm,
    heightMm: isLandscape ? spec.portraitWidthMm : spec.portraitHeightMm,
    jsPdfFormat: spec.jsPdfFormat,
    cssPageSize: spec.cssPageSize,
    label: spec.label,
  };
}

export function getFontCssStack(fontFamily: WeeklySignatureFontFamily): string {
  return (
    FONT_FAMILY_OPTIONS.find((f) => f.value === fontFamily)?.cssStack ||
    FONT_FAMILY_OPTIONS[0].cssStack
  );
}

export function getDocxFontName(fontFamily: WeeklySignatureFontFamily): string {
  return (
    FONT_FAMILY_OPTIONS.find((f) => f.value === fontFamily)?.docxFont ||
    FONT_FAMILY_OPTIONS[0].docxFont
  );
}

export interface SignatureSheetMeta {
  instituteName: string;
  tradeName: string;
  batchName?: string;
  heading?: SignatureSheetHeading;
  pageConfig?: WeeklySignaturePageConfig;
}

export interface WeekDayInfo {
  iso: string;
  dayIndex: number; // 0 (Sunday) .. 4 (Thursday)
  weekdayBn: string;
  fullDateBn: string;
  slashDateBn: string;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

const BN_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
] as const;

const BN_WEEKDAYS: Record<number, string> = {
  0: 'রবিবার',
  1: 'সোমবার',
  2: 'মঙ্গলবার',
  3: 'বুধবার',
  4: 'বৃহস্পতিবার',
  5: 'শুক্রবার',
  6: 'শনিবার',
};

const SAMPLE_TRAINEE_NAMES: readonly string[] = [
  'তানজিলা আক্তার',
  'সুমাইয়া খাতুন',
  'ফারজানা ইয়াসমিন',
  'নুসরাত জাহান',
  'আফরোজা বেগম',
  'শারমিন সুলতানা',
  'মাহফুজা আক্তার',
  'জান্নাতুল ফেরদৌস',
  'রোকসানা পারভীন',
  'তাসলিমা খাতুন',
  'হালিমা আক্তার',
  'নাজমুন নাহার',
  'সাদিয়া আফরিন',
  'মরিয়ম আক্তার',
  'শিরিন আক্তার',
  'রাবিয়া বসরী',
  'কানিজ ফাতেমা',
  'লামিয়া ইসলাম',
  'ইসরাত জাহান',
  'মেহেরুন নেছা',
];

/**
 * Single data accessor for trainee list — replace with API/DB call when needed.
 */
export function getTrainees(): SignatureTrainee[] {
  return SAMPLE_TRAINEE_NAMES.map((name, idx) => ({
    id: `sig-trainee-${idx + 1}`,
    name,
  }));
}

export function toBnDigits(input: number | string): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[parseInt(d, 10)] ?? d);
}

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalIsoDate(iso: string): Date {
  const parts = iso.split('-').map((n) => parseInt(n, 10));
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

export function formatBnDate(isoDate: string): string {
  const parts = isoDate.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate;
  const [y, m, d] = parts;
  return `${toBnDigits(d)} ${BN_MONTHS[m - 1] || ''} ${toBnDigits(y)}`;
}

export function formatBnSlashDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${toBnDigits(parts[2])}/${toBnDigits(parts[1])}/${toBnDigits(parts[0])}`;
}

export function formatSelectedRangeBn(days: WeekDayInfo[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return days[0].fullDateBn;

  const first = days[0];
  const last = days[days.length - 1];
  const [fy, fm, fd] = first.iso.split('-').map((n) => parseInt(n, 10));
  const [ly, lm, ld] = last.iso.split('-').map((n) => parseInt(n, 10));

  if (fy === ly && fm === lm) {
    return `${toBnDigits(fd)} – ${toBnDigits(ld)} ${BN_MONTHS[lm - 1]} ${toBnDigits(ly)}`;
  }
  if (fy === ly) {
    return `${toBnDigits(fd)} ${BN_MONTHS[fm - 1]} – ${toBnDigits(ld)} ${
      BN_MONTHS[lm - 1]
    } ${toBnDigits(ly)}`;
  }
  return `${first.fullDateBn} – ${last.fullDateBn}`;
}

/**
 * Snaps any input date to a Sunday–Thursday training week.
 * If the picked date falls on an OFF_DAYS weekend (Friday=5 or Saturday=6),
 * jumps forward to the NEXT Sunday and marks `jumpedFromWeekend = true`.
 */
export function weekOf(dateInput: Date | string): {
  sundayIso: string;
  days: WeekDayInfo[];
  jumpedFromWeekend: boolean;
} {
  const base =
    typeof dateInput === 'string'
      ? parseLocalIsoDate(dateInput)
      : new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());

  const dayOfWeek = base.getDay();
  let sunday: Date;
  let jumpedFromWeekend = false;

  if (OFF_DAYS.includes(dayOfWeek)) {
    // Jump forward to next Sunday: Friday(5)->+2, Saturday(6)->+1
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    sunday = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + daysUntilSunday
    );
    jumpedFromWeekend = true;
  } else {
    // Snap back to this week's Sunday (0)
    sunday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dayOfWeek);
  }

  const days: WeekDayInfo[] = [];
  for (let offset = 0; offset < 5; offset++) {
    const dt = new Date(
      sunday.getFullYear(),
      sunday.getMonth(),
      sunday.getDate() + offset
    );
    const iso = toLocalIsoDate(dt);
    const idx = dt.getDay();
    days.push({
      iso,
      dayIndex: idx,
      weekdayBn: BN_WEEKDAYS[idx] || '',
      fullDateBn: formatBnDate(iso),
      slashDateBn: formatBnSlashDate(iso),
    });
  }

  return {
    sundayIso: toLocalIsoDate(sunday),
    days,
    jumpedFromWeekend,
  };
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const dt = parseLocalIsoDate(isoDate);
  const shifted = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + deltaDays);
  return toLocalIsoDate(shifted);
}

export const PX_PER_MM = 96 / 25.4;

export interface SheetPageSlice {
  rowIndices: number[];
  includeHeader: boolean;
  includeTable: boolean;
  includeFooter: boolean;
}

function paginateWithFooterReserve(
  usableHeightPx: number,
  topExtrasH: number,
  theadH: number,
  rowHeights: number[],
  footerH: number,
  reservedBottomH: number,
  safetyPx: number
): SheetPageSlice[] {
  const effectiveUsableH = Math.max(120, usableHeightPx - reservedBottomH);

  if (rowHeights.length === 0) {
    const emptyBodyH = Math.max(36, theadH);
    const fitsTogether =
      topExtrasH + theadH + emptyBodyH + footerH <= effectiveUsableH - safetyPx;
    if (fitsTogether) {
      return [
        { rowIndices: [], includeHeader: true, includeTable: true, includeFooter: true },
      ];
    }
    return [
      { rowIndices: [], includeHeader: true, includeTable: true, includeFooter: false },
      { rowIndices: [], includeHeader: true, includeTable: false, includeFooter: true },
    ];
  }

  const rowPages: number[][] = [[]];
  let used = topExtrasH + theadH;

  for (let i = 0; i < rowHeights.length; i++) {
    const current = rowPages[rowPages.length - 1];
    if (current.length > 0 && used + rowHeights[i] > effectiveUsableH - safetyPx) {
      rowPages.push([i]);
      used = topExtrasH + theadH + rowHeights[i];
    } else {
      current.push(i);
      used += rowHeights[i];
    }
  }

  let includeFooterOnlyPage = false;
  if (footerH > 0 && used + footerH > effectiveUsableH - safetyPx) {
    const lastPage = rowPages[rowPages.length - 1];
    if (lastPage.length > 1) {
      const movedIdx = lastPage.pop()!;
      if (topExtrasH + theadH + rowHeights[movedIdx] + footerH <= effectiveUsableH - safetyPx) {
        rowPages.push([movedIdx]);
      } else {
        lastPage.push(movedIdx);
        includeFooterOnlyPage = true;
      }
    } else {
      includeFooterOnlyPage = true;
    }
  }

  const slices: SheetPageSlice[] = rowPages.map((rowIndices, idx) => ({
    rowIndices,
    includeHeader: true,
    includeTable: true,
    includeFooter: !includeFooterOnlyPage && idx === rowPages.length - 1,
  }));

  if (includeFooterOnlyPage) {
    slices.push({
      rowIndices: [],
      includeHeader: true,
      includeTable: false,
      includeFooter: true,
    });
  }

  return slices;
}

export function computeSheetPageSlices(params: {
  usableHeightPx: number;
  topExtrasH: number;
  theadH: number;
  rowHeights: number[];
  footerH: number;
  pageNumberFooterH?: number;
  safetyPx?: number;
}): SheetPageSlice[] {
  const {
    usableHeightPx,
    topExtrasH,
    theadH,
    rowHeights,
    footerH,
    pageNumberFooterH = 30,
    safetyPx = 6,
  } = params;

  const singlePass = paginateWithFooterReserve(
    usableHeightPx,
    topExtrasH,
    theadH,
    rowHeights,
    footerH,
    0,
    safetyPx
  );

  if (singlePass.length <= 1 || pageNumberFooterH <= 0) {
    return singlePass;
  }

  return paginateWithFooterReserve(
    usableHeightPx,
    topExtrasH,
    theadH,
    rowHeights,
    footerH,
    pageNumberFooterH,
    safetyPx
  );
}

function normalizeCloneElement(
  source: HTMLElement,
  pageConfig: WeeklySignaturePageConfig,
  theadHeightPx: number,
  tbodyHeightPx: number
): HTMLElement {
  const cloned = source.cloneNode(true) as HTMLElement;
  cloned.style.visibility = 'visible';
  cloned.style.position = 'static';
  cloned.style.left = 'auto';
  cloned.style.top = 'auto';
  cloned.style.width = '100%';
  cloned.style.minWidth = '0';
  cloned.style.maxWidth = 'none';
  cloned.style.margin = '0';
  cloned.style.padding = '0';
  cloned.style.boxShadow = 'none';
  cloned.style.border = 'none';
  cloned.style.borderRadius = '0';
  cloned.style.backgroundColor = '#ffffff';
  cloned.style.color = '#000000';
  cloned.style.fontFamily = getFontCssStack(pageConfig.fontFamily);

  cloned.querySelectorAll('.weekly-sheet-paper-scroll').forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.overflow = 'visible';
    htmlEl.style.maxHeight = 'none';
    htmlEl.style.padding = '0';
  });

  cloned.querySelectorAll('table').forEach((tbl) => {
    const htmlTbl = tbl as HTMLElement;
    htmlTbl.style.width = '100%';
    htmlTbl.style.minWidth = '0';
    htmlTbl.style.tableLayout = 'fixed';
  });

  cloned.querySelectorAll('thead tr').forEach((tr) => {
    const htmlTr = tr as HTMLElement;
    htmlTr.style.height = `${theadHeightPx}px`;
  });

  cloned.querySelectorAll('tbody tr').forEach((tr) => {
    const htmlTr = tr as HTMLElement;
    htmlTr.style.height = `${tbodyHeightPx}px`;
  });

  cloned.querySelectorAll('th').forEach((cell) => {
    const htmlCell = cell as HTMLElement;
    htmlCell.style.verticalAlign = 'middle';
    htmlCell.style.overflow = 'visible';
    htmlCell.style.lineHeight = '1.25';
    htmlCell.style.paddingTop = '4px';
    htmlCell.style.paddingBottom = '7px';
  });

  cloned.querySelectorAll('td').forEach((cell) => {
    const htmlCell = cell as HTMLElement;
    htmlCell.style.verticalAlign = 'middle';
    htmlCell.style.overflow = 'visible';
    htmlCell.style.lineHeight = '1.25';
    htmlCell.style.paddingTop = '3px';
    htmlCell.style.paddingBottom = '6px';
  });

  cloned.querySelectorAll('th > div, td > div').forEach((inner) => {
    const htmlInner = inner as HTMLElement;
    htmlInner.style.overflow = 'visible';
    htmlInner.style.textOverflow = 'clip';
    htmlInner.style.whiteSpace = 'normal';
    htmlInner.style.lineHeight = '1.25';
  });

  return cloned;
}

/**
 * Renders off-screen white page(s) matching the selected paper size, orientation,
 * margins, font family, and font size, keeping table width at 100% of total
 * usable width and cleanly paginating across rows when taller than one page.
 */
export async function buildPdf(
  paperNode: HTMLElement,
  fileName: string,
  rawPageConfig?: WeeklySignaturePageConfig
): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Document unavailable');
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const pageConfig = normalizePageConfig(rawPageConfig);
  const dims = getPaperDimensionsMm(pageConfig.paperSize, pageConfig.orientation);
  const hostWidthPx = Math.round(dims.widthMm * PX_PER_MM);
  const hostHeightPx = Math.round(dims.heightMm * PX_PER_MM);
  const padTopPx = Math.round(pageConfig.margins.top * PX_PER_MM);
  const padRightPx = Math.round(pageConfig.margins.right * PX_PER_MM);
  const padBottomPx = Math.round(pageConfig.margins.bottom * PX_PER_MM);
  const padLeftPx = Math.round(pageConfig.margins.left * PX_PER_MM);
  const usableHeightPx = Math.max(180, hostHeightPx - padTopPx - padBottomPx);

  const fontScale = pageConfig.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;
  const theadHeightPx = Math.max(36, Math.round(46 * Math.max(0.85, fontScale)));
  const tbodyHeightPx = Math.max(24, Math.round(32 * Math.max(0.82, fontScale)));

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = `${hostWidthPx}px`;
  host.style.padding = `${padTopPx}px ${padRightPx}px ${padBottomPx}px ${padLeftPx}px`;
  host.style.boxSizing = 'border-box';
  host.style.backgroundColor = '#ffffff';
  host.style.color = '#000000';
  host.style.zIndex = '-9999';
  host.style.pointerEvents = 'none';

  const fullClone = normalizeCloneElement(paperNode, pageConfig, theadHeightPx, tbodyHeightPx);
  host.appendChild(fullClone);
  document.body.appendChild(host);

  try {
    const pdf = new jsPDF({
      orientation: pageConfig.orientation,
      unit: 'mm',
      format: dims.jsPdfFormat,
      compress: true,
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const captureOpts = {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: hostWidthPx,
      windowWidth: Math.max(hostWidthPx + 160, 1024),
      scrollX: 0,
      scrollY: 0,
    };

    const fullContentHeight = fullClone.scrollHeight;
    const tableEl = fullClone.querySelector('table.weekly-sheet-table') as HTMLTableElement | null;
    const theadEl = tableEl?.querySelector('thead') as HTMLElement | null;
    const tbodyRows = tableEl ? Array.from(tableEl.querySelectorAll('tbody tr')) : [];
    const footerEl = fullClone.querySelector('.weekly-sheet-footer') as HTMLElement | null;
    const sheetTitleText =
      fullClone.querySelector('h3')?.textContent?.trim() || 'প্রশিক্ষণার্থী হাজিরা সিট';

    if (fullContentHeight <= usableHeightPx - 6 || !tableEl || tbodyRows.length === 0) {
      host.style.minHeight = `${hostHeightPx}px`;
      const canvas = await html2canvas(host, captureOpts);
      const renderH = Math.min(pageH, (canvas.height / canvas.width) * pageW);
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, renderH, undefined, 'FAST');
    } else {
      const topChildren = Array.from(fullClone.children).filter(
        (el) => el !== tableEl && el !== footerEl
      ) as HTMLElement[];
      const topExtrasH = topChildren.reduce((sum, el) => {
        const cs = window.getComputedStyle(el);
        return (
          sum +
          el.offsetHeight +
          (parseFloat(cs.marginTop) || 0) +
          (parseFloat(cs.marginBottom) || 0)
        );
      }, 0);
      const theadH = theadEl ? theadEl.offsetHeight : theadHeightPx;
      const rowHeights = tbodyRows.map((tr) => (tr as HTMLElement).offsetHeight || tbodyHeightPx);
      const footerH = footerEl ? footerEl.offsetHeight + 16 : 0;

      const slices = computeSheetPageSlices({
        usableHeightPx,
        topExtrasH,
        theadH,
        rowHeights,
        footerH,
      });

      for (let p = 0; p < slices.length; p++) {
        const slice = slices[p];
        const pageClone = normalizeCloneElement(paperNode, pageConfig, theadHeightPx, tbodyHeightPx);
        const pTable = pageClone.querySelector('table.weekly-sheet-table') as HTMLTableElement | null;
        const pFooter = pageClone.querySelector('.weekly-sheet-footer') as HTMLElement | null;

        if (!slice.includeHeader) {
          Array.from(pageClone.children).forEach((child) => {
            if (child !== pTable && child !== pFooter) {
              child.remove();
            }
          });
        }

        if (!slice.includeFooter && pFooter) {
          pFooter.remove();
        }

        if (pTable) {
          if (!slice.includeTable) {
            pTable.remove();
          } else {
            const allowedIndices = new Set(slice.rowIndices);
            const rows = Array.from(pTable.querySelectorAll('tbody tr'));
            rows.forEach((tr, idx) => {
              if (!allowedIndices.has(idx)) {
                tr.remove();
              }
            });
          }
        }

        host.innerHTML = '';
        host.style.minHeight = `${hostHeightPx}px`;
        host.style.display = 'flex';
        host.style.flexDirection = 'column';
        host.style.justifyContent = 'space-between';
        host.appendChild(pageClone);

        if (slices.length > 1) {
          const footerBar = document.createElement('div');
          footerBar.style.width = '100%';
          footerBar.style.fontFamily = getFontCssStack(pageConfig.fontFamily);
          footerBar.style.fontSize = `${(10 * fontScale).toFixed(2)}px`;
          footerBar.style.color = '#000000';
          footerBar.style.marginTop = '8px';
          footerBar.style.paddingTop = '6px';
          footerBar.style.borderTop = '1px solid #cbd5e1';
          footerBar.style.display = 'flex';
          footerBar.style.alignItems = 'center';
          footerBar.style.justifyContent = 'space-between';

          const leftSpan = document.createElement('span');
          leftSpan.textContent = sheetTitleText;

          const rightSpan = document.createElement('span');
          rightSpan.style.fontWeight = '600';
          rightSpan.textContent = `পৃষ্ঠা ${toBnDigits(p + 1)} / ${toBnDigits(slices.length)}`;

          footerBar.appendChild(leftSpan);
          footerBar.appendChild(rightSpan);
          host.appendChild(footerBar);
        }

        const canvas = await html2canvas(host, captureOpts);
        const renderH = Math.min(pageH, (canvas.height / canvas.width) * pageW);
        const imgData = canvas.toDataURL('image/png');
        if (p > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pageW, renderH, undefined, 'FAST');
      }
    }

    const blob = pdf.output('blob');
    await saveFile(fileName, blob);
  } finally {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}

/**
 * Generates an editable Word (.docx) file matching the configured paper size,
 * orientation, margins, font family, and font size.
 */
export async function buildDocx(
  days: WeekDayInfo[],
  trainees: SignatureTrainee[],
  meta: SignatureSheetMeta,
  fileName: string,
  rawPageConfig?: WeeklySignaturePageConfig
): Promise<void> {
  const pageConfig = normalizePageConfig(rawPageConfig || meta.pageConfig);
  const dims = getPaperDimensionsMm(pageConfig.paperSize, pageConfig.orientation);
  const FONT = getDocxFontName(pageConfig.fontFamily);
  const { margins } = pageConfig;
  const CONTENT_W_MM = Math.max(80, dims.widthMm - margins.left - margins.right);
  const totalContentTwip = convertMillimetersToTwip(CONTENT_W_MM);

  const scale = pageConfig.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;
  const sz = (halfPtAtDefault: number) =>
    Math.max(12, Math.round(halfPtAtDefault * scale));

  const blackBorder = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: '000000',
  };
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'FFFFFF',
  };

  // Exact twip column width budget summing to 100% of total usable width
  const isLandscape = pageConfig.orientation === 'landscape';
  const slPct = isLandscape ? 0.05 : 0.06;
  const commentPct = 0.13;
  const namePct = days.length <= 3 ? (isLandscape ? 0.31 : 0.33) : isLandscape ? 0.27 : 0.25;
  const dayColPct = days.length > 0 ? (1 - slPct - namePct - commentPct) / days.length : 0;

  const slTwip = Math.round(totalContentTwip * slPct);
  const commentTwip = Math.round(totalContentTwip * commentPct);
  const dayTwip = days.length > 0 ? Math.floor(totalContentTwip * dayColPct) : 0;
  const adjustedNameTwip = totalContentTwip - slTwip - commentTwip - dayTwip * days.length;

  const colWidthsTwip = [
    slTwip,
    adjustedNameTwip,
    ...days.map(() => dayTwip),
    commentTwip,
  ];

  const headerRowMm = Math.max(10, Math.round(12 * Math.max(0.85, scale) * 10) / 10);
  const traineeRowMm = Math.max(6.8, Math.round(8.2 * Math.max(0.85, scale) * 10) / 10);

  // Header Row
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    height: {
      value: convertMillimetersToTwip(headerRowMm),
      rule: HeightRule.ATLEAST,
    },
    children: [
      new TableCell({
        width: { size: colWidthsTwip[0], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E5E7EB' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: 'ক্রমিক', bold: true, size: sz(19), font: FONT }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidthsTwip[1], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E5E7EB' },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: 'প্রশিক্ষণার্থীর নাম',
                bold: true,
                size: sz(19),
                font: FONT,
              }),
            ],
          }),
        ],
      }),
      ...days.map(
        (d, idx) =>
          new TableCell({
            width: { size: colWidthsTwip[2 + idx], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E5E7EB' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: d.weekdayBn, bold: true, size: sz(18), font: FONT }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: d.slashDateBn, size: sz(15), font: FONT }),
                ],
              }),
            ],
          })
      ),
      new TableCell({
        width: { size: colWidthsTwip[colWidthsTwip.length - 1], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E5E7EB' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: 'মন্তব্য', bold: true, size: sz(19), font: FONT }),
            ],
          }),
        ],
      }),
    ],
  });

  // Trainee Rows
  const traineeRows = trainees.map(
    (t, rowIdx) =>
      new TableRow({
        cantSplit: true,
        height: {
          value: convertMillimetersToTwip(traineeRowMm),
          rule: HeightRule.ATLEAST,
        },
        children: [
          new TableCell({
            width: { size: colWidthsTwip[0], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: toBnDigits(rowIdx + 1),
                    size: sz(18),
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: colWidthsTwip[1], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: t.name, size: sz(18), font: FONT })],
              }),
            ],
          }),
          ...days.map(
            (_d, dIdx) =>
              new TableCell({
                width: { size: colWidthsTwip[2 + dIdx], type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [new TextRun({ text: '', size: sz(18), font: FONT })],
                  }),
                ],
              })
          ),
          new TableCell({
            width: { size: colWidthsTwip[colWidthsTwip.length - 1], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: '', size: sz(18), font: FONT })],
              }),
            ],
          }),
        ],
      })
  );

  // Info line table (প্রতিষ্ঠান left, ট্রেড right)
  const leftInfoTwip = Math.floor(totalContentTwip / 2);
  const rightInfoTwip = totalContentTwip - leftInfoTwip;
  const infoTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: totalContentTwip, type: WidthType.DXA },
    columnWidths: [leftInfoTwip, rightInfoTwip],
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftInfoTwip, type: WidthType.DXA },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({ text: 'প্রতিষ্ঠান: ', bold: true, size: sz(19), font: FONT }),
                  new TextRun({ text: meta.instituteName, size: sz(19), font: FONT }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: rightInfoTwip, type: WidthType.DXA },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({ text: 'ট্রেড: ', bold: true, size: sz(19), font: FONT }),
                  new TextRun({ text: meta.tradeName, size: sz(19), font: FONT }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Main attendance table (100% of total usable width)
  const mainTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: totalContentTwip, type: WidthType.DXA },
    columnWidths: colWidthsTwip,
    borders: {
      top: blackBorder,
      bottom: blackBorder,
      left: blackBorder,
      right: blackBorder,
      insideHorizontal: blackBorder,
      insideVertical: blackBorder,
    },
    rows: [headerRow, ...traineeRows],
  });

  // 2 Signature Blocks
  const sigCol1Twip = Math.floor(totalContentTwip / 2);
  const sigCol2Twip = totalContentTwip - sigCol1Twip;
  const sigRuleBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const signaturesTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: totalContentTwip, type: WidthType.DXA },
    columnWidths: [sigCol1Twip, sigCol2Twip],
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          'প্রশিক্ষকের স্বাক্ষর',
          'ফিল্ড মনিটরিং অ্যাসিস্ট্যান্ট',
        ].map(
          (label, idx) =>
            new TableCell({
              width: { size: idx === 0 ? sigCol1Twip : sigCol2Twip, type: WidthType.DXA },
              margins: {
                top: 40,
                left: convertMillimetersToTwip(12),
                right: convertMillimetersToTwip(12),
              },
              borders: {
                top: noBorder,
                bottom: noBorder,
                left: noBorder,
                right: noBorder,
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { top: sigRuleBorder },
                  spacing: { before: 320, after: 0 },
                  children: [new TextRun({ text: label, size: sz(18), font: FONT })],
                }),
              ],
            })
        ),
      }),
    ],
  });

  const h = meta.heading || DEFAULT_SHEET_HEADING;
  const headerParagraphs: Paragraph[] = [];
  if (h.govtTitle.trim()) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 15 },
        children: [
          new TextRun({
            text: h.govtTitle.trim(),
            size: sz(18),
            font: FONT,
          }),
        ],
      })
    );
  }
  if (h.officeTitle.trim()) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 15 },
        children: [
          new TextRun({
            text: h.officeTitle.trim(),
            bold: true,
            size: sz(24),
            font: FONT,
          }),
        ],
      })
    );
  }
  if (h.officeAddress.trim()) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: h.officeAddress.trim(),
            size: sz(19),
            font: FONT,
          }),
        ],
      })
    );
  }
  if (h.programTitle.trim()) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 30, after: 50 },
        children: [
          new TextRun({
            text: h.programTitle.trim(),
            bold: true,
            size: sz(18),
            font: FONT,
          }),
        ],
      })
    );
  }
  if (h.sheetTitle.trim()) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 14, color: '000000' },
        },
        spacing: { before: 20, after: 110 },
        children: [
          new TextRun({
            text: h.sheetTitle.trim(),
            bold: true,
            size: sz(22),
            font: FONT,
          }),
        ],
      })
    );
  }

  // Estimate whether DOCX spans multiple pages so page-number footer only appears when multi-page
  const docxPaperHeightPx = Math.round(dims.heightMm * PX_PER_MM);
  const docxUsableHeightPx = Math.max(
    180,
    docxPaperHeightPx - Math.round((margins.top + margins.bottom) * PX_PER_MM)
  );
  const docxUsableWidthPx = Math.max(200, Math.round(CONTENT_W_MM * PX_PER_MM));
  let docxHeaderH = 12;
  if (h.govtTitle.trim()) docxHeaderH += 18 * scale;
  if (h.officeTitle.trim()) docxHeaderH += 26 * scale;
  if (h.officeAddress.trim()) docxHeaderH += 18 * scale;
  if (h.programTitle.trim()) {
    const pChars = Math.max(28, Math.floor((docxUsableWidthPx * 0.92) / (6.5 * scale)));
    docxHeaderH += Math.max(1, Math.ceil(h.programTitle.trim().length / pChars)) * 17 * scale + 6;
  }
  if (h.sheetTitle.trim()) docxHeaderH += 30 * scale;
  const docxTopExtrasPx = Math.round(docxHeaderH + 38 * scale);
  const docxTheadPx = Math.max(36, Math.round(46 * Math.max(0.85, scale)));
  const docxTbodyPx = Math.max(24, Math.round(32 * Math.max(0.82, scale)));
  const docxNameChars = Math.max(14, Math.floor((docxUsableWidthPx * namePct - 10) / (6.8 * scale)));
  const docxRowHeights = trainees.map((t) => {
    const lines = Math.max(1, Math.ceil((t.name || '').length / docxNameChars));
    return Math.max(docxTbodyPx, Math.round(lines * 15 * scale + 10));
  });
  const docxSlices = computeSheetPageSlices({
    usableHeightPx: docxUsableHeightPx,
    topExtrasH: docxTopExtrasPx,
    theadH: docxTheadPx,
    rowHeights: docxRowHeights,
    footerH: Math.round(115 * scale + 11 * PX_PER_MM),
  });
  const isDocxMultiPage = docxSlices.length > 1;

  const pageNumberFooterTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: totalContentTwip, type: WidthType.DXA },
    columnWidths: [leftInfoTwip, rightInfoTwip],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftInfoTwip, type: WidthType.DXA },
            margins: { top: 80, bottom: 0, left: 0, right: 0 },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: h.sheetTitle.trim() || 'প্রশিক্ষণার্থী হাজিরা সিট',
                    size: sz(16),
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: rightInfoTwip, type: WidthType.DXA },
            margins: { top: 80, bottom: 0, left: 0, right: 0 },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    children: ['পৃষ্ঠা ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    bold: true,
                    size: sz(16),
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            color: '000000',
            size: sz(19),
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(dims.portraitWidthMm),
              height: convertMillimetersToTwip(dims.portraitHeightMm),
              orientation:
                pageConfig.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(margins.top),
              right: convertMillimetersToTwip(margins.right),
              bottom: convertMillimetersToTwip(margins.bottom),
              left: convertMillimetersToTwip(margins.left),
              header: convertMillimetersToTwip(Math.max(5, Math.min(margins.top, 10))),
              footer: convertMillimetersToTwip(Math.max(5, Math.min(margins.bottom, 10))),
            },
          },
        },
        headers: {
          default: new Header({
            children: [...headerParagraphs, infoTable],
          }),
        },
        ...(isDocxMultiPage
          ? {
              footers: {
                default: new Footer({
                  children: [pageNumberFooterTable],
                }),
              },
            }
          : {}),
        children: [
          mainTable,
          new Paragraph({
            spacing: { before: 100, after: 20 },
            children: [
              new TextRun({
                text: `মোট প্রশিক্ষণার্থী: ${toBnDigits(trainees.length)} জন`,
                bold: true,
                size: sz(18),
                font: FONT,
              }),
              new TextRun({
                text: ' · প্রতিদিনের স্বাক্ষরের সংখ্যা গণনা করে দৈনিক উপস্থিতি হিসাব করতে হবে।',
                size: sz(17),
                font: FONT,
              }),
            ],
          }),
          signaturesTable,
          new Paragraph({
            spacing: { before: 100, after: 0 },
            children: [
              new TextRun({
                text: 'বিঃদ্রঃ উপস্থিতির স্বাক্ষর অবশ্যই হাতে কলমে করতে হবে। কোনো প্রশিক্ষণার্থী অনুপস্থিত থাকলে স্বাক্ষরের ঘরটি ফাঁকা রাখুন এবং মন্তব্য কলামে কারণ উল্লেখ করুন।',
                size: sz(16),
                font: FONT,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  await saveFile(fileName, blob);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a standalone, printable HTML (.html) file matching the configured
 * paper size, orientation, margins, font family, font size, and 100% usable-width table.
 */
export async function buildHtml(
  days: WeekDayInfo[],
  trainees: SignatureTrainee[],
  meta: SignatureSheetMeta,
  fileName: string,
  rawPageConfig?: WeeklySignaturePageConfig
): Promise<void> {
  const pageConfig = normalizePageConfig(rawPageConfig || meta.pageConfig);
  const dims = getPaperDimensionsMm(pageConfig.paperSize, pageConfig.orientation);
  const fontCssStack = getFontCssStack(pageConfig.fontFamily);
  const { margins } = pageConfig;
  const heading = meta.heading || DEFAULT_SHEET_HEADING;

  const scale = pageConfig.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;
  const px = (basePx: number) => `${(basePx * scale).toFixed(2)}px`;

  const isLandscape = pageConfig.orientation === 'landscape';
  const slWidthPct = isLandscape ? 5 : 6;
  const commentWidthPct = 13;
  const nameWidthPct = days.length <= 3 ? (isLandscape ? 31 : 33) : isLandscape ? 27 : 25;
  const dayColWidthPct =
    days.length > 0 ? (100 - slWidthPct - nameWidthPct - commentWidthPct) / days.length : 0;

  const theadHeightPx = Math.max(36, Math.round(46 * Math.max(0.85, scale)));
  const tbodyHeightPx = Math.max(24, Math.round(32 * Math.max(0.82, scale)));

  const paperHeightPx = Math.round(dims.heightMm * PX_PER_MM);
  const padTopPx = Math.round(margins.top * PX_PER_MM);
  const padBottomPx = Math.round(margins.bottom * PX_PER_MM);
  const usableHeightPx = Math.max(180, paperHeightPx - padTopPx - padBottomPx);
  const usableWidthPx = Math.max(
    200,
    Math.round((dims.widthMm - margins.left - margins.right) * PX_PER_MM)
  );

  let headerLinesH = 12;
  if (heading.govtTitle.trim()) headerLinesH += 18 * scale;
  if (heading.officeTitle.trim()) headerLinesH += 26 * scale;
  if (heading.officeAddress.trim()) headerLinesH += 18 * scale;
  if (heading.programTitle.trim()) {
    const progCharsPerLine = Math.max(28, Math.floor((usableWidthPx * 0.92) / (6.5 * scale)));
    const progLines = Math.max(1, Math.ceil(heading.programTitle.trim().length / progCharsPerLine));
    headerLinesH += progLines * 17 * scale + 6;
  }
  if (heading.sheetTitle.trim()) headerLinesH += 30 * scale;
  const metaRowH = 38 * scale;
  const topExtrasEstimatePx = Math.round(headerLinesH + metaRowH);

  const nameColWidthPx = usableWidthPx * (nameWidthPct / 100);
  const nameCharsPerLine = Math.max(14, Math.floor((nameColWidthPx - 10) / (6.8 * scale)));
  const rowHeights = trainees.map((t) => {
    const lines = Math.max(1, Math.ceil((t.name || '').length / nameCharsPerLine));
    return Math.max(tbodyHeightPx, Math.round(lines * 15 * scale + 10));
  });
  const footerEstimatePx = Math.round(115 * scale + 11 * PX_PER_MM);

  const slices = computeSheetPageSlices({
    usableHeightPx,
    topExtrasH: topExtrasEstimatePx,
    theadH: theadHeightPx,
    rowHeights,
    footerH: footerEstimatePx,
  });

  const docTitle = escapeHtml(
    `${heading.sheetTitle.trim() || 'প্রশিক্ষণার্থী হাজিরা সিট'} - ${meta.tradeName}`
  );

  const dayColsHtml = days
    .map(() => `<col style="width: ${dayColWidthPct}%;" />`)
    .join('\n          ');

  const dayHeadersHtml = days
    .map(
      (d) => `
          <th>
            <div>${escapeHtml(d.weekdayBn)}</div>
            <div class="sub-date">${escapeHtml(d.slashDateBn)}</div>
          </th>`
    )
    .join('');

  const headerAndMetaHtml = `
      <div class="sheet-header">
        ${heading.govtTitle.trim() ? `<p class="govt-title">${escapeHtml(heading.govtTitle.trim())}</p>` : ''}
        ${heading.officeTitle.trim() ? `<h2 class="office-title">${escapeHtml(heading.officeTitle.trim())}</h2>` : ''}
        ${heading.officeAddress.trim() ? `<p class="office-address">${escapeHtml(heading.officeAddress.trim())}</p>` : ''}
        ${heading.programTitle.trim() ? `<p class="program-title">${escapeHtml(heading.programTitle.trim())}</p>` : ''}
        ${
          heading.sheetTitle.trim()
            ? `<div class="sheet-title-wrap"><h3 class="sheet-title">${escapeHtml(heading.sheetTitle.trim())}</h3></div>`
            : ''
        }
      </div>

      <div class="meta-row">
        <div class="meta-item"><strong>প্রতিষ্ঠান:</strong> ${escapeHtml(meta.instituteName)}</div>
        <div class="meta-item right"><strong>ট্রেড:</strong> ${escapeHtml(meta.tradeName)}</div>
      </div>`;

  const footerHtml = `
      <div class="footer">
        <p class="total-line">
          <strong>মোট প্রশিক্ষণার্থী: ${escapeHtml(toBnDigits(trainees.length))} জন</strong>
          · প্রতিদিনের স্বাক্ষরের সংখ্যা গণনা করে দৈনিক উপস্থিতি হিসাব করতে হবে।
        </p>

        <div class="signatures">
          <div class="sig-box">প্রশিক্ষকের স্বাক্ষর</div>
          <div class="sig-box">ফিল্ড মনিটরিং অ্যাসিস্ট্যান্ট</div>
        </div>

        <p class="note-line">
          বিঃদ্রঃ উপস্থিতির স্বাক্ষর অবশ্যই হাতে কলমে করতে হবে। কোনো প্রশিক্ষণার্থী অনুপস্থিত থাকলে স্বাক্ষরের ঘরটি ফাঁকা রাখুন এবং মন্তব্য কলামে কারণ লিখুন।
        </p>
      </div>`;

  const renderTableHtml = (rowIndices: number[]) => {
    const bodyRowsHtml =
      trainees.length === 0
        ? `
        <tr style="height: ${theadHeightPx}px;">
          <td colspan="${days.length + 3}" class="empty-row">
            এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী পাওয়া যায়নি।
          </td>
        </tr>`
        : rowIndices
            .map((idx) => {
              const t = trainees[idx];
              if (!t) return '';
              return `
        <tr>
          <td class="sl-cell">${escapeHtml(toBnDigits(idx + 1))}</td>
          <td class="name-cell"><div class="name-wrap">${escapeHtml(t.name)}</div></td>
          ${days.map(() => '<td></td>').join('')}
          <td></td>
        </tr>`;
            })
            .join('');

    return `
      <table class="attendance-table">
        <colgroup>
          <col style="width: ${slWidthPct}%;" />
          <col style="width: ${nameWidthPct}%;" />
          ${dayColsHtml}
          <col style="width: ${commentWidthPct}%;" />
        </colgroup>
        <thead>
          <tr>
            <th>ক্রমিক</th>
            <th>প্রশিক্ষণার্থীর নাম</th>
            ${dayHeadersHtml}
            <th>মন্তব্য</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRowsHtml}
        </tbody>
      </table>`;
  };

  const pagesHtml = slices
    .map(
      (slice, pageIdx) => `
    <div class="sheet-page-item">
      <div class="sheet-paper">
        <div class="sheet-body">
          ${slice.includeHeader ? headerAndMetaHtml : ''}
          ${slice.includeTable ? renderTableHtml(slice.rowIndices) : ''}
          ${slice.includeFooter ? footerHtml : ''}
        </div>
        ${
          slices.length > 1
            ? `<div class="page-footer">
          <span>${escapeHtml(heading.sheetTitle.trim() || 'প্রশিক্ষণার্থী হাজিরা সিট')}</span>
          <span class="page-number">পৃষ্ঠা ${escapeHtml(toBnDigits(pageIdx + 1))} / ${escapeHtml(toBnDigits(slices.length))}</span>
        </div>`
            : ''
        }
      </div>
    </div>`
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" />
  <style>
    @page {
      size: ${dims.cssPageSize} ${pageConfig.orientation};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #000000;
      font-family: ${fontCssStack};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .toolbar {
      max-width: ${dims.widthMm}mm;
      margin: 14px auto 0;
      padding: 0 12px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .print-btn {
      min-height: 40px;
      padding: 8px 16px;
      border: 1px solid #059669;
      border-radius: 10px;
      background: #059669;
      color: #ffffff;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .sheet-wrapper {
      width: 100%;
      overflow-x: auto;
      padding: 14px 12px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    .sheet-page-item {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    .sheet-paper {
      width: ${dims.widthMm}mm;
      min-height: ${dims.heightMm}mm;
      margin: 0 auto;
      padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
      background: #ffffff;
      color: #000000;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .sheet-body {
      width: 100%;
    }

    .page-footer {
      width: 100%;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: ${px(10)};
      color: #000000;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .page-footer .page-number {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .sheet-header {
      text-align: center;
      padding-bottom: 12px;
    }

    .govt-title {
      margin: 0;
      font-size: ${px(11)};
      line-height: 1.35;
    }

    .office-title {
      margin: 2px 0 0;
      font-size: ${px(15.5)};
      font-weight: 700;
      line-height: 1.35;
    }

    .office-address {
      margin: 0;
      font-size: ${px(12)};
      font-weight: 500;
      line-height: 1.35;
    }

    .program-title {
      margin: 6px auto 0;
      max-width: 92%;
      font-size: ${px(11.5)};
      font-weight: 600;
      line-height: 1.4;
    }

    .sheet-title-wrap {
      margin-top: 6px;
      display: inline-block;
      border-bottom: 2px solid #000000;
      padding: 0 12px 4px;
    }

    .sheet-title {
      margin: 0;
      font-size: ${px(14)};
      font-weight: 700;
      line-height: 1.35;
    }

    .meta-row {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px 16px;
      font-size: ${px(12)};
      line-height: 1.4;
      margin-bottom: 12px;
    }

    .meta-item {
      border-bottom: 1px dotted #000000;
      padding-bottom: 3px;
    }

    .meta-item.right {
      margin-left: auto;
      text-align: right;
    }

    table.attendance-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      border: 1px solid #000000;
      font-size: ${px(11.5)};
      color: #000000;
    }

    table.attendance-table thead {
      display: table-header-group;
    }

    table.attendance-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    table.attendance-table thead tr {
      background: #e5e7eb;
      height: ${theadHeightPx}px;
    }

    table.attendance-table tbody tr {
      height: ${tbodyHeightPx}px;
    }

    table.attendance-table th,
    table.attendance-table td {
      border: 1px solid #000000;
      vertical-align: middle;
      line-height: 1.25;
      overflow: visible;
    }

    table.attendance-table th {
      padding: 4px 5px 7px;
      font-weight: 700;
      text-align: center;
    }

    table.attendance-table th:nth-child(2) {
      text-align: left;
    }

    table.attendance-table td {
      padding: 3px 5px 6px;
    }

    .sub-date {
      font-size: ${px(9.5)};
      font-weight: 400;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }

    .sl-cell {
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .name-cell {
      text-align: left;
    }

    .name-wrap {
      width: 100%;
      white-space: normal;
      word-break: break-word;
      line-height: 1.25;
    }

    .empty-row {
      text-align: center;
      color: #475569;
    }

    .footer {
      width: 100%;
      margin-top: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .total-line {
      margin: 0;
      font-size: ${px(11.5)};
      line-height: 1.45;
    }

    .signatures {
      margin: 11mm auto 0;
      max-width: 88%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 64px;
      font-size: ${px(11)};
      text-align: center;
    }

    .sig-box {
      padding-top: 6px;
      border-top: 1px solid #000000;
      line-height: 1.4;
    }

    .note-line {
      margin: 10px 0 0;
      font-size: ${px(10)};
      line-height: 1.45;
    }

    @media print {
      html, body {
        background: #ffffff !important;
      }

      .toolbar {
        display: none !important;
      }

      .sheet-wrapper {
        display: block !important;
        overflow: visible !important;
        padding: 0 !important;
      }

      .sheet-page-item {
        display: block !important;
        break-after: page;
        page-break-after: always;
      }

      .sheet-page-item:last-child {
        break-after: auto;
        page-break-after: auto;
      }

      .sheet-paper {
        display: block !important;
        width: 100% !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="print-btn" onclick="window.print()">প্রিন্ট করুন</button>
  </div>

  <div class="sheet-wrapper">
    ${pagesHtml}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  await saveFile(fileName, blob);
}
