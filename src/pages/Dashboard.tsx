import React, { useEffect, useState, useMemo } from 'react';
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
  ChevronRight
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
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Institute, 
  Trade, 
  Batch, 
  Trainee, 
  AttendanceRecord, 
  ExamMark, 
  ActivityLog 
} from '../types';
import { dataService } from '../lib/dataService';
import { safeFormatDate } from '../lib/dateUtils';
import { DEFAULT_INSTITUTES, DEFAULT_TRADES } from '../lib/demoTraineesSeed';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

  // Selected date for batch-wise attendance inspection (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [stats, setStats] = useState({
    totalInstitutes: 0,
    totalTrades: 0,
    totalBatches: 0,
    totalTrainees: 0,
    activeTrainees: 0,
    todayPresent: 0,
    todayAbsent: 0,
    attendanceRate: 0,
    totalPassed: 0,
    totalFailed: 0,
  });

  const [tradeDistribution, setTradeDistribution] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [userProfile]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const [
        institutesList,
        tradesList,
        batchesList,
        traineesList,
        attendanceList,
        marksList,
        activitiesList
      ] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<AttendanceRecord>('attendance'),
        dataService.getItems<ExamMark>('marks'),
        dataService.getItems<ActivityLog>('activityLogs')
      ]);

      const effectiveInstitutes = institutesList.length > 0 ? institutesList : DEFAULT_INSTITUTES;
      const effectiveTrades = tradesList.length > 0 ? tradesList : DEFAULT_TRADES;

      setInstitutes(effectiveInstitutes);
      setTrades(effectiveTrades);
      setBatches(batchesList);
      setTrainees(traineesList);
      setAttendance(attendanceList);
      setMarks(marksList);
      setRecentActivities(activitiesList.slice(0, 5));

      const activeCount = traineesList.filter(t => t.status === 'Active').length;
      const todayRecords = attendanceList.filter(a => a.date === todayStr);
      const presentCount = todayRecords.filter(a => a.status === 'Present').length;
      const absentCount = todayRecords.filter(a => a.status === 'Absent').length;

      const totalRecorded = presentCount + absentCount;
      const rate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;

      const passedCount = marksList.filter(m => m.result === 'Pass').length;
      const failedCount = marksList.filter(m => m.result === 'Fail').length;

      setStats({
        totalInstitutes: effectiveInstitutes.length,
        totalTrades: effectiveTrades.length,
        totalBatches: batchesList.length,
        totalTrainees: traineesList.length,
        activeTrainees: activeCount,
        todayPresent: presentCount,
        todayAbsent: absentCount,
        attendanceRate: rate,
        totalPassed: passedCount,
        totalFailed: failedCount,
      });

      // Trade distribution from real trainees
      const tradeMap: Record<string, number> = {};
      traineesList.forEach((t) => {
        const trade = effectiveTrades.find(tr => tr.id === t.tradeId);
        const name = trade ? trade.name : 'অন্যান্য ট্রেড';
        tradeMap[name] = (tradeMap[name] || 0) + 1;
      });

      const tradeData = Object.entries(tradeMap).map(([name, count]) => ({
        name,
        count
      }));
      setTradeDistribution(tradeData);

    } catch (err) {
      console.warn("Notice loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Compute batch-wise attendance statistics for the selected date
  const batchAttendanceStats = useMemo(() => {
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

      const instituteObj = institutes.find(i => i.id === batch.instituteId) || DEFAULT_INSTITUTES.find(i => i.id === batch.instituteId);
      const tradeObj = trades.find(t => t.id === batch.tradeId) || DEFAULT_TRADES.find(t => t.id === batch.tradeId);

      return {
        batchId: batch.id,
        batchName: batch.name,
        instituteName: instituteObj?.name || 'প্রতিষ্ঠান',
        tradeName: tradeObj?.name || 'ট্রেড',
        totalEnrolled,
        present,
        absent,
        leave,
        recordedCount,
        rate,
        isRecorded: recordedCount > 0,
      };
    });
  }, [batches, trainees, attendance, selectedDate, institutes, trades]);

  // Aggregate stats across batches for the selected date
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

  // Prepare chart data for batch comparison
  const batchChartData = useMemo(() => {
    return batchAttendanceStats.map(b => ({
      name: b.batchName.length > 20 ? b.batchName.slice(0, 18) + '...' : b.batchName,
      fullName: b.batchName,
      উপস্থিত: b.present,
      অনুপস্থিত: b.absent,
      ছুটি: b.leave,
    }));
  }, [batchAttendanceStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">ড্যাশবোর্ড তথ্য লোড হচ্ছে (Loading statistics)...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-md mb-2">
            স্বাগতম, {userProfile?.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ড্যাশবোর্ড ওভারভিউ (Dashboard)
          </h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-xl">
            বাংলাদেশ উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) এর ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ ব্যবস্থাপনা পোর্টাল।
          </p>
        </div>

        {/* Quick Actions & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 border border-white/20"
            title="তথ্য রিফ্রেশ করুন"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>রিফ্রেশ</span>
          </button>
          <Link
            to="/trainees/add"
            className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm"
          >
            <PlusCircle size={16} />
            <span>নতুন শিক্ষার্থী</span>
          </Link>
          <Link
            to="/attendance"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 border border-white/20"
          >
            <CalendarCheck size={16} />
            <span>হাজিরা গ্রহণ</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Institutes */}
        <Link to="/institutes" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4 hover:border-blue-300 transition group">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট প্রতিষ্ঠান</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalInstitutes}</h3>
            <span className="text-[11px] text-blue-600 font-medium flex items-center space-x-0.5">
              <span>তালিকা দেখুন</span>
              <ChevronRight size={12} />
            </span>
          </div>
        </Link>

        {/* Total Trades */}
        <Link to="/trades" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4 hover:border-amber-300 transition group">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition flex items-center justify-center shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট ট্রেড</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalTrades}</h3>
            <span className="text-[11px] text-amber-600 font-medium flex items-center space-x-0.5">
              <span>ট্রেড দেখুন</span>
              <ChevronRight size={12} />
            </span>
          </div>
        </Link>

        {/* Total Batches */}
        <Link to="/batches" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4 hover:border-purple-300 transition group">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition flex items-center justify-center shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট ব্যাচ</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalBatches}</h3>
            <span className="text-[11px] text-purple-600 font-medium flex items-center space-x-0.5">
              <span>ব্যাচ পরিচালনা</span>
              <ChevronRight size={12} />
            </span>
          </div>
        </Link>

        {/* Total Trainees */}
        <Link to="/trainees" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4 hover:border-emerald-300 transition group">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট প্রশিক্ষণার্থী</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalTrainees}</h3>
            <span className="text-[11px] text-emerald-600 font-medium">সক্রিয়: {stats.activeTrainees} জন</span>
          </div>
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 2. BATCH-WISE ATTENDANCE BREAKDOWN (ব্যাচ অনুসারে উপস্থিত ও অনুপস্থিত) */}
      {/* ======================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CalendarCheck size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                ব্যাচ অনুসারে উপস্থিতি ও অনুপস্থিতি (Batch-wise Attendance Breakdown)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              সিলেক্ট করা তারিখ অনুযায়ী প্রতিটি ব্যাচের উপস্থিত ও অনুপস্থিত শিক্ষার্থীর বিশদ বিবরণ
            </p>
          </div>

          {/* Date Selector Filter */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
              <Calendar size={15} className="text-slate-400" />
              <span>তারিখ:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>
            {selectedDate !== format(new Date(), 'yyyy-MM-dd') && (
              <button
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
              >
                আজ
              </button>
            )}
            <Link
              to="/attendance-sheet"
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center space-x-1"
            >
              <CalendarDays size={14} />
              <span>মাসিক শিট</span>
            </Link>
          </div>
        </div>

        {/* Aggregate Stats for the Selected Date */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-100 text-xs">
          <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
            <span className="text-slate-500 block">নির্বাচিত তারিখে মোট উপস্থিত</span>
            <span className="text-lg font-bold text-emerald-600 mt-0.5 block">{selectedDateSummary.totalPres} জন</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
            <span className="text-slate-500 block">নির্বাচিত তারিখে মোট অনুপস্থিত</span>
            <span className="text-lg font-bold text-red-600 mt-0.5 block">{selectedDateSummary.totalAbs} জন</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
            <span className="text-slate-500 block">অনুমোদিত ছুটি</span>
            <span className="text-lg font-bold text-amber-600 mt-0.5 block">{selectedDateSummary.totalLev} জন</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
            <span className="text-slate-500 block">গড় উপস্থিতির হার</span>
            <span className="text-lg font-bold text-purple-600 mt-0.5 block">{selectedDateSummary.overallRate}%</span>
          </div>
        </div>

        {/* Batch-wise Cards Grid */}
        {batchAttendanceStats.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
            <Layers size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">কোনো ব্যাচ পাওয়া যায়নি</p>
            <p className="mt-0.5">প্রথমে প্রতিষ্ঠান ও ট্রেড তৈরি করে ব্যাচ যুক্ত করুন।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchAttendanceStats.map((item) => (
              <div 
                key={item.batchId} 
                className="bg-white rounded-xl border border-slate-200 p-4.5 hover:shadow-sm hover:border-emerald-300 transition flex flex-col justify-between space-y-3.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">
                      {item.batchName}
                    </h3>
                    {item.isRecorded ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md shrink-0">
                        {item.rate}% উপস্থিত
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-md shrink-0">
                        এন্ট্রি বাকি
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {item.tradeName} • {item.instituteName}
                  </p>
                </div>

                {/* Status Numbers */}
                <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-slate-50 rounded-lg text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">উপস্থিত (P)</span>
                    <strong className="text-emerald-700 text-sm font-bold block">{item.present}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">অনুপস্থিত (A)</span>
                    <strong className="text-red-600 text-sm font-bold block">{item.absent}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">মোট শিক্ষার্থী</span>
                    <strong className="text-slate-700 text-sm font-bold block">{item.totalEnrolled}</strong>
                  </div>
                </div>

                {/* Ratio Bar */}
                <div className="space-y-1">
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
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>তারিখ: {safeFormatDate(selectedDate, 'dd/MM/yyyy')}</span>
                    {item.leave > 0 && <span className="text-amber-600">ছুটিতে: {item.leave} জন</span>}
                  </div>
                </div>

                {/* Card footer link */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link
                    to="/attendance"
                    className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center space-x-1"
                  >
                    <span>হাজিরা এন্ট্রি</span>
                    <ChevronRight size={13} />
                  </Link>
                  <Link
                    to="/attendance-sheet"
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    রেজিস্টার শিট
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Visual Bar Chart Comparing Batches */}
        {batchChartData.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              ব্যাচভিত্তিক উপস্থিত ও অনুপস্থিত তুলনা চিত্র
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="উপস্থিত" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="অনুপস্থিত" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ছুটি" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Charts (Trades distribution & Exam pass/fail) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trainees by Trade */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-base">ট্রেড-ভিত্তিক বণ্টন (Trainees by Trade)</h3>
            <p className="text-xs text-slate-500 mt-0.5">কোন ট্রেডে কতজন শিক্ষার্থী প্রশিক্ষণ নিচ্ছেন</p>
          </div>
          {tradeDistribution.length === 0 ? (
            <div className="h-52 w-full flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
              <Wrench size={32} className="text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">এখনো কোনো ট্রেড বণ্টন নেই</p>
              <Link to="/trades" className="text-emerald-600 hover:underline mt-1 font-semibold">
                নতুন ট্রেড ও ব্যাচ তৈরি করুন
              </Link>
            </div>
          ) : (
            <>
              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tradeDistribution}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={4}
                    >
                      {tradeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {tradeDistribution.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="font-medium truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{item.count} জন</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Exam Results Summary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 text-base">পরীক্ষার ফলাফল চিত্র (Results)</h3>
              <p className="text-xs text-slate-500 mt-0.5">প্রশিক্ষণার্থীদের মূল্যায়নে পাস ও ফেলের অনুপাত</p>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Award size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">মোট পাস</span>
                  <span className="text-xl font-bold text-blue-700">{stats.totalPassed} জন</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">অকৃতকার্য/ফেল</span>
                  <span className="text-xl font-bold text-amber-700">{stats.totalFailed} জন</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <Link
              to="/results"
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition"
            >
              <span>বিস্তারিত ফলাফল দেখুন</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Quick Links & Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">প্রয়োজনীয় মডিউল লিঙ্ক</h3>
            <p className="text-xs text-slate-500 mb-3">দ্রুত কার্যসম্পাদনের শর্টকাট:</p>
            <div className="space-y-2">
              <Link to="/attendance-sheet" className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center space-x-2">
                  <CalendarDays size={16} className="text-emerald-600" />
                  <span>মাসিক হাজিরা খাতা (Register)</span>
                </div>
                <ChevronRight size={14} />
              </Link>
              <Link to="/trainees" className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center space-x-2">
                  <Users size={16} className="text-blue-600" />
                  <span>প্রশিক্ষণার্থী তালিকা ও প্রোফাইল</span>
                </div>
                <ChevronRight size={14} />
              </Link>
              <Link to="/reports" className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center space-x-2">
                  <Award size={16} className="text-purple-600" />
                  <span>প্রতিবেদন ও সার্টিফিকেট</span>
                </div>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">BNFE কারিগরি প্রশিক্ষণ ব্যবস্থাপনা পোর্টাল</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Log and Workflow Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">সাম্প্রতিক কার্যক্রম (Recent Activities)</h3>
            <Link to="/settings" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1">
              <span>সকল সেটিংস ও লগ দেখুন</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {recentActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
              এখনো কোনো সাম্প্রতিক কার্যক্রম রেকর্ড করা হয়নি।
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((log) => (
                <div key={log.id} className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-semibold text-slate-800 truncate">{log.action}</p>
                    <p className="text-xs text-slate-500">
                      কর্তৃক: <span className="font-medium text-slate-700">{log.userName}</span> • মডিউল: {log.module}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {safeFormatDate(log.timestamp, 'dd MMM, hh:mm a')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workflow Guide */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">কার্যপদ্ধতি নির্দেশিকা (Workflow)</h3>
            <p className="text-xs text-slate-500 mb-4">ধাপে ধাপে সিস্টেম পরিচালনা করুন:</p>
            <ol className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">১</span>
                <span>প্রতিষ্ঠান, ট্রেড ও ব্যাচ সেটআপ করুন</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">২</span>
                <span>প্রশিক্ষণার্থী ভর্তি ও নিবন্ধন সম্পন্ন করুন</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">৩</span>
                <span>দৈনিক উপস্থিতি নিয়মিত এন্ট্রি করুন</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">৪</span>
                <span>পরীক্ষা ও প্রাপ্ত নম্বর ইনপুট দিয়ে ফলাফল বের করুন</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">৫</span>
                <span>যোগ্য শিক্ষার্থীদের সার্টিফিকেট ও প্রতিবেদন ডাউনলোড করুন</span>
              </li>
            </ol>
          </div>
          <div className="pt-4 border-t border-slate-100 mt-4 text-center">
            <span className="text-[11px] text-slate-400">সহায়তার জন্য ডিবিএনএফই অফিসে যোগাযোগ করুন</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
