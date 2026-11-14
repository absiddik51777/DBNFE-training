import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { AuditLocation, AuditLocationSource } from '../types';

export type { AuditLocation, AuditLocationSource };

const LOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60000,
} as const;

export const LOCATION_EXPLANATION_MESSAGE =
  'এই সিস্টেম প্রতিটি কাজের অবস্থান সংরক্ষণ করে। চালিয়ে যেতে অবস্থান অনুমতি দিন।';

export const LOCATION_PERMANENTLY_DENIED_MESSAGE =
  'সেটিংস > অ্যাপ > BNFE > অনুমতি > অবস্থান থেকে চালু করুন';

export const LOCATION_SERVICES_OFF_MESSAGE = 'ফোনের লোকেশন চালু করুন';

export const LOCATION_REQUIRED_BLOCK_MESSAGE =
  'অবস্থান চালু না করলে এই কাজটি করা যাবে না';

interface LocationUiBridge {
  confirmExplanation: (message: string) => Promise<boolean>;
  showNotice: (title: string, message: string) => Promise<void>;
}

let uiBridge: LocationUiBridge | null = null;
let explanationShownThisSession = false;
let permanentlyDeniedNoticeShownThisSession = false;
let locationOffNoticeShownThisSession = false;
let inFlightLocationPromise: Promise<AuditLocation> | null = null;

export function registerLocationUiBridge(bridge: LocationUiBridge | null): void {
  uiBridge = bridge;
}

function roundTo5Decimals(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function normalizeLocationResult(
  lat: number,
  lng: number,
  accuracy: number | undefined | null,
  source: AuditLocationSource
): AuditLocation {
  const capturedAt = new Date().toISOString();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: 'unavailable', capturedAt, source };
  }
  const cleanLat = roundTo5Decimals(lat);
  const cleanLng = roundTo5Decimals(lng);
  const hasValidAccuracy = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0;

  return {
    status: 'granted',
    lat: cleanLat,
    lng: cleanLng,
    ...(hasValidAccuracy ? { accuracy: Math.round(accuracy) } : {}),
    capturedAt,
    source,
  };
}

async function promptExplanationOnce(): Promise<boolean> {
  if (explanationShownThisSession) return true;
  explanationShownThisSession = true;
  if (!uiBridge) return true;
  try {
    return await uiBridge.confirmExplanation(LOCATION_EXPLANATION_MESSAGE);
  } catch {
    return true;
  }
}

async function notifyPermanentlyDenied(forceShow: boolean): Promise<void> {
  if (permanentlyDeniedNoticeShownThisSession && !forceShow) return;
  permanentlyDeniedNoticeShownThisSession = true;
  if (!uiBridge) return;
  try {
    await uiBridge.showNotice('অবস্থান অনুমতি প্রয়োজন', LOCATION_PERMANENTLY_DENIED_MESSAGE);
  } catch {
    // ignore UI notification errors
  }
}

async function notifyLocationServicesOff(forceShow: boolean): Promise<void> {
  if (locationOffNoticeShownThisSession && !forceShow) return;
  locationOffNoticeShownThisSession = true;
  if (!uiBridge) return;
  try {
    await uiBridge.showNotice('লোকেশন বন্ধ আছে', LOCATION_SERVICES_OFF_MESSAGE);
  } catch {
    // ignore UI notification errors
  }
}

function classifyNativeError(err: unknown): 'denied' | 'timeout' | 'unavailable' {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message || '').toLowerCase()
      : String(err || '').toLowerCase();
  const code =
    err && typeof err === 'object' && 'code' in err
      ? Number((err as { code?: unknown }).code)
      : NaN;

  if (code === 3 || msg.includes('timeout') || msg.includes('timed out')) {
    return 'timeout';
  }
  if (
    code === 1 ||
    msg.includes('permission') ||
    msg.includes('denied') ||
    msg.includes('not authorized')
  ) {
    return 'denied';
  }
  return 'unavailable';
}

