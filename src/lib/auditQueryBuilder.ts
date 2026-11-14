import {
  limit,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
  DocumentData,
} from 'firebase/firestore';
import type { ActivityLog } from '../types';
import {
  getDhakaDayBoundsMs,
  getDhakaDayKey,
  getLogDate,
  shiftDhakaDayKey,
} from './auditDate';

export type AuditFilterType = 'update' | 'delete' | 'undo' | 'restore';
export type AuditStatusFilter = 'active' | 'settled';
export type AuditDateRangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface AuditSheetFilters {
  types: AuditFilterType[];
  statuses: AuditStatusFilter[];
  range: AuditDateRangePreset | null;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  userId: string;
  withLocation: boolean;
}

export interface AuditFiltersState extends AuditSheetFilters {
  module: string; // 'ALL' or canonical module key
  search: string; // client-side search on title and targetLabel
}

export const DEFAULT_SHEET_FILTERS: AuditSheetFilters = {
  types: [],
  statuses: [],
  range: null,
  from: '',
  to: '',
  userId: '',
  withLocation: false,
};

export const DEFAULT_AUDIT_FILTERS: AuditFiltersState = {
  module: 'ALL',
  search: '',
  ...DEFAULT_SHEET_FILTERS,
};

export const AUDIT_MODULE_CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'ALL', label: 'সব' },
  { id: 'trainees', label: 'প্রশিক্ষণার্থী' },
  { id: 'batches', label: 'ব্যাচ' },
  { id: 'institutes', label: 'প্রতিষ্ঠান' },
  { id: 'attendance', label: 'হাজিরা' },
  { id: 'settings', label: 'সেটিংস' },
  { id: 'security', label: 'নিরাপত্তা' },
];

export const AUDIT_TYPE_CHIPS: ReadonlyArray<{ id: AuditFilterType; label: string }> = [
  { id: 'update', label: 'আপডেট' },
  { id: 'delete', label: 'ডিলিট' },
  { id: 'undo', label: 'পরিবর্তন ফেরত' },
  { id: 'restore', label: 'পুনরুদ্ধার' },
];

export const AUDIT_STATUS_CHIPS: ReadonlyArray<{ id: AuditStatusFilter; label: string }> = [
  { id: 'active', label: 'সক্রিয়' },
  { id: 'settled', label: 'নিষ্পন্ন' },
];

export const AUDIT_RANGE_CHIPS: ReadonlyArray<{ id: AuditDateRangePreset; label: string }> = [
  { id: 'today', label: 'আজ' },
  { id: 'yesterday', label: 'গতকাল' },
  { id: '7d', label: '৭ দিন' },
  { id: '30d', label: '৩০ দিন' },
  { id: 'custom', label: 'কাস্টম' },
];

export const AUDIT_PAGE_SIZE = 20;

