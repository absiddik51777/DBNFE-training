import type {
  AttendanceRecord,
  Batch,
  DocumentPrintConfig,
  Institute,
  ReportFieldKey,
  ReportTemplate,
  ReportTemplateColumn,
  Trade,
  Trainee,
} from '../../../types';
import {
  DEFAULT_DOCUMENT_PRINT_CONFIG,
  normalizeDocumentPrintConfig,
} from '../../../lib/documentFrameService';
import { formatAgeYearsMonthsAtDate, safeFormatDate, toBn, toEnDigits } from '../../../lib/dateUtils';
import { clampReportLogoSize, sanitizeLogoUrl } from '../../../lib/reportLogoUtils';
import {
  getTraineePermanentAddressEn,
  getTraineePresentAddressEn,
} from '../../../lib/bengaliTransliteration';
import { getGenderLabelBn, getTraineeStatusLabelBn } from '../types';

export type ReportDataSource = 'trainees' | 'attendance-summary';

export type FieldCatalogGroup =
  | 'সাধারণ'
  | 'প্রশিক্ষণার্থী'
  | 'BRN / NID যাচাই'
  | 'হাজিরা'
  | 'কাস্টম';

export type LastFocusTarget =
  | {
      kind: 'heading';
      key:
        | 'govtTitle'
        | 'officeTitle'
        | 'officeAddress'
        | 'programTitle'
        | 'reportTitle'
        | 'memoNumber';
    }
  | {
      kind: 'column';
      index: number;
      key: 'label' | 'text';
    }
  | {
      kind: 'signature';
      index: number;
      key: 'label' | 'name' | 'designation';
    };

export interface ReportFieldOption {
  key: ReportFieldKey | 'custom' | 'blank';
  labelBn: string;
  group: FieldCatalogGroup;
  defaultColLabel: string;
  defaultWeight: number;
  defaultAlign: 'left' | 'center' | 'right';
  sources: ReportDataSource[];
  isNumeric?: boolean;
}

