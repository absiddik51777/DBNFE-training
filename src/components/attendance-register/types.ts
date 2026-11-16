import type { Trainee } from '../../types';
import { toBn } from '../../lib/dateUtils';

export type AttendanceCode = 'P' | 'A' | 'L' | '';

export type RateFilterValue = 'all' | 'high_90' | 'low_75' | 'no_data';

export interface RegisterDay {
  day: number;
  dateStr: string;
  dayOfWeek: number;
  dayOfWeekBn: string;
  isFriday: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface StudentRegisterRow {
  trainee: Trainee;
  present: number;
  absent: number;
  leave: number;
  totalRecorded: number;
  rate: number | null;
}

export type GetAttendanceFn = (
  batchId: string,
  year: number,
  month: number,
  studentId: string,
  day: number
) => AttendanceCode;

export const MONTH_NAMES_BN = [
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

export const WEEKDAY_NAMES_BN = [
  'রবি',
  'সোম',
  'মঙ্গল',
  'বুধ',
  'বৃহঃ',
  'শুক্র',
  'শনি',
] as const;

export function getRoleLabelBn(role?: string): string {
  switch (role) {
    case 'Course Director':
      return 'কোর্স পরিচালক';
    case 'FMA':
      return 'FMA';
    case 'Trainer':
      return 'প্রশিক্ষক';
    default:
      return role || 'ব্যবহারকারী';
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildRegisterHtml(params: {
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
}): string {
  const {
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
  } = params;

  const monthName = MONTH_NAMES_BN[month - 1] || '';
  const totalPresentAll = rows.reduce((s, r) => s + r.present, 0);
  const totalAbsentAll = rows.reduce((s, r) => s + r.absent, 0);

  const dayHeaders = daysList
    .map(
      (d) =>
        `<th class="${d.isFriday ? 'fri' : ''}">${toBn(d.day)}<br><small>${escapeHtml(
          d.dayOfWeekBn
        )}</small></th>`
    )
    .join('');

  const bodyRows = rows
    .map((row, idx) => {
      const name = escapeHtml(row.trainee.nameBn || row.trainee.nameEn || '-');
      const code = escapeHtml(row.trainee.traineeId || row.trainee.id);
      const dayCells = daysList
        .map((d) => {
          const val = getAttendance(batchId, year, month, row.trainee.id, d.day);
          const cls = d.isFriday
            ? 'fri'
            : val === 'P'
              ? 'p'
              : val === 'A'
                ? 'a'
                : val === 'L'
                  ? 'l'
                  : 'empty';
          return `<td class="${cls}">${val || '-'}</td>`;
        })
        .join('');
      const rateText = row.rate !== null ? `${toBn(row.rate)}%` : '-';
      return `<tr>
        <td>${toBn(idx + 1)}</td>
        <td class="name-col"><strong>${name}</strong><div class="sub">${code}</div></td>
        ${dayCells}
        <td class="p">${toBn(row.present)}</td>
        <td class="a">${toBn(row.absent)}</td>
        <td class="l">${toBn(row.leave)}</td>
        <td><strong>${rateText}</strong></td>
      </tr>`;
    })
    .join('');

  const presentFooterCells = daysList
    .map((d) => {
      const c = dailyTotals[d.day]?.present || 0;
      return `<td class="${d.isFriday ? 'fri' : ''}">${c > 0 ? toBn(c) : '-'}</td>`;
    })
    .join('');

  const absentFooterCells = daysList
    .map((d) => {
      const c = dailyTotals[d.day]?.absent || 0;
      return `<td class="${d.isFriday ? 'fri' : ''}">${c > 0 ? toBn(c) : '-'}</td>`;
    })
    .join('');

  return `<!doctype html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>মাসিক হাজিরা রেজিস্টার - ${escapeHtml(monthName)} ${toBn(year)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Nikosh', 'Hind Siliguri', Arial, sans-serif; margin: 16px; color: #0f172a; background: #fff; font-size: 12px; }
    h1 { margin: 0 0 4px; font-size: 18px; }
    .meta { margin: 0 0 12px; color: #475569; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: center; white-space: nowrap; }
    th { background: #f1f5f9; font-weight: 600; }
    td.name-col { text-align: left; min-width: 140px; white-space: normal; }
    .sub { font-size: 10px; color: #64748b; }
    .fri { background: #fff1f2; color: #be123c; }
    .p { color: #0f8f74; font-weight: 600; }
    .a { color: #d6334a; font-weight: 600; }
    .l { color: #b7791f; font-weight: 600; }
    .empty { color: #94a3b8; }
    tfoot tr.tot-p td { background: #ecfdf5; color: #065f46; font-weight: 600; }
    tfoot tr.tot-a td { background: #fff1f2; color: #9f1239; font-weight: 600; }
    @media print { @page { size: A4 landscape; margin: 8mm; } body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(monthName)} ${toBn(year)} — মাসিক হাজিরা রেজিস্টার</h1>
  <p class="meta"><strong>${escapeHtml(tradeName)}</strong> · ${escapeHtml(
    instituteName
  )} · ব্যাচ: ${escapeHtml(batchName)} · P = উপস্থিত, A = অনুপস্থিত, L = ছুটি</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>নাম ও আইডি</th>
        ${dayHeaders}
        <th>উপস্থিত</th>
        <th>অনুপস্থিত</th>
        <th>ছুটি</th>
        <th>হার</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
    <tfoot>
      <tr class="tot-p">
        <td colspan="2" style="text-align:right">দৈনিক মোট উপস্থিত</td>
        ${presentFooterCells}
        <td>${toBn(totalPresentAll)}</td>
        <td colspan="3"></td>
      </tr>
      <tr class="tot-a">
        <td colspan="2" style="text-align:right">দৈনিক মোট অনুপস্থিত</td>
        ${absentFooterCells}
        <td></td>
        <td>${toBn(totalAbsentAll)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}
