export type ReportSectionId =
  | 'monthly-attendance'
  | 'batch-trainees'
  | 'trade-attendance-sheet'
  | 'custom-builder';

export const REPORT_SECTION_IDS: ReportSectionId[] = [
  'monthly-attendance',
  'batch-trainees',
  'trade-attendance-sheet',
  'custom-builder',
];

export type ReportGroupId = 'reports' | 'forms';

export interface ReportSectionMeta {
  id: ReportSectionId;
  group: ReportGroupId;
  title: string;
  subtitle: string;
}

export const REPORT_SECTIONS: ReportSectionMeta[] = [
  {
    id: 'monthly-attendance',
    group: 'reports',
    title: 'মাসিক হাজিরা রিপোর্ট',
    subtitle: 'মাস ও ব্যাচ অনুযায়ী উপস্থিতি, অনুপস্থিতি ও উপস্থিতির হার',
  },
  {
    id: 'batch-trainees',
    group: 'reports',
    title: 'প্রশিক্ষণার্থীদের তালিকা ব্যাচ ভিত্তিক',
    subtitle: 'নির্বাচিত ব্যাচের প্রশিক্ষণার্থীদের পূর্ণাঙ্গ পরিচিতি তালিকা',
  },
  {
    id: 'trade-attendance-sheet',
    group: 'forms',
    title: 'মাসিক হাজিরা সিট (ট্রেড ভিত্তক)',
    subtitle: 'ট্রেড অনুযায়ী প্রিন্ট ও স্বাক্ষরযোগ্য মাসিক হাজিরা ফর্ম',
  },
  {
    id: 'custom-builder',
    group: 'forms',
    title: 'কাস্টম রিপোর্ট বিল্ডার',
    subtitle: 'সরকারি প্রস্তাব, কলাম ও স্বাক্ষর নিজের মতো সাজিয়ে টেমপ্লেট সেভ করুন',
  },
];

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

export interface ReportsToast {
  type: 'success' | 'error';
  message: string;
}

export function getGenderLabelBn(gender?: string): string {
  switch (gender) {
    case 'Male':
      return 'পুরুষ';
    case 'Female':
      return 'নারী';
    case 'Other':
      return 'অন্যান্য';
    default:
      return gender || '—';
  }
}

export function getTraineeStatusLabelBn(status?: string): string {
  switch (status) {
    case 'Active':
    case undefined:
    case '':
      return 'সক্রিয়';
    case 'Completed':
      return 'সম্পন্ন';
    case 'Dropped Out':
      return 'ঝরে পড়া';
    case 'Archived':
      return 'সংরক্ষিত';
    default:
      return status;
  }
}