export const FIELD_CATALOG: readonly ReportFieldOption[] = [
  {
    key: 'serialNo',
    labelBn: 'ক্রমিক',
    group: 'সাধারণ',
    defaultColLabel: 'ক্রমিক',
    defaultWeight: 6,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
    isNumeric: true,
  },
  {
    key: 'nameBn',
    labelBn: 'নাম (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'প্রশিক্ষণার্থীর নাম',
    defaultWeight: 22,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'nameEn',
    labelBn: 'নাম (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'নাম (ইংরেজি)',
    defaultWeight: 18,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'fatherNameBn',
    labelBn: 'পিতার নাম (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'পিতার নাম',
    defaultWeight: 16,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'fatherNameEn',
    labelBn: 'পিতার নাম (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: "Father's Name",
    defaultWeight: 16,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'motherNameBn',
    labelBn: 'মাতার নাম (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'মাতার নাম',
    defaultWeight: 16,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'motherNameEn',
    labelBn: 'মাতার নাম (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: "Mother's Name",
    defaultWeight: 16,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'traineeId',
    labelBn: 'আইডি',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'আইডি',
    defaultWeight: 10,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'registrationNumber',
    labelBn: 'রেজিস্ট্রেশন নং',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'রেজি. নং',
    defaultWeight: 13,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'mobileNumber',
    labelBn: 'মোবাইল',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'মোবাইল',
    defaultWeight: 13,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'nidOrBirthRegistration',
    labelBn: 'NID / জন্মনিবন্ধন নম্বর',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'NID / জন্মনিবন্ধন',
    defaultWeight: 16,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'docType',
    labelBn: 'পরিচয়পত্রের ধরন (NID / BRN)',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'ধরন',
    defaultWeight: 12,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'brnStatus',
    labelBn: 'BRN/NID যাচাই অবস্থা (বাংলা)',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'BRN যাচাই',
    defaultWeight: 12,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'brnStatusEn',
    labelBn: 'BRN/NID যাচাই অবস্থা (ইংরেজি)',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'BRN Status',
    defaultWeight: 12,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'brnRemark',
    labelBn: 'BRN/NID যাচাই মন্তব্য',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'যাচাই মন্তব্য',
    defaultWeight: 18,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'brnVerifiedAt',
    labelBn: 'BRN/NID যাচাইয়ের তারিখ',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'যাচাইয়ের তারিখ',
    defaultWeight: 13,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'brnVerifiedBy',
    labelBn: 'BRN/NID যাচাইকারী',
    group: 'BRN / NID যাচাই',
    defaultColLabel: 'যাচাইকারী',
    defaultWeight: 14,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'gender',
    labelBn: 'লিঙ্গ (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'লিঙ্গ',
    defaultWeight: 8,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'genderEn',
    labelBn: 'লিঙ্গ (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'Gender',
    defaultWeight: 8,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'dateOfBirth',
    labelBn: 'জন্ম তারিখ',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'জন্ম তারিখ',
    defaultWeight: 11,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'age',
    labelBn: 'বয়স (ব্যাচ শুরুতে)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'বয়স',
    defaultWeight: 12,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'admissionDate',
    labelBn: 'ভর্তির তারিখ',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'ভর্তির তারিখ',
    defaultWeight: 11,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'address',
    labelBn: 'বর্তমান ঠিকানা (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'ঠিকানা',
    defaultWeight: 20,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'addressEn',
    labelBn: 'বর্তমান ঠিকানা (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'Address',
    defaultWeight: 20,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'permanentAddress',
    labelBn: 'স্থায়ী ঠিকানা (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'স্থায়ী ঠিকানা',
    defaultWeight: 20,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'permanentAddressEn',
    labelBn: 'স্থায়ী ঠিকানা (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'Permanent Address',
    defaultWeight: 20,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'instituteName',
    labelBn: 'প্রতিষ্ঠান',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'প্রতিষ্ঠান',
    defaultWeight: 16,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'tradeName',
    labelBn: 'ট্রেড (বাংলা)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'ট্রেড',
    defaultWeight: 15,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'tradeNameEn',
    labelBn: 'ট্রেড (ইংরেজি)',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'Trade',
    defaultWeight: 15,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'batchName',
    labelBn: 'ব্যাচ',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'ব্যাচ',
    defaultWeight: 13,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'status',
    labelBn: 'স্ট্যাটাস',
    group: 'প্রশিক্ষণার্থী',
    defaultColLabel: 'স্ট্যাটাস',
    defaultWeight: 9,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'presentDays',
    labelBn: 'উপস্থিত দিন',
    group: 'হাজিরা',
    defaultColLabel: 'উপস্থিত',
    defaultWeight: 11,
    defaultAlign: 'center',
    sources: ['attendance-summary', 'trainees'],
    isNumeric: true,
  },
  {
    key: 'absentDays',
    labelBn: 'অনুপস্থিত দিন',
    group: 'হাজিরা',
    defaultColLabel: 'অনুপস্থিত',
    defaultWeight: 11,
    defaultAlign: 'center',
    sources: ['attendance-summary', 'trainees'],
    isNumeric: true,
  },
  {
    key: 'leaveDays',
    labelBn: 'ছুটি',
    group: 'হাজিরা',
    defaultColLabel: 'ছুটি',
    defaultWeight: 9,
    defaultAlign: 'center',
    sources: ['attendance-summary', 'trainees'],
    isNumeric: true,
  },
  {
    key: 'totalClasses',
    labelBn: 'মোট কার্যদিবস',
    group: 'হাজিরা',
    defaultColLabel: 'মোট কার্যদিবস',
    defaultWeight: 11,
    defaultAlign: 'center',
    sources: ['attendance-summary', 'trainees'],
    isNumeric: true,
  },
  {
    key: 'attendanceRate',
    labelBn: 'উপস্থিতির হার %',
    group: 'হাজিরা',
    defaultColLabel: 'হার (%)',
    defaultWeight: 11,
    defaultAlign: 'center',
    sources: ['attendance-summary', 'trainees'],
    isNumeric: true,
  },
  {
    key: 'eligible',
    labelBn: 'সনদের যোগ্যতা',
    group: 'হাজিরা',
    defaultColLabel: 'যোগ্যতা',
    defaultWeight: 12,
    defaultAlign: 'center',
    sources: ['attendance-summary', 'trainees'],
  },
  {
    key: 'custom',
    labelBn: 'কাস্টম টেক্সট / সূত্র',
    group: 'কাস্টম',
    defaultColLabel: 'কাস্টম তথ্য',
    defaultWeight: 20,
    defaultAlign: 'left',
    sources: ['trainees', 'attendance-summary'],
  },
  {
    key: 'blank',
    labelBn: 'ফাঁকা (হাতে লেখার ঘর)',
    group: 'কাস্টম',
    defaultColLabel: 'মন্তব্য',
    defaultWeight: 15,
    defaultAlign: 'center',
    sources: ['trainees', 'attendance-summary'],
  },
];

export const FIELD_GROUPS_ORDER: readonly FieldCatalogGroup[] = [
  'সাধারণ',
  'প্রশিক্ষণার্থী',
  'BRN / NID যাচাই',
  'হাজিরা',
  'কাস্টম',
];