const VALID_TYPES = new Set<AuditFilterType>(['update', 'delete', 'undo', 'restore']);
const VALID_STATUSES = new Set<AuditStatusFilter>(['active', 'settled']);
const VALID_RANGES = new Set<AuditDateRangePreset>([
  'today',
  'yesterday',
  '7d',
  '30d',
  'custom',
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAuditModuleKey(raw?: string): string {
  const m = (raw || '').trim().toLowerCase();
  if (!m) return 'settings';
  if (m === 'results') return 'exams';
  if (m === 'trainee_brn_verification') return 'trainees';
  if (m === 'auth' || m === 'users' || m === 'roles') return 'security';
  if (m === 'system') return 'settings';
  return m;
}

export function expandAuditFilterTypes(types: AuditFilterType[]): string[] {
  const out = new Set<string>();
  for (const t of types) {
    if (t === 'delete') {
      out.add('delete');
      out.add('bulk_delete');
    } else if (VALID_TYPES.has(t)) {
      out.add(t);
    }
  }
  return Array.from(out);
}

export function validateCustomDateRange(
  range: AuditDateRangePreset | null,
  from: string,
  to: string
): string | null {
  if (range !== 'custom') return null;
  if (from && to && from > to) {
    return 'শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না।';
  }
  return null;
}

export interface DateRangeBounds {
  startMs: number | null;
  endMs: number | null;
}

function parseLocalDateStart(ymd: string): number | null {
  if (!DATE_PATTERN.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

function parseLocalDateEnd(ymd: string): number | null {
  if (!DATE_PATTERN.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

export function resolveDateRangeBounds(
  range: AuditDateRangePreset | null,
  from: string = '',
  to: string = '',
  now: Date = new Date()
): DateRangeBounds | null {
  if (!range) return null;

  const todayKey = getDhakaDayKey(now);
  const todayBounds = getDhakaDayBoundsMs(todayKey);
  if (!todayBounds) return null;

  if (range === 'today') {
    return todayBounds;
  }

  if (range === 'yesterday') {
    const yesterdayKey = shiftDhakaDayKey(todayKey, -1);
    return getDhakaDayBoundsMs(yesterdayKey);
  }

  if (range === '7d') {
    const startKey = shiftDhakaDayKey(todayKey, -6);
    const startBounds = getDhakaDayBoundsMs(startKey);
    return {
      startMs: startBounds ? startBounds.startMs : todayBounds.startMs,
      endMs: todayBounds.endMs,
    };
  }

  if (range === '30d') {
    const startKey = shiftDhakaDayKey(todayKey, -29);
    const startBounds = getDhakaDayBoundsMs(startKey);
    return {
      startMs: startBounds ? startBounds.startMs : todayBounds.startMs,
      endMs: todayBounds.endMs,
    };
  }

  if (range === 'custom') {
    if (validateCustomDateRange(range, from, to)) return null;
    const startBounds = from ? getDhakaDayBoundsMs(from) : null;
    const endBounds = to ? getDhakaDayBoundsMs(to) : null;
    const startMs = startBounds ? startBounds.startMs : null;
    const endMs = endBounds ? endBounds.endMs : null;
    if (startMs === null && endMs === null) return null;
    return { startMs, endMs };
  }

  return null;
}

export interface AuditQueryPlan {
  moduleEq: string | null;
  userIdEq: string | null;
  locationStatusEq: 'granted' | null;
  actionIn: string[] | null;
  dateBounds: DateRangeBounds | null;
  clientFilterActions: string[] | null;
  clientSearch: string;
  fallbackReason: 'action_in_with_date_range' | null;
  hasClientOnlyFilters: boolean;
}

/**
 * Pure, framework-agnostic Firestore query planner for `activityLogs`.
 * Deliberately omits `orderBy('createdAt')` and Firestore-level `createdAt` ranges
 * because Firestore silently drops legacy documents missing `createdAt`.
 * Instead, equality `where(...)` filters run in Firestore (when compatible) and
 * date range / sorting / search run deterministically on the client via `getLogDate`.
 */
export function buildAuditQueryPlan(
  filters: AuditFiltersState,
  now: Date = new Date()
): AuditQueryPlan {
  const moduleEq =
    filters.module && filters.module !== 'ALL'
      ? normalizeAuditModuleKey(filters.module)
      : null;
  const userIdEq = filters.userId.trim() ? filters.userId.trim() : null;
  const locationStatusEq: 'granted' | null = filters.withLocation ? 'granted' : null;
  const expandedActions = expandAuditFilterTypes(filters.types);
  const dateBounds = resolveDateRangeBounds(filters.range, filters.from, filters.to, now);
  const clientSearch = filters.search.trim().toLowerCase();

  const hasActions = expandedActions.length > 0;
  const actionIn = hasActions ? expandedActions : null;

  return {
    moduleEq,
    userIdEq,
    locationStatusEq,
    actionIn,
    dateBounds,
    clientFilterActions: null,
    clientSearch,
    fallbackReason: null,
    hasClientOnlyFilters: Boolean(clientSearch || dateBounds || filters.statuses.length > 0),
  };
}

export interface BuildConstraintsOptions {
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  forCount?: boolean;
  /** Safe unfiltered fetch used when a multi-field composite index is missing */
  baseOrderOnly?: boolean;
}

/**
 * Converts an `AuditQueryPlan` into Firestore `QueryConstraint[]`.
 * Note: intentionally avoids `orderBy('createdAt')` so documents without `createdAt`
 * are never silently excluded by Firestore.
 */
export function buildAuditFirestoreConstraints(
  plan: AuditQueryPlan,
  options: BuildConstraintsOptions = {}
): QueryConstraint[] {
  const {
    pageSize,
    cursor = null,
    forCount = false,
    baseOrderOnly = false,
  } = options;

  const constraints: QueryConstraint[] = [];

  if (!baseOrderOnly) {
    if (plan.moduleEq) {
      constraints.push(where('module', '==', plan.moduleEq));
    }
    if (plan.userIdEq) {
      constraints.push(where('userId', '==', plan.userIdEq));
    }
    if (plan.locationStatusEq) {
      constraints.push(where('location.status', '==', plan.locationStatusEq));
    }
    if (plan.actionIn && plan.actionIn.length > 0) {
      constraints.push(where('action', 'in', plan.actionIn));
    }
  }

  if (!forCount && cursor) {
    constraints.push(startAfter(cursor));
  }
  if (!forCount && typeof pageSize === 'number' && pageSize > 0) {
    constraints.push(limit(pageSize));
  }

  return constraints;
}

export function matchesAuditClientFilters(
  log: ActivityLog,
  filters: AuditFiltersState,
  plan: AuditQueryPlan,
  options: { includeServerConstraints?: boolean } = {}
): boolean {
  const { includeServerConstraints = false } = options;

  if (includeServerConstraints) {
    if (plan.moduleEq && normalizeAuditModuleKey(log.module) !== plan.moduleEq) {
      return false;
    }
    if (plan.userIdEq && (log.userId || '') !== plan.userIdEq) {
      return false;
    }
    if (plan.locationStatusEq && log.location?.status !== plan.locationStatusEq) {
      return false;
    }
    const expanded = expandAuditFilterTypes(filters.types);
    if (expanded.length > 0 && !expanded.includes(String(log.action || ''))) {
      return false;
    }
  }

  if (plan.dateBounds) {
    const logDate = getLogDate(log);
    if (!logDate) return false;
    const ms = logDate.getTime();
    if (plan.dateBounds.startMs !== null && ms < plan.dateBounds.startMs) return false;
    if (plan.dateBounds.endMs !== null && ms > plan.dateBounds.endMs) return false;
  }

  if (filters.statuses.length > 0) {
    const isSettled = Boolean(log.settled);
    const isReverted = Boolean(log.reverted);
    const isActive = !isReverted && !isSettled;
    const matchesStatus = filters.statuses.some((statusKey) => {
      if (statusKey === 'active') return isActive;
      if (statusKey === 'settled') return isSettled;
      return false;
    });
    if (!matchesStatus) {
      return false;
    }
  }

  if (plan.clientSearch) {
    const title = String(log.title || log.action || '').toLowerCase();
    const targetLabel = String(log.targetLabel || '').toLowerCase();
    if (!title.includes(plan.clientSearch) && !targetLabel.includes(plan.clientSearch)) {
      return false;
    }
  }

  return true;
}

export function parseAuditFiltersFromSearch(search: string): AuditFiltersState {
  const params = new URLSearchParams(search || '');
  const rawModule = (params.get('module') || '').trim();
  const module = rawModule ? normalizeAuditModuleKey(rawModule) : 'ALL';

  const rawTypes = (params.get('type') || '')
    .split(',')
    .map((s) => s.trim() as AuditFilterType)
    .filter((t) => VALID_TYPES.has(t));
  const types = Array.from(new Set(rawTypes));

  const rawStatuses = (params.get('status') || '')
    .split(',')
    .map((s) => s.trim() as AuditStatusFilter)
    .filter((s) => VALID_STATUSES.has(s));
  const statuses = Array.from(new Set(rawStatuses));

  const rawRange = (params.get('range') || '').trim() as AuditDateRangePreset;
  const range = VALID_RANGES.has(rawRange) ? rawRange : null;

  const rawFrom = (params.get('from') || '').trim();
  const rawTo = (params.get('to') || '').trim();
  const from = range === 'custom' && DATE_PATTERN.test(rawFrom) ? rawFrom : '';
  const to = range === 'custom' && DATE_PATTERN.test(rawTo) ? rawTo : '';

  const userId = (params.get('user') || '').trim();
  const q = params.get('q') || '';
  const withLocation = params.get('loc') === '1';

  return {
    module,
    search: q,
    types,
    statuses,
    range,
    from,
    to,
    userId,
    withLocation,
  };
}

export function serializeAuditFiltersToSearch(
  filters: AuditFiltersState,
  existingSearch: string = ''
): string {
  const params = new URLSearchParams(existingSearch || '');

  // Clean managed audit keys first, preserving any unrelated params if present
  params.delete('module');
  params.delete('type');
  params.delete('status');
  params.delete('range');
  params.delete('from');
  params.delete('to');
  params.delete('user');
  params.delete('q');
  params.delete('loc');

  if (filters.module && filters.module !== 'ALL') {
    params.set('module', filters.module);
  }
  if (filters.types.length > 0) {
    params.set('type', filters.types.join(','));
  }
  if (filters.statuses.length > 0) {
    params.set('status', filters.statuses.join(','));
  }
  if (filters.range) {
    params.set('range', filters.range);
    if (filters.range === 'custom') {
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
    }
  }
  if (filters.userId) {
    params.set('user', filters.userId);
  }
  if (filters.withLocation) {
    params.set('loc', '1');
  }
  if (filters.search.trim()) {
    params.set('q', filters.search.trim());
  }

  const str = params.toString();
  return str ? `?${str}` : '';
}

export function countActiveSheetFilters(sheet: AuditSheetFilters): number {
  return (
    sheet.types.length +
    sheet.statuses.length +
    (sheet.range ? 1 : 0) +
    (sheet.userId ? 1 : 0) +
    (sheet.withLocation ? 1 : 0)
  );
}

export function formatShortYmdBn(ymd: string): string {
  if (!DATE_PATTERN.test(ymd)) return ymd;
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

export function formatActiveSheetSummary(
  sheet: AuditSheetFilters,
  userLabelMap: Map<string, string>
): string {
  const parts: string[] = [];

  for (const t of sheet.types) {
    const found = AUDIT_TYPE_CHIPS.find((c) => c.id === t);
    if (found) parts.push(found.label);
  }

  for (const s of sheet.statuses) {
    const found = AUDIT_STATUS_CHIPS.find((c) => c.id === s);
    if (found) parts.push(found.label);
  }

  if (sheet.range) {
    if (sheet.range === 'custom') {
      if (sheet.from && sheet.to) {
        parts.push(`${formatShortYmdBn(sheet.from)} – ${formatShortYmdBn(sheet.to)}`);
      } else if (sheet.from) {
        parts.push(`${formatShortYmdBn(sheet.from)} থেকে`);
      } else if (sheet.to) {
        parts.push(`${formatShortYmdBn(sheet.to)} পর্যন্ত`);
      } else {
        parts.push('কাস্টম');
      }
    } else {
      const found = AUDIT_RANGE_CHIPS.find((c) => c.id === sheet.range);
      if (found) parts.push(found.label);
    }
  }

  if (sheet.userId) {
    parts.push(userLabelMap.get(sheet.userId) || sheet.userId);
  }

  if (sheet.withLocation) {
    parts.push('অবস্থানসহ');
  }

  return parts.join(' · ');
}

export interface RequiredCompositeIndexDoc {
  fields: string;
  usedBy: string;
}

export const REQUIRED_AUDIT_COMPOSITE_INDEXES: RequiredCompositeIndexDoc[] = [
  {
    fields: 'module ASC, userId ASC',
    usedBy: 'Module chip + User filter (multi-equality combo; falls back to client filter if not created)',
  },
  {
    fields: 'module ASC, action ASC',
    usedBy: 'Module chip + Type filter (falls back to client filter if not created)',
  },
  {
    fields: 'userId ASC, action ASC',
    usedBy: 'User filter + Type filter (falls back to client filter if not created)',
  },
  {
    fields: 'module ASC, location.status ASC',
    usedBy: 'Module chip + "অবস্থানসহ" filter (falls back to client filter if not created)',
  },
  {
    fields: 'module ASC, userId ASC, action ASC',
    usedBy: 'Module chip + User filter + Type filter (falls back to client filter if not created)',
  },
];
