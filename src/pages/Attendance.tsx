import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  GraduationCap,
  Sun,
  Moon,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  CheckCheck,
  XCircle,
  RotateCcw,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Batch,
  Institute,
  Trade,
  Trainee,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { dataService } from '../lib/dataService';
import { recordSimpleAuditLog } from '../lib/auditLog';
import { formatBengaliDate, safeFormatDate, toBn } from '../lib/dateUtils';
import { useActionRunner, type ActionStep } from '../hooks/useActionRunner';
import { ActionButton } from '../components/ui/ActionButton';
import { ActionMessageError } from '../lib/friendlyError';
import { StudentAttendanceCard } from '../components/attendance/StudentAttendanceCard';
import { TruncatedText } from '../components/ui/TruncatedText';
import {
  BatchPickerSheet,
  EditUnlockReasonSheet,
  LeaveReasonSheet,
  MonthlyHeatmapSheet,
  StudentDetailSheet,
} from '../components/attendance/AttendanceSheets';
import {
  BN_MONTHS,
  BN_WEEKDAYS,
  addDaysIso,
  getDisplayName,
  triggerHaptic,
  type AttendanceFilterTab,
  type AttendanceSortOption,
  type DayDotItem,
  type ExtendedAttendanceStatus,
  type SevenDaySummary,
  type TraineeAttendanceItem,
} from '../components/attendance/types';

interface DraftPayload {
  marks: Record<string, { status: ExtendedAttendanceStatus; leaveReason?: string }>;
  updatedAt: number;
}

const getDraftStorageKey = (batchId: string, dateStr: string) =>
  `bnfe_att_draft_${batchId}_${dateStr}`;

const getEditReasonStorageKey = (batchId: string, dateStr: string) =>
  `bnfe_att_edit_reason_${batchId}_${dateStr}`;

const getUnlockedStorageKey = (batchId: string, dateStr: string) =>
  `bnfe_att_unlocked_${batchId}_${dateStr}`;

const formatSwitcherDateLabel = (dateStr: string, isToday: boolean): string => {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = parseInt(yStr || '', 10);
  const m = parseInt(mStr || '', 10);
  const d = parseInt(dStr || '', 10);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  const datePart = `${toBn(d)} ${BN_MONTHS[m - 1] || ''} ${toBn(y)}`;
  const dayPart = BN_WEEKDAYS[dt.getDay()] || '';
  return `${datePart} / ${dayPart}${isToday ? ' · আজ' : ''}`;
};

