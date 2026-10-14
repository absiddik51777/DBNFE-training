import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Institute, 
  Trade, 
  Batch, 
  Trainee, 
  AttendanceRecord, 
  Exam, 
  ExamMark, 
  UserProfile 
} from '../types';
import {
  DEFAULT_INSTITUTES,
  DEFAULT_TRADES,
  DEFAULT_BATCHES,
  generate20TraineesForBatch,
  generateSampleAttendance
} from './demoTraineesSeed';
import { toTimestampNumber } from './dateUtils';

/**
 * Normalizes document data coming from Firestore or cache so missing fields or alternative names
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
    item.code = item.code || item.tradeCode || `TRD-${item.id.slice(-4)}`;
    item.description = item.description || '';
    item.duration = item.duration || '৬ মাস (৩৬০ ঘণ্টা)';
    item.status = item.status || 'Active';
    item.createdAt = toTimestampNumber(item.createdAt);
  } else if (col === 'batches') {
    item.name = item.name || item.batchName || item.nameBn || 'নামবিহীন ব্যাচ';
    item.instituteId = item.instituteId || item.institute || '';
    item.tradeId = item.tradeId || item.trade || '';
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
  }

  return item as T;
}

export const dataService = {
  /**
   * Fetch items for a collection, querying Firestore with graceful offline caching fallback.
   */
  async getItems<T extends { id: string }>(collectionName: string): Promise<T[]> {
    const storageKey = `bnfe_cache_${collectionName}`;
    let cachedList: T[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedList = parsed.map(item => normalizeDoc<T>(collectionName, item, item.id));
        }
      }
    } catch (e) {
      console.warn(`Local cache read error for ${collectionName}:`, e);
    }

    try {
      const snap = await getDocs(collection(db, collectionName));
      if (snap && snap.docs && snap.docs.length > 0) {
        const firestoreList = snap.docs.map(d => normalizeDoc<T>(collectionName, d.data(), d.id));
        
        // Merge Firestore items with cached items
        const itemMap = new Map<string, T>();
        cachedList.forEach(c => itemMap.set(c.id, c));
        firestoreList.forEach(f => itemMap.set(f.id, f));
        cachedList = Array.from(itemMap.values());

        try {
          localStorage.setItem(storageKey, JSON.stringify(cachedList));
        } catch (e) {}
      }
    } catch (firestoreErr) {
      // offline mode or permission notice (expected when rules require auth)
    }

    // Default initialization if still empty
    if (cachedList.length === 0) {
      if (collectionName === 'institutes') {
        cachedList = DEFAULT_INSTITUTES as unknown as T[];
        try { localStorage.setItem(storageKey, JSON.stringify(cachedList)); } catch (e) {}
      } else if (collectionName === 'trades') {
        cachedList = DEFAULT_TRADES as unknown as T[];
        try { localStorage.setItem(storageKey, JSON.stringify(cachedList)); } catch (e) {}
      } else if (collectionName === 'batches') {
        // If we have institutes, assign batches to the real institute IDs
        const existingInsts = await this.getItems<Institute>('institutes');
        const instId1 = existingInsts[0]?.id || 'INS-HLG-01';
        const instId2 = existingInsts[1]?.id || instId1;
        
        const initialBatches: Batch[] = DEFAULT_BATCHES.map((b, idx) => ({
          ...b,
          instituteId: idx === 2 ? instId2 : instId1
        }));

        cachedList = initialBatches as unknown as T[];
        try { localStorage.setItem(storageKey, JSON.stringify(cachedList)); } catch (e) {}
      } else if (collectionName === 'trainees') {
        // Automatically seed 20 demo trainees for every batch
        const seeded = await this.seedDemoTraineesForAllBatches();
        return seeded as unknown as T[];
      }
    } else if (collectionName === 'trainees') {
      // Check if any existing batch has 0 trainees; if so, populate demo trainees
      const batches = await this.getItems<Batch>('batches');
      const existingTrainees = cachedList as unknown as Trainee[];
      const batchesNeedingTrainees = batches.filter(b => 
        !existingTrainees.some(t => t.batchId === b.id)
      );

      if (batchesNeedingTrainees.length > 0) {
        const updated = await this.seedDemoTraineesForAllBatches(false);
        return updated as unknown as T[];
      }
    }

    return cachedList;
  },

  /**
   * Seed exactly 20 demo trainees for every batch in the system.
   * If a batch already has 20 trainees, it leaves them unless forceRecreate is true.
   */
  async seedDemoTraineesForAllBatches(forceRecreate = false): Promise<Trainee[]> {
    // 1. Ensure institutes, trades, and batches exist
    let batches = await this.getItems<Batch>('batches');
    if (!batches || batches.length === 0) {
      batches = DEFAULT_BATCHES;
      try {
        localStorage.setItem('bnfe_cache_batches', JSON.stringify(batches));
      } catch (e) {}
    }

    const traineesStorageKey = 'bnfe_cache_trainees';
    let currentTrainees: Trainee[] = [];
    try {
      const raw = localStorage.getItem(traineesStorageKey);
      if (raw) currentTrainees = JSON.parse(raw);
    } catch (e) {}

    let globalStartIndex = currentTrainees.length;
    const allNewTrainees: Trainee[] = [];
    const allNewAttendance: AttendanceRecord[] = [];

    let updatedTraineesList = forceRecreate ? [] : [...currentTrainees];

    batches.forEach((batch, bIdx) => {
      const existingInBatch = updatedTraineesList.filter(t => t.batchId === batch.id);

      if (forceRecreate || existingInBatch.length < 20) {
        // Generate full set of 20 demo trainees for this batch
        const generated = generate20TraineesForBatch(batch, bIdx, globalStartIndex);
        globalStartIndex += 20;

        if (forceRecreate) {
          updatedTraineesList = updatedTraineesList.filter(t => t.batchId !== batch.id).concat(generated);
        } else if (existingInBatch.length === 0) {
          updatedTraineesList.push(...generated);
        } else {
          const needed = 20 - existingInBatch.length;
          const sliceToAdd = generated.slice(0, needed);
          updatedTraineesList.push(...sliceToAdd);
        }

        allNewTrainees.push(...generated);

        // Generate sample attendance records for this month
        const attendanceSample = generateSampleAttendance(batch, generated);
        allNewAttendance.push(...attendanceSample);
      }
    });

    // Save trainees to cache
    try {
      localStorage.setItem(traineesStorageKey, JSON.stringify(updatedTraineesList));
    } catch (e) {}

    // Save attendance to cache
    if (allNewAttendance.length > 0) {
      await this.saveAttendanceBatch(allNewAttendance);
    }

    // Background sync to Firestore if possible
    setTimeout(() => {
      allNewTrainees.forEach(t => {
        setDoc(doc(db, 'trainees', t.id), t, { merge: true }).catch(() => {});
      });
    }, 100);

    return updatedTraineesList;
  },

  /**
   * Save or update an item in both local cache and Firestore
   */
  async saveItem<T extends { id: string }>(collectionName: string, item: T): Promise<T> {
    const storageKey = `bnfe_cache_${collectionName}`;
    try {
      const current = await this.getItems<T>(collectionName);
      const existingIdx = current.findIndex(x => x.id === item.id);
      let updated: T[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = item;
      } else {
        updated = [item, ...current];
      }
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn(`Failed to update localStorage for ${collectionName}:`, e);
    }

    try {
      await setDoc(doc(db, collectionName, item.id), item, { merge: true });
    } catch (firestoreErr) {
      console.warn(`Firestore sync for ${collectionName}/${item.id} skipped (offline mode):`, firestoreErr);
    }

    return item;
  },

  /**
   * Delete an item by ID from local cache and Firestore
   */
  async deleteItem(collectionName: string, id: string): Promise<void> {
    const storageKey = `bnfe_cache_${collectionName}`;
    try {
      const current = await this.getItems<{ id: string }>(collectionName);
      const filtered = current.filter(x => x.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (e) {
      console.warn(`Failed to delete from localStorage for ${collectionName}:`, e);
    }

    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (firestoreErr) {
      console.warn(`Firestore delete for ${collectionName}/${id} skipped (offline mode):`, firestoreErr);
    }
  },

  /**
   * Batch save attendance records
   */
  async saveAttendanceBatch(records: AttendanceRecord[]): Promise<void> {
    const storageKey = 'bnfe_cache_attendance';
    let existing: AttendanceRecord[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) existing = JSON.parse(raw);
    } catch (e) {}

    const updatedMap = new Map<string, AttendanceRecord>();
    existing.forEach(r => updatedMap.set(`${r.batchId}_${r.date}_${r.traineeId}`, r));
    records.forEach(r => updatedMap.set(`${r.batchId}_${r.date}_${r.traineeId}`, r));

    const newList = Array.from(updatedMap.values());
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {}

    records.forEach(r => {
      setDoc(doc(db, 'attendance', r.id), r, { merge: true }).catch(() => {});
    });
  },

  /**
   * Clear all demo data
   */
  async clearAllDemoData(): Promise<void> {
    this.clearAllLocalData();
  },

  /**
   * Reset local storage caches to empty
   */
  clearAllLocalData(): void {
    const collections = ['institutes', 'trades', 'batches', 'trainees', 'attendance', 'exams', 'marks', 'users', 'activityLogs'];
    collections.forEach(col => {
      try {
        localStorage.removeItem(`bnfe_cache_${col}`);
      } catch (e) {}
    });
  }
};
