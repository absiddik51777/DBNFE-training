import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopyPlus, FileSpreadsheet, Loader2, Printer, Save } from 'lucide-react';
import type {
  AttendanceRecord,
  Batch,
  DocumentPrintConfig,
  Institute,
  ReportTemplate,
  Trade,
  Trainee,
  UserProfile,
  WeeklySignatureHeading,
} from '../../../types';
import { auth } from '../../../lib/firebase';
import { dataService } from '../../../lib/dataService';
import { useConfirm } from '../../../contexts/ConfirmationContext';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { downloadCSV } from '../../../lib/exportUtils';
import { formatBengaliDate, toBn } from '../../../lib/dateUtils';
import { normalizeDocumentPrintConfig } from '../../../lib/documentFrameService';
import { DocumentPrintFrame } from '../../document-frame/DocumentPrintFrame';
import { ReportHeaderBanner } from '../ReportHeaderBanner';
import { DEFAULT_SHEET_PAGE_CONFIG } from '../../weekly-signature/utils';
import { MONTH_NAMES_BN, ReportsToast } from '../types';
import {
  BUILDER_PRESETS,
  buildRowTokenMap,
  columnsUseAttendanceData,
  computeMonthlyAttendanceStatsMap,
  createTemplateFromPreset,
  DEFAULT_OFFICIAL_HEADING,
  formatByDigitMode,
  LastFocusTarget,
  ReportContextTokens,
  ReportRowEntity,
  resolveReportCellValue,
  resolveTokenTemplate,
  sanitizeReportTemplateForSave,
} from './fieldCatalog';
import { TemplateManagerBar } from './TemplateManagerBar';
import { BuilderDataFilterBar } from './BuilderDataFilterBar';
import { BuilderHeadingEditor } from './BuilderHeadingEditor';
import { BuilderColumnsEditor } from './BuilderColumnsEditor';
import { BuilderSignaturesEditor } from './BuilderSignaturesEditor';
import { BuilderCodesPanel } from './BuilderCodesPanel';
import { BuilderPageEditor } from './BuilderPageEditor';

interface CustomReportBuilderProps {
  userProfile: UserProfile | null;
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  trainees: Trainee[];
  attendance: AttendanceRecord[];
  canExport: boolean;
  externalTemplates?: ReportTemplate[];
  loadingExternalTemplates?: boolean;
  requestedTemplateId?: string | null;
  onSyncTemplateId?: (tplId: string | null) => void;
  onNotify: (toast: ReportsToast) => void;
}

type EditorTabId = 'heading' | 'columns' | 'signatures' | 'codes' | 'page';
type MobileViewMode = 'edit' | 'pv';

const EDITOR_TABS: ReadonlyArray<{ id: EditorTabId; label: string }> = [
  { id: 'heading', label: 'শিরোনাম' },
  { id: 'columns', label: 'টেবিল' },
  { id: 'signatures', label: 'স্বাক্ষর' },
  { id: 'codes', label: 'ডাটা কোড' },
  { id: 'page', label: 'পাতা' },
];

function serializeTemplateComparable(t: ReportTemplate): string {
  return JSON.stringify({
    name: t.name,
    dataSource: t.dataSource,
    heading: t.heading,
    columns: t.columns,
    signatures: t.signatures,
    page: t.page,
    useBengaliDigits: t.useBengaliDigits,
  });
}

function cloneTemplate(tpl: ReportTemplate): ReportTemplate {
  return {
    ...tpl,
    heading: {
      ...DEFAULT_OFFICIAL_HEADING,
      ...(tpl.heading || {}),
    },
    columns: (tpl.columns || []).map((c) => ({ ...c })),
    signatures: (tpl.signatures || []).map((s) => ({ ...s })),
    page: normalizeDocumentPrintConfig(tpl.page, 'portrait'),
  };
}

function getAlignClass(align: 'left' | 'center' | 'right'): string {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
}

function getSignatureGridColsClass(count: number): string {
  if (count <= 1) return 'grid-cols-1 max-w-xs mx-auto';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-4';
}

