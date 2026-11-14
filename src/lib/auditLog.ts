import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type {
  ActivityLog,
  AuditAction,
  AuditChange,
  AuditModule,
  AuditRelatedDoc,
} from '../types';

export type {
  ActivityLog,
  AuditAction,
  AuditChange,
  AuditModule,
  AuditRelatedDoc,
};

export interface AuditActor {
  userId?: string;
  user?: string;
  userRole?: string;
}

const MAX_INLINE_LOG_BYTES = 620_000;
const MAX_CHUNK_BYTES = 450_000;
const MAX_BATCH_OPS = 440;
const MAX_BULK_SNAPSHOT_DOCS = 2000;

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'clientsecret',
  'apikey',
  'privatekey',
  'authtoken',
  'sessiontoken',
]);

const IGNORED_DIFF_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'id',
  'brn_verified_at',
]);

const SENSITIVE_MASK_KEYS = new Set([
  'nidOrBirthRegistration',
  'phone',
  'mobileNumber',
  'email',
]);

export const FIELD_LABELS_BN: Record<string, string> = {
  // Common
  name: 'নাম',
  nameBn: 'নাম (বাংলা)',
  nameEn: 'নাম (ইংরেজি)',
  code: 'কোড',
  status: 'অবস্থা',
  description: 'বিবরণ',
  remarks: 'মন্তব্য',
  notes: 'নোট',
  address: 'ঠিকানা',
  phone: 'ফোন নম্বর',
  mobileNumber: 'মোবাইল নম্বর',
  email: 'ইমেইল',
  isArchived: 'আর্কাইভ করা',
  archivedAt: 'আর্কাইভের তারিখ',
  archivedReason: 'আর্কাইভের কারণ',

  // Institute
  contactPerson: 'যোগাযোগকারী ব্যক্তি',

  // Trade
  duration: 'মেয়াদ',

  // Batch
  batchCode: 'ব্যাচ কোড',
  instituteId: 'প্রতিষ্ঠান',
  tradeId: 'ট্রেড',
  batchId: 'ব্যাচ',
  skillTrainerId: 'স্কিল প্রশিক্ষক আইডি',
  skillTrainerName: 'স্কিল প্রশিক্ষক',
  literacyTrainerId: 'লিটারেসি প্রশিক্ষক আইডি',
  literacyTrainerName: 'লিটারেসি প্রশিক্ষক',
  fiscalYear: 'অর্থবছর',
  startDate: 'শুরুর তারিখ',
  endDate: 'সমাপ্তির তারিখ',
  maxTrainees: 'সর্বোচ্চ আসন',
  cancellationReason: 'বাতিলের কারণ',

  // Trainee
  traineeId: 'প্রশিক্ষণার্থী আইডি',
  registrationNumber: 'রেজিস্ট্রেশন নম্বর',
  fatherNameBn: 'পিতার নাম (বাংলা)',
  fatherNameEn: 'পিতার নাম (ইংরেজি)',
  motherNameBn: 'মাতার নাম (বাংলা)',
  motherNameEn: 'মাতার নাম (ইংরেজি)',
  dateOfBirth: 'জন্ম তারিখ',
  gender: 'লিঙ্গ',
  nidOrBirthRegistration: 'এনআইডি / জন্ম নিবন্ধন',
  permanentAddress: 'স্থায়ী ঠিকানা',
  presentAddress: 'বর্তমান ঠিকানা',
  sameAsPermanentAddress: 'স্থায়ী ও বর্তমান ঠিকানা একই',
  photoUrl: 'ছবি',
  lastClassCompleted: 'সর্বশেষ শ্রেণি',
  previousSchoolName: 'পূর্ববর্তী বিদ্যালয়',
  yearOfDropout: 'ঝরে পড়ার বছর',
  reasonForDropout: 'ঝরে পড়ার কারণ',
  admissionDate: 'ভর্তির তারিখ',
  trainingStartDate: 'প্রশিক্ষণ শুরু',
  trainingEndDate: 'প্রশিক্ষণ সমাপ্তি',
  is_brn_verified: 'জন্ম নিবন্ধন যাচাই',
  brn_remark: 'যাচাই মন্তব্য',
  brn_verified_by: 'যাচাইকারী',

  // Attendance
  date: 'তারিখ',
  recordedBy: 'সংরক্ষণকারী',

  // Exam & Marks
  type: 'পরীক্ষার ধরন',
  totalMarks: 'পূর্ণমান',
  passMarks: 'পাস নম্বর',
  subject: 'বিষয়',
  examId: 'পরীক্ষা',
  marksObtained: 'প্রাপ্ত নম্বর',
  percentage: 'শতকরা হার',
  grade: 'গ্রেড',
  result: 'ফলাফল',
  enteredBy: 'নম্বর প্রদানকারী',

  // Users & Roles
  role: 'পদবী (রোল)',
  trainerType: 'প্রশিক্ষকের ধরন',
  instituteName: 'প্রতিষ্ঠানের নাম',
  batchName: 'ব্যাচের নাম',
  photoURL: 'প্রোফাইল ছবি',
  approvedAt: 'অনুমোদনের সময়',
  approvedBy: 'অনুমোদনকারী',
  rejectionReason: 'বাতিলের কারণ',
  permissions: 'পারমিশন সমূহ',
  defaultLandingRoute: 'ডিফল্ট রুট',
  isSystem: 'সিস্টেম রোল',

  // System Settings
  allowDataDeletion: 'ডাটা ডিলিট অনুমতি',
  allowPublicRegistration: 'পাবলিক নিবন্ধন',
  registrationClosedReason: 'নিবন্ধন বন্ধের কারণ',
  deletionLockedReason: 'ডিলিট লকের কারণ',
  minAttendancePercentForCert: 'ন্যূনতম উপস্থিতির হার (%)',
  passMarkPercent: 'ন্যূনতম পাস নম্বর (%)',
  gradingRules: 'গ্রেডিং নিয়মাবলী',

  // Calendar / Modules
  dayNumber: 'দিবস নম্বর',
  moduleName: 'মডিউলের নাম',
  taskNo: 'কাজ নম্বর',
  topic: 'বিষয়বস্তু',
  theoryMinutes: 'তত্ত্বীয় সময় (মিনিট)',
  practicalMinutes: 'ব্যবহারিক সময় (মিনিট)',
  totalMinutes: 'মোট সময় (মিনিট)',
  phaseGroup: 'পর্যায়/গ্রুপ',
  toolsRequired: 'প্রয়োজনীয় যন্ত্রপাতি',
  category: 'শ্রেণি',
  startTime: 'শুরুর সময়',
  endTime: 'শেষের সময়',
  currentDay: 'বর্তমান দিবস',
  currentSkillDay: 'বর্তমান স্কিল দিবস',
  currentLiteracyDay: 'বর্তমান লিটারেসি দিবস',
  skillProgress: 'স্কিল অগ্রগতি',
  literacyProgress: 'লিটারেসি অগ্রগতি',
  completedDays: 'সম্পন্ন দিবস',
};