const Attendance: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const { resolvedMode, setMode } = useTheme();
  const [searchParams] = useSearchParams();
  const paramBatchId = searchParams.get('batchId') || '';
  const paramDate = searchParams.get('date') || '';

  const canTakeAttendance = hasPermission('take_attendance');
  const canEditAttendance = hasPermission('edit_attendance');
  const isTrainer = userProfile?.role === 'Trainer';

  // Master data
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Selection state
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : format(new Date(), 'yyyy-MM-dd')
  );

  // Pending date/batch switch when unsaved changes exist
  const [pendingChange, setPendingChange] = useState<{
    type: 'batch' | 'date';
    value: string;
  } | null>(null);

  // Batch trainees, daily attendance map, and full batch attendance history
  const [allTraineesInBatch, setAllTraineesInBatch] = useState<Trainee[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, TraineeAttendanceItem>
  >({});
  const [allBatchAttendance, setAllBatchAttendance] = useState<AttendanceRecord[]>([]);

  // Lock & edit reason state keyed by `${batchId}_${date}`
  const [unlockedDays, setUnlockedDays] = useState<Record<string, boolean>>({});
  const [lastEditReason, setLastEditReason] = useState<string>('');

  // UI states
  const [loading, setLoading] = useState(true);
  const [fetchingTrainees, setFetchingTrainees] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Search, sort, filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<AttendanceSortOption>('default');
  const [activeFilterTab, setActiveFilterTab] = useState<AttendanceFilterTab>('all');

  // Menus & Bottom Sheets
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [leaveTargetTrainee, setLeaveTargetTrainee] = useState<Trainee | null>(null);
  const [unlockSheetOpen, setUnlockSheetOpen] = useState(false);
  const [detailTrainee, setDetailTrainee] = useState<Trainee | null>(null);
  const [monthlySheetOpen, setMonthlySheetOpen] = useState(false);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);

  const todayDateStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const currentBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatch),
    [batches, selectedBatch]
  );

  const batchStartDateIso = useMemo(() => {
    if (!currentBatch?.startDate) return '';
    return safeFormatDate(currentBatch.startDate, 'yyyy-MM-dd');
  }, [currentBatch]);

  const monthStartStr = useMemo(() => `${todayDateStr.slice(0, 7)}-01`, [todayDateStr]);
  const minNavDateStr = useMemo(() => {
    if (
      batchStartDateIso &&
      /^\d{4}-\d{2}-\d{2}$/.test(batchStartDateIso) &&
      batchStartDateIso > monthStartStr &&
      batchStartDateIso <= todayDateStr
    ) {
      return batchStartDateIso;
    }
    return monthStartStr;
  }, [batchStartDateIso, monthStartStr, todayDateStr]);

  const isBeforeBatchStart = Boolean(
    batchStartDateIso &&
      /^\d{4}-\d{2}-\d{2}$/.test(batchStartDateIso) &&
      selectedDate < batchStartDateIso
  );
  const isPastDate = selectedDate < todayDateStr;
  const isTodayDate = selectedDate === todayDateStr;

  const dayKey = `${selectedBatch}_${selectedDate}`;
  const hasSavedInDb = useMemo(
    () => Object.values(attendanceMap).some((item) => item.isSavedInDb),
    [attendanceMap]
  );

  const isDayLocked = useMemo(() => {
    if (isBeforeBatchStart) return true;
    if (unlockedDays[dayKey]) return false;
    if (isPastDate) return true;
    return hasSavedInDb;
  }, [isBeforeBatchStart, unlockedDays, dayKey, isPastDate, hasSavedInDb]);

  // Dirty changes
  const dirtyItems = useMemo(
    () =>
      Object.values(attendanceMap).filter(
        (item) =>
          item.status !== item.initialStatus ||
          (item.leaveReason || '') !== (item.initialLeaveReason || '')
      ),
    [attendanceMap]
  );
  const hasUnsavedChanges = dirtyItems.length > 0;

  // Show temporary feedback helper
  const showFeedback = useCallback((type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
  }, []);

  useEffect(() => {
    if (!feedbackMsg) return;
    const t = window.setTimeout(() => setFeedbackMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [feedbackMsg]);

  // Close overflow menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  // Browser unload warning
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

  // Initial master data fetch
  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [instData, trdData, btcData] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
      ]);

      setInstitutes(instData);
      setTrades(trdData);
      setBatches(btcData);

      let targetInst = '';
      let targetBatch = '';
      let targetTrade = '';

      if (userProfile?.role === 'Trainer') {
        targetInst = userProfile.instituteId || instData[0]?.id || '';
        if (userProfile.batchId) {
          targetBatch = userProfile.batchId;
          const assignedBatch = btcData.find((b) => b.id === userProfile.batchId);
          if (assignedBatch) {
            targetInst = assignedBatch.instituteId || targetInst;
            targetTrade = assignedBatch.tradeId || '';
          }
        } else {
          const matching = btcData.filter((b) => b.instituteId === targetInst);
          if (matching.length > 0) {
            targetBatch = matching[0].id;
            targetTrade = matching[0].tradeId || '';
          }
        }
      } else {
        targetInst = userProfile?.instituteId || instData[0]?.id || '';
        const matching = btcData.filter((b) => b.instituteId === targetInst);
        if (matching.length > 0) {
          targetBatch = matching[0].id;
          targetTrade = matching[0].tradeId || '';
        } else if (btcData.length > 0) {
          targetBatch = btcData[0].id;
          targetInst = btcData[0].instituteId || targetInst;
          targetTrade = btcData[0].tradeId || '';
        }
      }

      if (!targetTrade && trdData.length > 0) {
        targetTrade = trdData[0].id;
      }

      if (paramBatchId) {
        const requestedBatch = btcData.find((b) => b.id === paramBatchId);
        if (
          requestedBatch &&
          (userProfile?.role !== 'Trainer' ||
            !userProfile.batchId ||
            userProfile.batchId === requestedBatch.id)
        ) {
          targetBatch = requestedBatch.id;
          targetInst = requestedBatch.instituteId || targetInst;
          targetTrade = requestedBatch.tradeId || targetTrade;
        }
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
        setSelectedDate(paramDate);
      }

      setSelectedInstitute(targetInst);
      setSelectedBatch(targetBatch);
      setSelectedTrade(targetTrade);
    } catch (error) {
      console.warn('Notice fetching initial data in Attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync URL ?batchId & ?date when triggered from notifications
  useEffect(() => {
    if (batches.length === 0) return;
    if (paramBatchId) {
      const requestedBatch = batches.find((b) => b.id === paramBatchId);
      if (
        requestedBatch &&
        (userProfile?.role !== 'Trainer' ||
          !userProfile.batchId ||
          userProfile.batchId === requestedBatch.id)
      ) {
        if (requestedBatch.instituteId && requestedBatch.instituteId !== selectedInstitute) {
          setSelectedInstitute(requestedBatch.instituteId);
        }
        if (requestedBatch.tradeId && requestedBatch.tradeId !== selectedTrade) {
          setSelectedTrade(requestedBatch.tradeId);
        }
        if (requestedBatch.id !== selectedBatch) {
          setSelectedBatch(requestedBatch.id);
        }
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(paramDate) && paramDate !== selectedDate) {
      setSelectedDate(paramDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramBatchId, paramDate, batches, userProfile?.role, userProfile?.batchId]);

  // Fetch trainees and attendance for selected batch + date
  useEffect(() => {
    if (selectedBatch && selectedDate) {
      fetchTraineesAndAttendance();
    } else {
      setAttendanceMap({});
      setAllTraineesInBatch([]);
      setAllBatchAttendance([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch, selectedDate]);

  const fetchTraineesAndAttendance = async () => {
    setFetchingTrainees(true);
    setFeedbackMsg(null);

    try {
      const [allTrainees, allAttendance] = await Promise.all([
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<AttendanceRecord>('attendance'),
      ]);

      const batchTrainees = allTrainees
        .filter((t) => t.batchId === selectedBatch && (!t.status || t.status === 'Active'))
        .sort((a, b) =>
          (a.traineeId || a.id).localeCompare(b.traineeId || b.id, undefined, {
            numeric: true,
          })
        );

      const batchAttendance = allAttendance.filter((a) => a.batchId === selectedBatch);
      setAllTraineesInBatch(batchTrainees);
      setAllBatchAttendance(batchAttendance);

      const recordByTraineeId = new Map<string, AttendanceRecord>();
      batchAttendance
        .filter((a) => a.date === selectedDate)
        .forEach((a) => recordByTraineeId.set(a.traineeId, a));

      // Load saved edit reason & unlock state from localStorage
      try {
        const storedReason =
          localStorage.getItem(getEditReasonStorageKey(selectedBatch, selectedDate)) || '';
        setLastEditReason(storedReason);

        const storedUnlocked =
          localStorage.getItem(getUnlockedStorageKey(selectedBatch, selectedDate)) === '1';
        if (storedUnlocked) {
          setUnlockedDays((prev) => ({
            ...prev,
            [`${selectedBatch}_${selectedDate}`]: true,
          }));
        }
      } catch {
        setLastEditReason('');
      }

      // Load local draft for today (if present)
      let parsedDraft: DraftPayload | null = null;
      if (selectedDate === todayDateStr) {
        try {
          const rawDraft = localStorage.getItem(
            getDraftStorageKey(selectedBatch, selectedDate)
          );
          if (rawDraft) {
            parsedDraft = JSON.parse(rawDraft) as DraftPayload;
          }
        } catch {
          parsedDraft = null;
        }
      }

      const newMap: Record<string, TraineeAttendanceItem> = {};
      batchTrainees.forEach((t) => {
        const existingRecord = recordByTraineeId.get(t.id);
        const initialStatus: ExtendedAttendanceStatus = existingRecord
          ? existingRecord.status
          : 'Unmarked';
        const initialReason =
          existingRecord && existingRecord.status === 'Leave'
            ? existingRecord.remarks || ''
            : '';

        const draftEntry = parsedDraft?.marks?.[t.id];
        const status = draftEntry ? draftEntry.status : initialStatus;
        const leaveReason = draftEntry
          ? draftEntry.status === 'Leave'
            ? draftEntry.leaveReason || ''
            : ''
          : initialReason;

        newMap[t.id] = {
          id: t.id,
          trainee: t,
          status,
          initialStatus,
          leaveReason,
          initialLeaveReason: initialReason,
          isSavedInDb: Boolean(existingRecord),
          dbRecordId: existingRecord?.id,
        };
      });

      setAttendanceMap(newMap);
    } catch (error) {
      console.warn('Notice fetching trainees/attendance:', error);
      showFeedback('error', 'হাজিরা তথ্য লোড করতে সমস্যা হয়েছে।');
    } finally {
      setFetchingTrainees(false);
    }
  };

  // Persist localStorage draft automatically whenever today's attendanceMap has unsaved marks
  useEffect(() => {
    if (!selectedBatch || !selectedDate || !isTodayDate || fetchingTrainees) return;
    const key = getDraftStorageKey(selectedBatch, selectedDate);
    try {
      const changed: DraftPayload['marks'] = {};
      let count = 0;
      Object.values(attendanceMap).forEach((item) => {
        if (
          item.status !== item.initialStatus ||
          (item.leaveReason || '') !== (item.initialLeaveReason || '')
        ) {
          changed[item.id] = {
            status: item.status,
            leaveReason: item.leaveReason,
          };
          count++;
        }
      });
      if (count > 0) {
        const payload: DraftPayload = { marks: changed, updatedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(payload));
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [attendanceMap, selectedBatch, selectedDate, isTodayDate, fetchingTrainees]);

  // Safe selector change with unsaved check
  const applySelectorChange = (type: 'batch' | 'date', value: string) => {
    if (type === 'batch') {
      if (isTrainer) return;
      setSelectedBatch(value);
      const b = batches.find((x) => x.id === value);
      if (b?.tradeId) setSelectedTrade(b.tradeId);
      if (b?.instituteId) setSelectedInstitute(b.instituteId);
    } else if (type === 'date') {
      setSelectedDate(value);
    }
    setPendingChange(null);
  };

  const requestSelectorChange = (type: 'batch' | 'date', value: string) => {
    if (type === 'batch' && isTrainer) return;
    if (type === 'date') {
      if (value < minNavDateStr || value > todayDateStr) return;
    }
    if (hasUnsavedChanges) {
      setPendingChange({ type, value });
    } else {
      applySelectorChange(type, value);
    }
  };

  const handleStepDate = (delta: number) => {
    const nextDate = addDaysIso(selectedDate, delta);
    if (nextDate < minNavDateStr || nextDate > todayDateStr) return;
    triggerHaptic(8);
    requestSelectorChange('date', nextDate);
  };

  // Status click / swipe handler
  const handleSelectStatus = (traineeId: string, targetStatus: AttendanceStatus) => {
    const item = attendanceMap[traineeId];
    if (!item) return;

    if (isDayLocked) {
      showFeedback('error', 'এই দিনের হাজিরা লক করা। পরিবর্তন করতে "সম্পাদনা" চাপুন।');
      return;
    }

    if (!canTakeAttendance && !canEditAttendance) {
      showFeedback('error', 'আপনার হাজিরা গ্রহণের অনুমতি নেই।');
      return;
    }

    if (targetStatus === 'Leave') {
      if (item.status === 'Leave') {
        setAttendanceMap((prev) => {
          const cur = prev[traineeId];
          if (!cur) return prev;
          return {
            ...prev,
            [traineeId]: { ...cur, status: 'Unmarked', leaveReason: '' },
          };
        });
      } else {
        setLeaveTargetTrainee(item.trainee);
      }
      return;
    }

    setAttendanceMap((prev) => {
      const cur = prev[traineeId];
      if (!cur) return prev;
      const nextStatus: ExtendedAttendanceStatus =
        cur.status === targetStatus ? 'Unmarked' : targetStatus;
      return {
        ...prev,
        [traineeId]: {
          ...cur,
          status: nextStatus,
          leaveReason: '',
        },
      };
    });
  };

  const handleSwipeStatus = (traineeId: string, targetStatus: 'Present' | 'Absent') => {
    if (isDayLocked || (!canTakeAttendance && !canEditAttendance)) return;
    setAttendanceMap((prev) => {
      const cur = prev[traineeId];
      if (!cur) return prev;
      return {
        ...prev,
        [traineeId]: {
          ...cur,
          status: targetStatus,
          leaveReason: '',
        },
      };
    });
  };

  const handlePickLeaveReason = (reason: string) => {
    if (!leaveTargetTrainee) return;
    const tid = leaveTargetTrainee.id;
    triggerHaptic(10);
    setAttendanceMap((prev) => {
      const cur = prev[tid];
      if (!cur) return prev;
      return {
        ...prev,
        [tid]: {
          ...cur,
          status: 'Leave',
          leaveReason: reason,
        },
      };
    });
    setLeaveTargetTrainee(null);
  };

  // Fill remaining unmarked students as Present
  const handleFillRemaining = () => {
    if (isDayLocked || (!canTakeAttendance && !canEditAttendance)) return;
    triggerHaptic(12);
    setAttendanceMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((tid) => {
        if (next[tid].status === 'Unmarked') {
          next[tid] = { ...next[tid], status: 'Present', leaveReason: '' };
        }
      });
      return next;
    });
  };

  // Bulk menu actions: সবাই উপস্থিত / সবাই অনুপস্থিত / রিসেট
  const handleBulkMenuAction = (action: 'Present' | 'Absent' | 'Reset') => {
    setMenuOpen(false);
    if (isDayLocked) {
      showFeedback('error', 'দিনটি লক করা। পরিবর্তনের আগে "সম্পাদনা" চাপুন।');
      return;
    }
    if (!canTakeAttendance && !canEditAttendance) {
      showFeedback('error', 'আপনার হাজিরা গ্রহণের অনুমতি নেই।');
      return;
    }
    triggerHaptic(12);

    const targetStatus: ExtendedAttendanceStatus =
      action === 'Reset' ? 'Unmarked' : action;

    setAttendanceMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((tid) => {
        next[tid] = {
          ...next[tid],
          status: targetStatus,
          leaveReason: '',
        };
      });
      return next;
    });
  };

  // Discard unsaved changes (বাতিল)
  const handleDiscardChanges = () => {
    triggerHaptic(8);
    setAttendanceMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((tid) => {
        next[tid] = {
          ...next[tid],
          status: next[tid].initialStatus,
          leaveReason: next[tid].initialLeaveReason || '',
        };
      });
      return next;
    });
    try {
      localStorage.removeItem(getDraftStorageKey(selectedBatch, selectedDate));
    } catch {
      // ignore
    }
  };

  // Unlock locked day with audited reason (throws on error so EditUnlockReasonSheet runner reflects reality)
  const handleConfirmUnlockReason = async (reason: string) => {
    if (!selectedBatch || !selectedDate) {
      throw new ActionMessageError('ব্যাচ বা তারিখ নির্বাচিত নেই।');
    }
    const actor = userProfile
      ? {
          userId: userProfile.id || '',
          user: userProfile.name || 'User',
          userRole: userProfile.role || '',
        }
      : undefined;

    await recordSimpleAuditLog({
      action: 'update',
      module: 'attendance',
      collectionName: 'attendance',
      targetId: `${selectedBatch}_${selectedDate}`,
      targetLabel: `${currentBatch?.name || selectedBatch} (${selectedDate})`,
      title: `হাজিরা সম্পাদনা আনলক: ${currentBatch?.name || selectedBatch} (${formatBengaliDate(
        selectedDate
      )})`,
      details: `আনলকের কারণ: ${reason}`,
      actor,
    });

    setLastEditReason(reason);
    setUnlockedDays((prev) => ({ ...prev, [dayKey]: true }));
    try {
      localStorage.setItem(getEditReasonStorageKey(selectedBatch, selectedDate), reason);
      localStorage.setItem(getUnlockedStorageKey(selectedBatch, selectedDate), '1');
    } catch {
      // ignore
    }
    triggerHaptic(14);
  };

  // Core batch attendance save operation (throws on validation or backend failure)
  const validateAttendanceSave = (): boolean => {
    if (allTraineesInBatch.length === 0) return false;
    if (isBeforeBatchStart) {
      showFeedback(
        'error',
        `ব্যাচ শুরুর তারিখ (${formatBengaliDate(batchStartDateIso)}) এর আগে হাজিরা নেওয়া যাবে না।`
      );
      return false;
    }

    const markedItems = Object.values(attendanceMap).filter(
      (item) => item.status !== 'Unmarked'
    );
    if (markedItems.length === 0) {
      showFeedback('error', 'অনুগ্রহ করে অন্তত একজন শিক্ষার্থীর হাজিরা চিহ্নিত করুন।');
      return false;
    }

    if (isTrainer && userProfile?.batchId && selectedBatch !== userProfile.batchId) {
      showFeedback('error', 'প্রশিক্ষক শুধুমাত্র নির্ধারিত ব্যাচের হাজিরা সংরক্ষণ করতে পারেন।');
      return false;
    }

    return true;
  };

  const performSaveBatch = async (): Promise<{ count: number }> => {
    if (allTraineesInBatch.length === 0) {
      throw new ActionMessageError('এই ব্যাচে কোনো শিক্ষার্থী নেই।');
    }
    if (isBeforeBatchStart) {
      throw new ActionMessageError(
        `ব্যাচ শুরুর তারিখ (${formatBengaliDate(batchStartDateIso)}) এর আগে হাজিরা নেওয়া যাবে না।`
      );
    }

    const markedItems = Object.values(attendanceMap).filter(
      (item) => item.status !== 'Unmarked'
    );
    if (markedItems.length === 0) {
      throw new ActionMessageError('অনুগ্রহ করে অন্তত একজন শিক্ষার্থীর হাজিরা চিহ্নিত করুন।');
    }

    if (isTrainer && userProfile?.batchId && selectedBatch !== userProfile.batchId) {
      throw new ActionMessageError('প্রশিক্ষক শুধুমাত্র নির্ধারিত ব্যাচের হাজিরা সংরক্ষণ করতে পারেন।');
    }

    const now = Date.now();
    const recordsToSave: AttendanceRecord[] = markedItems.map((item) => {
      const compositeId =
        item.dbRecordId || `ATT_${selectedBatch}_${selectedDate}_${item.id}`;
      return {
        id: compositeId,
        batchId: selectedBatch,
        instituteId: selectedInstitute,
        tradeId: selectedTrade,
        date: selectedDate,
        traineeId: item.id,
        status: item.status as AttendanceStatus,
        remarks:
          item.status === 'Leave' ? item.leaveReason || 'অন্যান্য' : undefined,
        recordedBy: userProfile?.name || 'User',
        createdAt: now,
        updatedAt: now,
      };
    });

    const traineeNamesMap: Record<string, string> = {};
    markedItems.forEach((item) => {
      traineeNamesMap[item.id] = getDisplayName(item.trainee);
    });

    const result = await dataService.saveAttendanceBatch(recordsToSave, {
      traineeNamesMap,
      batchName: currentBatch?.name || selectedBatch,
      actor: userProfile
        ? {
            userId: userProfile.id || '',
            user: userProfile.name || 'User',
            userRole: userProfile.role || '',
          }
        : undefined,
    });

    if (!result.success) {
      const batchErr = new Error(result.error || 'হাজিরা সংরক্ষণে সমস্যা হয়েছে');
      (batchErr as any).code = result.errorCode;
      throw batchErr;
    }

    // Sync local state & lock the day
    setAttendanceMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((tid) => {
        const cur = next[tid];
        const savedRec = recordsToSave.find((r) => r.traineeId === tid);
        if (savedRec) {
          next[tid] = {
            ...cur,
            status: savedRec.status,
            initialStatus: savedRec.status,
            leaveReason: savedRec.status === 'Leave' ? savedRec.remarks || '' : '',
            initialLeaveReason:
              savedRec.status === 'Leave' ? savedRec.remarks || '' : '',
            isSavedInDb: true,
            dbRecordId: savedRec.id,
          };
        } else {
          next[tid] = {
            ...cur,
            initialStatus: cur.status,
            initialLeaveReason: cur.leaveReason || '',
          };
        }
      });
      return next;
    });

    // Merge saved records into local allBatchAttendance so 7-day dots & sheets update instantly
    setAllBatchAttendance((prev) => {
      const filtered = prev.filter(
        (r) => !(r.batchId === selectedBatch && r.date === selectedDate)
      );
      return [...filtered, ...recordsToSave];
    });

    // Re-lock the day and clear localStorage draft + unlock flag
    setUnlockedDays((prev) => {
      const copy = { ...prev };
      delete copy[dayKey];
      return copy;
    });
    try {
      localStorage.removeItem(getDraftStorageKey(selectedBatch, selectedDate));
      localStorage.removeItem(getUnlockedStorageKey(selectedBatch, selectedDate));
    } catch {
      // ignore
    }

    triggerHaptic(16);
    showFeedback(
      'success',
      `${toBn(recordsToSave.length)} জন শিক্ষার্থীর হাজিরা সংরক্ষিত ও লক করা হয়েছে।`
    );
    return { count: recordsToSave.length };
  };

  const attendanceSaveSteps: ActionStep<{ count: number }>[] = useMemo(
    () => [
      {
        id: 'save-attendance-batch',
        label: 'দৈনিক হাজিরা সংরক্ষণ করা হচ্ছে',
        run: () => performSaveBatch(),
        describe: (res) => `${toBn(res.count)} জন শিক্ষার্থীর হাজিরা সংরক্ষিত`,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      allTraineesInBatch.length,
      attendanceMap,
      batchStartDateIso,
      currentBatch?.name,
      dayKey,
      isBeforeBatchStart,
      isTrainer,
      selectedBatch,
      selectedDate,
      selectedInstitute,
      selectedTrade,
      userProfile,
    ]
  );

  const saveRunner = useActionRunner(attendanceSaveSteps);
  const pendingSaveRunner = useActionRunner(attendanceSaveSteps);
  const isAnySaveBusy =
    saveRunner.phase === 'running' ||
    saveRunner.phase === 'waiting' ||
    pendingSaveRunner.phase === 'running' ||
    pendingSaveRunner.phase === 'waiting';

  // Reset saveRunner when user modifies marks again after a completed save or switches batch/date
  useEffect(() => {
    saveRunner.reset();
    pendingSaveRunner.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch, selectedDate]);

  useEffect(() => {
    if (hasUnsavedChanges && saveRunner.phase === 'success') {
      saveRunner.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges]);

  // Compute 7-day history summary per trainee (last 7 days ending on selectedDate)
  const sevenDayDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysIso(selectedDate, i - 6));
  }, [selectedDate]);

  const sevenDaySummaryByTrainee = useMemo(() => {
    const recordLookup = new Map<string, AttendanceStatus>();
    allBatchAttendance.forEach((rec) => {
      recordLookup.set(`${rec.traineeId}_${rec.date}`, rec.status);
    });

    const map: Record<string, SevenDaySummary> = {};
    allTraineesInBatch.forEach((t) => {
      let present = 0;
      let marked = 0;

      const dots: DayDotItem[] = sevenDayDates.map((iso) => {
        const liveItem = iso === selectedDate ? attendanceMap[t.id] : undefined;
        const status: ExtendedAttendanceStatus = liveItem
          ? liveItem.status
          : recordLookup.get(`${t.id}_${iso}`) || 'Unmarked';

        if (status !== 'Unmarked') {
          marked++;
          if (status === 'Present') present++;
        }
        const dayNum = parseInt(iso.split('-')[2] || '0', 10);
        return { date: iso, dayNumber: dayNum, status };
      });

      const ratePercent = marked > 0 ? Math.round((present / marked) * 100) : null;
      const isLow = ratePercent !== null && ratePercent < 70;
      map[t.id] = {
        dots,
        presentCount: present,
        markedCount: marked,
        ratePercent,
        isLow,
      };
    });

    return map;
  }, [allTraineesInBatch, allBatchAttendance, sevenDayDates, selectedDate, attendanceMap]);

  // Summary Metrics
  const totalCount = allTraineesInBatch.length;
  const presentCount = useMemo(
    () => Object.values(attendanceMap).filter((a) => a.status === 'Present').length,
    [attendanceMap]
  );
  const absentCount = useMemo(
    () => Object.values(attendanceMap).filter((a) => a.status === 'Absent').length,
    [attendanceMap]
  );
  const leaveCount = useMemo(
    () => Object.values(attendanceMap).filter((a) => a.status === 'Leave').length,
    [attendanceMap]
  );
  const unmarkedCount = useMemo(
    () => Object.values(attendanceMap).filter((a) => a.status === 'Unmarked').length,
    [attendanceMap]
  );
  const lowAttendanceCount = useMemo(
    () =>
      allTraineesInBatch.filter((t) => sevenDaySummaryByTrainee[t.id]?.isLow).length,
    [allTraineesInBatch, sevenDaySummaryByTrainee]
  );

  const presentPercent =
    totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Filtered & sorted list (search by name only)
  const displayedTrainees = useMemo(() => {
    const filtered = allTraineesInBatch.filter((t) => {
      const item = attendanceMap[t.id];
      if (!item) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchBn = (t.nameBn || '').toLowerCase().includes(q);
        const matchEn = (t.nameEn || '').toLowerCase().includes(q);
        if (!matchBn && !matchEn) return false;
      }

      if (activeFilterTab === 'present') return item.status === 'Present';
      if (activeFilterTab === 'absent') return item.status === 'Absent';
      if (activeFilterTab === 'leave') return item.status === 'Leave';
      if (activeFilterTab === 'unmarked') return item.status === 'Unmarked';
      if (activeFilterTab === 'low') return Boolean(sevenDaySummaryByTrainee[t.id]?.isLow);

      return true;
    });

    if (sortOption === 'name') {
      return [...filtered].sort((a, b) =>
        getDisplayName(a).localeCompare(getDisplayName(b), 'bn')
      );
    }

    if (sortOption === 'unmarked_first') {
      return [...filtered].sort((a, b) => {
        const aUnmarked = attendanceMap[a.id]?.status === 'Unmarked' ? 0 : 1;
        const bUnmarked = attendanceMap[b.id]?.status === 'Unmarked' ? 0 : 1;
        return aUnmarked - bUnmarked;
      });
    }

    return filtered;
  }, [
    allTraineesInBatch,
    attendanceMap,
    searchQuery,
    activeFilterTab,
    sortOption,
    sevenDaySummaryByTrainee,
  ]);

  // Month range for detail & heatmap sheets (days 1 to today/selected month end)
  const activeMonthPrefix = selectedDate.slice(0, 7);
  const maxDayInSheet = useMemo(() => {
    if (activeMonthPrefix === todayDateStr.slice(0, 7)) {
      return Math.max(1, parseInt(todayDateStr.split('-')[2] || '15', 10));
    }
    const [y, m] = activeMonthPrefix.split('-').map((n) => parseInt(n, 10));
    if (y && m) {
      return new Date(y, m, 0).getDate();
    }
    return 15;
  }, [activeMonthPrefix, todayDateStr]);

  const liveStatusByTraineeId = useMemo(() => {
    const out: Record<string, ExtendedAttendanceStatus> = {};
    Object.values(attendanceMap).forEach((item) => {
      out[item.id] = item.status;
    });
    return out;
  }, [attendanceMap]);

  const canGoPrevDate = selectedDate > minNavDateStr;
  const canGoNextDate = selectedDate < todayDateStr;
  const canUnlockOrEdit = canTakeAttendance || canEditAttendance;

  const currentInstitute = institutes.find((i) => i.id === selectedInstitute);
  const currentTrade = trades.find((t) => t.id === selectedTrade);
  void currentInstitute;
  void currentTrade;

  const progressDeg = Math.round((presentPercent / 100) * 360);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <div className="max-w-[560px] mx-auto px-3.5 py-4 space-y-3">
          <div className="h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          <div className="h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          <div className="h-36 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <div className="max-w-[560px] mx-auto pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] lg:pb-24">
        {/* ============================================================ */}
        {/* 1. STICKY HEADER                                             */}
        {/* ============================================================ */}
        <header className="sticky top-0 lg:top-16 z-20 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-3.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] lg:pt-2.5 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--green)] text-white dark:text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                <GraduationCap size={21} />
              </div>
              <div className="min-w-0">
                <TruncatedText
                  as="h1"
                  text="দৈনিক হাজিরা"
                  mode="pop"
                  className="text-[18px] font-medium text-[var(--text)] leading-tight"
                />
                <TruncatedText
                  as="p"
                  text="BNFE ট্রেইনিং · প্রশিক্ষক"
                  mode="pop"
                  className="text-[12px] text-[var(--muted)] leading-tight mt-0.5"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
                aria-label={resolvedMode === 'dark' ? 'লাইট থিম' : 'ডার্ক থিম'}
                className="w-10 h-10 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center cursor-pointer active:scale-95 transition"
              >
                {resolvedMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="আরও বিকল্প"
                  aria-expanded={menuOpen}
                  className="w-10 h-10 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center cursor-pointer active:scale-95 transition"
                >
                  <MoreVertical size={18} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl py-1.5 z-30">
                    <button
                      type="button"
                      disabled={isDayLocked || !canUnlockOrEdit}
                      onClick={() => handleBulkMenuAction('Present')}
                      className="w-full px-3.5 py-2.5 text-left text-[14.5px] text-[var(--text)] hover:bg-[var(--surface2)] flex items-center gap-2.5 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <CheckCheck size={16} className="text-[var(--green)] shrink-0" />
                      <span>সবাই উপস্থিত</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDayLocked || !canUnlockOrEdit}
                      onClick={() => handleBulkMenuAction('Absent')}
                      className="w-full px-3.5 py-2.5 text-left text-[14.5px] text-[var(--text)] hover:bg-[var(--surface2)] flex items-center gap-2.5 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <XCircle size={16} className="text-[var(--red)] shrink-0" />
                      <span>সবাই অনুপস্থিত</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDayLocked || !canUnlockOrEdit}
                      onClick={() => handleBulkMenuAction('Reset')}
                      className="w-full px-3.5 py-2.5 text-left text-[14.5px] text-[var(--text)] hover:bg-[var(--surface2)] flex items-center gap-2.5 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <RotateCcw size={16} className="text-[var(--amber)] shrink-0" />
                      <span>রিসেট</span>
                    </button>

                    <div className="my-1 border-t border-[var(--border)]" />

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setMonthlySheetOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-[14.5px] text-[var(--text)] hover:bg-[var(--surface2)] flex items-center gap-2.5 cursor-pointer"
                    >
                      <CalendarDays size={16} className="text-[var(--green)] shrink-0" />
                      <span>মাসিক শিট</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="px-3.5 pt-3 space-y-2.5">
          {/* Status feedback banner (inline, no undo bar or snackbar) */}
          {feedbackMsg && (
            <div
              className={`rounded-2xl border px-3.5 py-2.5 text-[13.5px] flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-[var(--green)]/10 border-[var(--green)]/35 text-[var(--green)]'
                  : 'bg-[var(--red)]/10 border-[var(--red)]/35 text-[var(--red)]'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span className="leading-snug">{feedbackMsg.text}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. DATE SWITCHER CARD                                        */}
          {/* ============================================================ */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5 flex items-center justify-between gap-2 shadow-2xs">
            <button
              type="button"
              disabled={!canGoPrevDate}
              onClick={() => handleStepDate(-1)}
              aria-label="আগের দিন"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                canGoPrevDate
                  ? 'text-[var(--text)] hover:bg-[var(--surface2)] cursor-pointer active:scale-95'
                  : 'text-[var(--muted)] opacity-30 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={20} />
            </button>

            <TruncatedText
              as="div"
              text={formatSwitcherDateLabel(selectedDate, isTodayDate)}
              mode="pop"
              className="text-center text-[15px] font-medium text-[var(--text)] tabular-nums min-w-0 flex-1 px-1"
            />

            <button
              type="button"
              disabled={!canGoNextDate}
              onClick={() => handleStepDate(1)}
              aria-label="পরের দিন"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                canGoNextDate
                  ? 'text-[var(--text)] hover:bg-[var(--surface2)] cursor-pointer active:scale-95'
                  : 'text-[var(--muted)] opacity-30 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* ============================================================ */}
          {/* 3. BATCH LINE                                                */}
          {/* ============================================================ */}
          <div className="px-1 flex items-center justify-between gap-2">
            <TruncatedText
              as="p"
              text={`ব্যাচ: ${currentBatch?.name || 'নির্বাচিত ব্যাচ নেই'}`}
              mode="pop"
              className="text-[14px] text-[var(--muted)] min-w-0 flex-1"
            >
              ব্যাচ:{' '}
              <span className="text-[var(--text)] font-medium">
                {currentBatch?.name || 'নির্বাচিত ব্যাচ নেই'}
              </span>
            </TruncatedText>
            {!isTrainer && batches.length > 1 && (
              <button
                type="button"
                onClick={() => setBatchPickerOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--green)] px-2 py-1 rounded-lg bg-[var(--green)]/10 border border-[var(--green)]/25 shrink-0 cursor-pointer active:scale-95"
              >
                <span>পরিবর্তন</span>
                <ChevronDown size={13} />
              </button>
            )}
          </div>

          {/* ============================================================ */}
          {/* 4. SUMMARY CARD                                              */}
          {/* ============================================================ */}
          <section className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-4">
              {/* Conic-gradient progress ring */}
              <div
                className="w-[74px] h-[74px] rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: `conic-gradient(var(--green) ${progressDeg}deg, var(--surface2) ${progressDeg}deg 360deg)`,
                }}
              >
                <div className="w-[56px] h-[56px] rounded-full bg-[var(--surface)] flex items-center justify-center border border-[var(--border)]/60">
                  <span className="text-[15.5px] font-medium text-[var(--text)] tabular-nums">
                    {toBn(presentPercent)}%
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-medium text-[var(--text)] leading-snug tabular-nums">
                  {toBn(presentCount)} জন উপস্থিত
                </h2>
                <p className="text-[13.5px] text-[var(--muted)] mt-0.5 tabular-nums">
                  মোট {toBn(totalCount)} জনের মধ্যে, বাকি {toBn(unmarkedCount)} জন
                </p>
              </div>
            </div>

            {/* 4-column legend */}
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-[var(--border)]/70">
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-[var(--green)]" />
                <div className="text-[15px] font-medium text-[var(--text)] tabular-nums leading-tight">
                  {toBn(presentCount)}
                </div>
                <div className="text-[11.5px] text-[var(--muted)] leading-none">উপস্থিত</div>
              </div>

              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-[var(--red)]" />
                <div className="text-[15px] font-medium text-[var(--text)] tabular-nums leading-tight">
                  {toBn(absentCount)}
                </div>
                <div className="text-[11.5px] text-[var(--muted)] leading-none">অনুপস্থিত</div>
              </div>

              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-[var(--amber)]" />
                <div className="text-[15px] font-medium text-[var(--text)] tabular-nums leading-tight">
                  {toBn(leaveCount)}
                </div>
                <div className="text-[11.5px] text-[var(--muted)] leading-none">ছুটি</div>
              </div>

              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-[var(--gray)]" />
                <div className="text-[15px] font-medium text-[var(--text)] tabular-nums leading-tight">
                  {toBn(unmarkedCount)}
                </div>
                <div className="text-[11.5px] text-[var(--muted)] leading-none">বাকি</div>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* 5. FILL REMAINING BUTTON                                     */}
          {/* ============================================================ */}
          {!isDayLocked && canUnlockOrEdit && unmarkedCount > 0 && (
            <button
              type="button"
              onClick={handleFillRemaining}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border border-dashed border-[var(--green)] bg-[var(--green)]/[0.06] hover:bg-[var(--green)]/[0.11] text-[var(--green)] text-[14.5px] font-medium flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
            >
              <UserCheck size={17} />
              <span className="tabular-nums">
                বাকি {toBn(unmarkedCount)} জনকে উপস্থিত করুন
              </span>
            </button>
          )}
        </div>

        {/* ============================================================ */}
        {/* 6. STICKY TOOLS (SEARCH + SORT + FILTER CHIPS)               */}
        {/* ============================================================ */}
        <div className="sticky top-[calc(62px+env(safe-area-inset-top,0px))] lg:top-[124px] z-10 bg-[var(--bg)]/95 backdrop-blur-md px-3.5 pt-2.5 pb-2 border-b border-[var(--border)]/60 space-y-2 mt-1">
          <div className="flex items-center gap-2">
            {/* Name-only search */}
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম দিয়ে খুঁজুন..."
                aria-label="নাম দিয়ে খুঁজুন"
                className="w-full h-[42px] pl-9 pr-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[14.5px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--green)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="অনুসন্ধান মুছুন"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort select */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as AttendanceSortOption)}
              aria-label="ক্রম নির্বাচন"
              className="h-[42px] px-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[13.5px] text-[var(--text)] focus:outline-none focus:border-[var(--green)] shrink-0 cursor-pointer"
            >
              <option value="default">ডিফল্ট</option>
              <option value="name">নাম</option>
              <option value="unmarked_first">বাকি আগে</option>
            </select>
          </div>

          {/* Horizontally scrollable filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                { key: 'all', label: 'সবাই', count: totalCount },
                { key: 'present', label: 'উপস্থিত', count: presentCount },
                { key: 'absent', label: 'অনুপস্থিত', count: absentCount },
                { key: 'leave', label: 'ছুটি', count: leaveCount },
                { key: 'unmarked', label: 'বাকি', count: unmarkedCount },
                { key: 'low', label: 'কম উপস্থিতি', count: lowAttendanceCount },
              ] as Array<{ key: AttendanceFilterTab; label: string; count: number }>
            ).map((chip) => {
              const active = activeFilterTab === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveFilterTab(chip.key)}
                  className={`h-8 px-3 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 border transition cursor-pointer active:scale-95 tabular-nums ${
                    active
                      ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
                      : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  {chip.label} ({toBn(chip.count)})
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3.5 pt-2.5 space-y-2.5">
          {/* ============================================================ */}
          {/* 7. LOCK BANNER                                               */}
          {/* ============================================================ */}
          {isDayLocked && (
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--amber)]/45 px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-[var(--text)] leading-snug">
                  🔒 হাজিরা সংরক্ষিত ও লক করা
                </div>
                {isBeforeBatchStart ? (
                  <div className="text-[12px] text-[var(--red)] mt-0.5 leading-snug">
                    ব্যাচ শুরুর ({formatBengaliDate(batchStartDateIso)}) আগের তারিখ
                  </div>
                ) : (
                  lastEditReason && (
                    <TruncatedText
                      as="div"
                      text={`সর্বশেষ সম্পাদনা: ${lastEditReason}`}
                      mode="sheet"
                      title="সর্বশেষ সম্পাদনার কারণ"
                      className="text-[12px] text-[var(--muted)] mt-0.5 leading-snug"
                    />
                  )
                )}
              </div>

              {!isBeforeBatchStart && canUnlockOrEdit && (
                <button
                  type="button"
                  onClick={() => setUnlockSheetOpen(true)}
                  className="min-h-[36px] px-3 rounded-xl bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/35 text-[13px] font-medium shrink-0 cursor-pointer active:scale-95 transition"
                >
                  সম্পাদনা
                </button>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 8. HINT LINE                                                 */}
          {/* ============================================================ */}
          <p className="text-[12px] text-[var(--muted)] text-center px-1 leading-snug">
            কার্ড ডানে সোয়াইপ = উপস্থিত · বামে = অনুপস্থিত · নামে ট্যাপ = বিস্তারিত
          </p>

          {/* ============================================================ */}
          {/* 9. STUDENT LIST                                              */}
          {/* ============================================================ */}
          {fetchingTrainees ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="h-[68px] rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
          ) : displayedTrainees.length === 0 ? (
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] py-10 px-4 text-center text-[var(--muted)] text-sm">
              {allTraineesInBatch.length === 0
                ? 'এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই।'
                : 'ফিল্টারের সাথে মিলে এমন কোনো শিক্ষার্থী পাওয়া যায়নি।'}
            </div>
          ) : (
            <div className="space-y-2">
              {displayedTrainees.map((trainee) => {
                const item = attendanceMap[trainee.id];
                if (!item) return null;
                const summary = sevenDaySummaryByTrainee[trainee.id] || {
                  dots: [],
                  presentCount: 0,
                  markedCount: 0,
                  ratePercent: null,
                  isLow: false,
                };

                return (
                  <StudentAttendanceCard
                    key={trainee.id}
                    item={item}
                    summary={summary}
                    isLocked={isDayLocked || isAnySaveBusy}
                    canInteract={canUnlockOrEdit}
                    onSelectStatus={handleSelectStatus}
                    onSwipeStatus={handleSwipeStatus}
                    onOpenDetail={setDetailTrainee}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 10. FLOATING SAVE BAR (UNSAVED CHANGES OR ACTIVE SAVE STATE) */}
      {/* ============================================================ */}
      {(hasUnsavedChanges || saveRunner.phase !== 'idle') && (
        <div className="fixed left-0 right-0 z-30 px-3 pointer-events-none bottom-[calc(4.6rem+env(safe-area-inset-bottom,0px))] lg:bottom-5">
          <div className="max-w-[560px] mx-auto pointer-events-auto rounded-2xl bg-[var(--surface)] border border-[var(--amber)]/55 shadow-xl px-3.5 py-2.5 flex items-center justify-between gap-2.5 overflow-visible">
            <div className="min-w-0">
              <TruncatedText
                as="div"
                text={
                  saveRunner.phase === 'success'
                    ? 'হাজিরা সফলভাবে সংরক্ষিত হয়েছে'
                    : `${toBn(dirtyItems.length)} জনের অসংরক্ষিত পরিবর্তন`
                }
                mode="pop"
                className="text-[14px] font-medium text-[var(--text)] tabular-nums"
              />
            </div>

            <div className="flex items-start gap-2 shrink-0">
              <button
                type="button"
                disabled={isAnySaveBusy}
                onClick={() => {
                  if (saveRunner.phase === 'success') {
                    saveRunner.reset();
                  } else {
                    saveRunner.reset();
                    handleDiscardChanges();
                  }
                }}
                className="min-h-[44px] px-3.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] text-[14px] font-medium cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {saveRunner.phase === 'success' ? 'বন্ধ করুন' : 'বাতিল'}
              </button>
              <ActionButton
                runner={saveRunner}
                idleLabel="সংরক্ষণ"
                popoverTitle="হাজিরা সংরক্ষণের ধাপ"
                onBeforeRun={validateAttendanceSave}
                onAutoHide={() => saveRunner.reset()}
                className="min-w-[140px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PENDING CHANGE CONFIRMATION MODAL (UNSAVED PROTECTION)       */}
      {/* ============================================================ */}
      {pendingChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[420px] rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-5 shadow-2xl space-y-4 overflow-visible">
            <div>
              <h3 className="text-[17px] font-medium text-[var(--text)]">
                অসংরক্ষিত পরিবর্তন রয়েছে
              </h3>
              <p className="text-[13.5px] text-[var(--muted)] mt-1 leading-relaxed">
                {toBn(dirtyItems.length)} জন শিক্ষার্থীর হাজিরা এখনো সংরক্ষণ করা হয়নি। এগিয়ে
                যাওয়ার আগে সংরক্ষণ করতে চান?
              </p>
            </div>

            <div className="space-y-2">
              <ActionButton
                runner={pendingSaveRunner}
                idleLabel="সংরক্ষণ করে এগিয়ে যান"
                popoverTitle="হাজিরা সংরক্ষণের ধাপ"
                onBeforeRun={validateAttendanceSave}
                onAutoHide={() => {
                  if (pendingChange) {
                    applySelectorChange(pendingChange.type, pendingChange.value);
                    pendingSaveRunner.reset();
                  }
                }}
                className="w-full"
              />

              <button
                type="button"
                disabled={isAnySaveBusy}
                onClick={() => {
                  pendingSaveRunner.reset();
                  if (pendingChange) {
                    applySelectorChange(pendingChange.type, pendingChange.value);
                  }
                }}
                className="w-full min-h-[44px] rounded-2xl bg-[var(--red)]/12 border border-[var(--red)]/35 text-[var(--red)] text-[14.5px] font-medium cursor-pointer active:scale-[0.99] disabled:opacity-50"
              >
                {pendingSaveRunner.phase === 'success' ? 'এখনই এগিয়ে যান' : 'বাতিল করে এগিয়ে যান'}
              </button>

              <button
                type="button"
                disabled={isAnySaveBusy}
                onClick={() => {
                  pendingSaveRunner.reset();
                  setPendingChange(null);
                }}
                className="w-full min-h-[44px] rounded-2xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] text-[14.5px] font-medium cursor-pointer disabled:opacity-50"
              >
                থাকুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* BOTTOM SHEETS                                                */}
      {/* ============================================================ */}
      <LeaveReasonSheet
        trainee={leaveTargetTrainee}
        currentReason={
          leaveTargetTrainee
            ? attendanceMap[leaveTargetTrainee.id]?.leaveReason
            : undefined
        }
        onSelectReason={handlePickLeaveReason}
        onClose={() => setLeaveTargetTrainee(null)}
      />

      <EditUnlockReasonSheet
        open={unlockSheetOpen}
        dateLabel={formatSwitcherDateLabel(selectedDate, isTodayDate)}
        onConfirmReason={handleConfirmUnlockReason}
        onClose={() => setUnlockSheetOpen(false)}
      />

      <StudentDetailSheet
        trainee={detailTrainee}
        monthPrefix={activeMonthPrefix}
        maxDayInMonth={maxDayInSheet}
        batchAttendanceRecords={allBatchAttendance}
        liveSelectedDate={selectedDate}
        liveStatusForSelectedDate={
          detailTrainee ? attendanceMap[detailTrainee.id]?.status : undefined
        }
        onClose={() => setDetailTrainee(null)}
      />

      <MonthlyHeatmapSheet
        open={monthlySheetOpen}
        batchName={currentBatch?.name || ''}
        monthPrefix={activeMonthPrefix}
        maxDayInMonth={maxDayInSheet}
        trainees={allTraineesInBatch}
        batchAttendanceRecords={allBatchAttendance}
        liveSelectedDate={selectedDate}
        liveStatusByTraineeId={liveStatusByTraineeId}
        onClose={() => setMonthlySheetOpen(false)}
      />

      <BatchPickerSheet
        open={batchPickerOpen}
        batches={batches}
        selectedBatchId={selectedBatch}
        onSelectBatch={(bid) => requestSelectorChange('batch', bid)}
        onClose={() => setBatchPickerOpen(false)}
      />
    </div>
  );
};

export default Attendance;
