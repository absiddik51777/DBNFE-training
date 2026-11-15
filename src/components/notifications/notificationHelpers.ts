import {
  formatDhakaDayHeading,
  formatDhakaTime12h,
  getDhakaDayKey,
  getLogDate,
  shiftDhakaDayKey,
} from '../../lib/auditDate';
import { getModuleLabelBn } from '../audit/auditFormatters';
import type { ActivityLog } from '../../types';

export type NotificationIconTone = 'danger' | 'warning' | 'success' | 'primary' | 'info' | 'neutral';

export function getNotificationVisualType(log: ActivityLog): {
  kind: 'security' | 'undo_restore' | 'delete' | 'settle' | 'attendance' | 'trainees' | 'settings' | 'default';
  tone: NotificationIconTone;
} {
  const action = String(log.action || '').toLowerCase();
  const mod = String(log.module || '').toLowerCase();

  if (log.priority === 'urgent' || action === 'security') {
    return { kind: 'security', tone: 'danger' };
  }
  if (action === 'undo' || action === 'restore') {
    return { kind: 'undo_restore', tone: 'warning' };
  }
  if (action === 'delete' || action === 'bulk_delete') {
    return { kind: 'delete', tone: 'warning' };
  }
  if (action === 'settle') {
    return { kind: 'settle', tone: 'success' };
  }
  if (mod === 'attendance') {
    return { kind: 'attendance', tone: 'primary' };
  }
  if (mod === 'trainees' || mod === 'trainee_brn_verification') {
    return { kind: 'trainees', tone: 'info' };
  }
  if (mod === 'settings' || mod === 'system') {
    return { kind: 'settings', tone: 'neutral' };
  }
  return { kind: 'default', tone: 'primary' };
}

export function formatNotificationTimeDhaka(
  log: ActivityLog,
  now: Date = new Date()
): string {
  const dt = getLogDate(log, { now });
  if (!dt) return '';

  const dayKey = getDhakaDayKey(dt);
  const todayKey = getDhakaDayKey(now);
  const yesterdayKey = shiftDhakaDayKey(todayKey, -1);
  const timePart = formatDhakaTime12h(dt);

  if (dayKey === todayKey) {
    return timePart ? `আজ, ${timePart}` : 'আজ';
  }
  if (dayKey === yesterdayKey) {
    return timePart ? `গতকাল, ${timePart}` : 'গতকাল';
  }

  const dayLabel = formatDhakaDayHeading(dayKey, dt, now);
  return timePart ? `${dayLabel}, ${timePart}` : dayLabel;
}

export function getNotificationSubtitle(log: ActivityLog): string {
  const title = String(log.title || log.action || '').trim();
  const details = String(log.details || '').trim();
  if (details && details !== title) {
    return details;
  }

  const actor = String(log.user || log.userName || '').trim();
  const target = String(log.targetLabel || '').trim();
  const modLabel = getModuleLabelBn(log.module);

  const parts: string[] = [];
  if (target && !title.includes(target)) {
    parts.push(target);
  }
  if (actor) {
    parts.push(actor);
  }
  if (modLabel && parts.length < 2) {
    parts.push(modLabel);
  }
  return parts.join(' · ') || modLabel;
}

export function extractAttendanceNavigationTarget(
  log: ActivityLog
): { batchId: string; date: string } | null {
  const mod = String(log.module || '').toLowerCase();
  if (mod !== 'attendance') return null;

  const snap = log.snapshot as Record<string, unknown> | null | undefined;
  if (snap && typeof snap.batchId === 'string' && typeof snap.date === 'string') {
    return { batchId: snap.batchId, date: snap.date };
  }

  const targetId = String(log.targetId || '');
  const match = targetId.match(/^(.+)_(\d{4}-\d{2}-\d{2})$/);
  if (match) {
    return { batchId: match[1], date: match[2] };
  }

  return null;
}