export function getFieldLabelBn(field: string): string {
  if (FIELD_LABELS_BN[field]) return FIELD_LABELS_BN[field];
  return field;
}

export function isSensitiveField(field: string): boolean {
  return SENSITIVE_MASK_KEYS.has(field);
}

export function maskSensitiveValue(
  field: string,
  value: unknown,
  isAdmin: boolean
): unknown {
  if (isAdmin || !isSensitiveField(field)) return value;
  if (value === null || value === undefined || value === '') return value;
  const str = String(value).trim();
  if (!str) return str;

  if (field === 'email') {
    const [local, domain] = str.split('@');
    if (!domain) return '••••';
    const prefix = local.slice(0, 1);
    return `${prefix}•••@${domain}`;
  }

  if (str.length <= 4) return '••••';
  const head = str.slice(0, Math.min(3, Math.floor(str.length / 3)));
  const tail = str.slice(-Math.min(4, Math.floor(str.length / 3)));
  return `${head}${'•'.repeat(Math.max(4, str.length - head.length - tail.length))}${tail}`;
}

export function sanitizeAuditValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) continue;
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined) {
        out[key] = sanitizeAuditValue(val);
      }
    }
    return out as T;
  }
  return value;
}

function stableNormalize(val: unknown): string {
  if (val === undefined || val === null || val === '') return '__EMPTY__';
  if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(stableNormalize).join(',')}]`;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableNormalize(obj[k])}`)
      .join(',')}}`;
  }
  return String(val);
}

export function computeFieldDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  extraIgnored: string[] = []
): AuditChange[] {
  const prev = (sanitizeAuditValue(before || {}) || {}) as Record<string, unknown>;
  const next = (sanitizeAuditValue(after || {}) || {}) as Record<string, unknown>;
  const ignored = new Set([...IGNORED_DIFF_KEYS, ...extraIgnored]);

  const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  const changes: AuditChange[] = [];

  for (const key of allKeys) {
    if (ignored.has(key) || REDACTED_KEYS.has(key.toLowerCase())) continue;
    const bVal = prev[key] === undefined ? null : prev[key];
    const aVal = next[key] === undefined ? null : next[key];
    if (stableNormalize(bVal) !== stableNormalize(aVal)) {
      changes.push({
        field: key,
        label: getFieldLabelBn(key),
        before: bVal,
        after: aVal,
      });
    }
  }

  return changes;
}

export function resolveAuditActor(actor?: AuditActor): {
  userId: string;
  user: string;
  userRole: string;
} {
  const authUid = auth.currentUser?.uid || '';
  const authEmail = auth.currentUser?.email || '';
  let cachedName = '';
  let cachedRole = '';

  if (typeof window !== 'undefined' && authUid) {
    try {
      const raw = localStorage.getItem(`bnfe_cached_profile_${authUid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        cachedName = parsed?.name || '';
        cachedRole = parsed?.role || '';
      }
    } catch {
      // ignore storage errors
    }
  }

  // Firestore rules check request.resource.data.userId == request.auth.uid
  const userId = authUid || actor?.userId || 'system';
  const user =
    actor?.user ||
    cachedName ||
    auth.currentUser?.displayName ||
    authEmail ||
    'ব্যবহারকারী';
  const userRole = actor?.userRole || cachedRole || 'User';

  return { userId, user, userRole };
}

