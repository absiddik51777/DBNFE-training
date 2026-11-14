import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  AuditActor,
  captureAuditLocationForAction,
  getFieldLabelBn,
  loadLogSnapshotChunks,
  resolveAuditActor,
  sanitizeAuditValue,
} from './auditLog';
import { dataService } from './dataService';
import type { ActivityLog, AuditRelatedDoc } from '../types';

const MAX_BATCH_OPS = 440;

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

function formatReadableShort(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'খালি';
  if (typeof val === 'boolean') return val ? 'হ্যাঁ' : 'না';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export interface RestoreResult {
  restoredCount: number;
  skippedCount: number;
  collections: string[];
}

/**
 * Undo a logged `update` operation inside a Firestore transaction.
 * Verifies live fields still match `after`; aborts with conflict details if another edit occurred.
 */
export async function undoChange(
  log: ActivityLog,
  actorInput?: AuditActor
): Promise<{ revertedFields: number }> {
  if (!log || log.action !== 'update') {
    throw new Error('শুধুমাত্র পরিবর্তন (Update) লগ ফেরত নেওয়া যায়।');
  }
  if (log.reverted) {
    throw new Error('এই পরিবর্তনটি ইতোমধ্যে ফেরত নেওয়া হয়েছে।');
  }
  if (log.settled) {
    throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
  }
  if (!log.collection || !log.targetId || !Array.isArray(log.changes) || log.changes.length === 0) {
    throw new Error('এই লগে ফেরত নেওয়ার মতো পর্যাপ্ত পরিবর্তনের তথ্য নেই।');
  }

  const auditLocation = await captureAuditLocationForAction('undo');
  const actor = resolveAuditActor(actorInput);
  const logRef = doc(db, 'activityLogs', log.id);
  const newUndoLogRef = doc(collection(db, 'activityLogs'));

  // Special case 1: Composite batch attendance update (`trainee_${traineeId}`)
  const isBatchAttendance =
    log.collection === 'attendance' &&
    log.changes.every((c) => c.field.startsWith('trainee_'));

  if (isBatchAttendance) {
    const lastUnderscore = log.targetId.lastIndexOf('_');
    if (lastUnderscore <= 0) {
      throw new Error('হাজিরা ব্যাচ ও তারিখ শনাক্ত করা যায়নি।');
    }
    const batchId = log.targetId.slice(0, lastUnderscore);
    const date = log.targetId.slice(lastUnderscore + 1);

    const traineeIds = log.changes.map((c) => c.field.replace(/^trainee_/, ''));
    const docIdByTrainee = new Map<string, string>();
    try {
      const q = query(
        collection(db, 'attendance'),
        where('batchId', '==', batchId),
        where('date', '==', date)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const tid = String(d.data().traineeId || '');
        if (tid) docIdByTrainee.set(tid, d.id);
      });
    } catch {
      // fallback to deterministic composite key
    }

    await runTransaction(db, async (tx) => {
      const liveLogSnap = await tx.get(logRef);
      if (!liveLogSnap.exists()) {
        throw new Error('মূল অডিট লগটি খুঁজে পাওয়া যায়নি।');
      }
      if (liveLogSnap.data().reverted === true) {
        throw new Error('এই পরিবর্তনটি ইতোমধ্যে ফেরত নেওয়া হয়েছে।');
      }
      if (liveLogSnap.data().settled === true) {
        throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
      }

      const targetRefs = traineeIds.map((tid) => {
        const docId = docIdByTrainee.get(tid) || `ATT_${batchId}_${date}_${tid}`;
        return { tid, ref: doc(db, 'attendance', docId) };
      });

      const snaps = await Promise.all(targetRefs.map((item) => tx.get(item.ref)));
      const conflicts: string[] = [];

      log.changes!.forEach((change, idx) => {
        const snap = snaps[idx];
        const liveStatus = snap.exists() ? snap.data().status ?? null : null;
        if (stableNormalize(liveStatus) !== stableNormalize(change.after)) {
          conflicts.push(
            `${change.label} (বর্তমান: ${formatReadableShort(liveStatus)}, লগে ছিল: ${formatReadableShort(change.after)})`
          );
        }
      });

      if (conflicts.length > 0) {
        throw new Error(
          `অন্য কেউ ইতোমধ্যে নিচের হাজিরা তথ্য পরিবর্তন করেছেন, তাই স্বয়ংক্রিয়ভাবে ফেরত নেওয়া হয়নি:\n• ${conflicts.join('\n• ')}`
        );
      }

      log.changes!.forEach((change, idx) => {
        const ref = targetRefs[idx].ref;
        if (change.before === null || change.before === undefined || change.before === '') {
          if (snaps[idx].exists()) {
            tx.delete(ref);
          }
        } else {
          tx.set(
            ref,
            {
              status: change.before,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
      });

      tx.update(logRef, {
        reverted: true,
        revertedBy: actor.user,
        revertedAt: serverTimestamp(),
      });

      tx.set(newUndoLogRef, {
        action: 'undo',
        module: log.module || 'attendance',
        collection: 'attendance',
        targetId: log.targetId,
        targetLabel: log.targetLabel || log.targetId,
        title: `পরিবর্তন ফেরত: ${log.targetLabel || log.title || 'হাজিরা'}`,
        user: actor.user,
        userId: actor.userId,
        userRole: actor.userRole,
        changes: log.changes!.map((c) => ({
          field: c.field,
          label: c.label,
          before: c.after,
          after: c.before,
        })),
        snapshot: null,
        related: [],
        refLogId: log.id,
        ...(auditLocation ? { location: auditLocation } : {}),
        reverted: false,
        settled: false,
        settledBy: null,
        settledByName: null,
        settledAt: null,
        settleNote: null,
        createdAt: serverTimestamp(),
        userName: actor.user,
        recordId: log.targetId,
        details: `অডিট লগ ${log.id} এর পরিবর্তন পূর্বাবস্থায় ফেরত নেওয়া হয়েছে`,
      });
    });

    dataService.broadcastSync('attendance');
    return { revertedFields: log.changes.length };
  }

  // Special case 2: Composite batch exam marks update (`mark_${traineeId}`)
  const isBatchMarks =
    log.collection === 'marks' &&
    log.changes.every((c) => c.field.startsWith('mark_'));

  if (isBatchMarks) {
    const examId = log.targetId;
    const traineeIds = log.changes.map((c) => c.field.replace(/^mark_/, ''));
    const docIdByTrainee = new Map<string, string>();
    try {
      const q = query(collection(db, 'marks'), where('examId', '==', examId));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const tid = String(d.data().traineeId || '');
        if (tid) docIdByTrainee.set(tid, d.id);
      });
    } catch {
      // fallback to deterministic composite key
    }

    await runTransaction(db, async (tx) => {
      const liveLogSnap = await tx.get(logRef);
      if (!liveLogSnap.exists()) {
        throw new Error('মূল অডিট লগটি খুঁজে পাওয়া যায়নি।');
      }
      if (liveLogSnap.data().reverted === true) {
        throw new Error('এই পরিবর্তনটি ইতোমধ্যে ফেরত নেওয়া হয়েছে।');
      }
      if (liveLogSnap.data().settled === true) {
        throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
      }

      const examRef = doc(db, 'exams', examId);
      const examSnap = await tx.get(examRef);
      const totalMarks = examSnap.exists() ? Number(examSnap.data().totalMarks || 100) : 100;
      const passMarks = examSnap.exists() ? Number(examSnap.data().passMarks || 40) : 40;

      const targetRefs = traineeIds.map((tid) => {
        const docId = docIdByTrainee.get(tid) || `MRK-${examId}_${tid}`;
        return { tid, ref: doc(db, 'marks', docId) };
      });
      const snaps = await Promise.all(targetRefs.map((item) => tx.get(item.ref)));

      const conflicts: string[] = [];
      log.changes!.forEach((change, idx) => {
        const snap = snaps[idx];
        const liveVal = snap.exists()
          ? `${snap.data().marksObtained ?? 0} (${snap.data().result ?? '-'})`
          : null;
        if (stableNormalize(liveVal) !== stableNormalize(change.after)) {
          conflicts.push(
            `${change.label} (বর্তমান: ${formatReadableShort(liveVal)}, লগে ছিল: ${formatReadableShort(change.after)})`
          );
        }
      });

      if (conflicts.length > 0) {
        throw new Error(
          `অন্য কেউ ইতোমধ্যে নিচের নম্বরগুলো পরিবর্তন করেছেন, তাই ফেরত নেওয়া হয়নি:\n• ${conflicts.join('\n• ')}`
        );
      }

      log.changes!.forEach((change, idx) => {
        const ref = targetRefs[idx].ref;
        if (change.before === null || change.before === undefined || change.before === '') {
          if (snaps[idx].exists()) {
            tx.delete(ref);
          }
          return;
        }
        const match = String(change.before).match(/^(\d+(?:\.\d+)?)\s*\(([^)]+)\)$/);
        if (!match) {
          throw new Error(`নম্বরের পূর্ববর্তী ফরম্যাট পার্স করা যায়নি (${change.label})।`);
        }
        const marksObtained = Number(match[1]);
        const resultStr = match[2];
        const percentage =
          resultStr === 'Absent' || totalMarks <= 0
            ? 0
            : Math.round((marksObtained / totalMarks) * 100);
        let grade = '-';
        if (resultStr !== 'Absent') {
          if (percentage >= 80) grade = 'A+';
          else if (percentage >= 70) grade = 'A';
          else if (percentage >= 60) grade = 'A-';
          else if (percentage >= 50) grade = 'B';
          else if (marksObtained >= passMarks) grade = 'C';
          else grade = 'F';
        }
        tx.set(
          ref,
          {
            marksObtained,
            percentage,
            grade,
            result: resultStr,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      });

      tx.update(logRef, {
        reverted: true,
        revertedBy: actor.user,
        revertedAt: serverTimestamp(),
      });

      tx.set(newUndoLogRef, {
        action: 'undo',
        module: log.module || 'exams',
        collection: 'marks',
        targetId: log.targetId,
        targetLabel: log.targetLabel || log.targetId,
        title: `পরিবর্তন ফেরত: ${log.targetLabel || log.title || 'পরীক্ষার নম্বর'}`,
        user: actor.user,
        userId: actor.userId,
        userRole: actor.userRole,
        changes: log.changes!.map((c) => ({
          field: c.field,
          label: c.label,
          before: c.after,
          after: c.before,
        })),
        snapshot: null,
        related: [],
        refLogId: log.id,
        ...(auditLocation ? { location: auditLocation } : {}),
        reverted: false,
        settled: false,
        settledBy: null,
        settledByName: null,
        settledAt: null,
        settleNote: null,
        createdAt: serverTimestamp(),
        userName: actor.user,
        recordId: log.targetId,
        details: `অডিট লগ ${log.id} এর নম্বর পরিবর্তন পূর্বাবস্থায় ফেরত নেওয়া হয়েছে`,
      });
    });

    dataService.broadcastSync('marks');
    return { revertedFields: log.changes.length };
  }

  // Standard single-document update undo
  const targetRef = doc(db, log.collection, log.targetId);

  await runTransaction(db, async (tx) => {
    const [liveLogSnap, targetSnap] = await Promise.all([
      tx.get(logRef),
      tx.get(targetRef),
    ]);

    if (!liveLogSnap.exists()) {
      throw new Error('মূল অডিট লগটি খুঁজে পাওয়া যায়নি।');
    }
    if (liveLogSnap.data().reverted === true) {
      throw new Error('এই পরিবর্তনটি ইতোমধ্যে ফেরত নেওয়া হয়েছে।');
    }
    if (liveLogSnap.data().settled === true) {
      throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
    }
    if (!targetSnap.exists()) {
      throw new Error(
        'মূল রেকর্ডটি আর ডাটাবেজে বিদ্যমান নেই। আগে রেকর্ডটি পুনরুদ্ধার করুন বা তালিকা রিফ্রেশ করুন।'
      );
    }

    const liveData = targetSnap.data() as Record<string, unknown>;
    const conflicts: string[] = [];

    for (const change of log.changes!) {
      const currentVal = liveData[change.field];
      if (stableNormalize(currentVal) !== stableNormalize(change.after)) {
        const label = change.label || getFieldLabelBn(change.field);
        conflicts.push(
          `${label} (বর্তমান: ${formatReadableShort(currentVal)}, লগে ছিল: ${formatReadableShort(change.after)})`
        );
      }
    }

    if (conflicts.length > 0) {
      throw new Error(
        `অন্য কেউ ইতোমধ্যে নিচের ক্ষেত্রগুলো পরিবর্তন করেছেন, তাই ওভাররাইট করা হয়নি:\n• ${conflicts.join('\n• ')}`
      );
    }

    const revertPatch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    for (const change of log.changes!) {
      if (change.before === undefined || change.before === null) {
        revertPatch[change.field] = deleteField();
      } else {
        revertPatch[change.field] = sanitizeAuditValue(change.before);
      }
    }

    tx.update(targetRef, revertPatch);

    tx.update(logRef, {
      reverted: true,
      revertedBy: actor.user,
      revertedAt: serverTimestamp(),
    });

    tx.set(newUndoLogRef, {
      action: 'undo',
      module: log.module || 'settings',
      collection: log.collection,
      targetId: log.targetId,
      targetLabel: log.targetLabel || log.targetId,
      title: `পরিবর্তন ফেরত: ${log.targetLabel || log.title || log.targetId}`,
      user: actor.user,
      userId: actor.userId,
      userRole: actor.userRole,
      changes: log.changes!.map((c) => ({
        field: c.field,
        label: c.label,
        before: c.after,
        after: c.before,
      })),
      snapshot: null,
      related: [],
      refLogId: log.id,
      ...(auditLocation ? { location: auditLocation } : {}),
      reverted: false,
      settled: false,
      settledBy: null,
      settledByName: null,
      settledAt: null,
      settleNote: null,
      createdAt: serverTimestamp(),
      userName: actor.user,
      recordId: log.targetId,
      details: `অডিট লগ ${log.id} থেকে ${log.changes!.length} টি ক্ষেত্র পূর্বাবস্থায় ফেরত নেওয়া হয়েছে`,
    });
  });

  dataService.broadcastSync(log.collection);
  if (log.collection === 'settings') {
    dataService.broadcastSync('settings');
  }
  return { revertedFields: log.changes.length };
}

/**
 * Restore deleted records from a `delete` or `bulk_delete` log entry (including `related` & chunks).
 * Skips any document ID that already exists in Firestore so newer records are never overwritten.
 */
export async function restoreRecord(
  log: ActivityLog,
  actorInput?: AuditActor
): Promise<RestoreResult> {
  if (!log || (log.action !== 'delete' && log.action !== 'bulk_delete')) {
    throw new Error('শুধুমাত্র মুছে ফেলা (Delete / Bulk Delete) লগ পুনরুদ্ধার করা যায়।');
  }
  if (log.reverted) {
    throw new Error('এই রেকর্ডটি ইতোমধ্যে পুনরুদ্ধার করা হয়েছে।');
  }
  if (log.settled) {
    throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
  }
  if (log.snapshotComplete === false) {
    throw new Error(
      'এই লগে সম্পূর্ণ স্ন্যাপশট সংরক্ষিত নেই। অনুগ্রহ করে ব্যাকআপ থেকে পুনরুদ্ধার করুন।'
    );
  }

  const auditLocation = await captureAuditLocationForAction('restore');
  const actor = resolveAuditActor(actorInput);
  const logRef = doc(db, 'activityLogs', log.id);
  const liveLogSnap = await getDoc(logRef);
  if (!liveLogSnap.exists()) {
    throw new Error('মূল অডিট লগটি খুঁজে পাওয়া যায়নি।');
  }
  if (liveLogSnap.data().reverted === true) {
    throw new Error('এই রেকর্ডটি ইতোমধ্যে পুনরুদ্ধার করা হয়েছে।');
  }
  if (liveLogSnap.data().settled === true) {
    throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
  }

  // Assemble all records from main snapshot + inline related + chunked subcollection
  const rawDocs: AuditRelatedDoc[] = [];
  if (
    log.action === 'delete' &&
    log.snapshot &&
    typeof log.snapshot === 'object' &&
    log.collection &&
    log.targetId
  ) {
    rawDocs.push({
      collection: log.collection,
      id: log.targetId,
      data: sanitizeAuditValue({ ...log.snapshot, id: log.targetId }),
    });
  }
  if (Array.isArray(log.related)) {
    for (const rel of log.related) {
      if (rel?.collection && rel?.id && rel?.data) {
        rawDocs.push({
          collection: rel.collection,
          id: rel.id,
          data: sanitizeAuditValue({ ...rel.data, id: rel.id }),
        });
      }
    }
  }
  if ((log.snapshotChunkCount ?? 0) > 0) {
    const chunked = await loadLogSnapshotChunks(log.id);
    for (const rel of chunked) {
      if (rel?.collection && rel?.id && rel?.data) {
        rawDocs.push({
          collection: rel.collection,
          id: rel.id,
          data: sanitizeAuditValue({ ...rel.data, id: rel.id }),
        });
      }
    }
  }

  // Deduplicate by collection + id
  const uniqueMap = new Map<string, AuditRelatedDoc>();
  for (const item of rawDocs) {
    const key = `${item.collection}::${item.id}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }
  const candidates = Array.from(uniqueMap.values());

  if (candidates.length === 0) {
    throw new Error('পুনরুদ্ধার করার মতো কোনো সংরক্ষিত স্ন্যাপশট পাওয়া যায়নি।');
  }

  // Check existence before writing (never overwrite existing doc IDs)
  const toCreate: AuditRelatedDoc[] = [];
  let skippedCount = 0;

  const checkChunkSize = 40;
  for (let i = 0; i < candidates.length; i += checkChunkSize) {
    const slice = candidates.slice(i, i + checkChunkSize);
    const snaps = await Promise.all(
      slice.map((item) => getDoc(doc(db, item.collection, item.id)))
    );
    snaps.forEach((snap, idx) => {
      if (snap.exists()) {
        skippedCount++;
      } else {
        toCreate.push(slice[idx]);
      }
    });
  }

  const touchedCollections = new Set<string>();
  const restoreLogRef = doc(collection(db, 'activityLogs'));

  const restoreLogPayload = {
    action: 'restore',
    module: log.module || 'settings',
    collection: log.collection || log.module || 'system',
    targetId: log.targetId || 'bulk',
    targetLabel: log.targetLabel || log.title || 'পুনরুদ্ধার',
    title: `পুনরুদ্ধার: ${log.targetLabel || log.title || 'মুছে ফেলা রেকর্ড'}`,
    user: actor.user,
    userId: actor.userId,
    userRole: actor.userRole,
    changes: [],
    snapshot: null,
    related: [],
    count: toCreate.length,
    targetNames: log.targetNames?.slice(0, 50) || [],
    refLogId: log.id,
    ...(auditLocation ? { location: auditLocation } : {}),
    reverted: false,
    settled: false,
    settledBy: null,
    settledByName: null,
    settledAt: null,
    settleNote: null,
    createdAt: serverTimestamp(),
    userName: actor.user,
    recordId: log.targetId || 'bulk',
    details:
      skippedCount > 0
        ? `${toCreate.length} টি রেকর্ড পুনরুদ্ধার করা হয়েছে এবং ${skippedCount} টি বিদ্যমান রেকর্ড স্কিপ করা হয়েছে`
        : `${toCreate.length} টি রেকর্ড পুনরুদ্ধার করা হয়েছে`,
  };

  if (toCreate.length === 0) {
    const batch = writeBatch(db);
    batch.update(logRef, {
      reverted: true,
      revertedBy: actor.user,
      revertedAt: serverTimestamp(),
    });
    batch.set(restoreLogRef, restoreLogPayload);
    await batch.commit();

    return {
      restoredCount: 0,
      skippedCount,
      collections: [],
    };
  }

  // Commit restored documents + revert flag + restore audit log in chunks <= 440 ops
  const chunkSize = MAX_BATCH_OPS - 2;
  for (let i = 0; i < toCreate.length; i += chunkSize) {
    const slice = toCreate.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const item of slice) {
      touchedCollections.add(item.collection);
      batch.set(doc(db, item.collection, item.id), sanitizeAuditValue(item.data));
    }

    const isLastChunk = i + chunkSize >= toCreate.length;
    if (isLastChunk) {
      batch.update(logRef, {
        reverted: true,
        revertedBy: actor.user,
        revertedAt: serverTimestamp(),
      });
      batch.set(restoreLogRef, restoreLogPayload);
    }

    await batch.commit();
  }

  for (const col of touchedCollections) {
    dataService.broadcastSync(col);
  }

  return {
    restoredCount: toCreate.length,
    skippedCount,
    collections: Array.from(touchedCollections),
  };
}

/**
 * Permanently settle an active audit log entry (`update`, `delete`, or `bulk_delete`)
 * inside a Firestore transaction so it can never be undone or restored.
 */
export async function settleEntry(
  logId: string,
  note?: string,
  actorInput?: AuditActor
): Promise<void> {
  const cleanLogId = (logId || '').trim();
  if (!cleanLogId) {
    throw new Error('অডিট লগ আইডি পাওয়া যায়নি।');
  }

  const auditLocation = await captureAuditLocationForAction('settle');
  const actor = resolveAuditActor(actorInput);
  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  const cleanNote = trimmedNote.length > 0 ? trimmedNote : null;

  const logRef = doc(db, 'activityLogs', cleanLogId);
  const newSettleLogRef = doc(collection(db, 'activityLogs'));

  await runTransaction(db, async (tx) => {
    const liveLogSnap = await tx.get(logRef);
    if (!liveLogSnap.exists()) {
      throw new Error('মূল অডিট লগটি খুঁজে পাওয়া যায়নি।');
    }

    const orig = liveLogSnap.data() as Record<string, unknown>;
    const origAction = String(orig.action || '');
    if (
      origAction !== 'update' &&
      origAction !== 'delete' &&
      origAction !== 'bulk_delete'
    ) {
      throw new Error('শুধুমাত্র পরিবর্তন বা মুছে ফেলা এন্ট্রি নিষ্পন্ন করা যায়।');
    }
    if (orig.reverted === true) {
      throw new Error('এই এন্ট্রিটি ইতোমধ্যে ফেরত নেওয়া বা পুনরুদ্ধার করা হয়েছে।');
    }
    if (orig.settled === true) {
      throw new Error('এই এন্ট্রি নিষ্পন্ন হয়ে গেছে।');
    }

    const targetId = String(orig.targetId || orig.recordId || cleanLogId);
    const targetLabel = String(orig.targetLabel || orig.title || origAction || cleanLogId);
    const moduleName = String(orig.module || 'settings');
    const collectionName = String(orig.collection || moduleName || 'settings');

    tx.update(logRef, {
      settled: true,
      settledBy: actor.userId,
      settledByName: actor.user,
      settledAt: serverTimestamp(),
      settleNote: cleanNote,
    });

    tx.set(newSettleLogRef, {
      action: 'settle',
      module: moduleName,
      collection: collectionName,
      targetId,
      targetLabel,
      title: `নিষ্পন্ন: ${orig.title || targetLabel}`,
      user: actor.user,
      userId: actor.userId,
      userRole: actor.userRole,
      changes: [],
      snapshot: null,
      related: [],
      refLogId: cleanLogId,
      ...(auditLocation ? { location: auditLocation } : {}),
      reverted: false,
      settled: false,
      settledBy: null,
      settledByName: null,
      settledAt: null,
      settleNote: null,
      createdAt: serverTimestamp(),
      userName: actor.user,
      recordId: targetId,
      details: cleanNote || `অডিট লগ ${cleanLogId} স্থায়ীভাবে নিষ্পন্ন করা হয়েছে`,
    });
  });
}