export const HEADER_QUICK_TOKENS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'institute', label: 'প্রতিষ্ঠান' },
  { key: 'trade', label: 'ট্রেড' },
  { key: 'batch', label: 'ব্যাচ' },
  { key: 'month', label: 'মাস' },
  { key: 'fiscalYear', label: 'অর্থবছর' },
  { key: 'date', label: 'আজকের তারিখ' },
  { key: 'total', label: 'মোট জন' },
];

export interface DataCodeDictionaryGroup {
  group: string;
  usage: string;
  items: ReadonlyArray<{ key: string; desc: string }>;
}

export const DATA_CODE_DICTIONARY: readonly DataCodeDictionaryGroup[] = [
  {
    group: 'সাধারণ কোড',
    usage: 'শিরোনাম · টেবিল · স্বাক্ষর — সর্বত্র',
    items: [
      { key: 'institute', desc: 'প্রতিষ্ঠানের নাম' },
      { key: 'trade', desc: 'ট্রেডের নাম' },
      { key: 'batch', desc: 'ব্যাচের নাম' },
      { key: 'month', desc: 'প্রতিবেদনের মাস' },
      { key: 'fiscalYear', desc: 'অর্থবছর' },
      { key: 'date', desc: 'আজকের তারিখ' },
      { key: 'total', desc: 'মোট প্রশিক্ষণার্থী (জন)' },
      { key: 'workDays', desc: 'মোট কার্যদিবস' },
      { key: 'pass', desc: 'সনদের ন্যূনতম উপস্থিতি (%)' },
      { key: 'brnVerifiedTotal', desc: 'মোট যাচাইকৃত (BRN/NID)' },
      { key: 'brnPendingTotal', desc: 'মোট অপেক্ষমাণ (BRN/NID)' },
      { key: 'brnInvalidTotal', desc: 'মোট অবৈধ (BRN/NID)' },
    ],
  },
  {
    group: 'স্বাক্ষর',
    usage: 'শুধু স্বাক্ষরের নামে',
    items: [{ key: 'trainer', desc: 'প্রশিক্ষকের নাম' }],
  },
  {
    group: 'প্রশিক্ষণার্থী',
    usage: 'টেবিলের ঘর / কাস্টম সূত্র',
    items: [
      { key: 'serial', desc: 'ক্রমিক নং' },
      { key: 'nameBn', desc: 'নাম (বাংলা)' },
      { key: 'nameEn', desc: 'নাম (ইংরেজি)' },
      { key: 'fatherNameBn', desc: 'পিতার নাম (বাংলা)' },
      { key: 'fatherNameEn', desc: 'পিতার নাম (ইংরেজি)' },
      { key: 'motherNameBn', desc: 'মাতার নাম (বাংলা)' },
      { key: 'motherNameEn', desc: 'মাতার নাম (ইংরেজি)' },
      { key: 'traineeId', desc: 'আইডি' },
      { key: 'registrationNumber', desc: 'রেজিস্ট্রেশন নং' },
      { key: 'mobileNumber', desc: 'মোবাইল' },
      { key: 'gender', desc: 'লিঙ্গ (বাংলা)' },
      { key: 'genderEn', desc: 'লিঙ্গ (ইংরেজি)' },
      { key: 'dob', desc: 'জন্ম তারিখ' },
      { key: 'age', desc: 'বয়স — যেমন: ২০ বছর ৮ মাস (ব্যাচ শুরুতে)' },
      { key: 'address', desc: 'বর্তমান ঠিকানা (বাংলা)' },
      { key: 'addressEn', desc: 'বর্তমান ঠিকানা (ইংরেজি)' },
      { key: 'permanentAddress', desc: 'স্থায়ী ঠিকানা (বাংলা)' },
      { key: 'permanentAddressEn', desc: 'স্থায়ী ঠিকানা (ইংরেজি)' },
      { key: 'tradeName', desc: 'ট্রেড (বাংলা)' },
      { key: 'tradeNameEn', desc: 'ট্রেড (ইংরেজি)' },
    ],
  },
  {
    group: 'BRN / NID যাচাই',
    usage: 'টেবিলের ঘর / কাস্টম সূত্র',
    items: [
      { key: 'nid', desc: 'NID / জন্মনিবন্ধন নম্বর' },
      { key: 'docType', desc: 'পরিচয়পত্রের ধরন (NID / BRN)' },
      { key: 'brnStatus', desc: 'BRN/NID যাচাই অবস্থা (বাংলা)' },
      { key: 'brnStatusEn', desc: 'BRN/NID যাচাই অবস্থা (ইংরেজি)' },
      { key: 'brnRemark', desc: 'BRN/NID যাচাই মন্তব্য' },
      { key: 'brnVerifiedAt', desc: 'BRN/NID যাচাইয়ের তারিখ' },
      { key: 'brnVerifiedBy', desc: 'BRN/NID যাচাইকারী' },
    ],
  },
  {
    group: 'হাজিরা',
    usage: 'টেবিলের ঘর / কাস্টম সূত্র',
    items: [
      { key: 'presentDays', desc: 'উপস্থিত দিন' },
      { key: 'absentDays', desc: 'অনুপস্থিত দিন' },
      { key: 'leaveDays', desc: 'ছুটির দিন' },
      { key: 'totalDays', desc: 'মোট দিন' },
      { key: 'pct', desc: 'উপস্থিতির হার (%)' },
      { key: 'eligible', desc: 'সনদের যোগ্যতা' },
    ],
  },
];

