export const DHAKA_TIMEZONE = 'Asia/Dhaka';

export interface AuditDateEntry {
  id: string;
  createdAt?: unknown;
  timestamp?: unknown;
  time?: unknown;
  date?: unknown;
  hasPendingWrites?: boolean;
}

export interface AuditDayGroup<T extends AuditDateEntry = AuditDateEntry> {
  key: string;
  label: string;
  items: T[];
}

const bnDigitFormatter = new Intl.NumberFormat('bn-BD');

const dhakaDayPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DHAKA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dhakaBnDatePartsFormatter = new Intl.DateTimeFormat('bn-BD', {
  timeZone: DHAKA_TIMEZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dhakaTime12hFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DHAKA_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export function toBnDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatCountBn(count: number): string {
  try {
    return `${bnDigitFormatter.format(count)} টি`;
  } catch {
    return `${toBnDigits(count)} টি`;
  }
}

/**
 * Parses any supported date representation into a valid Date, or null.
 * Cleanly rejects corrupted plain objects (e.g. `{}` or `{ _methodName: 'serverTimestamp' }`).
 */
export function parseAuditDateValue(value: unknown): Date | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return null;
      const d = new Date(num);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const parsedMs = Date.parse(trimmed);
    if (Number.isNaN(parsedMs)) return null;
    return new Date(parsedMs);
  }

  if (typeof value === 'object') {
    const obj = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: unknown;
      nanoseconds?: unknown;
      _seconds?: unknown;
      _nanoseconds?: unknown;
    };

    if (typeof obj.toDate === 'function') {
      try {
        const d = obj.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }

    if (typeof obj.toMillis === 'function') {
      try {
        const ms = obj.toMillis();
        if (typeof ms === 'number' && Number.isFinite(ms)) {
          const d = new Date(ms);
          return Number.isNaN(d.getTime()) ? null : d;
        }
        return null;
      } catch {
        return null;
      }
    }

    if (typeof obj.seconds === 'number' && Number.isFinite(obj.seconds)) {
      const nanos = typeof obj.nanoseconds === 'number' && Number.isFinite(obj.nanoseconds)
        ? obj.nanoseconds
        : 0;
      const d = new Date(obj.seconds * 1000 + Math.floor(nanos / 1_000_000));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof obj._seconds === 'number' && Number.isFinite(obj._seconds)) {
      const nanos = typeof obj._nanoseconds === 'number' && Number.isFinite(obj._nanoseconds)
        ? obj._nanoseconds
        : 0;
      const d = new Date(obj._seconds * 1000 + Math.floor(nanos / 1_000_000));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

/**
 * Checks whether `entry.createdAt` is already stored as a valid Firestore Timestamp
 * (with `toDate()` or `{ seconds }`), rather than missing, null, number, ISO string, or corrupted object.
 */
export function hasValidFirestoreCreatedAt(entry: AuditDateEntry | null | undefined): boolean {
  if (!entry || entry.createdAt === null || entry.createdAt === undefined) return false;
  if (typeof entry.createdAt !== 'object') return false;
  const obj = entry.createdAt as { toDate?: unknown; seconds?: unknown; _seconds?: unknown };
  return (
    typeof obj.toDate === 'function' ||
    typeof obj.seconds === 'number' ||
    typeof obj._seconds === 'number'
  );
}

/**
 * Reads an audit log entry's time in priority order: `createdAt`, `timestamp`, `time`, `date`.
 * Accepts Firestore Timestamp (`toDate()`), `{ seconds, nanoseconds }`, ms number, or ISO string.
 * When `createdAt` is `null` because `serverTimestamp()` is pending (`hasPendingWrites`), uses current time.
 */
export function getLogDate(
  entry: AuditDateEntry | null | undefined,
  options: { hasPendingWrites?: boolean; now?: Date } = {}
): Date | null {
  if (!entry) return null;

  const isPending = Boolean(options.hasPendingWrites ?? entry.hasPendingWrites);
  if (entry.createdAt === null && isPending) {
    return options.now ? new Date(options.now.getTime()) : new Date();
  }

  const candidates = [entry.createdAt, entry.timestamp, entry.time, entry.date];
  for (const candidate of candidates) {
    const parsed = parseAuditDateValue(candidate);
    if (parsed) return parsed;
  }

  if (isPending) {
    return options.now ? new Date(options.now.getTime()) : new Date();
  }

  return null;
}

/**
 * Stable comparator: newest first by `getLogDate`, with `id` tiebreaker.
 * Entries with `null` date always sort to the very bottom.
 */
export function compareAuditLogsDesc(a: AuditDateEntry, b: AuditDateEntry): number {
  const da = getLogDate(a);
  const db = getLogDate(b);

  if (da && db) {
    const diff = db.getTime() - da.getTime();
    if (diff !== 0) return diff;
  } else if (da && !db) {
    return -1;
  } else if (!da && db) {
    return 1;
  }

  const idA = String(a.id || '');
  const idB = String(b.id || '');
  if (idA < idB) return -1;
  if (idA > idB) return 1;
  return 0;
}

export function sortAuditLogsNewestFirst<T extends AuditDateEntry>(items: readonly T[]): T[] {
  return [...items].sort(compareAuditLogsDesc);
}

export function mergeAndSortAuditLogs<T extends AuditDateEntry>(
  existing: readonly T[],
  incoming: readonly T[]
): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return sortAuditLogsNewestFirst(Array.from(byId.values()));
}

/**
 * Computes YYYY-MM-DD day key in Asia/Dhaka using Intl.DateTimeFormat.
 */
export function getDhakaDayKey(date: Date): string {
  const parts = dhakaDayPartsFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value || '0000';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

export function shiftDhakaDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  // 06:00 UTC corresponds to 12:00 PM Asia/Dhaka, avoiding midnight boundary issues
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays, 6, 0, 0));
  return getDhakaDayKey(shifted);
}

