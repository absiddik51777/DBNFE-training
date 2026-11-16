import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarCheck } from 'lucide-react';
import type {
  AttendanceRecord,
  Batch,
  Institute,
  Trade,
  Trainee,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { dataService } from '../lib/dataService';
import { printCustomHtmlDocument } from '../lib/fileExportService';
import { Header } from '../components/attendance-register/Header';
import { InfoCard } from '../components/attendance-register/InfoCard';
import { Stats } from '../components/attendance-register/Stats';
import { FilterChips } from '../components/attendance-register/FilterChips';
import { RegisterTable } from '../components/attendance-register/RegisterTable';
import { MenuPopover } from '../components/attendance-register/MenuPopover';
import { ExportModal } from '../components/attendance-register/ExportModal';
import {
  WEEKDAY_NAMES_BN,
  buildRegisterHtml,
  type AttendanceCode,
  type GetAttendanceFn,
  type RateFilterValue,
  type RegisterDay,
  type StudentRegisterRow,
} from '../components/attendance-register/types';
import { TruncatedText } from '../components/ui/TruncatedText';

export default function AttendanceSheet() {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const { resolvedMode, setMode } = useTheme();

  const canExport = hasPermission('export_attendance_sheet');
  const isTrainer = userProfile?.role === 'Trainer';

  // Core metadata
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');

  // Month & Year state
  const nowDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => format(nowDate, 'yyyy-MM-dd'), [nowDate]);
  const [selectedYear, setSelectedYear] = useState<number>(nowDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(nowDate.getMonth() + 1);

  // Trainees & real DB attendance records
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);

  // Filter & Menu view toggles
  const [rateFilter, setRateFilter] = useState<RateFilterValue>('all');
  const [hideFridays, setHideFridays] = useState(false);
  const [hideSummary, setHideSummary] = useState(false);
  const [compactRows, setCompactRows] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [scrollTrigger, setScrollTrigger] = useState(0);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // Load initial institutes, trades, batches
  useEffect(() => {
    let active = true;
    const loadMaster = async () => {
      setLoading(true);
      try {
        const [instData, trdData, btcData] = await Promise.all([
          dataService.getItems<Institute>('institutes'),
          dataService.getItems<Trade>('trades'),
          dataService.getItems<Batch>('batches'),
        ]);
        if (!active) return;

        setInstitutes(instData);
        setTrades(trdData);
        setBatches(btcData);

        let targetBatch = '';
        if (userProfile?.role === 'Trainer') {
          if (userProfile.batchId) {
            targetBatch = userProfile.batchId;
          } else {
            const targetInst = userProfile.instituteId || instData[0]?.id || '';
            const matching = btcData.filter((b) => b.instituteId === targetInst);
            targetBatch = matching[0]?.id || btcData[0]?.id || '';
          }
        } else {
          const targetInst = userProfile?.instituteId || instData[0]?.id || '';
          const matching = btcData.filter((b) => b.instituteId === targetInst);
          targetBatch = matching[0]?.id || btcData[0]?.id || '';
        }

        setSelectedBatch(targetBatch);
      } catch (err) {
        console.warn('Failed to load register metadata:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMaster();
    return () => {
      active = false;
    };
  }, [userProfile?.id, userProfile?.role, userProfile?.batchId, userProfile?.instituteId]);

  // Fetch trainees and attendance records when batch/year/month changes
  useEffect(() => {
    if (!selectedBatch) {
      setTrainees([]);
      setAttendanceRecords([]);
      return;
    }

    let active = true;
    const loadMonthly = async () => {
      setFetchingData(true);
      try {
        const [allTrainees, allAttendance] = await Promise.all([
          dataService.getItems<Trainee>('trainees'),
          dataService.getItems<AttendanceRecord>('attendance'),
        ]);
        if (!active) return;

        const batchTrainees = allTrainees
          .filter(
            (t) => t.batchId === selectedBatch && (!t.status || t.status === 'Active')
          )
          .sort((a, b) =>
            (a.traineeId || a.id).localeCompare(b.traineeId || b.id, undefined, {
              numeric: true,
            })
          );

        const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const batchMonthAttendance = allAttendance.filter(
          (a) =>
            a.batchId === selectedBatch && a.date && a.date.startsWith(monthPrefix)
        );

        setTrainees(batchTrainees);
        setAttendanceRecords(batchMonthAttendance);
      } catch (err) {
        console.warn('Failed to fetch monthly attendance:', err);
      } finally {
        if (active) setFetchingData(false);
      }
    };

    loadMonthly();
    return () => {
      active = false;
    };
  }, [selectedBatch, selectedYear, selectedMonth]);

  // Days list for selected month
  const daysList = useMemo<RegisterDay[]>(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const list: RegisterDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`;
      list.push({
        day: d,
        dateStr,
        dayOfWeek,
        dayOfWeekBn: WEEKDAY_NAMES_BN[dayOfWeek] || '',
        isFriday: dayOfWeek === 5,
        isToday: dateStr === todayIso,
        isFuture: dateStr > todayIso,
      });
    }
    return list;
  }, [selectedYear, selectedMonth, todayIso]);

  // Index attendance records for O(1) lookup behind getAttendance()
  const attendanceLookup = useMemo(() => {
    const map = new Map<string, AttendanceCode>();
    for (const rec of attendanceRecords) {
      if (!rec.date || !rec.traineeId || !rec.batchId) continue;
      const parts = rec.date.split('-');
      if (parts.length !== 3) continue;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!y || !m || !d) continue;

      const code: AttendanceCode =
        rec.status === 'Present'
          ? 'P'
          : rec.status === 'Absent'
            ? 'A'
            : rec.status === 'Leave'
              ? 'L'
              : '';
      if (code) {
        map.set(`${rec.batchId}|${y}|${m}|${rec.traineeId}|${d}`, code);
      }
    }
    return map;
  }, [attendanceRecords]);

  // Single data access function (excludes Fridays & future days)
  const getAttendance: GetAttendanceFn = useCallback(
    (batchId, year, month, studentId, day) => {
      const dateObj = new Date(year, month - 1, day);
      if (dateObj.getDay() === 5) return '';
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
      if (dateStr > todayIso) return '';
      return attendanceLookup.get(`${batchId}|${year}|${month}|${studentId}|${day}`) || '';
    },
    [attendanceLookup, todayIso]
  );

  // Per-student derived rows
  const allRows = useMemo<StudentRegisterRow[]>(() => {
    return trainees.map((trainee) => {
      let present = 0;
      let absent = 0;
      let leave = 0;

      for (const d of daysList) {
        const code = getAttendance(selectedBatch, selectedYear, selectedMonth, trainee.id, d.day);
        if (code === 'P') present++;
        else if (code === 'A') absent++;
        else if (code === 'L') leave++;
      }

      const totalRecorded = present + absent + leave;
      const rate = totalRecorded > 0 ? Math.round((present / totalRecorded) * 100) : null;

      return { trainee, present, absent, leave, totalRecorded, rate };
    });
  }, [trainees, daysList, getAttendance, selectedBatch, selectedYear, selectedMonth]);

  // Filtered rows
  const visibleRows = useMemo(() => {
    if (rateFilter === 'all') return allRows;
    if (rateFilter === 'high_90') {
      return allRows.filter((r) => r.rate !== null && r.rate >= 90);
    }
    if (rateFilter === 'low_75') {
      return allRows.filter((r) => r.rate !== null && r.rate < 75);
    }
    return allRows.filter((r) => r.totalRecorded === 0);
  }, [allRows, rateFilter]);

  // Daily totals (across visible students; Fridays/future already excluded by getAttendance)
  const dailyTotals = useMemo(() => {
    const out: Record<number, { present: number; absent: number }> = {};
    for (const d of daysList) {
      let present = 0;
      let absent = 0;
      for (const r of visibleRows) {
        const code = getAttendance(selectedBatch, selectedYear, selectedMonth, r.trainee.id, d.day);
        if (code === 'P') present++;
        else if (code === 'A') absent++;
      }
      out[d.day] = { present, absent };
    }
    return out;
  }, [daysList, visibleRows, getAttendance, selectedBatch, selectedYear, selectedMonth]);

  // Top KPI summary across visible students & batch days with data
  const summaryStats = useMemo(() => {
    let takenDaysCount = 0;
    for (const d of daysList) {
      if (d.isFriday || d.isFuture) continue;
      const hasAnyMark = allRows.some(
        (r) => getAttendance(selectedBatch, selectedYear, selectedMonth, r.trainee.id, d.day) !== ''
      );
      if (hasAnyMark) takenDaysCount++;
    }

    let visiblePresentSum = 0;
    let visibleMarksSum = 0;
    let totalAbsences = 0;

    for (const r of visibleRows) {
      visiblePresentSum += r.present;
      visibleMarksSum += r.totalRecorded;
      totalAbsences += r.absent;
    }

    const avgRate =
      visibleMarksSum > 0 ? Math.round((visiblePresentSum / visibleMarksSum) * 100) : 0;

    return {
      totalStudents: trainees.length,
      takenDaysCount,
      avgRate,
      totalAbsences,
    };
  }, [daysList, allRows, visibleRows, trainees.length, getAttendance, selectedBatch, selectedYear, selectedMonth]);

  const currentBatch = batches.find((b) => b.id === selectedBatch);
  const currentInstitute = institutes.find((i) => i.id === currentBatch?.instituteId);
  const currentTrade = trades.find((t) => t.id === currentBatch?.tradeId);

  const availableBatches = useMemo(() => {
    if (isTrainer) {
      if (userProfile?.batchId) {
        return batches.filter((b) => b.id === userProfile.batchId);
      }
      if (userProfile?.instituteId) {
        return batches.filter((b) => b.instituteId === userProfile.instituteId);
      }
    }
    return batches;
  }, [batches, isTrainer, userProfile?.batchId, userProfile?.instituteId]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
    setScrollTrigger((c) => c + 1);
  };

  const handlePrint = async () => {
    const monthPad = String(selectedMonth).padStart(2, '0');
    const html = buildRegisterHtml({
      year: selectedYear,
      month: selectedMonth,
      batchId: selectedBatch,
      batchName: currentBatch?.name || '',
      tradeName: currentTrade?.name || 'ট্রেড',
      instituteName: currentInstitute?.name || 'প্রতিষ্ঠান',
      daysList: hideFridays ? daysList.filter((d) => !d.isFriday) : daysList,
      rows: visibleRows,
      getAttendance,
      dailyTotals,
    });
    await printCustomHtmlDocument({
      html,
      jobName: `attendance-${selectedYear}-${monthPad}`,
      landscape: true,
    });
  };

  if (loading) {
    return (
      <div className="register-theme min-h-screen bg-[var(--reg-bg)] text-[var(--reg-text)]">
        <Header
          role={userProfile?.role}
          resolvedMode={resolvedMode}
          onToggleTheme={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
        />
        <div className="max-w-6xl mx-auto p-4 space-y-3">
          <div className="h-12 rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] animate-pulse" />
          <div className="h-24 rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] animate-pulse" />
          <div className="grid grid-cols-2 min-[700px]:grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-theme min-h-screen bg-[var(--reg-bg)] text-[var(--reg-text)] font-sans">
      {/* 1. Sticky Header (54px, mobile/tablet) */}
      <Header
        role={userProfile?.role}
        resolvedMode={resolvedMode}
        onToggleTheme={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
      />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-2 pt-3 pb-[calc(5.2rem+env(safe-area-inset-bottom,0px))] lg:pb-6 space-y-3">
        {/* 2. Title Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <TruncatedText
              as="h1"
              text="হাজিরা শিট"
              mode="pop"
              className="text-[20px] sm:text-[22px] font-semibold text-[var(--reg-text)] leading-tight"
            />
            <TruncatedText
              as="p"
              text="মাসিক হাজিরা খাতা ও উপস্থিতি বিবরণী"
              mode="pop"
              className="text-[12.5px] text-[var(--reg-muted)] mt-0.5"
            />
          </div>

          <Link
            to="/attendance"
            className="min-h-[42px] px-4 rounded-[14px] bg-[var(--reg-accent)] text-white dark:text-slate-950 text-[13.5px] font-medium inline-flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)] print:hidden"
          >
            <CalendarCheck size={16} />
            <span>হাজিরা নিন</span>
          </Link>
        </div>

        {/* 3. Info Card + Three-Dot Menu Popover */}
        <InfoCard
          tradeName={currentTrade?.name || 'ট্রেড'}
          instituteName={currentInstitute?.name || 'প্রতিষ্ঠান'}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((prev) => !prev)}
          menuButtonRef={menuButtonRef}
        >
          <MenuPopover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            triggerRef={menuButtonRef}
            batches={availableBatches}
            selectedBatchId={selectedBatch}
            onSelectBatch={(bid) => setSelectedBatch(bid)}
            canSwitchBatch={!isTrainer && availableBatches.length > 1}
            year={selectedYear}
            month={selectedMonth}
            onChangeYear={setSelectedYear}
            onChangeMonth={setSelectedMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onJumpToCurrentMonth={handleJumpToCurrentMonth}
            hideFridays={hideFridays}
            onToggleHideFridays={() => setHideFridays((v) => !v)}
            hideSummary={hideSummary}
            onToggleHideSummary={() => setHideSummary((v) => !v)}
            compactRows={compactRows}
            onToggleCompactRows={() => setCompactRows((v) => !v)}
            onPrint={handlePrint}
            canExport={canExport}
            onOpenExport={() => setExportOpen(true)}
          />
        </InfoCard>

        {/* 4. Stats (2x2 mobile, 4 columns >= 700px) */}
        <Stats
          totalStudents={summaryStats.totalStudents}
          takenDaysCount={summaryStats.takenDaysCount}
          avgRate={summaryStats.avgRate}
          totalAbsences={summaryStats.totalAbsences}
        />

        {/* 5. Month Heading + Filter Chips */}
        <FilterChips
          year={selectedYear}
          month={selectedMonth}
          activeFilter={rateFilter}
          onChangeFilter={setRateFilter}
        />

        {/* 6. Register Table */}
        <RegisterTable
          batchId={selectedBatch}
          year={selectedYear}
          month={selectedMonth}
          daysList={daysList}
          rows={visibleRows}
          getAttendance={getAttendance}
          dailyTotals={dailyTotals}
          hideFridays={hideFridays}
          hideSummary={hideSummary}
          compactRows={compactRows}
          loading={fetchingData}
          scrollTrigger={scrollTrigger}
        />

        {/* 7. Footnote */}
        <p className="text-[12px] text-[var(--reg-muted)] px-1 leading-relaxed">
          এই পাতা শুধু দেখার জন্য। প্রতিদিনের হাজিরা দিতে বা পরিবর্তন করতে উপরের{' '}
          <strong className="font-medium text-[var(--reg-text)]">হাজিরা নিন</strong>{' '}
          বাটন ব্যবহার করুন।
        </p>
      </div>

      {/* Separate Export Format Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        year={selectedYear}
        month={selectedMonth}
        batchId={selectedBatch}
        batchName={currentBatch?.name || ''}
        tradeName={currentTrade?.name || 'ট্রেড'}
        instituteName={currentInstitute?.name || 'প্রতিষ্ঠান'}
        daysList={daysList}
        rows={visibleRows}
        getAttendance={getAttendance}
        dailyTotals={dailyTotals}
      />
    </div>
  );
}