export function normalizeAuditModule(rawModule: string): AuditModule {
  const m = (rawModule || '').trim().toLowerCase();
  if (m.includes('trainee') || m.includes('brn')) return 'trainees';
  if (m.includes('batch') || m.includes('calendar_progress')) return 'batches';
  if (m.includes('institute')) return 'institutes';
  if (m.includes('trade')) return 'trades';
  if (m.includes('exam') || m.includes('mark') || m.includes('result')) return 'exams';
  if (m.includes('attendance')) return 'attendance';
  if (m.includes('security') || m.includes('auth')) return 'security';
  return 'settings';
}

export function inferCollectionModule(collectionName: string): AuditModule {
  switch (collectionName) {
    case 'trainees':
      return 'trainees';
    case 'batches':
    case 'batch_calendar_progress':
    case 'calendar_progress_logs':
      return 'batches';
    case 'institutes':
      return 'institutes';
    case 'trades':
    case 'trade_skill_modules':
    case 'trade_literacy_modules':
      return 'trades';
    case 'exams':
    case 'marks':
      return 'exams';
    case 'attendance':
      return 'attendance';
    case 'users':
    case 'roles':
    case 'settings':
    case 'systemSettings':
      return 'settings';
    default:
      return 'settings';
  }
}

export function extractTargetLabel(
  collectionName: string,
  docData: Record<string, unknown> | null | undefined,
  fallbackId?: string
): string {
  if (!docData) return fallbackId || '';
  const candidates = [
    docData.nameBn,
    docData.name,
    docData.nameEn,
    docData.moduleName,
    docData.topic,
    docData.batchCode,
    docData.traineeId,
    docData.code,
    docData.email,
    docData.date,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  if (collectionName === 'settings' || fallbackId === 'system_config') {
    return 'সিস্টেম কনফিগারেশন';
  }
  return fallbackId || collectionName;
}

const COLLECTION_TITLE_BN: Record<string, string> = {
  trainees: 'প্রশিক্ষণার্থী',
  batches: 'প্রশিক্ষণ ব্যাচ',
  institutes: 'প্রশিক্ষণ প্রতিষ্ঠান',
  trades: 'ট্রেড',
  exams: 'পরীক্ষা',
  marks: 'পরীক্ষার নম্বর',
  attendance: 'দৈনিক হাজিরা',
  settings: 'সিস্টেম সেটিংস',
  users: 'ব্যবহারকারী',
  roles: 'রোল ও পারমিশন',
  trade_skill_modules: 'স্কিল মডিউল',
  trade_literacy_modules: 'লিটারেসি মডিউল',
  batch_calendar_progress: 'ক্যালেন্ডার অগ্রগতি',
};

function buildDefaultTitle(
  action: AuditAction,
  collectionName: string,
  targetLabel: string,
  count?: number
): string {
  const entityBn = COLLECTION_TITLE_BN[collectionName] || collectionName;
  if (action === 'create') return `নতুন ${entityBn} তৈরি: ${targetLabel}`;
  if (action === 'update') return `${entityBn} হালনাগাদ: ${targetLabel}`;
  if (action === 'delete') return `${entityBn} মুছে ফেলা হয়েছে: ${targetLabel}`;
  if (action === 'bulk_delete') {
    return `${entityBn} বাল্ক ডিলিট (${count ?? 0} টি রেকর্ড)`;
  }
  if (action === 'undo') return `পরিবর্তন ফেরত নেওয়া হয়েছে: ${targetLabel}`;
  if (action === 'restore') return `রেকর্ড পুনরুদ্ধার করা হয়েছে: ${targetLabel}`;
  if (action === 'export') return `ডাটা এক্সপোর্ট: ${targetLabel}`;
  if (action === 'security') return `নিরাপত্তা কার্যক্রম: ${targetLabel}`;
  return `${entityBn}: ${targetLabel}`;
}

function estimateJsonBytes(obj: unknown): number {
  try {
    const str = JSON.stringify(obj);
    return new TextEncoder().encode(str).length;
  } catch {
    return MAX_INLINE_LOG_BYTES + 1;
  }
}

function splitRelatedIntoChunks(
  items: AuditRelatedDoc[]
): AuditRelatedDoc[][] {
  const chunks: AuditRelatedDoc[][] = [];
  let current: AuditRelatedDoc[] = [];
  let currentBytes = 64;

  for (const item of items) {
    const cleanItem: AuditRelatedDoc = {
      collection: item.collection,
      id: item.id,
      data: sanitizeAuditValue(item.data),
    };
    const itemBytes = estimateJsonBytes(cleanItem);
    if (current.length > 0 && (currentBytes + itemBytes > MAX_CHUNK_BYTES || current.length >= 250)) {
      chunks.push(current);
      current = [];
      currentBytes = 64;
    }
    current.push(cleanItem);
    currentBytes += itemBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function buildBaseLogPayload(params: {
  action: AuditAction;
  module: AuditModule;
  collection: string;
  targetId: string;
  targetLabel: string;
  title: string;
  actor: { userId: string; user: string; userRole: string };
  changes?: AuditChange[];
  snapshot?: Record<string, unknown> | null;
  related?: AuditRelatedDoc[];
  count?: number;
  targetNames?: string[];
  snapshotComplete?: boolean;
  snapshotChunkCount?: number;
  refLogId?: string;
  details?: string;
}): Omit<ActivityLog, 'id'> {
  const now = Date.now();
  return sanitizeAuditValue({
    action: params.action,
    module: params.module,
    collection: params.collection,
    targetId: params.targetId,
    targetLabel: params.targetLabel,
    title: params.title,
    user: params.actor.user,
    userId: params.actor.userId,
    userRole: params.actor.userRole,
    changes: params.changes || [],
    snapshot: params.snapshot ?? null,
    related: params.related || [],
    ...(params.count !== undefined ? { count: params.count } : {}),
    ...(params.targetNames ? { targetNames: params.targetNames } : {}),
    ...(params.snapshotComplete !== undefined
      ? { snapshotComplete: params.snapshotComplete }
      : {}),
    ...(params.snapshotChunkCount !== undefined
      ? { snapshotChunkCount: params.snapshotChunkCount }
      : {}),
    ...(params.refLogId ? { refLogId: params.refLogId } : {}),
    reverted: false,
    createdAt: serverTimestamp(),
    // Legacy compatibility fields
    userName: params.actor.user,
    recordId: params.targetId,
    details: params.details || params.title,
    timestamp: now,
  }) as Omit<ActivityLog, 'id'>;
}

async function commitWriteOps(
  ops: Array<{ type: 'set' | 'delete'; collection: string; id: string; data?: Record<string, unknown> }>
): Promise<void> {
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) {
    const chunk = ops.slice(i, i + MAX_BATCH_OPS);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, op.collection, op.id);
      if (op.type === 'delete') {
        batch.delete(ref);
      } else {
        batch.set(ref, sanitizeAuditValue(op.data || {}));
      }
    }
    await batch.commit();
  }
}