export function getDhakaDayBoundsMs(dayKey: string): { startMs: number; endMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const startMs = Date.parse(`${dayKey}T00:00:00.000+06:00`);
  const endMs = Date.parse(`${dayKey}T23:59:59.999+06:00`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return { startMs, endMs };
}

export function formatDhakaDayHeading(
  dayKey: string,
  sampleDate: Date | null,
  now: Date = new Date()
): string {
  if (!sampleDate || dayKey === 'unknown') return 'অন্যান্য';

  const todayKey = getDhakaDayKey(now);
  const yesterdayKey = shiftDhakaDayKey(todayKey, -1);

  if (dayKey === todayKey) return 'আজ';
  if (dayKey === yesterdayKey) return 'গতকাল';

  try {
    const parts = dhakaBnDatePartsFormatter.formatToParts(sampleDate);
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const year = parts.find((p) => p.type === 'year')?.value;
    if (day && month && year) {
      return `${day} ${month} ${year}`;
    }
    return dhakaBnDatePartsFormatter.format(sampleDate).replace(/,/g, '').trim();
  } catch {
    return dayKey;
  }
}

/**
 * Formats time as 12-hour "04:31 PM" in Asia/Dhaka.
 */
export function formatDhakaTime12h(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  try {
    return dhakaTime12hFormatter.format(date);
  } catch {
    return '';
  }
}

/**
 * Sorts logs newest-first and groups them by Asia/Dhaka day key.
 * "অন্যান্য" is strictly reserved for entries where `getLogDate` returns null, and is always last.
 */
export function groupAuditLogsByDhakaDay<T extends AuditDateEntry>(
  logs: readonly T[],
  now: Date = new Date()
): AuditDayGroup<T>[] {
  const sorted = sortAuditLogsNewestFirst(logs);
  const groups: AuditDayGroup<T>[] = [];
  const byKey = new Map<string, AuditDayGroup<T>>();
  let unknownGroup: AuditDayGroup<T> | null = null;

  for (const log of sorted) {
    const logDate = getLogDate(log, { now });
    if (!logDate) {
      if (!unknownGroup) {
        unknownGroup = {
          key: 'unknown',
          label: 'অন্যান্য',
          items: [],
        };
      }
      unknownGroup.items.push(log);
      continue;
    }

    const key = getDhakaDayKey(logDate);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: formatDhakaDayHeading(key, logDate, now),
        items: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(log);
  }

  if (unknownGroup && unknownGroup.items.length > 0) {
    groups.push(unknownGroup);
  }

  return groups;
}
