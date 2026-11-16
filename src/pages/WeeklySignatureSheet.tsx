import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { dataService } from '../lib/dataService';
import type { Batch, Institute, Trade } from '../types';
import { SetupStep } from '../components/weekly-signature/SetupStep';
import { ActionBar } from '../components/weekly-signature/ActionBar';
import { SheetPaper } from '../components/weekly-signature/SheetPaper';
import {
  buildDocx,
  buildPdf,
  getTrainees,
  shiftIsoDate,
  toLocalIsoDate,
  weekOf,
  type SignatureSheetMeta,
  type WeekDayInfo,
} from '../components/weekly-signature/utils';

interface WeeklySignatureSheetProps {
  embedded?: boolean;
}

const DEFAULT_META: SignatureSheetMeta = {
  instituteName: 'প্রিমিয়ার আইডিয়ার হাই স্কুল',
  tradeName: 'বিউটি কেয়ার',
};

function buildAllCheckedMap(days: WeekDayInfo[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of days) {
    map[d.iso] = true;
  }
  return map;
}

const WeeklySignatureSheet: React.FC<WeeklySignatureSheetProps> = ({ embedded = false }) => {
  const { userProfile } = useAuth();
  const { canViewPage } = usePermissions();
  const { resolvedMode, setMode } = useTheme();

  // Initial week snapped from today
  const initialWeek = useMemo(() => weekOf(new Date()), []);
  const [pickedDateIso, setPickedDateIso] = useState<string>(() =>
    toLocalIsoDate(new Date())
  );
  const [weekDays, setWeekDays] = useState<WeekDayInfo[]>(initialWeek.days);
  const [jumpedFromWeekend, setJumpedFromWeekend] = useState<boolean>(
    initialWeek.jumpedFromWeekend
  );
  const [checkedIsos, setCheckedIsos] = useState<Record<string, boolean>>(() =>
    buildAllCheckedMap(initialWeek.days)
  );

  // Two-step state: sheet does NOT exist in DOM until confirmed
  const [step, setStep] = useState<'setup' | 'sheet'>('setup');

  // Step 2 export & print state
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [generating, setGenerating] = useState<'pdf' | 'docx' | null>(null);
  const [exportError, setExportError] = useState('');
  const paperRef = useRef<HTMLDivElement | null>(null);

  // Trainee list & institute/trade metadata
  const trainees = useMemo(() => getTrainees(), []);
  const [meta, setMeta] = useState<SignatureSheetMeta>(DEFAULT_META);

  useEffect(() => {
    let active = true;
    const loadMeta = async () => {
      try {
        const [institutes, trades, batches] = await Promise.all([
          dataService.getItems<Institute>('institutes'),
          dataService.getItems<Trade>('trades'),
          dataService.getItems<Batch>('batches'),
        ]);
        if (!active) return;

        const targetBatch = userProfile?.batchId
          ? batches.find((b) => b.id === userProfile.batchId)
          : batches[0];

        const targetInstitute =
          institutes.find(
            (i) => i.id === (userProfile?.instituteId || targetBatch?.instituteId)
          ) || institutes[0];

        const targetTrade =
          trades.find((t) => t.id === targetBatch?.tradeId) || trades[0];

        if (targetInstitute?.name || targetTrade?.name) {
          setMeta({
            instituteName: targetInstitute?.name || DEFAULT_META.instituteName,
            tradeName: targetTrade?.name || DEFAULT_META.tradeName,
          });
        }
      } catch {
        // Keep clean defaults if offline/unseeded
      }
    };

    loadMeta();
    return () => {
      active = false;
    };
  }, [userProfile?.batchId, userProfile?.instituteId]);

  const selectedDays = useMemo(
    () => weekDays.filter((d) => Boolean(checkedIsos[d.iso])),
    [weekDays, checkedIsos]
  );

  const handleChangeDate = useCallback((isoDate: string) => {
    const snapped = weekOf(isoDate);
    setPickedDateIso(snapped.sundayIso);
    setWeekDays(snapped.days);
    setJumpedFromWeekend(snapped.jumpedFromWeekend);
    setCheckedIsos(buildAllCheckedMap(snapped.days));
  }, []);

  const handleShiftWeek = useCallback(
    (deltaWeeks: -1 | 1) => {
      const currentSunday = weekDays[0]?.iso || pickedDateIso;
      const shiftedIso = shiftIsoDate(currentSunday, deltaWeeks * 7);
      const snapped = weekOf(shiftedIso);
      setPickedDateIso(snapped.sundayIso);
      setWeekDays(snapped.days);
      setJumpedFromWeekend(false);
      setCheckedIsos(buildAllCheckedMap(snapped.days));
    },
    [weekDays, pickedDateIso]
  );

  const handleToggleDay = useCallback((iso: string) => {
    setCheckedIsos((prev) => ({
      ...prev,
      [iso]: !prev[iso],
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedDays.length === 0) return;
    setPopoverOpen(false);
    setExportError('');
    setStep('sheet');
  }, [selectedDays.length]);

  const handleChangeDates = useCallback(() => {
    setPopoverOpen(false);
    setExportError('');
    setStep('setup');
  }, []);

  const handleSelectPdf = useCallback(async () => {
    if (!paperRef.current || selectedDays.length === 0 || generating) return;
    const firstIso = selectedDays[0].iso;
    const lastIso = selectedDays[selectedDays.length - 1].iso;
    const fileName = `attendance-sheet-${firstIso}_${lastIso}.pdf`;

    setExportError('');
    setGenerating('pdf');
    try {
      await buildPdf(paperRef.current, fileName);
      setPopoverOpen(false);
    } catch (err) {
      console.error('Weekly signature PDF export failed:', err);
      setExportError('ফাইল তৈরি করা যায়নি। প্রিন্ট থেকে PDF সেভ করে দেখুন।');
    } finally {
      setGenerating(null);
    }
  }, [selectedDays, generating]);

  const handleSelectDocx = useCallback(async () => {
    if (selectedDays.length === 0 || generating) return;
    const firstIso = selectedDays[0].iso;
    const lastIso = selectedDays[selectedDays.length - 1].iso;
    const fileName = `attendance-sheet-${firstIso}_${lastIso}.docx`;

    setExportError('');
    setGenerating('docx');
    try {
      await buildDocx(selectedDays, trainees, meta, fileName);
      setPopoverOpen(false);
    } catch (err) {
      console.error('Weekly signature DOCX export failed:', err);
      setExportError('ফাইল তৈরি করা যায়নি। প্রিন্ট থেকে PDF সেভ করে দেখুন।');
    } finally {
      setGenerating(null);
    }
  }, [selectedDays, trainees, meta, generating]);

  const handlePrint = useCallback(() => {
    setPopoverOpen(false);
    setExportError('');
    window.print();
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  }, [resolvedMode, setMode]);

  const showReportsBackLink = !embedded && canViewPage('/reports');

  return (
    <div
      className={`weekly-sheet-theme bg-[var(--ws-bg)] text-[var(--ws-text)] print:bg-white print:text-black print:p-0 ${
        embedded
          ? 'rounded-[18px] border border-[var(--ws-border)] p-4 sm:p-6 print:border-none print:rounded-none'
          : 'min-h-[calc(100vh-5rem)] rounded-[18px] p-3.5 sm:p-6 print:min-h-0 print:rounded-none'
      }`}
    >
      {/* Subtle utility header (hidden on print) */}
      <div
        className={`mx-auto mb-3.5 flex items-center justify-between gap-2 print:hidden ${
          step === 'setup' ? 'max-w-2xl' : 'max-w-[210mm]'
        }`}
      >
        <div className="min-w-0">
          {showReportsBackLink ? (
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[var(--ws-surface)] border border-[var(--ws-border)] text-[13px] font-medium text-[var(--ws-text)] hover:border-[var(--ws-accent)] transition"
            >
              <ArrowLeft size={15} />
              <span>প্রতিবেদন ও অ্যানালিটিক্স</span>
            </Link>
          ) : (
            <span className="text-[12.5px] font-medium text-[var(--ws-muted)]">
              প্রতিবেদন ও অ্যানালিটিক্স · স্বাক্ষর হাজিরা
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={resolvedMode === 'dark' ? 'লাইট থিম' : 'ডার্ক থিম'}
          title={resolvedMode === 'dark' ? 'লাইট থিম' : 'ডার্ক থিম'}
          className="w-9 h-9 rounded-[10px] bg-[var(--ws-surface)] border border-[var(--ws-border)] text-[var(--ws-text)] hover:border-[var(--ws-accent)] flex items-center justify-center shrink-0 cursor-pointer transition active:scale-95"
        >
          {resolvedMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {step === 'setup' ? (
        <SetupStep
          pickedDateIso={pickedDateIso}
          jumpedFromWeekend={jumpedFromWeekend}
          weekDays={weekDays}
          checkedIsos={checkedIsos}
          selectedCount={selectedDays.length}
          onChangeDate={handleChangeDate}
          onShiftWeek={handleShiftWeek}
          onToggleDay={handleToggleDay}
          onConfirm={handleConfirm}
        />
      ) : (
        <div className="space-y-4 print:space-y-0">
          <ActionBar
            selectedDays={selectedDays}
            popoverOpen={popoverOpen}
            onTogglePopover={() => {
              setExportError('');
              setPopoverOpen((prev) => !prev);
            }}
            onClosePopover={() => setPopoverOpen(false)}
            generating={generating}
            exportError={exportError}
            onSelectPdf={handleSelectPdf}
            onSelectDocx={handleSelectDocx}
            onPrint={handlePrint}
            onChangeDates={handleChangeDates}
          />

          <SheetPaper
            paperRef={paperRef}
            days={selectedDays}
            trainees={trainees}
            meta={meta}
          />
        </div>
      )}
    </div>
  );
};

export default WeeklySignatureSheet;
