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
  Phone
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

  // Active batches list
  const activeBatchesList = useMemo(() => {
    return batches.filter(b => !b.status || b.status === 'Active');
  }, [batches]);

  // Aggregate Key Statistics
  const stats = useMemo(() => {
    const totalTrainees = trainees.length;
    const activeTrainees = trainees.filter(t => !t.status || t.status === 'Active').length;
    const droppedTrainees = trainees.filter(t => t.status === 'Dropped Out').length;
    const completedTrainees = trainees.filter(t => t.status === 'Completed').length;

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
      totalTrainees,
      activeTrainees,
      droppedTrainees,
      completedTrainees,
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] text-slate-500">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-700">ড্যাশবোর্ড তথ্য লোড হচ্ছে...</p>
        <span className="text-xs text-slate-400 mt-1">উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) ডাটাবেজ সমন্বয় হচ্ছে</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* ======================================================== */}
      {/* 0. PROMINENT MULTI-USER DATA SYNC STRIP AT DASHBOARD TOP */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-800">
                কেন্দ্রীয় ডাটাবেজ সমন্বয় ও লাইভ সিঙ্ক (Multi-User Live Sync)
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping mr-1"></span>
                রিয়েলটাইম সক্রিয়
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              প্রশিক্ষক বা অন্যান্য কেন্দ্র থেকে সংরক্ষিত নতুন হাজিরা অবিলম্বে দেখতে বাটনে ক্লিক করুন। 
              সর্বশেষ সিঙ্ক: <strong className="font-mono text-emerald-900 font-bold">{format(lastSyncTime, 'hh:mm:ss a')}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={handleLiveSync}
          disabled={syncing}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm border border-emerald-700 disabled:opacity-75 cursor-pointer shrink-0"
          title="ডাটাবেজ থেকে তাৎক্ষণিক সকল আপডেট সিঙ্ক করুন"
        >
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'ডাটা সিঙ্ক হচ্ছে...' : 'ডাটা সিঙ্ক করুন (Sync Data)'}</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. OFFICIAL BANGLADESH GOV & BNFE HEADER BANNER          */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-6 sm:p-7 text-white shadow-md shadow-emerald-950/10 border border-emerald-900/30 print:bg-white print:text-black print:border-b-2 print:border-emerald-800 print:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            {/* Government Seal & Official Tagline */}
            <div className="flex items-center space-x-2 text-emerald-100 text-xs font-semibold tracking-wide mb-1.5 print:text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse print:hidden"></span>
              <span>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার • উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)</span>
            </div>

            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                প্রশিক্ষণ ব্যবস্থাপনা ড্যাশবোর্ড
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 bg-emerald-600/60 border border-emerald-400/40 text-[11px] font-semibold rounded-full text-emerald-100 print:hidden">
                ময়মনসিংহ জেলা
              </span>
            </div>

            <p className="text-emerald-100/90 text-xs sm:text-sm mt-1 max-w-2xl print:text-slate-700">
              অষ্টম শ্রেণির পূর্বে ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কর্মসূচি।
            </p>

            {/* Current user badge & session info */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-emerald-600/50 text-xs text-emerald-200 print:hidden">
              <span>ব্যবহারকারী: <strong className="text-white font-semibold">{userProfile?.name}</strong></span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium border border-white/20">
                পদবী: {userProfile?.role}
              </span>
              <span>•</span>
              <span>সেশন: ২০২৫-২০২৬</span>
              <span>•</span>
              <span>তারিখ: {safeFormatDate(new Date(), 'dd MMMM yyyy')}</span>
            </div>
          </div>

          {/* Action Bar (Live Sync, Print, Export & Role-aware Buttons) */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0 print:hidden">
            {/* Prominent Live Cloud Sync Button */}
            <button
              onClick={handleLiveSync}
              disabled={syncing}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm border border-amber-300 disabled:opacity-75"
              title="ক্লাউড ডাটাবেজ থেকে সরাসরি সর্বশেষ ডেটা সিঙ্ক করুন"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin text-slate-900' : 'text-slate-900'} />
              <span>{syncing ? 'সিঙ্ক হচ্ছে...' : 'ডাটা সিঙ্ক করুন (Live Sync)'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-white/20"
              title="ড্যাশবোর্ড সারসংক্ষেপ প্রিন্ট করুন"
            >
              <Printer size={14} />
              <span>প্রিন্ট সামারি</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-emerald-400/30 shadow-xs"
              title="হাজিরা সারাংশ সিএসভি এক্সপোর্ট করুন"
            >
              <Download size={14} />
              <span>এক্সপোর্ট</span>
            </button>

            {canTakeAttendance && (
              <Link
                to="/attendance"
                className="px-3.5 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
              >
                <CalendarCheck size={15} className="text-emerald-700" />
                <span>হাজিরা এন্ট্রি</span>
              </Link>
            )}

            {canRegisterTrainee && (
              <Link
                to="/trainees/add"
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
              >
                <PlusCircle size={15} />
                <span>নতুন ভর্তি</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Live Sync Status & Instant Confirmation Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-600 print:hidden">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-800">রিয়েলটাইম ক্লাউড সিঙ্ক সক্রিয়</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">
            সর্বশেষ সিঙ্ক: <strong className="text-slate-700 font-mono">{format(lastSyncTime, 'hh:mm:ss a')}</strong>
          </span>
        </div>

        {syncSuccessMsg && (
          <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-2xs animate-in fade-in">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. TRAINER CONTEXT HERO CARD (For logged-in Trainers)    */}
      {/* ======================================================== */}
      {isTrainer && (
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <UserCheck size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  প্রশিক্ষক স্পেশাল প্যানেল
                </span>
                {trainerBatch?.isTodayRecorded ? (
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    <CheckCircle2 size={12} />
                    <span>আজকের হাজিরা সম্পন্ন</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                    <AlertCircle size={12} />
                    <span>আজকের হাজিরা বাকি</span>
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-800 mt-1">
                নির্ধারিত ব্যাচ: {trainerBatch?.batchName || userProfile?.batchName || 'ব্যাচ নির্ধারিত নেই'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                প্রতিষ্ঠান: <span className="font-semibold">{trainerBatch?.instituteName || userProfile?.instituteName || 'ডিফল্ট কেন্দ্র'}</span> • 
                ট্রেড: <span className="font-semibold">{trainerBatch?.tradeName || 'বৃত্তিমূলক ট্রেড'}</span> • 
                মোট শিক্ষার্থী: <strong className="text-emerald-800 font-bold">{toBn(trainerBatch?.totalEnrolled || 0)} জন</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to="/attendance"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs"
            >
              <CalendarCheck size={14} />
              <span>{trainerBatch?.isTodayRecorded ? 'হাজিরা সংশোধন' : 'আজকের হাজিরা নিন'}</span>
            </Link>
            <Link
              to="/results"
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
            >
              <Award size={14} className="text-blue-600" />
              <span>নম্বর এন্ট্রি</span>
            </Link>
          </div>
        </div>
      )}

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
      {/* 4. EXECUTIVE SUMMARY METRICS (ACTIONABLE OPERATIONAL KPI) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Trainees */}
        <Link 
          to="/trainees" 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-sm transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মোট প্রশিক্ষণার্থী</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-2xs">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {toBn(stats.totalTrainees)} <span className="text-sm font-bold text-slate-500">জন</span>
            </h3>
            <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
              সক্রিয়: {toBn(stats.activeTrainees)} জন • সম্পন্ন: {toBn(stats.completedTrainees)} জন
            </span>
          </div>
        </Link>

        {/* Today's Attendance Rate */}
        <Link 
          to="/attendance" 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-teal-400 hover:shadow-sm transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আজকের উপস্থিতি হার</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition shadow-2xs">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                {toBn(stats.todayAttendanceRate)}%
              </h3>
              {stats.todayRecordedTotal > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  stats.todayAttendanceRate >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {stats.todayAttendanceRate >= 75 ? 'সন্তোষজনক' : 'মনোযোগ প্রয়োজন'}
                </span>
              )}
            </div>
            <span className="text-[11px] text-teal-700 font-semibold mt-1 block">
              মোট রেকর্ড: {toBn(stats.todayRecordedTotal)} জন
            </span>
          </div>
        </Link>

        {/* Today's Present Trainees */}
        <Link 
          to="/attendance" 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-400 hover:shadow-sm transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আজ উপস্থিত শিক্ষার্থী</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              {toBn(stats.todayPresent)} <span className="text-sm font-bold text-slate-600">জন</span>
            </h3>
            <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
              {stats.todayLeave > 0 ? `ছুটিতে: ${toBn(stats.todayLeave)} জন` : 'প্রশিক্ষণ কেন্দ্রে উপস্থিত'}
            </span>
          </div>
        </Link>

        {/* Today's Absent Trainees */}
        <Link 
          to="/attendance" 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-red-400 hover:shadow-sm transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আজ অনুপস্থিত</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition shadow-2xs">
              <UserX size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
              {toBn(stats.todayAbsent)} <span className="text-sm font-bold text-slate-600">জন</span>
            </h3>
            <span className="text-[11px] text-red-600 font-semibold mt-1 block">
              {stats.todayAbsent > 0 ? 'ঝরে পড়া রোধে ফলোআপ প্রয়োজন' : 'সকল শিক্ষার্থী ক্লাসে উপস্থিত'}
            </span>
          </div>
        </Link>
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
      {/* 9. PRINT-ONLY EXECUTIVE BRIEFING FORMAT (OFFICIAL A4)     */}
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
