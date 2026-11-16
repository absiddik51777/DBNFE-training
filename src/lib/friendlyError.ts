/**
 * Explicit error wrapper for truthful domain-level validation or conflict messages
 * already written in Bengali (e.g. transaction conflict details or uniqueness checks).
 */
export class ActionMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionMessageError';
  }
}

/**
 * Maps any thrown error / HTTP status / Firebase error code into a clear, truthful Bengali message.
 * Logs raw unknown errors to console.error for debugging without exposing internal stack traces to UI.
 */
export function friendlyError(err: unknown): string {
  if (err instanceof ActionMessageError && err.message.trim()) {
    return err.message.trim();
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'ইন্টারনেট সংযোগ যাচাই করুন';
  }

  const anyErr = err as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    name?: unknown;
    message?: unknown;
  } | null;

  const code = String(anyErr?.code || '').toLowerCase();
  const status = Number(anyErr?.status || anyErr?.statusCode || 0);
  const name = String(anyErr?.name || '').toLowerCase();
  const message = String(anyErr?.message || (typeof err === 'string' ? err : '')).toLowerCase();

  // Permission / 403
  if (
    status === 403 ||
    code.includes('permission-denied') ||
    code.includes('permission') ||
    message.includes('permission-denied') ||
    message.includes('missing or insufficient permissions') ||
    message.includes('403')
  ) {
    return 'আপনার এই কাজের অনুমতি নেই';
  }

  // Unauthenticated / 401
  if (
    status === 401 ||
    code.includes('unauthenticated') ||
    code.includes('auth/user-token-expired') ||
    code.includes('auth/requires-recent-login') ||
    message.includes('unauthenticated') ||
    message.includes('401')
  ) {
    return 'আবার লগইন করুন';
  }

  // Timeout / 408 / 504 / deadline-exceeded
  if (
    status === 408 ||
    status === 504 ||
    code.includes('deadline-exceeded') ||
    code.includes('timeout') ||
    name === 'aborterror' ||
    message.includes('deadline-exceeded') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('408') ||
    message.includes('504')
  ) {
    return 'সংযোগ ধীর';
  }

  // Network / 503 / unavailable
  if (
    status === 503 ||
    code.includes('unavailable') ||
    code.includes('network') ||
    code.includes('failed-precondition') ||
    message.includes('unavailable') ||
    message.includes('network-request-failed') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('offline') ||
    message.includes('503')
  ) {
    return 'ইন্টারনেট সংযোগ যাচাই করুন';
  }

  console.error('[friendlyError] Unmapped error:', err);
  return 'অজানা সমস্যা হয়েছে';
}
