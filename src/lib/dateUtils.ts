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
