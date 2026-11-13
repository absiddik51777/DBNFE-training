import React, { useState, useEffect, useMemo } from 'react';
import { logActivity } from '../lib/firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Layers, 
  Calendar, 
  Users, 
  X, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Building2,
  Wrench,
  Clock,
  Check,
  Archive,
  Ban,
  CalendarCheck,
  CalendarDays,
  FileText,
  AlertCircle,
  TrendingUp,
  UserPlus,
  BookOpen,
  Activity,
  Download,
  UserCheck,
  XCircle,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react';
import { Batch, Institute, Trade, Trainee, AttendanceRecord, Exam, UserProfile } from '../types';
import { CalendarProgressLog } from '../types/calendar';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';
import { safeFormatDate, toBn } from '../lib/dateUtils';
import { Link } from 'react-router-dom';
import { SHOW_CALENDAR_MODULES } from '../config/features';
import { TableSkeleton } from '../components/Skeleton';
import { DataTableToolbar, ColumnOption, GroupByOption, ActiveFilterChip } from '../components/TableToolbar/DataTableToolbar';
import { downloadCSV } from '../lib/exportUtils';

const FISCAL_YEARS = ['২০২৫-২০২৬', '২০২৪-২০২৫', '২০২৬-২০২৭'];
const ITEMS_PER_PAGE = 6;
const LOGS_PER_PAGE = 10;