/**
 * Atomically saves (create or update) a document AND writes its audit log in the same Firestore transaction.
 * For updates, only changed fields are recorded. If nothing changed, no redundant update log is written.
 */
export async function recordAuditedSave<T extends { id: string }>(params: {
  collectionName: string;
  item: T;
  module?: AuditModule;
  title?: string;
  targetLabel?: string;
  actor?: AuditActor;
}): Promise<T> {
  const { collectionName, item } = params;
  const cleanItem = sanitizeAuditValue(item) as Record<string, unknown>;
  const targetRef = doc(db, collectionName, item.id);
  const logRef = doc(collection(db, 'activityLogs'));
  const actor = resolveAuditActor(params.actor);
  const moduleName = params.module || inferCollectionModule(collectionName);

  const saved = await runTransaction(db, async (tx) => {
    const existingSnap = await tx.get(targetRef);
    const exists = existingSnap.exists();
    const beforeData = exists ? (existingSnap.data() as Record<string, unknown>) : null;

    const mergedData = exists
      ? ({ ...beforeData, ...cleanItem } as Record<string, unknown>)
      : cleanItem;

    if (exists) {
      const changes = computeFieldDiff(beforeData, mergedData);
      tx.set(targetRef, mergedData, { merge: true });

      if (changes.length > 0) {
        const label =
          params.targetLabel ||
          extractTargetLabel(collectionName, mergedData, item.id);
        const title =
          params.title ||
          buildDefaultTitle('update', collectionName, label);

        const logPayload = buildBaseLogPayload({
          action: 'update',
          module: moduleName,
          collection: collectionName,
          targetId: item.id,
          targetLabel: label,
          title,
          actor,
          changes,
          snapshot: null,
          related: [],
        });
        tx.set(logRef, logPayload);
      }
    } else {
      tx.set(targetRef, mergedData);
      const label =
        params.targetLabel ||
        extractTargetLabel(collectionName, mergedData, item.id);
      const title =
        params.title ||
        buildDefaultTitle('create', collectionName, label);

      const cleanSnap = sanitizeAuditValue(mergedData);
      const snapBytes = estimateJsonBytes(cleanSnap);
      const logPayload = buildBaseLogPayload({
        action: 'create',
        module: moduleName,
        collection: collectionName,
        targetId: item.id,
        targetLabel: label,
        title,
        actor,
        changes: [],
        snapshot: snapBytes <= MAX_INLINE_LOG_BYTES ? cleanSnap : null,
        snapshotComplete: snapBytes <= MAX_INLINE_LOG_BYTES,
        related: [],
      });
      tx.set(logRef, logPayload);
    }

    return mergedData as T;
  });

  return saved;
}

