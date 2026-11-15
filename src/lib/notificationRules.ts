import type { AuditAction, AuditModule, NotificationPriority } from '../types';

export const COURSE_DIRECTOR_ROLE = 'Course Director';
export const FMA_ROLE = 'FMA';
export const TRAINER_ROLE = 'Trainer';

const MINOR_EDITS_PREF_KEY = 'bnfe_notify_cd_minor_edits';

/**
 * Controls whether Course Director receives notifications on minor `create`/`update`
 * edits by FMA/Trainer. Defaults to `true` (per notification rules 2a).
 * Important actions (`delete`, `bulk_delete`, `undo`, `restore`, `settings`, `security`, `export`)
 * ALWAYS notify regardless of this toggle.
 */
export function getNotifyMinorEditsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(MINOR_EDITS_PREF_KEY);
    if (raw === 'false') return false;
  } catch {
    // ignore storage failures
  }
  return true;
}

export function setNotifyMinorEditsPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MINOR_EDITS_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
}

export interface NotificationRoutingInput {
  action: AuditAction;
  module: AuditModule;
  collectionName?: string;
  actorUserId?: string;
  actorRole?: string;
  targetOriginalActor?: {
    userId?: string | null;
    userRole?: string | null;
  } | null;
  isAttendanceSummary?: boolean;
  isSecurityAlert?: boolean;
  title?: string;
  explicitNotifyRoles?: string[];
  explicitNotifyUserIds?: string[];
  explicitPriority?: NotificationPriority;
}

export interface NotificationRoutingResult {
  notifyRoles: string[];
  notifyUserIds: string[];
  priority: NotificationPriority;
}

const IMPORTANT_NON_ADMIN_ACTIONS = new Set<AuditAction>([
  'delete',
  'bulk_delete',
  'undo',
  'restore',
  'settle',
  'settings',
  'security',
  'export',
]);

function dedupeStrings(items: Array<string | undefined | null>): string[] {
  const out = new Set<string>();
  for (const item of items) {
    const trimmed = typeof item === 'string' ? item.trim() : '';
    if (trimmed) out.add(trimmed);
  }
  return Array.from(out);
}

export function isSecurityWarningLog(params: {
  action: AuditAction;
  module: AuditModule;
  title?: string;
  isSecurityAlert?: boolean;
}): boolean {
  if (params.isSecurityAlert) return true;
  if (params.action === 'security') return true;
  if (params.module === 'security') {
    const t = (params.title || '').toLowerCase();
    if (
      t.includes('security warning') ||
      t.includes('অননুমোদিত') ||
      t.includes('পাসওয়ার্ড রিসেট') ||
      t.includes('unauthorized')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves `notifyRoles`, `notifyUserIds`, and `priority` for an audit log entry.
 * Guarantee: returns arrays (possibly empty) and a valid priority so every log document has consistent fields.
 */
export function resolveNotificationRouting(
  input: NotificationRoutingInput
): NotificationRoutingResult {
  const actorRole = (input.actorRole || '').trim();
  const isActorCourseDirector = actorRole === COURSE_DIRECTOR_ROLE;
  const origUid = (input.targetOriginalActor?.userId || '').trim();
  const origRole = (input.targetOriginalActor?.userRole || '').trim();

  // If explicit overrides were provided, normalize and return them directly
  if (input.explicitNotifyRoles || input.explicitNotifyUserIds) {
    const roles = dedupeStrings(input.explicitNotifyRoles || []);
    const userIds = dedupeStrings(input.explicitNotifyUserIds || []);
    const priority: NotificationPriority =
      input.explicitPriority ||
      (isSecurityWarningLog(input)
        ? 'urgent'
        : input.action === 'delete' ||
          input.action === 'bulk_delete' ||
          input.action === 'undo' ||
          input.action === 'restore'
        ? 'warning'
        : 'normal');
    return { notifyRoles: roles, notifyUserIds: userIds, priority };
  }

  // 2e. Security alerts (permission denied, suspicious actions, security warnings) -> urgent to Course Director
  if (isSecurityWarningLog(input)) {
    return {
      notifyRoles: isActorCourseDirector && input.action !== 'security' ? [] : [COURSE_DIRECTOR_ROLE],
      notifyUserIds: [],
      priority: 'urgent',
    };
  }

  // 2b. Course Director rejects (Undo Change or Restore) an entry originally made by FMA
  if (
    isActorCourseDirector &&
    (input.action === 'undo' || input.action === 'restore') &&
    origRole === FMA_ROLE &&
    origUid &&
    origUid !== input.actorUserId
  ) {
    return {
      notifyRoles: [], // Skip self-notifying Course Director
      notifyUserIds: [origUid],
      priority: 'warning',
    };
  }

  // 2c. Course Director settles an entry originally made by FMA
  if (
    isActorCourseDirector &&
    input.action === 'settle' &&
    origRole === FMA_ROLE &&
    origUid &&
    origUid !== input.actorUserId
  ) {
    return {
      notifyRoles: [], // Skip self-notifying Course Director
      notifyUserIds: [origUid],
      priority: 'normal',
    };
  }

  // 2d. Daily attendance batch summary -> FMA & Course Director (skip CD if CD performed it)
  if (input.isAttendanceSummary || (input.module === 'attendance' && input.collectionName === 'attendance')) {
    const roles = isActorCourseDirector ? [FMA_ROLE] : [FMA_ROLE, COURSE_DIRECTOR_ROLE];
    return {
      notifyRoles: roles,
      notifyUserIds: [],
      priority: input.action === 'delete' || input.action === 'bulk_delete' ? 'warning' : 'normal',
    };
  }

  // 2a. General Course Director notifications (skip self-notifications when actor is Course Director)
  if (isActorCourseDirector) {
    const priority: NotificationPriority =
      input.action === 'delete' ||
      input.action === 'bulk_delete' ||
      input.action === 'undo' ||
      input.action === 'restore'
        ? 'warning'
        : 'normal';
    return {
      notifyRoles: [],
      notifyUserIds: [],
      priority,
    };
  }

  // Actor is non-Course-Director (FMA, Trainer, Pending, etc.)
  const isImportant =
    IMPORTANT_NON_ADMIN_ACTIONS.has(input.action) ||
    input.collectionName === 'settings' ||
    input.collectionName === 'systemSettings' ||
    input.module === 'settings' ||
    input.module === 'security' ||
    input.action === 'create' ||
    getNotifyMinorEditsPreference();

  const priority: NotificationPriority =
    input.action === 'delete' ||
    input.action === 'bulk_delete' ||
    input.action === 'undo' ||
    input.action === 'restore'
      ? 'warning'
      : 'normal';

  return {
    notifyRoles: isImportant ? [COURSE_DIRECTOR_ROLE] : [],
    notifyUserIds: [],
    priority,
  };
}
