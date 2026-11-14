import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

function normalizeLegacyModule(raw: string): string {
  const m = (raw || '').trim().toLowerCase();
  if (m.includes('trainee') || m.includes('brn')) return 'trainees';
  if (m.includes('batch')) return 'batches';
  if (m.includes('institute')) return 'institutes';
  if (m.includes('trade')) return 'trades';
  if (m.includes('exam') || m.includes('result') || m.includes('mark')) return 'exams';
  if (m.includes('attendance')) return 'attendance';
  if (m.includes('security') || m.includes('auth')) return 'security';
  return 'settings';
}

function inferLegacyAction(rawAction: string, rawModule: string): string {
  const a = (rawAction || '').toLowerCase();
  const m = (rawModule || '').toLowerCase();
  if (m === 'security') return 'security';
  if (a.includes('এক্সপোর্ট') || a.includes('export') || a.includes('pdf') || a.includes('csv') || a.includes('excel')) {
    return 'export';
  }
  if (a.includes('রিসেট') && a.includes('পাসওয়ার্ড')) return 'security';
  if (a.includes('নিবন্ধন') && m === 'auth') return 'create';
  if (a.includes('আপডেট') || a.includes('update')) return 'update';
  if (a.includes('তৈরি') || a.includes('যোগ')) return 'create';
  if (a.includes('মোছা') || a.includes('অপসারণ') || a.includes('ডিলিট')) return 'delete';
  return 'settings';
}

// Backwards-compatible Activity Logger helper routed through centralized auditLog helper
export async function logActivity(
  userId: string,
  userName: string,
  action: string,
  module: string,
  recordId: string,
  details?: string
) {
  try {
    const resolvedUid = auth.currentUser?.uid || userId || 'system';
    const resolvedName = userName || auth.currentUser?.displayName || auth.currentUser?.email || 'User';
    const normalizedModule = normalizeLegacyModule(module) as import('../types').AuditModule;
    const inferredAction = inferLegacyAction(action, module) as import('../types').AuditAction;

    const { recordSimpleAuditLog } = await import('./auditLog');
    await recordSimpleAuditLog({
      action: inferredAction,
      module: normalizedModule,
      collectionName: normalizedModule,
      targetId: recordId || 'system',
      targetLabel: details || action,
      title: action,
      details: details || action || '',
      actor: {
        userId: resolvedUid,
        user: resolvedName,
        userRole: 'User',
      },
    });
  } catch (error) {
    console.warn("Failed to log activity to Cloud Firestore:", error);
  }
}