/**
 * Captures full snapshot + related dependent records, deletes them atomically in batches,
 * and writes an audit log entry (splitting large `related` payloads into `snapshots` subcollection if needed).
 */
export async function recordAuditedDelete(params: {
  collectionName: string;
  docId: string;
  module?: AuditModule;
  title?: string;
  targetLabel?: string;
  relatedDocs?: AuditRelatedDoc[];
  postUpdates?: Array<{ collection: string; id: string; data: Record<string, unknown> }>;
  actor?: AuditActor;
}): Promise<void> {
  const { collectionName, docId } = params;
  const actor = resolveAuditActor(params.actor);
  const moduleName = params.module || inferCollectionModule(collectionName);

  const targetRef = doc(db, collectionName, docId);
  const snap = await getDoc(targetRef);
  const existingData = snap.exists()
    ? (sanitizeAuditValue({ id: snap.id, ...snap.data() }) as Record<string, unknown>)
    : null;

  const cleanRelated: AuditRelatedDoc[] = (params.relatedDocs || []).map((r) => ({
    collection: r.collection,
    id: r.id,
    data: sanitizeAuditValue(r.data),
  }));

  const label =
    params.targetLabel ||
    extractTargetLabel(collectionName, existingData, docId);
  const title =
    params.title || buildDefaultTitle('delete', collectionName, label);

  const logRef = doc(collection(db, 'activityLogs'));

  // Test inline size
  const inlineCandidate = buildBaseLogPayload({
    action: 'delete',
    module: moduleName,
    collection: collectionName,
    targetId: docId,
    targetLabel: label,
    title,
    actor,
    changes: [],
    snapshot: existingData,
    related: cleanRelated,
    snapshotComplete: Boolean(existingData),
  });

  const inlineBytes = estimateJsonBytes(inlineCandidate);
  let finalLogPayload = inlineCandidate;
  let chunkDocs: AuditRelatedDoc[][] = [];

  if (inlineBytes > MAX_INLINE_LOG_BYTES && cleanRelated.length > 0) {
    chunkDocs = splitRelatedIntoChunks(cleanRelated);
    finalLogPayload = buildBaseLogPayload({
      action: 'delete',
      module: moduleName,
      collection: collectionName,
      targetId: docId,
      targetLabel: label,
      title,
      actor,
      changes: [],
      snapshot:
        existingData && estimateJsonBytes(existingData) <= MAX_INLINE_LOG_BYTES
          ? existingData
          : null,
      related: [],
      snapshotComplete: Boolean(existingData),
      snapshotChunkCount: chunkDocs.length,
    });
  }

  // First batch: write log entry, delete main document, and apply postUpdates / first deletions
  const firstBatch = writeBatch(db);
  firstBatch.set(logRef, finalLogPayload);
  if (snap.exists()) {
    firstBatch.delete(targetRef);
  }

  let opsInFirstBatch = 2;
  const remainingOps: Array<{
    type: 'set' | 'delete';
    collection: string;
    id: string;
    data?: Record<string, unknown>;
  }> = [];

  // Write snapshot chunks if split
  chunkDocs.forEach((items, idx) => {
    const chunkId = `chunk_${String(idx + 1).padStart(4, '0')}`;
    const chunkPayload = {
      index: idx,
      userId: actor.userId,
      items,
      createdAt: Date.now(),
    };
    if (opsInFirstBatch < MAX_BATCH_OPS) {
      firstBatch.set(
        doc(db, 'activityLogs', logRef.id, 'snapshots', chunkId),
        chunkPayload
      );
      opsInFirstBatch++;
    } else {
      remainingOps.push({
        type: 'set',
        collection: `activityLogs/${logRef.id}/snapshots`,
        id: chunkId,
        data: chunkPayload,
      });
    }
  });

  // Delete related documents
  for (const rel of cleanRelated) {
    if (opsInFirstBatch < MAX_BATCH_OPS) {
      firstBatch.delete(doc(db, rel.collection, rel.id));
      opsInFirstBatch++;
    } else {
      remainingOps.push({
        type: 'delete',
        collection: rel.collection,
        id: rel.id,
      });
    }
  }

  // Apply postUpdates (e.g., unassigning instituteId/tradeId on linked batches)
  for (const upd of params.postUpdates || []) {
    if (opsInFirstBatch < MAX_BATCH_OPS) {
      firstBatch.set(
        doc(db, upd.collection, upd.id),
        sanitizeAuditValue(upd.data),
        { merge: true }
      );
      opsInFirstBatch++;
    } else {
      remainingOps.push({
        type: 'set',
        collection: upd.collection,
        id: upd.id,
        data: upd.data,
      });
    }
  }

  await firstBatch.commit();

  if (remainingOps.length > 0) {
    for (let i = 0; i < remainingOps.length; i += MAX_BATCH_OPS) {
      const slice = remainingOps.slice(i, i + MAX_BATCH_OPS);
      const batch = writeBatch(db);
      for (const op of slice) {
        if (op.collection.includes('/')) {
          const parts = op.collection.split('/');
          const ref = doc(db, parts[0], parts[1], parts[2], op.id);
          batch.set(ref, sanitizeAuditValue(op.data || {}));
        } else if (op.type === 'delete') {
          batch.delete(doc(db, op.collection, op.id));
        } else {
          batch.set(doc(db, op.collection, op.id), sanitizeAuditValue(op.data || {}), {
            merge: true,
          });
        }
      }
      await batch.commit();
    }
  }
}

