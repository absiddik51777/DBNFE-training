import assert from 'node:assert/strict';
import {
  formatCountBn,
  formatDhakaTime12h,
  getLogDate,
  groupAuditLogsByDhakaDay,
  mergeAndSortAuditLogs,
  sortAuditLogsNewestFirst,
  type AuditDateEntry,
} from '../src/lib/auditDate';
import { resolveDateRangeBounds } from '../src/lib/auditQueryBuilder';

// Fixed reference "now": 2026-11-14 16:40:00 Asia/Dhaka (10:40:00 UTC)
const NOW = new Date('2026-11-14T10:40:00.000Z');

// 1. Mixed date representations:
// - Firestore Timestamp mock (`toDate()`) -> Today 16:31 Dhaka
// - Plain `{ seconds, nanoseconds }` -> Today 09:05 Dhaka
// - Pending serverTimestamp (`createdAt: null`, `hasPendingWrites: true`) -> NOW (Today 16:40 Dhaka)
// - Broken serialized serverTimestamp `{ _methodName: 'serverTimestamp' }` with fallback `timestamp` ms -> Yesterday 22:15 Dhaka
// - ISO string -> 2026-11-12 16:31 Dhaka ("১২ নভেম্বর ২০২৬")
// - Legacy `time` field -> 2026-11-12 08:00 Dhaka
// - Legacy `date` field -> 2026-11-11 12:00 Dhaka
// - Entry with no date at all -> null ("অন্যান্য")

const mixedEntries: AuditDateEntry[] = [
  { id: 'log_no_date', createdAt: null },
  {
    id: 'log_iso_older',
    createdAt: '2026-11-12T10:31:00.000Z', // 16:31 Dhaka = 04:31 PM
  },
  {
    id: 'log_broken_created_fallback_ts',
    createdAt: { _methodName: 'serverTimestamp' },
    timestamp: Date.parse('2026-11-13T16:15:00.000Z'), // Yesterday 22:15 Dhaka
  },
  {
    id: 'log_firestore_ts_today',
    createdAt: {
      toDate: () => new Date('2026-11-14T10:31:00.000Z'), // Today 16:31 Dhaka = 04:31 PM
    },
  },
  {
    id: 'log_seconds_today',
    createdAt: {
      seconds: Math.floor(Date.parse('2026-11-14T03:05:00.000Z') / 1000),
      nanoseconds: 0,
    },
  },
  {
    id: 'log_pending_write',
    createdAt: null,
    hasPendingWrites: true,
  },
  {
    id: 'log_legacy_time',
    time: '2026-11-12T02:00:00.000Z', // 2026-11-12 08:00 Dhaka
  },
  {
    id: 'log_legacy_date',
    date: Date.parse('2026-11-11T06:00:00.000Z'), // 2026-11-11 12:00 Dhaka
  },
];

// Verify pending write resolution uses current time
const pendingDate = getLogDate(
  mixedEntries.find((e) => e.id === 'log_pending_write'),
  { now: NOW }
);
assert.equal(pendingDate?.getTime(), NOW.getTime());

// Verify true null returns null
assert.equal(getLogDate(mixedEntries.find((e) => e.id === 'log_no_date')), null);

// Verify 12h Dhaka time format
const nov12Date = getLogDate(mixedEntries.find((e) => e.id === 'log_iso_older'));
assert.equal(formatDhakaTime12h(nov12Date), '04:31 PM');

// Materialize pending write timestamp as current time to test deterministic sorting/grouping
const hydratedForSort = mixedEntries.map((entry) =>
  entry.hasPendingWrites
    ? { ...entry, createdAt: NOW.getTime(), hasPendingWrites: false }
    : entry
);

const sorted = sortAuditLogsNewestFirst(hydratedForSort);
assert.deepEqual(
  sorted.map((e) => e.id),
  [
    'log_pending_write',
    'log_firestore_ts_today',
    'log_seconds_today',
    'log_broken_created_fallback_ts',
    'log_iso_older',
    'log_legacy_time',
    'log_legacy_date',
    'log_no_date',
  ]
);

// Verify stable tiebreaker by doc id when timestamps match
const tied = sortAuditLogsNewestFirst([
  { id: 'b_doc', createdAt: 1700000000000 },
  { id: 'a_doc', createdAt: 1700000000000 },
]);
assert.deepEqual(
  tied.map((e) => e.id),
  ['a_doc', 'b_doc']
);

// Verify mergeAndSortAuditLogs deduplicates and keeps newest-first
const merged = mergeAndSortAuditLogs(
  [
    { id: 'old', createdAt: 1000 },
    { id: 'mid', createdAt: 2000 },
  ],
  [
    { id: 'new', createdAt: 3000 },
    { id: 'mid', createdAt: 2000 },
    { id: 'none', createdAt: null },
  ]
);
assert.deepEqual(
  merged.map((e) => e.id),
  ['new', 'mid', 'old', 'none']
);

// Verify grouping in Asia/Dhaka with "আজ", "গতকাল", "১২ নভেম্বর ২০২৬", count, and "অন্যান্য" last
const groups = groupAuditLogsByDhakaDay(hydratedForSort, NOW);
assert.deepEqual(
  groups.map((g) => ({
    label: g.label,
    count: formatCountBn(g.items.length),
    ids: g.items.map((i) => i.id),
  })),
  [
    {
      label: 'আজ',
      count: '৩ টি',
      ids: ['log_pending_write', 'log_firestore_ts_today', 'log_seconds_today'],
    },
    {
      label: 'গতকাল',
      count: '১ টি',
      ids: ['log_broken_created_fallback_ts'],
    },
    {
      label: '১২ নভেম্বর ২০২৬',
      count: '২ টি',
      ids: ['log_iso_older', 'log_legacy_time'],
    },
    {
      label: '১১ নভেম্বর ২০২৬',
      count: '১ টি',
      ids: ['log_legacy_date'],
    },
    {
      label: 'অন্যান্য',
      count: '১ টি',
      ids: ['log_no_date'],
    },
  ]
);

// Verify Asia/Dhaka date range boundaries across UTC midnight:
// 2026-11-14 01:00 Dhaka = 2026-11-13 19:00 UTC
const dhakaAfterMidnightUtcBefore = new Date('2026-11-13T19:00:00.000Z');
const todayBounds = resolveDateRangeBounds('today', '', '', dhakaAfterMidnightUtcBefore);
assert.equal(todayBounds?.startMs, Date.parse('2026-11-14T00:00:00.000+06:00'));
assert.equal(todayBounds?.endMs, Date.parse('2026-11-14T23:59:59.999+06:00'));

const yesterdayBounds = resolveDateRangeBounds('yesterday', '', '', dhakaAfterMidnightUtcBefore);
assert.equal(yesterdayBounds?.startMs, Date.parse('2026-11-13T00:00:00.000+06:00'));
assert.equal(yesterdayBounds?.endMs, Date.parse('2026-11-13T23:59:59.999+06:00'));
