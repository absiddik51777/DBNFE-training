import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Building2, 
  Wrench, 
  Users, 
  UserCheck, 
  Layers, 
  CalendarCheck, 
  UserX, 
  Award, 
  AlertCircle,
  PlusCircle,
  Clock,
  ArrowUpRight,
  Calendar,
  RefreshCw,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Printer,
  Download,
  AlertTriangle,
  Info,
  TrendingUp,
  FileSpreadsheet,
  Check,
  Shield,
  BookOpen,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle,
  Phone,
  ChevronLeft,
  Search,
  ExternalLink
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
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
  ExamMark, 
  ActivityLog 
} from '../types';
import { dataService } from '../lib/dataService';
import { safeFormatDate, toBn } from '../lib/dateUtils';

const COLORS = ['#059669', '#2563eb', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#ea580c'];

type DashboardTab = 'attendance' | 'activity';

const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission, isCourseDirector } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('attendance');

  // Core collections
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

  // Selected date for attendance (defaults to today)
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [batchFilter, setBatchFilter] = useState<'all' | 'pending' | 'low_attendance' | 'my_batch'>('all');
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  // Dropout Risk Table States
  const [dropoutSearch, setDropoutSearch] = useState('');
  const [dropoutRiskFilter, setDropoutRiskFilter] = useState<'all' | 'critical' | 'moderate' | 'warning' | 'dropped'>('all');
  const [dropoutBatchFilter, setDropoutBatchFilter] = useState<string>('all');
  const [dropoutPage, setDropoutPage] = useState(1);
  const [dropoutPageSize, setDropoutPageSize] = useState(5);

  // Admin view switcher to inspect/preview Trainer Dashboard
  const [adminViewMode, setAdminViewMode] = useState<'overview' | 'trainer'>('overview');
  const [adminSelectedBatchId, setAdminSelectedBatchId] = useState<string>('');

  // Initial load and Real-time Live Cloud Subscriptions
  useEffect(() => {
    fetchDashboardData(true);

    // Setup real-time live listeners on Firestore collections
    // When ANY user updates attendance, trainees, or batches in any center,
    // the Course Director's dashboard updates LIVE in real-time!
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

    const unsubActivities = dataService.subscribeCollection<ActivityLog>('activityLogs', (logs) => {
      setRecentActivities(logs.slice(0, 8));
      setLastSyncTime(new Date());
    });

    return () => {
      unsubAttendance();
      unsubTrainees();
      unsubBatches();
      unsubMarks();
      unsubActivities();
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
        marksList,
        activitiesList
      ] = await Promise.all([
        dataService.getItems<Institute>('institutes', forceFresh),
        dataService.getItems<Trade>('trades', forceFresh),
        dataService.getItems<Batch>('batches', forceFresh),
        dataService.getItems<Trainee>('trainees', forceFresh),
        dataService.getItems<AttendanceRecord>('attendance', forceFresh),
        dataService.getItems<Exam>('exams', forceFresh),
        dataService.getItems<ExamMark>('marks', forceFresh),
        dataService.getItems<ActivityLog>('activityLogs', forceFresh)
      ]);

      setInstitutes(institutesList);
      setTrades(tradesList);
      setBatches(batchesList);
      setTrainees(traineesList);
      setAttendance(attendanceList);
      setExams(examsList);
      setMarks(marksList);
      setRecentActivities(activitiesList.slice(0, 8));
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Notice loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Prominent Cloud Sync Handler
  const handleLiveSync = async () => {
    setSyncing(true);
    setSyncSuccessMsg('');
    try {
      const result = await dataService.syncAllFromCloud();
      setInstitutes(result.institutes);
      setTrades(result.trades);
      setBatches(result.batches);
      setTrainees(result.trainees);
      setAttendance(result.attendance);
      setExams(result.exams);
      setMarks(result.marks);
      setRecentActivities(result.activityLogs.slice(0, 8));
      
      const now = new Date();
      setLastSyncTime(now);
      setSyncSuccessMsg(`ক্লাউড ডাটাবেজ থেকে সকল তথ্য সফলভাবে সিঙ্ক করা হয়েছে (${format(now, 'hh:mm:ss a')})`);
      setTimeout(() => setSyncSuccessMsg(''), 4500);
    } catch (err) {
      console.warn("Live sync notice:", err);
      await fetchDashboardData(true);
    } finally {
      setTimeout(() => setSyncing(false), 400);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await handleLiveSync();
    setTimeout(() => setRefreshing(false), 450);
  };

  // Permissions & Role checks
  const canTakeAttendance = hasPermission('take_attendance');
  const canRegisterTrainee = hasPermission('create_trainee');
  const canManageBatches = hasPermission('view_batches');
  const canViewReports = hasPermission('view_reports');
  const isTrainer = userProfile?.role === 'Trainer';
  const trainerBatchId = userProfile?.batchId;
  const isTrainerView = isTrainer || adminViewMode === 'trainer';

  // Active batch for trainer view
  const activeTrainerBatch = useMemo(() => {
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
    // Admin in trainer mode
    if (adminSelectedBatchId) {
      const found = batches.find(b => b.id === adminSelectedBatchId);
      if (found) return found;
    }
    return batches[0] || null;
  }, [isTrainer, trainerBatchId, userProfile, batches, adminSelectedBatchId]);

  const activeTrainerBatchId = activeTrainerBatch?.id || '';

  // Dedicated Trainer Metrics (Scoped strictly to the assigned batch)
  const trainerMetrics = useMemo(() => {
    if (!activeTrainerBatch) return null;

    const bTrainees = trainees.filter(t => t.batchId === activeTrainerBatch.id && !t.isArchived);
    const totalEnrolled = bTrainees.length;
    const activeCount = bTrainees.filter(t => !t.status || t.status === 'Active').length;
    const droppedCount = bTrainees.filter(t => t.status === 'Dropped Out').length;
    const femaleCount = bTrainees.filter(t => t.gender === 'Female').length;
    const maleCount = bTrainees.filter(t => t.gender === 'Male').length;

    const bAttendance = attendance.filter(a => a.batchId === activeTrainerBatch.id);
    const todayRecs = bAttendance.filter(a => a.date === todayIso);
    const isTodayRecorded = todayRecs.length > 0;
    const todayPresent = todayRecs.filter(a => a.status === 'Present').length;
    const todayAbsent = todayRecs.filter(a => a.status === 'Absent').length;
    const todayLeave = todayRecs.filter(a => a.status === 'Leave').length;
    const todayTotal = todayPresent + todayAbsent;
    const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

    // Monthly attendance
    const now = new Date();
    const currentMonthPrefix = format(now, 'yyyy-MM');
    const monthRecs = bAttendance.filter(a => a.date && a.date.startsWith(currentMonthPrefix));
    const monthPresent = monthRecs.filter(a => a.status === 'Present').length;
    const monthAbsent = monthRecs.filter(a => a.status === 'Absent').length;
    const monthRecorded = monthPresent + monthAbsent;
    const monthRate = monthRecorded > 0 ? Math.round((monthPresent / monthRecorded) * 100) : 0;
    const monthDaysCount = new Set(monthRecs.map(a => a.date)).size;

    // Timeline
    const startDate = activeTrainerBatch.startDate || Date.now() - 30 * 86400000;
    const endDate = activeTrainerBatch.endDate || Date.now() + 150 * 86400000;
    const totalDays = Math.max(1, Math.round((endDate - startDate) / 86400000));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((Date.now() - startDate) / 86400000)));
    const timelinePercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    // Inst & Trade
    const instituteObj = institutes.find(i => i.id === activeTrainerBatch.instituteId);
    const tradeObj = trades.find(t => t.id === activeTrainerBatch.tradeId);

    // Batch exams
    const batchExams = exams.filter(e => e.batchId === activeTrainerBatch.id);

    return {
      batchId: activeTrainerBatch.id,
      batchName: activeTrainerBatch.name,
      capacity: activeTrainerBatch.maxTrainees || 30,
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
  }, [activeTrainerBatch, trainees, attendance, todayIso, institutes, trades, exams]);

  // Active batches list
  const activeBatchesList = useMemo(() => {
    return batches.filter(b => !b.status || b.status === 'Active');
  }, [batches]);

  // Aggregate Key Statistics (Using data from Firestore)
  const stats = useMemo(() => {
    const totalTrainees = trainees.length;
    const activeTrainees = trainees.filter(t => !t.status || t.status === 'Active').length;
    const droppedTrainees = trainees.filter(t => t.status === 'Dropped Out').length;
    const completedTrainees = trainees.filter(t => t.status === 'Completed').length;
    const activePercentage = totalTrainees > 0 ? Math.round((activeTrainees / totalTrainees) * 100) : 0;

    // Ongoing and status-wise batches
    const ongoingBatches = batches.filter(b => !b.status || b.status === 'Active');
    const upcomingBatches = batches.filter(b => b.status === 'Upcoming');
    const completedBatches = batches.filter(b => b.status === 'Completed');
    const ongoingCapacity = ongoingBatches.reduce((acc, b) => acc + (b.maxTrainees || 0), 0);

    // Current Month Attendance Calculations from Firestore
    const now = new Date();
    const currentMonthPrefix = format(now, 'yyyy-MM');
    const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const currentMonthName = `${BN_MONTHS[now.getMonth()]} ${toBn(now.getFullYear())}`;

    const currentMonthRecords = attendance.filter(a => a.date && a.date.startsWith(currentMonthPrefix));
    const currentMonthPresent = currentMonthRecords.filter(a => a.status === 'Present').length;
    const currentMonthAbsent = currentMonthRecords.filter(a => a.status === 'Absent').length;
    const currentMonthLeave = currentMonthRecords.filter(a => a.status === 'Leave').length;
    const currentMonthRecorded = currentMonthPresent + currentMonthAbsent;
    const currentMonthAttendanceRate = currentMonthRecorded > 0 
      ? Math.round((currentMonthPresent / currentMonthRecorded) * 100) 
      : 0;
    const currentMonthUniqueDays = new Set(currentMonthRecords.map(a => a.date)).size;

    // Today's attendance
    const todayRecords = attendance.filter(a => a.date === todayIso);
    const todayPresent = todayRecords.filter(a => a.status === 'Present').length;
    const todayAbsent = todayRecords.filter(a => a.status === 'Absent').length;
    const todayLeave = todayRecords.filter(a => a.status === 'Leave').length;
    const todayRecorded = todayPresent + todayAbsent;
    const todayAttendanceRate = todayRecorded > 0 ? Math.round((todayPresent / todayRecorded) * 100) : 0;

    // Exam Results
    const totalMarks = marks.length;
    const passedMarks = marks.filter(m => m.result === 'Pass').length;
    const failedMarks = marks.filter(m => m.result === 'Fail').length;
    const overallPassRate = totalMarks > 0 ? Math.round((passedMarks / totalMarks) * 100) : 0;

    return {
      totalInstitutes: institutes.length,
      totalTrades: trades.length,
      totalBatches: batches.length,
      activeBatches: activeBatchesList.length,
      ongoingBatchesCount: ongoingBatches.length,
      upcomingBatchesCount: upcomingBatches.length,
      completedBatchesCount: completedBatches.length,
      ongoingCapacity,
      totalTrainees,
      activeTrainees,
      activePercentage,
      droppedTrainees,
      completedTrainees,
      currentMonthPrefix,
      currentMonthName,
      currentMonthPresent,
      currentMonthAbsent,
      currentMonthLeave,
      currentMonthRecorded,
      currentMonthAttendanceRate,
      currentMonthRecordsTotal: currentMonthRecords.length,
      currentMonthUniqueDays,
      todayPresent,
      todayAbsent,
      todayLeave,
      todayAttendanceRate,
      todayRecordedTotal: todayRecords.length,
      totalExams: exams.length,
      totalMarks,
      passedMarks,
      failedMarks,
      overallPassRate,
    };
  }, [institutes, trades, batches, activeBatchesList, trainees, attendance, exams, marks, todayIso]);

  // Batch-wise attendance and timeline analytics
  const batchAttendanceStats = useMemo(() => {
    const now = Date.now();

    return batches.map(batch => {
      const batchTrainees = trainees.filter(t => t.batchId === batch.id && (!t.status || t.status === 'Active'));
      const totalEnrolled = batchTrainees.length;
      
      const recordsForDate = attendance.filter(a => a.batchId === batch.id && a.date === selectedDate);
      const present = recordsForDate.filter(a => a.status === 'Present').length;
      const absent = recordsForDate.filter(a => a.status === 'Absent').length;
      const leave = recordsForDate.filter(a => a.status === 'Leave').length;
      const recordedCount = recordsForDate.length;

      const rate = recordedCount > 0 
        ? Math.round((present / (present + absent || 1)) * 100) 
        : 0;

      // Cumulative overall attendance rate for this batch across all dates
      const allBatchAttendance = attendance.filter(a => a.batchId === batch.id);
      const totalBatchPresent = allBatchAttendance.filter(a => a.status === 'Present').length;
      const totalBatchAbsent = allBatchAttendance.filter(a => a.status === 'Absent').length;
      const totalBatchRecorded = totalBatchPresent + totalBatchAbsent;
      const cumulativeRate = totalBatchRecorded > 0 ? Math.round((totalBatchPresent / totalBatchRecorded) * 100) : 0;

      // Timeline calculation
      const startDate = batch.startDate || now - 30 * 86400000;
      const endDate = batch.endDate || now + 150 * 86400000;
      const totalDurationDays = Math.max(1, Math.round((endDate - startDate) / 86400000));
      const elapsedDays = Math.max(0, Math.min(totalDurationDays, Math.round((now - startDate) / 86400000)));
      const timelinePercent = Math.min(100, Math.round((elapsedDays / totalDurationDays) * 100));

      const instituteObj = institutes.find(i => i.id === batch.instituteId);
      const tradeObj = trades.find(t => t.id === batch.tradeId);

      // Check if attendance is pending for today
      const isTodayRecorded = attendance.some(a => a.batchId === batch.id && a.date === todayIso);

      return {
        batchId: batch.id,
        batchName: batch.name,
        instituteName: instituteObj?.name || 'প্রতিষ্ঠান',
        tradeName: tradeObj?.name || 'ট্রেড',
        totalEnrolled,
        capacity: batch.maxTrainees || 30,
        present,
        absent,
        leave,
        recordedCount,
        rate,
        cumulativeRate,
        isRecorded: recordedCount > 0,
        isTodayRecorded,
        status: batch.status || 'Active',
        startDate,
        endDate,
        totalDurationDays,
        elapsedDays,
        timelinePercent,
        isMyBatch: trainerBatchId ? batch.id === trainerBatchId : false,
      };
    });
  }, [batches, trainees, attendance, selectedDate, institutes, trades, todayIso, trainerBatchId]);

  // Selected date aggregate summary
  const selectedDateSummary = useMemo(() => {
    let totalPres = 0;
    let totalAbs = 0;
    let totalLev = 0;
    let totalRec = 0;

    batchAttendanceStats.forEach(b => {
      totalPres += b.present;
      totalAbs += b.absent;
      totalLev += b.leave;
      totalRec += b.recordedCount;
    });

    const overallRate = totalRec > 0 ? Math.round((totalPres / (totalPres + totalAbs || 1)) * 100) : 0;
    return { totalPres, totalAbs, totalLev, totalRec, overallRate };
  }, [batchAttendanceStats]);

  // Operational Exceptions & Actionable Alerts
  const actionableAlerts = useMemo(() => {
    const list: { id: string; title: string; desc: string; type: 'warning' | 'danger' | 'info'; linkText: string; linkUrl: string }[] = [];

    // 1. Batches with unrecorded attendance for TODAY
    const unrecordedTodayBatches = batchAttendanceStats.filter(b => b.status === 'Active' && !b.isTodayRecorded);
    if (unrecordedTodayBatches.length > 0) {
      list.push({
        id: 'unrecorded_attendance',
        title: `আজকের হাজিরা এন্ট্রি বাকি (${toBn(unrecordedTodayBatches.length)}টি ব্যাচ)`,
        desc: `${unrecordedTodayBatches.slice(0, 3).map(b => b.batchName).join(', ')}${unrecordedTodayBatches.length > 3 ? ' সহ অন্যান্য' : ''} ব্যাচের আজকের উপস্থিতি এখনো এন্ট্রি করা হয়নি।`,
        type: 'danger',
        linkText: 'হাজিরা গ্রহণ করুন',
        linkUrl: '/attendance'
      });
    }

    // 2. Batches with low cumulative attendance (< 75% BNFE standard)
    const lowAttendanceBatches = batchAttendanceStats.filter(b => b.status === 'Active' && b.cumulativeRate > 0 && b.cumulativeRate < 75);
    if (lowAttendanceBatches.length > 0) {
      list.push({
        id: 'low_attendance_batches',
        title: `ঝুঁকিপূর্ণ গড় উপস্থিতি সতর্কতা (${toBn(lowAttendanceBatches.length)}টি ব্যাচ)`,
        desc: `${lowAttendanceBatches.map(b => `${b.batchName} (${toBn(b.cumulativeRate)}%)`).join(', ')} ব্যাচের সামগ্রিক উপস্থিতি নূন্যতম ৭৫% এর নিচে রয়েছে।`,
        type: 'warning',
        linkText: 'রেজিস্টার খাতা দেখুন',
        linkUrl: '/attendance-sheet'
      });
    }

    // 3. Incomplete trainee profiles (missing mobile or NID/Birth cert)
    const incompleteTrainees = trainees.filter(t => !t.mobileNumber || !t.nidOrBirthRegistration);
    if (incompleteTrainees.length > 0) {
      list.push({
        id: 'incomplete_trainees',
        title: `অসম্পূর্ণ শিক্ষার্থী তথ্য (${toBn(incompleteTrainees.length)} জন)`,
        desc: `${toBn(incompleteTrainees.length)} জন প্রশিক্ষণার্থীর জন্ম নিবন্ধন / এনআইডি অথবা মোবাইল নম্বর অসম্পূর্ণ রয়েছে। সরকারি সনদের জন্য এটি জরুরি।`,
        type: 'info',
        linkText: 'প্রশিক্ষণার্থী তালিকা',
        linkUrl: '/trainees'
      });
    }

    // 4. Exams without marks
    const pendingExams = exams.filter(e => {
      const examMarks = marks.filter(m => m.examId === e.id);
      return examMarks.length === 0;
    });
    if (pendingExams.length > 0) {
      list.push({
        id: 'pending_exam_marks',
        title: `মূল্যায়ন নম্বর এন্ট্রি বাকি (${toBn(pendingExams.length)}টি পরীক্ষা)`,
        desc: `${pendingExams.map(e => e.name).slice(0, 2).join(', ')} পরীক্ষার প্রাপ্ত নম্বর এখনো ইনপুট করা হয়নি।`,
        type: 'warning',
        linkText: 'ফলাফল ও নম্বর এন্ট্রি',
        linkUrl: '/results'
      });
    }

    return list;
  }, [batchAttendanceStats, trainees, exams, marks]);

  // Filtered batches according to active filter
  const filteredBatches = useMemo(() => {
    return batchAttendanceStats.filter(b => {
      if (batchFilter === 'pending') return !b.isRecorded;
      if (batchFilter === 'low_attendance') return b.cumulativeRate < 75 && b.recordedCount > 0;
      if (batchFilter === 'my_batch') return b.isMyBatch;
      return true;
    });
  }, [batchAttendanceStats, batchFilter]);

  // Chart data for batch comparison
  const batchChartData = useMemo(() => {
    return batchAttendanceStats.slice(0, 8).map(b => ({
      name: b.batchName.length > 15 ? b.batchName.slice(0, 13) + '..' : b.batchName,
      fullName: b.batchName,
      উপস্থিত: b.present,
      অনুপস্থিত: b.absent,
      ছুটি: b.leave,
    }));
  }, [batchAttendanceStats]);

  // Trainees distribution by trade
  const tradeDistribution = useMemo(() => {
    const tradeMap: Record<string, number> = {};
    trainees.forEach(t => {
      const trade = trades.find(tr => tr.id === t.tradeId);
      const name = trade ? trade.name : 'অন্যান্য ট্রেড';
      tradeMap[name] = (tradeMap[name] || 0) + 1;
    });

    return Object.entries(tradeMap).map(([name, count]) => ({
      name,
      count,
      percent: trainees.length > 0 ? Math.round((count / trainees.length) * 100) : 0
    }));
  }, [trainees, trades]);

  // Trainer's specific batch summary
  const trainerBatch = useMemo(() => {
    if (!trainerBatchId) return null;
    return batchAttendanceStats.find(b => b.batchId === trainerBatchId);
  }, [trainerBatchId, batchAttendanceStats]);

  // Print executive summary handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV summary of batch attendance
  const handleExportCSV = () => {
    const headers = ['ব্যাচের নাম', 'ট্রেড', 'প্রতিষ্ঠান', 'মোট শিক্ষার্থী', 'উপস্থিত', 'অনুপস্থিত', 'ছুটি', 'উপস্থিতির হার (%)', 'তারিখ'];
    const rows = batchAttendanceStats.map(b => [
      `"${b.batchName.replace(/"/g, '""')}"`,
      `"${b.tradeName.replace(/"/g, '""')}"`,
      `"${b.instituteName.replace(/"/g, '""')}"`,
      b.totalEnrolled,
      b.present,
      b.absent,
      b.leave,
      `${b.rate}%`,
      selectedDate
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BNFE_Batch_Attendance_Summary_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auto-reset dropout pagination on filter or search changes
  useEffect(() => {
    setDropoutPage(1);
  }, [dropoutSearch, dropoutRiskFilter, dropoutBatchFilter, dropoutPageSize]);

  // Trainees at risk of dropout
  const dropoutRiskData = useMemo(() => {
    const candidateTrainees = isTrainerView && activeTrainerBatchId
      ? trainees.filter(t => t.batchId === activeTrainerBatchId && !t.isArchived)
      : trainees.filter(t => !t.isArchived);

    const relevantAttendance = isTrainerView && activeTrainerBatchId
      ? attendance.filter(a => a.batchId === activeTrainerBatchId)
      : attendance;

    const attendanceByTrainee: Record<string, { present: number; absent: number; leave: number; total: number }> = {};
    
    relevantAttendance.forEach(rec => {
      if (!rec.traineeId) return;
      if (!attendanceByTrainee[rec.traineeId]) {
        attendanceByTrainee[rec.traineeId] = { present: 0, absent: 0, leave: 0, total: 0 };
      }
      attendanceByTrainee[rec.traineeId].total += 1;
      if (rec.status === 'Present') attendanceByTrainee[rec.traineeId].present += 1;
      else if (rec.status === 'Absent') attendanceByTrainee[rec.traineeId].absent += 1;
      else if (rec.status === 'Leave') attendanceByTrainee[rec.traineeId].leave += 1;
    });

    const instituteMap = new Map(institutes.map(i => [i.id, i.name]));
    const batchMap = new Map(batches.map(b => [b.id, b.name]));
    const tradeMap = new Map(trades.map(t => [t.id, t.name]));

    const riskList = candidateTrainees
      .map(t => {
        const att = attendanceByTrainee[t.id] || { present: 0, absent: 0, leave: 0, total: 0 };
        const recordedCount = att.present + att.absent;
        const rate = recordedCount > 0 ? Math.round((att.present / recordedCount) * 100) : (t.status === 'Dropped Out' ? 0 : 100);

        // Determine if at risk
        const isDroppedOut = t.status === 'Dropped Out';
        const isLowAttendance = (recordedCount > 0 && rate < 75) || att.absent >= 3;
        const isRisk = isDroppedOut || isLowAttendance;

        // Risk level
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
          batchId: t.batchId,
          instituteId: t.instituteId,
          tradeId: t.tradeId,
          batchName: batchMap.get(t.batchId) || 'অনির্ধারিত ব্যাচ',
          instituteName: instituteMap.get(t.instituteId) || 'অনির্ধারিত কেন্দ্র',
          tradeName: tradeMap.get(t.tradeId) || 'ট্রেড',
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

    // Sort: dropped and critical risk first, then lowest attendance rate
    riskList.sort((a, b) => {
      const priorityOrder: Record<string, number> = { dropped: 1, critical: 2, moderate: 3, warning: 4 };
      const diff = (priorityOrder[a.riskLevel] || 9) - (priorityOrder[b.riskLevel] || 9);
      if (diff !== 0) return diff;
      return a.rate - b.rate;
    });

    return riskList;
  }, [trainees, attendance, institutes, batches, trades, isTrainerView, activeTrainerBatchId]);

  // Risk counts summary
  const dropoutRiskCounts = useMemo(() => {
    let critical = 0;
    let moderate = 0;
    let warning = 0;
    let dropped = 0;
    dropoutRiskData.forEach(item => {
      if (item.riskLevel === 'critical') critical += 1;
      else if (item.riskLevel === 'moderate') moderate += 1;
      else if (item.riskLevel === 'warning') warning += 1;
      else if (item.riskLevel === 'dropped') dropped += 1;
    });
    return { critical, moderate, warning, dropped, total: dropoutRiskData.length };
  }, [dropoutRiskData]);

  // Filtered Dropout Risk List
  const filteredDropoutList = useMemo(() => {
    return dropoutRiskData.filter(item => {
      if (dropoutSearch.trim()) {
        const query = dropoutSearch.toLowerCase().trim();
        const matchNameBn = item.nameBn?.toLowerCase().includes(query);
        const matchNameEn = item.nameEn?.toLowerCase().includes(query);
        const matchReg = item.registrationNumber?.toLowerCase().includes(query);
        const matchPhone = item.mobileNumber?.toLowerCase().includes(query);
        const matchBatch = item.batchName?.toLowerCase().includes(query);
        const matchInst = item.instituteName?.toLowerCase().includes(query);
        if (!matchNameBn && !matchNameEn && !matchReg && !matchPhone && !matchBatch && !matchInst) {
          return false;
        }
      }

      if (dropoutRiskFilter !== 'all' && item.riskLevel !== dropoutRiskFilter) {
        return false;
      }

      if (!isTrainerView && dropoutBatchFilter !== 'all' && item.batchId !== dropoutBatchFilter) {
        return false;
      }

      return true;
    });
  }, [dropoutRiskData, dropoutSearch, dropoutRiskFilter, dropoutBatchFilter, isTrainerView]);

  // Pagination calculations
  const totalDropoutPages = Math.max(1, Math.ceil(filteredDropoutList.length / dropoutPageSize));
  const currentDropoutPage = Math.min(dropoutPage, totalDropoutPages);
  const paginatedDropoutList = useMemo(() => {
    const startIndex = (currentDropoutPage - 1) * dropoutPageSize;
    return filteredDropoutList.slice(startIndex, startIndex + dropoutPageSize);
  }, [filteredDropoutList, currentDropoutPage, dropoutPageSize]);

  // Export CSV for dropout risk
  const exportDropoutRiskCSV = () => {
    const headers = [
      'ক্রমিক',
      'রেজিস্ট্রেশন নং',
      'নাম (বাংলা)',
      'নাম (ইংরেজি)',
      'মোবাইল নম্বর',
      'পিতা/অভিভাবক',
      'প্রতিষ্ঠান',
      'ট্রেড',
      'ব্যাচ',
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
      `"${(t.registrationNumber || '').replace(/"/g, '""')}"`,
      `"${(t.nameBn || '').replace(/"/g, '""')}"`,
      `"${(t.nameEn || '').replace(/"/g, '""')}"`,
      `"${(t.mobileNumber || '').replace(/"/g, '""')}"`,
      `"${(t.fatherNameBn || '').replace(/"/g, '""')}"`,
      `"${(t.instituteName || '').replace(/"/g, '""')}"`,
      `"${(t.tradeName || '').replace(/"/g, '""')}"`,
      `"${(t.batchName || '').replace(/"/g, '""')}"`,
      t.totalRecorded,
      t.present,
      t.absent,
      t.leave,
      `${t.rate}%`,
      t.riskLevel === 'dropped' ? 'ড্রপআউট' : t.riskLevel === 'critical' ? 'উচ্চ ঝুঁকি' : t.riskLevel === 'moderate' ? 'মাঝারি ঝুঁকি' : 'সতর্কতা',
      t.status
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BNFE_Dropout_Risk_Trainees_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reusable Dropout Risk Monitoring Paginated Table
  const renderDropoutRiskTable = (isPrimary: boolean = false) => {
    return (
      <div className={`bg-white rounded-2xl border shadow-xs overflow-hidden print:hidden space-y-0 ${
        isPrimary ? 'border-rose-300 ring-2 ring-rose-500/15' : 'border-rose-200/90'
      }`}>
        {/* Header bar */}
        <div className={`p-5 sm:p-6 border-b border-rose-100 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isPrimary 
            ? 'bg-gradient-to-r from-rose-100/90 via-rose-50/50 to-amber-50/60' 
            : 'bg-gradient-to-r from-rose-50/80 via-white to-amber-50/40'
        }`}>
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-xl text-white flex items-center justify-center font-bold shadow-xs shrink-0 ${
              isPrimary ? 'bg-rose-600 ring-4 ring-rose-200' : 'bg-rose-600'
            }`}>
              <UserX size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {isPrimary 
                    ? 'ঝরে পড়ার ঝুঁকিপূর্ণ শিক্ষার্থী পর্যবেক্ষণ • প্রাইমারি ড্যাশবোর্ড' 
                    : 'ঝরে পড়ার ঝুঁকিপূর্ণ শিক্ষার্থী পর্যবেক্ষণ'}
                </h2>
                {isPrimary ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-2xs">
                    ব্যাচের প্রধান অগ্রাধিকার
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 font-normal hidden sm:inline">(Dropout Risk Trainees)</span>
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {toBn(filteredDropoutList.length)} জন
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isPrimary
                  ? `${activeTrainerBatch?.name || 'নির্ধারিত ব্যাচের'} যেসকল শিক্ষার্থীর উপস্থিতি ৭৫% এর নিচে অথবা ৩ দিনের বেশি অনুপস্থিত রয়েছে, তাদের তাৎক্ষণিক কাউন্সেলিং ও যোগাযোগ নিশ্চিত করুন।`
                  : 'উপস্থিতির হার ৭৫% এর নিচে থাকা অথবা ড্রপআউট ঝুঁকিতে থাকা শিক্ষার্থীদের তালিকা ও জরুরি যোগাযোগ ব্যবস্থা'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={exportDropoutRiskCSV}
              disabled={filteredDropoutList.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-200 shadow-2xs disabled:opacity-50 cursor-pointer"
              title="ঝুঁকিপূর্ণ শিক্ষার্থীদের তালিকা সিএসভি ফাইলে ডাউনলোড করুন"
            >
              <Download size={14} className="text-rose-600" />
              <span>ঝুঁকি তালিকা এক্সপোর্ট</span>
            </button>
          </div>
        </div>

        {/* Quick summary status tags */}
        <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <span className="text-slate-500 font-medium">ঝুঁকির ধরন:</span>
          <button
            onClick={() => setDropoutRiskFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              dropoutRiskFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            সকল ({toBn(dropoutRiskCounts.total)})
          </button>
          <button
            onClick={() => setDropoutRiskFilter('critical')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              dropoutRiskFilter === 'critical'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>উচ্চ ঝুঁকি &lt; ৫০% ({toBn(dropoutRiskCounts.critical)})</span>
          </button>
          <button
            onClick={() => setDropoutRiskFilter('moderate')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              dropoutRiskFilter === 'moderate'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>মাঝারি ঝুঁকি ৫০-৬৪% ({toBn(dropoutRiskCounts.moderate)})</span>
          </button>
          <button
            onClick={() => setDropoutRiskFilter('warning')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              dropoutRiskFilter === 'warning'
                ? 'bg-yellow-600 text-white shadow-2xs'
                : 'bg-yellow-50 text-yellow-900 border border-yellow-200 hover:bg-yellow-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
            <span>সতর্কতা ৬৫-৭৪% ({toBn(dropoutRiskCounts.warning)})</span>
          </button>
          {dropoutRiskCounts.dropped > 0 && (
            <button
              onClick={() => setDropoutRiskFilter('dropped')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                dropoutRiskFilter === 'dropped'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
              <span>ড্রপআউট ({toBn(dropoutRiskCounts.dropped)})</span>
            </button>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
          <div className="flex-1 relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={dropoutSearch}
              onChange={e => setDropoutSearch(e.target.value)}
              placeholder="শিক্ষার্থীর নাম, আইডি, মোবাইল বা অভিভাবক খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            {dropoutSearch && (
              <button
                onClick={() => setDropoutSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap gap-2">
            {/* Show batch filter dropdown only for non-trainer general view */}
            {!isTrainerView && (
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-500">ব্যাচ:</span>
                <select
                  value={dropoutBatchFilter}
                  onChange={e => setDropoutBatchFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="all">সকল ব্যাচ</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Rows per page */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-500">প্রতি পৃষ্ঠায়:</span>
              <select
                value={dropoutPageSize}
                onChange={e => setDropoutPageSize(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value={5}>৫</option>
                <option value={10}>১০</option>
                <option value={15}>১৫</option>
                <option value={20}>২০</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {paginatedDropoutList.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {dropoutSearch || dropoutRiskFilter !== 'all' 
                  ? 'কোনো ঝুঁকিপূর্ণ শিক্ষার্থী পাওয়া যায়নি' 
                  : 'চমৎকার! বর্তমানে কোনো শিক্ষার্থী ঝরে পড়ার ঝুঁকিতে নেই'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {dropoutSearch || dropoutRiskFilter !== 'all'
                  ? 'আপনার সার্চ ফিল্টারের সাথে মিলে এমন কোনো শিক্ষার্থী নেই।'
                  : isPrimary
                  ? 'এই ব্যাচের সকল প্রশিক্ষণার্থীর উপস্থিতি সন্তোষজনক ও নিয়মিত রয়েছে।'
                  : 'সকল কেন্দ্রে প্রশিক্ষণার্থীদের উপস্থিতি ৭৫% বা তার উপরে রয়েছে।'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">প্রশিক্ষণার্থী</th>
                  {!isTrainerView && <th className="py-3 px-4">ব্যাচ ও কেন্দ্র</th>}
                  <th className="py-3 px-4">অভিভাবক ও যোগাযোগ</th>
                  <th className="py-3 px-4 text-center">উপস্থিতি বিবরণ</th>
                  <th className="py-3 px-4">উপস্থিতির হার</th>
                  <th className="py-3 px-4 text-center">ঝুঁকির স্তর</th>
                  <th className="py-3 px-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDropoutList.map((item, idx) => {
                  const globalIndex = (currentDropoutPage - 1) * dropoutPageSize + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition ${
                        item.riskLevel === 'dropped'
                          ? 'bg-slate-50/40'
                          : item.riskLevel === 'critical'
                          ? 'bg-rose-50/25'
                          : ''
                      }`}
                    >
                      {/* # Index */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {toBn(globalIndex)}
                      </td>

                      {/* Trainee Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.nameBn}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                              {item.nameBn ? item.nameBn.charAt(0) : 'শি'}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="font-bold text-slate-900 truncate">{item.nameBn || item.nameEn}</p>
                            <div className="flex items-center space-x-1 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                {item.registrationNumber}
                              </span>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] text-slate-500">
                                {item.gender === 'Female' ? 'নারী' : item.gender === 'Male' ? 'পুরুষ' : 'অন্যান্য'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Batch & Institute (Shown only in general overview) */}
                      {!isTrainerView && (
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800 leading-tight">{item.batchName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.tradeName}</p>
                          <p className="text-[10px] text-emerald-700 font-medium truncate">{item.instituteName}</p>
                        </td>
                      )}

                      {/* Contact & Guardian */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {item.fatherNameBn && (
                            <p className="text-[11px] text-slate-600">
                              পিতা: <span className="font-medium text-slate-800">{item.fatherNameBn}</span>
                            </p>
                          )}
                          {item.mobileNumber ? (
                            <div className="flex items-center space-x-1.5">
                              <a
                                href={`tel:${item.mobileNumber}`}
                                className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-mono font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded text-[11px] border border-emerald-200 transition"
                                title="সরাসরি কল করুন"
                              >
                                <Phone size={11} />
                                <span>{item.mobileNumber}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">মোবাইল নেই</span>
                          )}
                        </div>
                      </td>

                      {/* Attendance Breakdown */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200" title="উপস্থিত">
                            {toBn(item.present)} উ
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200" title="অনুপস্থিত">
                            {toBn(item.absent)} অ
                          </span>
                          {item.leave > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200" title="ছুটি">
                              {toBn(item.leave)} ছু
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">মোট ক্লাস: {toBn(item.totalRecorded)} দিন</p>
                      </td>

                      {/* Attendance Rate */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className={item.rate < 50 ? 'text-rose-700' : item.rate < 75 ? 'text-amber-700' : 'text-emerald-700'}>
                              {toBn(item.rate)}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (লক্ষ্যমাত্রা ৭৫%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.rate < 50 ? 'bg-rose-600' : item.rate < 65 ? 'bg-amber-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.min(100, item.rate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Risk Level Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {item.riskLevel === 'dropped' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            ড্রপআউট
                          </span>
                        ) : item.riskLevel === 'critical' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            উচ্চ ঝুঁকি
                          </span>
                        ) : item.riskLevel === 'moderate' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            মাঝারি ঝুঁকি
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
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
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                              title="অভিভাবক/শিক্ষার্থীকে কল দিন"
                            >
                              <Phone size={13} />
                            </a>
                          )}
                          <Link
                            to="/trainees"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition flex items-center space-x-1 text-xs font-semibold"
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
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              <span>মোট </span>
              <strong className="text-slate-900 font-bold">{toBn(filteredDropoutList.length)}</strong>
              <span> জন শিক্ষার্থীর মধ্যে </span>
              <strong className="text-slate-900 font-bold">
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
                  className="shrink-0 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                          <span className="shrink-0 px-1 text-slate-400">...</span>
                        )}
                        <button
                          onClick={() => setDropoutPage(page)}
                          className={`shrink-0 min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition ${
                            currentDropoutPage === page
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
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
                  className="shrink-0 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="পরবর্তী পৃষ্ঠা"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] text-slate-500">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-700">ড্যাশবোর্ড তথ্য লোড হচ্ছে...</p>
        <span className="text-xs text-slate-400 mt-1">সর্বশেষ তথ্য আপডেট হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* ======================================================== */}
      {/* 1. PROFESSIONAL EXECUTIVE DASHBOARD HEADER               */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  ড্যাশবোর্ড ওভারভিউ
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                  সক্রিয়
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                প্রশিক্ষণ কার্যক্রম, ব্যাচ হাজিরা ও সামগ্রিক পারফরম্যান্স ট্র্যাকিং
              </p>
            </div>
          </div>

          {/* Session & User Info */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="flex items-center space-x-1.5">
              <span>ব্যবহারকারী: <strong className="text-slate-900 font-semibold">{userProfile?.name}</strong></span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
              {userProfile?.role}
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center space-x-1">
              <Calendar size={13} className="text-slate-400" />
              <span>{safeFormatDate(new Date(), 'dd MMMM yyyy')}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 text-[11px]">
              সিঙ্ক: <span className="font-mono text-slate-600 font-semibold">{format(lastSyncTime, 'hh:mm a')}</span>
            </span>
            {syncSuccessMsg && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>{syncSuccessMsg}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0 print:hidden">
          <button
            onClick={handleRefresh}
            disabled={refreshing || syncing}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-200 shadow-2xs disabled:opacity-60 cursor-pointer"
            title="ডাটা রিফ্রেশ করুন"
          >
            <RefreshCw size={14} className={refreshing || syncing ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
            <span>{refreshing || syncing ? 'রিফ্রেশ হচ্ছে...' : 'রিফ্রেশ'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-200 shadow-2xs cursor-pointer"
            title="ড্যাশবোর্ড সারসংক্ষেপ প্রিন্ট করুন"
          >
            <Printer size={14} className="text-slate-500" />
            <span>প্রিন্ট</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-200 shadow-2xs cursor-pointer"
            title="হাজিরা সারাংশ সিএসভি এক্সপোর্ট করুন"
          >
            <Download size={14} className="text-slate-500" />
            <span>এক্সপোর্ট</span>
          </button>

          {canTakeAttendance && (
            <Link
              to="/attendance"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
            >
              <CalendarCheck size={14} />
              <span>হাজিরা এন্ট্রি</span>
            </Link>
          )}

          {canRegisterTrainee && (
            <Link
              to="/trainees/add"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
            >
              <PlusCircle size={14} />
              <span>নতুন ভর্তি</span>
            </Link>
          )}

          {/* Link to Dedicated Trainer Dashboard */}
          {(isCourseDirector || userProfile?.role === 'FMA' || isTrainer) && (
            <Link
              to="/trainer-dashboard"
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-indigo-200 shadow-2xs"
              title="প্রশিক্ষকদের জন্য তৈরি আলাদা ড্যাশবোর্ডে প্রবেশ করুন"
            >
              <UserCheck size={14} className="text-indigo-600" />
              <span>প্রশিক্ষক ড্যাশবোর্ড</span>
            </Link>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. ACTIONABLE EXCEPTIONS & OPERATIONAL ALERTS            */}
      {/* ======================================================== */}
      {actionableAlerts.length > 0 && !alertsDismissed && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden print:hidden">
          <div className="bg-amber-500/10 px-5 py-3 border-b border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center space-x-1.5">
                  <span>জরুরি করণীয় ও সতর্কতা</span>
                  <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-extrabold">
                    {toBn(actionableAlerts.length)}
                  </span>
                </h2>
                <p className="text-[11px] text-amber-800">
                  নিচের বিষয়গুলোতে তাৎক্ষণিক প্রশাসনিক ও একাডেমিক পদক্ষেপ গ্রহণ করা প্রয়োজন:
                </p>
              </div>
            </div>
            <button
              onClick={() => setAlertsDismissed(true)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-md"
              title="সাময়িক বন্ধ রাখুন"
            >
              লুকান
            </button>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {actionableAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5 ${
                  alert.type === 'danger'
                    ? 'bg-red-50/70 border-red-200 text-red-950'
                    : alert.type === 'warning'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-blue-50/70 border-blue-200 text-blue-950'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="truncate">{alert.title}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      alert.type === 'danger' ? 'bg-red-500' : alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}></span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {alert.desc}
                  </p>
                </div>

                <Link
                  to={alert.linkUrl}
                  className={`text-xs font-bold inline-flex items-center space-x-1 pt-1.5 border-t ${
                    alert.type === 'danger'
                      ? 'text-red-700 hover:text-red-800 border-red-200'
                      : alert.type === 'warning'
                      ? 'text-amber-800 hover:text-amber-900 border-amber-200'
                      : 'text-blue-700 hover:text-blue-800 border-blue-200'
                  }`}
                >
                  <span>{alert.linkText}</span>
                  <ChevronRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SUMMARY STATS CARD SECTION                            */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <BarChart3 size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-800">
                কার্যক্রম সারসংক্ষেপ ও অগ্রগতি সূচক
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              সক্রিয় প্রশিক্ষণার্থী, চলমান ব্যাচ ও দৈনিক-মাসিক উপস্থিতির সার্বিক পরিসংখ্যান
            </p>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs flex items-center space-x-1.5">
              <Calendar size={13} className="text-emerald-600" />
              <span>চলতি মাস: <strong className="text-slate-900 font-bold">{stats.currentMonthName}</strong></span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Total Active Trainees */}
          <Link 
            to="/trainees" 
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-500 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মোট সক্রিয় প্রশিক্ষণার্থী</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
                  <Users size={20} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    {toBn(stats.activeTrainees)}
                  </h3>
                  <span className="text-sm font-bold text-slate-500">জন সক্রিয়</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 ml-auto">
                    {toBn(stats.activePercentage)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, stats.activePercentage)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span>সর্বমোট নিবন্ধিত:</span>
                <strong className="text-slate-800 font-bold">{toBn(stats.totalTrainees)} জন</strong>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                <span>সম্পন্ন: <strong className="text-emerald-700">{toBn(stats.completedTrainees)}</strong> জন</span>
                <span>•</span>
                <span>ড্রপআউট: <strong className="text-amber-700">{toBn(stats.droppedTrainees)}</strong> জন</span>
              </div>
            </div>
          </Link>

          {/* Card 2: Ongoing Batches */}
          <Link 
            to="/batches" 
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-500 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">চলমান ব্যাচসমূহ</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-2xs">
                  <Layers size={20} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    {toBn(stats.ongoingBatchesCount)}
                  </h3>
                  <span className="text-sm font-bold text-slate-500">টি ব্যাচ</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 ml-auto">
                    সক্রিয় ক্লাস
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.totalBatches > 0 ? Math.round((stats.ongoingBatchesCount / stats.totalBatches) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span>সর্বমোট ব্যাচ:</span>
                <strong className="text-slate-800 font-bold">{toBn(stats.totalBatches)} টি</strong>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                <span>আসন্ন: <strong className="text-blue-700">{toBn(stats.upcomingBatchesCount)}</strong> টি</span>
                <span>•</span>
                <span>সমাপ্ত: <strong className="text-slate-600">{toBn(stats.completedBatchesCount)}</strong> টি</span>
              </div>
            </div>
          </Link>

          {/* Card 3: Attendance Percentages for Current Month */}
          <Link 
            to="/attendance" 
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-purple-500 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">চলতি মাসের উপস্থিতি হার</span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition shadow-2xs">
                  <CalendarCheck size={20} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    {toBn(stats.currentMonthAttendanceRate)}%
                  </h3>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                    stats.currentMonthAttendanceRate >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {stats.currentMonthAttendanceRate >= 75 ? 'সন্তোষজনক' : 'মনোযোগ আবশ্যক'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.currentMonthAttendanceRate >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} 
                    style={{ width: `${Math.min(100, stats.currentMonthAttendanceRate)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center space-x-1">
                  <span>উপস্থিত:</span>
                  <strong className="text-emerald-700 font-bold">{toBn(stats.currentMonthPresent)}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center space-x-1">
                  <span>অনুপস্থিত:</span>
                  <strong className="text-rose-600 font-bold">{toBn(stats.currentMonthAbsent)}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center space-x-1">
                  <span>ছুটি:</span>
                  <strong className="text-amber-700 font-bold">{toBn(stats.currentMonthLeave)}</strong>
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] pt-0.5">
                <span>মাসিক মোট রেকর্ড: <strong className="text-slate-700">{toBn(stats.currentMonthRecordsTotal)} টি</strong></span>
                <span>({toBn(stats.currentMonthUniqueDays)} দিন ক্লাস)</span>
              </div>
            </div>
          </Link>

          {/* Card 4: Today's Live Attendance */}
          <Link 
            to="/attendance" 
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-teal-500 hover:shadow-md transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আজকের উপস্থিতি হার</span>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition shadow-2xs">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    {toBn(stats.todayAttendanceRate)}%
                  </h3>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                    stats.todayAttendanceRate >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {stats.todayAttendanceRate >= 75 ? 'সন্তোষজনক' : 'মনোযোগ প্রয়োজন'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-teal-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, stats.todayAttendanceRate)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span>আজকের উপস্থিতি:</span>
                <strong className="text-emerald-700 font-bold">{toBn(stats.todayPresent)} জন</strong>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                <span>অনুপস্থিত: <strong className="text-rose-600">{toBn(stats.todayAbsent)}</strong> জন</span>
                <span>•</span>
                <span>আজকের মোট এন্ট্রি: <strong className="text-slate-700">{toBn(stats.todayRecordedTotal)}</strong> জন</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. TABBED NAVIGATION (ELIMINATES VERTICAL SCROLL FATIGUE)  */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-1.5 flex items-center justify-between flex-wrap gap-2 print:hidden">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 ${
              activeTab === 'attendance'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CalendarCheck size={16} />
            <span>ব্যাচ ও হাজিরা ট্র্যাকার</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'attendance' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {toBn(batchAttendanceStats.length)}
            </span>
          </button>


          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 ${
              activeTab === 'activity'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Clock size={16} />
            <span>অডিট লগ ও কার্যপদ্ধতি</span>
          </button>
        </div>

        {/* Date Selector for Attendance in Header */}
        {activeTab === 'attendance' && (
          <div className="flex items-center space-x-2 px-3 py-1 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <Calendar size={14} className="text-slate-500" />
            <span className="font-semibold text-slate-600">তারিখ:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
            {selectedDate !== todayIso && (
              <button
                onClick={() => setSelectedDate(todayIso)}
                className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded hover:bg-emerald-200 transition"
              >
                আজ
              </button>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 6. TAB CONTENT 1: ATTENDANCE & BATCH TRACKER             */}
      {/* ======================================================== */}
      {activeTab === 'attendance' && (
        <div className="space-y-5">
          {/* Filters & Daily Summary Strip */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <span>ব্যাচ অনুসারে উপস্থিতি ও সময়কাল অগ্রগতি</span>
                  <span className="text-xs font-semibold text-slate-500">
                    ({safeFormatDate(selectedDate, 'dd MMMM yyyy')})
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  প্রতিটি ব্যাচের বর্তমান ভর্তি, উপস্থিতির হার এবং কোর্স সম্পন্ন হওয়ার সময়রেখা
                </p>
              </div>

              {/* Quick Filter Buttons */}
              <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                <button
                  onClick={() => setBatchFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    batchFilter === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  সকল ব্যাচ ({toBn(batchAttendanceStats.length)})
                </button>
                <button
                  onClick={() => setBatchFilter('pending')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    batchFilter === 'pending'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  হাজিরা বাকি ({toBn(batchAttendanceStats.filter(b => !b.isRecorded).length)})
                </button>
                <button
                  onClick={() => setBatchFilter('low_attendance')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    batchFilter === 'low_attendance'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  উপস্থিতি &lt; ৭৫% ({toBn(batchAttendanceStats.filter(b => b.cumulativeRate < 75 && b.recordedCount > 0).length)})
                </button>
                {isTrainer && (
                  <button
                    onClick={() => setBatchFilter('my_batch')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      batchFilter === 'my_batch'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    আমার ব্যাচ
                  </button>
                )}
              </div>
            </div>

            {/* Selected Date Metric Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-semibold block">নির্বাচিত তারিখে উপস্থিত</span>
                <span className="text-xl font-black text-emerald-600 mt-0.5 block">{toBn(selectedDateSummary.totalPres)} জন</span>
              </div>
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-semibold block">নির্বাচিত তারিখে অনুপস্থিত</span>
                <span className="text-xl font-black text-red-600 mt-0.5 block">{toBn(selectedDateSummary.totalAbs)} জন</span>
              </div>
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-semibold block">অনুমোদিত ছুটি</span>
                <span className="text-xl font-black text-amber-600 mt-0.5 block">{toBn(selectedDateSummary.totalLev)} জন</span>
              </div>
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-semibold block">তারিখভিত্তিক গড় হার</span>
                <span className="text-xl font-black text-purple-600 mt-0.5 block">{toBn(selectedDateSummary.overallRate)}%</span>
              </div>
            </div>

            {/* Batch Cards Grid */}
            {filteredBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                <Layers size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700">নির্বাচিত ফিল্টারে কোনো ব্যাচ পাওয়া যায়নি</p>
                <p className="mt-0.5">ফিল্টার পরিবর্তন করে "সকল ব্যাচ" নির্বাচন করুন।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBatches.map(item => (
                  <div
                    key={item.batchId}
                    className={`bg-white rounded-2xl border p-4.5 hover:shadow-md transition flex flex-col justify-between space-y-3.5 relative overflow-hidden ${
                      item.isMyBatch ? 'border-emerald-400 ring-2 ring-emerald-500/10' : 'border-slate-200/90'
                    }`}
                  >
                    {item.isMyBatch && (
                      <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                        আমার ব্যাচ
                      </span>
                    )}

                    <div>
                      <div className="flex items-start justify-between gap-2 pr-14">
                        <h3 className="font-bold text-slate-800 text-sm leading-snug">
                          {item.batchName}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.tradeName} • <span className="text-slate-700 font-medium">{item.instituteName}</span>
                      </p>
                    </div>

                    {/* Attendance Figures for Selected Date */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-slate-50/90 rounded-xl text-center text-xs border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 block">উপস্থিত</span>
                        <strong className="text-emerald-700 text-sm font-extrabold block">{toBn(item.present)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">অনুপস্থিত</span>
                        <strong className="text-red-600 text-sm font-extrabold block">{toBn(item.absent)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">মোট ভর্তি</span>
                        <strong className="text-slate-800 text-sm font-extrabold block">
                          {toBn(item.totalEnrolled)} / {toBn(item.capacity)}
                        </strong>
                      </div>
                    </div>

                    {/* Attendance Status Bar & Cumulative Badge */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">আজকের হার:</span>
                        {item.isRecorded ? (
                          <span className={`font-bold ${item.rate >= 75 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {toBn(item.rate)}% উপস্থিত
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded text-[10px]">
                            এন্ট্রি বাকি
                          </span>
                        )}
                      </div>

                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                        {item.recordedCount > 0 ? (
                          <>
                            <div 
                              style={{ width: `${(item.present / item.recordedCount) * 100}%` }} 
                              className="bg-emerald-500 h-full"
                              title={`উপস্থিত: ${item.present} জন`}
                            />
                            <div 
                              style={{ width: `${(item.absent / item.recordedCount) * 100}%` }} 
                              className="bg-red-500 h-full"
                              title={`অনুপস্থিত: ${item.absent} জন`}
                            />
                            <div 
                              style={{ width: `${(item.leave / item.recordedCount) * 100}%` }} 
                              className="bg-amber-400 h-full"
                              title={`ছুটি: ${item.leave} জন`}
                            />
                          </>
                        ) : (
                          <div className="w-full bg-slate-200 h-full" />
                        )}
                      </div>

                      {/* Course Timeline Progress */}
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>কোর্স অগ্রগতি:</span>
                          <span className="font-semibold text-slate-700">
                            {toBn(item.elapsedDays)} / {toBn(item.totalDurationDays)} দিন ({toBn(item.timelinePercent)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${item.timelinePercent}%` }} 
                            className="bg-blue-600 h-full rounded-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Link Footer */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      {canTakeAttendance ? (
                        <Link
                          to="/attendance"
                          className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1"
                        >
                          <span>{item.isRecorded ? 'হাজিরা সংশোধন' : 'হাজিরা এন্ট্রি'}</span>
                          <ChevronRight size={13} />
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-[11px]">হাজিরা এন্ট্রি সংরক্ষিত</span>
                      )}

                      <Link
                        to="/attendance-sheet"
                        className="text-slate-500 hover:text-slate-800 font-medium text-[11px] flex items-center space-x-0.5"
                      >
                        <CalendarDays size={12} className="mr-0.5" />
                        <span>রেজিস্টার শিট</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comparative Bar Chart */}
          {batchChartData.length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    ব্যাচভিত্তিক উপস্থিত ও অনুপস্থিত তুলনা গ্রাফ ({safeFormatDate(selectedDate, 'dd MMM yyyy')})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    প্রতিটি ব্যাচের বাস্তব উপস্থিতি ও অনুপস্থিতির তুলনামূলক চিত্র
                  </p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={batchChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="উপস্থিত" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="অনুপস্থিত" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ছুটি" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}



      {/* ======================================================== */}
      {/* 8. TAB CONTENT 3: ACTIVITIES & STANDARD WORKFLOW         */}
      {/* ======================================================== */}
      {activeTab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audit Logs */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">সাম্প্রতিক সিস্টেম অডিট লগ (Activity Logs)</h3>
                <p className="text-xs text-slate-500 mt-0.5">ব্যবহারকারীদের সাম্প্রতিক পরিবর্তন ও কার্যক্রমের ইতিহাস</p>
              </div>
              {isCourseDirector && (
                <Link to="/settings" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1">
                  <span>সকল লগ</span>
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </div>

            {recentActivities.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                এখনো কোনো সাম্প্রতিক কার্যক্রম রেকর্ড করা হয়নি।
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivities.map(log => (
                  <div key={log.id} className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition border border-slate-100 text-xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock size={15} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-slate-800 truncate">{log.action}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        সম্পাদনকারী: <span className="font-semibold text-slate-700">{log.userName}</span> • মডিউল: <span className="text-emerald-700 font-medium">{log.module}</span>
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {safeFormatDate(log.timestamp, 'dd MMM, hh:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow Guide */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="pb-3 border-b border-slate-100 mb-3">
                <h3 className="font-bold text-slate-800 text-base">প্রশাসনিক কার্যপদ্ধতি নির্দেশিকা</h3>
                <p className="text-xs text-slate-500 mt-0.5">BNFE বৃত্তিমূলক প্রশিক্ষণ পরিচালনার ধাপসমূহ:</p>
              </div>

              <ol className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">১</span>
                  <span><strong>প্রতিষ্ঠান ও ট্রেড বরাদ্দ:</strong> কেন্দ্র নির্বাচন এবং ট্রেড কোড ও আসন ধারণক্ষমতা নির্ধারণ।</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">২</span>
                  <span><strong>ঝরে পড়া শিক্ষার্থী ভর্তি:</strong> জন্ম নিবন্ধন নম্বর যাচাই করে ব্যাচে শিক্ষার্থী অন্তর্ভুক্তিকরণ।</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">৩</span>
                  <span><strong>দৈনিক উপস্থিতি সংরক্ষণ:</strong> নিয়মিত ক্লাসে উপস্থিতি ও ছুটির রেকর্ড নিশ্চিতকরণ।</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">৪</span>
                  <span><strong>পরীক্ষা ও মূল্যায়ন:</strong> ব্যবহারিক ও তাত্ত্বিক পরীক্ষার নম্বর ইনপুট ও পাস মার্ক পর্যালোচনা।</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">৫</span>
                  <span><strong>সনদপত্র মুদ্রণ ও রিপোর্ট:</strong> নূন্যতম ৭৫% হাজিরা ও কৃতকার্য শিক্ষার্থীদের সনদ প্রদান।</span>
                </li>
              </ol>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                <Phone size={13} className="text-emerald-600" />
                <span>সহায়তা: উপানুষ্ঠানিক শিক্ষা ব্যুরো, ময়মনসিংহ</span>
              </div>
              <p className="text-[10px] text-slate-400">অফিসিয়াল কারিগরি প্রশিক্ষণ তথ্য ও সমন্বয় সেল</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. DROPOUT RISK MONITORING PAGINATED TABLE                */}
      {/* ======================================================== */}
      {renderDropoutRiskTable(false)}

      {/* ======================================================== */}
      {/* 10. PRINT-ONLY EXECUTIVE BRIEFING FORMAT (OFFICIAL A4)    */}
      {/* ======================================================== */}
      <div className="hidden print:block pt-6 border-t-2 border-slate-800 text-black text-xs space-y-4">
        <div className="text-center pb-3 border-b border-slate-300">
          <h2 className="text-base font-bold uppercase">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h2>
          <h3 className="text-sm font-semibold">উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE), ময়মনসিংহ জেলা কার্যালয়</h3>
          <p className="text-[11px] text-slate-600">ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কার্যক্রম - দৈনিক সারসংক্ষেপ প্রতিবেদন</p>
          <p className="text-[10px] text-slate-500 mt-1">প্রতিবেদন প্রস্তুতের তারিখ: {safeFormatDate(new Date(), 'dd MMMM yyyy, hh:mm a')} | প্রস্তুতকারী: {userProfile?.name} ({userProfile?.role})</p>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center py-2 border-b border-slate-300">
          <div className="border border-slate-300 p-2 rounded">
            <span className="block text-[10px] text-slate-600">মোট প্রতিষ্ঠান</span>
            <strong className="text-sm">{toBn(stats.totalInstitutes)} টি</strong>
          </div>
          <div className="border border-slate-300 p-2 rounded">
            <span className="block text-[10px] text-slate-600">চলমান ব্যাচ</span>
            <strong className="text-sm">{toBn(stats.activeBatches)} টি</strong>
          </div>
          <div className="border border-slate-300 p-2 rounded">
            <span className="block text-[10px] text-slate-600">মোট প্রশিক্ষণার্থী</span>
            <strong className="text-sm">{toBn(stats.totalTrainees)} জন</strong>
          </div>
          <div className="border border-slate-300 p-2 rounded">
            <span className="block text-[10px] text-slate-600">আজকের গড় উপস্থিতি</span>
            <strong className="text-sm">{toBn(stats.todayAttendanceRate)}%</strong>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-xs uppercase mb-2">ব্যাচভিত্তিক উপস্থিতি ও অগ্রগতির তালিকা ({safeFormatDate(selectedDate, 'dd/MM/yyyy')}):</h4>
          <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 p-1.5">ব্যাচের নাম</th>
                <th className="border border-slate-300 p-1.5">ট্রেড</th>
                <th className="border border-slate-300 p-1.5">প্রতিষ্ঠান</th>
                <th className="border border-slate-300 p-1.5 text-center">ভর্তি</th>
                <th className="border border-slate-300 p-1.5 text-center">উপস্থিত</th>
                <th className="border border-slate-300 p-1.5 text-center">অনুপস্থিত</th>
                <th className="border border-slate-300 p-1.5 text-center">হার (%)</th>
              </tr>
            </thead>
            <tbody>
              {batchAttendanceStats.map(b => (
                <tr key={b.batchId}>
                  <td className="border border-slate-300 p-1.5 font-medium">{b.batchName}</td>
                  <td className="border border-slate-300 p-1.5">{b.tradeName}</td>
                  <td className="border border-slate-300 p-1.5">{b.instituteName}</td>
                  <td className="border border-slate-300 p-1.5 text-center">{toBn(b.totalEnrolled)}</td>
                  <td className="border border-slate-300 p-1.5 text-center">{toBn(b.present)}</td>
                  <td className="border border-slate-300 p-1.5 text-center">{toBn(b.absent)}</td>
                  <td className="border border-slate-300 p-1.5 text-center font-bold">{toBn(b.rate)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-8 flex justify-between items-end text-[10px] text-slate-600">
          <div className="text-center">
            <div className="w-32 border-t border-slate-400 mb-1"></div>
            <span>প্রস্তুতকারীর স্বাক্ষর</span>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-slate-400 mb-1"></div>
            <span>কোর্স পরিচালক / সহকারী পরিচালক</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
