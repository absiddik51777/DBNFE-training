import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../../lib/firebase';
import { dataService } from '../../lib/dataService';
import { recordSimpleAuditLog } from '../../lib/auditLog';
import { extractTimestampMs } from '../audit/auditFormatters';
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

  const [latestLog, setLatestLog] = useState<ActivityLog | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);

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
      setLatestLog(null);
      setLoadingLogs(false);
      return;
    }
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'activityLogs'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      setLatestLog(
        snap.docs.length > 0
          ? ({ id: snap.docs[0].id, ...snap.docs[0].data() } as ActivityLog)
          : null
      );
    } catch (err) {
      console.warn('Could not fetch latest activity log:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchCounts();
    fetchLogs();
  }, [fetchCounts, fetchLogs]);

  const latestLogTimeText = useMemo(() => {
    if (!isAdmin) return 'সংরক্ষিত';
    if (loadingLogs) return 'লোড হচ্ছে...';
    const ms = extractTimestampMs(latestLog?.createdAt ?? latestLog?.timestamp);
    if (!ms) return 'কোনো লগ নেই';
    try {
      return format(ms, 'dd/MM/yy, hh:mm a');
    } catch {
      return 'অজানা';
    }
  }, [isAdmin, latestLog, loadingLogs]);

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
    latestLogTimeText,
    fetchLogs,
    toast,
    showToast,
    dismissToast,
  };
}
