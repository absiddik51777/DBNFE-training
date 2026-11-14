import {
  limit,
  orderBy,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
  where,
  DocumentData,
} from 'firebase/firestore';
import type { ActivityLog } from '../types';
import { extractTimestampMs } from '../components/audit/auditFormatters';

export type AuditFilterType = 'update' | 'delete' | 'undo' | 'restore';
export type AuditDateRangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface AuditSheetFilters {
  types: AuditFilterType[];
  range: AuditDateRangePreset | null;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  userId: string;
}

export interface AuditFiltersState extends AuditSheetFilters {
  module: string; // 'ALL' or canonical module key
  search: string; // client-side search on title and targetLabel
}

export const DEFAULT_SHEET_FILTERS: AuditSheetFilters = {
  types: [],
  range: null,
  from: '',
  to: '',
  userId: '',
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

export const AUDIT_RANGE_CHIPS: ReadonlyArray<{ id: AuditDateRangePreset; label: string }> = [
  { id: 'today', label: 'আজ' },
  { id: 'yesterday', label: 'গতকাল' },
  { id: '7d', label: '৭ দিন' },
  { id: '30d', label: '৩০ দিন' },
  { id: 'custom', label: 'কাস্টম' },
];

export const AUDIT_PAGE_SIZE = 20;

const VALID_TYPES = new Set<AuditFilterType>(['update', 'delete', 'undo', 'restore']);
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

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  if (range === 'today') {
    return { startMs: todayStart.getTime(), endMs: todayEnd.getTime() };
  }

  if (range === 'yesterday') {
    const yStart = new Date(todayStart);
    yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(todayEnd);
    yEnd.setDate(yEnd.getDate() - 1);
    return { startMs: yStart.getTime(), endMs: yEnd.getTime() };
  }

  if (range === '7d') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { startMs: start.getTime(), endMs: todayEnd.getTime() };
  }

  if (range === '30d') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 29);
    return { startMs: start.getTime(), endMs: todayEnd.getTime() };
  }

  if (range === 'custom') {
    if (validateCustomDateRange(range, from, to)) return null;
    const startMs = from ? parseLocalDateStart(from) : null;
    const endMs = to ? parseLocalDateEnd(to) : null;
    if (startMs === null && endMs === null) return null;
    return { startMs, endMs };
  }

  return null;
}

export interface AuditQueryPlan {
  moduleEq: string | null;
  userIdEq: string | null;
  actionIn: string[] | null;
  dateBounds: DateRangeBounds | null;
  clientFilterActions: string[] | null;
  clientSearch: string;
  fallbackReason: 'action_in_with_date_range' | null;
  hasClientOnlyFilters: boolean;
}

/**
 * Pure, framework-agnostic Firestore query planner for `activityLogs`.
 * Easily testable without Firestore SDK runtime mocks.
 *
 * When both `action in [...]` AND a `createdAt` date range are active,
 * Firestore disjunction + range-on-different-field queries require combinatorial
 * composite indexes and multiply backend sub-queries. We keep `createdAt` range
 * in Firestore (with `orderBy('createdAt', 'desc')`) and fall back to filtering
 * `action` on the client.
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
  const expandedActions = expandAuditFilterTypes(filters.types);
  const dateBounds = resolveDateRangeBounds(filters.range, filters.from, filters.to, now);
  const clientSearch = filters.search.trim().toLowerCase();

  const hasActions = expandedActions.length > 0;
  const hasDateBounds = dateBounds !== null;

  let actionIn: string[] | null = null;
  let clientFilterActions: string[] | null = null;
  let fallbackReason: 'action_in_with_date_range' | null = null;

  if (hasActions && hasDateBounds) {
    // Fall back to client-side action filtering when combined with a createdAt range
    clientFilterActions = expandedActions;
    fallbackReason = 'action_in_with_date_range';
  } else if (hasActions) {
    actionIn = expandedActions;
  }

  return {
    moduleEq,
    userIdEq,
    actionIn,
    dateBounds,
    clientFilterActions,
    clientSearch,
    fallbackReason,
    hasClientOnlyFilters: Boolean(clientFilterActions || clientSearch),
  };
}

export interface BuildConstraintsOptions {
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  forCount?: boolean;
  /** Safe base query used only when Firestore reports a missing composite index */
  baseOrderOnly?: boolean;
}

