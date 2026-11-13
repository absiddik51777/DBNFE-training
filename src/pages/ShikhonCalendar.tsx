import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Clock, 
  BookOpen, 
  Layers, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  ExternalLink, 
  Sparkles, 
  ChevronRight, 
  CalendarCheck, 
  FileText, 
  Check, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Award,
  RefreshCw,
  Building2,
  Lock,
  Edit3,
  Plus,
  Trash2,
  Copy,
  FolderOpen,
  Wrench,
  GraduationCap,
  UserCheck,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { 
  SHIKHON_92_DAYS, 
  SHIKHON_COURSE_INFO, 
  SHIKHON_PHASES 
} from '../data/shikhonCalendarData';
import { 
  ShikhonDayPlan, 
  BatchCalendarProgress, 
  DayCompletionStatus,
  BatchSkillModule,
  BatchLiteracyModule,
  CalendarProgressLog
} from '../types/calendar';
import { Batch, Trade, Institute } from '../types';
import { dataService } from '../lib/dataService';
import { toBn } from '../lib/dateUtils';
import { format } from 'date-fns';
import ModuleBulkImportModal, { downloadDemoCSV } from '../components/ModuleBulkImportModal';
import ModuleInputModal from '../components/ModuleInputModal';
import { downloadCSV, printCurrentDocument } from '../lib/exportUtils';

