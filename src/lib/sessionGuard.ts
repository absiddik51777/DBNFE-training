/**
 * Central live-session guard registry:
 * - Tracks all active Firestore data/collection/settings/notification snapshot listeners
 *   so a forced logout or session revocation cancels EVERY listener synchronously.
 * - Routes any Firestore `permission-denied` error to AuthContext for immediate
 *   server verification via `getDocFromServer(doc(db, 'users', uid))`.
 * - Clears cached app state on logout / forced termination without trusting localStorage for RBAC.
 */

type UnsubscribeFn = () => void;
type PermissionDeniedHandler = () => void | Promise<void>;

const activeListeners = new Set<UnsubscribeFn>();
let permissionDeniedHandler: PermissionDeniedHandler | null = null;

/**
 * Registers a Firestore listener's unsubscribe callback so forced logout / revocation
 * can tear down every active subscription synchronously.
 * Returns a wrapper unsubscribe function that both detaches the listener and removes it from the registry.
 */
export function registerActiveListener(unsub: UnsubscribeFn): UnsubscribeFn {
  let cleaned = false;
  const wrapped = () => {
    if (cleaned) return;
    cleaned = true;
    activeListeners.delete(wrapped);
    try {
      unsub();
    } catch {
      // ignore cleanup errors on already-terminated streams
    }
  };
  activeListeners.add(wrapped);
  return wrapped;
}

/**
 * Synchronously unsubscribes all active Firestore listeners registered through sessionGuard.
 */
export function unsubscribeAllListeners(): void {
  const list = Array.from(activeListeners);
  activeListeners.clear();
  for (const unsub of list) {
    try {
      unsub();
    } catch {
      // ignore individual teardown errors
    }
  }
}

export function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const code = String((err as { code?: unknown })?.code || '').toLowerCase();
  const msg = String((err as { message?: unknown })?.message || '').toLowerCase();
  return (
    code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions')
  );
}

export function registerPermissionDeniedHandler(handler: PermissionDeniedHandler): UnsubscribeFn {
  permissionDeniedHandler = handler;
  return () => {
    if (permissionDeniedHandler === handler) {
      permissionDeniedHandler = null;
    }
  };
}

export function reportPermissionDenied(): void {
  if (permissionDeniedHandler) {
    try {
      void permissionDeniedHandler();
    } catch {
      // ignore dispatch failures
    }
  }
}

const APP_CACHE_PREFIXES = [
  'bnfe_cached_profile_',
  'bnfe_user_profile_',
  'bnfe_landing_',
  'bnfe_cal_prog_',
  'bnfe_trade_skill_modules_',
  'bnfe_trade_literacy_modules_',
  'bnfe_batch_skill_modules_',
  'bnfe_batch_literacy_modules_',
];

const APP_CACHE_EXACT_KEYS = [
  'bnfe_last_active_user',
  'bnfe_system_settings',
];

/**
 * Clears cached application & profile data from localStorage/sessionStorage on logout.
 * Preserves purely cosmetic theme preferences (`bnfe_theme_config_v1`).
 */
export function clearSessionAppCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const localKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (
        APP_CACHE_EXACT_KEYS.includes(k) ||
        APP_CACHE_PREFIXES.some((prefix) => k.startsWith(prefix))
      ) {
        localKeys.push(k);
      }
    }
    localKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore storage access issues
  }

  try {
    const sessionKeys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith('bnfe_')) {
        sessionKeys.push(k);
      }
    }
    sessionKeys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // ignore storage access issues
  }
}
