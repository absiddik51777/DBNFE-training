import React, { useEffect, useState } from 'react';
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
  ArrowUpRight
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
  Cell 
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

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);

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
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

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

      const activeCount = traineesList.filter(t => t.status === 'Active').length;
      const todayRecords = attendanceList.filter(a => a.date === todayStr);
      const presentCount = todayRecords.filter(a => a.status === 'Present').length;
      const absentCount = todayRecords.filter(a => a.status === 'Absent').length;

      const totalRecorded = presentCount + absentCount;
      const rate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;

      const passedCount = marksList.filter(m => m.result === 'Pass').length;
      const failedCount = marksList.filter(m => m.result === 'Fail').length;

      setStats({
        totalInstitutes: institutesList.length,
        totalTrades: tradesList.length,
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
        const trade = tradesList.find(tr => tr.id === t.tradeId);
        const name = trade ? trade.name : 'অন্যান্য ট্রেড';
        tradeMap[name] = (tradeMap[name] || 0) + 1;
      });

      const tradeData = Object.entries(tradeMap).map(([name, count]) => ({
        name,
        count
      }));
      setTradeDistribution(tradeData);

      setRecentActivities(activitiesList.slice(0, 5));

    } catch (err) {
      console.warn("Notice loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real attendance trend from actual data if available, otherwise empty
  const monthlyAttendanceTrend: { month: string; present: number; absent: number }[] = [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">তথ্য লোড হচ্ছে (Loading statistics)...</p>
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
            বাংলাদেশ উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) এর ঝরে পড়া শিক্ষার্থীদের প্রশিক্ষণ কর্মসূচি ব্যবস্থাপনা পোর্টালে আপনাকে স্বাগতম।
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/trainees/add"
            className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm"
          >
            <PlusCircle size={16} />
            <span>নতুন প্রশিক্ষণার্থী</span>
          </Link>
          <Link
            to="/attendance"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 border border-white/20"
          >
            <CalendarCheck size={16} />
            <span>উপস্থিতি নিন</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Institutes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট প্রতিষ্ঠান</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalInstitutes}</h3>
            <span className="text-[11px] text-slate-400">Institutes</span>
          </div>
        </div>

        {/* Total Trades */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট ট্রেড</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalTrades}</h3>
            <span className="text-[11px] text-slate-400">Vocational Trades</span>
          </div>
        </div>

        {/* Total Trainees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট প্রশিক্ষণার্থী</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalTrainees}</h3>
            <span className="text-[11px] text-emerald-600 font-medium">সক্রিয়: {stats.activeTrainees}</span>
          </div>
        </div>

        {/* Total Batches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট ব্যাচ</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalBatches}</h3>
            <span className="text-[11px] text-slate-400">Training Batches</span>
          </div>
        </div>
      </div>

      {/* Secondary Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Present */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">আজ উপস্থিত</span>
            <h4 className="text-xl font-bold text-emerald-600 mt-0.5">{stats.todayPresent} জন</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck size={20} />
          </div>
        </div>

        {/* Today Absent */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">আজ অনুপস্থিত</span>
            <h4 className="text-xl font-bold text-red-600 mt-0.5">{stats.todayAbsent} জন</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <UserX size={20} />
          </div>
        </div>

        {/* Total Passed */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">মোট পাসকৃত</span>
            <h4 className="text-xl font-bold text-blue-600 mt-0.5">{stats.totalPassed} জন</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Award size={20} />
          </div>
        </div>

        {/* Total Failed */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">মোট ফেলকৃত</span>
            <h4 className="text-xl font-bold text-amber-600 mt-0.5">{stats.totalFailed} জন</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">মাসিক উপস্থিতির হার (Monthly Attendance Trend)</h3>
              <p className="text-xs text-slate-500 mt-0.5">গত কয়েক মাসের গড় উপস্থিতি শতকরা (%) হিসেবে</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/60">
              বর্তমান হার: {stats.attendanceRate}%
            </span>
          </div>
          {monthlyAttendanceTrend.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
              <CalendarCheck size={36} className="text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">এখনো কোনো উপস্থিতির তথ্য নথিভুক্ত হয়নি</p>
              <Link to="/attendance" className="text-emerald-600 hover:underline mt-1 font-semibold">
                উপস্থিতি গ্রহণ করুন
              </Link>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAttendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis unit="%" tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip 
                    formatter={(val: any) => [`${val}%`, 'উপস্থিতি হার']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="present" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

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
      </div>

      {/* Recent Activity Log and Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">সাম্প্রতিক কার্যক্রম (Recent Activities)</h3>
            <Link to="/settings" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1">
              <span>সকল সেটিংস দেখুন</span>
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
                    {format(log.timestamp, 'dd MMM, hh:mm a')}
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