/**
 * Bulk deletes documents with an audit log entry.
 * Stores up to first 50 targetNames and snapshots when within size limits;
 * sets snapshotComplete: false for very large wipes or factory reset.
 */
export async function recordAuditedBulkDelete(params: {
  collectionName: string;
  docs: Array<{ id: string; data: Record<string, unknown> }>;
  relatedDocs?: AuditRelatedDoc[];
  module?: AuditModule;
  title?: string;
  targetLabel?: string;
  snapshotComplete?: boolean;
  skipDeletes?: boolean;
  totalCountOverride?: number;
  actor?: AuditActor;
}): Promise<number> {
  const { collectionName, docs } = params;
  const relatedDocs = params.relatedDocs || [];
  const totalCount =
    params.totalCountOverride !== undefined
      ? params.totalCountOverride
      : docs.length + relatedDocs.length;

  const actor = resolveAuditActor(params.actor);
  const moduleName = params.module || inferCollectionModule(collectionName);
  const targetNames = docs
    .slice(0, 50)
    .map((d) => extractTargetLabel(collectionName, d.data, d.id))
    .filter(Boolean);

  const label =
    params.targetLabel ||
    `${COLLECTION_TITLE_BN[collectionName] || collectionName} (${totalCount} টি)`;
  const title =
    params.title ||
    buildDefaultTitle('bulk_delete', collectionName, label, totalCount);

  const shouldStoreSnapshot =
    params.snapshotComplete !== false &&
    docs.length + relatedDocs.length > 0 &&
    docs.length + relatedDocs.length <= MAX_BULK_SNAPSHOT_DOCS;

  const allItemsToSnapshot: AuditRelatedDoc[] = shouldStoreSnapshot
    ? [
        ...docs.map((d) => ({
          collection: collectionName,
          id: d.id,
          data: sanitizeAuditValue(d.data),
        })),
        ...relatedDocs.map((r) => ({
          collection: r.collection,
          id: r.id,
          data: sanitizeAuditValue(r.data),
        })),
      ]
    : [];

  const logRef = doc(collection(db, 'activityLogs'));
  let snapshotComplete = shouldStoreSnapshot;
  let chunkDocs: AuditRelatedDoc[][] = [];
  let inlineRelated: AuditRelatedDoc[] = allItemsToSnapshot;

  if (shouldStoreSnapshot) {
    const candidatePayload = buildBaseLogPayload({
      action: 'bulk_delete',
      module: moduleName,
      collection: collectionName,
      targetId: 'bulk',
      targetLabel: label,
      title,
      actor,
      count: totalCount,
      targetNames,
      snapshot: null,
      related: inlineRelated,
      snapshotComplete: true,
    });

    if (estimateJsonBytes(candidatePayload) > MAX_INLINE_LOG_BYTES) {
      chunkDocs = splitRelatedIntoChunks(allItemsToSnapshot);
      inlineRelated = [];
      if (chunkDocs.length > 40) {
        // Extremely huge payload even when chunked -> mark incomplete
        chunkDocs = [];
        snapshotComplete = false;
      }
    }
  }

  const finalLogPayload = buildBaseLogPayload({
    action: 'bulk_delete',
    module: moduleName,
    collection: collectionName,
    targetId: 'bulk',
    targetLabel: label,
    title,
    actor,
    count: totalCount,
    targetNames,
    snapshot: null,
    related: inlineRelated,
    snapshotComplete,
    snapshotChunkCount: chunkDocs.length > 0 ? chunkDocs.length : undefined,
  });

  // Commit log + optional chunks
  const firstBatch = writeBatch(db);
  firstBatch.set(logRef, finalLogPayload);
  chunkDocs.forEach((items, idx) => {
    if (idx < MAX_BATCH_OPS - 2) {
      const chunkId = `chunk_${String(idx + 1).padStart(4, '0')}`;
      firstBatch.set(doc(db, 'activityLogs', logRef.id, 'snapshots', chunkId), {
        index: idx,
        userId: actor.userId,
        items,
        createdAt: Date.now(),
      });
    }
  });
  await firstBatch.commit();

  if (chunkDocs.length > MAX_BATCH_OPS - 2) {
    for (let i = MAX_BATCH_OPS - 2; i < chunkDocs.length; i++) {
      const chunkId = `chunk_${String(i + 1).padStart(4, '0')}`;
      const batch = writeBatch(db);
      batch.set(doc(db, 'activityLogs', logRef.id, 'snapshots', chunkId), {
        index: i,
        userId: actor.userId,
        items: chunkDocs[i],
        createdAt: Date.now(),
      });
      await batch.commit();
    }
  }

  if (!params.skipDeletes) {
    const deleteOps: Array<{
      type: 'delete';
      collection: string;
      id: string;
    }> = [
      ...docs.map((d) => ({
        type: 'delete' as const,
        collection: collectionName,
        id: d.id,
      })),
      ...relatedDocs.map((r) => ({
        type: 'delete' as const,
        collection: r.collection,
        id: r.id,
      })),
    ];
    await commitWriteOps(deleteOps);
  }

  return totalCount;
}