/**
 * Converts an `AuditQueryPlan` into Firestore `QueryConstraint[]`.
 */
export function buildAuditFirestoreConstraints(
  plan: AuditQueryPlan,
  options: BuildConstraintsOptions = {}
): QueryConstraint[] {
  const {
    pageSize = AUDIT_PAGE_SIZE,
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
    if (plan.actionIn && plan.actionIn.length > 0) {
      constraints.push(where('action', 'in', plan.actionIn));
    }
    if (plan.dateBounds?.startMs !== null && plan.dateBounds?.startMs !== undefined) {
      constraints.push(where('createdAt', '>=', Timestamp.fromMillis(plan.dateBounds.startMs)));
    }
    if (plan.dateBounds?.endMs !== null && plan.dateBounds?.endMs !== undefined) {
      constraints.push(where('createdAt', '<=', Timestamp.fromMillis(plan.dateBounds.endMs)));
    }
  }

  if (!forCount) {
    constraints.push(orderBy('createdAt', 'desc'));
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
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
    const expanded = expandAuditFilterTypes(filters.types);
    if (expanded.length > 0 && !expanded.includes(String(log.action || ''))) {
      return false;
    }
    if (plan.dateBounds) {
      const ms = extractTimestampMs(log.createdAt ?? log.timestamp);
      if (ms === null) return false;
      if (plan.dateBounds.startMs !== null && ms < plan.dateBounds.startMs) return false;
      if (plan.dateBounds.endMs !== null && ms > plan.dateBounds.endMs) return false;
    }
  } else if (plan.clientFilterActions && plan.clientFilterActions.length > 0) {
    if (!plan.clientFilterActions.includes(String(log.action || ''))) {
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

  const rawRange = (params.get('range') || '').trim() as AuditDateRangePreset;
  const range = VALID_RANGES.has(rawRange) ? rawRange : null;

  const rawFrom = (params.get('from') || '').trim();
  const rawTo = (params.get('to') || '').trim();
  const from = range === 'custom' && DATE_PATTERN.test(rawFrom) ? rawFrom : '';
  const to = range === 'custom' && DATE_PATTERN.test(rawTo) ? rawTo : '';

  const userId = (params.get('user') || '').trim();
  const q = params.get('q') || '';

  return {
    module,
    search: q,
    types,
    range,
    from,
    to,
    userId,
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
  params.delete('range');
  params.delete('from');
  params.delete('to');
  params.delete('user');
  params.delete('q');

  if (filters.module && filters.module !== 'ALL') {
    params.set('module', filters.module);
  }
  if (filters.types.length > 0) {
    params.set('type', filters.types.join(','));
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
  if (filters.search.trim()) {
    params.set('q', filters.search.trim());
  }

  const str = params.toString();
  return str ? `?${str}` : '';
}

export function countActiveSheetFilters(sheet: AuditSheetFilters): number {
  return sheet.types.length + (sheet.range ? 1 : 0) + (sheet.userId ? 1 : 0);
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

  return parts.join(' · ');
}

export interface RequiredCompositeIndexDoc {
  fields: string;
  usedBy: string;
}

export const REQUIRED_AUDIT_COMPOSITE_INDEXES: RequiredCompositeIndexDoc[] = [
  {
    fields: 'module ASC, createdAt DESC',
    usedBy: 'Module chip (with or without createdAt date range)',
  },
  {
    fields: 'userId ASC, createdAt DESC',
    usedBy: 'User filter (with or without createdAt date range)',
  },
  {
    fields: 'action ASC, createdAt DESC',
    usedBy: 'Type filter (when no date range is selected)',
  },
  {
    fields: 'module ASC, userId ASC, createdAt DESC',
    usedBy: 'Module chip + User filter (with or without createdAt date range)',
  },
  {
    fields: 'module ASC, action ASC, createdAt DESC',
    usedBy: 'Module chip + Type filter (without date range)',
  },
  {
    fields: 'userId ASC, action ASC, createdAt DESC',
    usedBy: 'User filter + Type filter (without date range)',
  },
  {
    fields: 'module ASC, userId ASC, action ASC, createdAt DESC',
    usedBy: 'Module chip + User filter + Type filter (without date range)',
  },
];
