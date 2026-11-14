import { format } from 'date-fns';
import type { ActivityLog } from '../../types';
import { getFieldLabelBn, maskSensitiveValue } from '../../lib/auditLog';
import {
  DHAKA_TIMEZONE,
  formatCountBn,
  formatDhakaTime12h,
  getLogDate,
  parseAuditDateValue,
} from '../../lib/auditDate';

export { formatCountBn, formatDhakaTime12h, getLogDate, parseAuditDateValue };

export const MODULE_LABELS_BN: Record<string, string> = {
  trainees: 'প্রশিক্ষণার্থী',
  batches: 'ব্যাচ',
  institutes: 'প্রতিষ্ঠান',
  trades: 'ট্রেড',
  exams: 'পরীক্ষা ও ফলাফল',
  attendance: 'দৈনিক হাজিরা',
  settings: 'সেটিংস',
  security: 'নিরাপত্তা ও ইউজার',
  // Legacy fallback names
  results: 'পরীক্ষা ও ফলাফল',
  users: 'নিরাপত্তা ও ইউজার',
  auth: 'নিরাপত্তা ও ইউজার',
  system: 'সেটিংস',
  roles: 'নিরাপত্তা ও ইউজার',
  trainee_brn_verification: 'প্রশিক্ষণার্থী',
};

export const COLLECTION_LABELS_BN: Record<string, string> = {
  trainees: 'প্রশিক্ষণার্থী',
  batches: 'ব্যাচ',
  institutes: 'প্রতিষ্ঠান',
  trades: 'ট্রেড',
  exams: 'পরীক্ষা',
  marks: 'ফলাফল নম্বর',
  attendance: 'দৈনিক হাজিরা',
  settings: 'সিস্টেম সেটিংস',
  users: 'ব্যবহারকারী',
  roles: 'রোল ও পারমিশন',
  trade_skill_modules: 'স্কিল মডিউল',
  trade_literacy_modules: 'লিটারেসি মডিউল',
  batch_calendar_progress: 'ক্যালেন্ডার অগ্রগতি',
  calendar_progress_logs: 'ক্যালেন্ডার লগ',
};

export const ACTION_LABELS_BN: Record<string, string> = {
  create: 'তৈরি',
  update: 'হালনাগাদ',
  delete: 'মুছে ফেলা',
  bulk_delete: 'বাল্ক ডিলিট',
  undo: 'পরিবর্তন ফেরত',
  restore: 'পুনরুদ্ধার',
  settle: 'নিষ্পন্ন',
  export: 'এক্সপোর্ট',
  settings: 'সেটিংস',
  security: 'নিরাপত্তা',
};

const STANDARD_ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'bulk_delete',
  'undo',
  'restore',
  'settle',
  'export',
  'settings',
  'security',
]);

const TIMESTAMP_FIELD_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'startDate',
  'endDate',
  'admissionDate',
  'trainingStartDate',
  'trainingEndDate',
  'archivedAt',
  'approvedAt',
  'brn_verified_at',
]);

export function isStructuredAuditLog(log: ActivityLog): boolean {
  return Boolean(log.title) && STANDARD_ACTIONS.has(String(log.action || ''));
}

export function getModuleLabelBn(rawModule?: string): string {
  const key = (rawModule || '').trim().toLowerCase();
  if (!key) return 'সেটিংস';
  return MODULE_LABELS_BN[key] || rawModule || 'সেটিংস';
}

export function getCollectionLabelBn(collectionName?: string): string {
  if (!collectionName) return '';
  return COLLECTION_LABELS_BN[collectionName] || collectionName;
}

export function getActionLabelBn(action?: string): string {
  if (!action) return '';
  return ACTION_LABELS_BN[action] || action;
}

export function extractTimestampMs(ts: unknown): number | null {
  const d = parseAuditDateValue(ts);
  return d ? d.getTime() : null;
}

const dhakaDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DHAKA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dhakaDateOnlyFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DHAKA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatAuditTimestamp(
  ts: unknown,
  pattern: string = 'dd/MM/yyyy, hh:mm a'
): string {
  const d = parseAuditDateValue(ts);
  if (!d) return '';
  try {
    if (pattern === 'dd/MM/yyyy') {
      return dhakaDateOnlyFormatter.format(d);
    }
    if (pattern === 'dd/MM/yyyy, hh:mm a') {
      return dhakaDateTimeFormatter.format(d).replace(/am|pm/i, (m) => m.toUpperCase());
    }
    return format(d, pattern);
  } catch {
    return '';
  }
}

export function formatAuditValue(
  rawValue: unknown,
  field?: string,
  isAdmin: boolean = false
): string {
  const value = field ? maskSensitiveValue(field, rawValue, isAdmin) : rawValue;

  if (value === null || value === undefined || value === '') {
    return 'খালি';
  }
  if (typeof value === 'boolean') {
    return value ? 'হ্যাঁ' : 'না';
  }
  if (typeof value === 'number') {
    if (field && TIMESTAMP_FIELD_KEYS.has(field) && value > 100000000000) {
      return formatAuditTimestamp(value, 'dd/MM/yyyy') || String(value);
    }
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'খালি তালিকা';
    if (value.length <= 4 && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return value.join(', ');
    }
    return `${value.length} টি আইটেম`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return 'খালি';
    try {
      const str = JSON.stringify(value);
      return str.length > 140 ? `${keys.length} টি প্রপার্টি` : str;
    } catch {
      return `${keys.length} টি প্রপার্টি`;
    }
  }
  return String(value);
}

export function getSnapshotFieldLabel(key: string): string {
  return getFieldLabelBn(key);
}

export function hasLogDetails(log: ActivityLog): boolean {
  if (!log) return false;
  if (Array.isArray(log.changes) && log.changes.length > 0) return true;
  if (log.snapshot && typeof log.snapshot === 'object' && Object.keys(log.snapshot).length > 0) {
    return true;
  }
  if (Array.isArray(log.related) && log.related.length > 0) return true;
  if (Array.isArray(log.targetNames) && log.targetNames.length > 0) return true;
  if ((log.snapshotChunkCount ?? 0) > 0) return true;
  if (log.snapshotComplete === false && (log.action === 'delete' || log.action === 'bulk_delete')) {
    return true;
  }
  if (log.location) return true;
  if (log.settled || log.reverted || log.action === 'settle') return true;
  return false;
}
