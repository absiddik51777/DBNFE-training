import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Search, 
  Building2, 
  Layers, 
  CalendarCheck, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Info,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../lib/dataService';
import { Institute, Batch, Trainee, AttendanceRecord, Trade } from '../types';

const MONTH_NAMES_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 
  'মে', 'জুন', 'জুলাই', 'আগস্ট', 
  'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const WEEKDAY_NAMES_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

export default function AttendanceSheet() {
  const { userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);

  // Core metadata
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  // Selection states
  const [selectedInstitute, setSelectedInstitute] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');

  // Month & Year state
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12

  // Trainees and attendance records for the month
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Search & Filters inside table
  const [searchQuery, setSearchQuery] = useState('');
  const [rateFilter, setRateFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const printRef = useRef<HTMLDivElement>(null);

  const isTrainer = userProfile?.role === 'Trainer';

  // Load initial institutes and batches
  useEffect(() => {
    loadInitialData();
  }, [userProfile]);

  const loadInitialData = async () => {
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

      if (userProfile?.role === 'Trainer') {
        targetInst = userProfile.instituteId || (instData[0]?.id || '');
        if (userProfile.batchId) {
          targetBatch = userProfile.batchId;
          const assigned = btcData.find(b => b.id === userProfile.batchId);
          if (assigned) {
            targetInst = assigned.instituteId || targetInst;
          }
        } else {
          const matching = btcData.filter(b => b.instituteId === targetInst);
          if (matching.length > 0) {
            targetBatch = matching[0].id;
          }
        }
      } else {
        targetInst = userProfile?.instituteId || (instData[0]?.id || '');
        const matching = btcData.filter(b => b.instituteId === targetInst);
        if (matching.length > 0) {
          targetBatch = matching[0].id;
        } else if (btcData.length > 0) {
          targetBatch = btcData[0].id;
          targetInst = btcData[0].instituteId || targetInst;
        }
      }

      setSelectedInstitute(targetInst);
      setSelectedBatch(targetBatch);
    } catch (err) {
      console.error('Failed to load institutes and batches:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trainees and attendance records whenever selectedBatch, year, or month changes
  useEffect(() => {
    if (selectedBatch) {
      fetchMonthlyAttendance();
    } else {
      setTrainees([]);
      setAttendanceRecords([]);
    }
  }, [selectedBatch, selectedYear, selectedMonth]);

  const fetchMonthlyAttendance = async () => {
    setFetchingData(true);
    try {
      const [allTrainees, allAttendance] = await Promise.all([
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<AttendanceRecord>('attendance')
      ]);

      // Active trainees in selected batch
      const batchTrainees = allTrainees
        .filter(t => t.batchId === selectedBatch && (!t.status || t.status === 'Active'))
        .sort((a, b) => (a.traineeId || a.id).localeCompare(b.traineeId || b.id, undefined, { numeric: true }));
      setTrainees(batchTrainees);

      // Attendance records for this batch in selected year-month
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const batchMonthlyAttendance = allAttendance.filter(
        a => a.batchId === selectedBatch && a.date && a.date.startsWith(monthPrefix)
      );

      setAttendanceRecords(batchMonthlyAttendance);
    } catch (err) {
      console.error('Failed to fetch monthly attendance:', err);
    } finally {
      setFetchingData(false);
    }
  };

  // Calculate days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Array of day objects: { day: 1, dateStr: '2026-10-01', dayOfWeek: 4, dayOfWeekBn: 'বৃহঃ', isFriday: false }
  const daysList = useMemo(() => {
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 5 is Friday
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push({
        day: d,
        dateStr,
        dayOfWeek,
        dayOfWeekBn: WEEKDAY_NAMES_BN[dayOfWeek],
        isFriday: dayOfWeek === 5 // Weekly holiday in Bangladesh
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth]);

  // Map of traineeId -> { dateStr: AttendanceStatus }
  const traineeAttendanceMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    attendanceRecords.forEach(record => {
      if (!map[record.traineeId]) {
        map[record.traineeId] = {};
      }
      map[record.traineeId][record.date] = record.status;
    });
    return map;
  }, [attendanceRecords]);

  // Compute stats for each trainee
  const traineeStats = useMemo(() => {
    const stats: Record<string, { present: number; absent: number; leave: number; totalRecorded: number; percentage: number }> = {};
    
    trainees.forEach(t => {
      let p = 0;
      let a = 0;
      let l = 0;
      const tRecords = traineeAttendanceMap[t.id] || {};

      daysList.forEach(day => {
        const st = tRecords[day.dateStr];
        if (st === 'Present') p++;
        else if (st === 'Absent') a++;
        else if (st === 'Leave') l++;
      });

      const totalRecorded = p + a + l;
      const percentage = totalRecorded > 0 ? Math.round((p / totalRecorded) * 100) : 0;
      stats[t.id] = { present: p, absent: a, leave: l, totalRecorded, percentage };
    });

    return stats;
  }, [trainees, traineeAttendanceMap, daysList]);

  // Daily totals for the footer
  const dailyTotals = useMemo(() => {
    const totals: Record<string, { present: number; absent: number; leave: number; total: number }> = {};
    
    daysList.forEach(day => {
      let p = 0;
      let a = 0;
      let l = 0;
      trainees.forEach(t => {
        const st = traineeAttendanceMap[t.id]?.[day.dateStr];
        if (st === 'Present') p++;
        else if (st === 'Absent') a++;
        else if (st === 'Leave') l++;
      });
      totals[day.dateStr] = { present: p, absent: a, leave: l, total: p + a + l };
    });

    return totals;
  }, [daysList, trainees, traineeAttendanceMap]);

  // Overall batch month statistics
  const monthStats = useMemo(() => {
    let recordedDaysCount = 0;
    let totalPresentsAll = 0;
    let totalAbsentsAll = 0;
    let totalLeavesAll = 0;

    daysList.forEach(day => {
      const dt = dailyTotals[day.dateStr];
      if (dt && dt.total > 0) {
        recordedDaysCount++;
        totalPresentsAll += dt.present;
        totalAbsentsAll += dt.absent;
        totalLeavesAll += dt.leave;
      }
    });

    const totalMarks = totalPresentsAll + totalAbsentsAll + totalLeavesAll;
    const avgPercentage = totalMarks > 0 ? Math.round((totalPresentsAll / totalMarks) * 100) : 0;

    return {
      recordedDaysCount,
      totalPresentsAll,
      totalAbsentsAll,
      totalLeavesAll,
      avgPercentage
    };
  }, [daysList, dailyTotals]);

  // Filtered trainees
  const filteredTrainees = useMemo(() => {
    return trainees.filter(t => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (t.nameBn && t.nameBn.toLowerCase().includes(q)) ||
        (t.nameEn && t.nameEn.toLowerCase().includes(q)) ||
        (t.traineeId && t.traineeId.toLowerCase().includes(q)) ||
        (t.id && t.id.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Rate filter
      const st = traineeStats[t.id];
      if (!st) return true;
      if (rateFilter === 'high') return st.percentage >= 80;
      if (rateFilter === 'medium') return st.percentage >= 60 && st.percentage < 80;
      if (rateFilter === 'low') return st.percentage < 60 && st.totalRecorded > 0;

      return true;
    });
  }, [trainees, searchQuery, rateFilter, traineeStats]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  // Get current batch object
  const currentBatch = batches.find(b => b.id === selectedBatch);
  const currentInstitute = institutes.find(i => i.id === (currentBatch?.instituteId || selectedInstitute));
  const currentTrade = trades.find(t => t.id === currentBatch?.tradeId);

  // Available batches for institute
  const availableBatches = isTrainer
    ? batches.filter(b => b.id === userProfile?.batchId || (!userProfile?.batchId && b.instituteId === selectedInstitute))
    : (selectedInstitute ? batches.filter(b => b.instituteId === selectedInstitute) : batches);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-slate-600 font-medium text-sm">হাজিরা খাতার তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <CalendarDays size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">হাজিরা শিট (Attendance Sheet)</h1>
              <p className="text-xs sm:text-sm text-slate-500">মাসিক হাজিরা খাতা ও উপস্থিতি বিবরণী রেজিস্টার</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <Link
            to="/attendance"
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg transition-colors border border-slate-300"
          >
            <CalendarCheck size={16} className="text-emerald-600" />
            <span>দৈনিক হাজিরা নিন</span>
          </Link>

          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            title="প্রিন্ট করুন বা পিডিএফ সংরক্ষণ করুন"
          >
            <Printer size={16} />
            <span>শিট প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {/* Filter Bar: Institute, Batch, Month & Year */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Institute Selector (Hidden for Trainer if assigned) */}
          {!isTrainer ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                <span>প্রতিষ্ঠান (Institute)</span>
              </label>
              <select
                value={selectedInstitute}
                onChange={(e) => {
                  const instId = e.target.value;
                  setSelectedInstitute(instId);
                  const matchingBatches = batches.filter(b => b.instituteId === instId);
                  if (matchingBatches.length > 0) {
                    setSelectedBatch(matchingBatches[0].id);
                  } else {
                    setSelectedBatch('');
                  }
                }}
                className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {institutes.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                প্রতিষ্ঠান (Institute)
              </label>
              <div className="text-sm font-semibold text-slate-800 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 truncate">
                {currentInstitute?.name || 'বরাদ্দকৃত প্রতিষ্ঠান'}
              </div>
            </div>
          )}

          {/* Batch Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers size={14} className="text-slate-400" />
              <span>ব্যাচ (Batch)</span>
            </label>
            {!isTrainer ? (
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {availableBatches.length === 0 ? (
                  <option value="">কোনো ব্যাচ পাওয়া যায়নি</option>
                ) : (
                  availableBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <div className="text-sm font-semibold text-slate-800 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 truncate flex items-center justify-between">
                <span>{currentBatch?.name || 'বরাদ্দকৃত ব্যাচ'}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                  প্রশিক্ষক
                </span>
              </div>
            )}
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-400" />
              <span>মাস (Month)</span>
            </label>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="পূর্ববর্তী মাস"
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 text-sm font-medium px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {MONTH_NAMES_BN.map((mName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {mName} ({idx + 1})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNextMonth}
                title="পরবর্তী মাস"
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Year Selector & Current Month Quick Button */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              বছর ও দ্রুত ন্যাভিগেশন
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-1/2 text-sm font-medium px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="w-1/2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-200 text-center"
              >
                চলতি মাস
              </button>
            </div>
          </div>
        </div>

        {/* Batch Info Sub-bar */}
        {currentBatch && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-800">{currentInstitute?.name}</span>
              <span className="text-slate-300">|</span>
              <span>ট্রেড: <strong className="text-slate-700">{currentTrade?.name || 'ট্রেড'}</strong></span>
              <span className="text-slate-300">|</span>
              <span>ব্যাচ: <strong className="text-slate-700">{currentBatch.name}</strong></span>
              <span className="text-slate-300">|</span>
              <span>হাজিরা মাস: <strong className="text-emerald-700 font-bold">{MONTH_NAMES_BN[selectedMonth - 1]} {selectedYear}</strong> ({daysInMonth} দিন)</span>
            </div>

            {/* Legend for P / A / L */}
            <div className="flex items-center gap-2 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px]">
              <span className="text-slate-500">চিহ্ন নির্দেশিকা:</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 inline-flex items-center justify-center text-xs">P</span>
                <span>উপস্থিত</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-rose-800">
                <span className="w-5 h-5 rounded bg-rose-100 text-rose-800 inline-flex items-center justify-center text-xs">A</span>
                <span>অনুপস্থিত</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                <span className="w-5 h-5 rounded bg-amber-100 text-amber-800 inline-flex items-center justify-center text-xs">L</span>
                <span>ছুটি</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <span className="w-5 h-5 rounded bg-slate-100 text-slate-400 inline-flex items-center justify-center text-xs">-</span>
                <span>তথ্য নেই</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">মোট প্রশিক্ষণার্থী</p>
            <p className="text-xl font-bold text-slate-800">{trainees.length} জন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">হাজিরা নেওয়া দিন</p>
            <p className="text-xl font-bold text-emerald-600">{monthStats.recordedDaysCount} দিন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CalendarCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">গড় উপস্থিতি হার</p>
            <p className="text-xl font-bold text-purple-700">{monthStats.avgPercentage}%</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">মোট অনুপস্থিতি এন্ট্রি</p>
            <p className="text-xl font-bold text-rose-600">{monthStats.totalAbsentsAll} বার</p>
          </div>
        </div>
      </div>

      {/* Main Table Card (হাজিরা খাতা রেজিস্টার) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" ref={printRef}>
        {/* Printable Official Header */}
        <div className="p-5 pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-base sm:text-lg font-bold text-slate-800">
              {MONTH_NAMES_BN[selectedMonth - 1]} {selectedYear} — মাসিক হাজিরা রেজিস্টার
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              প্রতিষ্ঠান: {currentInstitute?.name || '-'} | ব্যাচ: {currentBatch?.name || '-'} | ট্রেড: {currentTrade?.name || '-'}
            </div>
          </div>

          {/* Quick Search & Rate Filter */}
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="প্রশিক্ষণার্থীর নাম বা আইডি..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-56"
              />
            </div>

            <select
              value={rateFilter}
              onChange={(e) => setRateFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">সব উপস্থিতি হার</option>
              <option value="high">৮০% বা বেশি (High)</option>
              <option value="medium">৬০% - ৭৯% (Average)</option>
              <option value="low">৬০% এর কম (Low/Alert)</option>
            </select>
          </div>
        </div>

        {/* Attendance Register Grid */}
        {fetchingData ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-500">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs font-medium">হাজিরা খাতা তৈরি হচ্ছে...</p>
          </div>
        ) : trainees.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-sm">এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">অনুগ্রহ করে অন্য ব্যাচ নির্বাচন করুন অথবা প্রশিক্ষণার্থী যুক্ত করুন</p>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-center border-collapse text-xs select-none">
              {/* Table Header */}
              <thead>
                {/* Row 1: Day numbers */}
                <tr className="bg-slate-800 text-white font-bold text-[11px] border-b border-slate-700">
                  {/* Sticky left columns */}
                  <th className="sticky left-0 z-20 bg-slate-800 px-3 py-2 text-center w-12 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    ক্রমিক
                  </th>
                  <th className="sticky left-12 z-20 bg-slate-800 px-3 py-2 text-left min-w-[170px] max-w-[200px] border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    প্রশিক্ষণার্থীর নাম ও আইডি
                  </th>

                  {/* Day Columns (1 to 30/31) */}
                  {daysList.map(d => (
                    <th 
                      key={d.day} 
                      className={`px-1.5 py-1.5 min-w-[28px] max-w-[34px] border-r border-slate-700 font-semibold ${
                        d.isFriday ? 'bg-rose-950/70 text-rose-300' : ''
                      }`}
                      title={`${d.dateStr} (${d.dayOfWeekBn})`}
                    >
                      <div>{d.day}</div>
                      <div className={`text-[9px] font-normal ${d.isFriday ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                        {d.dayOfWeekBn}
                      </div>
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th className="px-2 py-2 bg-emerald-900 text-emerald-200 border-r border-slate-700 min-w-[34px]" title="মোট উপস্থিত">
                    P
                  </th>
                  <th className="px-2 py-2 bg-rose-950 text-rose-200 border-r border-slate-700 min-w-[34px]" title="মোট অনুপস্থিত">
                    A
                  </th>
                  <th className="px-2 py-2 bg-amber-950 text-amber-200 border-r border-slate-700 min-w-[34px]" title="মোট ছুটি">
                    L
                  </th>
                  <th className="px-2.5 py-2 bg-slate-900 text-slate-100 min-w-[48px]" title="উপস্থিতির শতকরা হার">
                    %
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredTrainees.length === 0 ? (
                  <tr>
                    <td colSpan={daysList.length + 6} className="py-10 text-center text-slate-500">
                      কোনো প্রশিক্ষণার্থী মেলেনি
                    </td>
                  </tr>
                ) : (
                  filteredTrainees.map((t, index) => {
                    const st = traineeStats[t.id] || { present: 0, absent: 0, leave: 0, totalRecorded: 0, percentage: 0 };
                    const tRecords = traineeAttendanceMap[t.id] || {};

                    return (
                      <tr 
                        key={t.id} 
                        className={`hover:bg-slate-50/90 transition-colors ${
                          index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                        }`}
                      >
                        {/* Sticky Serial No */}
                        <td className="sticky left-0 z-10 bg-inherit px-2 py-2 text-center text-slate-600 font-medium border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          {index + 1}
                        </td>

                        {/* Sticky Name & ID */}
                        <td className="sticky left-12 z-10 bg-inherit px-3 py-2 text-left border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          <div className="font-semibold text-slate-900 text-[12px] truncate max-w-[180px]">
                            {t.nameBn}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px] flex items-center gap-1.5">
                            <span className="font-mono text-emerald-700 font-medium">{t.traineeId || t.id}</span>
                            {t.nameEn && <span className="text-slate-400">· {t.nameEn}</span>}
                          </div>
                        </td>

                        {/* Date Cells (P, A, L) */}
                        {daysList.map(d => {
                          const status = tRecords[d.dateStr];
                          let cellContent = <span className="text-slate-300">-</span>;
                          let cellBg = d.isFriday ? 'bg-rose-50/40' : '';

                          if (status === 'Present') {
                            cellContent = (
                              <span className="w-5 h-5 rounded inline-flex items-center justify-center font-bold text-emerald-800 bg-emerald-100 text-[11px] shadow-2xs">
                                P
                              </span>
                            );
                            cellBg = 'bg-emerald-50/30';
                          } else if (status === 'Absent') {
                            cellContent = (
                              <span className="w-5 h-5 rounded inline-flex items-center justify-center font-bold text-rose-800 bg-rose-100 text-[11px] shadow-2xs">
                                A
                              </span>
                            );
                            cellBg = 'bg-rose-50/40';
                          } else if (status === 'Leave') {
                            cellContent = (
                              <span className="w-5 h-5 rounded inline-flex items-center justify-center font-bold text-amber-800 bg-amber-100 text-[11px] shadow-2xs">
                                L
                              </span>
                            );
                            cellBg = 'bg-amber-50/40';
                          }

                          return (
                            <td 
                              key={d.day} 
                              className={`p-1 border-r border-slate-100 text-center ${cellBg}`}
                              title={`${t.nameBn} - ${d.dateStr}: ${status || 'হাজিরা রেকর্ড নেই'}`}
                            >
                              {cellContent}
                            </td>
                          );
                        })}

                        {/* Summary Column Values */}
                        <td className="px-2 py-1.5 border-r border-slate-200 font-bold text-emerald-700 bg-emerald-50/50">
                          {st.present}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 font-bold text-rose-700 bg-rose-50/50">
                          {st.absent}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 font-bold text-amber-700 bg-amber-50/50">
                          {st.leave}
                        </td>
                        <td className={`px-2 py-1.5 font-bold text-center ${
                          st.percentage >= 80 
                            ? 'text-emerald-700 bg-emerald-50/30' 
                            : st.percentage >= 60 
                            ? 'text-slate-700 bg-slate-50' 
                            : 'text-rose-700 bg-rose-50/50'
                        }`}>
                          {st.totalRecorded > 0 ? `${st.percentage}%` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer: Daily Total Summary */}
              <tfoot>
                {/* Total Present Row */}
                <tr className="bg-emerald-50 font-bold text-[11px] text-emerald-900 border-t-2 border-emerald-300">
                  <td colSpan={2} className="sticky left-0 z-10 bg-emerald-100 px-3 py-2 text-right border-r border-emerald-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    দৈনিক মোট উপস্থিত (Total P)
                  </td>
                  {daysList.map(d => {
                    const count = dailyTotals[d.dateStr]?.present || 0;
                    return (
                      <td key={d.day} className="px-1 py-1.5 border-r border-emerald-200 text-center">
                        {count > 0 ? count : '-'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 border-r border-emerald-300 bg-emerald-200/80 text-emerald-950 font-extrabold">
                    {monthStats.totalPresentsAll}
                  </td>
                  <td colSpan={3} className="px-2 py-1.5 bg-emerald-100 text-center text-xs">
                    মোট উপস্থিতি
                  </td>
                </tr>

                {/* Total Absent Row */}
                <tr className="bg-rose-50 font-bold text-[11px] text-rose-900 border-t border-rose-200">
                  <td colSpan={2} className="sticky left-0 z-10 bg-rose-100 px-3 py-2 text-right border-r border-rose-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    দৈনিক মোট অনুপস্থিত (Total A)
                  </td>
                  {daysList.map(d => {
                    const count = dailyTotals[d.dateStr]?.absent || 0;
                    return (
                      <td key={d.day} className="px-1 py-1.5 border-r border-rose-200 text-center">
                        {count > 0 ? count : '-'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 border-r border-rose-200 bg-emerald-50/50">
                    -
                  </td>
                  <td className="px-2 py-1.5 border-r border-rose-300 bg-rose-200/80 text-rose-950 font-extrabold">
                    {monthStats.totalAbsentsAll}
                  </td>
                  <td colSpan={2} className="px-2 py-1.5 bg-rose-100 text-center text-xs">
                    মোট অনুপস্থিতি
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Bottom Register Footer Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <Info size={14} className="text-slate-400 shrink-0" />
            <span>
              প্রদর্শিত হচ্ছে মোট <strong>{filteredTrainees.length}</strong> জন প্রশিক্ষণার্থী। (P = Present, A = Absent, L = Leave)
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-[11px] text-slate-400">
              হাজিরা খাতা রিপোর্ট জেনারেটেড: {new Date().toLocaleDateString('bn-BD')}
            </span>
            <Link
              to="/attendance"
              className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center space-x-1"
            >
              <span>দৈনিক হাজিরা আপডেট করুন</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