const Batches: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Main Tab Navigation: 'batches' | 'activity_logs'
  const [activeMainTab, setActiveMainTab] = useState<'batches' | 'activity_logs'>('batches');

  // Dedicated Activity Log State (tracks trainer module completion updates for accountability)
  const [progressLogs, setProgressLogs] = useState<CalendarProgressLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSelectedBatch, setLogSelectedBatch] = useState<string>('all');
  const [logModuleType, setLogModuleType] = useState<'all' | 'skill' | 'literacy'>('all');
  const [logTrainerFilter, setLogTrainerFilter] = useState<string>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logCurrentPage, setLogCurrentPage] = useState<number>(1);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  
  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [viewingBatch, setViewingBatch] = useState<Batch | null>(null);

  // Safe Lifecycle Modal State (Cancel / Archive)
  const [safeLifecycleBatch, setSafeLifecycleBatch] = useState<{
    batch: Batch;
    traineeCount: number;
    attendanceCount: number;
    examCount: number;
  } | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<'archive' | 'cancel'>('archive');
  const [cancellationReason, setCancellationReason] = useState('');

  // Form State & Errors
  const [formData, setFormData] = useState({
    name: '',
    batchCode: '',
    instituteId: '',
    tradeId: '',
    skillTrainerId: '',
    literacyTrainerId: '',
    fiscalYear: '২০২৫-২০২৬',
    startDate: '',
    endDate: '',
    maxTrainees: 30,
    status: 'Active' as Batch['status'],
    cancellationReason: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Search, Filter, Sort, Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstitute, setFilterInstitute] = useState('all');
  const [filterTrade, setFilterTrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFiscalYear, setFilterFiscalYear] = useState('all');
  const [sortBy, setSortBy] = useState<'code_asc' | 'date_desc' | 'name_asc' | 'trainees_desc'>('code_asc');
  const [currentPage, setCurrentPage] = useState(1);

  // View Mode & Group By
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [groupBy, setGroupBy] = useState<string>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const DEFAULT_BATCH_COLUMNS: ColumnOption[] = [
    { id: 'batchCode', label: 'ব্যাচ কোড (Batch Code)', visible: true },
    { id: 'name', label: 'ব্যাচের নাম (Batch Name)', visible: true },
    { id: 'instituteTrade', label: 'প্রতিষ্ঠান ও ট্রেড (Institute & Trade)', visible: true },
    { id: 'dates', label: 'মেয়াদ ও অর্থবছর (Dates & Fiscal Year)', visible: true },
    { id: 'trainees', label: 'শিক্ষার্থী ও আসন (Trainees & Capacity)', visible: true },
    { id: 'trainers', label: 'প্রশিক্ষকগণ (Trainers)', visible: true },
    { id: 'status', label: 'স্ট্যাটাস (Status)', visible: true },
    { id: 'actions', label: 'পদক্ষেপ (Actions)', visible: true, required: true },
  ];

  const [columns, setColumns] = useState<ColumnOption[]>(() => {
    try {
      const saved = localStorage.getItem('bnfe_batch_visible_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_BATCH_COLUMNS.map(col => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible
        }));
      }
    } catch (e) {}
    return DEFAULT_BATCH_COLUMNS;
  });

  const toggleColumn = (colId: string) => {
    setColumns(prev => {
      const next = prev.map(c => c.id === colId && !c.required ? { ...c, visible: !c.visible } : c);
      try {
        const map: Record<string, boolean> = {};
        next.forEach(c => { map[c.id] = c.visible; });
        localStorage.setItem('bnfe_batch_visible_columns', JSON.stringify(map));
      } catch (e) {}
      return next;
    });
  };

  const resetColumns = () => {
    setColumns(DEFAULT_BATCH_COLUMNS);
    try {
      localStorage.removeItem('bnfe_batch_visible_columns');
    } catch (e) {}
  };

  const isColVisible = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    return col ? col.visible : true;
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const BATCH_GROUP_BY_OPTIONS: GroupByOption[] = [
    { id: 'none', label: 'গ্রুপ ছাড়া (Default)' },
    { id: 'institute', label: 'প্রতিষ্ঠান অনুযায়ী (By Institute)' },
    { id: 'trade', label: 'ট্রেড অনুযায়ী (By Trade)' },
    { id: 'fiscalYear', label: 'অর্থবছর অনুযায়ী (By Fiscal Year)' },
    { id: 'status', label: 'অবস্থা অনুযায়ী (By Status)' },
  ];

  const { userProfile } = useAuth();
  const { hasPermission, isCourseDirector } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();
  const { confirm, showAlert } = useConfirm();

  const isDirector = isCourseDirector || userProfile?.role === 'Course Director';
  const canCreate = hasPermission('create_batch') || isDirector;
  const canEdit = hasPermission('edit_batch') || isDirector;
  const canDelete = hasPermission('delete_batch') || isDirector;
  const canSeed = hasPermission('seed_demo_trainees') || isDirector;

  useEffect(() => {
    fetchBatchesData();
  }, [userProfile]);

  const fetchBatchesData = async () => {
    setLoading(true);
    try {
      const [bList, iList, tList, trnList, uList, logsList] = await Promise.all([
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<UserProfile>('users'),
        dataService.getCalendarProgressLogs(),
      ]);

      setBatches(bList);
      setInstitutes(iList);
      setTrades(tList);
      setTrainees(trnList);
      setUsers(uList);
      setProgressLogs(logsList);
    } catch (error) {
      console.warn("Notice fetching batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogsOnly = async () => {
    setLogsLoading(true);
    try {
      const logs = await dataService.getCalendarProgressLogs();
      setProgressLogs(logs);
    } catch (e) {
      console.warn("Notice loading activity logs:", e);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBatchesData();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Unique trainers who have recorded logs
  const reportingTrainers = useMemo(() => {
    const trainersMap = new Map<string, string>();
    progressLogs.forEach(l => {
      const name = l.trainerName || l.trainerId;
      if (name) {
        trainersMap.set(l.trainerId || name, name);
      }
    });
    return Array.from(trainersMap.entries()).map(([id, name]) => ({ id, name }));
  }, [progressLogs]);

  // Filtered Activity Logs
  const filteredProgressLogs = useMemo(() => {
    return progressLogs.filter(log => {
      if (logSelectedBatch !== 'all' && log.batchId !== logSelectedBatch) return false;
      if (logModuleType !== 'all' && log.moduleType !== logModuleType) return false;
      if (logTrainerFilter !== 'all') {
        const matchesTrainer = log.trainerId === logTrainerFilter || log.trainerName === logTrainerFilter;
        if (!matchesTrainer) return false;
      }
      if (logStatusFilter === 'completed' && !log.isCompleted) return false;
      if (logStatusFilter === 'cancelled' && log.isCompleted) return false;

      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase().trim();
        const batchName = (log.batchName || '').toLowerCase();
        const tradeName = (log.tradeName || '').toLowerCase();
        const trainerName = (log.trainerName || '').toLowerCase();
        const trainerId = (log.trainerId || '').toLowerCase();
        const topic = (log.topic || '').toLowerCase();
        const taskNo = (log.taskNo || '').toLowerCase();
        const remarks = (log.remarks || '').toLowerCase();
        const dayStr = log.dayNumber ? log.dayNumber.toString() : '';
        const dayBnStr = log.dayNumber ? toBn(log.dayNumber) : '';

        const match = batchName.includes(q) ||
          tradeName.includes(q) ||
          trainerName.includes(q) ||
          trainerId.includes(q) ||
          topic.includes(q) ||
          taskNo.includes(q) ||
          remarks.includes(q) ||
          dayStr.includes(q) ||
          dayBnStr.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [progressLogs, logSelectedBatch, logModuleType, logTrainerFilter, logStatusFilter, logSearchQuery]);

  // Activity Log Pagination
  const totalLogPages = Math.ceil(filteredProgressLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (logCurrentPage - 1) * LOGS_PER_PAGE;
    return filteredProgressLogs.slice(startIndex, startIndex + LOGS_PER_PAGE);
  }, [filteredProgressLogs, logCurrentPage]);

  // Reset Activity Log filters
  const resetLogFilters = () => {
    setLogSelectedBatch('all');
    setLogModuleType('all');
    setLogTrainerFilter('all');
    setLogStatusFilter('all');
    setLogSearchQuery('');
    setLogCurrentPage(1);
  };

  // Export Activity Logs to CSV
  const exportActivityLogsCSV = async () => {
    if (filteredProgressLogs.length === 0 || exportingLogs) return;
    setExportingLogs(true);
    try {
      const headers = [
        "তারিখ (Date)",
        "কার্যদিবস নং (Day)",
        "ব্যাচ আইডি (Batch ID)",
        "ব্যাচের নাম (Batch Name)",
        "ট্রেড (Trade)",
        "মডিউলের ধরন (Module Type)",
        "কাজ নং (Task No)",
        "পাঠের বিষয় / শিরোনাম (Topic)",
        "স্থিতি (Status)",
        "প্রশিক্ষকের নাম (Trainer Name)",
        "প্রশিক্ষক আইডি (Trainer ID)",
        "প্রশিক্ষকের ভূমিকা (Trainer Type)",
        "মন্তব্য ও পর্যবেক্ষণ (Remarks)"
      ];

      const rows = filteredProgressLogs.map(l => [
        l.completedAt || '',
        l.dayNumber || '',
        l.batchId || '',
        l.batchName || '',
        l.tradeName || '',
        l.moduleType === 'skill' ? 'স্কিল ফোকাসড' : 'লিটারেসি ফোকাসড',
        l.taskNo || '',
        l.topic || '',
        l.isCompleted ? 'সম্পন্ন (Completed)' : 'বাতিল / অসম্পূর্ণ',
        l.trainerName || '',
        l.trainerId || '',
        l.trainerType || '',
        l.remarks || ''
      ]);

      const selectedBatchName = logSelectedBatch !== 'all'
        ? (batches.find(b => b.id === logSelectedBatch)?.batchCode || logSelectedBatch)
        : 'all_batches';

      const res = await downloadCSV(
        `trainer_activity_logs_${selectedBatchName}_${format(new Date(), 'yyyyMMdd')}`,
        headers,
        rows
      );

      await showAlert({
        title: res.success ? 'ডাউনলোড সম্পন্ন' : 'ডাউনলোড ব্যর্থ',
        message: res.message,
        variant: res.success ? 'info' : 'danger'
      });
    } finally {
      setExportingLogs(false);
    }
  };

  // Seed sample trainer activity log for testing if completely empty
  const handleSeedSampleActivityLogs = async () => {
    if (batches.length === 0) return;
    const targetBatch = batches[0];
    const trade = trades.find(t => t.id === targetBatch.tradeId);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    const sampleLog1: CalendarProgressLog = {
      id: `cpl_${targetBatch.id}_skill_d1_${Date.now()}`,
      batchId: targetBatch.id,
      batchName: targetBatch.name,
      tradeId: targetBatch.tradeId,
      tradeName: trade?.name || 'ট্রেড',
      instituteId: targetBatch.instituteId,
      dayNumber: 1,
      moduleType: 'skill',
      taskNo: 'কাজ ০১',
      topic: 'টুলস পরিচিতি ও প্রাথমিক কর্মশালার নিরাপত্তা নির্দেশনা',
      isCompleted: true,
      completedAt: todayStr,
      trainerId: targetBatch.skillTrainerId || userProfile?.id || 'TRN-SKILL-01',
      trainerName: targetBatch.skillTrainerName || userProfile?.name || 'স্কিল প্রশিক্ষক',
      trainerType: 'Skill Trainer',
      remarks: 'সকল প্রশিক্ষণার্থী সুরক্ষামূলক পোশাক ও টুলস ব্যবহারে সন্তোষজনক অংশগ্রহণ প্রদর্শন করেছে।',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000
    };

    const sampleLog2: CalendarProgressLog = {
      id: `cpl_${targetBatch.id}_literacy_d1_${Date.now() + 1}`,
      batchId: targetBatch.id,
      batchName: targetBatch.name,
      tradeId: targetBatch.tradeId,
      tradeName: trade?.name || 'ট্রেড',
      instituteId: targetBatch.instituteId,
      dayNumber: 1,
      moduleType: 'literacy',
      taskNo: 'কাজ ০১',
      topic: 'দৈনন্দিন কর্মক্ষেত্রে মৌলিক বাংলা কথন ও প্রমিত যোগাযোগ শিষ্টাচার',
      isCompleted: true,
      completedAt: todayStr,
      trainerId: targetBatch.literacyTrainerId || 'TRN-LIT-01',
      trainerName: targetBatch.literacyTrainerName || 'লিটারেসি প্রশিক্ষক',
      trainerType: 'Literacy Trainer',
      remarks: 'মৌখিক যোগাযোগ ও দলীয় পাঠচর্চায় প্রশিক্ষণার্থীরা সক্রিয়ভাবে অংশ নেয়।',
      createdAt: Date.now() - 1800000,
      updatedAt: Date.now() - 1800000
    };

    await dataService.saveCalendarProgressLog(sampleLog1);
    await dataService.saveCalendarProgressLog(sampleLog2);
    const freshLogs = await dataService.getCalendarProgressLogs();
    setProgressLogs(freshLogs);
    setActionSuccessMessage('পরীক্ষামূলক ট্রেইনার অ্যাক্টিভিটি লগ সফলভাবে যুক্ত হয়েছে।');
    setTimeout(() => setActionSuccessMessage(''), 3500);
  };

  // Safe Batch Code Generator: scans all batches, extracts max digits, generates BAT-0X
  const generateSafeNextBatchCode = (currentBatches: Batch[]): string => {
    const existingCodes = currentBatches.map(b => b.batchCode || b.id || '');
    const numbers = existingCodes
      .map(c => {
        const match = c.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n) && n > 0);

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    return `BAT-${String(nextNum).padStart(2, '0')}`;
  };

  // Trainees count map per batch
  const batchTraineesMap = useMemo(() => {
    const map: Record<string, number> = {};
    batches.forEach(b => {
      map[b.id] = trainees.filter(t => t.batchId === b.id).length;
    });
    return map;
  }, [batches, trainees]);

  // Overall Batch Statistics
  const stats = useMemo(() => {
    const total = batches.length;
    const active = batches.filter(b => !b.status || b.status === 'Active').length;
    const upcoming = batches.filter(b => b.status === 'Upcoming').length;
    const completed = batches.filter(b => b.status === 'Completed').length;
    const archived = batches.filter(b => b.status === 'Archived').length;
    const cancelled = batches.filter(b => b.status === 'Cancelled').length;
    const totalEnrolled = trainees.filter(t => t.batchId).length;
    return { total, active, upcoming, completed, archived, cancelled, totalEnrolled };
  }, [batches, trainees]);

  // Check possible duplicate batch warning (trade, institute, date overlap)
  const checkForDuplicates = (instId: string, trdId: string, fYear: string, sDate: string, eDate: string, excludeBatchId?: string) => {
    if (!instId || !trdId || !sDate || !eDate) {
      setDuplicateWarning(null);
      return;
    }

    const start = new Date(sDate).getTime();
    const end = new Date(eDate).getTime();

    const match = batches.find(b => {
      if (b.id === excludeBatchId) return false;
      const sameInst = b.instituteId === instId;
      const sameTrd = b.tradeId === trdId;
      const bStart = b.startDate || 0;
      const bEnd = b.endDate || 0;
      const datesOverlap = (start <= bEnd && end >= bStart);
      const sameFiscal = b.fiscalYear && fYear ? b.fiscalYear === fYear : false;

      return sameInst && sameTrd && (sameFiscal || datesOverlap);
    });

    if (match) {
      setDuplicateWarning(
        `সতর্কতা: নির্বাচিত প্রতিষ্ঠানে এই ট্রেডে ইতোমধ্যে "${match.name} (${match.batchCode || match.id})" নামক একটি ব্যাচ নির্ধারিত রয়েছে। অনুগ্রহ করে নিশ্চিত হোন যে আপনি একই সময়ে আরেকটি ব্যাচ পরিচালনা করতে চান কিনা।`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  // Open Add / Edit Modal
  const handleOpenModal = (b?: Batch) => {
    setFormErrors({});
    setDuplicateWarning(null);
    const availableInstitutes = institutes;
    const activeTrades = trades.filter(t => t.status === 'Active');
    const availableTrades = activeTrades.length > 0 ? activeTrades : trades;

    if (b) {
      setEditingBatch(b);
      setFormData({
        name: b.name,
        batchCode: b.batchCode || b.id || '',
        instituteId: b.instituteId || availableInstitutes[0]?.id || '',
        tradeId: b.tradeId || availableTrades[0]?.id || '',
        skillTrainerId: b.skillTrainerId || '',
        literacyTrainerId: b.literacyTrainerId || '',
        fiscalYear: b.fiscalYear || '২০২৫-২০২৬',
        startDate: safeFormatDate(b.startDate, 'yyyy-MM-dd'),
        endDate: safeFormatDate(b.endDate, 'yyyy-MM-dd'),
        maxTrainees: b.maxTrainees || 30,
        status: b.status || 'Active',
        cancellationReason: b.cancellationReason || '',
      });
    } else {
      setEditingBatch(null);
      const nextCode = generateSafeNextBatchCode(batches);
      const today = new Date();
      const sixMonthsLater = new Date(today.getTime() + 180 * 86400000);

      setFormData({
        name: '',
        batchCode: nextCode,
        instituteId: availableInstitutes[0]?.id || '',
        tradeId: availableTrades[0]?.id || '',
        skillTrainerId: '',
        literacyTrainerId: '',
        fiscalYear: '২০২৫-২০২৬',
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(sixMonthsLater, 'yyyy-MM-dd'),
        maxTrainees: 30,
        status: 'Active',
        cancellationReason: '',
      });
    }
    setIsModalOpen(true);
  };

  // Form Validation
  const validateForm = async (): Promise<boolean> => {
    const errors: Record<string, string> = {};

    // 1. Batch Name
    if (!formData.name.trim()) {
      errors.name = 'ব্যাচের নাম প্রদান করা আবশ্যক।';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'ব্যাচের নাম অন্তত ৩ অক্ষরের হতে হবে।';
    }

    // 2. Batch Code
    const cleanCode = formData.batchCode.trim().toUpperCase();
    if (!cleanCode) {
      errors.batchCode = 'ব্যাচ কোড প্রদান করা আবশ্যক।';
    } else if (!/^[A-Z0-9\-_]{3,15}$/.test(cleanCode)) {
      errors.batchCode = 'ব্যাচ কোড ৩-১৫ অক্ষরের ইংরেজি বর্ণ, সংখ্যা বা ড্যাশ হতে হবে (যেমন: BAT-01)।';
    } else {
      const isDuplicate = batches.some(
        b => b.id !== editingBatch?.id && (b.batchCode?.trim().toUpperCase() === cleanCode || b.id.trim().toUpperCase() === cleanCode)
      );
      if (isDuplicate) {
        errors.batchCode = `এই ব্যাচ কোডটি ('${cleanCode}') ইতোমধ্যে অন্য একটি ব্যাচে ব্যবহৃত হয়েছে। ইউনিক কোড দিন।`;
      }
    }

    // 3. Institute and Trade
    if (!formData.instituteId) {
      errors.instituteId = 'প্রশিক্ষণ প্রতিষ্ঠান নির্বাচন করুন।';
    }
    if (!formData.tradeId) {
      errors.tradeId = 'বৃত্তিমূলক ট্রেড নির্বাচন করুন।';
    } else {
      const selectedTrade = trades.find(t => t.id === formData.tradeId);
      if (!editingBatch && selectedTrade?.status === 'Inactive') {
        errors.tradeId = 'নিষ্ক্রিয় ট্রেডে নতুন ব্যাচ বরাদ্দ দেওয়া অনুমোদিত নয়।';
      }
    }

    // 4. Dates & Consistency
    if (!formData.startDate) {
      errors.startDate = 'শুরুর তারিখ নির্বাচন করুন।';
    }
    if (!formData.endDate) {
      errors.endDate = 'সমাপ্তির তারিখ নির্বাচন করুন।';
    }
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate).getTime();
      const end = new Date(formData.endDate).getTime();
      if (end <= start) {
        errors.endDate = 'সমাপ্তির তারিখ অবশ্যই শুরুর তারিখের পরবর্তী হতে হবে।';
      } else if (end - start < 15 * 86400000) {
        errors.endDate = 'কোর্সের মেয়াদ নূন্যতম ১৫ দিন হতে হবে।';
      }
    }

    // 5. Capacity
    const capacity = Number(formData.maxTrainees);
    if (isNaN(capacity) || capacity < 5 || capacity > 100) {
      errors.maxTrainees = 'সর্বোচ্চ আসন সংখ্যা ৫ থেকে ১০০ এর মধ্যে হতে হবে (আদর্শ: ৩০)।';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const isValid = await validateForm();
    if (!isValid) return;

    setSubmitting(true);
    try {
      const cleanCode = formData.batchCode.trim().toUpperCase();
      const id = editingBatch ? editingBatch.id : `BAT-${cleanCode.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
      
      const startMs = new Date(formData.startDate).getTime();
      const endMs = new Date(formData.endDate).getTime();

      // Operational Status calculation:
      // Preserve manual administrative choices (Archived / Cancelled)
      let calculatedStatus = formData.status;
      if (formData.status !== 'Archived' && formData.status !== 'Cancelled') {
        const now = Date.now();
        if (now < startMs) {
          calculatedStatus = 'Upcoming';
        } else if (now > endMs) {
          calculatedStatus = 'Completed';
        } else {
          calculatedStatus = 'Active';
        }
      }

      const skillTrainerObj = users.find(u => u.id === formData.skillTrainerId);
      const literacyTrainerObj = users.find(u => u.id === formData.literacyTrainerId);

      const savedBatch: Batch = {
        id,
        name: formData.name.trim(),
        batchCode: cleanCode,
        instituteId: formData.instituteId,
        tradeId: formData.tradeId,
        skillTrainerId: formData.skillTrainerId || undefined,
        skillTrainerName: skillTrainerObj?.name || undefined,
        literacyTrainerId: formData.literacyTrainerId || undefined,
        literacyTrainerName: literacyTrainerObj?.name || undefined,
        fiscalYear: formData.fiscalYear,
        startDate: startMs,
        endDate: endMs,
        maxTrainees: Number(formData.maxTrainees),
        status: calculatedStatus,
        cancellationReason: formData.cancellationReason?.trim() || undefined,
        createdAt: editingBatch?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await dataService.saveItem('batches', savedBatch);

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingBatch 
          ? `ব্যাচ তথ্য আপডেট: ${savedBatch.name} (${savedBatch.batchCode})` 
          : `নতুন ব্যাচ তৈরি: ${savedBatch.name} (${savedBatch.batchCode})`,
        'Batches',
        id
      );

      setActionSuccessMessage(editingBatch ? 'ব্যাচের তথ্য সফলভাবে আপডেট করা হয়েছে।' : 'নতুন প্রশিক্ষণ ব্যাচ সফলভাবে যুক্ত করা হয়েছে।');
      setTimeout(() => setActionSuccessMessage(''), 3500);

      setIsModalOpen(false);
      await fetchBatchesData();
    } catch (error) {
      console.warn("Notice saving batch:", error);
      await showAlert({
        title: 'সংরক্ষণ ব্যর্থ',
        message: 'ব্যাচ সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
        variant: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Delete Request Handler: Checks for references
  const handleDeleteRequest = async (batch: Batch) => {
    if (!canDelete) return;

    // Fallback to archive when deleting is denied
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'ব্যাচ সংরক্ষণাগারে স্থানান্তর (Fallback to Archive)',
        message: `সিস্টেম সেটিংস অনুযায়ী ব্যাচ স্থায়ীভাবে মুছে ফেলা বন্ধ (Denied) রয়েছে। আপনি কি "${batch.name} (${batch.batchCode || batch.id})" ব্যাচটি মুছে ফেলার পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ আর্কাইভে স্থানান্তর করলে এই ব্যাচের সকল শিক্ষার্থী, উপস্থিতি ও পরীক্ষার ডাটা অক্ষুণ্ণ থাকবে এবং ব্যাচটি সক্রিয় কার্যক্রম থেকে সরিয়ে সংরক্ষণাগারে নিরাপদে রাখা হবে।',
        confirmText: 'হ্যাঁ, ব্যাচ আর্কাইভ করুন (Archive)',
        cancelText: 'বাতিল',
        variant: 'warning'
      });

      if (confirmed) {
        await dataService.archiveRecord('batches', batch.id, 'সিস্টেমে ডিলিট বন্ধ থাকায় ব্যবহারকারীর নির্দেশে সংরক্ষণাগারে স্থানান্তর');
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ব্যাচ সংরক্ষণাগারে স্থানান্তরিত (ডিলিট বন্ধ থাকায় ফলব্যাক): ${batch.name} (${batch.batchCode || batch.id})`,
          'Batches',
          batch.id
        );
        setActionSuccessMessage(`"${batch.name}" ব্যাচটি সফলভাবে সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        await fetchBatchesData();
      }
      return;
    }

    try {
      const usage = await dataService.checkBatchUsage(batch.id);
      
      if (usage.isReferenced) {
        // References exist! Open Safe Lifecycle Modal (Archive / Cancel)
        setSafeLifecycleBatch({
          batch,
          traineeCount: usage.traineeCount,
          attendanceCount: usage.attendanceCount,
          examCount: usage.examCount,
        });
        setLifecycleAction('archive');
        setCancellationReason('');

        // Log the blocked deletion attempt
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ব্যাচ অপসারণ চেষ্টা ব্যর্থ (রেফারেন্স বিদ্যমান): ${batch.name} (${batch.batchCode || batch.id})`,
          'Batches',
          batch.id
        );
      } else {
        // Unreferenced batch: Safe to hard delete with confirmation modal
        const confirmed = await confirm({
          title: 'ব্যাচ অপসারণের নিশ্চিতকরণ',
          message: `আপনি কি নিশ্চিতভাবে "${batch.name} (${batch.batchCode || batch.id})" ব্যাচটি স্থায়ীভাবে মুছে ফেলতে চান?`,
          detail: 'এই অপারেশনের ফলে ব্যাচটির তথ্য সিস্টেম থেকে সম্পূর্ণরূপে অপসারিত হবে।',
          confirmText: 'হ্যাঁ, মুছে ফেলুন',
          cancelText: 'বাতিল',
          variant: 'danger'
        });

        if (confirmed) {
          await dataService.deleteItem('batches', batch.id);
          await logActivity(
            userProfile?.id || '',
            userProfile?.name || 'User',
            `ব্যাচ স্থায়ীভাবে অপসারণ: ${batch.name} (${batch.batchCode || batch.id})`,
            'Batches',
            batch.id
          );
          setActionSuccessMessage(`"${batch.name}" ব্যাচটি সফলভাবে মুছে ফেলা হয়েছে।`);
          setTimeout(() => setActionSuccessMessage(''), 3000);
          fetchBatchesData();
        }
      }
    } catch (err) {
      console.warn("Error checking batch usage:", err);
    }
  };

  // Safe Lifecycle Submission (Archive or Cancel)
  const handleConfirmLifecycleAction = async () => {
    if (!safeLifecycleBatch || !canEdit) return;
    const { batch } = safeLifecycleBatch;

    if (lifecycleAction === 'cancel' && !cancellationReason.trim()) {
      await showAlert({
        title: 'বাতিলের কারণ আবশ্যক',
        message: "ব্যাচটি বাতিলের কারণ উল্লেখ করা আবশ্যক।",
        variant: 'warning'
      });
      return;
    }

    try {
      const newStatus: Batch['status'] = lifecycleAction === 'archive' ? 'Archived' : 'Cancelled';
      const updated: Batch = {
        ...batch,
        status: newStatus,
        cancellationReason: lifecycleAction === 'cancel' ? cancellationReason.trim() : undefined,
        updatedAt: Date.now(),
      };

      await dataService.saveItem('batches', updated);

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        lifecycleAction === 'archive'
          ? `ব্যাচ আর্কাইভকরণ (রেকর্ড সংরক্ষিত): ${batch.name}`
          : `ব্যাচ বাতিলকরণ (কারণ: ${cancellationReason.trim()}): ${batch.name}`,
        'Batches',
        batch.id
      );

      setActionSuccessMessage(
        lifecycleAction === 'archive'
          ? `"${batch.name}" ব্যাচটি সফলভাবে আর্কাইভ করা হয়েছে। সকল শিক্ষার্থী ও হাজিরার রেকর্ড অক্ষত রয়েছে।`
          : `"${batch.name}" ব্যাচটি বাতিল তালিকাভুক্ত করা হয়েছে। কারণ অডিট লগে সংরক্ষিত হয়েছে।`
      );
      setTimeout(() => setActionSuccessMessage(''), 4000);

      setSafeLifecycleBatch(null);
      fetchBatchesData();
    } catch (err) {
      console.warn("Error archiving/cancelling batch:", err);
    }
  };

  // Force Hard Delete Handler for Batch (when referenced, user confirms cascade removal)
  const handleForceDeleteBatch = async () => {
    if (!safeLifecycleBatch || !canDelete) return;
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'ব্যাচ সংরক্ষণাগারে স্থানান্তর (Fallback to Archive)',
        message: `সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Denied) রাখা হয়েছে। আপনি কি "${safeLifecycleBatch.batch.name}" ব্যাচটি স্থায়ীভাবে মুছে ফেলার পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ সংরক্ষণাগারে পাঠালে ব্যাচের সকল শিক্ষার্থী ও হাজিরা ডাটা অক্ষুণ্ণ রেখে ব্যাচটি আর্কাইভে স্থানান্তরিত হবে।',
        confirmText: 'হ্যাঁ, সংরক্ষণাগারে পাঠান',
        cancelText: 'বাতিল',
        variant: 'warning'
      });
      if (confirmed) {
        await dataService.archiveRecord('batches', safeLifecycleBatch.batch.id, 'ডিলিট নিষিদ্ধ থাকায় সংরক্ষণাগারে স্থানান্তর');
        setSafeLifecycleBatch(null);
        setActionSuccessMessage(`"${safeLifecycleBatch.batch.name}" ব্যাচটি সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        await fetchBatchesData();
      }
      return;
    }

    const { batch, traineeCount, attendanceCount } = safeLifecycleBatch;
    const confirmed = await confirm({
      title: 'বলপূর্বক ব্যাচ স্থায়ী অপসারণ (ক্যাসকেডসহ)',
      message: `আপনি কি নিশ্চিতভাবে "${batch.name} (${batch.batchCode || batch.id})" ব্যাচটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      detail: `⚠️ সতর্কতা: এতে এই ব্যাচের সকল শিক্ষার্থী (${toBn(traineeCount)} জন) ও হাজিরা (${toBn(attendanceCount)} টি) রেকর্ড ডাটাবেজ থেকে চিরতরে মুছে যাবে! এই সিদ্ধান্ত অপরিবর্তনীয়।`,
      confirmText: 'হ্যাঁ, সবকিছু মুছে ফেলুন',
      cancelText: 'বাতিল',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        await dataService.deleteBatch(batch.id, true);
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ব্যাচ বলপূর্বক অপসারণ (ক্যাসকেড সহ): ${batch.name} (${batch.batchCode || batch.id})`,
          'Batches',
          batch.id
        );
        setSafeLifecycleBatch(null);
        setActionSuccessMessage(`"${batch.name}" ব্যাচ ও সংশ্লিষ্ট সকল রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        await fetchBatchesData();
      } catch (error: any) {
        console.warn("Notice force deleting batch:", error);
        await showAlert({
          title: 'ব্যর্থতা',
          message: "ব্যাচ ডিলিট করতে সমস্যা হয়েছে: " + (error?.message || error),
          variant: 'danger'
        });
      }
    }
  };

  // Seed Demo Trainees
  const handleSeedDemoTrainees = async () => {
    setSeeding(true);
    try {
      await dataService.seedDemoTraineesForAllBatches(false);
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        'সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী যোগ করা হয়েছে',
        'Batches',
        'seed_demo_trainees'
      );
      await fetchBatchesData();
      setActionSuccessMessage('সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী সফলভাবে অন্তর্ভুক্ত করা হয়েছে!');
      setTimeout(() => setActionSuccessMessage(''), 5000);
    } catch (error) {
      console.warn("Notice seeding demo trainees in Batches:", error);
    } finally {
      setSeeding(false);
    }
  };

  const getInstituteName = (id: string) => 
    institutes.find(i => i.id === id)?.name || id || '-';

  const getTradeName = (id: string) => 
    trades.find(t => t.id === id)?.name || id || '-';

  // Filtered and Sorted Batches
  const processedBatches = useMemo(() => {
    return batches
      .filter(b => {
        // Institute filter
        if (filterInstitute !== 'all' && b.instituteId !== filterInstitute) return false;
        // Trade filter
        if (filterTrade !== 'all' && b.tradeId !== filterTrade) return false;
        // Status filter
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        // Fiscal Year filter
        if (filterFiscalYear !== 'all' && b.fiscalYear !== filterFiscalYear) return false;

        // Search text
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const nameMatch = (b.name || '').toLowerCase().includes(term);
          const codeMatch = (b.batchCode || b.id || '').toLowerCase().includes(term);
          const instMatch = getInstituteName(b.instituteId).toLowerCase().includes(term);
          const tradeMatch = getTradeName(b.tradeId).toLowerCase().includes(term);
          return nameMatch || codeMatch || instMatch || tradeMatch;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'code_asc') return (a.batchCode || a.id).localeCompare(b.batchCode || b.id);
        if (sortBy === 'date_desc') return (b.startDate || 0) - (a.startDate || 0);
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'trainees_desc') return (batchTraineesMap[b.id] || 0) - (batchTraineesMap[a.id] || 0);
        return 0;
      });
  }, [batches, filterInstitute, filterTrade, filterStatus, filterFiscalYear, searchTerm, sortBy, institutes, trades, batchTraineesMap]);

  // Pagination
  const totalPages = Math.ceil(processedBatches.length / ITEMS_PER_PAGE) || 1;
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedBatches.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedBatches, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (filterInstitute !== 'all') {
      const inst = institutes.find(i => i.id === filterInstitute);
      chips.push({
        id: 'institute',
        label: 'প্রতিষ্ঠান',
        valueLabel: inst ? inst.name : filterInstitute,
        onRemove: () => { setFilterInstitute('all'); setCurrentPage(1); }
      });
    }
    if (filterTrade !== 'all') {
      const trd = trades.find(t => t.id === filterTrade);
      chips.push({
        id: 'trade',
        label: 'ট্রেড',
        valueLabel: trd ? trd.name : filterTrade,
        onRemove: () => { setFilterTrade('all'); setCurrentPage(1); }
      });
    }
    if (filterStatus !== 'all') {
      chips.push({
        id: 'status',
        label: 'স্ট্যাটাস',
        valueLabel: filterStatus === 'Active' ? 'চলমান' : filterStatus === 'Upcoming' ? 'আসন্ন' : filterStatus === 'Completed' ? 'সম্পন্ন' : filterStatus === 'Archived' ? 'আর্কাইভ' : 'বাতিল',
        onRemove: () => { setFilterStatus('all'); setCurrentPage(1); }
      });
    }
    if (filterFiscalYear !== 'all') {
      chips.push({
        id: 'fiscalYear',
        label: 'অর্থবছর',
        valueLabel: filterFiscalYear,
        onRemove: () => { setFilterFiscalYear('all'); setCurrentPage(1); }
      });
    }
    return chips;
  }, [filterInstitute, filterTrade, filterStatus, filterFiscalYear, institutes, trades]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterInstitute('all');
    setFilterTrade('all');
    setFilterStatus('all');
    setFilterFiscalYear('all');
    setCurrentPage(1);
  };

  const groupedBatches = useMemo(() => {
    if (groupBy === 'none') return null;

    const map = new Map<string, { title: string; subtitle?: string; items: Batch[] }>();

    processedBatches.forEach(b => {
      let key = '';
      let title = '';
      let subtitle = '';

      if (groupBy === 'institute') {
        key = b.instituteId || 'unassigned';
        title = b.instituteId ? getInstituteName(b.instituteId) : 'প্রতিষ্ঠান অনির্ধারিত';
      } else if (groupBy === 'trade') {
        key = b.tradeId || 'unassigned';
        title = b.tradeId ? getTradeName(b.tradeId) : 'ট্রেড অনির্ধারিত';
      } else if (groupBy === 'fiscalYear') {
        key = b.fiscalYear || 'unassigned';
        title = b.fiscalYear ? `অর্থবছর: ${b.fiscalYear}` : 'অর্থবছর অনির্ধারিত';
      } else if (groupBy === 'status') {
        key = b.status || 'Active';
        title = b.status === 'Active' ? 'চলমান ব্যাচ (Active)' : b.status === 'Upcoming' ? 'আসন্ন ব্যাচ (Upcoming)' : b.status === 'Completed' ? 'সম্পন্ন ব্যাচ (Completed)' : b.status === 'Archived' ? 'আর্কাইভকৃত ব্যাচ (Archived)' : (b.status || 'অন্যান্য');
      }

      if (!map.has(key)) {
        map.set(key, { title, subtitle, items: [] });
      }
      map.get(key)!.items.push(b);
    });

    const list: { key: string; title: string; subtitle?: string; items: Batch[] }[] = [];
    map.forEach((val, key) => {
      list.push({ key, title: val.title, subtitle: val.subtitle, items: val.items });
    });

    return list;
  }, [processedBatches, groupBy, institutes, trades]);

  // Get Status badge
  const renderStatusBadge = (status?: Batch['status']) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">চলমান</span>;
      case 'Upcoming':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">আসন্ন</span>;
      case 'Completed':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">সম্পন্ন</span>;
      case 'Archived':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">আর্কাইভকৃত</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">বাতিলকৃত</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">চলমান</span>;
    }
  };

  const renderBatchCard = (b: Batch) => {
    const enrolledCount = batchTraineesMap[b.id] || 0;
    const capacity = b.maxTrainees || 30;
    const capacityPercent = Math.min(100, Math.round((enrolledCount / capacity) * 100));

    const now = Date.now();
    const start = b.startDate || now;
    const end = b.endDate || now + 180 * 86400000;
    const totalDays = Math.max(1, Math.round((end - start) / 86400000));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now - start) / 86400000)));
    const timelinePercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    return (
      <div 
        key={b.id} 
        className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md hover:border-emerald-300/80 space-y-4"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shadow-2xs">
                <Layers size={22} />
              </div>
              <div>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 inline-block">
                  {b.batchCode || b.id}
                </span>
                {b.fiscalYear && (
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    অর্থবছর: {b.fiscalYear}
                  </span>
                )}
              </div>
            </div>
            <div>
              {renderStatusBadge(b.status)}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-1">
              {b.name}
            </h3>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold mt-1">
              <Wrench size={13} className="shrink-0" />
              <span className="truncate">{getTradeName(b.tradeId)}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-0.5">
              <Building2 size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{getInstituteName(b.instituteId)}</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center space-x-1">
                <Users size={13} />
                <span>ভর্তি শিক্ষার্থী:</span>
              </span>
              <span className="font-bold text-slate-800">
                <strong className="text-emerald-700">{toBn(enrolledCount)}</strong> / {toBn(capacity)} জন ({toBn(capacityPercent)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${capacityPercent}%` }}
                className={`h-full rounded-full transition-all duration-300 ${
                  capacityPercent >= 100 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center space-x-1">
                <Calendar size={12} />
                <span>মেয়াদ:</span>
              </span>
              <span className="font-medium text-slate-700">
                {safeFormatDate(b.startDate, 'dd MMM yy')} - {safeFormatDate(b.endDate, 'dd MMM yy')}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>অগ্রগতি:</span>
              <span>{toBn(elapsedDays)} / {toBn(totalDays)} দিন ({toBn(timelinePercent)}%)</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${timelinePercent}%` }}
                className="bg-blue-600 h-full rounded-full"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-1.5">
              <span className="text-[9px] font-bold text-emerald-800 uppercase block">স্কিল ট্রেইনার</span>
              <span className="font-semibold text-slate-800 truncate block" title={b.skillTrainerName || 'অনির্ধারিত'}>
                {b.skillTrainerName || 'অনির্ধারিত'}
              </span>
            </div>
            <div className="bg-sky-50/70 border border-sky-200/60 rounded-lg p-1.5">
              <span className="text-[9px] font-bold text-sky-800 uppercase block">লিটারেসি ট্রেইনার</span>
              <span className="font-semibold text-slate-800 truncate block" title={b.literacyTrainerName || 'অনির্ধারিত'}>
                {b.literacyTrainerName || 'অনির্ধারিত'}
              </span>
            </div>
          </div>

          {b.status === 'Cancelled' && b.cancellationReason && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 flex items-start space-x-1.5">
              <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-600" />
              <span>বাতিলের কারণ: {b.cancellationReason}</span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={() => setViewingBatch(b)}
            className="px-2.5 py-1 text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg font-semibold transition flex items-center space-x-1 cursor-pointer"
          >
            <Eye size={13} />
            <span>বিস্তারিত</span>
          </button>

          <div className="flex items-center space-x-1.5">
            {canEdit && (
              <button
                onClick={() => handleOpenModal(b)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="ব্যাচ সম্পাদন করুন"
              >
                <Edit2 size={15} />
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => handleDeleteRequest(b)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                title="ব্যাচ মুছে ফেলা বা আর্কাইভ করুন"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-8 w-64 bg-slate-200/80 rounded animate-pulse" />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ======================================================== */}
      {/* 1. HEADER BANNER & ACTION BAR                            */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 mb-1">
            <span>উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)</span>
            <span>•</span>
            <span>প্রশিক্ষণ ব্যাচ ও শিক্ষার্থী পরিচালনা</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            প্রশিক্ষণ ব্যাচ (Training Batches)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            প্রতিষ্ঠান ও ট্রেড অনুযায়ী বরাদ্দকৃত ব্যাচের সময়সূচি, আসন সংখ্যা ও অগ্রগতি
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition flex items-center space-x-1 shadow-2xs"
            title="তথ্য রিফ্রেশ করুন"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">রিফ্রেশ</span>
          </button>



          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-sm font-bold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20"
            >
              <Plus size={18} />
              <span>নতুন ব্যাচ যুক্ত করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SECTION TAB NAVIGATION: BATCHES VS ACTIVITY LOGS     */}
      {/* ======================================================== */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveMainTab('batches')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center space-x-2 ${
              activeMainTab === 'batches'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers size={16} className={activeMainTab === 'batches' ? 'text-emerald-600' : 'text-slate-400'} />
            <span>প্রশিক্ষণ ব্যাচসমূহ</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              activeMainTab === 'batches' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {toBn(batches.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('activity_logs')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center space-x-2 ${
              activeMainTab === 'activity_logs'
                ? 'bg-white text-purple-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Activity size={16} className={activeMainTab === 'activity_logs' ? 'text-purple-600' : 'text-slate-400'} />
            <span>অ্যাক্টিভিটি লগ (জবাবদিহিতা)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              activeMainTab === 'activity_logs' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {toBn(progressLogs.length)}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeMainTab === 'activity_logs' ? (
            <>
              <button
                type="button"
                onClick={exportActivityLogsCSV}
                disabled={filteredProgressLogs.length === 0 || exportingLogs}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                title="লগ ডেটা CSV ফরম্যাটে এক্সপোর্ট করুন"
              >
                <Download size={14} />
                <span>{exportingLogs ? 'সংরক্ষণ হচ্ছে...' : 'CSV এক্সপোর্ট'}</span>
              </button>
              {progressLogs.length === 0 && (
                <button
                  onClick={handleSeedSampleActivityLogs}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>নমুনা লগ যোগ করুন</span>
                </button>
              )}
              {SHOW_CALENDAR_MODULES && (
                <Link
                  to="/shikhon-calendar"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <BookOpen size={14} />
                  <span>শিখন ক্যালেন্ডারে যান</span>
                </Link>
              )}
            </>
          ) : (
            <>
              {SHOW_CALENDAR_MODULES && (
                <>
                  <Link
                    to="/trade-calendar"
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <BookOpen size={14} />
                    <span>ট্রেড কারিকুলাম</span>
                  </Link>
                  <Link
                    to="/shikhon-calendar"
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <Calendar size={14} />
                    <span>শিখন ক্যালেন্ডার</span>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BATCH MANAGEMENT VIEW                             */}
      {/* ======================================================== */}
      {activeMainTab === 'batches' && (
        <div className="space-y-6">
          {/* ======================================================== */}
          {/* 3. SUMMARY KPI METRIC CARDS                              */}
          {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">মোট ব্যাচ</span>
            <h4 className="text-2xl font-black text-slate-800">{toBn(stats.total)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">চলমান</span>
            <h4 className="text-2xl font-black text-emerald-700">{toBn(stats.active)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">আসন্ন</span>
            <h4 className="text-2xl font-black text-blue-700">{toBn(stats.upcoming)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">সম্পন্ন</span>
            <h4 className="text-2xl font-black text-slate-700">{toBn(stats.completed)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Archive size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">আর্কাইভ/বাতিল</span>
            <h4 className="text-2xl font-black text-purple-900">{toBn(stats.archived + stats.cancelled)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">মোট শিক্ষার্থী</span>
            <h4 className="text-2xl font-black text-teal-800">{toBn(stats.totalEnrolled)}</h4>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. TABLE TOOLBAR (GROUP BY | SEARCH + FILTER + COLUMNS)  */}
      {/* ======================================================== */}
      <DataTableToolbar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
        searchPlaceholder="ব্যাচের নাম, কোড, প্রতিষ্ঠান বা ট্রেড..."
        groupBy={groupBy}
        onGroupByChange={(val) => setGroupBy(val)}
        groupByOptions={BATCH_GROUP_BY_OPTIONS}
        groupByLabel="গ্রুপ করুন (Group by)"
        filterCount={activeFilterChips.length}
        onClearAllFilters={handleClearFilters}
        activeFilterChips={activeFilterChips}
        renderFilterContent={(close) => (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">প্রশিক্ষণ প্রতিষ্ঠান:</label>
              <select
                value={filterInstitute}
                onChange={e => { setFilterInstitute(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="all">সকল প্রতিষ্ঠান ({toBn(institutes.length)}টি)</option>
                {institutes.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">বৃত্তিমূলক ট্রেড:</label>
              <select
                value={filterTrade}
                onChange={e => { setFilterTrade(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="all">সকল ট্রেড ({toBn(trades.length)}টি)</option>
                {trades.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">অবস্থা (Status):</label>
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="all">সকল অবস্থা</option>
                  <option value="Active">চলমান (Active)</option>
                  <option value="Upcoming">আসন্ন (Upcoming)</option>
                  <option value="Completed">সম্পন্ন (Completed)</option>
                  <option value="Archived">আর্কাইভকৃত (Archived)</option>
                  <option value="Cancelled">বাতিলকৃত (Cancelled)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">অর্থবছর:</label>
                <select
                  value={filterFiscalYear}
                  onChange={e => { setFilterFiscalYear(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="all">সকল অর্থবছর</option>
                  {FISCAL_YEARS.map(fy => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        columns={columns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        extraActions={
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-2.5 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <ArrowUpDown size={13} className="text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer pr-1"
                title="সাজানোর ক্রম"
              >
                <option value="code_asc">ব্যাচ কোড</option>
                <option value="date_desc">শুরুর তারিখ</option>
                <option value="trainees_desc">শিক্ষার্থী সংখ্যা</option>
                <option value="name_asc">ব্যাচের নাম</option>
              </select>
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 h-9">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-7 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="টেবিল ভিউ"
              >
                <TableIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`h-7 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="কার্ড ভিউ"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        }
      />

      {/* ======================================================== */}
      {/* 4. BATCHES GRID (RESPONSIVE CARDS)                       */}
      {/* ======================================================== */}
      {processedBatches.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
          <Layers size={36} className="mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-sm">কোনো প্রশিক্ষণ ব্যাচ পাওয়া যায়নি</p>
          <p className="text-slate-500">
            {searchTerm || filterInstitute !== 'all' || filterTrade !== 'all' || filterStatus !== 'all'
              ? 'আপনার ফিল্টারের সাথে মিলে এমন কোনো ব্যাচ নেই। ফিল্টার পরিবর্তন করে দেখুন।'
              : 'সিস্টেমে এখনো কোনো ব্যাচ তৈরি করা হয়নি।'}
          </p>
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="mt-2 inline-flex items-center space-x-1 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              <Plus size={15} />
              <span>নতুন ব্যাচ যুক্ত করুন</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  {isColVisible('batchCode') && <th className="px-4 py-3.5">ব্যাচ কোড</th>}
                  {isColVisible('name') && <th className="px-4 py-3.5">ব্যাচের নাম</th>}
                  {isColVisible('instituteTrade') && <th className="px-4 py-3.5">প্রতিষ্ঠান ও ট্রেড</th>}
                  {isColVisible('dates') && <th className="px-4 py-3.5">মেয়াদ ও অর্থবছর</th>}
                  {isColVisible('trainees') && <th className="px-4 py-3.5">ভর্তি / আসন</th>}
                  {isColVisible('trainers') && <th className="px-4 py-3.5">প্রশিক্ষকগণ</th>}
                  {isColVisible('status') && <th className="px-4 py-3.5 text-center">স্ট্যাটাস</th>}
                  {isColVisible('actions') && <th className="px-4 py-3.5 text-right">পদক্ষেপ</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {groupBy !== 'none' && groupedBatches ? (
                  groupedBatches.map(grp => {
                    const isCollapsed = collapsedGroups.has(grp.key);
                    return (
                      <React.Fragment key={grp.key}>
                        <tr className="bg-slate-100/80 hover:bg-slate-100 border-y border-slate-200 font-bold transition">
                          <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => toggleGroupCollapse(grp.key)}
                                className="flex items-center space-x-2 text-slate-800 hover:text-emerald-700 cursor-pointer"
                              >
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                <span className="text-xs sm:text-sm font-bold">{grp.title}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                  {toBn(grp.items.length)}টি ব্যাচ
                                </span>
                              </button>
                              <span className="text-[11px] text-slate-400">
                                মোটের {toBn(Math.round((grp.items.length / (processedBatches.length || 1)) * 100))}%
                              </span>
                            </div>
                          </td>
                        </tr>

                        {!isCollapsed && grp.items.map(b => {
                          const enrolledCount = batchTraineesMap[b.id] || 0;
                          const capacity = b.maxTrainees || 30;
                          return (
                            <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                              {isColVisible('batchCode') && (
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                                    {b.batchCode || b.id}
                                  </span>
                                </td>
                              )}
                              {isColVisible('name') && (
                                <td className="px-4 py-3.5">
                                  <div className="font-bold text-slate-800 text-xs">{b.name}</div>
                                </td>
                              )}
                              {isColVisible('instituteTrade') && (
                                <td className="px-4 py-3.5">
                                  <div className="font-semibold text-emerald-700">{getTradeName(b.tradeId)}</div>
                                  <div className="text-[11px] text-slate-500">{getInstituteName(b.instituteId)}</div>
                                </td>
                              )}
                              {isColVisible('dates') && (
                                <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                                  <div>{safeFormatDate(b.startDate, 'dd/MM/yy')} - {safeFormatDate(b.endDate, 'dd/MM/yy')}</div>
                                  {b.fiscalYear && <div className="text-[10px] text-slate-400">{b.fiscalYear}</div>}
                                </td>
                              )}
                              {isColVisible('trainees') && (
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span className="font-bold text-emerald-700">{toBn(enrolledCount)}</span> / {toBn(capacity)} জন
                                </td>
                              )}
                              {isColVisible('trainers') && (
                                <td className="px-4 py-3.5 text-slate-600">
                                  <div className="truncate max-w-[140px] text-[11px]">{b.skillTrainerName || 'স্কিল ট্রেইনার নেই'}</div>
                                  <div className="truncate max-w-[140px] text-[10px] text-slate-400">{b.literacyTrainerName || 'লিটারেসি ট্রেইনার নেই'}</div>
                                </td>
                              )}
                              {isColVisible('status') && (
                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                  {renderStatusBadge(b.status)}
                                </td>
                              )}
                              {isColVisible('actions') && (
                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-1">
                                    <button
                                      onClick={() => setViewingBatch(b)}
                                      className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition"
                                      title="বিস্তারিত দেখুন"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    {canEdit && (
                                      <button
                                        onClick={() => handleOpenModal(b)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="সম্পাদনা"
                                      >
                                        <Edit2 size={15} />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => handleDeleteRequest(b)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="মুছুন বা সংরক্ষণাগার"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  paginatedBatches.map(b => {
                    const enrolledCount = batchTraineesMap[b.id] || 0;
                    const capacity = b.maxTrainees || 30;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        {isColVisible('batchCode') && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                              {b.batchCode || b.id}
                            </span>
                          </td>
                        )}
                        {isColVisible('name') && (
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800 text-xs">{b.name}</div>
                          </td>
                        )}
                        {isColVisible('instituteTrade') && (
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-emerald-700">{getTradeName(b.tradeId)}</div>
                            <div className="text-[11px] text-slate-500">{getInstituteName(b.instituteId)}</div>
                          </td>
                        )}
                        {isColVisible('dates') && (
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                            <div>{safeFormatDate(b.startDate, 'dd/MM/yy')} - {safeFormatDate(b.endDate, 'dd/MM/yy')}</div>
                            {b.fiscalYear && <div className="text-[10px] text-slate-400">{b.fiscalYear}</div>}
                          </td>
                        )}
                        {isColVisible('trainees') && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-bold text-emerald-700">{toBn(enrolledCount)}</span> / {toBn(capacity)} জন
                          </td>
                        )}
                        {isColVisible('trainers') && (
                          <td className="px-4 py-3.5 text-slate-600">
                            <div className="truncate max-w-[140px] text-[11px]">{b.skillTrainerName || 'স্কিল ট্রেইনার নেই'}</div>
                            <div className="truncate max-w-[140px] text-[10px] text-slate-400">{b.literacyTrainerName || 'লিটারেসি ট্রেইনার নেই'}</div>
                          </td>
                        )}
                        {isColVisible('status') && (
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(b.status)}
                          </td>
                        )}
                        {isColVisible('actions') && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => setViewingBatch(b)}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition"
                                title="বিস্তারিত দেখুন"
                              >
                                <Eye size={15} />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={() => handleOpenModal(b)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="সম্পাদনা"
                                >
                                  <Edit2 size={15} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteRequest(b)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="মুছুন বা সংরক্ষণাগার"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        groupBy !== 'none' && groupedBatches ? (
          <div className="space-y-6">
            {groupedBatches.map(grp => {
              const isCollapsed = collapsedGroups.has(grp.key);
              return (
                <div key={grp.key} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-4">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(grp.key)}
                    className="w-full flex items-center justify-between text-left hover:text-emerald-700 transition cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      <span className="font-bold text-slate-800 text-sm sm:text-base">{grp.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        {toBn(grp.items.length)}টি ব্যাচ
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      মোটের {toBn(Math.round((grp.items.length / (processedBatches.length || 1)) * 100))}%
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {grp.items.map(b => renderBatchCard(b))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedBatches.map(b => renderBatchCard(b))}
          </div>
        )
      )}

      {/* ======================================================== */}
      {/* 5. PAGINATION CONTROLS                                    */}
      {/* ======================================================== */}
      {totalPages > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            মোট {toBn(processedBatches.length)}টি ব্যাচের মধ্যে {toBn((currentPage - 1) * ITEMS_PER_PAGE + 1)} থেকে {toBn(Math.min(currentPage * ITEMS_PER_PAGE, processedBatches.length))} প্রদর্শিত হচ্ছে
          </span>

          <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <div className="flex items-center space-x-1 shrink-0 min-w-max">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="shrink-0 p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                title="পূর্ববর্তী পৃষ্ঠা"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`shrink-0 w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === p
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {toBn(p)}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="shrink-0 p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                title="পরবর্তী পৃষ্ঠা"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TRAINER ACTIVITY LOG (ACCOUNTABILITY TAB)         */}
      {/* ======================================================== */}
      {activeMainTab === 'activity_logs' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ACCOUNTABILITY BANNER */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-xs font-semibold">
                  জবাবদিহিতা ও অডিট ট্রেইল (Accountability & Audit Trail)
                </span>
                <span className="text-xs text-purple-300">•</span>
                <span className="text-xs text-purple-200 font-medium">রিয়েলটাইম ট্রেইনার আপডেট</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                প্রশিক্ষক কর্তৃক প্রশিক্ষণ মডিউল সম্পন্নকরণ অ্যাক্টিভিটি লগ
              </h3>
              <p className="text-xs text-purple-200/90 max-w-2xl leading-relaxed">
                স্কিল ট্রেইনার ও লিটারেসি ট্রেইনারগণ কোনো মডিউল সম্পন্ন মার্ক করলে তা স্বয়ংক্রিয়ভাবে তারিখ, সময়, ব্যাচ, ট্রেড ও ট্রেইনার পরিচিতি সহ অডিট রেকর্ডে লিপিবদ্ধ হয়।
              </p>
            </div>

            {SHOW_CALENDAR_MODULES && (
              <div className="flex items-center space-x-2 shrink-0">
                <Link
                  to="/shikhon-calendar"
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>শিখন ক্যালেন্ডার দেখুন</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            )}
          </div>

          {/* 4 ACCOUNTABILITY METRIC CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                <Activity size={20} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">মোট লগ রেকর্ড</span>
                <h4 className="text-2xl font-black text-slate-800">{toBn(progressLogs.length)}</h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">স্কিল মডিউল আপডেট</span>
                <h4 className="text-2xl font-black text-emerald-700">
                  {toBn(progressLogs.filter(l => l.moduleType === 'skill').length)}
                </h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">লিটারেসি মডিউল আপডেট</span>
                <h4 className="text-2xl font-black text-blue-700">
                  {toBn(progressLogs.filter(l => l.moduleType === 'literacy').length)}
                </h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <UserCheck size={20} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">রিপোর্টিং ট্রেইনার</span>
                <h4 className="text-2xl font-black text-amber-700">{toBn(reportingTrainers.length)} জন</h4>
              </div>
            </div>
          </div>

          {/* ADVANCED MULTI-FILTER TOOLBAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="পাঠের শিরোনাম, বিষয়, কাজ নং, ব্যাচ, ট্রেইনারের নাম/আইডি বা মন্তব্য দিয়ে খুঁজুন..."
                  value={logSearchQuery}
                  onChange={(e) => {
                    setLogSearchQuery(e.target.value);
                    setLogCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Batch Selector Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
                  <Layers size={13} className="text-slate-400" />
                  <select
                    value={logSelectedBatch}
                    onChange={(e) => {
                      setLogSelectedBatch(e.target.value);
                      setLogCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-slate-700 font-semibold focus:outline-hidden cursor-pointer max-w-[160px] truncate"
                  >
                    <option value="all">সকল ব্যাচ ({toBn(batches.length)})</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batchCode || b.id} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Module Type Selector Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
                  <Filter size={13} className="text-slate-400" />
                  <select
                    value={logModuleType}
                    onChange={(e) => {
                      setLogModuleType(e.target.value as any);
                      setLogCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">সকল মডিউল ধরন</option>
                    <option value="skill">স্কিল ফোকাসড (Skill)</option>
                    <option value="literacy">লিটারেসি ফোকাসড (Literacy)</option>
                  </select>
                </div>

                {/* Trainer Selector Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
                  <Users size={13} className="text-slate-400" />
                  <select
                    value={logTrainerFilter}
                    onChange={(e) => {
                      setLogTrainerFilter(e.target.value);
                      setLogCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-slate-700 font-semibold focus:outline-hidden cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="all">সকল প্রশিক্ষক</option>
                    {reportingTrainers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
                  <select
                    value={logStatusFilter}
                    onChange={(e) => {
                      setLogStatusFilter(e.target.value as any);
                      setLogCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">সকল অবস্থা</option>
                    <option value="completed">সম্পন্ন (Completed)</option>
                    <option value="cancelled">বাতিল / অসম্পূর্ণ</option>
                  </select>
                </div>

                {/* Reset Filters */}
                {(logSearchQuery || logSelectedBatch !== 'all' || logModuleType !== 'all' || logTrainerFilter !== 'all' || logStatusFilter !== 'all') && (
                  <button
                    onClick={resetLogFilters}
                    className="p-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-semibold transition cursor-pointer"
                    title="সকল ফিল্টার রিসেট করুন"
                  >
                    রিসেট
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVITY LOGS AUDIT TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {filteredProgressLogs.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Activity size={48} className="mx-auto text-slate-300" />
                <h3 className="text-lg font-bold text-slate-700">কোনো অ্যাক্টিভিটি লগ পাওয়া যায়নি</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  {progressLogs.length === 0
                    ? 'এখনো কোনো ট্রেইনার মডিউল সম্পন্ন করার তথ্য মার্ক করেননি। ট্রেইনারগণ কাজ সম্পন্ন মার্ক করলে স্বয়ংক্রিয়ভাবে এখানে লগ চলে আসবে।'
                    : 'আপনার নির্বাচিত ফিল্টারের শর্ত অনুযায়ী কোনো অ্যাক্টিভিটি লগ মিলছে না। অনুগ্রহ করে ফিল্টার পরিবর্তন বা রিসেট করুন।'}
                </p>
                <div className="flex items-center justify-center space-x-2 pt-2">
                  {(logSearchQuery || logSelectedBatch !== 'all' || logModuleType !== 'all' || logTrainerFilter !== 'all' || logStatusFilter !== 'all') ? (
                    <button
                      onClick={resetLogFilters}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      ফিল্টার রিসেট করুন
                    </button>
                  ) : (
                    <button
                      onClick={handleSeedSampleActivityLogs}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                    >
                      <Sparkles size={14} />
                      <span>পরীক্ষামূলক নমুনা লগ তৈরি করুন</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">তারিখ ও সময়</th>
                      <th className="py-3 px-4">ব্যাচ ও ট্রেড</th>
                      <th className="py-3 px-4">প্রশিক্ষক (Trainer)</th>
                      <th className="py-3 px-4">কার্যদিবস ও কাজ</th>
                      <th className="py-3 px-4">পাঠের বিষয় / শিরোনাম</th>
                      <th className="py-3 px-4 text-center">স্থিতি</th>
                      <th className="py-3 px-4">মন্তব্য ও পর্যবেক্ষণ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {paginatedLogs.map((log) => {
                      const isSkill = log.moduleType === 'skill';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition">
                          {/* 1. Date & Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                              <Calendar size={13} className="text-slate-400 shrink-0" />
                              <span>{safeFormatDate(log.completedAt || log.createdAt, 'dd MMM yyyy')}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {log.createdAt ? format(new Date(log.createdAt), 'hh:mm a') : 'সময় সংরক্ষিত'}
                            </span>
                          </td>

                          {/* 2. Batch & Trade */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                                {batches.find(b => b.id === log.batchId)?.batchCode || log.batchId}
                              </span>
                              <span className="font-semibold text-slate-800 line-clamp-1">{log.batchName}</span>
                            </div>
                            <span className="text-[11px] text-emerald-700 block mt-0.5 font-medium line-clamp-1">
                              {log.tradeName || 'ট্রেড'}
                            </span>
                          </td>

                          {/* 3. Trainer */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-800">{log.trainerName || 'প্রশিক্ষক'}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                isSkill 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                                  : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              }`}>
                                {isSkill ? 'স্কিল প্রশিক্ষক' : 'লিটারেসি প্রশিক্ষক'}
                              </span>
                              {log.trainerId && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  ID: {log.trainerId}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Day & Task # */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-purple-700 block">
                              কার্যদিবস {toBn(log.dayNumber)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {log.taskNo || 'টাস্ক'}
                            </span>
                          </td>

                          {/* 5. Topic */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-semibold text-slate-800 line-clamp-2" title={log.topic}>
                              {log.topic || 'মডিউল পাঠ'}
                            </p>
                          </td>

                          {/* 6. Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {log.isCompleted ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span>সম্পন্ন</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                                <XCircle size={12} className="text-red-600" />
                                <span>বাতিল</span>
                              </span>
                            )}
                          </td>

                          {/* 7. Remarks */}
                          <td className="py-3.5 px-4 max-w-sm">
                            {log.remarks ? (
                              <span className="text-slate-600 italic block line-clamp-2" title={log.remarks}>
                                "{log.remarks}"
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">কোনো মন্তব্য নেই</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* LOGS PAGINATION BAR */}
            {totalLogPages > 1 && (
              <div className="bg-slate-50/70 p-3.5 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-500 font-medium">
                  মোট {toBn(filteredProgressLogs.length)}টি লগের মধ্যে {toBn((logCurrentPage - 1) * LOGS_PER_PAGE + 1)} থেকে {toBn(Math.min(logCurrentPage * LOGS_PER_PAGE, filteredProgressLogs.length))} প্রদর্শিত হচ্ছে
                </span>

                <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                  <div className="flex items-center space-x-1 shrink-0 min-w-max">
                    <button
                      onClick={() => setLogCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={logCurrentPage === 1}
                      className="shrink-0 p-1.5 sm:p-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                      title="পূর্ববর্তী পৃষ্ঠা"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalLogPages }).map((_, idx) => {
                      const p = idx + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setLogCurrentPage(p)}
                          className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-bold transition cursor-pointer ${
                            logCurrentPage === p
                              ? 'bg-purple-700 text-white shadow-2xs'
                              : 'border border-slate-200 hover:bg-white text-slate-700'
                          }`}
                        >
                          {toBn(p)}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setLogCurrentPage(prev => Math.min(prev + 1, totalLogPages))}
                      disabled={logCurrentPage === totalLogPages}
                      className="shrink-0 p-1.5 sm:p-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                      title="পরবর্তী পৃষ্ঠা"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. DETAILED BATCH VIEW MODAL (INSPECTOR)                  */}
      {/* ======================================================== */}
      {viewingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md">
                    {viewingBatch.batchCode || viewingBatch.id}
                  </span>
                  {renderStatusBadge(viewingBatch.status)}
                </div>
                <h2 className="text-xl font-bold text-slate-800 mt-1">
                  {viewingBatch.name}
                </h2>
              </div>
              <button onClick={() => setViewingBatch(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান):</span>
                <span className="text-slate-900 font-bold mt-0.5 block">{getInstituteName(viewingBatch.instituteId)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">বৃত্তিমূলক ট্রেড:</span>
                <span className="text-emerald-700 font-bold mt-0.5 block">{getTradeName(viewingBatch.tradeId)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">অর্থবছর ও কোর্সের সময়সীমা:</span>
                <span className="text-slate-900 font-bold mt-0.5 block">
                  {viewingBatch.fiscalYear || '২০২৫-২০২৬'} • {safeFormatDate(viewingBatch.startDate, 'dd MMM yyyy')} হতে {safeFormatDate(viewingBatch.endDate, 'dd MMM yyyy')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">আসন সংখ্যা ও বর্তমান ভর্তি:</span>
                <span className="text-slate-900 font-bold mt-0.5 block">
                  মোট আসন: {toBn(viewingBatch.maxTrainees || 30)} | বর্তমানে ভর্তি: <strong className="text-emerald-700">{toBn(batchTraineesMap[viewingBatch.id] || 0)} জন</strong>
                </span>
              </div>
            </div>

            {/* Enrolled Trainees List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা ({toBn(trainees.filter(t => t.batchId === viewingBatch.id).length)} জন)
                </h4>
                <Link
                  to={`/trainees/add?batchId=${viewingBatch.id}`}
                  className="text-xs text-emerald-700 font-semibold hover:underline flex items-center space-x-1"
                >
                  <UserPlus size={13} />
                  <span>নতুন ভর্তি</span>
                </Link>
              </div>

              {trainees.filter(t => t.batchId === viewingBatch.id).length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  এই ব্যাচে এখনো কোনো শিক্ষার্থী ভর্তি করা হয়নি।
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {trainees.filter(t => t.batchId === viewingBatch.id).map(t => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-800">{t.nameBn || t.nameEn}</span>
                        <span className="text-slate-400 font-mono text-[11px] ml-2">({t.traineeId})</span>
                        <span className="text-[11px] text-slate-500 block">{t.mobileNumber || 'মোবাইল নেই'} • {t.gender === 'Female' ? 'মহিলা' : 'পুরুষ'}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        t.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.status || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions in View Drawer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const bId = viewingBatch.id;
                    setLogSelectedBatch(bId);
                    setActiveMainTab('activity_logs');
                    setViewingBatch(null);
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title="এই ব্যাচের ট্রেইনারদের অগ্রগতি ও জবাবদিহিতা লগ দেখুন"
                >
                  <Activity size={14} />
                  <span>অ্যাক্টিভিটি লগ ({toBn(progressLogs.filter(l => l.batchId === viewingBatch.id).length)})</span>
                </button>
                {SHOW_CALENDAR_MODULES && (
                  <Link
                    to={`/shikhon-calendar?batchId=${viewingBatch.id}`}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                  >
                    <BookOpen size={14} />
                    <span>শিখন ক্যালেন্ডার</span>
                  </Link>
                )}
                <Link
                  to="/attendance"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <CalendarCheck size={14} />
                  <span>দৈনিক হাজিরা</span>
                </Link>
                <Link
                  to="/attendance-sheet"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <CalendarDays size={14} />
                  <span>মাসিক শিট</span>
                </Link>
              </div>

              <button
                onClick={() => setViewingBatch(null)}
                className="px-4 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. SAFE LIFECYCLE MODAL (ARCHIVE / CANCEL WORKFLOW)      */}
      {/* ======================================================== */}
      {safeLifecycleBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  ব্যাচটি স্থায়ীভাবে মুছে ফেলা নিষিদ্ধ (Referenced Batch Protection)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ঐতিহাসিক তথ্য ও শিক্ষার্থী রেকর্ডের অখণ্ডতা রক্ষা নীতি
                </p>
              </div>
              <button 
                onClick={() => setSafeLifecycleBatch(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-950">
              <p className="font-bold">
                "{safeLifecycleBatch.batch.name}" ব্যাচের সাথে নিম্নলিখিত রেকর্ড সংযুক্ত রয়েছে:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>ভর্তিকৃত শিক্ষার্থী: <strong>{toBn(safeLifecycleBatch.traineeCount)} জন</strong></li>
                <li>দৈনিক হাজিরা রেকর্ড: <strong>{toBn(safeLifecycleBatch.attendanceCount)} টি</strong></li>
                {safeLifecycleBatch.examCount > 0 && (
                  <li>পরীক্ষা ও ফলাফল রেকর্ড: <strong>{toBn(safeLifecycleBatch.examCount)} টি</strong></li>
                )}
              </ul>
              <p className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/80">
                ⚠️ এই ব্যাচটি স্থায়ীভাবে মুছে ফেললে সংশ্লিষ্ট সকল শিক্ষার্থীর সনদ ও উপস্থিতির রেকর্ড অকার্যকর হয়ে যাবে।
              </p>
            </div>

            {/* Lifecycle Action Options */}
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-bold text-slate-700">
                নিরাপদ সমাধান নির্বাচন করুন:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLifecycleAction('archive')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    lifecycleAction === 'archive'
                      ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <Archive size={16} className="text-purple-600" />
                    <span>১. আর্কাইভ করুন</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    কোর্স সম্পন্ন বা সংরক্ষণের জন্য। সমস্ত রেকর্ড অক্ষত থাকবে।
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLifecycleAction('cancel')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    lifecycleAction === 'cancel'
                      ? 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-600/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <Ban size={16} className="text-red-600" />
                    <span>২. ব্যাচ বাতিল করুন</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    অনিবার্য কারণে কার্যক্রম স্থগিত। কারণ অডিট লগে জমা থাকবে।
                  </span>
                </button>
              </div>

              {lifecycleAction === 'cancel' && (
                <div className="mt-2 space-y-1 animate-fadeIn">
                  <label className="block text-xs font-bold text-red-700">
                    বাতিলকরণের কারণ (আবশ্যক) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="যেমন: বাজেট বরাদ্দ স্থগিত / পর্যাপ্ত শিক্ষার্থী না থাকায় স্থগিত..."
                    value={cancellationReason}
                    onChange={e => setCancellationReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleForceDeleteBatch}
                disabled={!isDeletionAllowed}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 ${
                  !isDeletionAllowed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={!isDeletionAllowed ? 'সেটিংস থেকে ডাটা ডিলিট বন্ধ রাখা হয়েছে 🔒' : 'ব্যাচ ও সকল ডাটা স্থায়ীভাবে মুছে ফেলুন'}
              >
                <Trash2 size={13} />
                <span>{isDeletionAllowed ? 'স্থায়ীভাবে ব্যাচ ও সকল ডাটা মুছুন (Hard Delete)' : 'ডিলিট লক 🔒'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSafeLifecycleBatch(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLifecycleAction}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition ${
                    lifecycleAction === 'archive'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {lifecycleAction === 'archive' ? 'আর্কাইভ নিশ্চিত করুন' : 'বাতিল নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. CREATE / EDIT BATCH MODAL                             */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingBatch ? 'ব্যাচ তথ্য সম্পাদন (Edit Batch)' : 'নতুন প্রশিক্ষণ ব্যাচ তৈরি (New Batch)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  BNFE কেন্দ্র ও ট্রেড অনুযায়ী ব্যাচের সময়সূচি ও আসন নির্ধারণ করুন
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start space-x-2 animate-fadeIn">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{duplicateWarning}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Batch Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ব্যাচের নাম *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: কম্পিউটার ১ম ব্যাচ (জানু-জুন ২০২৬)"
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition ${
                    formErrors.name ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.name}</span>
                  </p>
                )}
              </div>

              {/* Batch Code & Fiscal Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      ব্যাচ কোড *
                    </label>
                    {!editingBatch && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, batchCode: generateSafeNextBatchCode(batches) })}
                        className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center space-x-0.5"
                      >
                        <Sparkles size={11} />
                        <span>অটো-জেনারেট</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: BAT-01"
                    value={formData.batchCode}
                    onChange={e => {
                      setFormData({ ...formData, batchCode: e.target.value });
                      if (formErrors.batchCode) setFormErrors({ ...formErrors, batchCode: '' });
                    }}
                    className={`w-full px-3.5 py-2.5 border font-mono font-bold rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase transition ${
                      formErrors.batchCode ? 'border-red-400 bg-red-50/40 text-red-900' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.batchCode && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} />
                      <span>{formErrors.batchCode}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    অর্থবছর *
                  </label>
                  <select
                    value={formData.fiscalYear}
                    onChange={e => {
                      setFormData({ ...formData, fiscalYear: e.target.value });
                      checkForDuplicates(formData.instituteId, formData.tradeId, e.target.value, formData.startDate, formData.endDate, editingBatch?.id);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {FISCAL_YEARS.map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Training Center / Institute */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান) *
                </label>
                <select
                  required
                  value={formData.instituteId}
                  onChange={e => {
                    const instId = e.target.value;
                    setFormData({ ...formData, instituteId: instId });
                    checkForDuplicates(instId, formData.tradeId, formData.fiscalYear, formData.startDate, formData.endDate, editingBatch?.id);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- প্রতিষ্ঠান নির্বাচন করুন --</option>
                  {institutes.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.code || i.id})</option>
                  ))}
                </select>
                {formErrors.instituteId && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.instituteId}</span>
                  </p>
                )}
              </div>

              {/* Vocational Trade */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বৃত্তিমূলক ট্রেড নির্বাচন *
                </label>
                <select
                  required
                  value={formData.tradeId}
                  onChange={e => {
                    const trdId = e.target.value;
                    setFormData({ ...formData, tradeId: trdId });
                    checkForDuplicates(formData.instituteId, trdId, formData.fiscalYear, formData.startDate, formData.endDate, editingBatch?.id);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- ট্রেড নির্বাচন করুন --</option>
                  {trades.map(t => {
                    const isInactive = t.status === 'Inactive';
                    const isCurrent = editingBatch && editingBatch.tradeId === t.id;
                    return (
                      <option 
                        key={t.id} 
                        value={t.id}
                        disabled={isInactive && !isCurrent}
                      >
                        {t.name} ({t.code}){isInactive ? ' - [নিষ্ক্রিয়: নতুন ব্যাচে বরাদ্দ অযোগ্য]' : ''}
                      </option>
                    );
                  })}
                </select>
                {formErrors.tradeId && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.tradeId}</span>
                  </p>
                )}
              </div>

              {/* Dual Trainer Assignment (Skill Trainer & Literacy Trainer) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-600" />
                    ব্যাচের দ্বৈত প্রশিক্ষক নির্ধারণ (Dual Trainer Assignment)
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">২ জন প্রশিক্ষক (স্কিল ও লিটারেসি)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Skill Trainer */}
                  <div>
                    <label className="block text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                      <Wrench size={12} className="text-emerald-600" />
                      <span>১. স্কিল ট্রেইনার (ট্রেড ভিত্তিক)</span>
                    </label>
                    <select
                      value={formData.skillTrainerId}
                      onChange={e => setFormData({ ...formData, skillTrainerId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- স্কিল ট্রেইনার নির্বাচন করুন --</option>
                      {users
                        .filter(u => u.role === 'Trainer' || u.trainerType === 'Skill Trainer')
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.trainerType ? `[${u.trainerType}]` : ''} ({u.phone || u.email})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Literacy Trainer */}
                  <div>
                    <label className="block text-xs font-semibold text-sky-800 mb-1 flex items-center gap-1">
                      <BookOpen size={12} className="text-sky-600" />
                      <span>২. লিটারেসি ট্রেইনার (জীবন দক্ষতা)</span>
                    </label>
                    <select
                      value={formData.literacyTrainerId}
                      onChange={e => setFormData({ ...formData, literacyTrainerId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- লিটারেসি ট্রেইনার নির্বাচন করুন --</option>
                      {users
                        .filter(u => u.role === 'Trainer' || u.trainerType === 'Literacy Trainer')
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.trainerType ? `[${u.trainerType}]` : ''} ({u.phone || u.email})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  * ট্রেইনারগণ নিজ নিজ মডিউল সম্পন্ন মার্ক করবেন। সমন্বিত ক্যালেন্ডার শুধুমাত্র কোর্স পরিচালক ও FMA পর্যবেক্ষণ করতে পারবেন।
                </p>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কোর্স শুরুর তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => {
                      const sDate = e.target.value;
                      setFormData({ ...formData, startDate: sDate });
                      checkForDuplicates(formData.instituteId, formData.tradeId, formData.fiscalYear, sDate, formData.endDate, editingBatch?.id);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {formErrors.startDate && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">
                      {formErrors.startDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কোর্স সমাপ্তির তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => {
                      const eDate = e.target.value;
                      setFormData({ ...formData, endDate: eDate });
                      checkForDuplicates(formData.instituteId, formData.tradeId, formData.fiscalYear, formData.startDate, eDate, editingBatch?.id);
                    }}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      formErrors.endDate ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.endDate && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">
                      {formErrors.endDate}
                    </p>
                  )}
                </div>
              </div>

              {/* Seat Capacity & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    সর্বোচ্চ আসন সংখ্যা (Capacity) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    required
                    value={formData.maxTrainees}
                    onChange={e => setFormData({ ...formData, maxTrainees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">BNFE মানদণ্ড: ৩০ জন শিক্ষার্থী প্রতি ব্যাচ</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ব্যাচের বর্তমান অবস্থা (Status) *
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Active">চলমান (Active)</option>
                    <option value="Upcoming">আসন্ন (Upcoming)</option>
                    <option value="Completed">সম্পন্ন (Completed)</option>
                    <option value="Archived">আর্কাইভকৃত (Archived)</option>
                    <option value="Cancelled">বাতিলকৃত (Cancelled)</option>
                  </select>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : editingBatch ? 'আপডেট সংরক্ষণ করুন' : 'ব্যাচ তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;
