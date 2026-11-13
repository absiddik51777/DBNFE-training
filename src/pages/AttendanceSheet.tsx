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
import { usePermissions } from '../contexts/PermissionsContext';
import { dataService } from '../lib/dataService';
import { Institute, Batch, Trainee, AttendanceRecord, Trade } from '../types';
import { printCurrentDocument } from '../lib/fileExportService';

const MONTH_NAMES_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 
  'মে', 'জুন', 'জুলাই', 'আগস্ট', 
  'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const WEEKDAY_NAMES_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

export default function AttendanceSheet() {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const canExport = hasPermission('export_attendance_sheet');

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
    printCurrentDocument({ jobName: 'BNFE_Attendance_Sheet', landscape: true });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-theme-text-secondary font-medium text-sm">হাজিরা খাতার তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-theme-border">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border rounded-lg">
              <CalendarDays size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-theme-text-primary tracking-tight">হাজিরা শিট (Attendance Sheet)</h1>
              <p className="text-xs sm:text-sm text-theme-text-secondary">মাসিক হাজিরা খাতা ও উপস্থিতি বিবরণী রেজিস্টার</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 print:hidden">
          <Link
            to="/attendance"
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary text-xs sm:text-sm font-semibold rounded-lg transition-colors border border-theme-border"
          >
            <CalendarCheck size={16} className="text-theme-primary" />
            <span>দৈনিক হাজিরা নিন</span>
          </Link>

          {canExport && (
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
              title="প্রিন্ট করুন বা পিডিএফ সংরক্ষণ করুন"
            >
              <Printer size={16} />
              <span>শিট প্রিন্ট করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar: Institute, Batch, Month & Year */}
      <div className="bg-theme-surface p-4 sm:p-5 rounded-2xl border border-theme-border shadow-xs space-y-4 print:hidden transition-colors">
        <div className={`grid grid-cols-1 ${!isTrainer ? 'md:grid-cols-4' : 'sm:grid-cols-2 max-w-xl'} gap-4`}>
          {/* Institute & Batch Selectors (Only shown to non-trainers) */}
          {!isTrainer && (
            <>
              <div>
                <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 size={14} className="text-theme-text-muted" />
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
                  className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle text-theme-text-primary focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
                >
                  {institutes.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>

              {/* Batch Selector */}
              <div>
                <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Layers size={14} className="text-theme-text-muted" />
                  <span>ব্যাচ (Batch)</span>
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle text-theme-text-primary focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
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
              </div>
            </>
          )}

          {/* Month Selector */}
          <div>
            <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-theme-text-muted" />
              <span>মাস (Month)</span>
            </label>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="পূর্ববর্তী মাস"
                className="p-2 rounded-lg border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-secondary transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 text-sm font-medium px-3 py-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle text-theme-text-primary focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
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
                className="p-2 rounded-lg border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-secondary transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Year Selector & Current Month Quick Button */}
          <div>
            <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">
              বছর ও দ্রুত ন্যাভিগেশন
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-1/2 text-sm font-medium px-3 py-2.5 rounded-xl border border-theme-border bg-theme-surface-subtle text-theme-text-primary focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none tabular-nums"
              >
                {[2024, 2025, 2026, 2027, 2028].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="w-1/2 px-3 py-2.5 bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary text-xs font-bold rounded-xl transition-colors border border-theme-border text-center cursor-pointer"
              >
                চলতি মাস
              </button>
            </div>
          </div>
        </div>

        {/* Batch Info Sub-bar */}
        {currentBatch && (
          <div className="pt-3 border-t border-theme-border flex flex-wrap items-center justify-between text-xs text-theme-text-secondary gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-theme-text-primary">{currentInstitute?.name}</span>
              <span className="text-theme-border-strong">|</span>
              <span>ট্রেড: <strong className="text-theme-text-primary">{currentTrade?.name || 'ট্রেড'}</strong></span>
              <span className="text-theme-border-strong">|</span>
              <span>ব্যাচ: <strong className="text-theme-text-primary">{currentBatch.name}</strong></span>
              <span className="text-theme-border-strong">|</span>
              <span className="tabular-nums">হাজিরা মাস: <strong className="text-theme-primary font-bold">{MONTH_NAMES_BN[selectedMonth - 1]} {selectedYear}</strong> ({daysInMonth} দিন)</span>
            </div>

            {/* Legend for P / A / L */}
            <div className="flex items-center gap-2 font-medium bg-theme-surface-subtle px-3 py-1.5 rounded-lg border border-theme-border text-[11px]">
              <span className="text-theme-text-secondary">চিহ্ন নির্দেশিকা:</span>
              <span className="inline-flex items-center gap-1 font-bold text-theme-success">
                <span className="w-5 h-5 rounded bg-theme-success-soft text-theme-success border border-theme-success-border inline-flex items-center justify-center text-xs">P</span>
                <span>উপস্থিত</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-theme-danger">
                <span className="w-5 h-5 rounded bg-theme-danger-soft text-theme-danger border border-theme-danger-border inline-flex items-center justify-center text-xs">A</span>
                <span>অনুপস্থিত</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-theme-warning">
                <span className="w-5 h-5 rounded bg-theme-warning-soft text-theme-warning border border-theme-warning-border inline-flex items-center justify-center text-xs">L</span>
                <span>ছুটি</span>
              </span>
              <span className="inline-flex items-center gap-1 text-theme-text-muted">
                <span className="w-5 h-5 rounded bg-theme-surface text-theme-text-muted border border-theme-border inline-flex items-center justify-center text-xs">-</span>
                <span>তথ্য নেই</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 tabular-nums print:hidden">
        <div className="bg-theme-surface p-4 rounded-xl border border-theme-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-theme-info-soft text-theme-info flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">মোট প্রশিক্ষণার্থী</p>
            <p className="text-xl font-bold text-theme-text-primary">{trainees.length} জন</p>
          </div>
        </div>

        <div className="bg-theme-surface p-4 rounded-xl border border-theme-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-theme-success-soft text-theme-success flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">হাজিরা নেওয়া দিন</p>
            <p className="text-xl font-bold text-theme-success">{monthStats.recordedDaysCount} দিন</p>
          </div>
        </div>

        <div className="bg-theme-surface p-4 rounded-xl border border-theme-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center shrink-0">
            <CalendarCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">গড় উপস্থিতি হার</p>
            <p className="text-xl font-bold text-theme-accent">{monthStats.avgPercentage}%</p>
          </div>
        </div>

        <div className="bg-theme-surface p-4 rounded-xl border border-theme-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-theme-danger-soft text-theme-danger flex items-center justify-center shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">মোট অনুপস্থিতি এন্ট্রি</p>
            <p className="text-xl font-bold text-theme-danger">{monthStats.totalAbsentsAll} বার</p>
          </div>
        </div>
      </div>

      {/* Main Table Card (হাজিরা খাতা রেজিস্টার) */}
      <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden print:bg-white print:border-slate-300" ref={printRef}>
        {/* Printable Official Header */}
        <div className="p-5 pb-3 border-b border-theme-border print:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-base sm:text-lg font-bold text-theme-text-primary print:text-slate-900">
              {MONTH_NAMES_BN[selectedMonth - 1]} {selectedYear} — মাসিক হাজিরা রেজিস্টার
            </div>
            <div className="text-xs text-theme-text-secondary print:text-slate-600 mt-0.5">
              প্রতিষ্ঠান: {currentInstitute?.name || '-'} | ব্যাচ: {currentBatch?.name || '-'} | ট্রেড: {currentTrade?.name || '-'}
            </div>
          </div>

          {/* Quick Search & Rate Filter */}
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="প্রশিক্ষণার্থীর নাম বা আইডি..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-theme-border bg-theme-surface-subtle text-theme-text-primary placeholder:text-theme-text-muted focus:bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary w-48 sm:w-56"
              />
            </div>

            <select
              value={rateFilter}
              onChange={(e) => setRateFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-theme-border bg-theme-surface-subtle text-theme-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-theme-primary/25"
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
          <div className="flex flex-col items-center justify-center p-16 text-theme-text-secondary">
            <div className="w-8 h-8 border-3 border-theme-primary border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs font-medium">হাজিরা খাতা তৈরি হচ্ছে...</p>
          </div>
        ) : trainees.length === 0 ? (
          <div className="p-16 text-center text-theme-text-secondary">
            <Users size={36} className="mx-auto text-theme-text-muted mb-2" />
            <p className="font-semibold text-theme-text-primary text-sm">এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী পাওয়া যায়নি</p>
            <p className="text-xs text-theme-text-muted mt-1">অনুগ্রহ করে অন্য ব্যাচ নির্বাচন করুন অথবা প্রশিক্ষণার্থী যুক্ত করুন</p>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-center border-collapse text-xs select-none tabular-nums">
              {/* Table Header */}
              <thead>
                {/* Row 1: Day numbers */}
                <tr className="bg-theme-surface-subtle print:bg-slate-800 text-theme-text-primary print:text-white font-bold text-[11px] border-b border-theme-border-strong print:border-slate-700">
                  {/* Sticky left columns */}
                  <th className="sticky left-0 z-20 bg-theme-surface-subtle print:bg-slate-800 px-3 py-2 text-center w-12 border-r border-theme-border-strong print:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                    ক্রমিক
                  </th>
                  <th className="sticky left-12 z-20 bg-theme-surface-subtle print:bg-slate-800 px-3 py-2 text-left min-w-[170px] max-w-[200px] border-r border-theme-border-strong print:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                    প্রশিক্ষণার্থীর নাম ও আইডি
                  </th>

                  {/* Day Columns (1 to 30/31) */}
                  {daysList.map(d => (
                    <th
                      key={d.day}
                      className={`px-1.5 py-1.5 min-w-[28px] max-w-[34px] border-r border-theme-border print:border-slate-700 font-semibold ${
                        d.isFriday ? 'bg-theme-danger-soft text-theme-danger print:bg-rose-950/70 print:text-rose-300' : ''
                      }`}
                      title={`${d.dateStr} (${d.dayOfWeekBn})`}
                    >
                      <div>{d.day}</div>
                      <div className={`text-[9px] font-normal ${d.isFriday ? 'text-theme-danger print:text-rose-400 font-bold' : 'text-theme-text-muted print:text-slate-400'}`}>
                        {d.dayOfWeekBn}
                      </div>
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th className="px-2 py-2 bg-theme-success-soft text-theme-success print:bg-emerald-900 print:text-emerald-200 border-r border-theme-border print:border-slate-700 min-w-[34px]" title="মোট উপস্থিত">
                    P
                  </th>
                  <th className="px-2 py-2 bg-theme-danger-soft text-theme-danger print:bg-rose-950 print:text-rose-200 border-r border-theme-border print:border-slate-700 min-w-[34px]" title="মোট অনুপস্থিত">
                    A
                  </th>
                  <th className="px-2 py-2 bg-theme-warning-soft text-theme-warning print:bg-amber-950 print:text-amber-200 border-r border-theme-border print:border-slate-700 min-w-[34px]" title="মোট ছুটি">
                    L
                  </th>
                  <th className="px-2.5 py-2 bg-theme-elevated text-theme-text-primary print:bg-slate-900 print:text-slate-100 min-w-[48px]" title="উপস্থিতির শতকরা হার">
                    %
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-theme-border print:divide-slate-200 text-theme-text-primary print:text-slate-800">
                {filteredTrainees.length === 0 ? (
                  <tr>
                    <td colSpan={daysList.length + 6} className="py-10 text-center text-theme-text-secondary">
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
                        className={`hover:bg-theme-surface-hover transition-colors ${
                          index % 2 === 1 ? 'bg-theme-surface-subtle/50 print:bg-slate-50/40' : 'bg-theme-surface print:bg-white'
                        }`}
                      >
                        {/* Sticky Serial No */}
                        <td className="sticky left-0 z-10 bg-inherit px-2 py-2 text-center text-theme-text-secondary print:text-slate-600 font-medium border-r border-theme-border print:border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          {index + 1}
                        </td>

                        {/* Sticky Name & ID */}
                        <td className="sticky left-12 z-10 bg-inherit px-3 py-2 text-left border-r border-theme-border print:border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          <div className="font-semibold text-theme-text-primary print:text-slate-900 text-[12px] truncate max-w-[180px]">
                            {t.nameBn || t.nameEn}
                          </div>
                          <div className="text-[10px] text-theme-text-secondary truncate max-w-[180px] flex items-center gap-1.5">
                            <span className="font-mono text-theme-primary print:text-emerald-700 font-medium">{t.traineeId || t.id}</span>
                          </div>
                        </td>

                        {/* Date Cells (P, A, L) */}
                        {daysList.map(d => {
                          const status = tRecords[d.dateStr];
                          let cellContent = <span className="text-theme-text-muted print:text-slate-300">-</span>;
                          let cellBg = d.isFriday ? 'bg-theme-danger-soft/30 print:bg-rose-50/40' : '';

                          if (status === 'Present') {
                            cellContent = (
                              <span className="w-5 h-5 rounded inline-flex items-center justify-center font-bold text-theme-success bg-theme-success-soft print:text-emerald-800 print:bg-emerald-100 text-[11px] shadow-2xs">
                                P
                              </span>
                            );
                            cellBg = 'bg-theme-success-soft/20 print:bg-emerald-50/30';
                          } else if (status === 'Absent') {
                            cellContent = (
                              <span className="w-5 h-5 rounded inline-flex items-center justify-center font-bold text-theme-danger bg-theme-danger-soft print:text-rose-800 print:bg-rose-100 text-[11px] shadow-2xs">
                                A
                              </span>
                            );
                            cellBg = 'bg-theme-danger-soft/25 print:bg-rose-50/40';
                          } else if (status === 'Leave') {
                            cellContent = (
                              <span className="w-5 h-5 rounded inline-flex items-center justify-center font-bold text-theme-warning bg-theme-warning-soft print:text-amber-800 print:bg-amber-100 text-[11px] shadow-2xs">
                                L
                              </span>
                            );
                            cellBg = 'bg-theme-warning-soft/25 print:bg-amber-50/40';
                          }

                          return (
                            <td
                              key={d.day}
                              className={`p-1 border-r border-theme-border print:border-slate-100 text-center ${cellBg}`}
                              title={`${t.nameBn} - ${d.dateStr}: ${status || 'হাজিরা রেকর্ড নেই'}`}
                            >
                              {cellContent}
                            </td>
                          );
                        })}

                        {/* Summary Column Values */}
                        <td className="px-2 py-1.5 border-r border-theme-border print:border-slate-200 font-bold text-theme-success bg-theme-success-soft/40 print:text-emerald-700 print:bg-emerald-50/50">
                          {st.present}
                        </td>
                        <td className="px-2 py-1.5 border-r border-theme-border print:border-slate-200 font-bold text-theme-danger bg-theme-danger-soft/40 print:text-rose-700 print:bg-rose-50/50">
                          {st.absent}
                        </td>
                        <td className="px-2 py-1.5 border-r border-theme-border print:border-slate-200 font-bold text-theme-warning bg-theme-warning-soft/40 print:text-amber-700 print:bg-amber-50/50">
                          {st.leave}
                        </td>
                        <td className={`px-2 py-1.5 font-bold text-center ${
                          st.percentage >= 80
                            ? 'text-theme-success bg-theme-success-soft/25 print:text-emerald-700 print:bg-emerald-50/30'
                            : st.percentage >= 60
                            ? 'text-theme-text-primary bg-theme-surface-subtle print:text-slate-700 print:bg-slate-50'
                            : 'text-theme-danger bg-theme-danger-soft/35 print:text-rose-700 print:bg-rose-50/50'
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
                <tr className="bg-theme-success-soft print:bg-emerald-50 font-bold text-[11px] text-theme-success print:text-emerald-900 border-t-2 border-theme-success-border print:border-emerald-300">
                  <td colSpan={2} className="sticky left-0 z-10 bg-theme-success-soft print:bg-emerald-100 px-3 py-2 text-right border-r border-theme-success-border print:border-emerald-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    দৈনিক মোট উপস্থিত (Total P)
                  </td>
                  {daysList.map(d => {
                    const count = dailyTotals[d.dateStr]?.present || 0;
                    return (
                      <td key={d.day} className="px-1 py-1.5 border-r border-theme-success-border print:border-emerald-200 text-center">
                        {count > 0 ? count : '-'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 border-r border-theme-success-border print:border-emerald-300 bg-theme-success text-theme-success-fg print:bg-emerald-200/80 print:text-emerald-950 font-extrabold">
                    {monthStats.totalPresentsAll}
                  </td>
                  <td colSpan={3} className="px-2 py-1.5 bg-theme-success-soft print:bg-emerald-100 text-center text-xs">
                    মোট উপস্থিতি
                  </td>
                </tr>

                {/* Total Absent Row */}
                <tr className="bg-theme-danger-soft print:bg-rose-50 font-bold text-[11px] text-theme-danger print:text-rose-900 border-t border-theme-danger-border print:border-rose-200">
                  <td colSpan={2} className="sticky left-0 z-10 bg-theme-danger-soft print:bg-rose-100 px-3 py-2 text-right border-r border-theme-danger-border print:border-rose-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    দৈনিক মোট অনুপস্থিত (Total A)
                  </td>
                  {daysList.map(d => {
                    const count = dailyTotals[d.dateStr]?.absent || 0;
                    return (
                      <td key={d.day} className="px-1 py-1.5 border-r border-theme-danger-border print:border-rose-200 text-center">
                        {count > 0 ? count : '-'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 border-r border-theme-danger-border print:border-rose-200 bg-theme-surface-subtle print:bg-emerald-50/50">
                    -
                  </td>
                  <td className="px-2 py-1.5 border-r border-theme-danger-border print:border-rose-300 bg-theme-danger text-theme-danger-fg print:bg-rose-200/80 print:text-rose-950 font-extrabold">
                    {monthStats.totalAbsentsAll}
                  </td>
                  <td colSpan={2} className="px-2 py-1.5 bg-theme-danger-soft print:bg-rose-100 text-center text-xs">
                    মোট অনুপস্থিতি
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Bottom Register Footer Bar */}
        <div className="p-4 bg-theme-surface-subtle print:bg-slate-50 border-t border-theme-border print:border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-theme-text-secondary gap-3">
          <div className="flex items-center space-x-2">
            <Info size={14} className="text-theme-text-muted shrink-0" />
            <span>
              প্রদর্শিত হচ্ছে মোট <strong className="text-theme-text-primary">{filteredTrainees.length}</strong> জন প্রশিক্ষণার্থী। (P = Present, A = Absent, L = Leave)
            </span>
          </div>

          <div className="flex items-center space-x-4 print:hidden">
            <span className="text-[11px] text-theme-text-muted">
              হাজিরা খাতা রিপোর্ট জেনারেটেড: {new Date().toLocaleDateString('bn-BD')}
            </span>
            <Link
              to="/attendance"
              className="text-theme-primary hover:opacity-80 font-semibold inline-flex items-center space-x-1"
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
