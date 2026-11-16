import type { AttendanceStatus, Trainee } from '../../types';

export type ExtendedAttendanceStatus = AttendanceStatus | 'Unmarked';

export type AttendanceFilterTab =
  | 'all'
  | 'present'
  | 'absent'
  | 'leave'
  | 'unmarked'
  | 'low';

export type AttendanceSortOption = 'default' | 'name' | 'unmarked_first';

export interface TraineeAttendanceItem {
  id: string; // trainee doc id
  trainee: Trainee;
  status: ExtendedAttendanceStatus;
  initialStatus: ExtendedAttendanceStatus;
  leaveReason?: string;
  initialLeaveReason?: string;
  isSavedInDb: boolean;
  dbRecordId?: string;
}

export interface DayDotItem {
  date: string;
  dayNumber: number;
  status: ExtendedAttendanceStatus;
}

export interface SevenDaySummary {
  dots: DayDotItem[];
  presentCount: number;
  markedCount: number;
  ratePercent: number | null;
  isLow: boolean;
}

export const LEAVE_REASONS = [
  'অসুস্থতা',
  'পারিবারিক',
  'জরুরি কাজ',
  'অন্যান্য',
] as const;

export const EDIT_UNLOCK_REASONS = [
  'ভুল এন্ট্রি সংশোধন',
  'দেরিতে পাওয়া তথ্য',
  'প্রশাসনিক অনুরোধ',
  'অন্যান্য',
] as const;

export const BN_MONTHS = [
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
];

export const BN_WEEKDAYS = [
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
];

export function triggerHaptic(duration = 10): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(duration);
    }
  } catch {
    // Ignore vibration errors on unsupported browsers
  }
}

export function addDaysIso(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getDisplayInitial(trainee: Trainee): string {
  const raw = (trainee.nameBn || trainee.nameEn || '?').trim();
  return raw.charAt(0) || '?';
}

export function getDisplayName(trainee: Trainee): string {
  return (trainee.nameBn || trainee.nameEn || 'নামহীন শিক্ষার্থী').trim();
}