export function getFieldsForDataSource(source: ReportDataSource): ReportFieldOption[] {
  return FIELD_CATALOG.filter((f) => f.sources.includes(source));
}

export function getFieldOption(
  key: ReportFieldKey | 'custom' | 'blank'
): ReportFieldOption | undefined {
  return FIELD_CATALOG.find((f) => f.key === key);
}

export function formatByDigitMode(
  value: string | number,
  useBengaliDigits: boolean
): string {
  return useBengaliDigits ? toBn(value) : toEnDigits(value);
}

export interface TraineeAttendanceStats {
  totalClasses: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  attendanceRate: number | null;
}

export interface ReportRowEntity {
  trainee: Trainee;
  attendanceStats?: TraineeAttendanceStats;
}

export interface ReportContextTokens {
  institute: string;
  trade: string;
  batch: string;
  month: string;
  fiscalYear: string;
  date: string;
  total: string;
  workDays: string;
  pass: string;
  trainer: string;
  brnVerifiedTotal: string;
  brnPendingTotal: string;
  brnInvalidTotal: string;
}

const ATTENDANCE_TOKEN_PATTERN =
  /\{\{\s*(presentDays|absentDays|leaveDays|totalDays|totalClasses|pct|attendanceRate|eligible)\s*\}\}/;

export function columnsUseAttendanceData(columns: ReportTemplateColumn[]): boolean {
  return columns.some(
    (c) =>
      c.field === 'presentDays' ||
      c.field === 'absentDays' ||
      c.field === 'leaveDays' ||
      c.field === 'totalClasses' ||
      c.field === 'attendanceRate' ||
      c.field === 'eligible' ||
      (c.field === 'custom' && Boolean(c.text && ATTENDANCE_TOKEN_PATTERN.test(c.text)))
  );
}