async function captureNativeLocation(forceNoticeOnIssue: boolean): Promise<AuditLocation> {
  const capturedAt = () => new Date().toISOString();
  const source: AuditLocationSource = 'native';

  try {
    let permStatus;
    try {
      permStatus = await Geolocation.checkPermissions();
    } catch (err) {
      const kind = classifyNativeError(err);
      if (kind === 'unavailable') {
        await notifyLocationServicesOff(forceNoticeOnIssue);
      } else if (kind === 'denied') {
        await notifyPermanentlyDenied(forceNoticeOnIssue);
      }
      return { status: kind, capturedAt: capturedAt(), source };
    }

    let state = permStatus.location || permStatus.coarseLocation || 'prompt';

    if (state === 'prompt' || state === 'prompt-with-rationale') {
      const agreed = await promptExplanationOnce();
      if (!agreed) {
        return { status: 'denied', capturedAt: capturedAt(), source };
      }

      try {
        const req = await Geolocation.requestPermissions({
          permissions: ['location', 'coarseLocation'],
        });
        state = req.location || req.coarseLocation || 'denied';
      } catch (err) {
        const kind = classifyNativeError(err);
        if (kind === 'unavailable') {
          await notifyLocationServicesOff(forceNoticeOnIssue);
        } else if (kind === 'denied') {
          await notifyPermanentlyDenied(forceNoticeOnIssue);
        }
        return { status: kind, capturedAt: capturedAt(), source };
      }
    }

    if (state === 'denied') {
      await notifyPermanentlyDenied(forceNoticeOnIssue);
      return { status: 'denied', capturedAt: capturedAt(), source };
    }

    if (state !== 'granted') {
      return { status: 'denied', capturedAt: capturedAt(), source };
    }

    const pos = await Geolocation.getCurrentPosition(LOCATION_OPTIONS);
    return normalizeLocationResult(
      pos.coords.latitude,
      pos.coords.longitude,
      pos.coords.accuracy,
      source
    );
  } catch (err) {
    const kind = classifyNativeError(err);
    if (kind === 'unavailable') {
      await notifyLocationServicesOff(forceNoticeOnIssue);
    } else if (kind === 'denied') {
      await notifyPermanentlyDenied(forceNoticeOnIssue);
    }
    return { status: kind, capturedAt: capturedAt(), source };
  }
}

async function captureWebLocation(forceNoticeOnIssue: boolean): Promise<AuditLocation> {
  const capturedAt = () => new Date().toISOString();
  const source: AuditLocationSource = 'web';

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { status: 'unsupported', capturedAt: capturedAt(), source };
  }

  try {
    let permissionState: PermissionState | 'unknown' = 'unknown';

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        permissionState = result.state;
      } catch {
        permissionState = 'unknown';
      }
    }

    if (permissionState === 'denied') {
      await notifyPermanentlyDenied(forceNoticeOnIssue);
      return { status: 'denied', capturedAt: capturedAt(), source };
    }

    if (permissionState === 'prompt' || (permissionState === 'unknown' && !explanationShownThisSession)) {
      const agreed = await promptExplanationOnce();
      if (!agreed) {
        return { status: 'denied', capturedAt: capturedAt(), source };
      }
    }

    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, LOCATION_OPTIONS);
    });

    return normalizeLocationResult(
      pos.coords.latitude,
      pos.coords.longitude,
      pos.coords.accuracy,
      source
    );
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? Number((err as { code?: unknown }).code)
        : NaN;

    if (code === 1) {
      await notifyPermanentlyDenied(forceNoticeOnIssue);
      return { status: 'denied', capturedAt: capturedAt(), source };
    }
    if (code === 3) {
      return { status: 'timeout', capturedAt: capturedAt(), source };
    }
    if (code === 2) {
      await notifyLocationServicesOff(forceNoticeOnIssue);
      return { status: 'unavailable', capturedAt: capturedAt(), source };
    }
    return { status: 'unavailable', capturedAt: capturedAt(), source };
  }
}

/**
 * Captures the user's approximate location for an audit log entry.
 * Never throws; always resolves to an AuditLocation record.
 * Never console.logs coordinates.
 */
export async function getActionLocation(options?: {
  forceNoticeOnIssue?: boolean;
}): Promise<AuditLocation> {
  if (inFlightLocationPromise) {
    return inFlightLocationPromise;
  }

  const forceNotice = Boolean(options?.forceNoticeOnIssue);

  inFlightLocationPromise = (async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        return await captureNativeLocation(forceNotice);
      }
      return await captureWebLocation(forceNotice);
    } catch {
      return {
        status: 'unavailable',
        capturedAt: new Date().toISOString(),
        source: Capacitor.isNativePlatform() ? 'native' : 'web',
      };
    } finally {
      inFlightLocationPromise = null;
    }
  })();

  return inFlightLocationPromise;
}
