import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { logActivity } from '../lib/firebase';
import { Institute, Trade, Batch, Trainee, AttendanceRecord, AttendanceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { format } from 'date-fns';
import { 
  Check, 
  X, 
  Calendar as CalendarIcon, 
  CalendarDays,
  Save, 
  CheckCheck, 
  Clock, 
  CheckCircle2, 
  Building2, 
  Layers, 
  AlertCircle, 
  AlertTriangle, 
  Lock, 
  Search, 
  RotateCcw,
  ShieldAlert,
  Info,
  Trash2
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { toBn, formatBengaliDate, safeFormatDate } from '../lib/dateUtils';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { TableSkeleton } from '../components/Skeleton';

type ExtendedAttendanceStatus = AttendanceStatus | 'Unmarked';

interface TraineeAttendanceItem {
  id: string; // traineeId
  trainee: Trainee;
  status: ExtendedAttendanceStatus;
  initialStatus: ExtendedAttendanceStatus;
  isSavedInDb: boolean;
  dbRecordId?: string;
}

const Attendance: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();

  const canTakeAttendance = hasPermission('take_attendance');
  const canEditAttendance = hasPermission('edit_attendance');
  const { isDeletionAllowed, deleteAttendanceForBatchAndDate } = useSystemSettings();
  const { confirm } = useConfirm();
  const isTrainer = userProfile?.role === 'Trainer';

  // Master Data
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Selection state
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Pending selector change target (when unsaved changes prompt is shown)
  const [pendingChange, setPendingChange] = useState<{
    type: 'batch' | 'date' | 'institute';
    value: string;
  } | null>(null);

  // Trainee Attendance Map
  const [attendanceMap, setAttendanceMap] = useState<Record<string, TraineeAttendanceItem>>({});
  const [allTraineesInBatch, setAllTraineesInBatch] = useState<Trainee[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [fetchingTrainees, setFetchingTrainees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [permissionNotice, setPermissionNotice] = useState('');
  
  // Quick Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'present' | 'absent' | 'leave' | 'unmarked' | 'dirty'>('all');

  // Bulk action confirmation modal
  const [bulkConfirmModal, setBulkConfirmModal] = useState<{
    status: ExtendedAttendanceStatus;
    title: string;
    description: string;
  } | null>(null);

  // Selected batch info & start date validation
  const currentBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatch);
  }, [batches, selectedBatch]);

  const batchStartDateIso = useMemo(() => {
    if (!currentBatch?.startDate) return '';
    return safeFormatDate(currentBatch.startDate, 'yyyy-MM-dd');
  }, [currentBatch]);

  // Validate attendance date: Attendance cannot be taken before batch start date
  const isBeforeBatchStart = Boolean(batchStartDateIso && selectedDate < batchStartDateIso);

  // Today's date string for future validation
  const todayDateStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isFutureDate = selectedDate > todayDateStr;

  // Unsaved changes check
  const dirtyItems = useMemo(() => {
    return Object.values(attendanceMap).filter(item => item.status !== item.initialStatus);
  }, [attendanceMap]);

  const hasUnsavedChanges = dirtyItems.length > 0;

  // Window beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load initial institutes, trades, batches
  useEffect(() => {
    fetchInitialData();
  }, [userProfile?.id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [instData, trdData, btcData] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches')
      ]);

      setInstitutes(instData);
      setTrades(trdData);
      setBatches(btcData);

      let targetInst = '';
      let targetBatch = '';
      let targetTrade = '';

      if (userProfile?.role === 'Trainer') {
        targetInst = userProfile.instituteId || (instData[0]?.id || '');

        if (userProfile.batchId) {
          targetBatch = userProfile.batchId;
          const assignedBatch = btcData.find(b => b.id === userProfile.batchId);
          if (assignedBatch) {
            targetInst = assignedBatch.instituteId || targetInst;
            targetTrade = assignedBatch.tradeId || '';
          }
        } else {
          const matching = btcData.filter(b => b.instituteId === targetInst);
          if (matching.length > 0) {
            targetBatch = matching[0].id;
            targetTrade = matching[0].tradeId || '';
          }
        }
      } else {
        targetInst = userProfile?.instituteId || (instData[0]?.id || '');
        const matching = btcData.filter(b => b.instituteId === targetInst);
        if (matching.length > 0) {
          targetBatch = matching[0].id;
          targetTrade = matching[0].tradeId || '';
        }
      }

      if (!targetTrade && trdData.length > 0) {
        targetTrade = trdData[0].id;
      }

      setSelectedInstitute(targetInst);
      setSelectedBatch(targetBatch);
      setSelectedTrade(targetTrade);

    } catch (error) {
      console.warn("Notice fetching initial data in Attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  // When batch or date changes, fetch trainees and attendance
  useEffect(() => {
    if (selectedBatch && selectedDate) {
      fetchTraineesAndAttendance();
    } else {
      setAttendanceMap({});
      setAllTraineesInBatch([]);
    }
  }, [selectedBatch, selectedDate]);

  const fetchTraineesAndAttendance = async () => {
    setFetchingTrainees(true);
    setSaveSuccessMessage('');
    setSaveErrorMessage('');
    setPermissionNotice('');

    try {
      // 1. Fetch active trainees for this batch
      const allTrainees = await dataService.getItems<Trainee>('trainees');
      const batchTrainees = allTrainees
        .filter(t => t.batchId === selectedBatch && (!t.status || t.status === 'Active'))
        .sort((a, b) => (a.traineeId || a.id).localeCompare(b.traineeId || b.id, undefined, { numeric: true }));

      setAllTraineesInBatch(batchTrainees);

      // 2. Fetch existing attendance records for this batch and date
      const batchDateAttendance = await dataService.getBatchAttendanceForDate(selectedBatch, selectedDate);
      
      const recordByTraineeId = new Map<string, AttendanceRecord>();
      batchDateAttendance.forEach(a => recordByTraineeId.set(a.traineeId, a));

      // 3. Populate state map
      const newMap: Record<string, TraineeAttendanceItem> = {};
      batchTrainees.forEach(t => {
        const existingRecord = recordByTraineeId.get(t.id);
        if (existingRecord) {
          newMap[t.id] = {
            id: t.id,
            trainee: t,
            status: existingRecord.status,
            initialStatus: existingRecord.status,
            isSavedInDb: true,
            dbRecordId: existingRecord.id
          };
        } else {
          // If no record exists, keep as 'Unmarked' so user explicitly marks them
          newMap[t.id] = {
            id: t.id,
            trainee: t,
            status: 'Unmarked',
            initialStatus: 'Unmarked',
            isSavedInDb: false
          };
        }
      });

      setAttendanceMap(newMap);
    } catch (error) {
      console.warn("Notice fetching trainees/attendance:", error);
      setSaveErrorMessage("হাজিরা তথ্য লোড করতে সমস্যা হয়েছে।");
    } finally {
      setFetchingTrainees(false);
    }
  };

  // Safe Selector Change with Unsaved Confirmation
  const requestSelectorChange = (type: 'batch' | 'date' | 'institute', value: string) => {
    if (isTrainer && (type === 'batch' || type === 'institute')) {
      setPermissionNotice("প্রশিক্ষক শুধুমাত্র তাঁর নির্ধারিত ব্যাচের হাজিরা পরিচালনা করতে পারবেন।");
      return;
    }
    if (type === 'date' && batchStartDateIso && value < batchStartDateIso) {
      setSaveErrorMessage(`ব্যাচ শুরুর তারিখ (${formatBengaliDate(batchStartDateIso)}) এর পূর্বের কোনো তারিখে হাজিরা নেওয়া যাবে না।`);
      setTimeout(() => setSaveErrorMessage(''), 5000);
      return;
    }
    if (hasUnsavedChanges) {
      setPendingChange({ type, value });
    } else {
      applySelectorChange(type, value);
    }
  };

  const applySelectorChange = (type: 'batch' | 'date' | 'institute', value: string) => {
    if (isTrainer && (type === 'batch' || type === 'institute')) {
      return;
    }
    if (type === 'institute') {
      setSelectedInstitute(value);
      const firstBatch = batches.find(b => b.instituteId === value);
      if (firstBatch) {
        setSelectedBatch(firstBatch.id);
        if (firstBatch.tradeId) setSelectedTrade(firstBatch.tradeId);
      } else {
        setSelectedBatch('');
      }
    } else if (type === 'batch') {
      setSelectedBatch(value);
      const b = batches.find(x => x.id === value);
      if (b?.tradeId) setSelectedTrade(b.tradeId);
      if (b?.instituteId) setSelectedInstitute(b.instituteId);
    } else if (type === 'date') {
      setSelectedDate(value);
    }
    setPendingChange(null);
  };

  const handleDiscardAndProceed = () => {
    if (pendingChange) {
      applySelectorChange(pendingChange.type, pendingChange.value);
    }
  };

  const handleSaveAndProceed = async () => {
    const success = await executeSave();
    if (success && pendingChange) {
      applySelectorChange(pendingChange.type, pendingChange.value);
    }
  };

  // Individual trainee status click with PROPER edit_attendance check
  const setStatus = (traineeId: string, newStatus: AttendanceStatus) => {
    const item = attendanceMap[traineeId];
    if (!item) return;

    // Check batch start date constraint
    if (isBeforeBatchStart) {
      setPermissionNotice(`ব্যাচ শুরুর তারিখ (${formatBengaliDate(batchStartDateIso)}) এর পূর্বের কোনো তারিখে হাজিরা নেওয়া যাবে না।`);
      setTimeout(() => setPermissionNotice(''), 4500);
      return;
    }

    // Check basic take permission
    if (!canTakeAttendance) {
      setPermissionNotice('আপনার হাজিরা গ্রহণের অনুমতি নেই।');
      setTimeout(() => setPermissionNotice(''), 3000);
      return;
    }

    // STRICT edit_attendance PERMISSION CHECK:
    // If the trainee record was already saved in the database and user lacks edit_attendance permission, block!
    if (item.isSavedInDb && !canEditAttendance) {
      setPermissionNotice(`"${item.trainee.nameBn || item.trainee.nameEn}" এর হাজিরা ইতোমধ্যে সংরক্ষিত। সংরক্ষিত রেকর্ড পরিবর্তনের জন্য 'edit_attendance' অনুমতি প্রয়োজন।`);
      setTimeout(() => setPermissionNotice(''), 4500);
      return;
    }

    setAttendanceMap(prev => {
      const current = prev[traineeId];
      if (!current) return prev;
      return {
        ...prev,
        [traineeId]: {
          ...current,
          status: current.status === newStatus ? 'Unmarked' : newStatus
        }
      };
    });
  };

  // Bulk actions trigger with edit_attendance awareness
  const handleBulkActionClick = (status: ExtendedAttendanceStatus) => {
    if (isBeforeBatchStart) {
      setPermissionNotice(`ব্যাচ শুরুর তারিখ (${formatBengaliDate(batchStartDateIso)}) এর পূর্বের কোনো তারিখে হাজিরা নেওয়া যাবে না।`);
      setTimeout(() => setPermissionNotice(''), 4500);
      return;
    }

    if (!canTakeAttendance) {
      setPermissionNotice('আপনার হাজিরা গ্রহণের অনুমতি নেই।');
      setTimeout(() => setPermissionNotice(''), 3000);
      return;
    }

    const savedCount = Object.values(attendanceMap).filter(i => i.isSavedInDb).length;
    
    // If user doesn't have edit_attendance and all are already saved, inform and block
    if (!canEditAttendance && savedCount === allTraineesInBatch.length && allTraineesInBatch.length > 0) {
      setPermissionNotice("সকল শিক্ষার্থীর হাজিরা ইতিমধ্যে সংরক্ষিত। সংরক্ষিত হাজিরা পরিবর্তনের জন্য 'edit_attendance' অনুমতি প্রয়োজন।");
      setTimeout(() => setPermissionNotice(''), 4500);
      return;
    }

    let title = '';
    let description = '';

    if (status === 'Present') {
      title = 'সকল শিক্ষার্থীকে "উপস্থিত" চিহ্নিতকরণ';
      description = canEditAttendance 
        ? 'সকল সক্রিয় শিক্ষার্থীর আজকের হাজিরা "উপস্থিত" হিসেবে নির্ধারণ করা হবে।' 
        : 'শুধুমাত্র অসংরক্ষিত ও অনির্ধারিত শিক্ষার্থীদের "উপস্থিত" করা হবে (সংরক্ষিত রেকর্ড অপরিবর্তিত থাকবে)।';
    } else if (status === 'Absent') {
      title = 'সকল শিক্ষার্থীকে "অনুপস্থিত" চিহ্নিতকরণ';
      description = canEditAttendance 
        ? 'সকল শিক্ষার্থীর আজকের হাজিরা "অনুপস্থিত" হিসেবে নির্ধারণ করা হবে।' 
        : 'শুধুমাত্র অসংরক্ষিত শিক্ষার্থীদের "অনুপস্থিত" করা হবে।';
    }

    setBulkConfirmModal({ status, title, description });
  };

  const applyBulkAction = (status: ExtendedAttendanceStatus) => {
    setAttendanceMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(tid => {
        const item = next[tid];
        // If user lacks edit_attendance, DO NOT modify already saved records!
        if (item.isSavedInDb && !canEditAttendance) {
          return;
        }
        next[tid] = { ...item, status };
      });
      return next;
    });

    if (!canEditAttendance) {
      setPermissionNotice("যেহেতু সংরক্ষিত হাজিরা পরিবর্তনের অনুমতি নেই, তাই শুধুমাত্র অসংরক্ষিত শিক্ষার্থীদের হাজিরা চিহ্নিত করা হয়েছে।");
      setTimeout(() => setPermissionNotice(''), 4000);
    }

    setBulkConfirmModal(null);
  };

  // Revert unsaved changes
  const handleResetToSaved = () => {
    setAttendanceMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(tid => {
        next[tid] = { ...next[tid], status: next[tid].initialStatus };
      });
      return next;
    });
  };

  // Delete attendance records for this selected batch and date
  const handleDeleteDateAttendance = async () => {
    if (!isDeletionAllowed) {
      setPermissionNotice("সেটিংস থেকে ডাটা ডিলিট বন্ধ রাখা হয়েছে। ডাটা মুছতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
      setTimeout(() => setPermissionNotice(''), 4500);
      return;
    }

    if (!selectedBatch || !selectedDate) return;

    if (isTrainer && userProfile?.batchId && selectedBatch !== userProfile.batchId) {
      setPermissionNotice("অননুমোদিত পদক্ষেপ: প্রশিক্ষক শুধুমাত্র তাঁর নির্ধারিত ব্যাচের হাজিরা রেকর্ড মুছতে পারেন।");
      setTimeout(() => setPermissionNotice(''), 4000);
      return;
    }

    const savedCount = Object.values(attendanceMap).filter(item => item.isSavedInDb).length;
    if (savedCount === 0) {
      setPermissionNotice("এই তারিখে মোছার মতো কোনো সংরক্ষিত হাজিরা রেকর্ড নেই।");
      setTimeout(() => setPermissionNotice(''), 3000);
      return;
    }

    const confirmed = await confirm({
      title: 'হাজিরা রেকর্ড মুছে ফেলার নিশ্চিতকরণ',
      message: `আপনি কি নিশ্চিতভাবে "${formatBengaliDate(selectedDate)}" তারিখের সংরক্ষিত সকল (${toBn(savedCount)}টি) হাজিরা রেকর্ড ডাটাবেজ থেকে মুছে ফেলতে চান?`,
      detail: 'এই তারিখের সংরক্ষিত হাজিরা ডাটাবেজ থেকে স্থায়ীভাবে মুছে যাবে। প্রয়োজন হলে পুনরায় হাজিরা প্রদান করতে পারবেন।',
      confirmText: 'হ্যাঁ, হাজিরা রেকর্ড মুছুন',
      cancelText: 'বাতিল',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      setSaving(true);
      const count = await deleteAttendanceForBatchAndDate(selectedBatch, selectedDate);
      
      // Reset local state to unmarked and unsaved
      setAttendanceMap(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(tid => {
          next[tid] = {
            ...next[tid],
            status: 'Unmarked',
            initialStatus: 'Unmarked',
            isSavedInDb: false,
            dbRecordId: undefined
          };
        });
        return next;
      });

      setSaveSuccessMessage(`${selectedDate} তারিখের ${count}টি হাজিরা রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`);
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (err: any) {
      setSaveErrorMessage("হাজিরা রেকর্ড মুছতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Core Save logic
  const executeSave = async (): Promise<boolean> => {
    if (allTraineesInBatch.length === 0) return false;
    
    // Validate attendance date: Attendance cannot be saved before batch start date
    if (isBeforeBatchStart) {
      setSaveErrorMessage(`ব্যাচ শুরুর তারিখ (${formatBengaliDate(batchStartDateIso)}) এর পূর্বের কোনো তারিখে হাজিরা সংরক্ষণ সম্ভব নয়।`);
      return false;
    }

    const markedItems = Object.values(attendanceMap).filter(item => item.status !== 'Unmarked');
    if (markedItems.length === 0) {
      setSaveErrorMessage("অনুগ্রহ করে অন্তত একজন শিক্ষার্থীর হাজিরা নির্বাচন করুন অথবা 'সবাই উপস্থিত' দিন।");
      return false;
    }

    // Double-check permission for dirty items
    for (const item of dirtyItems) {
      if (item.isSavedInDb && !canEditAttendance) {
        setSaveErrorMessage(`সংরক্ষিত হাজিরা পরিবর্তনের অনুমতি আপনার নেই (${item.trainee.nameBn})।`);
        return false;
      }
    }

    // Strict Trainer Batch Guard
    if (isTrainer && userProfile?.batchId && selectedBatch !== userProfile.batchId) {
      setSaveErrorMessage("অননুমোদিত পদক্ষেপ: প্রশিক্ষক শুধুমাত্র তাঁর নির্ধারিত ব্যাচের হাজিরা সংরক্ষণ করতে পারবেন।");
      return false;
    }

    setSaving(true);
    setSaveSuccessMessage('');
    setSaveErrorMessage('');

    try {
      const recordsToSave: AttendanceRecord[] = [];

      markedItems.forEach(item => {
        const compositeId = item.dbRecordId || `ATT_${selectedBatch}_${selectedDate}_${item.id}`;
        recordsToSave.push({
          id: compositeId,
          batchId: selectedBatch,
          instituteId: selectedInstitute,
          tradeId: selectedTrade,
          date: selectedDate,
          traineeId: item.id,
          status: item.status as AttendanceStatus,
          remarks: item.status === 'Leave' ? 'ছুটি' : undefined,
          recordedBy: userProfile?.name || 'User',
          createdAt: item.isSavedInDb ? Date.now() : Date.now(),
          updatedAt: Date.now()
        });
      });

      const result = await dataService.saveAttendanceBatch(recordsToSave);

      if (!result.success && result.error) {
        setSaveErrorMessage(`হাজিরা সংরক্ষণে সমস্যা হয়েছে: ${result.error}`);
        return false;
      }

      // Update local state to mark as saved
      setAttendanceMap(prev => {
        const next = { ...prev };
        recordsToSave.forEach(rec => {
          if (next[rec.traineeId]) {
            next[rec.traineeId] = {
              ...next[rec.traineeId],
              status: rec.status,
              initialStatus: rec.status,
              isSavedInDb: true,
              dbRecordId: rec.id
            };
          }
        });
        return next;
      });

      const presentCount = recordsToSave.filter(r => r.status === 'Present').length;
      const absentCount = recordsToSave.filter(r => r.status === 'Absent').length;
      const leaveCount = recordsToSave.filter(r => r.status === 'Leave').length;

      // Audit Log
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `হাজিরা সংরক্ষণ: "${currentBatch?.name || selectedBatch}" (${formatBengaliDate(selectedDate)}) — উপস্থিত: ${toBn(presentCount)}, অনুপস্থিত: ${toBn(absentCount)}, ছুটি: ${toBn(leaveCount)}`,
        'Attendance',
        selectedBatch
      );

      setSaveSuccessMessage(`${toBn(recordsToSave.length)} জন শিক্ষার্থীর হাজিরা সফলভাবে সংরক্ষিত হয়েছে।`);
      setTimeout(() => setSaveSuccessMessage(''), 3500);
      return true;

    } catch (err: any) {
      console.warn("Error saving attendance batch:", err);
      setSaveErrorMessage("সংরক্ষণে ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Calculations & Metrics
  const totalCount = allTraineesInBatch.length;
  const presentCount = Object.values(attendanceMap).filter(a => a.status === 'Present').length;
  const absentCount = Object.values(attendanceMap).filter(a => a.status === 'Absent').length;
  const leaveCount = Object.values(attendanceMap).filter(a => a.status === 'Leave').length;
  const unmarkedCount = Object.values(attendanceMap).filter(a => a.status === 'Unmarked').length;
  const savedInDbCount = Object.values(attendanceMap).filter(a => a.isSavedInDb).length;
  const dirtyCount = dirtyItems.length;

  const currentInstitute = institutes.find(i => i.id === selectedInstitute);
  const currentTrade = trades.find(t => t.id === selectedTrade);

  // Filtered and Searched Trainee List
  const displayedTrainees = useMemo(() => {
    return allTraineesInBatch.filter(t => {
      const item = attendanceMap[t.id];
      if (!item) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNameBn = (t.nameBn || '').includes(q);
        const matchNameEn = (t.nameEn || '').toLowerCase().includes(q);
        const matchId = (t.traineeId || t.id).toLowerCase().includes(q);
        const matchReg = (t.registrationNumber || '').toLowerCase().includes(q);
        if (!matchNameBn && !matchNameEn && !matchId && !matchReg) return false;
      }

      if (activeFilterTab === 'dirty') return item.status !== item.initialStatus;
      if (activeFilterTab === 'unmarked') return item.status === 'Unmarked';
      if (activeFilterTab === 'present') return item.status === 'Present';
      if (activeFilterTab === 'absent') return item.status === 'Absent';
      if (activeFilterTab === 'leave') return item.status === 'Leave';

      return true;
    });
  }, [allTraineesInBatch, attendanceMap, searchQuery, activeFilterTab]);

  if (loading) {
    return (
      <div className="space-y-4 pb-20 max-w-6xl mx-auto">
        <div className="h-6 w-48 bg-slate-200/80 rounded animate-pulse" />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* ======================================================== */}
      {/* 1. MINIMAL HEADER & COMPACT CONTROLS                      */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>দৈনিক হাজিরা</span>
            <span className="text-xs font-normal text-slate-400">| Daily Attendance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatBengaliDate(selectedDate)} {!isTrainer && currentBatch ? `• ${currentBatch.name}` : ''}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/attendance-sheet"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center space-x-1.5 transition"
          >
            <CalendarDays size={14} className="text-emerald-700" />
            <span>মাসিক শিট</span>
          </Link>

          {allTraineesInBatch.length > 0 && canTakeAttendance && (
            <button
              onClick={() => executeSave()}
              disabled={saving || !hasUnsavedChanges || isFutureDate || isBeforeBatchStart}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition ${
                hasUnsavedChanges && !isFutureDate && !isBeforeBatchStart
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20 active:scale-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save size={14} />
              <span>{saving ? 'সংরক্ষণ...' : 'সংরক্ষণ করুন'}</span>
              {dirtyCount > 0 && (
                <span className="bg-white text-emerald-800 text-[10px] px-1.5 rounded-full font-black">
                  {toBn(dirtyCount)}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Inline Feedback Alerts */}
      {saveSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center space-x-2 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {saveErrorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
          <button
            onClick={() => executeSave()}
            className="px-2.5 py-0.5 bg-red-600 text-white rounded text-[11px] font-bold"
          >
            পুনরায় চেষ্টা
          </button>
        </div>
      )}

      {permissionNotice && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center space-x-2 shadow-2xs animate-fadeIn">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <span>{permissionNotice}</span>
        </div>
      )}

      {isBeforeBatchStart && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-center space-x-2">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <span>
            নির্বাচিত তারিখটি ({formatBengaliDate(selectedDate)}) ব্যাচ শুরুর তারিখের ({formatBengaliDate(batchStartDateIso)}) পূর্বের। ব্যাচ শুরুর আগের কোনো তারিখে হাজিরা গ্রহণ বা সংরক্ষণ করা যাবে না।
          </span>
        </div>
      )}

      {isFutureDate && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center space-x-2">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <span>ভবিষ্যতের তারিখের জন্য হাজিরা গ্রহণ স্থগিত। আজকের বা অতীতের তারিখ নির্বাচন করুন।</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. COMPACT SELECTOR & STATS BAR                          */}
      {/* ======================================================== */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Selectors */}
          {isTrainer ? (
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-medium">তারিখ:</span>
              <input
                type="date"
                min={batchStartDateIso || undefined}
                max={todayDateStr}
                value={selectedDate}
                onChange={(e) => requestSelectorChange('date', e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div className="flex items-center flex-wrap gap-2">
              <select
                value={selectedInstitute}
                onChange={(e) => requestSelectorChange('institute', e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
              >
                <option value="">প্রতিষ্ঠান</option>
                {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>

              <select
                value={selectedBatch}
                onChange={(e) => requestSelectorChange('batch', e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="">ব্যাচ নির্বাচন</option>
                {batches
                  .filter(b => (!selectedInstitute || b.instituteId === selectedInstitute))
                  .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <input
                type="date"
                min={batchStartDateIso || undefined}
                max={todayDateStr}
                value={selectedDate}
                onChange={(e) => requestSelectorChange('date', e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:outline-none"
              />
            </div>
          )}

          {/* Quick Metrics Strip */}
          {allTraineesInBatch.length > 0 && (
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-600 flex-wrap">
              <span className="px-2 py-0.5 bg-slate-100 rounded-md">মোট: <strong>{toBn(totalCount)}</strong></span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-100">
                উপস্থিত: <strong>{toBn(presentCount)}</strong>
              </span>
              <span className="px-2 py-0.5 bg-red-50 text-red-800 rounded-md border border-red-100">
                অনুপস্থিত: <strong>{toBn(absentCount)}</strong>
              </span>
              {leaveCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md border border-amber-100">
                  ছুটি: <strong>{toBn(leaveCount)}</strong>
                </span>
              )}
              {unmarkedCount > 0 && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                  বাকি: <strong>{toBn(unmarkedCount)}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Toolbar: Filters & Quick Marking */}
        {allTraineesInBatch.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  activeFilterTab === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সবাই ({toBn(totalCount)})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab('present')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  activeFilterTab === 'present' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                উপস্থিত ({toBn(presentCount)})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab('absent')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  activeFilterTab === 'absent' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-800 hover:bg-red-100'
                }`}
              >
                অনুপস্থিত ({toBn(absentCount)})
              </button>
              {unmarkedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('unmarked')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    activeFilterTab === 'unmarked' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  চিহ্নিত নয় ({toBn(unmarkedCount)})
                </button>
              )}
              {dirtyCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('dirty')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    activeFilterTab === 'dirty' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  অসংরক্ষিত ({toBn(dirtyCount)})
                </button>
              )}
            </div>

            {/* Quick Bulk Actions */}
            {canTakeAttendance && !isFutureDate && (
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleBulkActionClick('Present')}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold transition flex items-center space-x-1"
                  title="সবাইকে উপস্থিত করুন"
                >
                  <CheckCheck size={13} />
                  <span>সবাই উপস্থিত</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkActionClick('Absent')}
                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg font-semibold transition flex items-center space-x-1"
                  title="সবাইকে অনুপস্থিত করুন"
                >
                  <X size={13} />
                  <span>সবাই অনুপস্থিত</span>
                </button>
                {/* Delete / Reset Saved Attendance Button */}
                {Object.values(attendanceMap).some(i => i.isSavedInDb) && (
                  <button
                    type="button"
                    onClick={handleDeleteDateAttendance}
                    disabled={!isDeletionAllowed || saving}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                      !isDeletionAllowed
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                    title={!isDeletionAllowed ? 'সেটিংস থেকে ডাটা ডিলিট বন্ধ রাখা হয়েছে' : 'এই তারিখের সংরক্ষিত হাজিরা ডাটাবেজ থেকে মুছে ফেলুন'}
                  >
                    <Trash2 size={13} />
                    <span>{isDeletionAllowed ? 'হাজিরা মুছুন' : 'ডিলিট লক 🔒'}</span>
                  </button>
                )}
                {hasUnsavedChanges && (
                  <button
                    type="button"
                    onClick={handleResetToSaved}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    title="পরিবর্তন রিসেট করুন"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. MINIMAL ATTENDANCE TABLE                              */}
      {/* ======================================================== */}
      {/* 3. MINIMAL ATTENDANCE TABLE                              */}
      {/* ======================================================== */}
      {fetchingTrainees ? (
        <TableSkeleton rows={6} cols={5} showHeader={false} showToolbar={false} />
      ) : allTraineesInBatch.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 text-xs">
          কোনো সক্রিয় শিক্ষার্থী পাওয়া যায়নি।
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">ক্র.</th>
                  {/* Trainee ID & Reg: strictly hidden on mobile view, visible on md: and larger screens */}
                  <th className="px-3.5 py-2.5 hidden md:table-cell w-36">আইডি ও রেজিঃ</th>
                  <th className="px-3.5 py-2.5">শিক্ষার্থীর নাম</th>
                  <th className="px-2.5 py-2.5 text-center w-24">স্থিতি</th>
                  <th className="px-3 py-2.5 text-center w-52 sm:w-56">হাজিরা</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {displayedTrainees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      কোনো শিক্ষার্থী এই তালিকায় নেই।
                    </td>
                  </tr>
                ) : (
                  displayedTrainees.map((t, idx) => {
                    const item = attendanceMap[t.id];
                    const status = item?.status || 'Unmarked';
                    const isDirty = item?.status !== item?.initialStatus;
                    const isSaved = item?.isSavedInDb && !isDirty;
                    const isLocked = item?.isSavedInDb && !canEditAttendance;

                    return (
                      <tr 
                        key={t.id}
                        className={`transition-colors ${
                          isDirty 
                            ? 'bg-amber-50/25 hover:bg-amber-50/40' 
                            : status === 'Present'
                            ? 'hover:bg-emerald-50/15'
                            : status === 'Absent'
                            ? 'hover:bg-red-50/15'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Serial */}
                        <td className="px-3 py-2 text-center font-bold text-slate-400 font-mono text-[11px]">
                          {toBn(idx + 1)}
                        </td>

                        {/* Trainee ID & Reg: STRICTLY HIDDEN ON MOBILE */}
                        <td className="px-3.5 py-2 whitespace-nowrap hidden md:table-cell font-mono text-[11px]">
                          <span className="font-bold text-slate-800 block">{t.traineeId}</span>
                          <span className="text-[10px] text-slate-400">রেজিঃ {t.registrationNumber}</span>
                        </td>

                        {/* Trainee Name */}
                        <td className="px-3.5 py-2">
                          <span className="font-bold text-slate-800 text-xs block leading-tight">
                            {t.nameBn || t.nameEn}
                          </span>
                        </td>

                        {/* DB State Badge */}
                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                          {isDirty ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              • অসংরক্ষিত
                            </span>
                          ) : isSaved ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {isLocked ? <Lock size={10} className="mr-0.5 text-slate-400" /> : null}
                              <span>সংরক্ষিত</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">চিহ্নিত নয়</span>
                          )}
                        </td>

                        {/* Minimal Status Action Buttons */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {isLocked ? (
                            <button 
                              type="button"
                              onClick={() => {
                                setPermissionNotice(`"${t.nameBn || t.nameEn}" এর হাজিরা ইতোমধ্যে সংরক্ষিত। সংরক্ষিত রেকর্ড পরিবর্তনের জন্য 'edit_attendance' অনুমতি প্রয়োজন।`);
                                setTimeout(() => setPermissionNotice(''), 4500);
                              }}
                              className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer"
                              title="সংরক্ষিত রেকর্ড পরিবর্তনের অনুমতি নেই (edit_attendance প্রয়োজন - ক্লিক করে বিস্তারিত দেখুন)"
                            >
                              <Lock size={11} className="text-slate-400 shrink-0" />
                              <span className={status === 'Present' ? 'text-emerald-700 font-bold' : status === 'Absent' ? 'text-red-700 font-bold' : 'text-amber-700 font-bold'}>
                                {status === 'Present' ? 'উপস্থিত' : status === 'Absent' ? 'অনুপস্থিত' : status === 'Leave' ? 'ছুটি' : 'চিহ্নিত নয়'}
                              </span>
                              <span className="text-[9px] text-slate-400 hidden sm:inline">(লকড)</span>
                            </button>
                          ) : (
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 space-x-0.5">
                              {/* Present */}
                              <button
                                type="button"
                                disabled={!canTakeAttendance || isFutureDate}
                                onClick={() => setStatus(t.id, 'Present')}
                                className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center space-x-0.5 ${
                                  status === 'Present'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                }`}
                                title="উপস্থিত চিহ্নিত করুন"
                              >
                                <Check size={12} />
                                <span>উপস্থিত</span>
                              </button>

                              {/* Absent */}
                              <button
                                type="button"
                                disabled={!canTakeAttendance || isFutureDate}
                                onClick={() => setStatus(t.id, 'Absent')}
                                className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center space-x-0.5 ${
                                  status === 'Absent'
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                }`}
                                title="অনুপস্থিত চিহ্নিত করুন"
                              >
                                <X size={12} />
                                <span>অনুপস্থিত</span>
                              </button>

                              {/* Leave */}
                              <button
                                type="button"
                                disabled={!canTakeAttendance || isFutureDate}
                                onClick={() => setStatus(t.id, 'Leave')}
                                className={`px-2 sm:px-2 py-1 rounded-md text-xs font-bold transition flex items-center space-x-0.5 ${
                                  status === 'Leave'
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                }`}
                                title="ছুটি চিহ্নিত করুন"
                              >
                                <Clock size={12} />
                                <span>ছুটি</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MINIMAL STICKY BOTTOM SAVE BAR                        */}
      {/* ======================================================== */}
      {allTraineesInBatch.length > 0 && hasUnsavedChanges && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 z-40 bg-slate-900/90 text-white backdrop-blur-md rounded-2xl shadow-xl px-4 py-2.5 border border-slate-800 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="text-xs">
            <span className="text-amber-400 font-bold">{toBn(dirtyCount)}</span> জনের অসংরক্ষিত পরিবর্তন
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetToSaved}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              বাতিল
            </button>

            <button
              onClick={() => executeSave()}
              disabled={saving}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1"
            >
              <Save size={14} />
              <span>{saving ? 'সংরক্ষণ...' : 'সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. BULK ACTION CONFIRMATION MODAL                        */}
      {/* ======================================================== */}
      {bulkConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{bulkConfirmModal.title}</h3>
            </div>

            <p className="text-xs text-slate-600">{bulkConfirmModal.description}</p>

            <div className="flex items-center justify-end space-x-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setBulkConfirmModal(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => applyBulkAction(bulkConfirmModal.status)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition"
              >
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. UNSAVED CHANGES NAVIGATION WARNING MODAL              */}
      {/* ======================================================== */}
      {pendingChange && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">অসংরক্ষিত পরিবর্তন রয়েছে</h3>
            </div>

            <p className="text-xs text-slate-600">
              আপনার {toBn(dirtyCount)} জন শিক্ষার্থীর পরিবর্তিত হাজিরা রয়েছে। আপনি কি সংরক্ষণ না করে অন্য ব্যাচ/তারিখে যেতে চান?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg"
              >
                থাকুন
              </button>
              <button
                type="button"
                onClick={handleDiscardAndProceed}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold"
              >
                বাতিল করে যান
              </button>
              <button
                type="button"
                onClick={handleSaveAndProceed}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
