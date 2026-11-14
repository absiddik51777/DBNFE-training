import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  DocumentData,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../../lib/firebase';
import { dataService } from '../../lib/dataService';
import { recordSimpleAuditLog } from '../../lib/auditLog';
import { saveTextFile } from '../../lib/fileExportService';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import type {
  ActivityLog,
  AttendanceRecord,
  Batch,
  Exam,
  ExamMark,
  Institute,
  Trade,
  Trainee,
} from '../../types';
import type { SettingsCounts, SettingsToast, SettingsToastType } from './types';

const LOG_PAGE_SIZE = 20;

const CANONICAL_MODULES = [
  'trainees',
  'batches',
  'institutes',
  'trades',
  'exams',
  'attendance',
  'settings',
  'security',
] as const;

export function normalizeAuditModuleKey(raw?: string): string {
  const m = (raw || '').trim().toLowerCase();
  if (!m) return 'settings';
  if (m === 'results') return 'exams';
  if (m === 'trainee_brn_verification') return 'trainees';
  if (m === 'auth' || m === 'users' || m === 'roles') return 'security';
  if (m === 'system') return 'settings';
  return m;
}

export function useSettingsData(isAdmin: boolean = true) {
  const { userProfile } = useAuth();
  const { settings } = useSystemSettings();

  const [counts, setCounts] = useState<SettingsCounts>({
    attendance: 0,
    trainees: 0,
    exams: 0,
    marks: 0,
    batches: 0,
    institutes: 0,
    trades: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [exportingData, setExportingData] = useState(false);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [toast, setToast] = useState<SettingsToast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((type: SettingsToastType, message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4200);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const [att, trn, exm, mrk, btc, inst, trd] = await Promise.all([
        dataService.getItems<AttendanceRecord>('attendance'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<Exam>('exams'),
        dataService.getItems<ExamMark>('marks'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
      ]);
      setCounts({
        attendance: att.length,
        trainees: trn.length,
        exams: exm.length,
        marks: mrk.length,
        batches: btc.length,
        institutes: inst.length,
        trades: trd.length,
      });
    } catch (err) {
      console.warn('Could not fetch database counts:', err);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) {
      setLogs([]);
      setHasMoreLogs(false);
      setLoadingLogs(false);
      return;
    }
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(LOG_PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
      lastDocRef.current = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      setHasMoreLogs(snap.docs.length === LOG_PAGE_SIZE);
      setLogs(list);
    } catch (err) {
      console.warn('Could not fetch activity logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [isAdmin]);

  const loadMoreLogs = useCallback(async () => {
    if (!isAdmin || !lastDocRef.current || loadingMoreLogs || !hasMoreLogs) return;
    setLoadingMoreLogs(true);
    try {
      const q = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        startAfter(lastDocRef.current),
        limit(LOG_PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const nextList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
      lastDocRef.current =
        snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastDocRef.current;
      setHasMoreLogs(snap.docs.length === LOG_PAGE_SIZE);
      setLogs((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const item of nextList) {
          if (!seen.has(item.id)) {
            merged.push(item);
          }
        }
        return merged;
      });
    } catch (err) {
      console.warn('Could not load more activity logs:', err);
      showToast('error', 'আরও লগ লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoadingMoreLogs(false);
    }
  }, [hasMoreLogs, isAdmin, loadingMoreLogs, showToast]);

  useEffect(() => {
    fetchCounts();
    fetchLogs();
  }, [fetchCounts, fetchLogs]);

  const availableLogModules = useMemo(() => {
    const base = new Set<string>(CANONICAL_MODULES);
    for (const l of logs) {
      const key = normalizeAuditModuleKey(l.module);
      if (key) base.add(key);
    }
    return Array.from(base);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (moduleFilter === 'ALL') return logs;
    const target = normalizeAuditModuleKey(moduleFilter);
    return logs.filter((l) => normalizeAuditModuleKey(l.module) === target);
  }, [logs, moduleFilter]);

  const latestLogTimeText = useMemo(() => {
    if (!isAdmin) return 'সংরক্ষিত';
    if (loadingLogs) return 'লোড হচ্ছে...';
    if (logs.length === 0 || !logs[0]?.timestamp) return 'কোনো লগ নেই';
    try {
      return format(logs[0].timestamp, 'dd/MM/yy, hh:mm a');
    } catch {
      return 'অজানা';
    }
  }, [isAdmin, loadingLogs, logs]);

  const exportAllSystemData = useCallback(async () => {
    if (exportingData) return;
    setExportingData(true);
    try {
      const cloudSnapshot = await dataService.syncAllFromCloud();
      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: userProfile?.name || userProfile?.email || 'Admin',
        systemSettings: settings,
        ...cloudSnapshot,
      };
      const fileName = `bnfe_backup_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
      const result = await saveTextFile(
        fileName,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8;',
        'document'
      );

      if (result.success) {
        if (userProfile) {
          await recordSimpleAuditLog({
            action: 'export',
            module: 'settings',
            collectionName: 'settings',
            targetId: 'export_all',
            targetLabel: fileName,
            title: `সিস্টেম সম্পূর্ণ ডাটা ব্যাকআপ এক্সপোর্ট (${fileName})`,
            actor: {
              userId: userProfile.id || '',
              user: userProfile.name || 'User',
              userRole: userProfile.role || '',
            },
          }).catch(() => {});
          fetchLogs();
        }
        showToast('success', result.message);
      } else {
        showToast('error', result.message || 'ডাটা এক্সপোর্ট ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'ডাটা এক্সপোর্ট করতে সমস্যা হয়েছে।');
    } finally {
      setExportingData(false);
    }
  }, [exportingData, fetchLogs, settings, showToast, userProfile]);

  return {
    counts,
    loadingCounts,
    fetchCounts,
    exportingData,
    exportAllSystemData,
    logs,
    filteredLogs,
    loadingLogs,
    loadingMoreLogs,
    hasMoreLogs,
    moduleFilter,
    setModuleFilter,
    availableLogModules,
    latestLogTimeText,
    fetchLogs,
    loadMoreLogs,
    toast,
    showToast,
    dismissToast,
  };
}
