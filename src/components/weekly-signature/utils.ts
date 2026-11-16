import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
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

/**
 * Weekend / closed days in Bangladesh BNFE centers (5 = Friday, 6 = Saturday)
 */
export const OFF_DAYS: readonly number[] = [5, 6];

export interface SignatureTrainee {
  id: string;
  name: string;
}

export interface SignatureSheetMeta {
  instituteName: string;
  tradeName: string;
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

/**
 * Renders an off-screen 794px (A4 @ 96dpi) white clone of SheetPaper, captures via
 * html2canvas (scale 2 after fonts are ready), and places onto ONE A4 portrait page.
 */
export async function buildPdf(paperNode: HTMLElement, fileName: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Document unavailable');
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.padding = '36px';
  host.style.boxSizing = 'border-box';
  host.style.backgroundColor = '#ffffff';
  host.style.color = '#000000';
  host.style.zIndex = '-9999';
  host.style.pointerEvents = 'none';

  const cloned = paperNode.cloneNode(true) as HTMLElement;
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

  cloned.querySelectorAll('.weekly-sheet-paper-scroll').forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.overflow = 'visible';
    htmlEl.style.maxHeight = 'none';
  });

  cloned.querySelectorAll('table').forEach((tbl) => {
    const htmlTbl = tbl as HTMLElement;
    htmlTbl.style.width = '100%';
    htmlTbl.style.minWidth = '0';
    htmlTbl.style.tableLayout = 'fixed';
  });

  cloned.querySelectorAll('thead tr').forEach((tr) => {
    (tr as HTMLElement).style.height = '45px';
  });

  cloned.querySelectorAll('tbody tr').forEach((tr) => {
    (tr as HTMLElement).style.height = '31px';
  });

  host.appendChild(cloned);
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageW = pdf.internal.pageSize.getWidth(); // 210mm
    const pageH = pdf.internal.pageSize.getHeight(); // 297mm

    let renderW = pageW;
    let renderH = (canvas.height / canvas.width) * renderW;
    let offsetX = 0;
    let offsetY = 0;

    if (renderH > pageH) {
      renderH = pageH;
      renderW = (canvas.width / canvas.height) * renderH;
      offsetX = (pageW - renderW) / 2;
    }

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');

    const blob = pdf.output('blob');
    await saveFile(fileName, blob);
  } finally {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}

/**
 * Generates an editable A4 portrait Word (.docx) file matching the exact sheet structure.
 */
export async function buildDocx(
  days: WeekDayInfo[],
  trainees: SignatureTrainee[],
  meta: SignatureSheetMeta,
  fileName: string
): Promise<void> {
  const FONT = 'Nikosh';
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2; // 190mm

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

  // Column width budget across 190mm
  const slMm = 11;
  const commentMm = 28;
  const nameMm = days.length <= 3 ? 58 : 44;
  const remainingForDays = CONTENT_W_MM - slMm - nameMm - commentMm;
  const perDayMm = days.length > 0 ? Math.floor(remainingForDays / days.length) : 0;
  const adjustedNameMm = CONTENT_W_MM - slMm - commentMm - perDayMm * days.length;

  const colWidthsTwip = [
    convertMillimetersToTwip(slMm),
    convertMillimetersToTwip(adjustedNameMm),
    ...days.map(() => convertMillimetersToTwip(perDayMm)),
    convertMillimetersToTwip(commentMm),
  ];

  // Header Row (12mm)
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    height: {
      value: convertMillimetersToTwip(12),
      rule: HeightRule.EXACT,
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
              new TextRun({ text: 'ক্রমিক', bold: true, size: 19, font: FONT }),
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
                size: 19,
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
                  new TextRun({ text: d.weekdayBn, bold: true, size: 18, font: FONT }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: d.slashDateBn, size: 15, font: FONT }),
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
              new TextRun({ text: 'মন্তব্য', bold: true, size: 19, font: FONT }),
            ],
          }),
        ],
      }),
    ],
  });

  // 20 Trainee Rows (8.2mm exact)
  const traineeRows = trainees.map(
    (t, rowIdx) =>
      new TableRow({
        cantSplit: true,
        height: {
          value: convertMillimetersToTwip(8.2),
          rule: HeightRule.EXACT,
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
                    size: 18,
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
                children: [new TextRun({ text: t.name, size: 18, font: FONT })],
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
                    children: [new TextRun({ text: '', size: 18, font: FONT })],
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
                children: [new TextRun({ text: '', size: 18, font: FONT })],
              }),
            ],
          }),
        ],
      })
  );

  // Info line table (প্রতিষ্ঠান left, ট্রেড right)
  const halfInfoTwip = convertMillimetersToTwip(CONTENT_W_MM / 2);
  const infoTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: convertMillimetersToTwip(CONTENT_W_MM), type: WidthType.DXA },
    columnWidths: [halfInfoTwip, halfInfoTwip],
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
            width: { size: halfInfoTwip, type: WidthType.DXA },
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
                  new TextRun({ text: 'প্রতিষ্ঠান: ', bold: true, size: 19, font: FONT }),
                  new TextRun({ text: meta.instituteName, size: 19, font: FONT }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: halfInfoTwip, type: WidthType.DXA },
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
                  new TextRun({ text: 'ট্রেড: ', bold: true, size: 19, font: FONT }),
                  new TextRun({ text: meta.tradeName, size: 19, font: FONT }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Main attendance table
  const mainTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: convertMillimetersToTwip(CONTENT_W_MM), type: WidthType.DXA },
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

  // 3 Signature Blocks
  const sigColTwip = convertMillimetersToTwip(Math.floor(CONTENT_W_MM / 3));
  const sigRuleBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const signaturesTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: convertMillimetersToTwip(CONTENT_W_MM), type: WidthType.DXA },
    columnWidths: [sigColTwip, sigColTwip, sigColTwip],
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
          'প্রতিষ্ঠান প্রধান',
        ].map(
          (label) =>
            new TableCell({
              width: { size: sigColTwip, type: WidthType.DXA },
              margins: {
                top: 40,
                left: convertMillimetersToTwip(6),
                right: convertMillimetersToTwip(6),
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
                  children: [new TextRun({ text: label, size: 18, font: FONT })],
                }),
              ],
            })
        ),
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
            size: 19,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(PAGE_W_MM),
              height: convertMillimetersToTwip(PAGE_H_MM),
            },
            margin: {
              top: convertMillimetersToTwip(MARGIN_MM),
              right: convertMillimetersToTwip(MARGIN_MM),
              bottom: convertMillimetersToTwip(MARGIN_MM),
              left: convertMillimetersToTwip(MARGIN_MM),
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 20 },
            children: [
              new TextRun({
                text: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
                size: 18,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: 'উপানুষ্ঠানিক শিক্ষা ব্যুরো',
                bold: true,
                size: 26,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 14, color: '000000' },
            },
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({
                text: 'প্রশিক্ষণার্থী হাজিরা সিট',
                bold: true,
                size: 22,
                font: FONT,
              }),
            ],
          }),
          infoTable,
          mainTable,
          new Paragraph({
            spacing: { before: 100, after: 20 },
            children: [
              new TextRun({
                text: `মোট প্রশিক্ষণার্থী: ${toBnDigits(trainees.length)} জন`,
                bold: true,
                size: 18,
                font: FONT,
              }),
              new TextRun({
                text: ' · প্রতিদিনের স্বাক্ষরের সংখ্যা গণনা করে দৈনিক উপস্থিতি হিসাব করতে হবে।',
                size: 17,
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
                size: 16,
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