/**
 * Batch saves attendance records while recording a single structured audit entry
 * showing which trainees' attendance changed (or total newly recorded).
 */
export async function recordAuditedAttendanceBatch(params: {
  records: Array<Record<string, unknown> & { id: string; traineeId: string; status: string; date: string; batchId: string }>;
  traineeNamesMap?: Record<string, string>;
  batchName?: string;
  actor?: AuditActor;
}): Promise<number> {
  const { records, traineeNamesMap = {} } = params;
  if (!records || records.length === 0) return 0;

  const actor = resolveAuditActor(params.actor);
  const firstRec = records[0];

  // Fetch existing attendance records for that batch & date to compute real diffs
  const existingMap = new Map<string, Record<string, unknown>>();
  try {
    const q = query(
      collection(db, 'attendance'),
      where('batchId', '==', firstRec.batchId),
      where('date', '==', firstRec.date)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => existingMap.set(d.id, d.data() as Record<string, unknown>));
  } catch {
    // fallback: check individual docs if query fails
    await Promise.all(
      records.map(async (r) => {
        try {
          const s = await getDoc(doc(db, 'attendance', r.id));
          if (s.exists()) existingMap.set(s.id, s.data() as Record<string, unknown>);
        } catch {
          // ignore
        }
      })
    );
  }

  const changes: AuditChange[] = [];
  let createdCount = 0;

  for (const rec of records) {
    const prev = existingMap.get(rec.id);
    const traineeLabel = traineeNamesMap[rec.traineeId] || rec.traineeId;
    if (!prev) {
      createdCount++;
      changes.push({
        field: `trainee_${rec.traineeId}`,
        label: traineeLabel,
        before: null,
        after: rec.status,
      });
    } else if (prev.status !== rec.status || (prev.remarks || '') !== (rec.remarks || '')) {
      changes.push({
        field: `trainee_${rec.traineeId}`,
        label: traineeLabel,
        before: prev.status || null,
        after: rec.status,
      });
    }
  }

  const isPureCreate = existingMap.size === 0 && createdCount > 0;
  const presentCount = records.filter((r) => r.status === 'Present').length;
  const absentCount = records.filter((r) => r.status === 'Absent').length;
  const leaveCount = records.filter((r) => r.status === 'Leave').length;
  const batchTitle = params.batchName || firstRec.batchId;

  const logRef = doc(collection(db, 'activityLogs'));
  const title = isPureCreate
    ? `দৈনিক হাজিরা সংরক্ষণ: ${batchTitle} (${firstRec.date})`
    : `দৈনিক হাজিরা হালনাগাদ: ${batchTitle} (${firstRec.date})`;

  const logPayload = buildBaseLogPayload({
    action: isPureCreate ? 'create' : 'update',
    module: 'attendance',
    collection: 'attendance',
    targetId: `${firstRec.batchId}_${firstRec.date}`,
    targetLabel: `${batchTitle} (${firstRec.date})`,
    title,
    actor,
    changes: changes.slice(0, 100),
    count: records.length,
    snapshot: isPureCreate
      ? {
          batchId: firstRec.batchId,
          batchName: batchTitle,
          date: firstRec.date,
          total: records.length,
          presentCount,
          absentCount,
          leaveCount,
        }
      : null,
    details: `উপস্থিত: ${presentCount}, অনুপস্থিত: ${absentCount}, ছুটি: ${leaveCount}`,
  });

  // Commit in chunks of MAX_BATCH_OPS; include audit log if any change or new record occurred
  const shouldWriteLog = isPureCreate || changes.length > 0;
  for (let i = 0; i < records.length; i += MAX_BATCH_OPS - 1) {
    const chunk = records.slice(i, i + MAX_BATCH_OPS - 1);
    const batch = writeBatch(db);
    if (i === 0 && shouldWriteLog) {
      batch.set(logRef, logPayload);
    }
    for (const rec of chunk) {
      batch.set(doc(db, 'attendance', rec.id), sanitizeAuditValue(rec), { merge: true });
    }
    await batch.commit();
  }

  return records.length;
}

/**
 * Batch saves exam marks while recording a single structured audit entry
 * showing only changed marks.
 */
