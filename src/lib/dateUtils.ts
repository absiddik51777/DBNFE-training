import { format } from 'date-fns';

/**
 * Safely format any date value (timestamp number, Firestore Timestamp, ISO string, Date object)
 * without ever throwing a runtime RangeError / Invalid time value exception.
 */
export function safeFormatDate(val: any, formatPattern = 'dd MMM yyyy'): string {
  if (!val) return '-';
  try {
    // 1. Firestore Timestamp with toDate()
    if (typeof val?.toDate === 'function') {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return format(d, formatPattern);
      }
    }
    // 2. Firestore Timestamp-like object { seconds: 1234567890 }
    if (typeof val === 'object' && typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      if (!isNaN(d.getTime())) {
        return format(d, formatPattern);
      }
    }
    // 3. Millisecond timestamp number
    if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return format(d, formatPattern);
      }
    }
    // 4. ISO string or date string
    if (typeof val === 'string') {
      // Check if it's already in requested format
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return format(d, formatPattern);
      }
    }
  } catch (e) {
    // Graceful fallback
  }
  return typeof val === 'string' ? val : '-';
}

/**
 * Convert any date value into a standard millisecond timestamp number.
 */
export function toTimestampNumber(val: any): number {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (typeof val === 'object' && typeof val.seconds === 'number') return val.seconds * 1000;
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return Date.now();
}

/**
 * Converts Western digits to Bengali numerals.
 */
export function toBn(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => bnDigits[parseInt(d, 10)]);
}

/**
 * Converts Bengali numerals (০-৯) to Western ASCII digits (0-9).
 */
export function toEnDigits(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[০-৯]/g, d => {
    const idx = bnDigits.indexOf(d);
    return idx !== -1 ? String(idx) : d;
  });
}

/**
 * Format date string (YYYY-MM-DD) into Bengali readable string (e.g. ১৫ অক্টোবর ২০২৬, বৃহস্পতিবার)
 */
export function formatBengaliDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
      const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      return `${toBn(day)} ${BN_MONTHS[month]} ${toBn(year)}, ${BN_DAYS[d.getDay()]}`;
    }
  } catch (e) {}
  return dateStr;
}
