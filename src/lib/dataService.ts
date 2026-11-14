import { db, auth } from './firebase';
import { handleFirestoreError } from './securityErrors';
import { 
  collection, 
  getDocs, 
  getDocsFromServer,
  getDoc,
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { 
  Institute, 
  Trade, 
  Batch, 
  Trainee, 
  AttendanceRecord, 
  Exam, 
  ExamMark, 
  UserProfile,
  Role,
  ActivityLog,
  SystemSettings
} from '../types';
import {
  recordAuditedSave,
  recordAuditedDelete,
  recordAuditedBulkDelete,
  recordAuditedAttendanceBatch,
  recordAuditedMarksBatch,
  recordSimpleAuditLog,
  AuditActor,
  AuditModule,
  AuditRelatedDoc,
} from './auditLog';
import { 
  BatchCalendarProgress, 
  DayCompletionStatus, 
  TradeSkillModule, 
  TradeLiteracyModule,
  BatchSkillModule, 
  BatchLiteracyModule,
  CalendarProgressLog 
} from '../types/calendar';
import { SHIKHON_92_DAYS } from '../data/shikhonCalendarData';
import { generateTradeSkillCurriculum, generateTradeLiteracyCurriculum } from '../data/tradeCurriculaData';
import {
  DEFAULT_INSTITUTES,
  DEFAULT_TRADES,
  DEFAULT_BATCHES,
  generate20TraineesForBatch,
  generateSampleAttendance
} from './demoTraineesSeed';
import { DEFAULT_ROLES, ALL_PERMISSION_KEYS } from './permissions';
import { toTimestampNumber } from './dateUtils';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  allowDataDeletion: false,
  deletionLockedReason: '',
  minAttendancePercentForCert: 75,
  passMarkPercent: 40,
  gradingRules: [
    { grade: 'A+', minPercent: 80 },
    { grade: 'A', minPercent: 70 },
    { grade: 'B', minPercent: 60 },
    { grade: 'C', minPercent: 50 },
    { grade: 'D', minPercent: 40 }
  ]
};

let cachedSystemSettings: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('bnfe_system_settings');
    if (saved) {
      cachedSystemSettings = { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {}
}

/**
 * Helper to delete a list of doc paths in chunks of 400 (Firestore limit is 500)
 */
async function batchDeleteDocuments(collectionName: string, docIds: string[]): Promise<number> {
  if (!docIds || docIds.length === 0) return 0;
  const chunkSize = 400;
  for (let i = 0; i < docIds.length; i += chunkSize) {
    const chunk = docIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, collectionName, id));
    }
    await batch.commit();
  }
  return docIds.length;
}


/**
 * Removes any undefined properties from an object so Cloud Firestore never errors on invalid values
 */
function sanitizeForFirestore(data: any): any {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore);
  
  const clean: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== undefined) {
      clean[key] = typeof val === 'object' && val !== null ? sanitizeForFirestore(val) : val;
    }
  }
  return clean;
}

/**
 * Normalizes document data coming from Cloud Firestore so missing fields or alternative names
 * never cause frontend runtime errors.
 */
function normalizeDoc<T extends { id: string }>(col: string, data: any, docId: string): T {
  const item: any = { ...data, id: data.id || docId };

  if (col === 'institutes') {
    item.name = item.name || item.instituteName || item.nameBn || item.nameEn || 'নামবিহীন প্রতিষ্ঠান';
    item.address = item.address || '';
    item.code = item.code || `INS-${item.id.slice(-4)}`;
    item.contactPerson = item.contactPerson || '';
    item.phone = item.phone || '';
    item.email = item.email || '';
    item.status = item.status || 'Active';
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'trades') {
    item.name = item.name || item.tradeName || item.nameBn || item.nameEn || 'নামবিহীন ট্রেড';
    item.nameEn = item.nameEn || '';
    item.code = item.code || item.tradeCode || `TRD-${item.id.slice(-4)}`;
    item.description = item.description || '';
    item.duration = item.duration || '৬ মাস (৩৬০ ঘণ্টা)';
    item.status = item.status || 'Active';
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'batches') {
    item.name = item.name || item.batchName || item.nameBn || 'নামবিহীন ব্যাচ';
    item.batchCode = item.batchCode || item.code || `BAT-${item.id.slice(-4)}`;
    item.instituteId = item.instituteId || item.institute || '';
    item.tradeId = item.tradeId || item.trade || '';
    item.fiscalYear = item.fiscalYear || '২০২৫-২০২৬';
    item.startDate = toTimestampNumber(item.startDate);
    item.endDate = toTimestampNumber(item.endDate);
    item.maxTrainees = Number(item.maxTrainees) || 30;
    item.status = item.status || 'Active';
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'trainees') {
    item.nameBn = item.nameBn || item.name || item.nameEn || '';
    item.nameEn = item.nameEn || item.name || item.nameBn || '';
    item.traineeId = item.traineeId || `TR-${item.id.slice(-4)}`;
    item.registrationNumber = item.registrationNumber || `REG-${item.id.slice(-4)}`;
    item.instituteId = item.instituteId || '';
    item.tradeId = item.tradeId || '';
    item.batchId = item.batchId || '';
    item.status = item.status || 'Active';
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'attendance') {
    item.date = item.date || new Date().toISOString().slice(0, 10);
    item.status = item.status || 'Present';
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'roles') {
    item.name = item.name || 'Unnamed Role';
    item.nameBn = item.nameBn || item.name;
    item.code = item.code || (item.name ? item.name.toLowerCase().replace(/\s+/g, '_') : item.id);
    item.description = item.description || '';
    item.isSystem = Boolean(item.isSystem);
    item.permissions = Array.isArray(item.permissions) ? item.permissions : [];
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'users') {
    item.name = item.name || item.displayName || 'ব্যবহারকারী';
    item.email = item.email ? String(item.email).trim().toLowerCase() : '';
    item.phone = item.phone || '';
    item.role = item.role || 'Pending';
    const s = String(item.status || '').trim().toLowerCase();
    if (s === 'inactive' || s === 'নিষ্ক্রিয়' || s === 'নিষ্ক্রিয়') {
      item.status = 'Inactive';
    } else if (s === 'pending' || s === 'pending approval' || s === 'pending_approval' || s === 'অপেক্ষমাণ') {
      item.status = 'Pending Approval';
    } else {
      item.status = 'Active';
    }
    item.createdAt = toTimestampNumber(item.createdAt);
    if (item.updatedAt) item.updatedAt = toTimestampNumber(item.updatedAt);
  }

  return item as T;
}

