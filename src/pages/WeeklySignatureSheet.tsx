import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { dataService } from '../lib/dataService';
import type { Batch, Institute, Trade, Trainee, WeeklySignaturePageConfig } from '../types';
import { SetupStep, type BatchPickerOption } from '../components/weekly-signature/SetupStep';
import { ActionBar } from '../components/weekly-signature/ActionBar';
import { SheetPaper } from '../components/weekly-signature/SheetPaper';
import { HeadingSettingsModal } from '../components/weekly-signature/HeadingSettingsModal';
import {
  DEFAULT_SHEET_HEADING,
  buildDocx,
  buildHtml,
  buildPdf,
  getPaperDimensionsMm,
  normalizePageConfig,
  shiftIsoDate,
  toLocalIsoDate,
  weekOf,
  type SignatureSheetHeading,
  type SignatureSheetMeta,
  type SignatureTrainee,
  type WeekDayInfo,
} from '../components/weekly-signature/utils';

interface WeeklySignatureSheetProps {
  embedded?: boolean;
}

const DEFAULT_META: SignatureSheetMeta = {
  instituteName: 'প্রতিষ্ঠান',
  tradeName: 'ট্রেড',
};

const LOCAL_HEADING_STORAGE_PREFIX = 'bnfe_weekly_sheet_heading_';
const LOCAL_PAGE_CONFIG_STORAGE_PREFIX = 'bnfe_weekly_sheet_page_';

function readLocalHeading(userId?: string): Partial<SignatureSheetHeading> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_HEADING_STORAGE_PREFIX}${userId || 'local'}`);
    return raw ? (JSON.parse(raw) as Partial<SignatureSheetHeading>) : null;
  } catch {
    return null;
  }
}

function writeLocalHeading(userId: string | undefined, heading: SignatureSheetHeading) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${LOCAL_HEADING_STORAGE_PREFIX}${userId || 'local'}`,
      JSON.stringify(heading)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function clearLocalHeading(userId: string | undefined) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${LOCAL_HEADING_STORAGE_PREFIX}${userId || 'local'}`);
  } catch {
    // Ignore
  }
}

function readLocalPageConfig(userId?: string): Partial<WeeklySignaturePageConfig> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_PAGE_CONFIG_STORAGE_PREFIX}${userId || 'local'}`);
    return raw ? (JSON.parse(raw) as Partial<WeeklySignaturePageConfig>) : null;
  } catch {
    return null;
  }
}

function writeLocalPageConfig(userId: string | undefined, pageConfig: WeeklySignaturePageConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${LOCAL_PAGE_CONFIG_STORAGE_PREFIX}${userId || 'local'}`,
      JSON.stringify(pageConfig)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function clearLocalPageConfig(userId: string | undefined) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${LOCAL_PAGE_CONFIG_STORAGE_PREFIX}${userId || 'local'}`);
  } catch {
    // Ignore
  }
}

function buildAllCheckedMap(days: WeekDayInfo[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of days) {
    map[d.iso] = true;
  }
  return map;
}