const ShikhonCalendar: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();

  const isTrainer = userProfile?.role === 'Trainer';
  const trainerBatchId = userProfile?.batchId;
  const isDirectorOrFMA = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA' || !isTrainer;
  const canUpdateCalendar = hasPermission('update_shikhon_calendar') || userProfile?.role === 'Course Director' || isDirectorOrFMA;

  // Base Data State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedTradeId, setSelectedTradeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Tab State: 'integrated' | 'logs' | 'skill' | 'literacy'
  const [activeMainTab, setActiveMainTab] = useState<'integrated' | 'logs' | 'skill' | 'literacy'>('integrated');

  // Dedicated Calendar Progress Logs State (Requirement 3)
  const [progressLogs, setProgressLogs] = useState<CalendarProgressLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'skill' | 'literacy'>('all');
  const [logTrainerFilter, setLogTrainerFilter] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Batch Specific Modules
  const [skillModules, setSkillModules] = useState<BatchSkillModule[]>([]);
  const [literacyModules, setLiteracyModules] = useState<BatchLiteracyModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  // Calendar progress for the selected batch
  const [calendarProgress, setCalendarProgress] = useState<BatchCalendarProgress | null>(null);

  // Filters & Search
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'current'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals
  const [activeDayModal, setActiveDayModal] = useState<ShikhonDayPlan | null>(null);
  const [modalConductDate, setModalConductDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [modalRemarks, setModalRemarks] = useState<string>('');

  // Bulk Import Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalType, setBulkModalType] = useState<'skill' | 'literacy'>('skill');

  // Single Module Input Modal State
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [singleModalType, setSingleModalType] = useState<'skill' | 'literacy'>('skill');
  const [editingModule, setEditingModule] = useState<BatchSkillModule | BatchLiteracyModule | null>(null);

  // Delete Confirmation Modal State (replaces native window.confirm)
  const [deletingModule, setDeletingModule] = useState<{
    id: string;
    type: 'skill' | 'literacy';
    dayNumber: number;
    moduleName?: string;
    topic?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification Banner
  const [toastMsg, setToastMsg] = useState<string>('');

  // Initial Load
  useEffect(() => {
    loadBaseData();
  }, [userProfile]);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [batchesList, tradesList, institutesList] = await Promise.all([
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Institute>('institutes'),
      ]);

      setBatches(batchesList);
      setTrades(tradesList);
      setInstitutes(institutesList);

      let initialBatchId = '';
      if (isTrainer && trainerBatchId) {
        initialBatchId = trainerBatchId;
      } else if (batchesList.length > 0) {
        initialBatchId = batchesList[0].id;
      }
      setSelectedBatchId(initialBatchId);

      if (initialBatchId) {
        await Promise.all([
          loadBatchProgress(initialBatchId),
          loadBatchModules(initialBatchId),
          loadBatchLogs(initialBatchId)
        ]);
      }
    } catch (err) {
      console.error("Failed to load initial data for Shikhon Calendar:", err);
    } finally {
      setLoading(false);
    }
  };

  // Watch batch selection changes
  useEffect(() => {
    if (!selectedBatchId) return;
    loadBatchProgress(selectedBatchId);
    loadBatchModules(selectedBatchId);
    loadBatchLogs(selectedBatchId);
  }, [selectedBatchId]);

  const loadBatchProgress = async (batchId: string) => {
    try {
      const progress = await dataService.getBatchCalendarProgress(batchId);
      setCalendarProgress(progress);
    } catch (e) {
      console.warn("Failed to load batch calendar progress", e);
    }
  };

  const loadBatchModules = async (batchId: string) => {
    setModulesLoading(true);
    try {
      const [skills, literacy] = await Promise.all([
        dataService.getBatchSkillModules(batchId),
        dataService.getBatchLiteracyModules(batchId)
      ]);
      setSkillModules(skills);
      setLiteracyModules(literacy);
    } catch (err) {
      console.warn("Failed to load batch modules", err);
    } finally {
      setModulesLoading(false);
    }
  };

  const loadBatchLogs = async (batchId: string) => {
    if (!batchId) return;
    setLogsLoading(true);
    try {
      const logs = await dataService.getCalendarProgressLogs(batchId);
      setProgressLogs(logs);
    } catch (e) {
      console.warn("Failed to load calendar progress logs", e);
    } finally {
      setLogsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Selected batch info
  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId) || null;
  }, [batches, selectedBatchId]);

  const activeTradeId = useMemo(() => {
    return selectedBatch?.tradeId || selectedTradeId || trades[0]?.id || 'TRD-BC-01';
  }, [selectedBatch, selectedTradeId, trades]);

  const selectedTrade = useMemo(() => {
    return trades.find(t => t.id === activeTradeId) || trades[0] || null;
  }, [trades, activeTradeId]);

  const isSkillTrainer = isTrainer && (
    userProfile?.trainerType === 'Skill Trainer' ||
    (!userProfile?.trainerType && selectedBatch?.skillTrainerId === userProfile?.id) ||
    (!userProfile?.trainerType && !selectedBatch?.literacyTrainerId)
  );

  const isLiteracyTrainer = isTrainer && (
    userProfile?.trainerType === 'Literacy Trainer' ||
    (!userProfile?.trainerType && selectedBatch?.literacyTrainerId === userProfile?.id)
  );

  // Lock tab for trainers according to user requirements
  useEffect(() => {
    if (isSkillTrainer && activeMainTab !== 'skill') {
      setActiveMainTab('skill');
    } else if (isLiteracyTrainer && activeMainTab !== 'literacy') {
      setActiveMainTab('literacy');
    } else if (isDirectorOrFMA && !activeMainTab) {
      setActiveMainTab('integrated');
    }
  }, [isSkillTrainer, isLiteracyTrainer, isDirectorOrFMA]);

  const selectedInstitute = useMemo(() => {
    if (!selectedBatch) return null;
    return institutes.find(i => i.id === selectedBatch.instituteId) || null;
  }, [institutes, selectedBatch]);

  // Completion calculation for Skill & Literacy separately and combined
  const completedSkillCount = useMemo(() => {
    return Object.values(calendarProgress?.skillProgress || {}).filter(s => s.isCompleted).length;
  }, [calendarProgress]);

  const completedLiteracyCount = useMemo(() => {
    return Object.values(calendarProgress?.literacyProgress || {}).filter(s => s.isCompleted).length;
  }, [calendarProgress]);

  const completedBothCount = useMemo(() => {
    let both = 0;
    for (let i = 1; i <= 92; i++) {
      const s = calendarProgress?.skillProgress?.[i]?.isCompleted;
      const l = calendarProgress?.literacyProgress?.[i]?.isCompleted;
      if (s && l) both++;
    }
    return both;
  }, [calendarProgress]);

  const completedCount = useMemo(() => {
    if (isSkillTrainer) return completedSkillCount;
    if (isLiteracyTrainer) return completedLiteracyCount;
    return completedBothCount;
  }, [isSkillTrainer, isLiteracyTrainer, completedSkillCount, completedLiteracyCount, completedBothCount]);

  const progressPercent = Math.min(100, Math.round((completedCount / SHIKHON_COURSE_INFO.totalDays) * 100));

  const completedMinutes = useMemo(() => {
    return completedCount * SHIKHON_COURSE_INFO.dailyMinutes;
  }, [completedCount]);

  const completedHours = (completedMinutes / 60).toFixed(1);

  // Consolidated Daily List (merging batch's skill & literacy modules into day rows)
  const consolidatedDays: ShikhonDayPlan[] = useMemo(() => {
    const maxDay = Math.max(
      92,
      ...skillModules.map(s => s.dayNumber),
      ...literacyModules.map(l => l.dayNumber)
    );

    const list: ShikhonDayPlan[] = [];
    const isBeautyCareTrade = selectedTrade?.name?.includes('বিউটি') || selectedTrade?.name?.includes('Beauty');

    for (let dayNum = 1; dayNum <= maxDay; dayNum++) {
      const defaultDay = SHIKHON_92_DAYS[dayNum - 1];
      const customSkill = skillModules.find(s => s.dayNumber === dayNum);
      const customLiteracy = literacyModules.find(l => l.dayNumber === dayNum);

      const skillModule = customSkill?.moduleName || (isBeautyCareTrade ? defaultDay?.skillModule : `${selectedTrade?.name || 'ট্রেড'} - স্কিল মডিউল`) || 'স্কিল মডিউল';
      const skillTaskNo = customSkill?.taskNo || (isBeautyCareTrade ? defaultDay?.skillTaskNo : `কাজ ${toBn(dayNum)}`);
      const skillTopic = customSkill?.topic || (isBeautyCareTrade ? defaultDay?.skillTopic : 'স্কিল বিষয় নির্ধারিত হয়নি');
      const skillTheoryMinutes = customSkill ? customSkill.theoryMinutes : (defaultDay?.skillTheoryMinutes || 50);
      const skillPracticalMinutes = customSkill ? customSkill.practicalMinutes : (defaultDay?.skillPracticalMinutes || 70);
      const skillTotalMinutes = skillTheoryMinutes + skillPracticalMinutes;

      const literacyModule = customLiteracy?.moduleName || defaultDay?.literacyModule || 'সাধারণ লিটারেসি মডিউল';
      const literacyTaskNo = customLiteracy?.taskNo || defaultDay?.literacyTaskNo || `কাজ ${toBn(dayNum)}`;
      const literacyTopic = customLiteracy?.topic || defaultDay?.literacyTopic || 'লিটারেসি শিখন ফল নির্ধারিত নয়';
      const literacyStartTime = customLiteracy?.startTime || defaultDay?.literacyStartTime || '০৯:০০';
      const literacyEndTime = customLiteracy?.endTime || defaultDay?.literacyEndTime || '১১:০০';
      const literacyTotalMinutes = customLiteracy?.totalMinutes || defaultDay?.literacyTotalMinutes || 120;

      const phaseGroup = customSkill?.phaseGroup || customLiteracy?.category || (isBeautyCareTrade ? defaultDay?.phaseGroup : 'সাধারণ') || 'সাধারণ';
      const notes = customSkill?.toolsRequired || customSkill?.notes || (isBeautyCareTrade ? defaultDay?.notes : '') || '';

      list.push({
        dayNumber: dayNum,
        dayBn: toBn(dayNum),
        skillModule,
        skillTaskNo,
        skillTopic,
        skillTheoryMinutes,
        skillPracticalMinutes,
        skillTotalMinutes,
        literacyModule,
        literacyTaskNo,
        literacyTopic,
        literacyStartTime,
        literacyEndTime,
        literacyTotalMinutes,
        dailyTotalMinutes: skillTotalMinutes + literacyTotalMinutes,
        theoryMinutesTotal: skillTheoryMinutes,
        practicalMinutesTotal: skillPracticalMinutes,
        phaseGroup,
        notes
      });
    }
    return list;
  }, [skillModules, literacyModules]);

  // Filtered days list for integrated view
  const filteredDays = useMemo(() => {
    return consolidatedDays.filter(day => {
      if (selectedPhase !== 'all' && day.phaseGroup !== selectedPhase) {
        return false;
      }

      const isDone = calendarProgress?.completedDays?.[day.dayNumber]?.isCompleted;
      const isCurrent = calendarProgress?.currentDay === day.dayNumber;

      if (statusFilter === 'completed' && !isDone) return false;
      if (statusFilter === 'pending' && isDone) return false;
      if (statusFilter === 'current' && !isCurrent) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = day.dayNumber.toString().includes(q) || day.dayBn.includes(q);
        const matchSkillTopic = day.skillTopic.toLowerCase().includes(q);
        const matchLiteracyTopic = day.literacyTopic.toLowerCase().includes(q);
        const matchModule = day.skillModule.toLowerCase().includes(q) || day.literacyModule.toLowerCase().includes(q);
        const matchTask = day.skillTaskNo.toLowerCase().includes(q) || day.literacyTaskNo.toLowerCase().includes(q);
        if (!matchNumber && !matchSkillTopic && !matchLiteracyTopic && !matchModule && !matchTask) {
          return false;
        }
      }

      return true;
    });
  }, [consolidatedDays, selectedPhase, statusFilter, searchQuery, calendarProgress]);

  // Filtered Skill Modules for Skill Tab
  const filteredSkillModules = useMemo(() => {
    return skillModules.filter(m => {
      if (selectedPhase !== 'all' && m.phaseGroup !== selectedPhase) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = m.dayNumber.toString().includes(q) || toBn(m.dayNumber).includes(q);
        const matchTopic = m.topic.toLowerCase().includes(q);
        const matchModule = m.moduleName.toLowerCase().includes(q);
        const matchTask = m.taskNo.toLowerCase().includes(q);
        if (!matchNo && !matchTopic && !matchModule && !matchTask) return false;
      }
      return true;
    });
  }, [skillModules, selectedPhase, searchQuery]);

  // Filtered Literacy Modules for Literacy Tab
  const filteredLiteracyModules = useMemo(() => {
    return literacyModules.filter(m => {
      if (selectedPhase !== 'all' && m.category !== selectedPhase) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = m.dayNumber.toString().includes(q) || toBn(m.dayNumber).includes(q);
        const matchTopic = m.topic.toLowerCase().includes(q);
        const matchModule = m.moduleName.toLowerCase().includes(q);
        const matchTask = m.taskNo.toLowerCase().includes(q);
        if (!matchNo && !matchTopic && !matchModule && !matchTask) return false;
      }
      return true;
    });
  }, [literacyModules, selectedPhase, searchQuery]);

  // Filtered Progress Logs (Requirement 3: Dedicated Table)
  const filteredLogs = useMemo(() => {
    return progressLogs.filter(log => {
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase().trim();
        const matchTopic = log.topic?.toLowerCase().includes(q);
        const matchTrainer = log.trainerName?.toLowerCase().includes(q);
        const matchTask = log.taskNo?.toLowerCase().includes(q);
        const matchDay = log.dayNumber.toString().includes(q) || toBn(log.dayNumber).includes(q);
        const matchId = log.trainerId?.toLowerCase().includes(q);
        const matchDate = log.completedAt?.toLowerCase().includes(q);
        if (!matchTopic && !matchTrainer && !matchTask && !matchDay && !matchId && !matchDate) return false;
      }
      if (logTypeFilter !== 'all' && log.moduleType !== logTypeFilter) {
        return false;
      }
      if (logTrainerFilter !== 'all' && log.trainerName !== logTrainerFilter) {
        return false;
      }
      return true;
    });
  }, [progressLogs, logSearchQuery, logTypeFilter, logTrainerFilter]);

  const exportLogsCSV = async () => {
    if (exportingCsv || filteredLogs.length === 0) return;
    setExportingCsv(true);
    try {
      const headers = [
        'ক্রমিক',
        'তারিখ',
        'ক্লাস নং',
        'ধরন',
        'কাজ নং',
        'পঠিত বিষয়',
        'ট্রেইনারের নাম',
        'ট্রেইনারের ধরন',
        'ট্রেইনার আইডি',
        'অবস্থা',
        'মন্তব্য'
      ];
      const rows = filteredLogs.map((l, idx) => [
        idx + 1,
        l.completedAt,
        `ক্লাস ${l.dayNumber}`,
        l.moduleType === 'skill' ? 'স্কিল' : 'লিটারেসি',
        l.taskNo || '',
        l.topic || '',
        l.trainerName || '',
        l.trainerType || '',
        l.trainerId || '',
        l.isCompleted ? 'সম্পন্ন' : 'বাতিল',
        l.remarks || ''
      ]);

      const res = await downloadCSV(`batch_${selectedBatch?.name || 'calendar'}_progress_logs`, headers, rows);
      showToast(res.message);
    } finally {
      setExportingCsv(false);
    }
  };

  // Reset or Seed BNFE Defaults for current batch
  const handleResetToDefault = async () => {
    if (!selectedBatchId || !canUpdateCalendar) return;
    if (!confirm(`আপনি কি "${selectedBatch?.name}" ব্যাচের জন্য সরকারি আদর্শ ৯২ কার্যদিবসের BNFE মডিউলসমূহ লোড করতে চান? এটি ব্যাচের কারিকুলাম হালনাগাদ করবে।`)) return;

    setLoading(true);
    try {
      const res = await dataService.seedBatchWithDefaultModules(selectedBatchId);
      await loadBatchModules(selectedBatchId);
      showToast(`সফলভাবে ${toBn(res.skillCount)}টি স্কিল ও ${toBn(res.literacyCount)}টি লিটারেসি মডিউল লোড করা হয়েছে!`);
    } catch (e) {
      console.error("Reset error:", e);
      alert("মডিউল লোড ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Skill Day Completion (Marked by Skill Trainer or Director)
  const handleToggleSkillCompletion = async (dayNumber: number, markAs: boolean) => {
    if (!selectedBatchId) return;

    setSavingDay(dayNumber);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const updated = await dataService.updateSkillDayCompletion(selectedBatchId, dayNumber, {
        isCompleted: markAs,
        completedAt: markAs ? todayStr : undefined,
        trainerName: userProfile?.name,
        trainerId: userProfile?.id,
        trainerType: 'Skill Trainer'
      });
      setCalendarProgress(updated);
      await loadBatchLogs(selectedBatchId);
      showToast(markAs ? `ক্লাস #${toBn(dayNumber)} স্কিল মডিউল সম্পন্ন মার্ক করা হয়েছে।` : `ক্লাস #${toBn(dayNumber)} স্কিল মডিউল অসম্পূর্ণ করা হয়েছে।`);
    } catch (err) {
      console.error("Error toggling skill day status:", err);
    } finally {
      setSavingDay(null);
    }
  };

  // Toggle Literacy Day Completion (Marked by Literacy Trainer or Director)
  const handleToggleLiteracyCompletion = async (dayNumber: number, markAs: boolean) => {
    if (!selectedBatchId) return;

    setSavingDay(dayNumber);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const updated = await dataService.updateLiteracyDayCompletion(selectedBatchId, dayNumber, {
        isCompleted: markAs,
        completedAt: markAs ? todayStr : undefined,
        trainerName: userProfile?.name,
        trainerId: userProfile?.id,
        trainerType: 'Literacy Trainer'
      });
      setCalendarProgress(updated);
      await loadBatchLogs(selectedBatchId);
      showToast(markAs ? `ক্লাস #${toBn(dayNumber)} লিটারেসি মডিউল সম্পন্ন মার্ক করা হয়েছে।` : `ক্লাস #${toBn(dayNumber)} লিটারেসি মডিউল অসম্পূর্ণ করা হয়েছে।`);
    } catch (err) {
      console.error("Error toggling literacy day status:", err);
    } finally {
      setSavingDay(null);
    }
  };

  // Toggle Day Completion (Integrated legacy handler for Director)
  const handleToggleCompletion = async (day: ShikhonDayPlan, markAs: boolean) => {
    if (!selectedBatchId || !canUpdateCalendar) return;

    setSavingDay(day.dayNumber);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const updated = await dataService.updateDayCompletion(selectedBatchId, day.dayNumber, {
        isCompleted: markAs,
        completedAt: markAs ? todayStr : undefined,
        trainerName: userProfile?.name,
        trainerId: userProfile?.id,
      });
      setCalendarProgress(updated);
      showToast(markAs ? `ক্লাস #${day.dayBn} সম্পন্ন হিসেবে চিহ্নিত করা হয়েছে।` : `ক্লাস #${day.dayBn} অসম্পূর্ণ করা হয়েছে।`);
    } catch (err) {
      console.error("Error toggling day status:", err);
    } finally {
      setSavingDay(null);
    }
  };

  // Save Single Module (from ModuleInputModal)
  const handleSaveSingleModule = async (data: BatchSkillModule | BatchLiteracyModule) => {
    const tradeIdToUse = activeTradeId;
    if (singleModalType === 'skill') {
      await dataService.saveTradeSkillModule({ ...data, tradeId: tradeIdToUse } as any);
      if (selectedBatchId) await loadBatchModules(selectedBatchId);
      showToast(`স্কিল মডিউল (দিন #${toBn(data.dayNumber)}) সংরক্ষিত হয়েছে।`);
    } else {
      await dataService.saveTradeLiteracyModule({ ...data, tradeId: tradeIdToUse } as any);
      if (selectedBatchId) await loadBatchModules(selectedBatchId);
      showToast(`লিটারেসি মডিউল (দিন #${toBn(data.dayNumber)}) সংরক্ষিত হয়েছে।`);
    }
  };

  // Request Delete Single Module
  const handleRequestDeleteModule = (item: BatchSkillModule | BatchLiteracyModule, type: 'skill' | 'literacy') => {
    if (!canUpdateCalendar) return;
    setDeletingModule({
      id: item.id,
      type,
      dayNumber: item.dayNumber,
      moduleName: item.moduleName,
      topic: item.topic
    });
  };

  // Confirm Delete Single Module
  const handleConfirmDelete = async () => {
    if (!deletingModule || !canUpdateCalendar) return;
    setIsDeleting(true);
    try {
      if (deletingModule.type === 'skill') {
        await dataService.deleteTradeSkillModule(deletingModule.id, activeTradeId);
        if (selectedBatchId) await loadBatchModules(selectedBatchId);
        showToast(`ক্লাস #${toBn(deletingModule.dayNumber)} স্কিল মডিউলটি অপসারণ করা হয়েছে।`);
      } else {
        await dataService.deleteTradeLiteracyModule(deletingModule.id, activeTradeId);
        if (selectedBatchId) await loadBatchModules(selectedBatchId);
        showToast(`ক্লাস #${toBn(deletingModule.dayNumber)} লিটারেসি মডিউলটি অপসারণ করা হয়েছে।`);
      }
      setDeletingModule(null);
    } catch (e) {
      console.error("Delete module error:", e);
      showToast("মডিউল অপসারণ করতে সমস্যা হয়েছে।");
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Save Callback
  const handleBulkSave = async (items: any[], replaceExisting: boolean) => {
    const tradeIdToUse = activeTradeId;
    if (bulkModalType === 'skill') {
      const count = await dataService.bulkSaveTradeSkillModules(tradeIdToUse, items, replaceExisting);
      if (selectedBatchId) await loadBatchModules(selectedBatchId);
      return count;
    } else {
      const count = await dataService.bulkSaveTradeLiteracyModules(tradeIdToUse, items, replaceExisting);
      if (selectedBatchId) await loadBatchModules(selectedBatchId);
      return count;
    }
  };

  // Open Edit Modal for a day in Integrated view
  const handleOpenDayModal = (day: ShikhonDayPlan) => {
    const existing = calendarProgress?.completedDays?.[day.dayNumber];
    setModalConductDate(existing?.completedAt || format(new Date(), 'yyyy-MM-dd'));
    setModalRemarks(existing?.remarks || '');
    setActiveDayModal(day);
  };

  const handleSaveDayModal = async () => {
    if (!activeDayModal || !selectedBatchId) return;

    setSavingDay(activeDayModal.dayNumber);
    try {
      const updated = await dataService.updateDayCompletion(selectedBatchId, activeDayModal.dayNumber, {
        isCompleted: true,
        completedAt: modalConductDate,
        remarks: modalRemarks,
        trainerName: userProfile?.name,
        trainerId: userProfile?.id,
      });
      setCalendarProgress(updated);
      setActiveDayModal(null);
      showToast(`ক্লাস #${activeDayModal.dayBn} আপডেট ও সম্পন্ন হয়েছে।`);
    } catch (err) {
      console.error("Error updating day details:", err);
    } finally {
      setSavingDay(null);
    }
  };

  const handlePrint = () => {
    printCurrentDocument({ jobName: `BNFE_Shikhon_Calendar_${selectedBatch?.name || 'Batch'}` });
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-3">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-20 right-5 lg:bottom-5 z-50 bg-emerald-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold animate-in fade-in slide-in-from-bottom duration-200">
          <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner / Document Reference */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/10 relative overflow-hidden print:bg-white print:text-black print:p-2 print:shadow-none print:border-b-2 print:border-black">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none print:hidden">
          <BookOpen size={280} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center space-x-2 bg-emerald-900/60 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-semibold text-emerald-200 border border-emerald-500/30 print:hidden">
              <Sparkles size={14} className="text-yellow-400" />
              <span>{SHIKHON_COURSE_INFO.authorityBn}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug print:text-xl print:font-bold">
              {selectedTrade ? `${selectedTrade.name} - শিখন ক্যালেন্ডার` : SHIKHON_COURSE_INFO.courseTitleBn}
            </h1>
            
            <p className="text-emerald-100 text-sm leading-relaxed print:text-slate-700 print:text-xs">
              ট্রেড: <span className="font-semibold text-white print:text-black">{selectedTrade?.name || SHIKHON_COURSE_INFO.tradeNameBn}</span> • ব্যাচভিত্তিক স্বতন্ত্র স্কিল ও লিটারেসি মডিউল ব্যবস্থাপনা • মোট সময়: <span className="font-semibold text-white print:text-black">৯২ কার্যদিবস (৩৬৮ ঘণ্টা)</span>
            </p>
          </div>

          {/* Quick PDF & Template Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
            <a
              href={SHIKHON_COURSE_INFO.sourcePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white text-emerald-900 text-xs font-bold hover:bg-emerald-50 transition shadow-sm"
              title="মূল সরকারি পিডিএফ সার্কুলার দেখুন"
            >
              <Download size={14} className="text-emerald-700" />
              <span>মূল সার্কুলার (PDF)</span>
            </a>

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold transition border border-emerald-400/30 shadow-sm"
              title="সরকারি ফরম্যাটে প্রিন্ট করুন"
            >
              <Printer size={15} />
              <span>প্রিন্ট / রপ্তানি</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch & Trade Selector Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print:hidden">
        {/* Batch Selector Card */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-600" />
                  {isDirectorOrFMA ? 'প্রশিক্ষণ ব্যাচ নির্বাচন (Select Batch)' : 'প্রশিক্ষণ ব্যাচ ও কারিকুলাম'}
                </span>
                {!isTrainer && (
                  <span className="text-[11px] text-slate-400 font-medium">ব্যাচ নির্বাচন করুন</span>
                )}
              </div>

              {isTrainer ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1.5">
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedBatch?.name || 'ব্যাচ নির্ধারিত নেই'}
                  </p>
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <span>{selectedInstitute?.name || 'ইনস্টিটিউট তথ্য লোড হচ্ছে'}</span>
                  </div>
                  <div className="text-xs text-emerald-700 font-semibold flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <span className="flex items-center gap-1">
                      <Wrench size={12} className="shrink-0" />
                      <span>ট্রেড: {selectedTrade?.name || 'বৃত্তিমূলক ট্রেড'}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-emerald-500/30 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {trades.find(t => t.id === b.tradeId)?.name || 'ট্রেড'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Batch Trainer Details */}
            {selectedBatch && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                  <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">স্কিল ট্রেইনার</span>
                  <span className="font-bold text-slate-900 truncate block text-xs mt-0.5">
                    {selectedBatch.skillTrainerName || 'নির্ধারিত নেই'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/80">
                  <span className="block text-[10px] font-bold text-sky-800 uppercase tracking-wider">লিটারেসি ট্রেইনার</span>
                  <span className="font-bold text-slate-900 truncate block text-xs mt-0.5">
                    {selectedBatch.literacyTrainerName || 'নির্ধারিত নেই'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span>ট্রেড: <strong>{selectedTrade?.name}</strong></span>
              {isDirectorOrFMA && (
                <Link
                  to={`/trade-calendar?tradeId=${selectedBatch?.tradeId || ''}`}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline ml-1"
                >
                  (মাস্টার কারিকুলাম ↗)
                </Link>
              )}
            </span>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
              {toBn(skillModules.length)}টি স্কিল • {toBn(literacyModules.length)}টি লিটারেসি
            </span>
          </div>
        </div>

        {/* Progress & Statistics Card */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-600" />
              {isSkillTrainer ? 'স্কিল কারিকুলাম অগ্রগতি (Skill Progress)' :
               isLiteracyTrainer ? 'লিটারেসি কারিকুলাম অগ্রগতি (Literacy Progress)' :
               'সমন্বিত কোর্স অগ্রগতি (Integrated Progress)'}
            </span>
            <span className="text-sm font-extrabold text-emerald-700">{toBn(progressPercent)}% সম্পন্ন</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200/60 my-2">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 3 Metric Pills */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-500 font-medium">সম্পন্ন কার্যদিবস</span>
              <span className="text-base font-extrabold text-slate-800">
                {toBn(completedCount)} / {toBn(SHIKHON_COURSE_INFO.totalDays)}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-500 font-medium">সম্পন্ন সময়</span>
              <span className="text-base font-extrabold text-emerald-700">
                {toBn(completedHours)} ঘণ্টা
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-500 font-medium">অবশিষ্ট ক্লাস</span>
              <span className="text-base font-extrabold text-amber-700">
                {toBn(SHIKHON_COURSE_INFO.totalDays - completedCount)} দিন
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN NAVIGATION TABS & TRAINER HEADER BAR                                */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        {/* For Course Director & FMA: All 3 tabs */}
        {isDirectorOrFMA ? (
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            <button
              onClick={() => setActiveMainTab('integrated')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeMainTab === 'integrated'
                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calendar size={15} />
              <span>সমন্বিত ক্যালেন্ডার</span>
            </button>

            <button
              onClick={() => setActiveMainTab('logs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeMainTab === 'logs'
                  ? 'bg-purple-700 text-white shadow-md shadow-purple-700/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText size={15} />
              <span>অগ্রগতি অডিট লগ ({toBn(progressLogs.length)})</span>
            </button>

            <button
              onClick={() => setActiveMainTab('skill')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeMainTab === 'skill'
                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wrench size={15} />
              <span>স্কিল মডিউল ({toBn(skillModules.length)})</span>
            </button>

            <button
              onClick={() => setActiveMainTab('literacy')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeMainTab === 'literacy'
                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen size={15} />
              <span>লিটারেসি মডিউল ({toBn(literacyModules.length)})</span>
            </button>
          </div>
        ) : isSkillTrainer ? (
          /* For Skill Trainer: ONLY dedicated skill view header */
          <div className="flex items-center space-x-2">
            <div className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center space-x-2 shadow-xs">
              <Wrench size={15} />
              <span>আপনার শিখন ক্যালেন্ডার: স্কিল বেইজড কারিকুলাম • ট্রেড: {selectedTrade?.name || 'বৃত্তিমূলক ট্রেড'}</span>
            </div>
            <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl font-bold">
              স্কিল অগ্রগতি: {toBn(completedSkillCount)} / {toBn(skillModules.length || 92)} সম্পন্ন
            </span>
          </div>
        ) : (
          /* For Literacy Trainer: ONLY dedicated literacy view header */
          <div className="flex items-center space-x-2">
            <div className="px-4 py-2 rounded-xl bg-sky-700 text-white text-xs font-bold flex items-center space-x-2 shadow-xs">
              <BookOpen size={15} />
              <span>আপনার শিখন ক্যালেন্ডার: লিটারেসি বেইজড কারিকুলাম • সাক্ষরতা ও জীবন দক্ষতা</span>
            </div>
            <span className="text-xs text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1 rounded-xl font-bold">
              লিটারেসি অগ্রগতি: {toBn(completedLiteracyCount)} / {toBn(literacyModules.length || 92)} সম্পন্ন
            </span>
          </div>
        )}

        {/* Action: Link to Dedicated Trade Calendar Master Page (Director/FMA only) */}
        {isDirectorOrFMA && (
          <Link
            to={`/trade-calendar?tradeId=${selectedBatch?.tradeId || ''}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition shadow-2xs"
            title="ট্রেড ভিত্তিক মাস্টার কারিকুলাম পেইজে যান"
          >
            <GraduationCap size={15} className="text-emerald-700" />
            <span>ট্রেড কারিকুলাম মাস্টার পেইজ →</span>
          </Link>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INTEGRATED DAILY SHIKHON CALENDAR VIEW (FOR DIRECTOR & FMA ONLY)    */}
      {/* ========================================================================= */}
      {isDirectorOrFMA && activeMainTab === 'integrated' && (
        <div className="space-y-4">
          {/* Phase Filter Pills */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs print:hidden">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              {SHIKHON_PHASES.map((phase) => {
                const isSelected = selectedPhase === phase.id;
                return (
                  <button
                    key={phase.id}
                    onClick={() => setSelectedPhase(phase.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                    }`}
                  >
                    <span>{phase.nameBn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Status & View Mode */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="বিষয়, কাজ বা মডিউল খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-500 hidden md:inline">স্ট্যাটাস:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="all">সকল অবস্থা (All)</option>
                  <option value="completed">সম্পন্ন ক্লাস ({toBn(completedCount)})</option>
                  <option value="pending">বাকি ক্লাস ({toBn(SHIKHON_COURSE_INFO.totalDays - completedCount)})</option>
                  <option value="current">আজকের/চলমান ক্লাস</option>
                </select>
              </div>

              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    viewMode === 'table' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  টেবিল ভিউ
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    viewMode === 'cards' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  কার্ড ভিউ
                </button>
              </div>
            </div>
          </div>

          {/* Table / Cards View */}
          {viewMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:border-black print:rounded-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-800 print:bg-slate-200 print:text-black print:border-black">
                      <th className="py-3 px-3 w-14 text-center border-r border-slate-800 print:border-black">ক্লাস নং</th>
                      <th className="py-3 px-4 border-r border-slate-800 print:border-black min-w-[200px]">
                        স্কিল কার্যক্রম (ট্রেড ভিত্তিক)
                      </th>
                      <th className="py-3 px-3 w-36 text-center border-r border-slate-800 print:border-black">
                        স্কিল ট্রেইনারের স্থিতি
                      </th>
                      <th className="py-3 px-4 border-r border-slate-800 print:border-black min-w-[200px]">
                        লিটারেসি কার্যক্রম (জীবন দক্ষতা)
                      </th>
                      <th className="py-3 px-3 w-36 text-center border-r border-slate-800 print:border-black">
                        লিটারেসি ট্রেইনারের স্থিতি
                      </th>
                      <th className="py-3 px-3 w-32 text-center border-r border-slate-800 print:border-black">
                        সমন্বিত সার্বিক অবস্থা
                      </th>
                      <th className="py-3 px-2 w-20 text-center print:border-black">
                        একশন
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-normal text-slate-700 print:divide-black">
                    {filteredDays.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          কোনো ক্লাস বা পাঠ পরিকল্পনা পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
                        </td>
                      </tr>
                    ) : (
                      filteredDays.map((day) => {
                        const skillStatus = calendarProgress?.skillProgress?.[day.dayNumber] || calendarProgress?.completedDays?.[day.dayNumber];
                        const literacyStatus = calendarProgress?.literacyProgress?.[day.dayNumber];
                        const isSkillDone = !!skillStatus?.isCompleted;
                        const isLiteracyDone = !!literacyStatus?.isCompleted;
                        const isBothDone = isSkillDone && isLiteracyDone;
                        const isCurrent = calendarProgress?.currentDay === day.dayNumber;

                        return (
                          <tr 
                            key={day.dayNumber}
                            className={`transition-colors hover:bg-slate-50/80 print:hover:bg-transparent ${
                              isBothDone 
                                ? 'bg-emerald-50/40' 
                                : isSkillDone || isLiteracyDone
                                ? 'bg-amber-50/30'
                                : isCurrent 
                                ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-300' 
                                : ''
                            }`}
                          >
                            {/* Day Number */}
                            <td className="py-3 px-2 text-center font-bold border-r border-slate-200/60 print:border-black">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-extrabold ${
                                isBothDone 
                                  ? 'bg-emerald-600 text-white' 
                                  : isSkillDone || isLiteracyDone
                                  ? 'bg-amber-500 text-white'
                                  : isCurrent 
                                  ? 'bg-blue-600 text-white shadow-xs' 
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {day.dayBn}
                              </span>
                            </td>

                            {/* Skill Module details */}
                            <td className="py-3 px-4 border-r border-slate-200/60 print:border-black">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                    {day.skillTaskNo}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                                    {day.skillModule}
                                  </span>
                                </div>
                                <p className="font-semibold text-slate-900 text-xs leading-snug">
                                  {day.skillTopic}
                                </p>
                                <span className="text-[10px] text-slate-400 block">
                                  সময়: {toBn(day.skillTheoryMinutes)} তাত্ত্বিক + {toBn(day.skillPracticalMinutes)} ব্যবহারিক = {toBn(day.skillTotalMinutes)} মিনিট
                                </span>
                              </div>
                            </td>

                            {/* Skill Trainer Completion Status */}
                            <td className="py-3 px-3 text-center border-r border-slate-200/60 text-xs print:border-black">
                              {isSkillDone ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                                    <Check size={11} strokeWidth={3} />
                                    <span>স্কিল সম্পন্ন</span>
                                  </span>
                                  <div className="text-[10px] text-slate-600 font-semibold">
                                    তারিখ: {skillStatus.completedAt}
                                  </div>
                                  <div className="text-[10px] text-emerald-800 font-medium truncate max-w-[130px] mx-auto" title={skillStatus.trainerName || selectedBatch?.skillTrainerName}>
                                    প্রশিক্ষক: {skillStatus.trainerName || selectedBatch?.skillTrainerName || 'স্কিল ট্রেইনার'}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                  স্কিল বাকি
                                </span>
                              )}
                            </td>

                            {/* Literacy Module details */}
                            <td className="py-3 px-4 border-r border-slate-200/60 print:border-black">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="bg-sky-50 text-sky-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-sky-200">
                                    {day.literacyTaskNo}
                                  </span>
                                  <span className="text-[11px] text-sky-700 font-medium">
                                    {day.literacyModule}
                                  </span>
                                </div>
                                <p className="font-semibold text-slate-800 text-xs leading-snug">
                                  {day.literacyTopic}
                                </p>
                                <span className="text-[10px] text-slate-400 block">
                                  সময়: {day.literacyStartTime} - {day.literacyEndTime} ({toBn(day.literacyTotalMinutes)} মিনিট)
                                </span>
                              </div>
                            </td>

                            {/* Literacy Trainer Completion Status */}
                            <td className="py-3 px-3 text-center border-r border-slate-200/60 text-xs print:border-black">
                              {isLiteracyDone ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-full border border-sky-300">
                                    <Check size={11} strokeWidth={3} />
                                    <span>লিটারেসি সম্পন্ন</span>
                                  </span>
                                  <div className="text-[10px] text-slate-600 font-semibold">
                                    তারিখ: {literacyStatus.completedAt}
                                  </div>
                                  <div className="text-[10px] text-sky-800 font-medium truncate max-w-[130px] mx-auto" title={literacyStatus.trainerName || selectedBatch?.literacyTrainerName}>
                                    প্রশিক্ষক: {literacyStatus.trainerName || selectedBatch?.literacyTrainerName || 'লিটারেসি ট্রেইনার'}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                  লিটারেসি বাকি
                                </span>
                              )}
                            </td>

                            {/* Integrated Status */}
                            <td className="py-3 px-3 text-center border-r border-slate-200/60 print:border-black">
                              {isBothDone ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300 shadow-2xs">
                                  <CheckCircle2 size={13} className="text-emerald-700" />
                                  <span>উভয় সম্পন্ন</span>
                                </span>
                              ) : isSkillDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                  <span>স্কিল সম্পন্ন (লিটারেসি বাকি)</span>
                                </span>
                              ) : isLiteracyDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-300">
                                  <span>লিটারেসি সম্পন্ন (স্কিল বাকি)</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-slate-400">
                                  অসম্পূর্ণ
                                </span>
                              )}
                            </td>

                            {/* Action: Director inspection & remarks */}
                            <td className="py-3 px-2 text-center print:border-black">
                              <button
                                onClick={() => handleOpenDayModal(day)}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                title="উভয় ট্রেইনারের নোট ও বিস্তারিত দেখুন"
                              >
                                <Edit3 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 print:hidden">
              {filteredDays.map((day) => {
                const status = calendarProgress?.completedDays?.[day.dayNumber];
                const isDone = status?.isCompleted;
                const isCurrent = calendarProgress?.currentDay === day.dayNumber;

                return (
                  <div
                    key={day.dayNumber}
                    className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                      isDone
                        ? 'border-emerald-300 bg-emerald-50/10'
                        : isCurrent
                        ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                            isDone 
                              ? 'bg-emerald-600 text-white' 
                              : isCurrent 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {day.dayBn}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">কার্যদিবস #{day.dayBn}</span>
                            <span className="text-[11px] text-slate-400 block">{day.phaseGroup}</span>
                          </div>
                        </div>

                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 size={13} />
                            সম্পন্ন
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full animate-pulse">
                            বর্তমান ক্লাস
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">অসম্পূর্ণ</span>
                        )}
                      </div>

                      <div className="mb-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-emerald-800">স্কিল ফোকাসড</span>
                          <span className="text-slate-500 font-semibold">{toBn(day.skillTotalMinutes)} মিনিট</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 leading-snug">
                          {day.skillTopic}
                        </p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          মডিউল: {day.skillModule} ({day.skillTaskNo})
                        </span>
                      </div>

                      <div className="mb-3.5 p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-blue-800">লিটারেসি ফোকাসড</span>
                          <span className="text-slate-500 font-semibold">{toBn(day.literacyTotalMinutes)} মিনিট</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-snug">
                          {day.literacyTopic}
                        </p>
                        <span className="text-[10px] text-blue-600/80 mt-1 block">
                          মডিউল: {day.literacyModule} ({day.literacyTaskNo})
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 py-1">
                        <span>সর্বমোট দৈনিক সময়:</span>
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {toBn(day.dailyTotalMinutes)} মিনিট (৪ ঘণ্টা)
                        </span>
                      </div>

                      {status?.remarks && (
                        <div className="mt-2 text-[11px] text-slate-600 bg-amber-50 p-2 rounded-lg border border-amber-200/50">
                          <b>মন্তব্য:</b> {status.remarks}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {canUpdateCalendar && (
                        <button
                          onClick={() => handleOpenDayModal(day)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition"
                        >
                          নোট ও তারিখ
                        </button>
                      )}

                      {canUpdateCalendar ? (
                        isDone ? (
                          <button
                            onClick={() => handleToggleCompletion(day, false)}
                            disabled={savingDay === day.dayNumber}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition ml-auto"
                          >
                            বাতিল করুন
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleCompletion(day, true)}
                            disabled={savingDay === day.dayNumber}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition ml-auto flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <Check size={14} />
                            <span>সম্পন্ন মার্ক করুন</span>
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CALENDAR PROGRESS AUDIT LOGS (REQUIREMENT 3: DEDICATED TABLE)        */}
      {/* ========================================================================= */}
      {isDirectorOrFMA && activeMainTab === 'logs' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                <FileText size={14} className="text-purple-600" />
                <span>অগ্রগতি অডিট ও ট্র্যাকিং হিস্ট্রি • ব্যাচ: {selectedBatch?.name}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                শিখন ক্যালেন্ডার অগ্রগতি ও অডিট লগ
              </h2>
              <p className="text-xs text-slate-500">
                স্কিল ও লিটারেসি ট্রেইনারদের প্রতিটি মডিউল সম্পন্ন করার সম্পূর্ণ সময়ক্রম, ট্রেইনারের নাম, আইডি এবং মন্তব্যসহ সংরক্ষিত ডাটা।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => selectedBatchId && loadBatchLogs(selectedBatchId)}
                disabled={logsLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                title="লগ রিফ্রেশ করুন"
              >
                <RefreshCw size={14} className={logsLoading ? "animate-spin" : ""} />
                <span>রিফ্রেশ</span>
              </button>

              <button
                type="button"
                onClick={exportLogsCSV}
                disabled={filteredLogs.length === 0 || exportingCsv}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download size={14} />
                <span>{exportingCsv ? 'সংরক্ষণ হচ্ছে...' : 'অডিট লগ ডাউনলোড (.csv)'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট অগ্রগতি এন্ট্রি</span>
              <strong className="text-lg font-extrabold text-slate-900">{toBn(progressLogs.length)}টি</strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">স্কিল মডিউল মার্কিং</span>
              <strong className="text-lg font-extrabold text-emerald-700">
                {toBn(progressLogs.filter(l => l.moduleType === 'skill' && l.isCompleted).length)}টি
              </strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">লিটারেসি মার্কিং</span>
              <strong className="text-lg font-extrabold text-blue-700">
                {toBn(progressLogs.filter(l => l.moduleType === 'literacy' && l.isCompleted).length)}টি
              </strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">ফিল্টারকৃত ফলাফল</span>
              <strong className="text-lg font-extrabold text-purple-700">{toBn(filteredLogs.length)}টি</strong>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 mr-1">মডিউল ধরন:</span>
              <button
                onClick={() => setLogTypeFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  logTypeFilter === 'all'
                    ? 'bg-purple-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সকল ({toBn(progressLogs.length)})
              </button>
              <button
                onClick={() => setLogTypeFilter('skill')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  logTypeFilter === 'skill'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                স্কিল ({toBn(progressLogs.filter(l => l.moduleType === 'skill').length)})
              </button>
              <button
                onClick={() => setLogTypeFilter('literacy')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  logTypeFilter === 'literacy'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                লিটারেসি ({toBn(progressLogs.filter(l => l.moduleType === 'literacy').length)})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="ট্রেইনার, বিষয়, ক্লাস বা আইডি খুঁজুন..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Dedicated Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">তারিখ</th>
                    <th className="py-3 px-4">ক্লাস নং</th>
                    <th className="py-3 px-4">মডিউলের ধরন</th>
                    <th className="py-3 px-4">কাজ ও পঠিত বিষয়</th>
                    <th className="py-3 px-4">দায়িত্বপ্রাপ্ত ট্রেইনার</th>
                    <th className="py-3 px-4">ট্রেইনার আইডি</th>
                    <th className="py-3 px-4 text-center">অবস্থা</th>
                    <th className="py-3 px-4">মন্তব্য</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-purple-600" />
                        <span>অডিট লগ লোড হচ্ছে...</span>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">এই ব্যাচের জন্য এখনো কোনো অগ্রগতি অডিট লগ পাওয়া যায়নি।</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          স্কিল বা লিটারেসি ট্রেইনারগণ মডিউল সম্পন্ন মার্ক করলে স্বয়ংক্রিয়ভাবে এখানে লগ সংরক্ষিত হবে।
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-slate-400">
                          {toBn(idx + 1)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                          {log.completedAt || '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900">
                            ক্লাস #{toBn(log.dayNumber)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.moduleType === 'skill' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <Wrench size={12} className="text-emerald-700" />
                              স্কিল ফোকাসড
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                              <BookOpen size={12} className="text-blue-700" />
                              লিটারেসি ফোকাসড
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 leading-snug">{log.topic}</div>
                          {log.taskNo && (
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              কাজ নং: {log.taskNo}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <UserCheck size={13} className="text-purple-600 shrink-0" />
                            <span>{log.trainerName || 'অনির্ধারিত ট্রেইনার'}</span>
                          </div>
                          {log.trainerType && (
                            <span className="text-[10px] text-purple-700 font-medium block ml-4">
                              {log.trainerType}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.trainerId || '-'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {log.isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 size={12} />
                              সম্পন্ন
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                              <XCircle size={12} />
                              বাতিল
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.remarks}>
                          {log.remarks || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INDEPENDENT SKILL-FOCUSED MODULES MANAGEMENT                        */}
      {/* ========================================================================= */}
      {activeMainTab === 'skill' && (
        <div className="space-y-4">
          {/* Action Header for Skill Modules */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <Wrench size={14} className="text-emerald-600" />
                <span>স্বতন্ত্র স্কিল কারিকুলাম • ব্যাচ: {selectedBatch?.name}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                স্কিল ফোকাসড মডিউল তালিকা ও ব্যবস্থাপনা
              </h2>
              <p className="text-xs text-slate-500">
                এই ব্যাচের জন্য প্রয়োজনীয় সকল তাত্ত্বিক ও ব্যবহারিক স্কিল মডিউল একক বা বাল্কভাবে ইনপুট দিন।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await downloadDemoCSV('skill');
                  showToast(res.message);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-xs"
                title="বাল্ক ইনপুটের নমুনা ডেমো ফাইল"
              >
                <Download size={14} className="text-amber-700" />
                <span>ডেমো ফাইল (.csv)</span>
              </button>

              {canUpdateCalendar && (
                <>
                  <button
                    onClick={() => {
                      setBulkModalType('skill');
                      setIsBulkModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <FolderOpen size={14} />
                    <span>বাল্ক ইনপুট (CSV)</span>
                  </button>

                  <button
                    onClick={() => {
                      setSingleModalType('skill');
                      setEditingModule(null);
                      setIsSingleModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Plus size={15} />
                    <span>+ নতুন স্কিল মডিউল</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats Bar for Skill Modules */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট স্কিল মডিউল</span>
              <strong className="text-lg font-extrabold text-slate-900">{toBn(skillModules.length)}টি</strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট তাত্ত্বিক সময়</span>
              <strong className="text-lg font-extrabold text-blue-700">
                {toBn(skillModules.reduce((acc, m) => acc + (m.theoryMinutes || 0), 0))} মি.
              </strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট ব্যবহারিক সময়</span>
              <strong className="text-lg font-extrabold text-emerald-700">
                {toBn(skillModules.reduce((acc, m) => acc + (m.practicalMinutes || 0), 0))} মি.
              </strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট স্কিল ঘণ্টা</span>
              <strong className="text-lg font-extrabold text-purple-700">
                {toBn((skillModules.reduce((acc, m) => acc + (m.totalMinutes || 0), 0) / 60).toFixed(1))} ঘণ্টা
              </strong>
            </div>
          </div>

          {/* Skill Modules Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <th className="py-3 px-3 w-16 text-center">দিন #</th>
                    <th className="py-3 px-3 w-24 text-center">কাজ নং</th>
                    <th className="py-3 px-4">মডিউলের নাম ও বিভাগ</th>
                    <th className="py-3 px-4">পঠিত বিষয় / শিখন ফল (Topic)</th>
                    <th className="py-3 px-3 text-center">তাত্ত্বিক</th>
                    <th className="py-3 px-3 text-center">ব্যবহারিক</th>
                    <th className="py-3 px-3 text-center">মোট সময়</th>
                    <th className="py-3 px-3 text-center min-w-[140px]">স্থিতি ও ট্রেইনার মার্ক</th>
                    <th className="py-3 px-3 w-24 text-center">একশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSkillModules.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        এই ব্যাচের জন্য কোনো স্কিল মডিউল যোগ করা হয়নি। "বাল্ক ইনপুট" অথবা "+ নতুন স্কিল মডিউল" বাটনে ক্লিক করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredSkillModules.map((item) => {
                      const skillStatus = calendarProgress?.skillProgress?.[item.dayNumber] || calendarProgress?.completedDays?.[item.dayNumber];
                      const isDone = !!skillStatus?.isCompleted;
                      const canMarkSkill = isSkillTrainer || isDirectorOrFMA;

                      return (
                        <tr key={item.id} className={`transition ${isDone ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">
                            {toBn(item.dayNumber)}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-emerald-800 bg-emerald-50/50">
                            {item.taskNo}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{item.moduleName}</span>
                            <span className="text-[10px] text-slate-500">{item.phaseGroup || 'টুলস ও বিউটি কেয়ার'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800">{item.topic}</p>
                            {item.toolsRequired && (
                              <span className="text-[10px] text-emerald-700 block mt-0.5">
                                উপকরণ: {item.toolsRequired}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-medium">{toBn(item.theoryMinutes)} মি.</td>
                          <td className="py-3 px-3 text-center font-medium text-emerald-700">{toBn(item.practicalMinutes)} মি.</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">{toBn(item.totalMinutes)} মি.</td>
                          
                          {/* Completion status & Trainer Mark */}
                          <td className="py-3 px-3 text-center text-xs">
                            {isDone ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  <Check size={11} strokeWidth={3} />
                                  <span>স্কিল সম্পন্ন</span>
                                </span>
                                <div className="text-[10px] text-slate-500 font-semibold">
                                  তারিখ: {skillStatus.completedAt || '-'}
                                </div>
                                <div className="text-[10px] text-emerald-800 font-medium truncate max-w-[130px] mx-auto" title={skillStatus.trainerName || selectedBatch?.skillTrainerName}>
                                  প্রশিক্ষক: {skillStatus.trainerName || selectedBatch?.skillTrainerName || 'স্কিল ট্রেইনার'}
                                </div>
                                {canMarkSkill && (
                                  <button
                                    onClick={() => handleToggleSkillCompletion(item.dayNumber, false)}
                                    disabled={savingDay === item.dayNumber}
                                    className="text-[10px] text-red-600 hover:text-red-700 underline font-semibold transition mt-0.5 block mx-auto cursor-pointer"
                                  >
                                    {savingDay === item.dayNumber ? 'প্রসেসিং...' : 'বাতিল করুন'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              canMarkSkill ? (
                                <button
                                  onClick={() => handleToggleSkillCompletion(item.dayNumber, true)}
                                  disabled={savingDay === item.dayNumber}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                                >
                                  <Check size={13} strokeWidth={3} />
                                  <span>{savingDay === item.dayNumber ? 'সংরক্ষণ হচ্ছে...' : 'সম্পন্ন মার্ক'}</span>
                                </button>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                  বাকি আছে
                                </span>
                              )
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {canUpdateCalendar ? (
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => {
                                    setSingleModalType('skill');
                                    setEditingModule(item);
                                    setIsSingleModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                  title="সম্পাদনা করুন"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleRequestDeleteModule(item, 'skill')}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">লকড</span>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INDEPENDENT LITERACY-FOCUSED MODULES MANAGEMENT                     */}
      {/* ========================================================================= */}
      {activeMainTab === 'literacy' && (
        <div className="space-y-4">
          {/* Action Header for Literacy Modules */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                <BookOpen size={14} className="text-blue-600" />
                <span>স্বতন্ত্র লিটারেসি কারিকুলাম • ব্যাচ: {selectedBatch?.name}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                লিটারেসি ফোকাসড মডিউল তালিকা ও ব্যবস্থাপনা
              </h2>
              <p className="text-xs text-slate-500">
                বাংলা, ইংরেজি, গাণিতিক ধারণা, জীবন-দক্ষতা ও ডিজিটাল স্বাক্ষরতার স্বতন্ত্র পাঠ পরিকল্পনা।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await downloadDemoCSV('literacy');
                  showToast(res.message);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-xs"
                title="বাল্ক ইনপুটের নমুনা ডেমো ফাইল"
              >
                <Download size={14} className="text-amber-700" />
                <span>ডেমো ফাইল (.csv)</span>
              </button>

              {canUpdateCalendar && (
                <>
                  <button
                    onClick={() => {
                      setBulkModalType('literacy');
                      setIsBulkModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <FolderOpen size={14} />
                    <span>বাল্ক ইনপুট (CSV)</span>
                  </button>

                  <button
                    onClick={() => {
                      setSingleModalType('literacy');
                      setEditingModule(null);
                      setIsSingleModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Plus size={15} />
                    <span>+ নতুন লিটারেসি মডিউল</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats Bar for Literacy Modules */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট লিটারেসি মডিউল</span>
              <strong className="text-lg font-extrabold text-slate-900">{toBn(literacyModules.length)}টি</strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">দৈনিক নির্ধারিত সময়</span>
              <strong className="text-lg font-extrabold text-blue-700">১২০ মিনিট (২ ঘণ্টা)</strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট লিটারেসি সময়</span>
              <strong className="text-lg font-extrabold text-emerald-700">
                {toBn(literacyModules.reduce((acc, m) => acc + (m.totalMinutes || 0), 0))} মি.
              </strong>
            </div>
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 text-center">
              <span className="text-[11px] text-slate-500 block">মোট বিষয় ক্ষেত্র</span>
              <strong className="text-lg font-extrabold text-purple-700">৭টি ক্যাটাগরি</strong>
            </div>
          </div>

          {/* Literacy Modules Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <th className="py-3 px-3 w-16 text-center">দিন #</th>
                    <th className="py-3 px-3 w-24 text-center">কাজ নং</th>
                    <th className="py-3 px-4">মডিউল ও বিষয় বিভাগ</th>
                    <th className="py-3 px-4">পঠিত বিষয় / পাঠ শিরোনাম (Topic)</th>
                    <th className="py-3 px-3 text-center">শুরু - শেষ</th>
                    <th className="py-3 px-3 text-center">মোট সময়</th>
                    <th className="py-3 px-3 text-center min-w-[140px]">স্থিতি ও ট্রেইনার মার্ক</th>
                    <th className="py-3 px-3 w-24 text-center">একশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLiteracyModules.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        এই ব্যাচের জন্য কোনো লিটারেসি মডিউল যোগ করা হয়নি। "বাল্ক ইনপুট" অথবা "+ নতুন লিটারেসি মডিউল" বাটনে ক্লিক করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredLiteracyModules.map((item) => {
                      const literacyStatus = calendarProgress?.literacyProgress?.[item.dayNumber];
                      const isDone = !!literacyStatus?.isCompleted;
                      const canMarkLiteracy = isLiteracyTrainer || isDirectorOrFMA;

                      return (
                        <tr key={item.id} className={`transition ${isDone ? 'bg-sky-50/30' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">
                            {toBn(item.dayNumber)}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-blue-800 bg-blue-50/50">
                            {item.taskNo}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{item.moduleName}</span>
                            <span className="text-[10px] text-blue-700">{item.category || 'বাংলা'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800">{item.topic}</p>
                            {item.notes && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                নোট: {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-medium">{item.startTime} - {item.endTime}</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">{toBn(item.totalMinutes)} মি.</td>

                          {/* Completion status & Trainer Mark */}
                          <td className="py-3 px-3 text-center text-xs">
                            {isDone ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-100/90 px-2.5 py-0.5 rounded-full border border-sky-300">
                                  <Check size={11} strokeWidth={3} />
                                  <span>লিটারেসি সম্পন্ন</span>
                                </span>
                                <div className="text-[10px] text-slate-500 font-semibold">
                                  তারিখ: {literacyStatus.completedAt || '-'}
                                </div>
                                <div className="text-[10px] text-sky-800 font-medium truncate max-w-[130px] mx-auto" title={literacyStatus.trainerName || selectedBatch?.literacyTrainerName}>
                                  প্রশিক্ষক: {literacyStatus.trainerName || selectedBatch?.literacyTrainerName || 'লিটারেসি ট্রেইনার'}
                                </div>
                                {canMarkLiteracy && (
                                  <button
                                    onClick={() => handleToggleLiteracyCompletion(item.dayNumber, false)}
                                    disabled={savingDay === item.dayNumber}
                                    className="text-[10px] text-red-600 hover:text-red-700 underline font-semibold transition mt-0.5 block mx-auto cursor-pointer"
                                  >
                                    {savingDay === item.dayNumber ? 'প্রসেসিং...' : 'বাতিল করুন'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              canMarkLiteracy ? (
                                <button
                                  onClick={() => handleToggleLiteracyCompletion(item.dayNumber, true)}
                                  disabled={savingDay === item.dayNumber}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                                >
                                  <Check size={13} strokeWidth={3} />
                                  <span>{savingDay === item.dayNumber ? 'সংরক্ষণ হচ্ছে...' : 'সম্পন্ন মার্ক'}</span>
                                </button>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                  বাকি আছে
                                </span>
                              )
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {canUpdateCalendar ? (
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => {
                                    setSingleModalType('literacy');
                                    setEditingModule(item);
                                    setIsSingleModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                                  title="সম্পাদনা করুন"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleRequestDeleteModule(item, 'literacy')}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">লকড</span>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL (IN-APP MODAL INSTEAD OF BLOCKED BROWSER CONFIRM)*/}
      {/* ========================================================================= */}
      {deletingModule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                মডিউল মুছে ফেলার নিশ্চয়তা
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                আপনি কি নিশ্চিত যে আপনি এই মডিউলটি স্থায়ীভাবে মুছে ফেলতে চান?
              </p>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>ধরণ:</span>
                  <span className="font-semibold text-slate-700">
                    {deletingModule.type === 'skill' ? 'স্কিল ফোকাসড মডিউল' : 'লিটারেসি ও জীবন-দক্ষতা মডিউল'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>ক্লাস দিবস:</span>
                  <span className="font-bold text-slate-900">দিন #{toBn(deletingModule.dayNumber)}</span>
                </div>
                {deletingModule.moduleName && (
                  <div className="flex items-start justify-between text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>মডিউল:</span>
                    <span className="font-semibold text-slate-800 text-right max-w-[220px]">{deletingModule.moduleName}</span>
                  </div>
                )}
                {deletingModule.topic && (
                  <div className="flex items-start justify-between text-slate-500 pt-1">
                    <span>পাঠ / বিষয়:</span>
                    <span className="text-slate-700 text-right max-w-[220px]">{deletingModule.topic}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingModule(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছে ফেলুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK IMPORT MODAL (WITH MANDATORY DEMO CSV DOWNLOAD)                      */}
      {/* ========================================================================= */}
      <ModuleBulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        batchId={selectedBatchId}
        batchName={selectedBatch?.name || 'নির্ধারিত ব্যাচ'}
        moduleType={bulkModalType}
        onImportSuccess={(count) => {
          showToast(`সফলভাবে ${toBn(count)}টি ${bulkModalType === 'skill' ? 'স্কিল' : 'লিটারেসি'} মডিউল আমদানি করা হয়েছে!`);
        }}
        onBulkSave={handleBulkSave}
      />

      {/* ========================================================================= */}
      {/* SINGLE MODULE INPUT MODAL (ADD / EDIT)                                    */}
      {/* ========================================================================= */}
      <ModuleInputModal
        isOpen={isSingleModalOpen}
        onClose={() => {
          setIsSingleModalOpen(false);
          setEditingModule(null);
        }}
        batchId={selectedBatchId}
        batchName={selectedBatch?.name || 'নির্ধারিত ব্যাচ'}
        moduleType={singleModalType}
        initialData={editingModule}
        onSave={handleSaveSingleModule}
      />

      {/* ========================================================================= */}
      {/* INTEGRATED DAY CONDUCTION & ATTENDANCE MODAL                              */}
      {/* ========================================================================= */}
      {activeDayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ক্লাস নং #{activeDayModal.dayBn} পরিচালনা ও হাজিরা রেকর্ড
                </h3>
                <p className="text-xs text-slate-500">
                  {activeDayModal.phaseGroup} • {activeDayModal.skillTaskNo}
                </p>
              </div>
              <button
                onClick={() => setActiveDayModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-0.5">স্কিল বিষয়:</span>
                <p className="text-slate-800">{activeDayModal.skillTopic}</p>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <span className="font-bold text-blue-900 block mb-0.5">লিটারেসি বিষয়:</span>
                <p className="text-slate-800">{activeDayModal.literacyTopic}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ক্লাস পরিচালনার তারিখ (Date Conducted):
                </label>
                <input
                  type="date"
                  value={modalConductDate}
                  onChange={(e) => setModalConductDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  প্রশিক্ষকের মন্তব্য / নোট (Remarks & Observations):
                </label>
                <textarea
                  rows={3}
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  placeholder="ক্লাসের অংশগ্রহণ, ব্যবহারিক উপকরণের প্রাপ্যতা বা শিক্ষার্থীর ফিডব্যাক..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="pt-2">
                <Link
                  to={`/attendance?batchId=${selectedBatchId}&date=${modalConductDate}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <CalendarCheck size={14} />
                  <span>এই ক্লাসের জন্য সরাসরি হাজিরা গ্রহণ পেজে যান</span>
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveDayModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={handleSaveDayModal}
                disabled={savingDay !== null}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
              >
                সংরক্ষণ ও সম্পন্ন করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShikhonCalendar;