export const dataService = {
  /**
   * Broadcast cross-tab synchronization event within the browser
   */
  broadcastSync(collectionName: string) {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('bnfe_cloud_sync');
        channel.postMessage({ collection: collectionName, timestamp: Date.now() });
        channel.close();
      }
    } catch (e) {}
  },

  /**
   * Fetch items directly from Cloud Firestore.
   * If forceFresh=true, uses getDocsFromServer to bypass any client-side cache.
   */
  async getItems<T extends { id: string }>(collectionName: string, forceFresh: boolean = false): Promise<T[]> {
    try {
      const colRef = collection(db, collectionName);
      let snap;
      
      if (forceFresh) {
        try {
          snap = await getDocsFromServer(colRef);
        } catch {
          snap = await getDocs(colRef);
        }
      } else {
        snap = await getDocs(colRef);
      }

      if (snap && snap.docs) {
        return snap.docs.map(d => normalizeDoc<T>(collectionName, d.data(), d.id));
      }
    } catch (err) {
      console.warn(`Cloud Firestore fetch notice for ${collectionName}:`, err);
    }

    // Only fallback for roles to ensure security/RBAC never breaks offline
    if (collectionName === 'roles') {
      return DEFAULT_ROLES as unknown as T[];
    }

    return [];
  },

  /**
   * Save or update an item directly in Cloud Firestore (atomically audited via auditLog.ts)
   */
  async saveItem<T extends { id: string }>(
    collectionName: string,
    item: T,
    auditMeta?: {
      module?: AuditModule;
      title?: string;
      targetLabel?: string;
      actor?: AuditActor;
      skipAudit?: boolean;
    }
  ): Promise<T> {
    const cleanItem = sanitizeForFirestore(item);

    try {
      if (auditMeta?.skipAudit) {
        const docRef = doc(db, collectionName, cleanItem.id);
        await setDoc(docRef, cleanItem, { merge: true });
        this.broadcastSync(collectionName);
        return cleanItem as T;
      }

      const saved = await recordAuditedSave<T>({
        collectionName,
        item: cleanItem as T,
        module: auditMeta?.module,
        title: auditMeta?.title,
        targetLabel: auditMeta?.targetLabel,
        actor: auditMeta?.actor,
      });

      this.broadcastSync(collectionName);
      return saved;
    } catch (err: any) {
      const sanitized = handleFirestoreError({
        error: err,
        operationType: 'update',
        path: `${collectionName}/${cleanItem.id}`,
        authInfo: {
          userId: auth.currentUser?.uid || null,
          email: auth.currentUser?.email || null
        }
      });
      console.warn(`Firestore saveItem error on ${collectionName}/${cleanItem.id}:`, sanitized.userMessage);
      throw new Error(sanitized.userMessage);
    }
  },

  /**
   * Delete an item by ID directly from Cloud Firestore (audited with full snapshot & related docs).
   * If deleting is denied by system settings, automatically fallbacks to archiveRecord when fallbackToArchive is true.
   */
  async deleteItem(
    collectionName: string,
    id: string,
    fallbackToArchive: boolean = true,
    auditMeta?: {
      module?: AuditModule;
      title?: string;
      targetLabel?: string;
      actor?: AuditActor;
    }
  ): Promise<{ action: 'deleted' | 'archived'; id: string }> {
    const alwaysDirectDelete = [
      'users',
      'roles',
      'trade_skill_modules',
      'trade_literacy_modules',
      'batch_calendar_progress',
      'calendar_progress_logs',
      'attendance',
      'exams',
      'marks',
      'notifications'
    ];

    if (!alwaysDirectDelete.includes(collectionName)) {
      const settings = await this.getSystemSettings();
      if (!settings.allowDataDeletion) {
        if (fallbackToArchive) {
          console.info(`Deletion denied by system settings. Falling back to archive record for ${collectionName}/${id}`);
          try {
            await this.archiveRecord(
              collectionName,
              id,
              'সিস্টেম ডিলিট বন্ধ থাকায় সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে',
              auditMeta?.actor
            );
            return { action: 'archived', id };
          } catch (archiveErr) {
            console.warn(`Record not found in Firestore during archive fallback (${id}), continuing with cleanup`);
          }
        } else {
          throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
        }
      }
    }

    try {
      const relatedDocs: AuditRelatedDoc[] = [];

      if (collectionName === 'trainees') {
        const [attSnap, marksSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'marks')),
        ]);
        attSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.traineeId === id) {
            relatedDocs.push({ collection: 'attendance', id: d.id, data: { id: d.id, ...data } });
          }
        });
        marksSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.traineeId === id) {
            relatedDocs.push({ collection: 'marks', id: d.id, data: { id: d.id, ...data } });
          }
        });
      } else if (collectionName === 'exams') {
        const marksSnap = await getDocs(collection(db, 'marks'));
        marksSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.examId === id) {
            relatedDocs.push({ collection: 'marks', id: d.id, data: { id: d.id, ...data } });
          }
        });
      }

      await recordAuditedDelete({
        collectionName,
        docId: id,
        module: auditMeta?.module,
        title: auditMeta?.title,
        targetLabel: auditMeta?.targetLabel,
        relatedDocs,
        actor: auditMeta?.actor,
      });
    } catch (e: any) {
      const sanitized = handleFirestoreError({
        error: e,
        operationType: 'delete',
        path: `${collectionName}/${id}`,
        authInfo: {
          userId: auth.currentUser?.uid || null,
          email: auth.currentUser?.email || null
        }
      });
      console.warn(`Firestore deleteItem error on ${collectionName}/${id}:`, sanitized.userMessage);
      throw new Error(sanitized.userMessage);
    }

    this.broadcastSync(collectionName);
    if (collectionName === 'trainees') {
      this.broadcastSync('attendance');
      this.broadcastSync('marks');
    } else if (collectionName === 'exams') {
      this.broadcastSync('marks');
    }
    return { action: 'deleted', id };
  },

  /**
   * Archive a record when deletion is denied or as a safe alternative to deletion.
   * Preserves historical data while flagging record as archived.
   */
  async archiveRecord(
    collectionName: string,
    id: string,
    reason: string = 'সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে',
    actor?: AuditActor
  ): Promise<any> {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { id, isArchived: true, status: 'Archived', notFound: true };
    }

    const currentData = snap.data();
    const updatedData = sanitizeForFirestore({
      ...currentData,
      id,
      status: 'Archived',
      isArchived: true,
      archivedAt: Date.now(),
      archivedReason: reason,
      updatedAt: Date.now()
    });

    await recordAuditedSave({
      collectionName,
      item: updatedData,
      actor,
    });
    this.broadcastSync(collectionName);
    return updatedData;
  },

  /**
   * Unarchive / Restore a previously archived record back to active state.
   */
  async unarchiveRecord(
    collectionName: string,
    id: string,
    actor?: AuditActor
  ): Promise<any> {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`রেকর্ড পাওয়া যায়নি (ID: ${id})`);
    }

    const currentData = snap.data();
    const updatedData = sanitizeForFirestore({
      ...currentData,
      id,
      status: 'Active',
      isArchived: false,
      archivedAt: null,
      archivedReason: null,
      updatedAt: Date.now()
    });

    await recordAuditedSave({
      collectionName,
      item: updatedData,
      actor,
    });
    this.broadcastSync(collectionName);
    return updatedData;
  },

  /**
   * Batch save attendance records atomically directly in Cloud Firestore with structured audit log
   * Enforces idempotent primary keys (ATT_${batchId}_${date}_${traineeId}) to prevent duplicates.
   */
  async saveAttendanceBatch(
    records: AttendanceRecord[],
    auditMeta?: {
      traineeNamesMap?: Record<string, string>;
      batchName?: string;
      actor?: AuditActor;
    }
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!records || records.length === 0) return { success: true, count: 0 };

    try {
      const recordMap = new Map<string, AttendanceRecord>();
      const now = Date.now();

      records.forEach(r => {
        const compositeId = r.id || `ATT_${r.batchId}_${r.date}_${r.traineeId}`;
        const cleanRecord = sanitizeForFirestore({
          ...r,
          id: compositeId,
          createdAt: r.createdAt || now,
          updatedAt: now
        });
        recordMap.set(`${r.batchId}_${r.date}_${r.traineeId}`, cleanRecord);
      });

      const uniqueRecords = Array.from(recordMap.values());
      const count = await recordAuditedAttendanceBatch({
        records: uniqueRecords as unknown as Array<Record<string, unknown> & { id: string; traineeId: string; status: string; date: string; batchId: string }>,
        traineeNamesMap: auditMeta?.traineeNamesMap,
        batchName: auditMeta?.batchName,
        actor: auditMeta?.actor,
      });

      this.broadcastSync('attendance');
      return { success: true, count };
    } catch (firestoreErr: any) {
      console.error("Cloud Firestore batch attendance save error:", firestoreErr);
      return { success: false, count: 0, error: firestoreErr?.message || 'Cloud write error' };
    }
  },

  /**
   * Batch save exam marks atomically with structured diff audit log
   */
  async saveMarksBatch(
    examId: string,
    examName: string,
    marks: ExamMark[],
    auditMeta?: {
      traineeNamesMap?: Record<string, string>;
      actor?: AuditActor;
    }
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!marks || marks.length === 0) return { success: true, count: 0 };
    try {
      const cleanList = marks.map((m) => sanitizeForFirestore(m));
      const count = await recordAuditedMarksBatch({
        examId,
        examName,
        records: cleanList as unknown as Array<Record<string, unknown> & { id: string; traineeId: string; marksObtained: number; result: string; grade: string }>,
        traineeNamesMap: auditMeta?.traineeNamesMap,
        actor: auditMeta?.actor,
      });
      this.broadcastSync('marks');
      return { success: true, count };
    } catch (err: any) {
      console.error("Cloud Firestore batch marks save error:", err);
      return { success: false, count: 0, error: err?.message || 'Cloud write error' };
    }
  },

  /**
   * Batch save trainees atomically directly in Cloud Firestore with audit log
   * Enforces sanitization and chunks writes up to 450 items per batch.
   */
  async saveTraineeBatch(
    traineesList: Trainee[],
    auditMeta?: { title?: string; actor?: AuditActor }
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!traineesList || traineesList.length === 0) return { success: true, count: 0 };

    try {
      const now = Date.now();
      const cleanList = traineesList.map(t => {
        const idToUse = t.id || `TRN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
        return sanitizeForFirestore({
          ...t,
          id: idToUse,
          createdAt: t.createdAt || now,
          updatedAt: now
        });
      });

      const chunkSize = 440;
      for (let i = 0; i < cleanList.length; i += chunkSize) {
        const chunk = cleanList.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach(trainee => {
          const ref = doc(db, 'trainees', trainee.id);
          batch.set(ref, trainee, { merge: true });
        });

        await batch.commit();
      }

      await recordSimpleAuditLog({
        action: 'create',
        module: 'trainees',
        collectionName: 'trainees',
        targetId: 'bulk_import',
        targetLabel: `${cleanList.length} জন প্রশিক্ষণার্থী`,
        title: auditMeta?.title || `বাল্ক নিবন্ধন: ${cleanList.length} জন প্রশিক্ষণার্থী`,
        count: cleanList.length,
        targetNames: cleanList.slice(0, 50).map((t) => t.nameBn || t.nameEn || t.traineeId || t.id),
        actor: auditMeta?.actor,
      });

      this.broadcastSync('trainees');
      return { success: true, count: cleanList.length };
    } catch (firestoreErr: any) {
      console.error("Cloud Firestore batch trainee save error:", firestoreErr);
      return { success: false, count: 0, error: firestoreErr?.message || 'Cloud write error' };
    }
  },

  /**
   * Get attendance records for a batch on a specific date directly from Cloud
   */
  async getBatchAttendanceForDate(batchId: string, dateStr: string): Promise<AttendanceRecord[]> {
    const all = await this.getItems<AttendanceRecord>('attendance');
    return all.filter(a => a.batchId === batchId && a.date === dateStr);
  },

  /**
   * Get attendance summary for a batch across a month (YYYY-MM)
   */
  async getBatchMonthlyAttendanceSummary(batchId: string, yearMonthStr: string): Promise<{
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    attendanceRate: number;
    uniqueDatesCount: number;
  }> {
    const all = await this.getItems<AttendanceRecord>('attendance');
    const filtered = all.filter(a => a.batchId === batchId && a.date.startsWith(yearMonthStr));
    const totalRecords = filtered.length;
    const presentCount = filtered.filter(a => a.status === 'Present').length;
    const absentCount = filtered.filter(a => a.status === 'Absent').length;
    const leaveCount = filtered.filter(a => a.status === 'Leave').length;
    const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
    const uniqueDatesCount = new Set(filtered.map(a => a.date)).size;

    return {
      totalRecords,
      presentCount,
      absentCount,
      leaveCount,
      attendanceRate,
      uniqueDatesCount
    };
  },

  /**
   * Check if a trade is referenced by batches or trainees
   */
  async checkTradeUsage(tradeId: string): Promise<{ isReferenced: boolean; batchCount: number; traineeCount: number }> {
    const [batches, trainees] = await Promise.all([
      this.getItems<Batch>('batches'),
      this.getItems<Trainee>('trainees')
    ]);
    const batchCount = batches.filter(b => b.tradeId === tradeId).length;
    const traineeCount = trainees.filter(t => t.tradeId === tradeId).length;
    return {
      isReferenced: batchCount > 0 || traineeCount > 0,
      batchCount,
      traineeCount
    };
  },

  /**
   * Check if an institute is referenced by batches, trainees, or users
   */
  async checkInstituteUsage(instituteId: string): Promise<{ isReferenced: boolean; batchCount: number; traineeCount: number; userCount: number }> {
    const [batches, trainees, users] = await Promise.all([
      this.getItems<Batch>('batches'),
      this.getItems<Trainee>('trainees'),
      this.getItems<UserProfile>('users')
    ]);
    const batchCount = batches.filter(b => b.instituteId === instituteId).length;
    const traineeCount = trainees.filter(t => t.instituteId === instituteId).length;
    const userCount = users.filter(u => u.instituteId === instituteId).length;
    return {
      isReferenced: batchCount > 0 || traineeCount > 0 || userCount > 0,
      batchCount,
      traineeCount,
      userCount
    };
  },

  /**
   * Check if a batch is referenced by trainees, attendance records, or exams
   */
  async checkBatchUsage(batchId: string): Promise<{ isReferenced: boolean; traineeCount: number; attendanceCount: number; examCount: number }> {
    const [trainees, attendance, exams] = await Promise.all([
      this.getItems<Trainee>('trainees'),
      this.getItems<AttendanceRecord>('attendance'),
      this.getItems<Exam>('exams')
    ]);
    const traineeCount = trainees.filter(t => t.batchId === batchId).length;
    const attendanceCount = attendance.filter(a => a.batchId === batchId).length;
    const examCount = exams.filter(e => e.batchId === batchId).length;
    return {
      isReferenced: traineeCount > 0 || attendanceCount > 0 || examCount > 0,
      traineeCount,
      attendanceCount,
      examCount
    };
  },

  /**
   * Check if a batch code is already in use
   */
  async isBatchCodeTaken(code: string, excludeId?: string): Promise<boolean> {
    const batches = await this.getItems<Batch>('batches');
    const normalized = code.trim().toLowerCase();
    return batches.some(b => (b.batchCode?.trim().toLowerCase() === normalized || b.id.trim().toLowerCase() === normalized) && b.id !== excludeId);
  },

  /**
   * Check for duplicate trainee enrollment
   */
  async checkDuplicateTrainee(nidOrBirth: string, mobile: string, excludeId?: string): Promise<{ isDuplicate: boolean; reason?: string }> {
    const trainees = await this.getItems<Trainee>('trainees');
    const cleanNid = nidOrBirth?.trim();
    const cleanMobile = mobile?.trim();

    if (cleanNid && cleanNid.length > 5) {
      const matchNid = trainees.find(t => t.nidOrBirthRegistration?.trim() === cleanNid && t.id !== excludeId);
      if (matchNid) {
        return { isDuplicate: true, reason: `এই এনআইডি/জন্ম নিবন্ধন নম্বরটি ইতোমধ্যে "${matchNid.nameBn || matchNid.nameEn}" শিক্ষার্থীর রেকর্ডে ব্যবহৃত হয়েছে।` };
      }
    }

    if (cleanMobile && cleanMobile.length >= 11) {
      const matchMobile = trainees.find(t => t.mobileNumber?.trim() === cleanMobile && t.id !== excludeId && t.status === 'Active');
      if (matchMobile) {
        return { isDuplicate: true, reason: `এই মোবাইল নম্বরটি (${cleanMobile}) ইতোমধ্যে সক্রিয় শিক্ষার্থী "${matchMobile.nameBn || matchMobile.nameEn}" এর নামে নিবন্ধিত।` };
      }
    }

    return { isDuplicate: false };
  },

  /**
   * Check if a trainee ID is already in use
   */
  async isTraineeIdTaken(traineeId: string, excludeId?: string): Promise<boolean> {
    const trainees = await this.getItems<Trainee>('trainees');
    const normalized = traineeId.trim().toLowerCase();
    return trainees.some(t => t.traineeId?.trim().toLowerCase() === normalized && t.id !== excludeId);
  },

  /**
   * Check if a registration number is already in use
   */
  async isRegistrationNumberTaken(regNo: string, excludeId?: string): Promise<boolean> {
    const clean = regNo?.trim();
    if (!clean) return false;
    const trainees = await this.getItems<Trainee>('trainees');
    const normalized = clean.toLowerCase();
    return trainees.some(t => {
      const existing = t.registrationNumber?.trim().toLowerCase();
      return !!existing && existing === normalized && t.id !== excludeId;
    });
  },

  /**
   * Update BRN verification status and remarks for a trainee
   */
  async updateTraineeBrnVerification(
    traineeId: string,
    verification: { is_brn_verified: boolean; brn_remark: string; verifiedBy?: string },
    actor?: AuditActor
  ): Promise<Trainee> {
    const trainees = await this.getItems<Trainee>('trainees', true);
    const trainee = trainees.find(t => t.id === traineeId);
    if (!trainee) {
      throw new Error(`প্রশিক্ষণার্থী পাওয়া যায়নি (ID: ${traineeId})`);
    }
    const updated: Trainee = {
      ...trainee,
      is_brn_verified: verification.is_brn_verified,
      brn_remark: verification.brn_remark || '',
      brn_verified_at: Date.now(),
      brn_verified_by: verification.verifiedBy || '',
      updatedAt: Date.now(),
    };
    await this.saveItem('trainees', updated, {
      module: 'trainees',
      title: `জন্ম নিবন্ধন যাচাই হালনাগাদ: ${trainee.nameBn || trainee.nameEn}`,
      actor,
    });
    return updated;
  },

  /**
   * Check batch capacity before enrolling a trainee
   */
  async checkBatchCapacity(batchId: string, excludeTraineeId?: string): Promise<{ isFull: boolean; currentCount: number; maxCapacity: number }> {
    const [batches, trainees] = await Promise.all([
      this.getItems<Batch>('batches'),
      this.getItems<Trainee>('trainees')
    ]);
    const batch = batches.find(b => b.id === batchId);
    const maxCapacity = batch?.maxTrainees || 30;
    const currentCount = trainees.filter(t => t.batchId === batchId && t.id !== excludeTraineeId && (!t.status || t.status === 'Active')).length;
    return {
      isFull: currentCount >= maxCapacity,
      currentCount,
      maxCapacity
    };
  },

  /**
   * Check if a trainee has associated attendance records or exam marks
   */
  async checkTraineeUsage(traineeId: string): Promise<{ isReferenced: boolean; attendanceCount: number; marksCount: number }> {
    const [attendance, marks] = await Promise.all([
      this.getItems<AttendanceRecord>('attendance'),
      this.getItems<ExamMark>('marks')
    ]);
    const attendanceCount = attendance.filter(a => a.traineeId === traineeId).length;
    const marksCount = marks.filter(m => m.traineeId === traineeId).length;
    return {
      isReferenced: attendanceCount > 0 || marksCount > 0,
      attendanceCount,
      marksCount
    };
  },

  /**
   * Real-time subscription to a Cloud Firestore collection.
   * When any user anywhere updates records in Cloud Firestore, onUpdate is called instantly!
   */
  subscribeCollection<T extends { id: string }>(
    collectionName: string,
    onUpdate: (items: T[]) => void,
    onError?: (err: any) => void
  ): () => void {
    let isSubscribed = true;

    // 1. Cross-tab sync via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('bnfe_cloud_sync');
        bc.onmessage = (event) => {
          if (!event.data || event.data.collection === collectionName || event.data.collection === 'all') {
            this.getItems<T>(collectionName, true).then(fresh => {
              if (isSubscribed && fresh && fresh.length > 0) onUpdate(fresh);
            });
          }
        };
      }
    } catch (e) {}

    // 2. Real-time Cloud Firestore onSnapshot subscription
    let unsubscribeFirestore = () => {};
    try {
      const colRef = collection(db, collectionName);
      unsubscribeFirestore = onSnapshot(
        colRef,
        (snap) => {
          if (snap && snap.docs) {
            const items = snap.docs.map(d => normalizeDoc<T>(collectionName, d.data(), d.id));
            if (isSubscribed) {
              onUpdate(items);
            }
          }
        },
        (err) => {
          console.warn(`Cloud Firestore realtime listener error for ${collectionName}:`, err);
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn(`Could not attach realtime listener for ${collectionName}:`, err);
    }

    return () => {
      isSubscribed = false;
      try { unsubscribeFirestore(); } catch (e) {}
      try { if (bc) bc.close(); } catch (e) {}
    };
  },

  /**
   * Alias for subscribeCollection
   */
  subscribeToCollection<T extends { id: string }>(
    collectionName: string,
    onUpdate: (items: T[]) => void,
    onError?: (err: any) => void
  ): () => void {
    return this.subscribeCollection<T>(collectionName, onUpdate, onError);
  },

  /**
   * Force fresh cloud synchronization across all primary collections directly from Cloud Firestore
   */
  async syncAllFromCloud(): Promise<{
    institutes: Institute[];
    trades: Trade[];
    batches: Batch[];
    trainees: Trainee[];
    attendance: AttendanceRecord[];
    exams: Exam[];
    marks: ExamMark[];
    activityLogs: ActivityLog[];
    timestamp: number;
  }> {
    const [
      institutes,
      trades,
      batches,
      trainees,
      attendance,
      exams,
      marks,
      activityLogs
    ] = await Promise.all([
      this.getItems<Institute>('institutes', true),
      this.getItems<Trade>('trades', true),
      this.getItems<Batch>('batches', true),
      this.getItems<Trainee>('trainees', true),
      this.getItems<AttendanceRecord>('attendance', true),
      this.getItems<Exam>('exams', true),
      this.getItems<ExamMark>('marks', true),
      this.getItems<ActivityLog>('activityLogs', true)
    ]);

    this.broadcastSync('all');

    return {
      institutes,
      trades,
      batches,
      trainees,
      attendance,
      exams,
      marks,
      activityLogs,
      timestamp: Date.now()
    };
  },

  /**
   * Seed demo trainees directly into Cloud Firestore for all active batches
   */
  async seedDemoTraineesForAllBatches(forceOverwrite: boolean = false): Promise<number> {
    const batches = await this.getItems<Batch>('batches');
    const existingTrainees = await this.getItems<Trainee>('trainees');
    const allToSave: Trainee[] = [];

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const b = batches[bIdx];
      const currentInBatch = existingTrainees.filter(t => t.batchId === b.id);
      if (currentInBatch.length >= 20 && !forceOverwrite) {
        continue;
      }

      const generated = generate20TraineesForBatch(b, bIdx, bIdx * 20);
      allToSave.push(...generated);
    }

    if (allToSave.length > 0) {
      await this.saveTraineeBatch(allToSave, {
        title: `ডেমো প্রশিক্ষণার্থী অন্তর্ভুক্ত (${allToSave.length} জন)`,
      });
    }

    this.broadcastSync('trainees');
    return allToSave.length;
  },

  /**
   * Clear demo data directly from Cloud Firestore
   */
  async clearAllDemoData(): Promise<void> {
    const trainees = await this.getItems<Trainee>('trainees');
    const demoTrainees = trainees.filter(t => 
      t.id.startsWith('TRN-DEMO') || 
      t.id.startsWith('DEMO_') || 
      t.traineeId?.includes('DEMO')
    );
    for (const t of demoTrainees) {
      await this.deleteItem('trainees', t.id);
    }
    this.clearAllLocalData();
    this.broadcastSync('all');
  },

  /**
   * Clear local browser cache
   */
  clearAllLocalData(): void {
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('bnfe_') || k.startsWith('bnfe-'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
    }
    this.broadcastSync('all');
  },

  /**
   * Fetch system settings from Cloud Firestore with caching
   */
  async getSystemSettings(): Promise<SystemSettings> {
    try {
      const docRef = doc(db, 'settings', 'system_config');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        cachedSystemSettings = {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...data,
          allowDataDeletion: data.allowDataDeletion === true
        };
      } else {
        // Initialize default in Firestore
        await setDoc(docRef, sanitizeForFirestore(DEFAULT_SYSTEM_SETTINGS));
        cachedSystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('bnfe_system_settings', JSON.stringify(cachedSystemSettings));
      }
    } catch (err) {
      console.warn("Could not fetch system settings from Firestore, using cached/default:", err);
    }
    return cachedSystemSettings;
  },

  /**
   * Check synchronously if data deletion is permitted according to Settings
   */
  isDeletionAllowed(): boolean {
    return cachedSystemSettings.allowDataDeletion === true;
  },

  /**
   * Save or update system settings directly in Cloud Firestore with diff audit log
   */
  async saveSystemSettings(
    updates: Partial<SystemSettings>,
    actor?: AuditActor
  ): Promise<SystemSettings> {
    const merged: SystemSettings = {
      ...cachedSystemSettings,
      ...updates,
      updatedAt: Date.now()
    };
    const clean = sanitizeForFirestore({ id: 'system_config', ...merged });
    const title =
      updates.allowDataDeletion !== undefined
        ? `সিস্টেম ডাটা ডিলিট কন্ট্রোল: ${updates.allowDataDeletion ? 'আনলক (চালু)' : 'লক (বন্ধ)'}`
        : updates.allowPublicRegistration !== undefined
        ? `পাবলিক নিবন্ধন: ${updates.allowPublicRegistration ? 'চালু' : 'বন্ধ'}`
        : 'সিস্টেম সেটিংস হালনাগাদ';

    await recordAuditedSave({
      collectionName: 'settings',
      item: clean as SystemSettings & { id: string },
      module: 'settings',
      targetLabel: 'সিস্টেম কনফিগারেশন',
      title,
      actor,
    });
    cachedSystemSettings = merged;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bnfe_system_settings', JSON.stringify(merged));
    }
    this.broadcastSync('settings');
    return merged;
  },

  /**
   * Subscribe to real-time updates for system settings
   */
  subscribeSystemSettings(callback: (settings: SystemSettings) => void): () => void {
    const docRef = doc(db, 'settings', 'system_config');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        cachedSystemSettings = {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...data,
          allowDataDeletion: data.allowDataDeletion === true
        };
      } else {
        cachedSystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('bnfe_system_settings', JSON.stringify(cachedSystemSettings));
      }
      callback(cachedSystemSettings);
    }, (err) => {
      console.warn("Error listening to system settings:", err);
      callback(cachedSystemSettings);
    });
  },

  /**
   * Delete attendance records directly from Cloud Firestore (audited bulk_delete)
   */
  async deleteAttendance(
    filter?: { batchId?: string; date?: string; instituteId?: string },
    actor?: AuditActor
  ): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। অনুগ্রহ করে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const snap = await getDocs(collection(db, 'attendance'));
    let toDelete = snap.docs.map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }));

    if (filter) {
      if (filter.batchId) toDelete = toDelete.filter(r => r.data.batchId === filter.batchId);
      if (filter.date) toDelete = toDelete.filter(r => r.data.date === filter.date);
      if (filter.instituteId) toDelete = toDelete.filter(r => r.data.instituteId === filter.instituteId);
    }

    const title = filter?.date
      ? `তারিখভিত্তিক হাজিরা রেকর্ড মোছা হয়েছে (${filter.date})`
      : filter?.batchId
      ? `ব্যাচভিত্তিক হাজিরা রেকর্ড মোছা হয়েছে`
      : `সকল দৈনিক হাজিরা রেকর্ড মোছা হয়েছে (${toDelete.length} টি)`;

    const count = await recordAuditedBulkDelete({
      collectionName: 'attendance',
      docs: toDelete,
      module: 'attendance',
      title,
      actor,
    });
    this.broadcastSync('attendance');
    return count;
  },

  /**
   * Delete all trainees directly from Cloud Firestore, with option to delete attendance too
   */
  async deleteAllTrainees(
    options?: { batchId?: string; deleteAttendanceToo?: boolean },
    actor?: AuditActor
  ): Promise<{ deletedTrainees: number; deletedAttendance: number }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। অনুগ্রহ করে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const trnSnap = await getDocs(collection(db, 'trainees'));
    const targetTrainees = trnSnap.docs
      .map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }))
      .filter((t) => !options?.batchId || t.data.batchId === options.batchId);

    const relatedDocs: AuditRelatedDoc[] = [];
    let deletedAttendance = 0;

    if (options?.deleteAttendanceToo !== false) {
      const attSnap = await getDocs(collection(db, 'attendance'));
      attSnap.docs.forEach((d) => {
        const data = d.data();
        if (!options?.batchId || data.batchId === options.batchId) {
          relatedDocs.push({ collection: 'attendance', id: d.id, data: { id: d.id, ...data } });
          deletedAttendance++;
        }
      });
    }

    await recordAuditedBulkDelete({
      collectionName: 'trainees',
      docs: targetTrainees,
      relatedDocs,
      module: 'trainees',
      title: `প্রশিক্ষণার্থী বাল্ক ডিলিট (${targetTrainees.length} জন${deletedAttendance > 0 ? ` ও হাজিরা ${deletedAttendance} টি` : ''})`,
      totalCountOverride: targetTrainees.length,
      actor,
    });

    this.broadcastSync('trainees');
    this.broadcastSync('attendance');
    return { deletedTrainees: targetTrainees.length, deletedAttendance };
  },

  /**
   * Delete all exams and marks directly from Cloud Firestore
   */
  async deleteAllExamsAndMarks(
    options?: { batchId?: string },
    actor?: AuditActor
  ): Promise<{ deletedExams: number; deletedMarks: number }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। অনুগ্রহ করে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const [exmSnap, mrkSnap] = await Promise.all([
      getDocs(collection(db, 'exams')),
      getDocs(collection(db, 'marks')),
    ]);

    const targetExams = exmSnap.docs
      .map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }))
      .filter((e) => !options?.batchId || e.data.batchId === options.batchId);

    const targetMarks: AuditRelatedDoc[] = mrkSnap.docs
      .map((d) => ({ collection: 'marks', id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }))
      .filter((m) => !options?.batchId || m.data.batchId === options.batchId);

    await recordAuditedBulkDelete({
      collectionName: 'exams',
      docs: targetExams,
      relatedDocs: targetMarks,
      module: 'exams',
      title: `পরীক্ষা ও ফলাফল বাল্ক ডিলিট (পরীক্ষা: ${targetExams.length} টি, মার্কস: ${targetMarks.length} টি)`,
      totalCountOverride: targetExams.length + targetMarks.length,
      actor,
    });

    this.broadcastSync('marks');
    this.broadcastSync('exams');
    return { deletedExams: targetExams.length, deletedMarks: targetMarks.length };
  },

  /**
   * Delete all batches
   */
  async deleteAllBatches(actor?: AuditActor): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে।");
    }
    const snap = await getDocs(collection(db, 'batches'));
    const docs = snap.docs.map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }));
    const count = await recordAuditedBulkDelete({
      collectionName: 'batches',
      docs,
      module: 'batches',
      title: `সকল ব্যাচ মুছে ফেলা হয়েছে (${docs.length} টি)`,
      actor,
    });
    this.broadcastSync('batches');
    return count;
  },

  /**
   * Delete all trades
   */
  async deleteAllTrades(actor?: AuditActor): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে।");
    }
    const snap = await getDocs(collection(db, 'trades'));
    const docs = snap.docs.map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }));
    const count = await recordAuditedBulkDelete({
      collectionName: 'trades',
      docs,
      module: 'trades',
      title: `সকল ট্রেড মুছে ফেলা হয়েছে (${docs.length} টি)`,
      actor,
    });
    this.broadcastSync('trades');
    return count;
  },

  /**
   * Delete all institutes
   */
  async deleteAllInstitutes(actor?: AuditActor): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে।");
    }
    const snap = await getDocs(collection(db, 'institutes'));
    const docs = snap.docs.map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }));
    const count = await recordAuditedBulkDelete({
      collectionName: 'institutes',
      docs,
      module: 'institutes',
      title: `সকল প্রতিষ্ঠান মুছে ফেলা হয়েছে (${docs.length} টি)`,
      actor,
    });
    this.broadcastSync('institutes');
    return count;
  },

  /**
   * Delete a single institute and unassign it from any linked batches (audited with snapshot).
   * If deleting is denied, fallbacks to archiving when fallbackToArchive is true.
   */
  async deleteInstitute(
    id: string,
    fallbackToArchive: boolean = true,
    actor?: AuditActor
  ): Promise<{ action: 'deleted' | 'archived'; id: string }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      if (fallbackToArchive) {
        await this.archiveRecord('institutes', id, 'সিস্টেম ডিলিট বন্ধ থাকায় সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে', actor);
        return { action: 'archived', id };
      }
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const postUpdates: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
    try {
      const snap = await getDocs(collection(db, 'batches'));
      snap.docs.forEach((d) => {
        if (d.data().instituteId === id) {
          postUpdates.push({ collection: 'batches', id: d.id, data: { instituteId: '' } });
        }
      });
    } catch (e) {
      console.warn("Could not collect linked batches for deleted institute:", e);
    }

    await recordAuditedDelete({
      collectionName: 'institutes',
      docId: id,
      module: 'institutes',
      postUpdates,
      actor,
    });

    if (postUpdates.length > 0) this.broadcastSync('batches');
    this.broadcastSync('institutes');
    return { action: 'deleted', id };
  },

  /**
   * Delete a single trade and unassign it from any linked batches (audited with snapshot).
   * If deleting is denied, fallbacks to archiving when fallbackToArchive is true.
   */
  async deleteTrade(
    id: string,
    fallbackToArchive: boolean = true,
    actor?: AuditActor
  ): Promise<{ action: 'deleted' | 'archived'; id: string }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      if (fallbackToArchive) {
        await this.archiveRecord('trades', id, 'সিস্টেম ডিলিট বন্ধ থাকায় সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে', actor);
        return { action: 'archived', id };
      }
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const postUpdates: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
    try {
      const snap = await getDocs(collection(db, 'batches'));
      snap.docs.forEach((d) => {
        if (d.data().tradeId === id) {
          postUpdates.push({ collection: 'batches', id: d.id, data: { tradeId: '' } });
        }
      });
    } catch (e) {
      console.warn("Could not collect linked batches for deleted trade:", e);
    }

    await recordAuditedDelete({
      collectionName: 'trades',
      docId: id,
      module: 'trades',
      postUpdates,
      actor,
    });

    if (postUpdates.length > 0) this.broadcastSync('batches');
    this.broadcastSync('trades');
    return { action: 'deleted', id };
  },

  /**
   * Delete a single batch with optional cascade delete of attendance, trainees, exams & marks (all saved in related!).
   * If deleting is denied, fallbacks to archiving when fallbackToArchive is true.
   */
  async deleteBatch(
    id: string,
    cascade: boolean = true,
    fallbackToArchive: boolean = true,
    actor?: AuditActor
  ): Promise<{ action: 'deleted' | 'archived'; id: string }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      if (fallbackToArchive) {
        await this.archiveRecord('batches', id, 'সিস্টেম ডিলিট বন্ধ থাকায় সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে', actor);
        return { action: 'archived', id };
      }
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const relatedDocs: AuditRelatedDoc[] = [];
    if (cascade) {
      const [attSnap, trnSnap, exmSnap, mrkSnap] = await Promise.all([
        getDocs(collection(db, 'attendance')),
        getDocs(collection(db, 'trainees')),
        getDocs(collection(db, 'exams')),
        getDocs(collection(db, 'marks')),
      ]);

      attSnap.docs.forEach((d) => {
        if (d.data().batchId === id) {
          relatedDocs.push({ collection: 'attendance', id: d.id, data: { id: d.id, ...d.data() } });
        }
      });
      trnSnap.docs.forEach((d) => {
        if (d.data().batchId === id) {
          relatedDocs.push({ collection: 'trainees', id: d.id, data: { id: d.id, ...d.data() } });
        }
      });
      exmSnap.docs.forEach((d) => {
        if (d.data().batchId === id) {
          relatedDocs.push({ collection: 'exams', id: d.id, data: { id: d.id, ...d.data() } });
        }
      });
      mrkSnap.docs.forEach((d) => {
        if (d.data().batchId === id) {
          relatedDocs.push({ collection: 'marks', id: d.id, data: { id: d.id, ...d.data() } });
        }
      });
    }

    await recordAuditedDelete({
      collectionName: 'batches',
      docId: id,
      module: 'batches',
      relatedDocs,
      actor,
    });

    this.broadcastSync('batches');
    if (cascade) {
      this.broadcastSync('trainees');
      this.broadcastSync('attendance');
      this.broadcastSync('exams');
      this.broadcastSync('marks');
    }
    return { action: 'deleted', id };
  },

  /**
   * Seed default institutes to Cloud Firestore
   */
  async seedDefaultInstitutes(): Promise<number> {
    let count = 0;
    for (const inst of DEFAULT_INSTITUTES) {
      await this.saveItem('institutes', inst);
      count++;
    }
    this.broadcastSync('institutes');
    return count;
  },

  /**
   * Seed default trades to Cloud Firestore
   */
  async seedDefaultTrades(): Promise<number> {
    let count = 0;
    for (const trade of DEFAULT_TRADES) {
      await this.saveItem('trades', trade);
      count++;
    }
    this.broadcastSync('trades');
    return count;
  },

  /**
   * Get calendar progress for a given batch with dual trainer tracking
   */
  async getBatchCalendarProgress(batchId: string): Promise<BatchCalendarProgress> {
    const docId = `progress_${batchId}`;
    try {
      const docRef = doc(db, 'batch_calendar_progress', docId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const d = snapshot.data() as BatchCalendarProgress;
        return {
          ...d,
          skillProgress: d.skillProgress || d.completedDays || {},
          literacyProgress: d.literacyProgress || {},
          currentSkillDay: d.currentSkillDay || d.currentDay || 1,
          currentLiteracyDay: d.currentLiteracyDay || 1,
          currentDay: d.currentDay || 1,
        };
      }
    } catch (err) {
      console.warn("Firestore getBatchCalendarProgress error, using local fallback:", err);
    }

    // Local fallback
    try {
      const stored = localStorage.getItem(`bnfe_cal_prog_${batchId}`);
      if (stored) {
        const d = JSON.parse(stored) as BatchCalendarProgress;
        return {
          ...d,
          skillProgress: d.skillProgress || d.completedDays || {},
          literacyProgress: d.literacyProgress || {},
          currentSkillDay: d.currentSkillDay || d.currentDay || 1,
          currentLiteracyDay: d.currentLiteracyDay || 1,
          currentDay: d.currentDay || 1,
        };
      }
    } catch (e) {}

    // Default initialized progress
    const defaultProgress: BatchCalendarProgress = {
      id: docId,
      batchId,
      currentDay: 1,
      currentSkillDay: 1,
      currentLiteracyDay: 1,
      skillProgress: {},
      literacyProgress: {},
      completedDays: {},
      updatedAt: Date.now()
    };
    return defaultProgress;
  },

  /**
   * Save calendar progress for a batch (audited)
   */
  async saveBatchCalendarProgress(progress: BatchCalendarProgress): Promise<void> {
    const docId = `progress_${progress.batchId}`;
    const cleanData = sanitizeForFirestore({
      ...progress,
      id: docId,
      updatedAt: Date.now()
    });

    try {
      localStorage.setItem(`bnfe_cal_prog_${progress.batchId}`, JSON.stringify(cleanData));
    } catch (e) {}

    try {
      await recordAuditedSave({
        collectionName: 'batch_calendar_progress',
        item: cleanData,
        module: 'batches',
        targetLabel: `ক্যালেন্ডার অগ্রগতি (${progress.batchId})`,
      });
    } catch (err) {
      console.warn("Firestore saveBatchCalendarProgress error, saved locally:", err);
    }
    this.broadcastSync('batches');
  },

  /**
   * Mark Skill Day completion by Skill Trainer
   */
  async updateSkillDayCompletion(
    batchId: string,
    dayNumber: number,
    status: Partial<DayCompletionStatus>
  ): Promise<BatchCalendarProgress> {
    const current = await this.getBatchCalendarProgress(batchId);
    const existing = current.skillProgress?.[dayNumber] || { isCompleted: false };

    const updatedStatus: DayCompletionStatus = {
      ...existing,
      ...status,
      trainerType: 'Skill Trainer',
      updatedAt: Date.now()
    };

    const newSkillProgress = {
      ...(current.skillProgress || {}),
      [dayNumber]: updatedStatus
    };

    let nextSkillDay = current.currentSkillDay || 1;
    if (updatedStatus.isCompleted && dayNumber === nextSkillDay && dayNumber < 92) {
      nextSkillDay = dayNumber + 1;
    }

    const newProgress: BatchCalendarProgress = {
      ...current,
      currentSkillDay: nextSkillDay,
      skillProgress: newSkillProgress,
      completedDays: newSkillProgress,
      updatedAt: Date.now()
    };

    await this.saveBatchCalendarProgress(newProgress);

    // Save audit record to dedicated `calendar_progress_logs` table
    try {
      const batches = await this.getItems<Batch>('batches');
      const bObj = batches.find(b => b.id === batchId);
      const trades = await this.getItems<Trade>('trades');
      const tObj = trades.find(t => t.id === bObj?.tradeId);
      const skillModules = await this.getBatchSkillModules(batchId);
      const sMod = skillModules.find(m => m.dayNumber === dayNumber);

      const logId = `cpl_${batchId}_skill_d${dayNumber}_${Date.now()}`;
      const logRecord: CalendarProgressLog = {
        id: logId,
        batchId,
        batchName: bObj?.name || 'ব্যাচ',
        tradeId: bObj?.tradeId || 'TRD-BC-01',
        tradeName: tObj?.name || 'ট্রেড',
        instituteId: bObj?.instituteId,
        dayNumber,
        moduleType: 'skill',
        moduleId: sMod?.id,
        taskNo: sMod?.taskNo || `কাজ ${dayNumber}`,
        topic: sMod?.topic || '',
        isCompleted: !!updatedStatus.isCompleted,
        completedAt: updatedStatus.completedAt || new Date().toISOString().split('T')[0],
        trainerId: updatedStatus.trainerId,
        trainerName: updatedStatus.trainerName || 'স্কিল ট্রেইনার',
        trainerType: 'Skill Trainer',
        remarks: updatedStatus.remarks || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.saveItem('calendar_progress_logs', sanitizeForFirestore(logRecord), { skipAudit: true });
      this.broadcastSync('calendar_progress_logs');
    } catch (e) {
      console.warn("Could not record skill progress log:", e);
    }

    return newProgress;
  },

  /**
   * Mark Literacy Day completion by Literacy Trainer
   */
  async updateLiteracyDayCompletion(
    batchId: string,
    dayNumber: number,
    status: Partial<DayCompletionStatus>
  ): Promise<BatchCalendarProgress> {
    const current = await this.getBatchCalendarProgress(batchId);
    const existing = current.literacyProgress?.[dayNumber] || { isCompleted: false };

    const updatedStatus: DayCompletionStatus = {
      ...existing,
      ...status,
      trainerType: 'Literacy Trainer',
      updatedAt: Date.now()
    };

    const newLiteracyProgress = {
      ...(current.literacyProgress || {}),
      [dayNumber]: updatedStatus
    };

    let nextLiteracyDay = current.currentLiteracyDay || 1;
    if (updatedStatus.isCompleted && dayNumber === nextLiteracyDay && dayNumber < 92) {
      nextLiteracyDay = dayNumber + 1;
    }

    const newProgress: BatchCalendarProgress = {
      ...current,
      currentLiteracyDay: nextLiteracyDay,
      literacyProgress: newLiteracyProgress,
      updatedAt: Date.now()
    };

    await this.saveBatchCalendarProgress(newProgress);

    // Save audit record to dedicated `calendar_progress_logs` table
    try {
      const batches = await this.getItems<Batch>('batches');
      const bObj = batches.find(b => b.id === batchId);
      const trades = await this.getItems<Trade>('trades');
      const tObj = trades.find(t => t.id === bObj?.tradeId);
      const literacyModules = await this.getBatchLiteracyModules(batchId);
      const lMod = literacyModules.find(m => m.dayNumber === dayNumber);

      const logId = `cpl_${batchId}_literacy_d${dayNumber}_${Date.now()}`;
      const logRecord: CalendarProgressLog = {
        id: logId,
        batchId,
        batchName: bObj?.name || 'ব্যাচ',
        tradeId: bObj?.tradeId || 'TRD-BC-01',
        tradeName: tObj?.name || 'ট্রেড',
        instituteId: bObj?.instituteId,
        dayNumber,
        moduleType: 'literacy',
        moduleId: lMod?.id,
        taskNo: lMod?.taskNo || `কাজ ${dayNumber}`,
        topic: lMod?.topic || '',
        isCompleted: !!updatedStatus.isCompleted,
        completedAt: updatedStatus.completedAt || new Date().toISOString().split('T')[0],
        trainerId: updatedStatus.trainerId,
        trainerName: updatedStatus.trainerName || 'লিটারেসি ট্রেইনার',
        trainerType: 'Literacy Trainer',
        remarks: updatedStatus.remarks || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.saveItem('calendar_progress_logs', sanitizeForFirestore(logRecord), { skipAudit: true });
      this.broadcastSync('calendar_progress_logs');
    } catch (e) {
      console.warn("Could not record literacy progress log:", e);
    }

    return newProgress;
  },

  /**
   * Dedicated queries for Calendar Progress Logs Table
   */
  async getCalendarProgressLogs(batchId?: string): Promise<CalendarProgressLog[]> {
    try {
      let logs = await this.getItems<CalendarProgressLog>('calendar_progress_logs');

      // If no dedicated log records exist yet, synthesize from batch_calendar_progress to guarantee accountability visibility
      if (logs.length === 0) {
        try {
          const progresses = await this.getItems<BatchCalendarProgress>('batch_calendar_progress');
          const batches = await this.getItems<Batch>('batches');
          const trades = await this.getItems<Trade>('trades');

          const synthesized: CalendarProgressLog[] = [];
          for (const prog of progresses) {
            const b = batches.find(x => x.id === prog.batchId);
            const t = trades.find(x => x.id === b?.tradeId);

            // Check skill progress
            if (prog.skillProgress) {
              for (const [dayStr, status] of Object.entries(prog.skillProgress)) {
                if (status && status.isCompleted) {
                  const dayNum = parseInt(dayStr, 10);
                  synthesized.push({
                    id: `synth_log_${prog.batchId}_skill_${dayNum}`,
                    batchId: prog.batchId,
                    batchName: b?.name || prog.batchId,
                    tradeId: b?.tradeId,
                    tradeName: t?.name,
                    instituteId: b?.instituteId,
                    dayNumber: dayNum,
                    moduleType: 'skill',
                    taskNo: `কাজ ${dayNum}`,
                    topic: `স্কিল মডিউল দিবস #${dayNum}`,
                    isCompleted: true,
                    completedAt: status.completedAt || new Date().toISOString().split('T')[0],
                    trainerId: status.trainerId || b?.skillTrainerId,
                    trainerName: status.trainerName || b?.skillTrainerName || 'স্কিল ট্রেইনার',
                    trainerType: 'Skill Trainer',
                    remarks: status.remarks || 'মডিউল সমাপ্তি মার্ক করা হয়েছে',
                    createdAt: status.updatedAt || Date.now(),
                    updatedAt: status.updatedAt || Date.now()
                  });
                }
              }
            }

            // Check literacy progress
            if (prog.literacyProgress) {
              for (const [dayStr, status] of Object.entries(prog.literacyProgress)) {
                if (status && status.isCompleted) {
                  const dayNum = parseInt(dayStr, 10);
                  synthesized.push({
                    id: `synth_log_${prog.batchId}_literacy_${dayNum}`,
                    batchId: prog.batchId,
                    batchName: b?.name || prog.batchId,
                    tradeId: b?.tradeId,
                    tradeName: t?.name,
                    instituteId: b?.instituteId,
                    dayNumber: dayNum,
                    moduleType: 'literacy',
                    taskNo: `কাজ ${dayNum}`,
                    topic: `লিটারেসি মডিউল দিবস #${dayNum}`,
                    isCompleted: true,
                    completedAt: status.completedAt || new Date().toISOString().split('T')[0],
                    trainerId: status.trainerId || b?.literacyTrainerId,
                    trainerName: status.trainerName || b?.literacyTrainerName || 'লিটারেসি ট্রেইনার',
                    trainerType: 'Literacy Trainer',
                    remarks: status.remarks || 'মডিউল সমাপ্তি মার্ক করা হয়েছে',
                    createdAt: status.updatedAt || Date.now(),
                    updatedAt: status.updatedAt || Date.now()
                  });
                }
              }
            }
          }

          if (synthesized.length > 0) {
            logs = synthesized;
          }
        } catch (synthErr) {
          console.warn("Notice checking fallback calendar progress:", synthErr);
        }
      }

      if (batchId) {
        return logs
          .filter(l => l.batchId === batchId)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      return logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (e) {
      console.warn("Failed to get calendar progress logs:", e);
      return [];
    }
  },

  async saveCalendarProgressLog(log: CalendarProgressLog): Promise<void> {
    await this.saveItem('calendar_progress_logs', sanitizeForFirestore(log));
    this.broadcastSync('calendar_progress_logs');
  },

  /**
   * Legacy updateDayCompletion
   */
  async updateDayCompletion(
    batchId: string, 
    dayNumber: number, 
    status: Partial<DayCompletionStatus>
  ): Promise<BatchCalendarProgress> {
    return this.updateSkillDayCompletion(batchId, dayNumber, status);
  },

  /**
   * =========================================================================
   * TRADE-BASED SKILL-FOCUSED MODULES (ট্রেড ভিত্তিক স্কিল ফোকাসড মডিউল)
   * =========================================================================
   */
  async getTradeSkillModules(tradeId: string): Promise<TradeSkillModule[]> {
    if (!tradeId) return [];
    try {
      const all = await this.getItems<TradeSkillModule>('trade_skill_modules');
      const filtered = all.filter(m => m.tradeId === tradeId);
      // Sync local storage so stale deleted items from previous sessions are removed
      try {
        localStorage.setItem(`bnfe_trade_skill_modules_${tradeId}`, JSON.stringify(filtered));
      } catch (e) {}
      return filtered.sort((a, b) => a.dayNumber - b.dayNumber);
    } catch (err) {
      console.warn("Error fetching trade_skill_modules, falling back to local:", err);
      // Only fall back to local if Firestore query threw a network error
      try {
        const stored = localStorage.getItem(`bnfe_trade_skill_modules_${tradeId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as TradeSkillModule[];
          return parsed.sort((a, b) => a.dayNumber - b.dayNumber);
        }
      } catch (e) {}
    }

    return [];
  },

  async saveTradeSkillModule(item: TradeSkillModule): Promise<void> {
    const clean = sanitizeForFirestore({
      ...item,
      updatedAt: Date.now()
    });
    await this.saveItem('trade_skill_modules', clean);
    
    try {
      const targetTradeId = item.tradeId || item.batchId || 'TRD-BC-01';
      const current = await this.getTradeSkillModules(targetTradeId);
      const idx = current.findIndex(m => m.id === item.id);
      if (idx >= 0) {
        current[idx] = clean as TradeSkillModule;
      } else {
        current.push(clean as TradeSkillModule);
      }
      localStorage.setItem(`bnfe_trade_skill_modules_${targetTradeId}`, JSON.stringify(current));
    } catch (e) {}

    this.broadcastSync('trades');
  },

  async bulkSaveTradeSkillModules(
    tradeId: string,
    items: TradeSkillModule[],
    replaceExisting = false
  ): Promise<number> {
    if (!tradeId || items.length === 0) return 0;

    let existing = await this.getTradeSkillModules(tradeId);
    if (replaceExisting && existing.length > 0) {
      await recordAuditedBulkDelete({
        collectionName: 'trade_skill_modules',
        docs: existing.map((m) => ({ id: m.id, data: { ...m } as unknown as Record<string, unknown> })),
        module: 'trades',
        title: `স্কিল মডিউল প্রতিস্থাপনের পূর্বে পুরনো মডিউল মোছা হয়েছে (${existing.length} টি)`,
      });
      existing = [];
    }

    let savedCount = 0;
    const toSave: TradeSkillModule[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.id || `tsm_${tradeId}_${item.dayNumber || (i + 1)}_${Date.now()}_${i}`;
      const cleanItem: TradeSkillModule = {
        ...item,
        id,
        tradeId,
        dayNumber: Number(item.dayNumber) || (i + 1),
        totalMinutes: (Number(item.theoryMinutes) || 0) + (Number(item.practicalMinutes) || 0) || item.totalMinutes || 120,
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      toSave.push(sanitizeForFirestore(cleanItem));
      savedCount++;
    }

    for (let i = 0; i < toSave.length; i += 440) {
      const chunk = toSave.slice(i, i + 440);
      const batch = writeBatch(db);
      chunk.forEach((m) => batch.set(doc(db, 'trade_skill_modules', m.id), m, { merge: true }));
      await batch.commit();
    }

    await recordSimpleAuditLog({
      action: 'create',
      module: 'trades',
      collectionName: 'trade_skill_modules',
      targetId: tradeId,
      targetLabel: `${savedCount} টি স্কিল মডিউল`,
      title: `বাল্ক স্কিল মডিউল সংরক্ষণ (${savedCount} টি)`,
      count: savedCount,
    });

    const merged = replaceExisting ? toSave : [...existing.filter(e => !toSave.some(t => t.id === e.id || t.dayNumber === e.dayNumber)), ...toSave];
    try {
      localStorage.setItem(`bnfe_trade_skill_modules_${tradeId}`, JSON.stringify(merged));
    } catch (e) {}

    this.broadcastSync('trades');
    return savedCount;
  },

  async deleteTradeSkillModule(id: string, tradeId?: string): Promise<void> {
    try {
      if (tradeId) {
        const stored = localStorage.getItem(`bnfe_trade_skill_modules_${tradeId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as TradeSkillModule[];
          const filtered = parsed.filter(m => m.id !== id);
          localStorage.setItem(`bnfe_trade_skill_modules_${tradeId}`, JSON.stringify(filtered));
        }
      }
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('bnfe_trade_skill_modules_') || key.startsWith('bnfe_batch_skill_modules_'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list) && list.some((item: any) => item.id === id)) {
                localStorage.setItem(key, JSON.stringify(list.filter((item: any) => item.id !== id)));
              }
            }
          }
        }
      }
    } catch (e) {}

    await this.deleteItem('trade_skill_modules', id);
    this.broadcastSync('trades');
  },

  async seedDefaultSkillModulesForTrade(tradeId: string): Promise<TradeSkillModule[]> {
    const trades = await this.getItems<Trade>('trades');
    const trade = trades.find(t => t.id === tradeId);
    const tradeName = trade?.name || '';
    const list: TradeSkillModule[] = generateTradeSkillCurriculum(tradeId, tradeName);

    try {
      localStorage.setItem(`bnfe_trade_skill_modules_${tradeId}`, JSON.stringify(list));
    } catch (e) {}

    for (let i = 0; i < list.length; i += 440) {
      const chunk = list.slice(i, i + 440);
      const batch = writeBatch(db);
      chunk.forEach((item) => batch.set(doc(db, 'trade_skill_modules', item.id), sanitizeForFirestore(item), { merge: true }));
      batch.commit().catch(() => {});
    }

    recordSimpleAuditLog({
      action: 'create',
      module: 'trades',
      collectionName: 'trade_skill_modules',
      targetId: tradeId,
      targetLabel: tradeName || tradeId,
      title: `ডিফল্ট স্কিল মডিউল লোড (${list.length} টি)`,
      count: list.length,
    }).catch(() => {});

    return list;
  },

  /**
   * =========================================================================
   * TRADE-BASED LITERACY-FOCUSED MODULES (ট্রেড ভিত্তিক লিটারেসি ফোকাসড মডিউল)
   * =========================================================================
   */
  async getTradeLiteracyModules(tradeId: string): Promise<TradeLiteracyModule[]> {
    if (!tradeId) return [];
    try {
      const all = await this.getItems<TradeLiteracyModule>('trade_literacy_modules');
      const filtered = all.filter(m => m.tradeId === tradeId);
      try {
        localStorage.setItem(`bnfe_trade_literacy_modules_${tradeId}`, JSON.stringify(filtered));
      } catch (e) {}
      return filtered.sort((a, b) => a.dayNumber - b.dayNumber);
    } catch (err) {
      console.warn("Error fetching trade_literacy_modules, falling back to local:", err);
      try {
        const stored = localStorage.getItem(`bnfe_trade_literacy_modules_${tradeId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as TradeLiteracyModule[];
          return parsed.sort((a, b) => a.dayNumber - b.dayNumber);
        }
      } catch (e) {}
    }

    return [];
  },

  async saveTradeLiteracyModule(item: TradeLiteracyModule): Promise<void> {
    const clean = sanitizeForFirestore({
      ...item,
      updatedAt: Date.now()
    });
    await this.saveItem('trade_literacy_modules', clean);

    try {
      const targetTradeId = item.tradeId || item.batchId || 'TRD-BC-01';
      const current = await this.getTradeLiteracyModules(targetTradeId);
      const idx = current.findIndex(m => m.id === item.id);
      if (idx >= 0) {
        current[idx] = clean as TradeLiteracyModule;
      } else {
        current.push(clean as TradeLiteracyModule);
      }
      localStorage.setItem(`bnfe_trade_literacy_modules_${targetTradeId}`, JSON.stringify(current));
    } catch (e) {}

    this.broadcastSync('trades');
  },

  async bulkSaveTradeLiteracyModules(
    tradeId: string,
    items: TradeLiteracyModule[],
    replaceExisting = false
  ): Promise<number> {
    if (!tradeId || items.length === 0) return 0;

    let existing = await this.getTradeLiteracyModules(tradeId);
    if (replaceExisting && existing.length > 0) {
      await recordAuditedBulkDelete({
        collectionName: 'trade_literacy_modules',
        docs: existing.map((m) => ({ id: m.id, data: { ...m } as unknown as Record<string, unknown> })),
        module: 'trades',
        title: `লিটারেসি মডিউল প্রতিস্থাপনের পূর্বে পুরনো মডিউল মোছা হয়েছে (${existing.length} টি)`,
      });
      existing = [];
    }

    let savedCount = 0;
    const toSave: TradeLiteracyModule[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.id || `tlm_${tradeId}_${item.dayNumber || (i + 1)}_${Date.now()}_${i}`;
      const cleanItem: TradeLiteracyModule = {
        ...item,
        id,
        tradeId,
        dayNumber: Number(item.dayNumber) || (i + 1),
        totalMinutes: Number(item.totalMinutes) || 120,
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      toSave.push(sanitizeForFirestore(cleanItem));
      savedCount++;
    }

    for (let i = 0; i < toSave.length; i += 440) {
      const chunk = toSave.slice(i, i + 440);
      const batch = writeBatch(db);
      chunk.forEach((m) => batch.set(doc(db, 'trade_literacy_modules', m.id), m, { merge: true }));
      await batch.commit();
    }

    await recordSimpleAuditLog({
      action: 'create',
      module: 'trades',
      collectionName: 'trade_literacy_modules',
      targetId: tradeId,
      targetLabel: `${savedCount} টি লিটারেসি মডিউল`,
      title: `বাল্ক লিটারেসি মডিউল সংরক্ষণ (${savedCount} টি)`,
      count: savedCount,
    });

    const merged = replaceExisting ? toSave : [...existing.filter(e => !toSave.some(t => t.id === e.id || t.dayNumber === e.dayNumber)), ...toSave];
    try {
      localStorage.setItem(`bnfe_trade_literacy_modules_${tradeId}`, JSON.stringify(merged));
    } catch (e) {}

    this.broadcastSync('trades');
    return savedCount;
  },

  async deleteTradeLiteracyModule(id: string, tradeId?: string): Promise<void> {
    try {
      if (tradeId) {
        const stored = localStorage.getItem(`bnfe_trade_literacy_modules_${tradeId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as TradeLiteracyModule[];
          const filtered = parsed.filter(m => m.id !== id);
          localStorage.setItem(`bnfe_trade_literacy_modules_${tradeId}`, JSON.stringify(filtered));
        }
      }
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('bnfe_trade_literacy_modules_') || key.startsWith('bnfe_batch_literacy_modules_'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list) && list.some((item: any) => item.id === id)) {
                localStorage.setItem(key, JSON.stringify(list.filter((item: any) => item.id !== id)));
              }
            }
          }
        }
      }
    } catch (e) {}

    await this.deleteItem('trade_literacy_modules', id);
    this.broadcastSync('trades');
  },

  async seedDefaultLiteracyModulesForTrade(tradeId: string): Promise<TradeLiteracyModule[]> {
    const list: TradeLiteracyModule[] = generateTradeLiteracyCurriculum(tradeId);

    try {
      localStorage.setItem(`bnfe_trade_literacy_modules_${tradeId}`, JSON.stringify(list));
    } catch (e) {}

    for (let i = 0; i < list.length; i += 440) {
      const chunk = list.slice(i, i + 440);
      const batch = writeBatch(db);
      chunk.forEach((item) => batch.set(doc(db, 'trade_literacy_modules', item.id), sanitizeForFirestore(item), { merge: true }));
      batch.commit().catch(() => {});
    }

    recordSimpleAuditLog({
      action: 'create',
      module: 'trades',
      collectionName: 'trade_literacy_modules',
      targetId: tradeId,
      targetLabel: tradeId,
      title: `ডিফল্ট লিটারেসি মডিউল লোড (${list.length} টি)`,
      count: list.length,
    }).catch(() => {});

    return list;
  },

  async seedTradeWithDefaultModules(tradeId: string): Promise<{ skillCount: number; literacyCount: number }> {
    const [skill, literacy] = await Promise.all([
      this.seedDefaultSkillModulesForTrade(tradeId),
      this.seedDefaultLiteracyModulesForTrade(tradeId)
    ]);
    return { skillCount: skill.length, literacyCount: literacy.length };
  },

  /**
   * Clear all modules for a specific trade from Cloud Firestore and local cache (audited)
   */
  async clearTradeModules(tradeId: string): Promise<{ skillDeleted: number; literacyDeleted: number }> {
    if (!tradeId) return { skillDeleted: 0, literacyDeleted: 0 };
    const [skillSnap, litSnap] = await Promise.all([
      getDocs(collection(db, 'trade_skill_modules')),
      getDocs(collection(db, 'trade_literacy_modules')),
    ]);

    const tradeSkills = skillSnap.docs
      .filter((d) => d.data().tradeId === tradeId)
      .map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }));

    const tradeLiteracy: AuditRelatedDoc[] = litSnap.docs
      .filter((d) => d.data().tradeId === tradeId)
      .map((d) => ({
        collection: 'trade_literacy_modules',
        id: d.id,
        data: { id: d.id, ...d.data() } as Record<string, unknown>,
      }));

    await recordAuditedBulkDelete({
      collectionName: 'trade_skill_modules',
      docs: tradeSkills,
      relatedDocs: tradeLiteracy,
      module: 'trades',
      title: `ট্রেডের সকল কারিকুলাম মডিউল খালি করা হয়েছে (স্কিল: ${tradeSkills.length}, লিটারেসি: ${tradeLiteracy.length})`,
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`bnfe_trade_skill_modules_${tradeId}`);
        localStorage.removeItem(`bnfe_trade_literacy_modules_${tradeId}`);
      } catch (e) {}
    }

    this.broadcastSync('trades');
    return { skillDeleted: tradeSkills.length, literacyDeleted: tradeLiteracy.length };
  },

  /**
   * Clear all trade curriculum modules and batch calendar progress (audited)
   */
  async clearAllTradeCalendarData(): Promise<{ skillDeleted: number; literacyDeleted: number; progressDeleted: number; logsDeleted: number }> {
    const [skills, literacy, progress, logs] = await Promise.all([
      getDocs(collection(db, 'trade_skill_modules')),
      getDocs(collection(db, 'trade_literacy_modules')),
      getDocs(collection(db, 'batch_calendar_progress')),
      getDocs(collection(db, 'calendar_progress_logs')),
    ]);

    const skillDocs = skills.docs.map((d) => ({ id: d.id, data: { id: d.id, ...d.data() } as Record<string, unknown> }));
    const relatedDocs: AuditRelatedDoc[] = [
      ...literacy.docs.map((d) => ({ collection: 'trade_literacy_modules', id: d.id, data: { id: d.id, ...d.data() } })),
      ...progress.docs.map((d) => ({ collection: 'batch_calendar_progress', id: d.id, data: { id: d.id, ...d.data() } })),
      ...logs.docs.map((d) => ({ collection: 'calendar_progress_logs', id: d.id, data: { id: d.id, ...d.data() } })),
    ];

    await recordAuditedBulkDelete({
      collectionName: 'trade_skill_modules',
      docs: skillDocs,
      relatedDocs,
      module: 'trades',
      title: `সকল ট্রেড কারিকুলাম ও ক্যালেন্ডার অগ্রগতি মোছা হয়েছে`,
    });

    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('bnfe_trade_skill_modules_') || key.startsWith('bnfe_trade_literacy_modules_') || key.startsWith('bnfe_cal_prog_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
    }

    this.broadcastSync('trades');
    this.broadcastSync('batches');
    this.broadcastSync('calendar_progress_logs');
    return {
      skillDeleted: skills.size,
      literacyDeleted: literacy.size,
      progressDeleted: progress.size,
      logsDeleted: logs.size,
    };
  },

  /**
   * Batch module getters that inherit from the Batch's Trade
   */
  async getBatchSkillModules(batchId: string): Promise<TradeSkillModule[]> {
    if (!batchId) return [];
    try {
      const batches = await this.getItems<Batch>('batches');
      const found = batches.find(b => b.id === batchId);
      if (found && found.tradeId) {
        return this.getTradeSkillModules(found.tradeId);
      }
    } catch (e) {}
    return [];
  },

  async getBatchLiteracyModules(batchId: string): Promise<TradeLiteracyModule[]> {
    if (!batchId) return [];
    try {
      const batches = await this.getItems<Batch>('batches');
      const found = batches.find(b => b.id === batchId);
      if (found && found.tradeId) {
        return this.getTradeLiteracyModules(found.tradeId);
      }
    } catch (e) {}
    return [];
  },

  async saveBatchSkillModule(item: any): Promise<void> {
    return this.saveTradeSkillModule(item as TradeSkillModule);
  },

  async bulkSaveBatchSkillModules(batchId: string, items: any[], replaceExisting = false): Promise<number> {
    const batches = await this.getItems<Batch>('batches');
    const found = batches.find(b => b.id === batchId);
    const tradeId = found?.tradeId || 'TRD-BC-01';
    return this.bulkSaveTradeSkillModules(tradeId, items, replaceExisting);
  },

  async deleteBatchSkillModule(id: string, batchId?: string): Promise<void> {
    return this.deleteTradeSkillModule(id);
  },

  async saveBatchLiteracyModule(item: any): Promise<void> {
    return this.saveTradeLiteracyModule(item as TradeLiteracyModule);
  },

  async bulkSaveBatchLiteracyModules(batchId: string, items: any[], replaceExisting = false): Promise<number> {
    const batches = await this.getItems<Batch>('batches');
    const found = batches.find(b => b.id === batchId);
    const tradeId = found?.tradeId || 'TRD-BC-01';
    return this.bulkSaveTradeLiteracyModules(tradeId, items, replaceExisting);
  },

  async deleteBatchLiteracyModule(id: string, batchId?: string): Promise<void> {
    return this.deleteTradeLiteracyModule(id);
  },

  async seedBatchWithDefaultModules(batchId: string): Promise<{ skillCount: number; literacyCount: number }> {
    const batches = await this.getItems<Batch>('batches');
    const found = batches.find(b => b.id === batchId);
    const tradeId = found?.tradeId || 'TRD-BC-01';
    return this.seedTradeWithDefaultModules(tradeId);
  },

  /**
   * Comprehensive factory reset: Wipe operational data across Cloud Firestore.
   * NEVER deletes `activityLogs` or its `snapshots` subcollection; writes ONE non-restorable `bulk_delete` audit log entry.
   */
  async purgeAllSystemData(
    options?: {
      keepInstitutesAndTrades?: boolean;
      keepRoles?: boolean;
      keepLogs?: boolean;
    },
    actor?: AuditActor
  ): Promise<Record<string, number>> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। ডাটা মুছতে চাইলে প্রথমে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const results: Record<string, number> = {};

    // 1. Attendance
    const attendance = await this.getItems<AttendanceRecord>('attendance');
    results['attendance'] = await batchDeleteDocuments('attendance', attendance.map(a => a.id));

    // 2. Marks
    const marks = await this.getItems<ExamMark>('marks');
    results['marks'] = await batchDeleteDocuments('marks', marks.map(m => m.id));

    // 3. Exams
    const exams = await this.getItems<Exam>('exams');
    results['exams'] = await batchDeleteDocuments('exams', exams.map(e => e.id));

    // 4. Trainees
    const trainees = await this.getItems<Trainee>('trainees');
    results['trainees'] = await batchDeleteDocuments('trainees', trainees.map(t => t.id));

    // 5. Batches
    const batches = await this.getItems<Batch>('batches');
    results['batches'] = await batchDeleteDocuments('batches', batches.map(b => b.id));

    // 6. Institutes & Trades (optional)
    if (!options?.keepInstitutesAndTrades) {
      const trades = await this.getItems<Trade>('trades');
      results['trades'] = await batchDeleteDocuments('trades', trades.map(t => t.id));

      const institutes = await this.getItems<Institute>('institutes');
      results['institutes'] = await batchDeleteDocuments('institutes', institutes.map(i => i.id));
    }

    const totalPurged = Object.values(results).reduce((sum, n) => sum + (n || 0), 0);

    // Audit Log collection (`activityLogs`) is NEVER deleted during factory reset.
    // Record a single non-restorable `bulk_delete` entry (`snapshotComplete: false`).
    await recordAuditedBulkDelete({
      collectionName: 'system',
      docs: [],
      module: 'settings',
      targetLabel: `ফ্যাক্টরি রিসেট (${totalPurged} টি রেকর্ড)`,
      title: `সম্পূর্ণ সিস্টেম ফ্যাক্টরি রিসেট সম্পন্ন হয়েছে (মোট ${totalPurged} টি রেকর্ড মোছা হয়েছে)`,
      snapshotComplete: false,
      skipDeletes: true,
      totalCountOverride: totalPurged,
      actor,
    });

    // Clear local storage cache
    this.clearAllLocalData();
    this.broadcastSync('all');

    return results;
  }
};