const WeeklySignatureSheet: React.FC<WeeklySignatureSheetProps> = ({ embedded = false }) => {
  const { userProfile } = useAuth();
  const { canViewPage, isCourseDirector: hasCourseDirectorPerm } = usePermissions();
  const { settings, updateSettings } = useSystemSettings();
  const isTrainer = userProfile?.role === 'Trainer';
  const canPersistGlobalHeading =
    userProfile?.role === 'Course Director' || hasCourseDirectorPerm;

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
  const [generating, setGenerating] = useState<'pdf' | 'docx' | 'html' | null>(null);
  const [exportError, setExportError] = useState('');
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [manualZoom, setManualZoom] = useState<number>(1);
  const [effectiveZoom, setEffectiveZoom] = useState<number>(1);

  // Editable page heading & layout config state
  const [headingModalOpen, setHeadingModalOpen] = useState(false);
  const [savingHeading, setSavingHeading] = useState(false);
  const [headingSaveError, setHeadingSaveError] = useState('');
  const [localHeadingOverride, setLocalHeadingOverride] =
    useState<Partial<SignatureSheetHeading> | null>(() => readLocalHeading(userProfile?.id));
  const [localPageOverride, setLocalPageOverride] =
    useState<Partial<WeeklySignaturePageConfig> | null>(() =>
      readLocalPageConfig(userProfile?.id)
    );

  useEffect(() => {
    setLocalHeadingOverride(readLocalHeading(userProfile?.id));
    setLocalPageOverride(readLocalPageConfig(userProfile?.id));
  }, [userProfile?.id]);

  const activeHeading = useMemo<SignatureSheetHeading>(() => {
    const globalHeading = settings.weeklySignatureHeading;
    if (localHeadingOverride) {
      return {
        ...DEFAULT_SHEET_HEADING,
        ...(globalHeading || {}),
        ...localHeadingOverride,
      };
    }
    return {
      ...DEFAULT_SHEET_HEADING,
      ...(globalHeading || {}),
    };
  }, [settings.weeklySignatureHeading, localHeadingOverride]);

  const activePageConfig = useMemo<WeeklySignaturePageConfig>(() => {
    const globalPage = settings.weeklySignaturePageConfig;
    if (localPageOverride) {
      return normalizePageConfig({
        ...(globalPage || {}),
        ...localPageOverride,
        margins: {
          ...(globalPage?.margins || {}),
          ...(localPageOverride.margins || {}),
        },
      } as Partial<WeeklySignaturePageConfig>);
    }
    return normalizePageConfig(globalPage);
  }, [settings.weeklySignaturePageConfig, localPageOverride]);

  const activePaperDims = useMemo(
    () => getPaperDimensionsMm(activePageConfig.paperSize, activePageConfig.orientation),
    [activePageConfig.paperSize, activePageConfig.orientation]
  );

  // Real Firestore collections for batch selection & trainees
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allTrainees, setAllTrainees] = useState<Trainee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  useEffect(() => {
    let active = true;
    const loadMaster = async () => {
      setLoadingData(true);
      try {
        const [instList, tradeList, batchList, traineeList] = await Promise.all([
          dataService.getItems<Institute>('institutes'),
          dataService.getItems<Trade>('trades'),
          dataService.getItems<Batch>('batches'),
          dataService.getItems<Trainee>('trainees'),
        ]);
        if (!active) return;

        setInstitutes(instList);
        setTrades(tradeList);
        setBatches(batchList);
        setAllTrainees(traineeList);
      } catch (err) {
        console.warn('Failed to load weekly signature sheet data:', err);
      } finally {
        if (active) setLoadingData(false);
      }
    };

    loadMaster();
    return () => {
      active = false;
    };
  }, []);

  const availableBatches = useMemo(() => {
    const nonArchived = batches.filter(
      (b) => !b.isArchived || (isTrainer && userProfile?.batchId === b.id)
    );
    if (isTrainer) {
      if (userProfile?.batchId) {
        return nonArchived.filter((b) => b.id === userProfile.batchId);
      }
      if (userProfile?.instituteId) {
        return nonArchived.filter((b) => b.instituteId === userProfile.instituteId);
      }
    }
    return nonArchived.slice().sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'bn', { numeric: true })
    );
  }, [batches, isTrainer, userProfile?.batchId, userProfile?.instituteId]);

  // Keep selectedBatchId valid and initialized
  useEffect(() => {
    if (availableBatches.length === 0) {
      setSelectedBatchId('');
      return;
    }
    if (selectedBatchId && availableBatches.some((b) => b.id === selectedBatchId)) {
      return;
    }
    const preferred =
      (userProfile?.batchId &&
        availableBatches.find((b) => b.id === userProfile.batchId)?.id) ||
      (userProfile?.instituteId &&
        availableBatches.find((b) => b.instituteId === userProfile.instituteId)?.id) ||
      availableBatches[0].id;
    setSelectedBatchId(preferred);
  }, [availableBatches, selectedBatchId, userProfile?.batchId, userProfile?.instituteId]);

  const batchOptions = useMemo<BatchPickerOption[]>(() => {
    const instMap = new Map(institutes.map((i) => [i.id, i.name]));
    const tradeMap = new Map(trades.map((t) => [t.id, t.name]));
    const countMap = new Map<string, number>();

    for (const t of allTrainees) {
      if (t.status && t.status !== 'Active') continue;
      countMap.set(t.batchId, (countMap.get(t.batchId) || 0) + 1);
    }

    return availableBatches.map((b) => {
      const instName = instMap.get(b.instituteId) || DEFAULT_META.instituteName;
      const tradeName = tradeMap.get(b.tradeId) || DEFAULT_META.tradeName;
      return {
        id: b.id,
        label: `${b.name} — ${tradeName}`,
        instituteName: instName,
        tradeName,
        traineeCount: countMap.get(b.id) || 0,
      };
    });
  }, [availableBatches, institutes, trades, allTrainees]);

  const selectedBatch = useMemo(
    () => availableBatches.find((b) => b.id === selectedBatchId) || null,
    [availableBatches, selectedBatchId]
  );

  const meta = useMemo<SignatureSheetMeta>(() => {
    if (!selectedBatch) {
      return {
        ...DEFAULT_META,
        heading: activeHeading,
        pageConfig: activePageConfig,
      };
    }
    const inst = institutes.find((i) => i.id === selectedBatch.instituteId);
    const trade = trades.find((t) => t.id === selectedBatch.tradeId);
    return {
      instituteName: inst?.name || DEFAULT_META.instituteName,
      tradeName: trade?.name || DEFAULT_META.tradeName,
      batchName: selectedBatch.name,
      heading: activeHeading,
      pageConfig: activePageConfig,
    };
  }, [selectedBatch, institutes, trades, activeHeading, activePageConfig]);

  const trainees = useMemo<SignatureTrainee[]>(() => {
    if (!selectedBatchId) return [];
    return allTrainees
      .filter((t) => t.batchId === selectedBatchId && (!t.status || t.status === 'Active'))
      .sort((a, b) =>
        (a.registrationNumber || a.traineeId || a.id).localeCompare(
          b.registrationNumber || b.traineeId || b.id,
          undefined,
          { numeric: true }
        )
      )
      .map((t) => ({
        id: t.id,
        name: t.nameBn || t.nameEn || '—',
      }));
  }, [allTrainees, selectedBatchId]);

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
      await buildPdf(paperRef.current, fileName, activePageConfig);
      setPopoverOpen(false);
    } catch (err) {
      console.error('Weekly signature PDF export failed:', err);
      setExportError('ফাইল তৈরি করা যায়নি। প্রিন্ট থেকে PDF সেভ করে দেখুন।');
    } finally {
      setGenerating(null);
    }
  }, [selectedDays, generating, activePageConfig]);

  const handleSelectDocx = useCallback(async () => {
    if (selectedDays.length === 0 || generating) return;
    const firstIso = selectedDays[0].iso;
    const lastIso = selectedDays[selectedDays.length - 1].iso;
    const fileName = `attendance-sheet-${firstIso}_${lastIso}.docx`;

    setExportError('');
    setGenerating('docx');
    try {
      await buildDocx(selectedDays, trainees, meta, fileName, activePageConfig);
      setPopoverOpen(false);
    } catch (err) {
      console.error('Weekly signature DOCX export failed:', err);
      setExportError('ফাইল তৈরি করা যায়নি। প্রিন্ট থেকে PDF সেভ করে দেখুন।');
    } finally {
      setGenerating(null);
    }
  }, [selectedDays, trainees, meta, generating, activePageConfig]);

  const handleSelectHtml = useCallback(async () => {
    if (selectedDays.length === 0 || generating) return;
    const firstIso = selectedDays[0].iso;
    const lastIso = selectedDays[selectedDays.length - 1].iso;
    const fileName = `attendance-sheet-${firstIso}_${lastIso}.html`;

    setExportError('');
    setGenerating('html');
    try {
      await buildHtml(selectedDays, trainees, meta, fileName, activePageConfig);
      setPopoverOpen(false);
    } catch (err) {
      console.error('Weekly signature HTML export failed:', err);
      setExportError('HTML ফাইল তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setGenerating(null);
    }
  }, [selectedDays, trainees, meta, generating, activePageConfig]);

  const handlePrint = useCallback(() => {
    setPopoverOpen(false);
    setExportError('');
    window.print();
  }, []);

  const handleSaveSettings = useCallback(
    async ({
      heading: nextHeading,
      pageConfig: nextPageConfig,
    }: {
      heading: SignatureSheetHeading;
      pageConfig: WeeklySignaturePageConfig;
    }) => {
      setHeadingSaveError('');
      setSavingHeading(true);
      const normalizedPage = normalizePageConfig(nextPageConfig);
      try {
        if (canPersistGlobalHeading) {
          await updateSettings({
            weeklySignatureHeading: nextHeading,
            weeklySignaturePageConfig: normalizedPage,
          });
          clearLocalHeading(userProfile?.id);
          clearLocalPageConfig(userProfile?.id);
          setLocalHeadingOverride(null);
          setLocalPageOverride(null);
        } else {
          writeLocalHeading(userProfile?.id, nextHeading);
          writeLocalPageConfig(userProfile?.id, normalizedPage);
          setLocalHeadingOverride(nextHeading);
          setLocalPageOverride(normalizedPage);
        }
        setHeadingModalOpen(false);
      } catch (err) {
        console.warn('Could not save settings globally, keeping local fallback:', err);
        writeLocalHeading(userProfile?.id, nextHeading);
        writeLocalPageConfig(userProfile?.id, normalizedPage);
        setLocalHeadingOverride(nextHeading);
        setLocalPageOverride(normalizedPage);
        setHeadingModalOpen(false);
      } finally {
        setSavingHeading(false);
      }
    },
    [canPersistGlobalHeading, updateSettings, userProfile?.id]
  );

  const showReportsBackLink = !embedded && canViewPage('/reports');
  const batchLocked = isTrainer && Boolean(userProfile?.batchId) && availableBatches.length <= 1;

  const printPageRuleCss = `@media print { @page weekly-sheet-a4 { size: ${activePaperDims.cssPageSize} ${activePageConfig.orientation}; margin: ${activePageConfig.margins.top}mm ${activePageConfig.margins.right}mm ${activePageConfig.margins.bottom}mm ${activePageConfig.margins.left}mm; } }`;

  return (
    <div className="weekly-sheet-theme text-[var(--ws-text)] print:bg-white print:text-black print:p-0">
      <style>{printPageRuleCss}</style>

      {showReportsBackLink && (
        <div
          style={step === 'sheet' ? { maxWidth: `${activePaperDims.widthMm}mm` } : undefined}
          className={`mx-auto mb-3 flex items-center print:hidden ${
            step === 'setup' ? 'max-w-2xl' : ''
          }`}
        >
          <Link
            to="/reports"
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[var(--ws-surface)] border border-[var(--ws-border)] text-[13px] font-medium text-[var(--ws-text)] hover:border-[var(--ws-accent)] transition"
          >
            <ArrowLeft size={15} />
            <span>প্রতিবেদন</span>
          </Link>
        </div>
      )}

      {step === 'setup' ? (
        <SetupStep
          batches={batchOptions}
          selectedBatchId={selectedBatchId}
          loadingBatches={loadingData}
          batchLocked={batchLocked}
          onChangeBatch={setSelectedBatchId}
          pickedDateIso={pickedDateIso}
          jumpedFromWeekend={jumpedFromWeekend}
          weekDays={weekDays}
          checkedIsos={checkedIsos}
          selectedCount={selectedDays.length}
          onChangeDate={handleChangeDate}
          onShiftWeek={handleShiftWeek}
          onToggleDay={handleToggleDay}
          onConfirm={handleConfirm}
          onOpenHeadingSettings={() => {
            setHeadingSaveError('');
            setHeadingModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-4 print:space-y-0">
          <ActionBar
            batchName={meta.batchName}
            paperWidthMm={activePaperDims.widthMm}
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
            onSelectHtml={handleSelectHtml}
            onPrint={handlePrint}
            onChangeDates={handleChangeDates}
            onOpenHeadingSettings={() => {
              setPopoverOpen(false);
              setHeadingSaveError('');
              setHeadingModalOpen(true);
            }}
            zoomMode={zoomMode}
            effectiveZoom={effectiveZoom}
            onZoomOut={() => {
              const next = Math.max(0.4, Math.round((effectiveZoom - 0.1) * 10) / 10);
              setManualZoom(next);
              setZoomMode('manual');
            }}
            onZoomIn={() => {
              const next = Math.min(1.8, Math.round((effectiveZoom + 0.1) * 10) / 10);
              setManualZoom(next);
              setZoomMode('manual');
            }}
            onToggleFitZoom={() => {
              if (zoomMode === 'fit') {
                setManualZoom(1);
                setZoomMode('manual');
              } else {
                setZoomMode('fit');
              }
            }}
          />

          <SheetPaper
            paperRef={paperRef}
            days={selectedDays}
            trainees={trainees}
            meta={meta}
            zoomMode={zoomMode}
            manualZoom={manualZoom}
            onEffectiveZoomChange={setEffectiveZoom}
          />
        </div>
      )}

      <HeadingSettingsModal
        open={headingModalOpen}
        heading={activeHeading}
        pageConfig={activePageConfig}
        saving={savingHeading}
        errorMessage={headingSaveError}
        onClose={() => setHeadingModalOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default WeeklySignatureSheet;
