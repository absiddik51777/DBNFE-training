import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Trash2,
  ChevronDown,
  MoreVertical,
  LayoutGrid,
  List
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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

  const presentPercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const absentPercent = totalCount > 0 ? Math.round((absentCount / totalCount) * 100) : 0;
  const leavePercent = totalCount > 0 ? Math.round((leaveCount / totalCount) * 100) : 0;

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
      <div className="space-y-4 pb-20 max-w-7xl mx-auto">
        <div className="h-6 w-48 bg-slate-200/80 rounded animate-pulse" />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      {/* ======================================================== */}
      {/* 1. PAGE HEADER (RESPONSIVE)                              */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            দৈনিক হাজিরা
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {formatBengaliDate(selectedDate)}
            {currentBatch ? ` • ${currentBatch.name}` : ''}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          {/* View Mode Switcher (Grid Cards vs Table) */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="কার্ড গ্রিড ভিউ"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">কার্ড ভিউ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="টেবিল স্প্রেডশিট ভিউ"
            >
              <List size={15} />
              <span className="hidden sm:inline">টেবিল ভিউ</span>
            </button>
          </div>

          <Link
            to="/attendance-sheet"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200/90 shadow-2xs flex items-center space-x-1.5 transition shrink-0"
          >
            <CalendarDays size={16} className="text-emerald-700" />
            <span>মাসিক শিট</span>
          </Link>
        </div>
      </div>

      {/* Inline Feedback Alerts */}
      {saveSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center space-x-2 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {saveErrorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
          <button
            onClick={() => executeSave()}
            className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold"
          >
            পুনরায় চেষ্টা
          </button>
        </div>
      )}

      {permissionNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center space-x-2 shadow-2xs animate-fadeIn">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <span>{permissionNotice}</span>
        </div>
      )}

      {isBeforeBatchStart && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-center space-x-2">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <span>
            নির্বাচিত তারিখটি ({formatBengaliDate(selectedDate)}) ব্যাচ শুরুর তারিখের ({formatBengaliDate(batchStartDateIso)}) পূর্বের। ব্যাচ শুরুর আগের তারিখে হাজিরা গ্রহণ সম্ভব নয়।
          </span>
        </div>
      )}

      {isFutureDate && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center space-x-2">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <span>ভবিষ্যতের তারিখের জন্য হাজিরা গ্রহণ স্থগিত। আজকের বা অতীতের তারিখ নির্বাচন করুন।</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. RESPONSIVE DASHBOARD: HERO CARD & CONTROLS DECK       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Left: Hero Stats Card (5 cols on lg, 4 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#0c1829] rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center space-x-4 sm:space-x-5">
            {/* Circular Progress Gauge */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  className="stroke-slate-800"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  className="stroke-emerald-500 transition-all duration-500 ease-out"
                  strokeWidth="6"
                  strokeDasharray={163.36}
                  strokeDashoffset={163.36 - (163.36 * presentPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm sm:text-base font-bold text-white font-mono">
                  {toBn(presentPercent)}%
                </span>
              </div>
            </div>

            {/* Stats Info */}
            <div>
              <span className="text-xs text-slate-300 font-medium block">আজকের উপস্থিতি</span>
              <div className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
                {toBn(presentCount)} জন উপস্থিত
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">
                বাকি {toBn(Math.max(0, totalCount - presentCount))} জনের হাজিরা
              </span>
            </div>
          </div>

          {/* Multi-Segmented Progress Bar */}
          <div className="space-y-2">
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
              {presentPercent > 0 && (
                <div 
                  style={{ width: `${(presentCount / (totalCount || 1)) * 100}%` }} 
                  className="bg-emerald-500 h-full transition-all duration-300"
                />
              )}
              {absentPercent > 0 && (
                <div 
                  style={{ width: `${(absentCount / (totalCount || 1)) * 100}%` }} 
                  className="bg-rose-500 h-full transition-all duration-300"
                />
              )}
              {leavePercent > 0 && (
                <div 
                  style={{ width: `${(leaveCount / (totalCount || 1)) * 100}%` }} 
                  className="bg-amber-400 h-full transition-all duration-300"
                />
              )}
            </div>

            {/* Legend Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>উপস্থিত: {toBn(presentCount)}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shrink-0" />
                <span>অনুপস্থিত: {toBn(absentCount)}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0" />
                <span>ছুটি: {toBn(leaveCount)}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block shrink-0" />
                <span>বাকি: {toBn(unmarkedCount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls & Actions Deck (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3.5">
          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Institute Selector */}
            {!isTrainer ? (
              <div className="relative">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">প্রতিষ্ঠান</label>
                <div className="relative">
                  <select
                    value={selectedInstitute}
                    onChange={(e) => requestSelectorChange('institute', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-8 text-slate-800 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs appearance-none transition cursor-pointer truncate"
                  >
                    <option value="">সকল প্রতিষ্ঠান</option>
                    {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            ) : null}

            {/* Batch Selector */}
            <div className={`relative ${isTrainer ? 'sm:col-span-2' : ''}`}>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">প্রশিক্ষণ ব্যাচ</label>
              <div className="relative">
                <select
                  value={selectedBatch}
                  disabled={isTrainer}
                  onChange={(e) => requestSelectorChange('batch', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-8 text-slate-800 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs appearance-none transition cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 truncate"
                >
                  <option value="">ব্যাচ নির্বাচন করুন</option>
                  {batches
                    .filter(b => (!selectedInstitute || b.instituteId === selectedInstitute))
                    .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Selector */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">হাজিরার তারিখ</label>
              <div className="relative">
                <input
                  type="date"
                  min={batchStartDateIso || undefined}
                  max={todayDateStr}
                  value={selectedDate}
                  onChange={(e) => requestSelectorChange('date', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-8 text-slate-800 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition cursor-pointer font-mono"
                />
                <CalendarIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Middle Row: Search and Quick Action Buttons */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Field */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-slate-800 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick Actions Buttons */}
            {allTraineesInBatch.length > 0 && canTakeAttendance && !isFutureDate && (
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleBulkActionClick('Present')}
                  className="px-3 py-2 bg-[#e6f7ef] hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition active:scale-98"
                  title="সকল শিক্ষার্থীকে উপস্থিত হিসেবে চিহ্নিত করুন"
                >
                  <Check size={14} className="text-emerald-700" />
                  <span>সবাই উপস্থিত</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkActionClick('Absent')}
                  className="px-3 py-2 bg-[#ffebee] hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition active:scale-98"
                  title="সকল শিক্ষার্থীকে অনুপস্থিত হিসেবে চিহ্নিত করুন"
                >
                  <X size={14} className="text-rose-700" />
                  <span>সবাই অনুপস্থিত</span>
                </button>

                <button
                  type="button"
                  disabled={!hasUnsavedChanges}
                  onClick={handleResetToSaved}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center shadow-2xs transition active:scale-98 disabled:opacity-40"
                  title="পরিবর্তন রিসেট করুন"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Filter Tabs Row */}
          {allTraineesInBatch.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 pt-1 scrollbar-none border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 mr-1 hidden sm:inline">ফিল্টার:</span>
              <button
                type="button"
                onClick={() => setActiveFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
                  activeFilterTab === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                সবাই ({toBn(totalCount)})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterTab('present')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
                  activeFilterTab === 'present'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                উপস্থিত ({toBn(presentCount)})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterTab('absent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
                  activeFilterTab === 'absent'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                অনুপস্থিত ({toBn(absentCount)})
              </button>

              {leaveCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('leave')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
                    activeFilterTab === 'leave'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  ছুটি ({toBn(leaveCount)})
                </button>
              )}

              {unmarkedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('unmarked')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
                    activeFilterTab === 'unmarked'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  চিহ্নিত নয় ({toBn(unmarkedCount)})
                </button>
              )}

              {dirtyCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('dirty')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
                    activeFilterTab === 'dirty'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                  }`}
                >
                  অসংরক্ষিত ({toBn(dirtyCount)})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. TRAINEE LIST: RESPONSIVE GRID OR TABLE VIEW           */}
      {/* ======================================================== */}
      {fetchingTrainees ? (
        <TableSkeleton rows={6} cols={3} showHeader={false} showToolbar={false} />
      ) : allTraineesInBatch.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-3xl border border-dashed border-slate-200 text-xs">
          কোনো সক্রিয় শিক্ষার্থী পাওয়া যায়নি।
        </div>
      ) : displayedTrainees.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-3xl border border-dashed border-slate-200 text-xs">
          কোনো শিক্ষার্থী এই তালিকায় নেই।
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (DESKTOP OPTIMIZED) */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-14 text-center">ক্র.</th>
                  <th className="py-3.5 px-4 w-36">আইডি ও রোল</th>
                  <th className="py-3.5 px-4">প্রশিক্ষণার্থীর নাম ও অভিভাবক</th>
                  <th className="py-3.5 px-4 text-center w-72">হাজিরা স্ট্যাটাস</th>
                  <th className="py-3.5 px-4 text-center w-28">অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTrainees.map((t, idx) => {
                  const item = attendanceMap[t.id];
                  const status = item?.status || 'Unmarked';
                  const isDirty = item?.status !== item?.initialStatus;
                  const isSaved = item?.isSavedInDb && !isDirty;
                  const isLocked = item?.isSavedInDb && !canEditAttendance;

                  return (
                    <tr 
                      key={t.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        status === 'Present' 
                          ? 'bg-emerald-50/20' 
                          : status === 'Absent' 
                          ? 'bg-rose-50/20' 
                          : status === 'Leave' 
                          ? 'bg-amber-50/20' 
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-500">
                        {toBn(idx + 1)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-800 text-xs block">
                          {t.traineeId || t.id}
                        </span>
                        {t.registrationNumber && (
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {t.registrationNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200/80">
                            {(t.nameBn || t.nameEn || 'শ').trim().charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">
                              {t.nameBn || t.nameEn}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              পিতা: {t.fatherNameBn || t.fatherNameEn || '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isLocked ? (
                          <div 
                            onClick={() => {
                              setPermissionNotice(`"${t.nameBn || t.nameEn}" এর হাজিরা ইতোমধ্যে সংরক্ষিত। পরিবর্তনের জন্য 'edit_attendance' অনুমতি প্রয়োজন।`);
                              setTimeout(() => setPermissionNotice(''), 4500);
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 cursor-pointer"
                          >
                            <Lock size={12} className="text-slate-400" />
                            <span className={status === 'Present' ? 'text-emerald-700 font-bold' : status === 'Absent' ? 'text-rose-700 font-bold' : 'text-amber-700 font-bold'}>
                              {status === 'Present' ? 'উপস্থিত (লকড)' : status === 'Absent' ? 'অনুপস্থিত (লকড)' : status === 'Leave' ? 'ছুটি (লকড)' : 'চিহ্নিত নয়'}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex bg-slate-100 p-1 rounded-xl items-center gap-1 border border-slate-200/80">
                            <button
                              type="button"
                              disabled={!canTakeAttendance || isFutureDate}
                              onClick={() => setStatus(t.id, 'Present')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                status === 'Present'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              উপস্থিত
                            </button>
                            <button
                              type="button"
                              disabled={!canTakeAttendance || isFutureDate}
                              onClick={() => setStatus(t.id, 'Absent')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                status === 'Absent'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              অনুপস্থিত
                            </button>
                            <button
                              type="button"
                              disabled={!canTakeAttendance || isFutureDate}
                              onClick={() => setStatus(t.id, 'Leave')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                status === 'Leave'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              ছুটি
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDirty ? (
                          <span className="inline-block bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xs">
                            অসংরক্ষিত
                          </span>
                        ) : isSaved ? (
                          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                            {isLocked && <Lock size={10} className="text-slate-400" />}
                            <span>সংরক্ষিত</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW (RESPONSIVE MULTI-COLUMN CARDS: 1 col on mobile, 2 cols on tablet, 3 cols on desktop, 4 cols on ultrawide) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4">
          {displayedTrainees.map((t, idx) => {
            const item = attendanceMap[t.id];
            const status = item?.status || 'Unmarked';
            const isDirty = item?.status !== item?.initialStatus;
            const isSaved = item?.isSavedInDb && !isDirty;
            const isLocked = item?.isSavedInDb && !canEditAttendance;

            return (
              <div 
                key={t.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 relative overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col justify-between"
              >
                {/* Left Colored Vertical Accent Strip */}
                <div 
                  className={`absolute left-0 top-0 bottom-0 w-2.5 rounded-l-3xl transition-colors duration-200 ${
                    status === 'Present'
                      ? 'bg-emerald-600'
                      : status === 'Absent'
                      ? 'bg-rose-600'
                      : status === 'Leave'
                      ? 'bg-amber-500'
                      : 'bg-slate-200'
                  }`}
                />

                {/* Card Top Row: Avatar, Name, Roll/Serial, Status Badge */}
                <div className="flex items-start justify-between pl-1.5 gap-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    {/* Avatar Circle with Initial */}
                    <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-base shrink-0 border border-slate-200/70 shadow-2xs">
                      {(t.nameBn || t.nameEn || 'শ').trim().charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-base sm:text-lg leading-snug truncate">
                        {t.nameBn || t.nameEn}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mt-0.5">
                        <span>ক্র. {toBn(idx + 1)}</span>
                        {t.traineeId && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{t.traineeId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="shrink-0">
                    {isDirty ? (
                      <span className="inline-block bg-amber-100/90 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200/80 shadow-2xs">
                        অসংরক্ষিত
                      </span>
                    ) : isSaved ? (
                      <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {isLocked && <Lock size={10} className="text-slate-400" />}
                        <span>সংরক্ষিত</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Card Bottom Row: 3-Segmented Toggle Buttons */}
                <div className="mt-4 pl-1.5">
                  {isLocked ? (
                    <div 
                      onClick={() => {
                        setPermissionNotice(`"${t.nameBn || t.nameEn}" এর হাজিরা ইতোমধ্যে সংরক্ষিত। সংরক্ষিত রেকর্ড পরিবর্তনের জন্য 'edit_attendance' অনুমতি প্রয়োজন।`);
                        setTimeout(() => setPermissionNotice(''), 4500);
                      }}
                      className="bg-slate-100/90 p-2.5 rounded-2xl flex items-center justify-center space-x-2 text-xs font-semibold text-slate-600 border border-slate-200 cursor-pointer"
                    >
                      <Lock size={14} className="text-slate-400" />
                      <span className={status === 'Present' ? 'text-emerald-700 font-bold' : status === 'Absent' ? 'text-rose-700 font-bold' : 'text-amber-700 font-bold'}>
                        {status === 'Present' ? 'উপস্থিত (সংরক্ষিত ও লকড)' : status === 'Absent' ? 'অনুপস্থিত (সংরক্ষিত ও লকড)' : status === 'Leave' ? 'ছুটি (সংরক্ষিত ও লকড)' : 'চিহ্নিত নয়'}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center justify-between gap-1 border border-slate-200/70">
                      {/* উপস্থিত (Present) */}
                      <button
                        type="button"
                        disabled={!canTakeAttendance || isFutureDate}
                        onClick={() => setStatus(t.id, 'Present')}
                        className={`flex-1 py-2.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-center flex items-center justify-center ${
                          status === 'Present'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                        }`}
                      >
                        উপস্থিত
                      </button>

                      {/* অনুপস্থিত (Absent) */}
                      <button
                        type="button"
                        disabled={!canTakeAttendance || isFutureDate}
                        onClick={() => setStatus(t.id, 'Absent')}
                        className={`flex-1 py-2.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-center flex items-center justify-center ${
                          status === 'Absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                        }`}
                      >
                        অনুপস্থিত
                      </button>

                      {/* ছুটি (Leave) */}
                      <button
                        type="button"
                        disabled={!canTakeAttendance || isFutureDate}
                        onClick={() => setStatus(t.id, 'Leave')}
                        className={`flex-1 py-2.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-center flex items-center justify-center ${
                          status === 'Leave'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                        }`}
                      >
                        ছুটি
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. FLOATING STICKY SAVE BAR (RESPONSIVE)                 */}
      {/* ======================================================== */}
      {allTraineesInBatch.length > 0 && hasUnsavedChanges && (
        <div className="fixed bottom-5 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-40 bg-[#0f172a]/95 backdrop-blur-md text-white rounded-2xl shadow-2xl px-5 sm:px-6 py-3.5 border border-slate-700/80 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-xs sm:text-sm font-medium flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block shrink-0" />
            <span>
              <span className="text-amber-400 font-black">{toBn(dirtyCount)}</span> জনের অসংরক্ষিত পরিবর্তন
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleResetToSaved}
              className="text-xs sm:text-sm text-slate-300 hover:text-white font-medium px-2.5 py-1.5 transition"
            >
              বাতিল
            </button>

            <button
              type="button"
              onClick={() => executeSave()}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition active:scale-95 flex items-center space-x-1.5"
            >
              <Save size={16} />
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
