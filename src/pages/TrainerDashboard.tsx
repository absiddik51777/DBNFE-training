import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  Layers, 
  CalendarCheck, 
  UserX, 
  Award, 
  AlertCircle, 
  Clock, 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Printer, 
  Download, 
  AlertTriangle, 
  Phone, 
  Search, 
  ExternalLink,
  Check,
  TrendingUp,
  Building2,
  Wrench,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Institute, 
  Trade, 
  Batch, 
  Trainee, 
  AttendanceRecord, 
  Exam, 
  ExamMark 
} from '../types';
import { BatchCalendarProgress, BatchSkillModule, BatchLiteracyModule } from '../types/calendar';
import { SHIKHON_92_DAYS, SHIKHON_COURSE_INFO } from '../data/shikhonCalendarData';
import { dataService } from '../lib/dataService';
import { safeFormatDate, toBn } from '../lib/dateUtils';
import { SHOW_CALENDAR_MODULES } from '../config/features';
import { DashboardHeroHeader } from '../components/DashboardHeroHeader';
import { downloadCSV, printCurrentDocument } from '../lib/exportUtils';

const TrainerDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const { isCourseDirector } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // Core collections
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);

  // Selected batch for Admin / Course Director preview
  const isTrainer = userProfile?.role === 'Trainer';
  const trainerBatchId = userProfile?.batchId;
  const [adminSelectedBatchId, setAdminSelectedBatchId] = useState<string>('');

  // Dropout Risk Table States
  const [dropoutSearch, setDropoutSearch] = useState('');
  const [dropoutRiskFilter, setDropoutRiskFilter] = useState<'all' | 'critical' | 'moderate' | 'warning' | 'dropped'>('all');
  const [dropoutPage, setDropoutPage] = useState(1);
  const [dropoutPageSize, setDropoutPageSize] = useState(5);

  // Shikhon Calendar progress state
  const [calendarProgress, setCalendarProgress] = useState<BatchCalendarProgress | null>(null);
  const [batchSkillModules, setBatchSkillModules] = useState<BatchSkillModule[]>([]);
  const [batchLiteracyModules, setBatchLiteracyModules] = useState<BatchLiteracyModule[]>([]);

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  // Load and listen to real-time data
  useEffect(() => {
    fetchDashboardData(true);

    const unsubAttendance = dataService.subscribeCollection<AttendanceRecord>('attendance', (records) => {
      setAttendance(records);
      setLastSyncTime(new Date());
    });

    const unsubTrainees = dataService.subscribeCollection<Trainee>('trainees', (traineesList) => {
      setTrainees(traineesList);
      setLastSyncTime(new Date());
    });

    const unsubBatches = dataService.subscribeCollection<Batch>('batches', (batchesList) => {
      setBatches(batchesList);
      setLastSyncTime(new Date());
    });

    const unsubMarks = dataService.subscribeCollection<ExamMark>('marks', (marksList) => {
      setMarks(marksList);
      setLastSyncTime(new Date());
    });

    return () => {
      unsubAttendance();
      unsubTrainees();
      unsubBatches();
      unsubMarks();
    };
  }, [userProfile?.id]);

  const fetchDashboardData = async (forceFresh: boolean = false) => {
    setLoading(true);
    try {
      const [
        institutesList,
        tradesList,
        batchesList,
        traineesList,
        attendanceList,
        examsList,
        marksList
      ] = await Promise.all([
        dataService.getItems<Institute>('institutes', forceFresh),
        dataService.getItems<Trade>('trades', forceFresh),
        dataService.getItems<Batch>('batches', forceFresh),
        dataService.getItems<Trainee>('trainees', forceFresh),
        dataService.getItems<AttendanceRecord>('attendance', forceFresh),
        dataService.getItems<Exam>('exams', forceFresh),
        dataService.getItems<ExamMark>('marks', forceFresh)
      ]);

      setInstitutes(institutesList);
      setTrades(tradesList);
      setBatches(batchesList);
      setTrainees(traineesList);
      setAttendance(attendanceList);
      setExams(examsList);
      setMarks(marksList);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Notice loading trainer dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncing(true);
    try {
      await fetchDashboardData(true);
      const now = new Date();
      setLastSyncTime(now);
      setSyncSuccessMsg(`তথ্য সফলভাবে আপডেট করা হয়েছে (${format(now, 'hh:mm:ss a')})`);
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err) {
      console.warn("Refresh error:", err);
    } finally {
      setRefreshing(false);
      setSyncing(false);
    }
  };

  // Determine active batch
  // For Trainers: strictly locked to userProfile.batchId
  // For Admins: previewing trainerBatch or adminSelectedBatchId
  const activeBatch = useMemo(() => {
    if (isTrainer) {
      if (trainerBatchId) {
        const found = batches.find(b => b.id === trainerBatchId);
        if (found) return found;
      }
      if (userProfile?.instituteId) {
        const found = batches.find(b => b.instituteId === userProfile.instituteId);
        if (found) return found;
      }
      return batches[0] || null;
    }
    // Admin mode
    if (adminSelectedBatchId) {
      const found = batches.find(b => b.id === adminSelectedBatchId);
      if (found) return found;
    }
    return batches[0] || null;
  }, [isTrainer, trainerBatchId, userProfile, batches, adminSelectedBatchId]);

  const activeBatchId = activeBatch?.id || '';

  // Auto-set admin initial selected batch
  useEffect(() => {
    if (!isTrainer && batches.length > 0 && !adminSelectedBatchId) {
      setAdminSelectedBatchId(batches[0].id);
    }
  }, [isTrainer, batches, adminSelectedBatchId]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setDropoutPage(1);
  }, [dropoutSearch, dropoutRiskFilter, dropoutPageSize]);

  // Load calendar progress and batch modules for active batch
  useEffect(() => {
    if (!activeBatchId) return;
    dataService.getBatchCalendarProgress(activeBatchId)
      .then(setCalendarProgress)
      .catch((err) => console.warn("Failed to load batch calendar progress in dashboard:", err));

    dataService.getBatchSkillModules(activeBatchId)
      .then(setBatchSkillModules)
      .catch(() => {});

    dataService.getBatchLiteracyModules(activeBatchId)
      .then(setBatchLiteracyModules)
      .catch(() => {});
  }, [activeBatchId]);

  const isSkillTrainer = isTrainer && (
    userProfile?.trainerType === 'Skill Trainer' ||
    (!userProfile?.trainerType && activeBatch?.skillTrainerId === userProfile?.id) ||
    (!userProfile?.trainerType && !activeBatch?.literacyTrainerId)
  );

  const isLiteracyTrainer = isTrainer && (
    userProfile?.trainerType === 'Literacy Trainer' ||
    (!userProfile?.trainerType && activeBatch?.literacyTrainerId === userProfile?.id)
  );

  const [markingDay, setMarkingDay] = useState<number | null>(null);

  // Active Calendar Day Plan based on Trainer stream
  const activeDayNumber = useMemo(() => {
    if (isSkillTrainer) {
      return calendarProgress?.currentSkillDay || calendarProgress?.currentDay || 1;
    }
    if (isLiteracyTrainer) {
      return calendarProgress?.currentLiteracyDay || calendarProgress?.currentDay || 1;
    }
    return calendarProgress?.currentDay || 1;
  }, [isSkillTrainer, isLiteracyTrainer, calendarProgress]);

  const activeTrade = useMemo(() => {
    return trades.find(t => t.id === activeBatch?.tradeId) || null;
  }, [trades, activeBatch]);

  const activeDayPlan = useMemo(() => {
    const isBeautyCareTrade = activeTrade?.name?.includes('বিউটি') || activeTrade?.name?.includes('Beauty');
    const defaultDay = SHIKHON_92_DAYS.find(d => d.dayNumber === activeDayNumber) || SHIKHON_92_DAYS[0];
    const customSkill = batchSkillModules.find(s => s.dayNumber === activeDayNumber);
    const customLiteracy = batchLiteracyModules.find(l => l.dayNumber === activeDayNumber);

    return {
      ...defaultDay,
      dayNumber: activeDayNumber,
      dayBn: toBn(activeDayNumber),
      skillModule: customSkill?.moduleName || (isBeautyCareTrade ? defaultDay.skillModule : `${activeTrade?.name || 'ট্রেড'} - স্কিল মডিউল`),
      skillTaskNo: customSkill?.taskNo || (isBeautyCareTrade ? defaultDay.skillTaskNo : `কাজ ${toBn(activeDayNumber)}`),
      skillTopic: customSkill?.topic || (isBeautyCareTrade ? defaultDay.skillTopic : 'স্কিল বিষয় নির্ধারিত হয়নি'),
      skillTheoryMinutes: customSkill ? customSkill.theoryMinutes : (defaultDay?.skillTheoryMinutes || 50),
      skillPracticalMinutes: customSkill ? customSkill.practicalMinutes : (defaultDay?.skillPracticalMinutes || 70),
      skillTotalMinutes: customSkill ? customSkill.totalMinutes : (defaultDay?.skillTotalMinutes || 120),
      literacyModule: customLiteracy?.moduleName || defaultDay.literacyModule,
      literacyTaskNo: customLiteracy?.taskNo || defaultDay.literacyTaskNo,
      literacyTopic: customLiteracy?.topic || defaultDay.literacyTopic,
      literacyStartTime: customLiteracy?.startTime || defaultDay.literacyStartTime,
      literacyEndTime: customLiteracy?.endTime || defaultDay.literacyEndTime,
      literacyTotalMinutes: customLiteracy?.totalMinutes || defaultDay.literacyTotalMinutes,
      phaseGroup: customSkill?.phaseGroup || customLiteracy?.category || (isBeautyCareTrade ? defaultDay.phaseGroup : 'সাধারণ'),
    };
  }, [activeDayNumber, batchSkillModules, batchLiteracyModules, activeTrade]);

  const completedDaysCount = useMemo(() => {
    if (isSkillTrainer) {
      return Object.values(calendarProgress?.skillProgress || {}).filter(s => s.isCompleted).length;
    }
    if (isLiteracyTrainer) {
      return Object.values(calendarProgress?.literacyProgress || {}).filter(s => s.isCompleted).length;
    }
    let both = 0;
    for (let i = 1; i <= 92; i++) {
      if (calendarProgress?.skillProgress?.[i]?.isCompleted && calendarProgress?.literacyProgress?.[i]?.isCompleted) {
        both++;
      }
    }
    return both || Object.values(calendarProgress?.completedDays || {}).filter(s => s.isCompleted).length;
  }, [isSkillTrainer, isLiteracyTrainer, calendarProgress]);

  const calendarPercent = Math.min(100, Math.round((completedDaysCount / SHIKHON_COURSE_INFO.totalDays) * 100));

  // Toggle Day Completion directly from Trainer Dashboard
  const handleToggleSkillCompletion = async (dayNumber: number, markAs: boolean) => {
    if (!activeBatchId) return;
    setMarkingDay(dayNumber);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const updated = await dataService.updateSkillDayCompletion(activeBatchId, dayNumber, {
        isCompleted: markAs,
        completedAt: markAs ? todayStr : undefined,
        trainerName: userProfile?.name,
        trainerId: userProfile?.id,
        trainerType: 'Skill Trainer'
      });
      setCalendarProgress(updated);
      setSyncSuccessMsg(markAs ? `ক্লাস #${toBn(dayNumber)} স্কিল মডিউল সম্পন্ন মার্ক করা হয়েছে।` : `ক্লাস #${toBn(dayNumber)} স্কিল মডিউল অসম্পূর্ণ করা হয়েছে।`);
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error toggling skill day completion:", err);
    } finally {
      setMarkingDay(null);
    }
  };

  const handleToggleLiteracyCompletion = async (dayNumber: number, markAs: boolean) => {
    if (!activeBatchId) return;
    setMarkingDay(dayNumber);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const updated = await dataService.updateLiteracyDayCompletion(activeBatchId, dayNumber, {
        isCompleted: markAs,
        completedAt: markAs ? todayStr : undefined,
        trainerName: userProfile?.name,
        trainerId: userProfile?.id,
        trainerType: 'Literacy Trainer'
      });
      setCalendarProgress(updated);
      setSyncSuccessMsg(markAs ? `ক্লাস #${toBn(dayNumber)} লিটারেসি মডিউল সম্পন্ন মার্ক করা হয়েছে।` : `ক্লাস #${toBn(dayNumber)} লিটারেসি মডিউল অসম্পূর্ণ করা হয়েছে।`);
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error toggling literacy day completion:", err);
    } finally {
      setMarkingDay(null);
    }
  };

  // Dedicated Trainer Metrics (Strictly scoped to this active batch)
  const trainerMetrics = useMemo(() => {
    if (!activeBatch) return null;

    const bTrainees = trainees.filter(t => t.batchId === activeBatch.id && !t.isArchived);
    const totalEnrolled = bTrainees.length;
    const activeCount = bTrainees.filter(t => !t.status || t.status === 'Active').length;
    const droppedCount = bTrainees.filter(t => t.status === 'Dropped Out').length;
    const femaleCount = bTrainees.filter(t => t.gender === 'Female').length;
    const maleCount = bTrainees.filter(t => t.gender === 'Male').length;

    const bAttendance = attendance.filter(a => a.batchId === activeBatch.id);
    const todayRecs = bAttendance.filter(a => a.date === todayIso);
    const isTodayRecorded = todayRecs.length > 0;
    const todayPresent = todayRecs.filter(a => a.status === 'Present').length;
    const todayAbsent = todayRecs.filter(a => a.status === 'Absent').length;
    const todayLeave = todayRecs.filter(a => a.status === 'Leave').length;
    const todayTotal = todayPresent + todayAbsent;
    const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

    // Current month attendance
    const now = new Date();
    const currentMonthPrefix = format(now, 'yyyy-MM');
    const monthRecs = bAttendance.filter(a => a.date && a.date.startsWith(currentMonthPrefix));
    const monthPresent = monthRecs.filter(a => a.status === 'Present').length;
    const monthAbsent = monthRecs.filter(a => a.status === 'Absent').length;
    const monthRecorded = monthPresent + monthAbsent;
    const monthRate = monthRecorded > 0 ? Math.round((monthPresent / monthRecorded) * 100) : 0;
    const monthDaysCount = new Set(monthRecs.map(a => a.date)).size;

    // Timeline
    const startDate = activeBatch.startDate || Date.now() - 30 * 86400000;
    const endDate = activeBatch.endDate || Date.now() + 150 * 86400000;
    const totalDays = Math.max(1, Math.round((endDate - startDate) / 86400000));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((Date.now() - startDate) / 86400000)));
    const timelinePercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    const instituteObj = institutes.find(i => i.id === activeBatch.instituteId);
    const tradeObj = trades.find(t => t.id === activeBatch.tradeId);
    const batchExams = exams.filter(e => e.batchId === activeBatch.id);

    return {
      batchId: activeBatch.id,
      batchName: activeBatch.name,
      capacity: activeBatch.maxTrainees || 30,
      instituteName: instituteObj?.name || 'প্রশিক্ষণ কেন্দ্র',
      tradeName: tradeObj?.name || 'বৃত্তিমূলক ট্রেড',
      totalEnrolled,
      activeCount,
      droppedCount,
      femaleCount,
      maleCount,
      isTodayRecorded,
      todayPresent,
      todayAbsent,
      todayLeave,
      todayRate,
      monthRate,
      monthDaysCount,
      totalDays,
      elapsedDays,
      timelinePercent,
      batchExamsCount: batchExams.length
    };
  }, [activeBatch, trainees, attendance, todayIso, institutes, trades, exams]);

  // Trainees at risk of dropout in this batch
  const batchDropoutRiskData = useMemo(() => {
    if (!activeBatchId) return [];

    const batchTrainees = trainees.filter(t => t.batchId === activeBatchId && !t.isArchived);
    const batchAttendance = attendance.filter(a => a.batchId === activeBatchId);

    const attendanceByTrainee: Record<string, { present: number; absent: number; leave: number; total: number }> = {};
    
    batchAttendance.forEach(rec => {
      if (!rec.traineeId) return;
      if (!attendanceByTrainee[rec.traineeId]) {
        attendanceByTrainee[rec.traineeId] = { present: 0, absent: 0, leave: 0, total: 0 };
      }
      attendanceByTrainee[rec.traineeId].total += 1;
      if (rec.status === 'Present') attendanceByTrainee[rec.traineeId].present += 1;
      else if (rec.status === 'Absent') attendanceByTrainee[rec.traineeId].absent += 1;
      else if (rec.status === 'Leave') attendanceByTrainee[rec.traineeId].leave += 1;
    });

    const riskList = batchTrainees
      .map(t => {
        const att = attendanceByTrainee[t.id] || { present: 0, absent: 0, leave: 0, total: 0 };
        const recordedCount = att.present + att.absent;
        const rate = recordedCount > 0 ? Math.round((att.present / recordedCount) * 100) : (t.status === 'Dropped Out' ? 0 : 100);

        const isDroppedOut = t.status === 'Dropped Out';
        const isLowAttendance = (recordedCount > 0 && rate < 75) || att.absent >= 3;
        const isRisk = isDroppedOut || isLowAttendance;

        let riskLevel: 'critical' | 'moderate' | 'warning' | 'dropped' = 'warning';
        if (isDroppedOut) {
          riskLevel = 'dropped';
        } else if (rate < 50 || att.absent >= 5) {
          riskLevel = 'critical';
        } else if (rate < 65 || att.absent >= 3) {
          riskLevel = 'moderate';
        } else if (rate < 75) {
          riskLevel = 'warning';
        }

        return {
          id: t.id,
          traineeId: t.traineeId,
          registrationNumber: t.registrationNumber || t.traineeId,
          nameBn: t.nameBn,
          nameEn: t.nameEn,
          gender: t.gender,
          mobileNumber: t.mobileNumber,
          fatherNameBn: t.fatherNameBn,
          photoUrl: t.photoUrl,
          status: t.status,
          totalRecorded: recordedCount,
          present: att.present,
          absent: att.absent,
          leave: att.leave,
          rate,
          riskLevel,
          isRisk
        };
      })
      .filter(t => t.isRisk);

    riskList.sort((a, b) => {
      const priorityOrder: Record<string, number> = { dropped: 1, critical: 2, moderate: 3, warning: 4 };
      const diff = (priorityOrder[a.riskLevel] || 9) - (priorityOrder[b.riskLevel] || 9);
      if (diff !== 0) return diff;
      return a.rate - b.rate;
    });

    return riskList;
  }, [activeBatchId, trainees, attendance]);

  // Risk counts
  const dropoutRiskCounts = useMemo(() => {
    let critical = 0;
    let moderate = 0;
    let warning = 0;
    let dropped = 0;
    batchDropoutRiskData.forEach(item => {
      if (item.riskLevel === 'critical') critical += 1;
      else if (item.riskLevel === 'moderate') moderate += 1;
      else if (item.riskLevel === 'warning') warning += 1;
      else if (item.riskLevel === 'dropped') dropped += 1;
    });
    return { critical, moderate, warning, dropped, total: batchDropoutRiskData.length };
  }, [batchDropoutRiskData]);

  // Filtered Dropout Risk List
  const filteredDropoutList = useMemo(() => {
    return batchDropoutRiskData.filter(item => {
      if (dropoutSearch.trim()) {
        const query = dropoutSearch.toLowerCase().trim();
        const matchNameBn = item.nameBn?.toLowerCase().includes(query);
        const matchNameEn = item.nameEn?.toLowerCase().includes(query);
        const matchReg = item.registrationNumber?.toLowerCase().includes(query);
        const matchPhone = item.mobileNumber?.toLowerCase().includes(query);
        const matchFather = item.fatherNameBn?.toLowerCase().includes(query);
        if (!matchNameBn && !matchNameEn && !matchReg && !matchPhone && !matchFather) {
          return false;
        }
      }

      if (dropoutRiskFilter !== 'all' && item.riskLevel !== dropoutRiskFilter) {
        return false;
      }

      return true;
    });
  }, [batchDropoutRiskData, dropoutSearch, dropoutRiskFilter]);

  // Pagination
  const totalDropoutPages = Math.max(1, Math.ceil(filteredDropoutList.length / dropoutPageSize));
  const currentDropoutPage = Math.min(dropoutPage, totalDropoutPages);
  const paginatedDropoutList = useMemo(() => {
    const startIndex = (currentDropoutPage - 1) * dropoutPageSize;
    return filteredDropoutList.slice(startIndex, startIndex + dropoutPageSize);
  }, [filteredDropoutList, currentDropoutPage, dropoutPageSize]);

  // Export CSV for batch dropout risk
  const exportDropoutRiskCSV = async () => {
    if (exportingCsv || filteredDropoutList.length === 0) return;
    setExportingCsv(true);
    try {
      const headers = [
        'ক্রমিক',
        'রেজিস্ট্রেশন নং',
        'নাম (বাংলা)',
        'নাম (ইংরেজি)',
        'মোবাইল নম্বর',
        'পিতা/অভিভাবক',
        'মোট ক্লাস',
        'উপস্থিতি',
        'অনুপস্থিতি',
        'ছুটি',
        'হাজিরার হার (%)',
        'ঝুঁকির স্তর',
        'স্ট্যাটাস'
      ];

      const rows = filteredDropoutList.map((t, idx) => [
        idx + 1,
        t.registrationNumber || '',
        t.nameBn || '',
        t.nameEn || '',
        t.mobileNumber || '',
        t.fatherNameBn || '',
        t.totalRecorded,
        t.present,
        t.absent,
        t.leave,
        `${t.rate}%`,
        t.riskLevel === 'dropped' ? 'ড্রপআউট' : t.riskLevel === 'critical' ? 'উচ্চ ঝুঁকি' : t.riskLevel === 'moderate' ? 'মাঝারি ঝুঁকি' : 'সতর্কতা',
        t.status
      ]);

      const res = await downloadCSV(
        `BNFE_Batch_${activeBatch?.name || 'Trainees'}_Dropout_Risk_${format(new Date(), 'yyyy-MM-dd')}`,
        headers,
        rows
      );
      setExportToast({ type: res.success ? 'success' : 'error', message: res.message });
      setTimeout(() => setExportToast(null), 5000);
    } finally {
      setExportingCsv(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] text-theme-text-secondary">
        <div className="w-12 h-12 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-theme-text-primary">প্রশিক্ষক ড্যাশবোর্ড তথ্য লোড হচ্ছে...</p>
        <span className="text-xs text-theme-text-muted mt-1">ব্যাচ ও উপস্থিতির ডাটা সিঙ্ক হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* ======================================================== */}
      {/* 1. ADMIN PREVIEW BAR (For Course Director / FMA)         */}
      {/* ======================================================== */}
      {!isTrainer && (
        <div className="bg-theme-info-soft border border-theme-info-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs print:hidden shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-theme-info text-theme-info-fg flex items-center justify-center font-bold shadow-2xs shrink-0">
              <UserCheck size={16} />
            </div>
            <div>
              <p className="font-bold text-theme-text-primary">প্রশিক্ষক ড্যাশবোর্ড (অ্যাডমিন প্রিভিউ মোড)</p>
              <p className="text-[11px] text-theme-info">আপনি যেকোনো নির্দিষ্ট ব্যাচের প্রশিক্ষক ড্যাশবোর্ড সরাসরি পর্যবেক্ষণ করছেন।</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <label className="text-theme-text-secondary font-semibold">ব্যাচ পরিবর্তন:</label>
            <select
              value={activeBatchId}
              onChange={(e) => setAdminSelectedBatchId(e.target.value)}
              className="px-3 py-1.5 bg-theme-elevated border border-theme-info-border rounded-xl text-xs font-bold text-theme-text-primary shadow-2xs focus:ring-2 focus:ring-theme-info/25 focus:outline-none"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <Link
              to="/"
              className="px-3 py-1.5 bg-theme-info hover:opacity-90 text-theme-info-fg rounded-xl font-bold transition shadow-2xs"
            >
              সার্বিক ড্যাশবোর্ডে ফিরুন
            </Link>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. DEDICATED HERO HEADER (MATCHING USER DESIGN)          */}
      {/* ======================================================== */}
      <DashboardHeroHeader
        userProfile={userProfile}
        lastSyncTime={lastSyncTime}
        onRefresh={handleRefresh}
        onPrint={() => printCurrentDocument({ jobName: 'BNFE_Trainer_Dashboard' })}
        isTrainerDashboard={true}
        refreshing={refreshing || syncing}
        syncSuccessMsg={syncSuccessMsg}
        batchInfoBadge={trainerMetrics ? `${trainerMetrics.batchName} • ${trainerMetrics.tradeName}` : undefined}
      />

      {trainerMetrics && (
        <div className="bg-theme-surface rounded-2xl p-4 border border-theme-border shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-theme-text-secondary">
            <span className="font-bold text-theme-text-primary">দায়িত্বপ্রাপ্ত প্রতিষ্ঠান:</span>
            <span className="text-theme-text-primary">{trainerMetrics.instituteName}</span>
            <span className="text-theme-text-muted">•</span>
            <span className="font-bold text-theme-text-primary">ট্রেড:</span>
            <span className="text-theme-text-primary">{trainerMetrics.tradeName}</span>
          </div>

          <div className="flex items-center space-x-2">
            {trainerMetrics.isTodayRecorded ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-theme-success-soft text-theme-success border border-theme-success-border">
                <CheckCircle2 size={13} />
                <span>আজকের হাজিরা সম্পন্ন</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-theme-warning-soft text-theme-warning border border-theme-warning-border">
                <AlertCircle size={13} />
                <span>আজকের হাজিরা বাকি</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. FOUR DEDICATED TRAINER BATCH KPI CARDS                */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Batch Enrolled Trainees */}
        <div className="bg-theme-surface p-4 sm:p-5 rounded-2xl border border-theme-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">ব্যাচের মোট শিক্ষার্থী</span>
              <div className="w-10 h-10 rounded-xl bg-theme-primary-soft text-theme-primary flex items-center justify-center shadow-2xs">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl font-black text-theme-text-primary tracking-tight tabular-nums">
                  {toBn(trainerMetrics?.totalEnrolled || 0)}
                </h3>
                <span className="text-xs font-semibold text-theme-text-secondary">জন ভর্তি</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-surface-subtle text-theme-text-secondary border border-theme-border ml-auto tabular-nums">
                  ধারণক্ষমতা: {toBn(trainerMetrics?.capacity || 30)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-theme-border text-[11px] flex items-center justify-between text-theme-text-secondary tabular-nums">
            <span>নারী: <strong className="text-theme-accent">{toBn(trainerMetrics?.femaleCount || 0)}</strong> জন</span>
            <span>•</span>
            <span>পুরুষ: <strong className="text-theme-info">{toBn(trainerMetrics?.maleCount || 0)}</strong> জন</span>
            <span>•</span>
            <span>সক্রিয়: <strong className="text-theme-success">{toBn(trainerMetrics?.activeCount || 0)}</strong> জন</span>
          </div>
        </div>

        {/* Card 2: Today's Attendance */}
        <div className="bg-theme-surface p-4 sm:p-5 rounded-2xl border border-theme-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">আজকের উপস্থিতি</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs ${
                trainerMetrics?.isTodayRecorded ? 'bg-theme-success-soft text-theme-success' : 'bg-theme-danger-soft text-theme-danger'
              }`}>
                <CalendarCheck size={20} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl font-black text-theme-text-primary tracking-tight tabular-nums">
                  {trainerMetrics?.isTodayRecorded ? `${toBn(trainerMetrics.todayRate)}%` : 'বাকি'}
                </h3>
                <span className="text-xs font-semibold text-theme-text-secondary">
                  {trainerMetrics?.isTodayRecorded ? 'উপস্থিতির হার' : 'হাজিরা নেওয়া হয়নি'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-theme-border text-[11px] flex items-center justify-between text-theme-text-secondary tabular-nums">
            <span>উপস্থিত: <strong className="text-theme-success">{toBn(trainerMetrics?.todayPresent || 0)}</strong></span>
            <span>•</span>
            <span>অনুপস্থিত: <strong className="text-theme-danger">{toBn(trainerMetrics?.todayAbsent || 0)}</strong></span>
            <span>•</span>
            <span>ছুটি: <strong className="text-theme-warning">{toBn(trainerMetrics?.todayLeave || 0)}</strong></span>
          </div>
        </div>

        {/* Card 3: Monthly Attendance Average */}
        <div className="bg-theme-surface p-4 sm:p-5 rounded-2xl border border-theme-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">চলতি মাসের গড় উপস্থিতি</span>
              <div className="w-10 h-10 rounded-xl bg-theme-info-soft text-theme-info flex items-center justify-center shadow-2xs">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl font-black text-theme-text-primary tracking-tight tabular-nums">
                  {toBn(trainerMetrics?.monthRate || 0)}%
                </h3>
                <span className="text-xs font-semibold text-theme-text-secondary">গড় হার</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-info-soft text-theme-info border border-theme-info-border ml-auto tabular-nums">
                  ক্লাস: {toBn(trainerMetrics?.monthDaysCount || 0)} দিন
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-theme-border text-[11px] text-theme-text-secondary tabular-nums">
            <span>নূন্যতম লক্ষ্যমাত্রা: </span>
            <strong className={trainerMetrics && trainerMetrics.monthRate >= 75 ? 'text-theme-success font-bold' : 'text-theme-warning font-bold'}>
              ৭৫% ({trainerMetrics && trainerMetrics.monthRate >= 75 ? 'অর্জিত' : 'ঘাটতি রয়েছে'})
            </strong>
          </div>
        </div>

        {/* Card 4: Dropout Risk Trainees */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex flex-col justify-between ${
          filteredDropoutList.length > 0
            ? 'bg-theme-danger-soft/50 border-theme-danger-border text-theme-text-primary'
            : 'bg-theme-surface border-theme-border'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">ঝরে পড়ার ঝুঁকিপূর্ণ শিক্ষার্থী</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs ${
                filteredDropoutList.length > 0 ? 'bg-theme-danger text-theme-danger-fg' : 'bg-theme-surface-subtle text-theme-text-secondary'
              }`}>
                <UserX size={20} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-2">
                <h3 className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                  filteredDropoutList.length > 0 ? 'text-theme-danger' : 'text-theme-text-primary'
                }`}>
                  {toBn(filteredDropoutList.length)}
                </h3>
                <span className="text-xs font-semibold text-theme-text-secondary">জন শিক্ষার্থী</span>
                {filteredDropoutList.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-danger-soft text-theme-danger border border-theme-danger-border ml-auto">
                    তাত্ক্ষণিক পদক্ষেপ
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-theme-border text-[11px] flex items-center justify-between text-theme-text-secondary tabular-nums">
            <span>উচ্চ ঝুঁকি: <strong className="text-theme-danger">{toBn(dropoutRiskCounts.critical)}</strong></span>
            <span>•</span>
            <span>মাঝারি: <strong className="text-theme-warning">{toBn(dropoutRiskCounts.moderate)}</strong></span>
            <span>•</span>
            <span>সতর্কতা: <strong className="text-theme-warning">{toBn(dropoutRiskCounts.warning)}</strong></span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. PRIMARY DASHBOARD: DROPOUT RISK MONITORING TABLE      */}
      {/* ======================================================== */}
      <div className="bg-theme-surface rounded-2xl border border-theme-danger-border ring-2 ring-theme-danger/10 shadow-xs overflow-hidden print:hidden space-y-0">
        {/* Header bar */}
        <div className="p-5 sm:p-6 border-b border-theme-danger-border bg-theme-danger-soft/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-theme-danger text-theme-danger-fg flex items-center justify-center font-bold shadow-xs shrink-0">
              <UserX size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-theme-text-primary tracking-tight">
                  ঝরে পড়ার ঝুঁকিপূর্ণ শিক্ষার্থী পর্যবেক্ষণ • প্রাইমারি ড্যাশবোর্ড
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-theme-danger text-theme-danger-fg shadow-2xs">
                  ব্যাচের প্রধান অগ্রাধিকার
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-theme-danger-soft text-theme-danger border border-theme-danger-border tabular-nums">
                  {toBn(filteredDropoutList.length)} জন
                </span>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                {activeBatch?.name || 'নির্ধারিত ব্যাচের'} যেসকল শিক্ষার্থীর উপস্থিতি ৭৫% এর নিচে অথবা ৩ দিনের বেশি অনুপস্থিত রয়েছে, তাদের তাৎক্ষণিক কাউন্সেলিং ও অভিভাবকের সাথে যোগাযোগ নিশ্চিত করুন।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={exportDropoutRiskCSV}
              disabled={filteredDropoutList.length === 0 || exportingCsv}
              className="px-3.5 py-2 bg-theme-elevated hover:bg-theme-surface-hover active:scale-95 text-theme-text-primary rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-theme-border shadow-2xs disabled:opacity-50 cursor-pointer"
              title="ঝুঁকিপূর্ণ শিক্ষার্থীদের তালিকা সিএসভি ফাইলে ডাউনলোড করুন"
            >
              <Download size={14} className="text-theme-danger" />
              <span>{exportingCsv ? 'সংরক্ষণ হচ্ছে...' : 'ঝুঁকি তালিকা এক্সপোর্ট'}</span>
            </button>
          </div>
          {exportToast && (
            <div className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-5 lg:bottom-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold ${
              exportToast.type === 'success' ? 'bg-theme-success text-theme-success-fg' : 'bg-theme-danger text-theme-danger-fg'
            }`}>
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{exportToast.message}</span>
            </div>
          )}
        </div>

        {/* Quick summary status tags */}
        <div className="px-5 py-3 bg-theme-surface-subtle border-b border-theme-border flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <span className="text-theme-text-secondary font-medium">ঝুঁকির স্তর:</span>
          <button
            onClick={() => setDropoutRiskFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer tabular-nums ${
              dropoutRiskFilter === 'all'
                ? 'bg-theme-text-primary text-theme-surface shadow-2xs'
                : 'bg-theme-surface text-theme-text-secondary border border-theme-border hover:bg-theme-surface-hover'
            }`}
          >
            সকল ({toBn(dropoutRiskCounts.total)})
          </button>
          <button
            onClick={() => setDropoutRiskFilter('critical')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer tabular-nums ${
              dropoutRiskFilter === 'critical'
                ? 'bg-theme-danger text-theme-danger-fg shadow-2xs'
                : 'bg-theme-danger-soft text-theme-danger border border-theme-danger-border hover:opacity-90'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span>উচ্চ ঝুঁকি &lt; ৫০% ({toBn(dropoutRiskCounts.critical)})</span>
          </button>
          <button
            onClick={() => setDropoutRiskFilter('moderate')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer tabular-nums ${
              dropoutRiskFilter === 'moderate'
                ? 'bg-theme-warning text-theme-warning-fg shadow-2xs'
                : 'bg-theme-warning-soft text-theme-warning border border-theme-warning-border hover:opacity-90'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span>মাঝারি ঝুঁকি ৫০-৬৪% ({toBn(dropoutRiskCounts.moderate)})</span>
          </button>
          <button
            onClick={() => setDropoutRiskFilter('warning')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer tabular-nums ${
              dropoutRiskFilter === 'warning'
                ? 'bg-theme-warning text-theme-warning-fg shadow-2xs'
                : 'bg-theme-warning-soft text-theme-warning border border-theme-warning-border hover:opacity-90'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span>সতর্কতা ৬৫-৭৪% ({toBn(dropoutRiskCounts.warning)})</span>
          </button>
          {dropoutRiskCounts.dropped > 0 && (
            <button
              onClick={() => setDropoutRiskFilter('dropped')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer tabular-nums ${
                dropoutRiskFilter === 'dropped'
                  ? 'bg-theme-text-secondary text-theme-surface shadow-2xs'
                  : 'bg-theme-surface-subtle text-theme-text-secondary border border-theme-border hover:bg-theme-surface-hover'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>ড্রপআউট ({toBn(dropoutRiskCounts.dropped)})</span>
            </button>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-theme-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-theme-surface">
          <div className="flex-1 relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input
              type="text"
              value={dropoutSearch}
              onChange={e => setDropoutSearch(e.target.value)}
              placeholder="শিক্ষার্থীর নাম, রেজিস্ট্রেশন নম্বর, মোবাইল বা অভিভাবক খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 bg-theme-surface-subtle border border-theme-border rounded-xl text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:bg-theme-elevated focus:outline-none focus:ring-2 focus:ring-theme-danger/20 focus:border-theme-danger"
            />
            {dropoutSearch && (
              <button
                onClick={() => setDropoutSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-theme-text-muted hover:text-theme-text-primary font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Rows per page */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-theme-text-secondary">প্রতি পৃষ্ঠায়:</span>
              <select
                value={dropoutPageSize}
                onChange={e => setDropoutPageSize(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-theme-surface-subtle border border-theme-border rounded-xl text-xs text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-danger"
              >
                <option value={5}>৫ জন</option>
                <option value={10}>১০ জন</option>
                <option value={15}>১৫ জন</option>
                <option value={20}>২০ জন</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {paginatedDropoutList.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 bg-theme-success-soft text-theme-success rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-bold text-theme-text-primary">
                {dropoutSearch || dropoutRiskFilter !== 'all'
                  ? 'কোনো ঝুঁকিপূর্ণ শিক্ষার্থী পাওয়া যায়নি'
                  : 'চমৎকার! বর্তমানে কোনো শিক্ষার্থী ঝরে পড়ার ঝুঁকিতে নেই'}
              </h3>
              <p className="text-xs text-theme-text-secondary mt-1 max-w-sm mx-auto">
                {dropoutSearch || dropoutRiskFilter !== 'all'
                  ? 'আপনার সার্চ ফিল্টারের সাথে মিলে এমন কোনো শিক্ষার্থী নেই।'
                  : 'এই ব্যাচের সকল প্রশিক্ষণার্থীর উপস্থিতি সন্তোষজনক ও নিয়মিত রয়েছে।'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-theme-surface-subtle border-b border-theme-border text-theme-text-secondary text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">প্রশিক্ষণার্থী</th>
                  <th className="py-3 px-4">অভিভাবক ও যোগাযোগ</th>
                  <th className="py-3 px-4 text-center">উপস্থিতি বিবরণ</th>
                  <th className="py-3 px-4">উপস্থিতির হার</th>
                  <th className="py-3 px-4 text-center">ঝুঁকির স্তর</th>
                  <th className="py-3 px-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {paginatedDropoutList.map((item, idx) => {
                  const globalIndex = (currentDropoutPage - 1) * dropoutPageSize + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-theme-surface-hover transition ${
                        item.riskLevel === 'dropped'
                          ? 'bg-theme-surface-subtle/50'
                          : item.riskLevel === 'critical'
                          ? 'bg-theme-danger-soft/25'
                          : ''
                      }`}
                    >
                      {/* # Index */}
                      <td className="py-3.5 px-4 text-center font-bold text-theme-text-muted tabular-nums">
                        {toBn(globalIndex)}
                      </td>

                      {/* Trainee Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.nameBn}
                              className="w-9 h-9 rounded-full object-cover border border-theme-border shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-theme-surface-subtle text-theme-text-secondary flex items-center justify-center font-bold text-xs shrink-0 border border-theme-border">
                              {item.nameBn ? item.nameBn.charAt(0) : 'শি'}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="font-bold text-theme-text-primary truncate">{item.nameBn || item.nameEn}</p>
                            <div className="flex items-center space-x-1 mt-0.5">
                              <span className="font-mono text-[10px] text-theme-text-muted bg-theme-surface-subtle px-1.5 py-0.2 rounded tabular-nums">
                                {item.registrationNumber}
                              </span>
                              <span className="text-[10px] text-theme-text-muted">•</span>
                              <span className="text-[10px] text-theme-text-secondary">
                                {item.gender === 'Female' ? 'নারী' : item.gender === 'Male' ? 'পুরুষ' : 'অন্যান্য'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Guardian */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {item.fatherNameBn && (
                            <p className="text-[11px] text-theme-text-secondary">
                              পিতা: <span className="font-medium text-theme-text-primary">{item.fatherNameBn}</span>
                            </p>
                          )}
                          {item.mobileNumber ? (
                            <div className="flex items-center space-x-1.5">
                              <a
                                href={`tel:${item.mobileNumber}`}
                                className="inline-flex items-center space-x-1 text-theme-primary hover:opacity-80 font-mono font-bold bg-theme-primary-soft px-2 py-0.5 rounded text-[11px] border border-theme-primary-border transition tabular-nums"
                                title="সরাসরি কল করুন"
                              >
                                <Phone size={11} />
                                <span>{item.mobileNumber}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-theme-text-muted text-[11px]">মোবাইল নেই</span>
                          )}
                        </div>
                      </td>

                      {/* Attendance Breakdown */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 text-center tabular-nums">
                          <span className="px-1.5 py-0.5 rounded bg-theme-success-soft text-theme-success font-bold text-[11px] border border-theme-success-border" title="উপস্থিত">
                            {toBn(item.present)} উ
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-theme-danger-soft text-theme-danger font-bold text-[11px] border border-theme-danger-border" title="অনুপস্থিত">
                            {toBn(item.absent)} অ
                          </span>
                          {item.leave > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-theme-warning-soft text-theme-warning font-bold text-[11px] border border-theme-warning-border" title="ছুটি">
                              {toBn(item.leave)} ছু
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-theme-text-muted mt-1 tabular-nums">মোট ক্লাস: {toBn(item.totalRecorded)} দিন</p>
                      </td>

                      {/* Attendance Rate */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                            <span className={item.rate < 50 ? 'text-theme-danger' : item.rate < 75 ? 'text-theme-warning' : 'text-theme-success'}>
                              {toBn(item.rate)}%
                            </span>
                            <span className="text-[10px] text-theme-text-muted">
                              (লক্ষ্যমাত্রা ৭৫%)
                            </span>
                          </div>
                          <div className="w-full bg-theme-surface-subtle h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.rate < 50 ? 'bg-theme-danger' : 'bg-theme-warning'
                              }`}
                              style={{ width: `${Math.min(100, item.rate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Risk Level Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {item.riskLevel === 'dropped' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-theme-surface-subtle text-theme-text-secondary border border-theme-border">
                            ড্রপআউট
                          </span>
                        ) : item.riskLevel === 'critical' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-theme-danger-soft text-theme-danger border border-theme-danger-border">
                            উচ্চ ঝুঁকি
                          </span>
                        ) : item.riskLevel === 'moderate' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-theme-warning-soft text-theme-warning border border-theme-warning-border">
                            মাঝারি ঝুঁকি
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-theme-warning-soft text-theme-warning border border-theme-warning-border">
                            সতর্কতা
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {item.mobileNumber && (
                            <a
                              href={`tel:${item.mobileNumber}`}
                              className="p-1.5 rounded-lg bg-theme-success-soft text-theme-success hover:opacity-80 border border-theme-success-border transition"
                              title="অভিভাবক/শিক্ষার্থীকে কল দিন"
                            >
                              <Phone size={13} />
                            </a>
                          )}
                          <Link
                            to="/trainees"
                            className="p-1.5 rounded-lg bg-theme-surface-subtle text-theme-text-secondary hover:bg-theme-surface-hover border border-theme-border transition flex items-center space-x-1 text-xs font-semibold"
                            title="প্রশিক্ষণার্থী বিস্তারিত দেখুন"
                          >
                            <ExternalLink size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {filteredDropoutList.length > 0 && (
          <div className="p-4 border-t border-theme-border bg-theme-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-theme-text-secondary tabular-nums">
            <div>
              <span>মোট </span>
              <strong className="text-theme-text-primary font-bold">{toBn(filteredDropoutList.length)}</strong>
              <span> জন শিক্ষার্থীর মধ্যে </span>
              <strong className="text-theme-text-primary font-bold">
                {toBn((currentDropoutPage - 1) * dropoutPageSize + 1)} - {toBn(Math.min(currentDropoutPage * dropoutPageSize, filteredDropoutList.length))}
              </strong>
              <span> দেখানো হচ্ছে (পৃষ্ঠা {toBn(currentDropoutPage)}/{toBn(totalDropoutPages)})</span>
            </div>

            {/* Page Buttons */}
            <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              <div className="flex items-center space-x-1 shrink-0 min-w-max">
                <button
                  onClick={() => setDropoutPage(p => Math.max(1, p - 1))}
                  disabled={currentDropoutPage === 1}
                  className="shrink-0 p-1.5 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="পূর্ববর্তী পৃষ্ঠা"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalDropoutPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || page === totalDropoutPages || Math.abs(page - currentDropoutPage) <= 1;
                  })
                  .map((page, idx, arr) => {
                    const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsisBefore && (
                          <span className="shrink-0 px-1 text-theme-text-muted">...</span>
                        )}
                        <button
                          onClick={() => setDropoutPage(page)}
                          className={`shrink-0 min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            currentDropoutPage === page
                              ? 'bg-theme-danger text-theme-danger-fg shadow-xs'
                              : 'bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-hover'
                          }`}
                        >
                          {toBn(page)}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setDropoutPage(p => Math.min(totalDropoutPages, p + 1))}
                  disabled={currentDropoutPage === totalDropoutPages}
                  className="shrink-0 p-1.5 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="পরবর্তী পৃষ্ঠা"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. OFFICIAL SHIKHON CALENDAR & ACTIVE LESSON PLAN       */}
      {/* ======================================================== */}
      {SHOW_CALENDAR_MODULES && (
        <div className="bg-theme-surface rounded-2xl border border-theme-primary-border ring-2 ring-theme-primary/10 shadow-xs overflow-hidden print:hidden">
        <div className="p-5 sm:p-6 border-b border-theme-primary-border bg-theme-primary-soft/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shadow-xs shrink-0 ${
              isLiteracyTrainer ? 'bg-theme-info text-theme-info-fg' : 'bg-theme-primary text-theme-primary-fg'
            }`}>
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-theme-text-primary tracking-tight">
                  {isSkillTrainer ? 'স্কিল কারিকুলাম পাঠ পরিকল্পনা ও অগ্রগতি (Skill Trainer)' :
                   isLiteracyTrainer ? 'লিটারেসি কারিকুলাম পাঠ পরিকল্পনা ও অগ্রগতি (Literacy Trainer)' :
                   'সরকারি শিখন ক্যালেন্ডার পাঠ পরিকল্পনা ও সার্বিক অগ্রগতি'}
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-2xs tabular-nums ${
                  isLiteracyTrainer ? 'bg-theme-info text-theme-info-fg' : 'bg-theme-primary text-theme-primary-fg'
                }`}>
                  ক্লাস #{toBn(activeDayNumber)} / ৯২
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-theme-primary-soft text-theme-primary border border-theme-primary-border tabular-nums">
                  {toBn(calendarPercent)}% সম্পন্ন
                </span>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                {isSkillTrainer
                  ? 'আপনার দায়িত্বপ্রাপ্ত ট্রেডের স্কিল মডিউল সম্পন্ন করে নিচে সরাসরি "সম্পন্ন মার্ক" করুন।'
                  : isLiteracyTrainer
                  ? 'আপনার দায়িত্বপ্রাপ্ত লিটারেসি ও জীবন-দক্ষতা মডিউল সম্পন্ন করে নিচে সরাসরি "সম্পন্ন মার্ক" করুন।'
                  : 'উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) কর্তৃক অনুমোদিত ৯২ কার্যদিবসের (৩৬৮ ঘণ্টা) শিখন ক্যালেন্ডার অনুযায়ী আজকের পাঠ।'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to="/shikhon-calendar"
              className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                isLiteracyTrainer ? 'bg-theme-info hover:opacity-90 text-theme-info-fg' : 'bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg'
              }`}
            >
              <BookOpen size={15} />
              <span>{isSkillTrainer ? 'স্কিল ক্যালেন্ডার' : isLiteracyTrainer ? 'লিটারেসি ক্যালেন্ডার' : 'সম্পূর্ণ ক্যালেন্ডার'}</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Lesson details grid */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Skill Activity */}
          {(!isLiteracyTrainer || !isTrainer) && (
            <div className={`${isSkillTrainer ? 'md:col-span-8 ring-2 ring-theme-primary/20' : 'md:col-span-5'} p-4 rounded-2xl bg-theme-primary-soft/35 border border-theme-primary-border space-y-3 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-theme-primary">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-theme-primary"></span>
                    স্কিল ফোকাসড শিখন কার্যক্রম ({activeDayPlan.skillTaskNo})
                  </span>
                  <span className="text-theme-text-secondary font-semibold tabular-nums">{toBn(activeDayPlan.skillTotalMinutes)} মিনিট</span>
                </div>
                <p className="text-sm font-bold text-theme-text-primary leading-snug mt-1.5">
                  {activeDayPlan.skillTopic}
                </p>
                <div className="text-[11px] text-theme-text-secondary pt-2 mt-2 border-t border-theme-primary-border flex items-center justify-between gap-2 flex-wrap tabular-nums">
                  <span>মডিউল: <strong className="text-theme-text-primary">{activeDayPlan.skillModule}</strong></span>
                  <span className="font-medium text-theme-primary">তাত্ত্বিক: {toBn(activeDayPlan.skillTheoryMinutes)}মি | ব্যবহারিক: {toBn(activeDayPlan.skillPracticalMinutes)}মি</span>
                </div>
              </div>

              {/* Skill Mark Action */}
              <div className="pt-2 border-t border-theme-primary-border flex items-center justify-between">
                {calendarProgress?.skillProgress?.[activeDayNumber]?.isCompleted ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-theme-success bg-theme-success-soft px-3 py-1 rounded-full border border-theme-success-border">
                      <Check size={13} strokeWidth={3} />
                      <span>আজকের স্কিল ক্লাস সম্পন্ন</span>
                    </span>
                    {(isSkillTrainer || isCourseDirector) && (
                      <button
                        onClick={() => handleToggleSkillCompletion(activeDayNumber, false)}
                        disabled={markingDay === activeDayNumber}
                        className="text-xs text-theme-danger hover:opacity-80 font-semibold cursor-pointer underline"
                      >
                        {markingDay === activeDayNumber ? 'প্রসেসিং...' : 'বাতিল'}
                      </button>
                    )}
                  </div>
                ) : (
                  (isSkillTrainer || isCourseDirector) ? (
                    <button
                      onClick={() => handleToggleSkillCompletion(activeDayNumber, true)}
                      disabled={markingDay === activeDayNumber}
                      className="w-full py-2.5 px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Check size={16} strokeWidth={3} />
                      <span>{markingDay === activeDayNumber ? 'সংরক্ষণ হচ্ছে...' : 'আজকের স্কিল ক্লাস সম্পন্ন মার্ক করুন'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-theme-text-secondary font-semibold">স্কিল ট্রেইনারের মার্কের অপেক্ষমাণ</span>
                  )
                )}
              </div>
            </div>
          )}

          {/* Literacy Activity */}
          {(!isSkillTrainer || !isTrainer) && (
            <div className={`${isLiteracyTrainer ? 'md:col-span-8 ring-2 ring-theme-info/20' : 'md:col-span-4'} p-4 rounded-2xl bg-theme-info-soft/40 border border-theme-info-border space-y-3 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-theme-info">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-theme-info"></span>
                    লিটারেসি ফোকাসড কার্যক্রম ({activeDayPlan.literacyTaskNo})
                  </span>
                  <span className="text-theme-text-secondary font-semibold tabular-nums">{toBn(activeDayPlan.literacyTotalMinutes)} মিনিট</span>
                </div>
                <p className="text-sm font-bold text-theme-text-primary leading-snug mt-1.5">
                  {activeDayPlan.literacyTopic}
                </p>
                <div className="text-[11px] text-theme-text-secondary pt-2 mt-2 border-t border-theme-info-border flex items-center justify-between gap-2 flex-wrap tabular-nums">
                  <span>মডিউল: <strong className="text-theme-text-primary">{activeDayPlan.literacyModule}</strong></span>
                  <span className="font-medium text-theme-info">{activeDayPlan.literacyStartTime} - {activeDayPlan.literacyEndTime}</span>
                </div>
              </div>

              {/* Literacy Mark Action */}
              <div className="pt-2 border-t border-theme-info-border flex items-center justify-between">
                {calendarProgress?.literacyProgress?.[activeDayNumber]?.isCompleted ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-theme-info bg-theme-info-soft px-3 py-1 rounded-full border border-theme-info-border">
                      <Check size={13} strokeWidth={3} />
                      <span>আজকের লিটারেসি ক্লাস সম্পন্ন</span>
                    </span>
                    {(isLiteracyTrainer || isCourseDirector) && (
                      <button
                        onClick={() => handleToggleLiteracyCompletion(activeDayNumber, false)}
                        disabled={markingDay === activeDayNumber}
                        className="text-xs text-theme-danger hover:opacity-80 font-semibold cursor-pointer underline"
                      >
                        {markingDay === activeDayNumber ? 'প্রসেসিং...' : 'বাতিল'}
                      </button>
                    )}
                  </div>
                ) : (
                  (isLiteracyTrainer || isCourseDirector) ? (
                    <button
                      onClick={() => handleToggleLiteracyCompletion(activeDayNumber, true)}
                      disabled={markingDay === activeDayNumber}
                      className="w-full py-2.5 px-4 rounded-xl bg-theme-info hover:opacity-90 text-theme-info-fg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Check size={16} strokeWidth={3} />
                      <span>{markingDay === activeDayNumber ? 'সংরক্ষণ হচ্ছে...' : 'আজকের লিটারেসি ক্লাস সম্পন্ন মার্ক করুন'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-theme-text-secondary font-semibold">লিটারেসি ট্রেইনারের মার্কের অপেক্ষমাণ</span>
                  )
                )}
              </div>
            </div>
          )}

          {/* Quick Action & Syllabus Stats */}
          <div className={`${isSkillTrainer || isLiteracyTrainer ? 'md:col-span-4' : 'md:col-span-3'} p-4 rounded-2xl bg-theme-surface-subtle border border-theme-border flex flex-col justify-between space-y-3`}>
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-theme-text-primary mb-1.5 tabular-nums">
                <span>সিলেবাস সম্পন্ন:</span>
                <span className="text-theme-primary font-extrabold">{toBn(completedDaysCount)} / {toBn(SHIKHON_COURSE_INFO.totalDays)} দিন</span>
              </div>
              <div className="w-full bg-theme-border h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-theme-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${calendarPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Link
                to={`/attendance?batchId=${activeBatchId}&date=${todayIso}`}
                className="w-full py-2 px-3 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                <CalendarCheck size={14} />
                <span>আজকের ক্লাসের হাজিরা নিন</span>
              </Link>
              <Link
                to="/shikhon-calendar"
                className="w-full py-2 px-3 rounded-xl bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary border border-theme-border text-xs font-semibold transition flex items-center justify-center space-x-1"
              >
                <span>ক্যালেন্ডার বিস্তারিত দেখুন</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ======================================================== */}
      {/* 6. SECONDARY SECTIONS: TODAY'S CHECKLIST & TIMELINE     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's Checklist & Action */}
        <div className="bg-theme-surface p-5 sm:p-6 rounded-2xl border border-theme-border shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2.5 pb-3 border-b border-theme-border">
              <div className="w-8 h-8 rounded-lg bg-theme-primary-soft text-theme-primary flex items-center justify-center font-bold">
                <CalendarCheck size={18} />
              </div>
              <div>
                <h3 className="font-bold text-theme-text-primary text-sm sm:text-base">দৈনিক হাজিরা ও একাডেমিক দায়িত্ব</h3>
                <p className="text-xs text-theme-text-secondary tabular-nums">আজকের তারিখ: {safeFormatDate(new Date(), 'dd MMMM yyyy')}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                trainerMetrics?.isTodayRecorded
                  ? 'bg-theme-success-soft/50 border-theme-success-border text-theme-text-primary'
                  : 'bg-theme-warning-soft/50 border-theme-warning-border text-theme-text-primary'
              }`}>
                <div className="flex items-center space-x-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    trainerMetrics?.isTodayRecorded ? 'bg-theme-success text-theme-success-fg' : 'bg-theme-warning text-theme-warning-fg'
                  }`}>
                    {trainerMetrics?.isTodayRecorded ? <Check size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold">
                      {trainerMetrics?.isTodayRecorded ? 'আজকের হাজিরা গ্রহণ সম্পন্ন হয়েছে' : 'আজকের হাজিরা এখনো গ্রহণ করা হয়নি'}
                    </p>
                    <p className="text-[11px] text-theme-text-secondary tabular-nums">
                      {trainerMetrics?.isTodayRecorded
                        ? `উপস্থিত: ${toBn(trainerMetrics.todayPresent)} জন, অনুপস্থিত: ${toBn(trainerMetrics.todayAbsent)} জন`
                        : 'ক্লাসের শুরুতে শিক্ষার্থীদের সঠিক উপস্থিতি এন্ট্রি নিশ্চিত করুন'}
                    </p>
                  </div>
                </div>
                <Link
                  to="/attendance"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-theme-primary-fg bg-theme-primary hover:bg-theme-primary-hover transition shrink-0"
                >
                  {trainerMetrics?.isTodayRecorded ? 'সম্পাদনা' : 'হাজিরা নিন'}
                </Link>
              </div>

              <div className="p-3 rounded-xl border border-theme-border bg-theme-surface-subtle flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-theme-info-soft text-theme-info flex items-center justify-center font-bold shrink-0">
                    <Award size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-theme-text-primary">পরীক্ষার নম্বর ও মূল্যায়ন</p>
                    <p className="text-[11px] text-theme-text-secondary tabular-nums">ব্যাচে মোট পরীক্ষা: {toBn(trainerMetrics?.batchExamsCount || 0)}টি</p>
                  </div>
                </div>
                <Link
                  to="/results"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-info bg-theme-info-soft hover:opacity-85 border border-theme-info-border transition shrink-0"
                >
                  নম্বর দিন
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-theme-border flex items-center justify-between text-xs text-theme-text-secondary">
            <span>লগইন রোল: <strong className="text-theme-text-primary font-semibold">{userProfile?.role}</strong></span>
            <span className="text-[11px] text-theme-primary font-semibold">শুধুমাত্র নির্ধারিত ব্যাচ অ্যাক্সেস সক্রিয়</span>
          </div>
        </div>

        {/* Batch Progress & Course Timeline */}
        <div className="bg-theme-surface p-5 sm:p-6 rounded-2xl border border-theme-border shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2.5 pb-3 border-b border-theme-border">
              <div className="w-8 h-8 rounded-lg bg-theme-info-soft text-theme-info flex items-center justify-center font-bold">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="font-bold text-theme-text-primary text-sm sm:text-base">কোর্স সময়রেখা ও অগ্রগতির স্তর</h3>
                <p className="text-xs text-theme-text-secondary">নির্ধারিত কোর্সের মেয়াদ ও অবশিষ্ট দিনসমূহ</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-theme-text-primary mb-1.5 tabular-nums">
                  <span>কোর্সের সময় অতিবাহিত:</span>
                  <span className="text-theme-info font-mono font-extrabold">{toBn(trainerMetrics?.timelinePercent || 0)}%</span>
                </div>
                <div className="w-full bg-theme-surface-subtle h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-theme-info h-full rounded-full transition-all duration-500"
                    style={{ width: `${trainerMetrics?.timelinePercent || 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div className="p-2.5 rounded-xl bg-theme-surface-subtle border border-theme-border">
                  <span className="text-theme-text-secondary block text-[10px]">শুরুর তারিখ</span>
                  <strong className="text-theme-text-primary font-bold tabular-nums">
                    {safeFormatDate(activeBatch?.startDate, 'dd MMM yyyy')}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-theme-surface-subtle border border-theme-border">
                  <span className="text-theme-text-secondary block text-[10px]">সমাপ্তির তারিখ</span>
                  <strong className="text-theme-text-primary font-bold tabular-nums">
                    {safeFormatDate(activeBatch?.endDate, 'dd MMM yyyy')}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-theme-primary-soft/50 border border-theme-primary-border text-xs text-theme-text-primary flex items-center justify-between tabular-nums">
                <span>মোট প্রশিক্ষণ দিন: <strong className="font-bold text-theme-primary">{toBn(trainerMetrics?.totalDays || 0)} দিন</strong></span>
                <span>অতিবাহিত: <strong className="font-bold text-theme-primary">{toBn(trainerMetrics?.elapsedDays || 0)} দিন</strong></span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-theme-border flex items-center justify-between text-xs text-theme-text-secondary">
            <Link to="/attendance-sheet" className="text-theme-primary hover:opacity-80 font-semibold flex items-center space-x-1">
              <span>মাসিক হাজিরা শিট দেখুন</span>
              <ChevronRight size={13} />
            </Link>
            <Link to="/certificates" className="text-theme-text-secondary hover:text-theme-text-primary font-semibold flex items-center space-x-1">
              <span>সনদপত্রের যোগ্যতা</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerDashboard;
