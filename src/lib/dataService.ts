import { db } from './firebase';
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
  DEFAULT_INSTITUTES,
  DEFAULT_TRADES,
  DEFAULT_BATCHES,
  generate20TraineesForBatch,
  generateSampleAttendance
} from './demoTraineesSeed';
import { DEFAULT_ROLES, ALL_PERMISSION_KEYS } from './permissions';
import { toTimestampNumber } from './dateUtils';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  allowDataDeletion: true,
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
   * Save or update an item directly in Cloud Firestore
   */
  async saveItem<T extends { id: string }>(collectionName: string, item: T): Promise<T> {
    const cleanItem = sanitizeForFirestore(item);
    
    // Commit directly to Cloud Firestore
    const docRef = doc(db, collectionName, cleanItem.id);
    await setDoc(docRef, cleanItem, { merge: true });

    this.broadcastSync(collectionName);
    return cleanItem as T;
  },

  /**
   * Delete an item by ID directly from Cloud Firestore (guarded by settings deletion lock)
   */
  async deleteItem(collectionName: string, id: string): Promise<void> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);

    this.broadcastSync(collectionName);
  },

  /**
   * Batch save attendance records atomically directly in Cloud Firestore
   * Enforces idempotent primary keys (ATT_${batchId}_${date}_${traineeId}) to prevent duplicates.
   */
  async saveAttendanceBatch(records: AttendanceRecord[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!records || records.length === 0) return { success: true, count: 0 };

    try {
      // Deduplicate by composite key (batchId + date + traineeId)
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

      // Commit to Cloud Firestore in chunks of up to 450 items (Firestore limit is 500)
      const chunkSize = 450;
      for (let i = 0; i < uniqueRecords.length; i += chunkSize) {
        const chunk = uniqueRecords.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach(rec => {
          const ref = doc(db, 'attendance', rec.id);
          batch.set(ref, rec, { merge: true });
        });

        await batch.commit();
      }

      this.broadcastSync('attendance');
      return { success: true, count: uniqueRecords.length };
    } catch (firestoreErr: any) {
      console.error("Cloud Firestore batch attendance save error:", firestoreErr);
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
    const trainees = await this.getItems<Trainee>('trainees');
    const normalized = regNo.trim().toLowerCase();
    return trainees.some(t => t.registrationNumber?.trim().toLowerCase() === normalized && t.id !== excludeId);
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
    let totalAdded = 0;

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const b = batches[bIdx];
      const currentInBatch = existingTrainees.filter(t => t.batchId === b.id);
      if (currentInBatch.length >= 20 && !forceOverwrite) {
        continue;
      }

      const generated = generate20TraineesForBatch(b, bIdx, bIdx * 20);
      for (const t of generated) {
        await this.saveItem('trainees', t);
        totalAdded++;
      }
    }

    this.broadcastSync('trainees');
    return totalAdded;
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
          allowDataDeletion: data.allowDataDeletion !== undefined ? !!data.allowDataDeletion : true
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
    return cachedSystemSettings.allowDataDeletion !== false;
  },

  /**
   * Save or update system settings directly in Cloud Firestore
   */
  async saveSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const docRef = doc(db, 'settings', 'system_config');
    const merged: SystemSettings = {
      ...cachedSystemSettings,
      ...updates,
      updatedAt: Date.now()
    };
    const clean = sanitizeForFirestore(merged);
    await setDoc(docRef, clean, { merge: true });
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
          allowDataDeletion: data.allowDataDeletion !== undefined ? !!data.allowDataDeletion : true
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
   * Delete attendance records directly from Cloud Firestore
   * Supports filtering by batchId, date, or deleting all attendance.
   */
  async deleteAttendance(filter?: { batchId?: string; date?: string; instituteId?: string }): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। অনুগ্রহ করে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const allRecords = await this.getItems<AttendanceRecord>('attendance');
    let toDelete = allRecords;

    if (filter) {
      if (filter.batchId) toDelete = toDelete.filter(r => r.batchId === filter.batchId);
      if (filter.date) toDelete = toDelete.filter(r => r.date === filter.date);
      if (filter.instituteId) toDelete = toDelete.filter(r => r.instituteId === filter.instituteId);
    }

    const ids = toDelete.map(r => r.id);
    const count = await batchDeleteDocuments('attendance', ids);
    this.broadcastSync('attendance');
    return count;
  },

  /**
   * Delete all trainees directly from Cloud Firestore, with option to delete attendance too
   */
  async deleteAllTrainees(options?: { batchId?: string; deleteAttendanceToo?: boolean }): Promise<{ deletedTrainees: number; deletedAttendance: number }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। অনুগ্রহ করে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const trainees = await this.getItems<Trainee>('trainees');
    const targetTrainees = options?.batchId 
      ? trainees.filter(t => t.batchId === options.batchId)
      : trainees;

    const traineeIds = targetTrainees.map(t => t.id);
    const deletedTrainees = await batchDeleteDocuments('trainees', traineeIds);

    let deletedAttendance = 0;
    if (options?.deleteAttendanceToo !== false) {
      const attendance = await this.getItems<AttendanceRecord>('attendance');
      const targetAttendance = options?.batchId
        ? attendance.filter(a => a.batchId === options.batchId)
        : attendance;
      deletedAttendance = await batchDeleteDocuments('attendance', targetAttendance.map(a => a.id));
    }

    this.broadcastSync('trainees');
    this.broadcastSync('attendance');
    return { deletedTrainees, deletedAttendance };
  },

  /**
   * Delete all exams and marks directly from Cloud Firestore
   */
  async deleteAllExamsAndMarks(options?: { batchId?: string }): Promise<{ deletedExams: number; deletedMarks: number }> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। অনুগ্রহ করে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    const exams = await this.getItems<Exam>('exams');
    const marks = await this.getItems<ExamMark>('marks');

    const targetExams = options?.batchId ? exams.filter(e => e.batchId === options.batchId) : exams;
    const targetMarks = options?.batchId ? marks.filter(m => m.batchId === options.batchId) : marks;

    const deletedMarks = await batchDeleteDocuments('marks', targetMarks.map(m => m.id));
    const deletedExams = await batchDeleteDocuments('exams', targetExams.map(e => e.id));

    this.broadcastSync('marks');
    this.broadcastSync('exams');
    return { deletedExams, deletedMarks };
  },

  /**
   * Delete all batches
   */
  async deleteAllBatches(): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে।");
    }
    const batches = await this.getItems<Batch>('batches');
    const count = await batchDeleteDocuments('batches', batches.map(b => b.id));
    this.broadcastSync('batches');
    return count;
  },

  /**
   * Delete all trades
   */
  async deleteAllTrades(): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে।");
    }
    const trades = await this.getItems<Trade>('trades');
    const count = await batchDeleteDocuments('trades', trades.map(t => t.id));
    this.broadcastSync('trades');
    return count;
  },

  /**
   * Delete all institutes
   */
  async deleteAllInstitutes(): Promise<number> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে।");
    }
    const institutes = await this.getItems<Institute>('institutes');
    const count = await batchDeleteDocuments('institutes', institutes.map(i => i.id));
    this.broadcastSync('institutes');
    return count;
  },

  /**
   * Delete a single institute and unassign it from any linked batches
   */
  async deleteInstitute(id: string): Promise<void> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    // 1. Delete institute doc from Firestore
    await deleteDoc(doc(db, 'institutes', id));

    // 2. Unassign linked batches
    try {
      const snap = await getDocs(collection(db, 'batches'));
      const batchWrites = writeBatch(db);
      let updatedCount = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.instituteId === id) {
          batchWrites.update(doc(db, 'batches', d.id), { instituteId: '' });
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        await batchWrites.commit();
        this.broadcastSync('batches');
      }
    } catch (e) {
      console.warn("Could not unassign batches for deleted institute:", e);
    }

    this.broadcastSync('institutes');
  },

  /**
   * Delete a single trade and unassign it from any linked batches
   */
  async deleteTrade(id: string): Promise<void> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    // 1. Delete trade doc from Firestore
    await deleteDoc(doc(db, 'trades', id));

    // 2. Unassign linked batches
    try {
      const snap = await getDocs(collection(db, 'batches'));
      const batchWrites = writeBatch(db);
      let updatedCount = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.tradeId === id) {
          batchWrites.update(doc(db, 'batches', d.id), { tradeId: '' });
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        await batchWrites.commit();
        this.broadcastSync('batches');
      }
    } catch (e) {
      console.warn("Could not unassign batches for deleted trade:", e);
    }

    this.broadcastSync('trades');
  },

  /**
   * Delete a single batch with optional cascade delete of attendance & trainees
   */
  async deleteBatch(id: string, cascade: boolean = true): Promise<void> {
    const settings = await this.getSystemSettings();
    if (!settings.allowDataDeletion) {
      throw new Error("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
    }

    // 1. Delete batch doc
    await deleteDoc(doc(db, 'batches', id));

    if (cascade) {
      // Delete attendance for this batch
      const attSnap = await getDocs(collection(db, 'attendance'));
      const attIds = attSnap.docs.filter(d => d.data().batchId === id).map(d => d.id);
      await batchDeleteDocuments('attendance', attIds);

      // Delete trainees for this batch
      const trnSnap = await getDocs(collection(db, 'trainees'));
      const trnIds = trnSnap.docs.filter(d => d.data().batchId === id).map(d => d.id);
      await batchDeleteDocuments('trainees', trnIds);

      // Delete exams and marks for this batch
      const exmSnap = await getDocs(collection(db, 'exams'));
      const exmIds = exmSnap.docs.filter(d => d.data().batchId === id).map(d => d.id);
      await batchDeleteDocuments('exams', exmIds);

      const mrkSnap = await getDocs(collection(db, 'marks'));
      const mrkIds = mrkSnap.docs.filter(d => d.data().batchId === id).map(d => d.id);
      await batchDeleteDocuments('marks', mrkIds);
    }

    this.broadcastSync('batches');
    this.broadcastSync('trainees');
    this.broadcastSync('attendance');
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
   * Comprehensive factory reset: Wipe all data across Cloud Firestore
   */
  async purgeAllSystemData(options?: { 
    keepInstitutesAndTrades?: boolean; 
    keepRoles?: boolean;
    keepLogs?: boolean;
  }): Promise<Record<string, number>> {
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

    // 7. Activity Logs (optional)
    if (!options?.keepLogs) {
      const logs = await this.getItems<ActivityLog>('activityLogs');
      results['activityLogs'] = await batchDeleteDocuments('activityLogs', logs.map(l => l.id));
    }

    // Clear local storage cache
    this.clearAllLocalData();
    this.broadcastSync('all');

    return results;
  }
};