export function buildRowTokenMap(params: {
  rowIndex: number;
  row: ReportRowEntity;
  institutesById: Map<string, Institute>;
  tradesById: Map<string, Trade>;
  batchesById: Map<string, Batch>;
  useBengaliDigits: boolean;
  passThreshold?: number;
}): Record<string, string> {
  const {
    rowIndex,
    row,
    institutesById,
    tradesById,
    batchesById,
    useBengaliDigits,
    passThreshold = 75,
  } = params;
  const t = row.trainee;
  const stats = row.attendanceStats;
  const fmt = (val: string | number) => formatByDigitMode(val, useBengaliDigits);

  const serialStr = fmt(rowIndex + 1);
  const regStr = t.registrationNumber || t.traineeId || '—';
  const nameBnStr = t.nameBn || t.nameEn || '—';
  const nameEnStr = t.nameEn || '—';
  const legacyFather = (t as unknown as { fatherName?: string }).fatherName;
  const legacyMother = (t as unknown as { motherName?: string }).motherName;
  const fatherStr = t.fatherNameBn || t.fatherNameEn || legacyFather || '—';
  const fatherEnStr = t.fatherNameEn || legacyFather || '—';
  const motherStr = t.motherNameBn || t.motherNameEn || legacyMother || '—';
  const motherEnStr = t.motherNameEn || legacyMother || '—';
  const dobStr = t.dateOfBirth ? fmt(t.dateOfBirth) : '—';
  const genderStr = getGenderLabelBn(t.gender);
  const genderEnStr = t.gender || '—';
  const nidStr = t.nidOrBirthRegistration ? fmt(t.nidOrBirthRegistration) : '—';
  const rawDocDigits = toEnDigits(t.nidOrBirthRegistration || '').replace(/\D/g, '');
  const docTypeStr =
    rawDocDigits.length === 17
      ? 'জন্ম নিবন্ধন (BRN)'
      : rawDocDigits.length === 10 || rawDocDigits.length === 13
      ? 'NID'
      : rawDocDigits.length > 0
      ? 'অন্যান্য'
      : '—';
  const brnStr =
    t.is_brn_verified === true
      ? 'যাচাইকৃত'
      : t.is_brn_verified === false
      ? 'অবৈধ'
      : 'অপেক্ষমাণ';
  const brnEnStr =
    t.is_brn_verified === true
      ? 'Verified'
      : t.is_brn_verified === false
      ? 'Invalid'
      : 'Pending';
  const brnRemarkStr = t.brn_remark?.trim() || '—';
  const brnVerifiedAtStr = t.brn_verified_at
    ? fmt(safeFormatDate(t.brn_verified_at, 'dd/MM/yyyy'))
    : '—';
  const brnVerifiedByStr = t.brn_verified_by?.trim() || '—';
  const mobileStr = t.mobileNumber ? fmt(t.mobileNumber) : '—';
  const addressStr = t.presentAddress || t.permanentAddress || t.address || '—';
  const addressEnStr = getTraineePresentAddressEn(t) || '—';
  const permAddressStr = t.permanentAddress || t.address || '—';
  const permAddressEnStr = getTraineePermanentAddressEn(t) || '—';
  const instStr = institutesById.get(t.instituteId)?.name || '—';
  const tradeObj = tradesById.get(t.tradeId);
  const tradeStr = tradeObj?.name || '—';
  const tradeEnStr = tradeObj?.nameEn || tradeObj?.name || '—';
  const batchObj = batchesById.get(t.batchId);
  const batchStr = batchObj?.name || '—';
  const ageStr =
    formatAgeYearsMonthsAtDate(
      t.dateOfBirth,
      batchObj?.startDate ?? t.trainingStartDate,
      useBengaliDigits
    ) ?? '—';
  const admissionStr = t.admissionDate
    ? fmt(safeFormatDate(t.admissionDate, 'dd/MM/yyyy'))
    : '—';
  const statusStr = getTraineeStatusLabelBn(t.status);

  const totalClassesNum = stats?.totalClasses ?? 0;
  const presentNum = stats?.presentDays ?? 0;
  const absentNum = stats?.absentDays ?? 0;
  const leaveNum = stats?.leaveDays ?? 0;
  const rateNum = stats?.attendanceRate ?? null;

  const totalStr = fmt(totalClassesNum);
  const presentStr = fmt(presentNum);
  const absentStr = fmt(absentNum);
  const leaveStr = fmt(leaveNum);
  const pctNumericOnly = rateNum !== null ? fmt(rateNum) : '০';
  const eligibleStr =
    rateNum === null
      ? '—'
      : rateNum >= passThreshold
      ? 'যোগ্য'
      : 'অযোগ্য';

  return {
    serialNo: serialStr,
    serial: serialStr,
    traineeId: t.traineeId || '—',
    registrationNumber: regStr,
    nameBn: nameBnStr,
    nameEn: nameEnStr,
    fatherNameBn: fatherStr,
    fatherNameEn: fatherEnStr,
    motherNameBn: motherStr,
    motherNameEn: motherEnStr,
    dateOfBirth: dobStr,
    dob: dobStr,
    age: ageStr,
    gender: genderStr,
    genderEn: genderEnStr,
    nidOrBirthRegistration: nidStr,
    nid: nidStr,
    docType: docTypeStr,
    brnStatus: brnStr,
    brnStatusEn: brnEnStr,
    brnRemark: brnRemarkStr,
    brnVerifiedAt: brnVerifiedAtStr,
    brnVerifiedBy: brnVerifiedByStr,
    mobileNumber: mobileStr,
    address: addressStr,
    addressEn: addressEnStr,
    permanentAddress: permAddressStr,
    permanentAddressEn: permAddressEnStr,
    instituteName: instStr,
    tradeName: tradeStr,
    tradeNameEn: tradeEnStr,
    batchName: batchStr,
    admissionDate: admissionStr,
    status: statusStr,
    totalClasses: totalStr,
    totalDays: totalStr,
    presentDays: presentStr,
    absentDays: absentStr,
    leaveDays: leaveStr,
    pct: pctNumericOnly,
    attendanceRate: rateNum !== null ? `${pctNumericOnly}%` : '—',
    eligible: eligibleStr,
  };
}

export function resolveTokenTemplate(
  templateStr: string,
  docContext?: ReportContextTokens,
  rowTokens?: Record<string, string>
): string {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (rowTokens && key in rowTokens) {
      return rowTokens[key];
    }
    if (docContext && key in docContext) {
      return docContext[key as keyof ReportContextTokens];
    }
    return match;
  });
}