export const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  userProfile,
  institutes,
  trades,
  batches,
  trainees,
  attendance,
  canExport,
  externalTemplates,
  loadingExternalTemplates,
  requestedTemplateId,
  onSyncTemplateId,
  onNotify,
}) => {
  const { confirm } = useConfirm();
  const { settings } = useSystemSettings();
  const isTrainer = userProfile?.role === 'Trainer';
  const currentUid = auth.currentUser?.uid || userProfile?.id || 'system';
  const isPrivilegedRole =
    userProfile?.role === 'Course Director' || userProfile?.role === 'FMA';
  const passThreshold = settings.minAttendancePercentForCert ?? 75;

  const printActionRef = useRef<(() => void) | null>(null);

  // Saved templates from parent or Firestore subscription fallback
  const [internalTemplates, setInternalTemplates] = useState<ReportTemplate[]>([]);
  const [loadingInternalTemplates, setLoadingInternalTemplates] = useState(
    externalTemplates === undefined
  );
  const savedTemplates = externalTemplates ?? internalTemplates;
  const loadingTemplates =
    externalTemplates !== undefined
      ? Boolean(loadingExternalTemplates)
      : loadingInternalTemplates;

  // Active template & editor state
  const [activePresetId, setActivePresetId] = useState<string | null>('proposal');
  const [draft, setDraft] = useState<ReportTemplate>(() =>
    createTemplateFromPreset('proposal', currentUid)
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState<string>(() =>
    serializeTemplateComparable(createTemplateFromPreset('proposal', currentUid))
  );
  const [hasEditedDraft, setHasEditedDraft] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Navigation state matching reference design
  const [editorTab, setEditorTab] = useState<EditorTabId>('heading');
  const [mobileView, setMobileView] = useState<MobileViewMode>(() =>
    requestedTemplateId ? 'pv' : 'edit'
  );
  const [lastFocusTarget, setLastFocusTarget] = useState<LastFocusTarget | null>(null);
  const appliedRequestRef = useRef<string | null>(null);

  // Data filter state
  const now = useMemo(() => new Date(), []);
  const [filterInstitute, setFilterInstitute] = useState<string>(() =>
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : ''
  );
  const [filterTrade, setFilterTrade] = useState<string>('');
  const [filterBatch, setFilterBatch] = useState<string>(() =>
    isTrainer && userProfile?.batchId ? userProfile.batchId : ''
  );
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [selectedYear, setSelectedYear] = useState<number>(() => now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => now.getMonth() + 1);

  // Fallback subscription only when externalTemplates is not supplied
  useEffect(() => {
    if (externalTemplates !== undefined) return;
    let active = true;
    const unsubscribe = dataService.subscribeCollection<ReportTemplate>(
      'report_templates',
      (items) => {
        if (!active) return;
        const sorted = [...items].sort(
          (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        );
        setInternalTemplates(sorted);
        setLoadingInternalTemplates(false);
      },
      (err) => {
        if (!active) return;
        console.warn('Failed to subscribe report_templates:', err);
        setLoadingInternalTemplates(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [externalTemplates]);

  useEffect(() => {
    if (!requestedTemplateId) {
      appliedRequestRef.current = null;
      return;
    }
    if (appliedRequestRef.current === requestedTemplateId) return;
    const found = savedTemplates.find((t) => t.id === requestedTemplateId);
    if (!found) return;
    appliedRequestRef.current = requestedTemplateId;
    const cloned = cloneTemplate(found);
    setDraft(cloned);
    setSelectedTemplateId(found.id);
    setActivePresetId(null);
    setSavedSnapshotJson(serializeTemplateComparable(cloned));
    setHasEditedDraft(false);
    setLastFocusTarget(null);
    setMobileView('pv');
  }, [requestedTemplateId, savedTemplates]);

  useEffect(() => {
    if (isTrainer && userProfile?.instituteId) {
      setFilterInstitute(userProfile.instituteId);
    }
    if (isTrainer && userProfile?.batchId) {
      setFilterBatch(userProfile.batchId);
    }
  }, [isTrainer, userProfile?.instituteId, userProfile?.batchId]);

  const selectedTemplate = useMemo(
    () => savedTemplates.find((t) => t.id === selectedTemplateId) || null,
    [savedTemplates, selectedTemplateId]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedTemplateId) return hasEditedDraft;
    return serializeTemplateComparable(draft) !== savedSnapshotJson;
  }, [draft, savedSnapshotJson, selectedTemplateId, hasEditedDraft]);

  const canModifySelected = useMemo(() => {
    if (!selectedTemplate) return true;
    return isPrivilegedRole || selectedTemplate.createdBy === currentUid;
  }, [selectedTemplate, isPrivilegedRole, currentUid]);

  const updateDraft = useCallback(
    (updater: (prev: ReportTemplate) => ReportTemplate) => {
      setHasEditedDraft(true);
      setDraft((prev) => updater(prev));
    },
    []
  );

  const handleSelectSavedTemplate = (tpl: ReportTemplate) => {
    const cloned = cloneTemplate(tpl);
    appliedRequestRef.current = tpl.id;
    setDraft(cloned);
    setSelectedTemplateId(tpl.id);
    setActivePresetId(null);
    setSavedSnapshotJson(serializeTemplateComparable(cloned));
    setHasEditedDraft(false);
    setLastFocusTarget(null);
    onSyncTemplateId?.(tpl.id);
  };

  const handleStartFromPreset = (presetId: string) => {
    const fresh = createTemplateFromPreset(presetId, currentUid);
    appliedRequestRef.current = null;
    setDraft(fresh);
    setSelectedTemplateId(null);
    setActivePresetId(presetId);
    setSavedSnapshotJson(serializeTemplateComparable(fresh));
    setHasEditedDraft(false);
    setLastFocusTarget(null);
    onSyncTemplateId?.(null);
  };

  const focusNameInput = () => {
    const input = document.getElementById('crb-tpl-name') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSaveTemplate = async () => {
    if (saving || deleting) return;
    if (!draft.name.trim()) {
      focusNameInput();
      onNotify({ type: 'error', message: 'আগে টেমপ্লেটের নাম লিখুন।' });
      return;
    }

    const activeUid = auth.currentUser?.uid;
    if (!activeUid) {
      onNotify({
        type: 'error',
        message: 'সেশন যাচাই হয়নি। অনুগ্রহ করে পুনরায় লগইন করে চেষ্টা করুন।',
      });
      return;
    }

    const isUpdate = Boolean(selectedTemplateId && selectedTemplate);
    if (isUpdate && !canModifySelected) {
      onNotify({
        type: 'error',
        message: 'অন্যের টেমপ্লেট সরাসরি আপডেট করা যাবে না। "নতুন হিসেবে সেভ" ব্যবহার করুন।',
      });
      return;
    }

    setSaving(true);
    try {
      const nowMs = Date.now();
      const targetId = isUpdate
        ? selectedTemplate!.id
        : `RPT_TPL_${nowMs}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const payload = sanitizeReportTemplateForSave(draft, {
        id: targetId,
        createdBy: isUpdate ? selectedTemplate!.createdBy || activeUid : activeUid,
        createdAt: isUpdate ? selectedTemplate!.createdAt || nowMs : nowMs,
        ...(isUpdate ? { updatedAt: nowMs } : {}),
      });

      const saved = await dataService.saveItem<ReportTemplate>('report_templates', payload, {
        module: 'settings',
        title: isUpdate
          ? 'কাস্টম রিপোর্ট টেমপ্লেট আপডেট করা হয়েছে'
          : 'নতুন কাস্টম রিপোর্ট টেমপ্লেট তৈরি করা হয়েছে',
        targetLabel: payload.name,
      });

      const clonedSaved = cloneTemplate(saved);
      appliedRequestRef.current = saved.id;
      setDraft(clonedSaved);
      setSelectedTemplateId(saved.id);
      setActivePresetId(null);
      setSavedSnapshotJson(serializeTemplateComparable(clonedSaved));
      setHasEditedDraft(false);
      onSyncTemplateId?.(saved.id);

      onNotify({
        type: 'success',
        message: isUpdate
          ? `"${payload.name}" টেমপ্লেট সফলভাবে আপডেট হয়েছে।`
          : `"${payload.name}" ডাটাবেইজে সংরক্ষিত হয়েছে। এখন যেকোনো সময় পুনর্ব্যবহার করা যাবে।`,
      });
    } catch (err: unknown) {
      onNotify({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (saving || deleting) return;
    if (!draft.name.trim()) {
      focusNameInput();
      onNotify({ type: 'error', message: 'আগে নতুন টেমপ্লেটের নাম লিখুন।' });
      return;
    }

    const activeUid = auth.currentUser?.uid;
    if (!activeUid) {
      onNotify({
        type: 'error',
        message: 'সেশন যাচাই হয়নি। অনুগ্রহ করে পুনরায় লগইন করে চেষ্টা করুন।',
      });
      return;
    }

    setSaving(true);
    try {
      const nowMs = Date.now();
      const newId = `RPT_TPL_${nowMs}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const baseName =
        selectedTemplate && draft.name.trim() === selectedTemplate.name.trim()
          ? `${draft.name.trim()} (কপি)`
          : draft.name.trim();

      const payload = sanitizeReportTemplateForSave(
        { ...draft, name: baseName },
        {
          id: newId,
          createdBy: activeUid,
          createdAt: nowMs,
        }
      );

      const saved = await dataService.saveItem<ReportTemplate>('report_templates', payload, {
        module: 'settings',
        title: 'কাস্টম রিপোর্ট টেমপ্লেট (কপি) তৈরি করা হয়েছে',
        targetLabel: payload.name,
      });

      const clonedSaved = cloneTemplate(saved);
      appliedRequestRef.current = saved.id;
      setDraft(clonedSaved);
      setSelectedTemplateId(saved.id);
      setActivePresetId(null);
      setSavedSnapshotJson(serializeTemplateComparable(clonedSaved));
      setHasEditedDraft(false);
      onSyncTemplateId?.(saved.id);

      onNotify({
        type: 'success',
        message: `"${payload.name}" নতুন টেমপ্লেট হিসেবে সংরক্ষিত হয়েছে।`,
      });
    } catch (err: unknown) {
      onNotify({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'নতুন টেমপ্লেট সংরক্ষণ করা যায়নি।',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedTemplate || saving || deleting || !canModifySelected) return;
    const confirmed = await confirm({
      title: 'টেমপ্লেট মুছে ফেলবেন?',
      message: `"${selectedTemplate.name}" টেমপ্লেটটি স্থায়ীভাবে ডাটাবেইজ থেকে মুছে যাবে।`,
      detail: 'মুছে ফেলার পর এটি আর সংরক্ষিত তালিকায় পাওয়া যাবে না।',
      confirmText: 'হ্যাঁ, মুছে ফেলুন',
      cancelText: 'বাতিল',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await dataService.deleteItem('report_templates', selectedTemplate.id, false, {
        module: 'settings',
        title: 'কাস্টম রিপোর্ট টেমপ্লেট মুছে ফেলা হয়েছে',
        targetLabel: selectedTemplate.name,
      });

      const deletedName = selectedTemplate.name;
      handleStartFromPreset('proposal');
      onNotify({
        type: 'success',
        message: `"${deletedName}" টেমপ্লেট মুছে ফেলা হয়েছে।`,
      });
    } catch (err: unknown) {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'মুছতে ব্যর্থ হয়েছে।',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Lookup maps
  const institutesById = useMemo(
    () => new Map(institutes.map((i) => [i.id, i])),
    [institutes]
  );
  const tradesById = useMemo(
    () => new Map(trades.map((t) => [t.id, t])),
    [trades]
  );
  const batchesById = useMemo(
    () => new Map(batches.map((b) => [b.id, b])),
    [batches]
  );

  const effectiveInstitute =
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : filterInstitute;
  const effectiveBatch =
    isTrainer && userProfile?.batchId ? userProfile.batchId : filterBatch;

  const filteredTrainees = useMemo(() => {
    return trainees
      .filter((t) => {
        if (t.status === 'Archived') return false;
        if (effectiveInstitute && t.instituteId !== effectiveInstitute) return false;
        if (filterTrade && t.tradeId !== filterTrade) return false;
        if (effectiveBatch && t.batchId !== effectiveBatch) return false;
        if (statusFilter !== 'all' && (t.status || 'Active') !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.registrationNumber || a.traineeId || a.id).localeCompare(
          b.registrationNumber || b.traineeId || b.id,
          undefined,
          { numeric: true }
        )
      );
  }, [trainees, effectiveInstitute, filterTrade, effectiveBatch, statusFilter]);

  const monthPrefix = useMemo(
    () => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
    [selectedYear, selectedMonth]
  );

  const needsAttendance = useMemo(
    () =>
      draft.dataSource === 'attendance-summary' ||
      columnsUseAttendanceData(draft.columns),
    [draft.dataSource, draft.columns]
  );

  const attendanceStatsMap = useMemo(() => {
    if (!needsAttendance) return null;
    return computeMonthlyAttendanceStatsMap(filteredTrainees, attendance, monthPrefix);
  }, [needsAttendance, filteredTrainees, attendance, monthPrefix]);

  const reportRows = useMemo<ReportRowEntity[]>(() => {
    return filteredTrainees.map((trainee) => ({
      trainee,
      attendanceStats: attendanceStatsMap?.get(trainee.id),
    }));
  }, [filteredTrainees, attendanceStatsMap]);

  // Contextual metadata for {{tokens}}
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }, []);

  const selectedBatchObj = effectiveBatch ? batchesById.get(effectiveBatch) : undefined;
  const activeInstLabel = effectiveInstitute
    ? institutesById.get(effectiveInstitute)?.name || 'নির্বাচিত'
    : selectedBatchObj
    ? institutesById.get(selectedBatchObj.instituteId)?.name || 'সকল প্রতিষ্ঠান'
    : 'সকল প্রতিষ্ঠান';
  const activeTradeLabel = filterTrade
    ? tradesById.get(filterTrade)?.name || 'নির্বাচিত'
    : selectedBatchObj
    ? tradesById.get(selectedBatchObj.tradeId)?.name || 'সকল ট্রেড'
    : 'সকল ট্রেড';
  const activeBatchLabel = selectedBatchObj ? selectedBatchObj.name : 'সকল ব্যাচ';

  const selectedMonthLabel = `${MONTH_NAMES_BN[selectedMonth - 1] || ''} ${formatByDigitMode(
    selectedYear,
    draft.useBengaliDigits
  )}`;

  const maxRecordedWorkDays = useMemo(() => {
    if (!attendanceStatsMap || attendanceStatsMap.size === 0) return 0;
    let maxDays = 0;
    attendanceStatsMap.forEach((st) => {
      if (st.totalClasses > maxDays) maxDays = st.totalClasses;
    });
    return maxDays;
  }, [attendanceStatsMap]);

  const docContext = useMemo<ReportContextTokens>(() => {
    const yr = selectedYear;
    const fyFallback = `${yr}-${yr + 1}`;
    const rawFy = selectedBatchObj?.fiscalYear || fyFallback;
    const trainerName =
      selectedBatchObj?.skillTrainerName ||
      selectedBatchObj?.literacyTrainerName ||
      (isTrainer && userProfile?.name) ||
      'প্রশিক্ষক';

    let brnVerifiedCount = 0;
    let brnInvalidCount = 0;
    let brnPendingCount = 0;
    for (const r of reportRows) {
      if (r.trainee.is_brn_verified === true) brnVerifiedCount += 1;
      else if (r.trainee.is_brn_verified === false) brnInvalidCount += 1;
      else brnPendingCount += 1;
    }

    return {
      institute: activeInstLabel,
      trade: activeTradeLabel,
      batch: activeBatchLabel,
      month: selectedMonthLabel,
      fiscalYear: formatByDigitMode(rawFy, draft.useBengaliDigits),
      date: formatBengaliDate(todayIso),
      total: formatByDigitMode(reportRows.length, draft.useBengaliDigits),
      workDays: formatByDigitMode(maxRecordedWorkDays, draft.useBengaliDigits),
      pass: formatByDigitMode(passThreshold, draft.useBengaliDigits),
      trainer: trainerName,
      brnVerifiedTotal: formatByDigitMode(brnVerifiedCount, draft.useBengaliDigits),
      brnPendingTotal: formatByDigitMode(brnPendingCount, draft.useBengaliDigits),
      brnInvalidTotal: formatByDigitMode(brnInvalidCount, draft.useBengaliDigits),
    };
  }, [
    activeInstLabel,
    activeTradeLabel,
    activeBatchLabel,
    selectedMonthLabel,
    selectedBatchObj,
    selectedYear,
    draft.useBengaliDigits,
    todayIso,
    reportRows,
    maxRecordedWorkDays,
    passThreshold,
    isTrainer,
    userProfile?.name,
  ]);

  const sampleRowTokens = useMemo<Record<string, string>>(() => {
    const firstRow = reportRows[0];
    if (!firstRow) {
      return {
        serial: formatByDigitMode(1, draft.useBengaliDigits),
        nameBn: 'মোছা. রুনা আক্তার',
        nameEn: 'Mst. Runa Akter',
        fatherNameBn: 'আব্দুল করিম',
        fatherNameEn: 'Abdul Karim',
        motherNameBn: 'সালমা বেগম',
        motherNameEn: 'Salma Begum',
        traineeId: 'T-0101',
        registrationNumber: formatByDigitMode('260101', draft.useBengaliDigits),
        mobileNumber: '01712-345601',
        nid: formatByDigitMode('20051234567890123', draft.useBengaliDigits),
        docType: 'জন্ম নিবন্ধন (BRN)',
        brnStatus: 'যাচাইকৃত',
        brnStatusEn: 'Verified',
        brnRemark: 'তথ্য সঠিক পাওয়া গেছে',
        brnVerifiedAt: formatByDigitMode('27/11/2026', draft.useBengaliDigits),
        brnVerifiedBy: 'Course Director',
        gender: 'নারী',
        genderEn: 'Female',
        dob: formatByDigitMode('05/03/2005', draft.useBengaliDigits),
        age: formatByDigitMode(21, draft.useBengaliDigits),
        address: 'ত্রিশাল, ময়মনসিংহ',
        addressEn: 'Trishal, Mymensingh',
        permanentAddress: 'ত্রিশাল, ময়মনসিংহ',
        permanentAddressEn: 'Trishal, Mymensingh',
        tradeName: 'কম্পিউটার অফিস অ্যাপ্লিকেশন',
        tradeNameEn: 'Computer Office Application',
        presentDays: formatByDigitMode(21, draft.useBengaliDigits),
        absentDays: formatByDigitMode(1, draft.useBengaliDigits),
        leaveDays: formatByDigitMode(0, draft.useBengaliDigits),
        totalDays: formatByDigitMode(22, draft.useBengaliDigits),
        pct: formatByDigitMode(95, draft.useBengaliDigits),
        eligible: 'যোগ্য',
      };
    }
    return buildRowTokenMap({
      rowIndex: 0,
      row: firstRow,
      institutesById,
      tradesById,
      batchesById,
      useBengaliDigits: draft.useBengaliDigits,
      passThreshold,
    });
  }, [
    reportRows,
    draft.useBengaliDigits,
    institutesById,
    tradesById,
    batchesById,
    passThreshold,
  ]);

  // Copy & Quick-Insert handlers for ডাটা কোড tab
  const handleCopyCode = async (codeKey: string) => {
    const token = `{{${codeKey}}}`;
    try {
      await navigator.clipboard.writeText(token);
      onNotify({ type: 'success', message: `${token} ক্লিপবোর্ডে কপি হয়েছে` });
    } catch {
      onNotify({ type: 'success', message: `কোড: ${token}` });
    }
  };

  const handleInsertCode = (codeKey: string) => {
    const token = `{{${codeKey}}}`;
    if (!lastFocusTarget) {
      void handleCopyCode(codeKey);
      return;
    }

    if (lastFocusTarget.kind === 'heading') {
      updateDraft((prev) => ({
        ...prev,
        heading: {
          ...prev.heading,
          [lastFocusTarget.key]: `${prev.heading[lastFocusTarget.key] || ''}${token}`,
        },
      }));
      onNotify({
        type: 'success',
        message: `${token} যোগ হয়েছে — শিরোনাম ট্যাবে দেখুন`,
      });
      return;
    }

    if (lastFocusTarget.kind === 'column') {
      const col = draft.columns[lastFocusTarget.index];
      if (!col) {
        void handleCopyCode(codeKey);
        return;
      }
      updateDraft((prev) => ({
        ...prev,
        columns: prev.columns.map((c, idx) =>
          idx === lastFocusTarget.index
            ? { ...c, [lastFocusTarget.key]: `${c[lastFocusTarget.key] || ''}${token}` }
            : c
        ),
      }));
      onNotify({
        type: 'success',
        message: `${token} যোগ হয়েছে — টেবিল ট্যাবে দেখুন`,
      });
      return;
    }

    if (lastFocusTarget.kind === 'signature') {
      const sig = draft.signatures[lastFocusTarget.index];
      if (!sig) {
        void handleCopyCode(codeKey);
        return;
      }
      updateDraft((prev) => ({
        ...prev,
        signatures: prev.signatures.map((s, idx) =>
          idx === lastFocusTarget.index
            ? { ...s, [lastFocusTarget.key]: `${s[lastFocusTarget.key] || ''}${token}` }
            : s
        ),
      }));
      onNotify({
        type: 'success',
        message: `${token} যোগ হয়েছে — স্বাক্ষর ট্যাবে দেখুন`,
      });
    }
  };

  // Column widths normalized to sum to 100%
  const columnWidthPercents = useMemo(() => {
    const cols = draft.columns;
    if (cols.length === 0) return [];
    const total = Math.max(
      1,
      cols.reduce((sum, c) => sum + Math.max(1, Number(c.widthWeight) || 1), 0)
    );
    let assigned = 0;
    return cols.map((col, idx) => {
      if (idx === cols.length - 1) {
        return `${Math.max(1, Number((100 - assigned).toFixed(2)))}%`;
      }
      const pct = Number(
        ((Math.max(1, Number(col.widthWeight) || 1) / total) * 100).toFixed(2)
      );
      assigned += pct;
      return `${pct}%`;
    });
  }, [draft.columns]);

  // DocumentPrintFrame bridge
  const resolvedTitle = resolveTokenTemplate(
    draft.heading.reportTitle.trim() || draft.name.trim() || 'কাস্টম প্রতিবেদন',
    docContext
  );

  const frameHeading = useMemo<WeeklySignatureHeading>(
    () => ({
      govtTitle: draft.heading.govtTitle,
      officeTitle: draft.heading.officeTitle,
      officeAddress: draft.heading.officeAddress,
      programTitle: draft.heading.programTitle,
      sheetTitle: draft.heading.reportTitle,
      leftLogoUrl: draft.heading.leftLogoUrl,
      rightLogoUrl: draft.heading.rightLogoUrl,
      logoSizePx: draft.heading.logoSizePx,
    }),
    [draft.heading]
  );

  const handleFrameConfigChange = (nextConfig: DocumentPrintConfig) => {
    updateDraft((prev) => ({
      ...prev,
      page: normalizeDocumentPrintConfig(nextConfig, prev.page.orientation),
    }));
  };

  const handleFrameHeadingChange = (nextHeading: WeeklySignatureHeading) => {
    updateDraft((prev) => ({
      ...prev,
      heading: {
        ...prev.heading,
        govtTitle: nextHeading.govtTitle,
        officeTitle: nextHeading.officeTitle,
        officeAddress: nextHeading.officeAddress,
        programTitle: nextHeading.programTitle,
        reportTitle: nextHeading.sheetTitle,
        leftLogoUrl: nextHeading.leftLogoUrl,
        rightLogoUrl: nextHeading.rightLogoUrl,
        logoSizePx: nextHeading.logoSizePx,
      },
    }));
  };

  const handleResetFilters = () => {
    if (!(isTrainer && userProfile?.instituteId)) setFilterInstitute('');
    setFilterTrade('');
    if (!(isTrainer && userProfile?.batchId)) setFilterBatch('');
    setStatusFilter('Active');
    const current = new Date();
    setSelectedYear(current.getFullYear());
    setSelectedMonth(current.getMonth() + 1);
  };

  const handleExportCSV = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      const headers = draft.columns.map((c) =>
        resolveTokenTemplate(c.label, docContext)
      );
      const csvRows = reportRows.map((row, idx) =>
        draft.columns.map((col) =>
          resolveReportCellValue({
            rowIndex: idx,
            row,
            col,
            institutesById,
            tradesById,
            batchesById,
            useBengaliDigits: draft.useBengaliDigits,
            passThreshold,
            docContext,
          })
        )
      );

      const safeTitle = (draft.name || resolvedTitle || 'custom_report')
        .trim()
        .replace(/[^\w\u0980-\u09FF-]+/g, '_');

      const res = await downloadCSV(`bnfe_${safeTitle}`, headers, csvRows);
      onNotify({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch (err: unknown) {
      onNotify({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'CSV ফাইল তৈরি করা সম্ভব হয়নি। আবার চেষ্টা করুন।',
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleTriggerPrint = () => {
    if (mobileView !== 'pv') {
      setMobileView('pv');
      window.setTimeout(() => {
        printActionRef.current?.();
      }, 180);
      return;
    }
    printActionRef.current?.();
  };

  const measureKey = useMemo(
    () =>
      [
        draft.id || activePresetId || 'draft',
        mobileView,
        draft.dataSource,
        draft.useBengaliDigits ? 'bn' : 'en',
        JSON.stringify(draft.heading),
        JSON.stringify(draft.columns),
        JSON.stringify(draft.signatures),
        effectiveInstitute,
        filterTrade,
        effectiveBatch,
        statusFilter,
        monthPrefix,
        passThreshold,
        reportRows.length,
      ].join('|'),
    [
      draft.id,
      activePresetId,
      mobileView,
      draft.dataSource,
      draft.useBengaliDigits,
      draft.heading,
      draft.columns,
      draft.signatures,
      effectiveInstitute,
      filterTrade,
      effectiveBatch,
      statusFilter,
      monthPrefix,
      passThreshold,
      reportRows.length,
    ]
  );

  const safeFilePrefix = useMemo(() => {
    const cleaned = (draft.name || resolvedTitle || 'Custom_Report')
      .trim()
      .replace(/[^\w\u0980-\u09FF-]+/g, '_');
    return `BNFE_${cleaned || 'Custom_Report'}`;
  }, [draft.name, resolvedTitle]);

  return (
    <div className="space-y-3.5 pb-20 min-[1200px]:pb-4">
      {/* 1. Template Chip Strip + Name + Delete */}
      <TemplateManagerBar
        templates={savedTemplates}
        loadingTemplates={loadingTemplates}
        activePresetId={activePresetId}
        selectedTemplateId={selectedTemplateId}
        templateName={draft.name}
        hasUnsavedChanges={hasUnsavedChanges}
        saving={saving}
        deleting={deleting}
        canModifySelected={canModifySelected}
        canDeleteSelected={canModifySelected}
        onSelectSavedTemplate={handleSelectSavedTemplate}
        onStartFromPreset={handleStartFromPreset}
        onChangeName={(name) =>
          updateDraft((prev) => ({
            ...prev,
            name,
          }))
        }
        onSaveTemplate={handleSaveTemplate}
        onSaveAsNew={handleSaveAsNew}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* 2. Mobile/Tablet 2-Tab Switcher (সম্পাদনা | প্রিভিউ) */}
      <div
        role="tablist"
        aria-label="সম্পাদনা ও প্রিভিউ পরিবর্তন"
        className="grid grid-cols-2 rounded-[12px] bg-theme-surface-subtle p-1 gap-1 border border-theme-border min-[1200px]:hidden print:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'edit'}
          onClick={() => setMobileView('edit')}
          className={`min-h-[40px] rounded-[10px] text-xs sm:text-sm font-medium transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
            mobileView === 'edit'
              ? 'bg-theme-surface text-theme-primary shadow-xs border border-theme-border'
              : 'text-theme-text-secondary hover:text-theme-text-primary'
          }`}
        >
          সম্পাদনা
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'pv'}
          onClick={() => setMobileView('pv')}
          className={`min-h-[40px] rounded-[10px] text-xs sm:text-sm font-medium transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
            mobileView === 'pv'
              ? 'bg-theme-surface text-theme-primary shadow-xs border border-theme-border'
              : 'text-theme-text-secondary hover:text-theme-text-primary'
          }`}
        >
          প্রিভিউ ({toBn(reportRows.length)} জন)
        </button>
      </div>

      {/* 3. Main Split Layout (Desktop: Left Sticky Editor 390px + Right Live Preview) */}
      <div className="min-[1200px]:grid min-[1200px]:grid-cols-[390px_1fr] min-[1200px]:gap-5 min-[1200px]:items-start">
        {/* LEFT PANE: 5-Tab Editor + Action Bar */}
        <div
          className={`${
            mobileView === 'edit' ? 'block' : 'hidden min-[1200px]:block'
          } min-[1200px]:sticky min-[1200px]:top-4 space-y-3 print:hidden`}
        >
          {/* 5-Tab Segmented Control */}
          <div
            role="tablist"
            aria-label="রিপোর্ট বিল্ডার অংশসমূহ"
            className="grid grid-cols-5 rounded-[12px] bg-theme-surface-subtle p-1 gap-0.5 border border-theme-border"
          >
            {EDITOR_TABS.map((t) => {
              const active = editorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEditorTab(t.id)}
                  className={`min-h-[40px] px-1 rounded-[10px] text-[11.5px] sm:text-xs transition cursor-pointer truncate focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
                    active
                      ? 'bg-theme-surface text-theme-primary font-semibold shadow-xs border border-theme-border'
                      : 'text-theme-text-secondary hover:text-theme-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Active Editor Panel Card */}
          <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
            {editorTab === 'heading' && (
              <BuilderHeadingEditor
                heading={draft.heading}
                onChangeHeading={(nextHeading) =>
                  updateDraft((prev) => ({ ...prev, heading: nextHeading }))
                }
                onFocusTarget={setLastFocusTarget}
              />
            )}

            {editorTab === 'columns' && (
              <BuilderColumnsEditor
                columns={draft.columns}
                onChangeColumns={(nextCols) =>
                  updateDraft((prev) => ({
                    ...prev,
                    columns: nextCols,
                    dataSource: columnsUseAttendanceData(nextCols)
                      ? 'attendance-summary'
                      : 'trainees',
                  }))
                }
                onFocusTarget={setLastFocusTarget}
              />
            )}

            {editorTab === 'signatures' && (
              <BuilderSignaturesEditor
                signatures={draft.signatures}
                showSignatures={draft.page.showSignatures}
                onChangeSignatures={(nextSigs) =>
                  updateDraft((prev) => ({ ...prev, signatures: nextSigs }))
                }
                onToggleShowSignatures={(show) =>
                  updateDraft((prev) => ({
                    ...prev,
                    page: { ...prev.page, showSignatures: show },
                  }))
                }
                onFocusTarget={setLastFocusTarget}
              />
            )}

            {editorTab === 'codes' && (
              <BuilderCodesPanel
                docContext={docContext}
                sampleRowTokens={sampleRowTokens}
                lastFocusTarget={lastFocusTarget}
                onCopyCode={handleCopyCode}
                onInsertCode={handleInsertCode}
              />
            )}

            {editorTab === 'page' && (
              <BuilderPageEditor
                page={draft.page}
                useBengaliDigits={draft.useBengaliDigits}
                onChangePage={(nextPage) =>
                  updateDraft((prev) => ({ ...prev, page: nextPage }))
                }
                onChangeUseBengaliDigits={(nextBn) =>
                  updateDraft((prev) => ({ ...prev, useBengaliDigits: nextBn }))
                }
              />
            )}
          </div>

          {/* Sticky Mobile / Inline Desktop Action Bar */}
          <div className="fixed left-0 right-0 bottom-0 z-30 bg-theme-surface/95 backdrop-blur-xs border-t border-theme-border px-3.5 py-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))] flex items-center gap-2 min-[1200px]:static min-[1200px]:bg-transparent min-[1200px]:backdrop-blur-none min-[1200px]:border-0 min-[1200px]:p-0">
            {selectedTemplateId && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={handleSaveAsNew}
                title="নতুন নামে আলাদা কপি সংরক্ষণ করুন"
                className="min-h-[46px] px-3 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <CopyPlus size={15} />
                <span className="hidden sm:inline">কপি সেভ</span>
              </button>
            )}

            <button
              type="button"
              disabled={
                saving ||
                deleting ||
                (Boolean(selectedTemplateId) && !canModifySelected)
              }
              onClick={handleSaveTemplate}
              className="flex-1 min-h-[46px] px-4 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary text-sm font-medium inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>{selectedTemplateId ? 'আপডেট' : 'সংরক্ষণ'}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerPrint}
              className="flex-1 min-h-[46px] px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <Printer size={16} />
              <span>প্রিন্ট / PDF</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Real Data Filter Strip + Live Multi-Page DocumentPrintFrame */}
        <div
          className={`${
            mobileView === 'pv' ? 'block' : 'hidden min-[1200px]:block'
          } min-w-0 space-y-3`}
        >
          <BuilderDataFilterBar
            userProfile={userProfile}
            showMonthFilter={needsAttendance}
            institutes={institutes}
            trades={trades}
            batches={batches}
            filterInstitute={effectiveInstitute}
            onChangeInstitute={setFilterInstitute}
            filterTrade={filterTrade}
            onChangeTrade={setFilterTrade}
            filterBatch={effectiveBatch}
            onChangeBatch={setFilterBatch}
            statusFilter={statusFilter}
            onChangeStatus={setStatusFilter}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChangeYear={setSelectedYear}
            onChangeMonth={setSelectedMonth}
            rowCount={reportRows.length}
            onResetFilters={handleResetFilters}
          />

          <DocumentPrintFrame
            documentTitle={resolvedTitle}
            fileNamePrefix={safeFilePrefix}
            config={draft.page}
            defaultOrientation={draft.page.orientation}
            onConfigChange={handleFrameConfigChange}
            heading={frameHeading}
            defaultHeading={{
              ...DEFAULT_OFFICIAL_HEADING,
              sheetTitle: DEFAULT_OFFICIAL_HEADING.reportTitle,
            }}
            onHeadingChange={handleFrameHeadingChange}
            supportsSignatures={draft.signatures.length > 0}
            supportsGeneratedDate
            canExport={canExport}
            rowCount={reportRows.length}
            measureKey={measureKey}
            printActionRef={printActionRef}
            onNotify={onNotify}
            extraDownloadItems={
              canExport
                ? [
                    {
                      id: 'csv',
                      label: exportingCsv ? 'CSV তৈরি হচ্ছে...' : 'CSV স্প্রেডশিট (.csv)',
                      subtitle: 'Excel-এ খোলার উপযোগী',
                      icon: <FileSpreadsheet size={16} />,
                      disabled: exportingCsv,
                      onClick: handleExportCSV,
                    },
                  ]
                : []
            }
            renderHeader={({ config, px }) => (
              <div className="pb-2.5 mb-3 text-black">
                <ReportHeaderBanner
                  leftLogoUrl={draft.heading.leftLogoUrl}
                  rightLogoUrl={draft.heading.rightLogoUrl}
                  logoSizePx={draft.heading.logoSizePx}
                  scale={config.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt}
                  className="border-b-2 border-slate-800 pb-2"
                >
                  {draft.heading.govtTitle.trim() && (
                    <p style={{ fontSize: px(10.5) }} className="leading-[1.35]">
                      {resolveTokenTemplate(draft.heading.govtTitle.trim(), docContext)}
                    </p>
                  )}
                  {draft.heading.officeTitle.trim() && (
                    <h2
                      style={{ fontSize: px(15) }}
                      className="font-bold leading-[1.35] mt-0.5"
                    >
                      {resolveTokenTemplate(draft.heading.officeTitle.trim(), docContext)}
                    </h2>
                  )}
                  {draft.heading.officeAddress.trim() && (
                    <p style={{ fontSize: px(11.5) }} className="font-medium leading-[1.35]">
                      {resolveTokenTemplate(draft.heading.officeAddress.trim(), docContext)}
                    </p>
                  )}
                  {draft.heading.programTitle.trim() && (
                    <p
                      style={{ fontSize: px(11) }}
                      className="font-semibold leading-[1.35] max-w-[92%] mx-auto mt-1"
                    >
                      {resolveTokenTemplate(draft.heading.programTitle.trim(), docContext)}
                    </p>
                  )}
                </ReportHeaderBanner>

                {(draft.heading.showMemo || config.showGeneratedDate) && (
                  <div
                    style={{ fontSize: px(10.5) }}
                    className="flex flex-wrap items-center justify-between gap-2 mt-2 text-slate-800"
                  >
                    <span>
                      {draft.heading.showMemo && draft.heading.memoNumber.trim()
                        ? `স্মারক নং: ${resolveTokenTemplate(
                            draft.heading.memoNumber.trim(),
                            docContext
                          )}`
                        : ''}
                    </span>
                    {config.showGeneratedDate && (
                      <span className="tabular-nums ml-auto">
                        তারিখ: <strong className="text-black">{docContext.date}</strong>
                      </span>
                    )}
                  </div>
                )}

                {draft.heading.reportTitle.trim() && (
                  <div className="text-center mt-2.5">
                    <span
                      style={{ fontSize: px(12.5) }}
                      className="inline-block px-3.5 py-1 bg-slate-100 border border-slate-400 font-bold leading-[1.3]"
                    >
                      {resolveTokenTemplate(draft.heading.reportTitle.trim(), docContext)}
                    </span>
                  </div>
                )}

                {draft.heading.showMetaLine && (
                  <div
                    style={{ fontSize: px(10.2) }}
                    className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-slate-700"
                  >
                    <span>
                      প্রতিষ্ঠান: <strong className="text-black">{docContext.institute}</strong>
                    </span>
                    <span>
                      ট্রেড: <strong className="text-black">{docContext.trade}</strong>
                    </span>
                    <span>
                      ব্যাচ: <strong className="text-black">{docContext.batch}</strong>
                    </span>
                    {needsAttendance && (
                      <span>
                        মাস: <strong className="text-black">{docContext.month}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            renderTable={({ rowIndices, px }) => (
              <table
                style={{ fontSize: px(10.5) }}
                className="w-full table-fixed border-collapse border border-slate-800 text-black"
              >
                <colgroup>
                  {draft.columns.map((col, idx) => (
                    <col
                      key={col.id}
                      style={{ width: columnWidthPercents[idx] || 'auto' }}
                    />
                  ))}
                </colgroup>

                <thead className="bg-slate-100 text-black">
                  <tr>
                    {draft.columns.map((col) => (
                      <th
                        key={col.id}
                        className={`border border-slate-800 px-1.5 pt-1.5 pb-2 align-middle leading-[1.25] font-bold break-words ${
                          col.align === 'left' ? 'text-left' : 'text-center'
                        }`}
                      >
                        {resolveTokenTemplate(col.label, docContext) || '—'}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {reportRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, draft.columns.length)}
                        className="border border-slate-800 py-8 text-center align-middle text-slate-600"
                      >
                        নির্বাচিত ফিল্টার অনুযায়ী কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    rowIndices.map((idx) => {
                      const row = reportRows[idx];
                      if (!row) return null;
                      return (
                        <tr key={row.trainee.id}>
                          {draft.columns.map((col) => {
                            const cellText = resolveReportCellValue({
                              rowIndex: idx,
                              row,
                              col,
                              institutesById,
                              tradesById,
                              batchesById,
                              useBengaliDigits: draft.useBengaliDigits,
                              passThreshold,
                              docContext,
                            });
                            const isIneligible =
                              col.field === 'eligible' && cellText === 'অযোগ্য';
                            return (
                              <td
                                key={col.id}
                                className={`border border-slate-800 px-1.5 pt-[4px] pb-[6px] align-middle leading-[1.3] tabular-nums whitespace-pre-line break-words ${getAlignClass(
                                  col.align
                                )} ${isIneligible ? 'text-red-700 font-semibold' : ''}`}
                              >
                                {cellText}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
            renderFooter={({ config, px }) => {
              if (!config.showSignatures || draft.signatures.length === 0) {
                return null;
              }
              return (
                <div
                  style={{ fontSize: px(10.5) }}
                  className={`grid ${getSignatureGridColsClass(
                    draft.signatures.length
                  )} gap-7 pt-14 text-center mt-4 text-black`}
                >
                  {draft.signatures.map((sig) => {
                    const resolvedName = sig.name
                      ? resolveTokenTemplate(sig.name.trim(), docContext)
                      : '';
                    return (
                      <div key={sig.id}>
                        <div className="border-t border-slate-800 pt-1.5">
                          <div className="font-semibold leading-[1.3]">
                            {resolveTokenTemplate(sig.label || 'স্বাক্ষর', docContext)}
                          </div>
                          {resolvedName && (
                            <div
                              style={{ fontSize: px(9.5) }}
                              className="text-slate-900 mt-0.5 leading-[1.25]"
                            >
                              ({resolvedName})
                            </div>
                          )}
                          {sig.designation && sig.designation.trim() && (
                            <div
                              style={{ fontSize: px(9) }}
                              className="text-slate-700 leading-[1.25]"
                            >
                              {resolveTokenTemplate(sig.designation.trim(), docContext)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};