export async function recordAuditedMarksBatch(params: {
  examId: string;
  examName?: string;
  records: Array<Record<string, unknown> & { id: string; traineeId: string; marksObtained: number; result: string; grade: string }>;
  traineeNamesMap?: Record<string, string>;
  actor?: AuditActor;
}): Promise<number> {
  const { examId, records, traineeNamesMap = {} } = params;
  if (!records || records.length === 0) return 0;

  const actor = resolveAuditActor(params.actor);
  const existingMap = new Map<string, Record<string, unknown>>();

  try {
    const q = query(collection(db, 'marks'), where('examId', '==', examId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => existingMap.set(d.id, d.data() as Record<string, unknown>));
  } catch {
    await Promise.all(
      records.map(async (r) => {
        try {
          const s = await getDoc(doc(db, 'marks', r.id));
          if (s.exists()) existingMap.set(s.id, s.data() as Record<string, unknown>);
        } catch {
          // ignore
        }
      })
    );
  }

  const changes: AuditChange[] = [];
  const toWrite: typeof records = [];

  for (const rec of records) {
    const prev = existingMap.get(rec.id);
    const traineeLabel = traineeNamesMap[rec.traineeId] || rec.traineeId;
    if (!prev) {
      toWrite.push(rec);
      changes.push({
        field: `mark_${rec.traineeId}`,
        label: traineeLabel,
        before: null,
        after: `${rec.marksObtained} (${rec.result})`,
      });
    } else if (
      prev.marksObtained !== rec.marksObtained ||
      prev.result !== rec.result ||
      prev.grade !== rec.grade
    ) {
      toWrite.push(rec);
      changes.push({
        field: `mark_${rec.traineeId}`,
        label: traineeLabel,
        before: `${prev.marksObtained ?? 0} (${prev.result ?? '-'})`,
        after: `${rec.marksObtained} (${rec.result})`,
      });
    }
  }

  if (toWrite.length === 0) return 0;

  const isPureCreate = existingMap.size === 0;
  const label = params.examName || examId;
  const logRef = doc(collection(db, 'activityLogs'));
  const logPayload = buildBaseLogPayload({
    action: isPureCreate ? 'create' : 'update',
    module: 'exams',
    collection: 'marks',
    targetId: examId,
    targetLabel: label,
    title: isPureCreate
      ? `পরীক্ষার নম্বর এন্ট্রি: ${label}`
      : `পরীক্ষার নম্বর সংশোধন: ${label}`,
    actor,
    changes: changes.slice(0, 100),
    count: toWrite.length,
    snapshot: isPureCreate
      ? { examId, examName: label, totalMarksEntered: toWrite.length }
      : null,
  });

  for (let i = 0; i < toWrite.length; i += MAX_BATCH_OPS - 1) {
    const chunk = toWrite.slice(i, i + MAX_BATCH_OPS - 1);
    const batch = writeBatch(db);
    if (i === 0) {
      batch.set(logRef, logPayload);
    }
    for (const rec of chunk) {
      batch.set(doc(db, 'marks', rec.id), sanitizeAuditValue(rec), { merge: true });
    }
    await batch.commit();
  }

  return toWrite.length;
}

/**
 * Writes a standalone structured audit log (e.g., export, security warning, bulk import).
 */
export async function recordSimpleAuditLog(params: {
  action: AuditAction;
  module: AuditModule;
  collectionName?: string;
  targetId?: string;
  targetLabel?: string;
  title: string;
  details?: string;
  count?: number;
  targetNames?: string[];
  snapshotComplete?: boolean;
  refLogId?: string;
  actor?: AuditActor;
}): Promise<string> {
  const actor = resolveAuditActor(params.actor);
  const logRef = doc(collection(db, 'activityLogs'));

  const payload = buildBaseLogPayload({
    action: params.action,
    module: params.module,
    collection: params.collectionName || params.module,
    targetId: params.targetId || 'system',
    targetLabel: params.targetLabel || params.title,
    title: params.title,
    actor,
    changes: [],
    snapshot: null,
    related: [],
    count: params.count,
    targetNames: params.targetNames,
    snapshotComplete: params.snapshotComplete,
    refLogId: params.refLogId,
    details: params.details,
  });

  const batch = writeBatch(db);
  batch.set(logRef, payload);
  await batch.commit();
  return logRef.id;
}

/**
 * Loads snapshot chunks from `/activityLogs/{logId}/snapshots` if a log was chunked.
 */
export async function loadLogSnapshotChunks(logId: string): Promise<AuditRelatedDoc[]> {
  const snap = await getDocs(collection(db, 'activityLogs', logId, 'snapshots'));
  const docs = snap.docs
    .map((d) => d.data() as { index?: number; items?: AuditRelatedDoc[] })
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const combined: AuditRelatedDoc[] = [];
  for (const chunk of docs) {
    if (Array.isArray(chunk.items)) {
      combined.push(...chunk.items);
    }
  }
  return combined;
}