export function resolveReportCellValue(params: {
  rowIndex: number;
  row: ReportRowEntity;
  col: ReportTemplateColumn;
  institutesById: Map<string, Institute>;
  tradesById: Map<string, Trade>;
  batchesById: Map<string, Batch>;
  useBengaliDigits: boolean;
  passThreshold?: number;
  docContext?: ReportContextTokens;
}): string {
  const { col, docContext } = params;
  if (col.field === 'blank') return '';

  const tokens = buildRowTokenMap(params);
  if (col.field === 'custom') {
    return resolveTokenTemplate(col.text ?? '', docContext, tokens);
  }
  return tokens[col.field] ?? '';
}

export function computeMonthlyAttendanceStatsMap(
  trainees: Trainee[],
  attendance: AttendanceRecord[],
  monthPrefix: string
): Map<string, TraineeAttendanceStats> {
  const traineeIds = new Set(trainees.map((t) => t.id));
  const perTrainee = new Map<string, { present: number; absent: number; leave: number }>();

  for (const rec of attendance) {
    if (!rec.date || !rec.date.startsWith(monthPrefix)) continue;
    if (!traineeIds.has(rec.traineeId)) continue;
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

  const out = new Map<string, TraineeAttendanceStats>();
  for (const t of trainees) {
    const counts = perTrainee.get(t.id) || { present: 0, absent: 0, leave: 0 };
    const total = counts.present + counts.absent + counts.leave;
    out.set(t.id, {
      totalClasses: total,
      presentDays: counts.present,
      absentDays: counts.absent,
      leaveDays: counts.leave,
      attendanceRate: total > 0 ? Math.round((counts.present / total) * 100) : null,
    });
  }
  return out;
}

export const DEFAULT_OFFICIAL_HEADING = {
  govtTitle: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  officeTitle: 'জেলা উপানুষ্ঠানিক শিক্ষা ব্যুরো',
  officeAddress: 'কালেক্টরেট ভবন, ময়মনসিংহ',
  programTitle:
    'কার্যকর সাক্ষরতা ও ব্যবহারিক কর্মদক্ষতা প্রশিক্ষণ প্রাক বৃত্তিমূলক পর্যায়',
  reportTitle: 'প্রশিক্ষণ সমাপ্তির সনদ প্রদানের প্রস্তাব',
  showMemo: true,
  memoNumber: '৩৮.০১.৬১০০.০০১.{{batch}}/২৬',
  showMetaLine: true,
};

export interface BuilderPresetMeta {
  presetId: string;
  label: string;
  description: string;
  build: (userId: string) => ReportTemplate;
}

const makePage = (
  orientation: 'portrait' | 'landscape'
): DocumentPrintConfig => ({
  ...DEFAULT_DOCUMENT_PRINT_CONFIG,
  margins: { ...DEFAULT_DOCUMENT_PRINT_CONFIG.margins },
  orientation,
  fontFamily: 'Nikosh',
  fontSizePt: 11.5,
  repeatHeaderOnAllPages: true,
  showPageNumbers: true,
  showSignatures: true,
  showGeneratedDate: true,
});

export const BUILDER_PRESETS: readonly BuilderPresetMeta[] = [
  {
    presetId: 'proposal',
    label: 'সনদের প্রস্তাব (সরকারি)',
    description: 'নাম ও পিতার নাম, উপস্থিতি হার, যোগ্যতা ও সরকারি স্মারকসহ প্রস্তাব',
    build: (userId) => ({
      id: '',
      name: 'সনদের প্রস্তাব (সরকারি)',
      dataSource: 'attendance-summary',
      heading: {
        ...DEFAULT_OFFICIAL_HEADING,
        reportTitle: 'প্রশিক্ষণ সমাপ্তির সনদ প্রদানের প্রস্তাব',
        showMemo: true,
        memoNumber: '৩৮.০১.৬১০০.০০১.{{batch}}/২৬',
        showMetaLine: true,
      },
      columns: [
        { id: 'c1', label: 'ক্রমিক', field: 'serialNo', widthWeight: 6, align: 'center' },
        {
          id: 'c2',
          label: 'নাম ও পিতার নাম',
          field: 'custom',
          text: '{{nameBn}}\nপিতা: {{fatherNameBn}}',
          widthWeight: 32,
          align: 'left',
        },
        {
          id: 'c3',
          label: 'রেজি. নং',
          field: 'registrationNumber',
          widthWeight: 13,
          align: 'center',
        },
        {
          id: 'c4',
          label: 'উপস্থিতি',
          field: 'custom',
          text: '{{presentDays}}/{{totalDays}} ({{pct}}%)',
          widthWeight: 14,
          align: 'center',
        },
        { id: 'c5', label: 'যোগ্যতা', field: 'eligible', widthWeight: 13, align: 'center' },
        { id: 'c6', label: 'মন্তব্য', field: 'blank', widthWeight: 22, align: 'left' },
      ],
      signatures: [
        { id: 's1', label: 'প্রস্তুতকারী', name: '', designation: '' },
        { id: 's2', label: 'যাচাইকারী', name: '', designation: '' },
        { id: 's3', label: 'কোর্স পরিচালক', name: '', designation: '' },
      ],
      page: makePage('portrait'),
      useBengaliDigits: true,
      createdBy: userId,
      createdAt: Date.now(),
    }),
  },
  {
    presetId: 'monthly',
    label: 'মাসিক হাজিরা সারসংক্ষেপ',
    description: 'উপস্থিত, অনুপস্থিত, ছুটি ও শতকরা হার প্রতিবেদন',
    build: (userId) => ({
      id: '',
      name: 'মাসিক হাজিরা সারসংক্ষেপ',
      dataSource: 'attendance-summary',
      heading: {
        ...DEFAULT_OFFICIAL_HEADING,
        reportTitle: '{{month}} মাসের হাজিরা প্রতিবেদন',
        showMemo: false,
      },
      columns: [
        { id: 'c1', label: 'ক্রমিক', field: 'serialNo', widthWeight: 7, align: 'center' },
        {
          id: 'c2',
          label: 'প্রশিক্ষণার্থীর নাম',
          field: 'nameBn',
          widthWeight: 30,
          align: 'left',
        },
        { id: 'c3', label: 'উপস্থিত', field: 'presentDays', widthWeight: 12, align: 'center' },
        { id: 'c4', label: 'অনুপস্থিত', field: 'absentDays', widthWeight: 12, align: 'center' },
        { id: 'c5', label: 'ছুটি', field: 'leaveDays', widthWeight: 10, align: 'center' },
        { id: 'c6', label: 'হার (%)', field: 'attendanceRate', widthWeight: 12, align: 'center' },
        { id: 'c7', label: 'মন্তব্য', field: 'blank', widthWeight: 17, align: 'left' },
      ],
      signatures: [
        { id: 's1', label: 'প্রশিক্ষক', name: '{{trainer}}', designation: 'স্কিল ট্রেইনার' },
        { id: 's2', label: 'প্রতিষ্ঠান প্রধান', name: '', designation: '' },
      ],
      page: makePage('portrait'),
      useBengaliDigits: true,
      createdBy: userId,
      createdAt: Date.now(),
    }),
  },
  {
    presetId: 'list',
    label: 'প্রশিক্ষণার্থী তালিকা',
    description: 'ব্যাচ ভিত্তিক পূর্ণাঙ্গ প্রশিক্ষণার্থী পরিচিতি তালিকা',
    build: (userId) => ({
      id: '',
      name: 'প্রশিক্ষণার্থী তালিকা',
      dataSource: 'trainees',
      heading: {
        ...DEFAULT_OFFICIAL_HEADING,
        reportTitle: '{{batch}} — প্রশিক্ষণার্থীদের তালিকা',
        showMemo: false,
      },
      columns: [
        { id: 'c1', label: 'ক্রমিক', field: 'serialNo', widthWeight: 5, align: 'center' },
        { id: 'c2', label: 'নাম', field: 'nameBn', widthWeight: 18, align: 'left' },
        { id: 'c3', label: 'পিতার নাম', field: 'fatherNameBn', widthWeight: 16, align: 'left' },
        { id: 'c4', label: 'মাতার নাম', field: 'motherNameBn', widthWeight: 16, align: 'left' },
        { id: 'c5', label: 'জন্ম তারিখ', field: 'dateOfBirth', widthWeight: 11, align: 'center' },
        { id: 'c6', label: 'মোবাইল', field: 'mobileNumber', widthWeight: 14, align: 'left' },
        { id: 'c7', label: 'ঠিকানা', field: 'address', widthWeight: 20, align: 'left' },
      ],
      signatures: [
        { id: 's1', label: 'প্রশিক্ষক', name: '', designation: '' },
        { id: 's2', label: 'প্রতিষ্ঠান প্রধান', name: '', designation: '' },
        { id: 's3', label: 'কোর্স পরিচালক', name: '', designation: '' },
      ],
      page: makePage('landscape'),
      useBengaliDigits: true,
      createdBy: userId,
      createdAt: Date.now(),
    }),
  },
];

export function createTemplateFromPreset(
  presetId: string,
  userId: string
): ReportTemplate {
  const found =
    BUILDER_PRESETS.find((p) => p.presetId === presetId) || BUILDER_PRESETS[0];
  return found.build(userId);
}

/**
 * Ensures the outgoing ReportTemplate strictly adheres to firebase-blueprint.json
 * and firestore.rules key allowlists and size bounds before writing to Firestore.
 */
export function sanitizeReportTemplateForSave(
  template: ReportTemplate,
  opts: { id: string; createdBy: string; createdAt: number; updatedAt?: number }
): ReportTemplate {
  const safeName = (template.name || 'কাস্টম রিপোর্ট টেমপ্লেট').trim().slice(0, 160);
  const safeDataSource: ReportDataSource =
    template.dataSource === 'attendance-summary' ? 'attendance-summary' : 'trainees';

  const safeColumns: ReportTemplateColumn[] = (template.columns || [])
    .slice(0, 20)
    .map((c, idx) => ({
      id: (c.id || `col_${idx + 1}`).slice(0, 64),
      label: (c.label || `কলাম ${idx + 1}`).slice(0, 120),
      field: c.field || 'blank',
      ...(c.field === 'custom' ? { text: (c.text || '').slice(0, 200) } : {}),
      widthWeight: Math.min(100, Math.max(1, Math.round(Number(c.widthWeight) || 10))),
      align: c.align === 'center' || c.align === 'right' ? c.align : 'left',
    }));

  if (safeColumns.length === 0) {
    safeColumns.push({
      id: 'col_1',
      label: 'ক্রমিক',
      field: 'serialNo',
      widthWeight: 10,
      align: 'center',
    });
  }

  const safeSignatures = (template.signatures || []).slice(0, 4).map((s, idx) => ({
    id: (s.id || `sig_${idx + 1}`).slice(0, 64),
    label: (s.label || `স্বাক্ষর ${idx + 1}`).slice(0, 120),
    name: (s.name || '').slice(0, 120),
    designation: (s.designation || '').slice(0, 150),
  }));

  const FIRESTORE_ALLOWED_TEMPLATE_FONTS: ReadonlyArray<DocumentPrintConfig['fontFamily']> = [
    'Nikosh',
    'Hind Siliguri',
    'Noto Sans Bengali',
    'SolaimanLipi',
    'Kalpurush',
    'system-ui',
  ];
  const normalizedPage = normalizeDocumentPrintConfig(template.page, 'portrait');
  const safeTemplateFont = FIRESTORE_ALLOWED_TEMPLATE_FONTS.includes(normalizedPage.fontFamily)
    ? normalizedPage.fontFamily
    : 'Nikosh';
  const strictPage: DocumentPrintConfig = {
    paperSize: normalizedPage.paperSize,
    orientation: normalizedPage.orientation,
    margins: {
      top: normalizedPage.margins.top,
      right: normalizedPage.margins.right,
      bottom: normalizedPage.margins.bottom,
      left: normalizedPage.margins.left,
    },
    fontFamily: safeTemplateFont,
    fontSizePt: normalizedPage.fontSizePt,
    repeatHeaderOnAllPages: Boolean(normalizedPage.repeatHeaderOnAllPages),
    showPageNumbers: Boolean(normalizedPage.showPageNumbers),
    showSignatures: Boolean(normalizedPage.showSignatures),
    showGeneratedDate: Boolean(normalizedPage.showGeneratedDate),
  };

  const safeLeftLogo = sanitizeLogoUrl(template.heading?.leftLogoUrl);
  const safeRightLogo = sanitizeLogoUrl(template.heading?.rightLogoUrl);
  const hasAnyLogo = Boolean(safeLeftLogo || safeRightLogo);

  return {
    id: opts.id.slice(0, 128),
    name: safeName,
    dataSource: safeDataSource,
    heading: {
      govtTitle: (template.heading?.govtTitle || '').slice(0, 200),
      officeTitle: (template.heading?.officeTitle || '').slice(0, 200),
      officeAddress: (template.heading?.officeAddress || '').slice(0, 250),
      programTitle: (template.heading?.programTitle || '').slice(0, 400),
      reportTitle: (template.heading?.reportTitle || '').slice(0, 250),
      showMemo: Boolean(template.heading?.showMemo),
      memoNumber: (template.heading?.memoNumber || '').slice(0, 200),
      showMetaLine: Boolean(template.heading?.showMetaLine),
      ...(safeLeftLogo ? { leftLogoUrl: safeLeftLogo } : {}),
      ...(safeRightLogo ? { rightLogoUrl: safeRightLogo } : {}),
      ...(hasAnyLogo ? { logoSizePx: clampReportLogoSize(template.heading?.logoSizePx) } : {}),
    },
    columns: safeColumns,
    signatures: safeSignatures,
    page: strictPage,
    useBengaliDigits: Boolean(template.useBengaliDigits),
    createdBy: opts.createdBy.slice(0, 128),
    createdAt: opts.createdAt,
    ...(opts.updatedAt !== undefined ? { updatedAt: opts.updatedAt } : {}),
  };
}
