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

// Set of known demo IDs to completely remove and prevent from loading
export const DEMO_IDS = new Set([
  'INS-01', 'INS-02', 'INS-HLG-01', 'INS-DHB-02',
  'TRD-01', 'TRD-02', 'TRD-03', 'TRD-CAG-01', 'TRD-HWE-02', 'TRD-TLS-03',
  'BAT-01', 'BAT-02', 'BAT-03',
  'TRN-01', 'TRN-02', 'TRN-03', 'TRN-04',
  'EXM-01', 'EXM-02',
  'MRK-01', 'MRK-02', 'MRK-03',
  'USR-DIR', 'USR-FMA', 'USR-TRN1'
]);

// Helper to filter out any demo records (by ID pattern or known demo ID)
function isDemoItem(item: any): boolean {
  if (!item || !item.id) return false;
  if (DEMO_IDS.has(item.id)) return true;
  if (typeof item.id === 'string' && item.id.startsWith('TR-10')) return true;
  if (typeof item.registrationNumber === 'string' && item.registrationNumber.startsWith('REG-BNFE-2024')) return true;
  return false;
}

// Auto-purge any cached demo data on startup
try {
  const collections = ['institutes', 'trades', 'batches', 'trainees', 'attendance', 'exams', 'marks', 'users', 'activityLogs'];
  collections.forEach(col => {
    const storageKey = `bnfe_cache_${col}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(item => !isDemoItem(item));
          localStorage.setItem(storageKey, JSON.stringify(cleaned));
        }
      } catch (e) {}
    }
  });
} catch (e) {}

export const dataService = {
  /**
   * Fetch items for a collection, querying Firestore with graceful offline caching fallback.
   * Strips out any demo data completely.
   */
  async getItems<T extends { id: string }>(collectionName: string): Promise<T[]> {
    const storageKey = `bnfe_cache_${collectionName}`;
    let cachedList: T[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cachedList = parsed.filter(item => !isDemoItem(item));
        }
      }
    } catch (e) {
      console.warn(`Local cache read error for ${collectionName}:`, e);
    }

    try {
      const snap = await getDocs(collection(db, collectionName));
      if (snap && snap.docs) {
        const firestoreList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as T))
          .filter(item => !isDemoItem(item));
        
        try {
          localStorage.setItem(storageKey, JSON.stringify(firestoreList));
        } catch (e) {}
        return firestoreList;
      }
    } catch (firestoreErr) {
      console.warn(`Firestore getItems for ${collectionName} handled via offline fallback:`, firestoreErr);
    }

    return cachedList;
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
      setDoc(doc(db, 'attendance', r.id), r, { merge: true }).catch(err => {
        console.warn("Firestore attendance record sync notice:", err);
      });
    });
  },

  /**
   * Completely remove all demo data from local storage and firestore
   */
  async clearAllDemoData(): Promise<void> {
    const collections = ['institutes', 'trades', 'batches', 'trainees', 'attendance', 'exams', 'marks', 'users', 'activityLogs'];
    collections.forEach(col => {
      try {
        const storageKey = `bnfe_cache_${col}`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            const cleaned = items.filter(item => !isDemoItem(item));
            localStorage.setItem(storageKey, JSON.stringify(cleaned));
          }
        }
      } catch (e) {}
    });

    const demoIdsByCol: Record<string, string[]> = {
      institutes: ['INS-01', 'INS-02', 'INS-HLG-01', 'INS-DHB-02'],
      trades: ['TRD-01', 'TRD-02', 'TRD-03', 'TRD-CAG-01', 'TRD-HWE-02', 'TRD-TLS-03'],
      batches: ['BAT-01', 'BAT-02', 'BAT-03'],
      trainees: [
        'TRN-01', 'TRN-02', 'TRN-03', 'TRN-04',
        ...Array.from({ length: 25 }, (_, i) => `TR-${1001 + i}`)
      ],
      exams: ['EXM-01', 'EXM-02'],
      marks: ['MRK-01', 'MRK-02', 'MRK-03'],
      users: ['USR-DIR', 'USR-FMA', 'USR-TRN1'],
    };

    for (const [col, ids] of Object.entries(demoIdsByCol)) {
      for (const id of ids) {
        try {
          await deleteDoc(doc(db, col, id));
        } catch (e) {
          // offline/permission ignore
        }
      }
    }
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
