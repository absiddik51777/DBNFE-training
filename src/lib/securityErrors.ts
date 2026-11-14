/**
 * Structured Firebase / Firestore security error handling and logging
 */
import { recordSimpleAuditLog } from './auditLog';

export type SecurityOperationType = 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';

export interface FirestoreErrorInfo {
  error: Error;
  operationType: SecurityOperationType;
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    role?: string | null;
  };
}

export interface SanitizedSecurityError {
  isSecurityError: boolean;
  code: string;
  userMessage: string;
  actionableResolution: string;
}

/**
 * Categorizes and sanitizes Firestore & Auth errors so internal Firebase structures,
 * collection schemas, or private backend details are never leaked to end users.
 */
export function handleFirestoreError(errorInfo: FirestoreErrorInfo): SanitizedSecurityError {
  const { error, operationType, path, authInfo } = errorInfo;
  const rawMsg = error?.message || '';
  const rawCode = (error as any)?.code || '';

  const isPermissionDenied = 
    rawCode === 'permission-denied' || 
    rawMsg.toLowerCase().includes('permission-denied') || 
    rawMsg.toLowerCase().includes('missing or insufficient permissions');

  const isUnauthenticated = 
    rawCode === 'unauthenticated' || 
    rawMsg.toLowerCase().includes('unauthenticated') || 
    !authInfo.userId;

  const isUnavailable = 
    rawCode === 'unavailable' || 
    rawMsg.toLowerCase().includes('unavailable') || 
    rawMsg.toLowerCase().includes('failed to get document because the client is offline');

  // Log detailed technical telemetry internally
  console.error(`[Security Log] Firestore Error:`, {
    operationType,
    path,
    user: authInfo.email || authInfo.userId || 'anonymous',
    role: authInfo.role || 'none',
    rawCode,
    rawMsg
  });

  // If permission denied or security violation, write to security audit trail if user is identified
  if (isPermissionDenied && authInfo.userId) {
    try {
      void recordSimpleAuditLog({
        action: 'security',
        module: 'security',
        collectionName: path ? path.split('/')[0] : 'security',
        targetId: authInfo.userId,
        targetLabel: path || 'database',
        title: `অননুমোদিত অ্যাক্সেস প্রচেষ্টা (Security Warning): ${operationType} on ${path || 'database'}`,
        actor: {
          userId: authInfo.userId,
          user: authInfo.email || 'User',
          userRole: authInfo.role || 'User',
        },
      }).catch(() => {});
    } catch {
      // non-blocking
    }
  }

  if (isUnauthenticated) {
    return {
      isSecurityError: true,
      code: 'unauthenticated',
      userMessage: 'আপনার লগইন সেশনের মেয়াদ শেষ হয়েছে বা আপনি লগইন করেননি।',
      actionableResolution: 'অনুগ্রহ করে পুনরায় লগইন করুন।'
    };
  }

  if (isPermissionDenied) {
    return {
      isSecurityError: true,
      code: 'permission-denied',
      userMessage: 'এই তথ্য দেখা বা পরিবর্তন করার জন্য আপনার অ্যাকাউন্টের প্রয়োজনীয় অনুমতি নেই।',
      actionableResolution: 'প্রয়োজনে কোর্স পরিচালকের সাথে যোগাযোগ করুন।'
    };
  }

  if (isUnavailable) {
    return {
      isSecurityError: false,
      code: 'unavailable',
      userMessage: 'ইন্টারনেট সংযোগ বিচ্ছিন্ন বা সার্ভার সাময়িকভাবে অনুপলব্ধ।',
      actionableResolution: 'আপনার ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।'
    };
  }

  return {
    isSecurityError: false,
    code: rawCode || 'unknown',
    userMessage: 'অনুরোধটি সম্পন্ন করার সময় একটি ত্রুটি ঘটেছে।',
    actionableResolution: 'অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
  };
}
