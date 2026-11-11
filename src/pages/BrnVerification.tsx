import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  AlertTriangle,
  User, 
  Calendar, 
  Building2, 
  Layers, 
  RotateCcw,
  Check,
  Copy,
  X,
  Clock,
  Sparkles,
  FileCheck2,
  FileText,
  LayoutGrid,
  Table as TableIcon,
  Download,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { Trainee, Institute, Trade, Batch } from '../types';
import { dataService } from '../lib/dataService';
import { logActivity } from '../lib/firebase';
import { toBn, normalizeUBRN, normalizeBirthDate, formatBengaliDate } from '../lib/dateUtils';
import { downloadCSV, downloadExcel, printBRNReportPDF } from '../lib/exportUtils';
import BrnExportModal, { ExportScope } from '../components/BrnExportModal';
import { useModalViewportPosition } from '../hooks/useModalViewportPosition';
import { TableSkeleton, StatsSkeleton } from '../components/Skeleton';
import DataTableToolbar, { ColumnOption, GroupByOption } from '../components/TableToolbar/DataTableToolbar';

const ITEMS_PER_PAGE = 12;

const DEFAULT_BRN_COLUMNS: ColumnOption[] = [
  { id: 'sl', label: 'ক্রমিক (SL)', visible: true },
  { id: 'traineeInfo', label: 'শিক্ষার্থীর তথ্য ও আইডি (Trainee Info)', visible: true },
  { id: 'ubrn', label: 'জন্ম নিবন্ধন নম্বর (UBRN)', visible: true },
  { id: 'dob', label: 'জন্ম তারিখ (DOB)', visible: true },
  { id: 'instituteBatch', label: 'প্রতিষ্ঠান ও ব্যাচ (Institute & Batch)', visible: true },
  { id: 'status', label: 'যাচাই অবস্থা (Status)', visible: true },
  { id: 'remark', label: 'মন্তব্য (Remark)', visible: true },
  { id: 'actions', label: 'পদক্ষেপ (Actions)', visible: true, required: true },
];

const BRN_GROUP_BY_OPTIONS: GroupByOption[] = [
  { id: 'none', label: 'গ্রুপ ছাড়া (Default)' },
  { id: 'status', label: 'যাচাই অবস্থা অনুযায়ী (By Status)' },
  { id: 'batch', label: 'ব্যাচ অনুযায়ী (By Batch)' },
  { id: 'trade', label: 'ট্রেড অনুযায়ী (By Trade)' },
  { id: 'institute', label: 'প্রতিষ্ঠান অনুযায়ী (By Institute)' },
];

const BrnVerification: React.FC = () => {
  const { userProfile } = useAuth();
  const { isCourseDirector } = usePermissions();

  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'card' is default as requested
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Filters state: 'pending' is default as requested
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'invalid'>('pending');
  const [instituteFilter, setInstituteFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Group By & Columns Visibility
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'batch' | 'trade' | 'institute'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [columns, setColumns] = useState<ColumnOption[]>(() => {
    try {
      const saved = localStorage.getItem('bnfe_brn_visible_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_BRN_COLUMNS.map(col => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible
        }));
      }
    } catch (e) {}
    return DEFAULT_BRN_COLUMNS;
  });

  const toggleColumn = (colId: string) => {
    setColumns(prev => {
      const next = prev.map(c => c.id === colId && !c.required ? { ...c, visible: !c.visible } : c);
      try {
        const map: Record<string, boolean> = {};
        next.forEach(c => { map[c.id] = c.visible; });
        localStorage.setItem('bnfe_brn_visible_columns', JSON.stringify(map));
      } catch (e) {}
      return next;
    });
  };

  const resetColumns = () => {
    setColumns(DEFAULT_BRN_COLUMNS);
    try {
      localStorage.removeItem('bnfe_brn_visible_columns');
    } catch (e) {}
  };

  const isColVisible = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    return col ? col.visible : true;
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setInstituteFilter('');
    setTradeFilter('');
    setBatchFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (statusFilter !== 'all') {
      const label = statusFilter === 'pending' ? 'স্ট্যাটাস: অপেক্ষমাণ' : statusFilter === 'verified' ? 'স্ট্যাটাস: যাচাইকৃত' : 'স্ট্যাটাস: অবৈধ';
      chips.push({
        id: 'status',
        label,
        onRemove: () => { setStatusFilter('all'); setCurrentPage(1); }
      });
    }
    if (instituteFilter) {
      chips.push({
        id: 'institute',
        label: `প্রতিষ্ঠান: ${getInstituteName(instituteFilter)}`,
        onRemove: () => { setInstituteFilter(''); setBatchFilter(''); setCurrentPage(1); }
      });
    }
    if (tradeFilter) {
      chips.push({
        id: 'trade',
        label: `ট্রেড: ${getTradeName(tradeFilter)}`,
        onRemove: () => { setTradeFilter(''); setBatchFilter(''); setCurrentPage(1); }
      });
    }
    if (batchFilter) {
      chips.push({
        id: 'batch',
        label: `ব্যাচ: ${getBatchName(batchFilter)}`,
        onRemove: () => { setBatchFilter(''); setCurrentPage(1); }
      });
    }
    return chips;
  }, [statusFilter, instituteFilter, tradeFilter, batchFilter, institutes, trades, batches]);

  // Export Dropdown State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // UBRN Copy Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUbrn = (traineeId: string, ubrn: string) => {
    if (!ubrn) return;
    navigator.clipboard.writeText(ubrn);
    setCopiedId(traineeId);
    showToast(`জন্ম নিবন্ধন নম্বর (${ubrn}) কপি করা হয়েছে`);
    setTimeout(() => {
      setCopiedId(prev => prev === traineeId ? null : prev);
    }, 2000);
  };

  // Close export menu on click outside
  useEffect(() => {
    const handleOutsideExportClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideExportClick);
    return () => document.removeEventListener('mousedown', handleOutsideExportClick);
  }, []);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('pending');

  // Modal State for "Verify birth registration"
  const [activeTrainee, setActiveTrainee] = useState<Trainee | null>(null);
  const [modalVerified, setModalVerified] = useState<boolean>(true);
  const [modalRemark, setModalRemark] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Dynamic viewport & modal height calculation hook for mobile & desktop positioning
  const {
    modalRef: verifyModalRef,
    alignmentClasses: verifyAlignmentClasses,
    backdropClasses: verifyBackdropClasses
  } = useModalViewportPosition<HTMLDivElement>(!!activeTrainee, {
    marginThreshold: 60,
    mobileBreakpoint: 640
  });

  // Redirect if not Course Director
  if (!isCourseDirector && userProfile?.role !== 'Course Director') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tList, instList, trdList, btcList] = await Promise.all([
        dataService.getItems<Trainee>('trainees', true),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches')
      ]);

      setTrainees(tList.filter(t => !t.isArchived));
      setInstitutes(instList);
      setTrades(trdList);
      setBatches(btcList);
    } catch (err) {
      console.warn("Error fetching BRN data:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // KPI Metrics Calculation
  const stats = useMemo(() => {
    const total = trainees.length;
    const verified = trainees.filter(t => t.is_brn_verified === true).length;
    const invalid = trainees.filter(t => t.is_brn_verified === false).length;
    const pending = trainees.filter(t => t.is_brn_verified === undefined || t.is_brn_verified === null).length;
    const validLengthCount = trainees.filter(t => {
      const u = normalizeUBRN(t.nidOrBirthRegistration);
      return u.length === 17;
    }).length;
    const rate = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, invalid, pending, validLengthCount, rate };
  }, [trainees]);

  // Dynamic batch filter options based on selected institute & trade
  const availableBatches = useMemo(() => {
    return batches.filter(b => {
      if (instituteFilter && b.instituteId !== instituteFilter) return false;
      if (tradeFilter && b.tradeId !== tradeFilter) return false;
      return true;
    });
  }, [batches, instituteFilter, tradeFilter]);

  const getInstituteName = (instId?: string) => {
    if (!instId) return '-';
    return institutes.find(i => i.id === instId)?.name || instId;
  };

  const getTradeName = (tradeId?: string) => {
    if (!tradeId) return '-';
    return trades.find(t => t.id === tradeId)?.name || tradeId;
  };

  const getBatchName = (batchId?: string) => {
    if (!batchId) return '-';
    return batches.find(b => b.id === batchId)?.name || batchId;
  };

  // Filter Summary Description
  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (instituteFilter) parts.push(`প্রতিষ্ঠান: ${getInstituteName(instituteFilter)}`);
    if (tradeFilter) parts.push(`ট্রেড: ${getTradeName(tradeFilter)}`);
    if (batchFilter) parts.push(`ব্যাচ: ${getBatchName(batchFilter)}`);
    if (searchTerm.trim()) parts.push(`অনুসন্ধান: "${searchTerm.trim()}"`);
    return parts.join(' | ');
  }, [instituteFilter, tradeFilter, batchFilter, searchTerm, institutes, trades, batches]);

  // Filtering Logic
  const filteredTrainees = useMemo(() => {
    return trainees.filter(t => {
      // Verification Status filter
      if (statusFilter === 'verified' && t.is_brn_verified !== true) return false;
      if (statusFilter === 'invalid' && t.is_brn_verified !== false) return false;
      if (statusFilter === 'pending' && (t.is_brn_verified === true || t.is_brn_verified === false)) return false;

      // Dropdown filters
      if (instituteFilter && t.instituteId !== instituteFilter) return false;
      if (tradeFilter && t.tradeId !== tradeFilter) return false;
      if (batchFilter && t.batchId !== batchFilter) return false;

      // Search term (BN Name, EN Name, Trainee ID, Reg No, UBRN)
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const qDigits = normalizeUBRN(searchTerm);
        const matchNameEn = (t.nameEn || '').toLowerCase().includes(q);
        const matchNameBn = (t.nameBn || '').includes(q);
        const matchId = (t.traineeId || '').toLowerCase().includes(q);
        const matchReg = (t.registrationNumber || '').toLowerCase().includes(q);
        const rawUbrn = normalizeUBRN(t.nidOrBirthRegistration);
        const matchUbrn = rawUbrn.includes(qDigits || q);
        if (!matchNameEn && !matchNameBn && !matchId && !matchReg && !matchUbrn) {
          return false;
        }
      }

      return true;
    });
  }, [trainees, statusFilter, instituteFilter, tradeFilter, batchFilter, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTrainees.length / ITEMS_PER_PAGE));
  const paginatedTrainees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrainees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTrainees, currentPage]);

  // Grouped Trainees computation when groupBy is selected
  const groupedTrainees = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, { title: string; items: Trainee[] }>();

    filteredTrainees.forEach(t => {
      let key = '';
      let title = '';

      if (groupBy === 'status') {
        if (t.is_brn_verified === true) {
          key = 'verified';
          title = 'অনলাইন যাচাইকৃত (Verified)';
        } else if (t.is_brn_verified === false) {
          key = 'invalid';
          title = 'অবৈধ / অমিল (Invalid)';
        } else {
          key = 'pending';
          title = 'অপেক্ষমাণ (Pending Verification)';
        }
      } else if (groupBy === 'batch') {
        key = t.batchId || 'unassigned';
        title = `ব্যাচ: ${getBatchName(t.batchId)}`;
      } else if (groupBy === 'trade') {
        key = t.tradeId || 'unassigned';
        title = `ট্রেড: ${getTradeName(t.tradeId)}`;
      } else if (groupBy === 'institute') {
        key = t.instituteId || 'unassigned';
        title = `প্রতিষ্ঠান: ${getInstituteName(t.instituteId)}`;
      }

      if (!map.has(key)) {
        map.set(key, { title, items: [] });
      }
      map.get(key)!.items.push(t);
    });

    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      title: val.title,
      items: val.items
    }));
  }, [filteredTrainees, groupBy, institutes, trades, batches]);

  const handleOpenVerifyModal = (trainee: Trainee) => {
    setActiveTrainee(trainee);
    setModalVerified(trainee.is_brn_verified === false ? false : true);
    setModalRemark(trainee.brn_remark || '');
  };

  const handleSaveVerification = async () => {
    if (!activeTrainee) return;
    setSaving(true);
    try {
      const now = Date.now();
      const updatedData = {
        is_brn_verified: modalVerified,
        brn_remark: modalRemark.trim(),
        brn_verified_at: now,
        brn_verified_by: userProfile?.name || userProfile?.email || 'Course Director'
      };

      await dataService.updateTraineeBrnVerification(activeTrainee.id, updatedData);

      // Log activity
      await logActivity(
        userProfile?.id || 'cd-user',
        userProfile?.name || 'Course Director',
        'update',
        'trainee_brn_verification',
        activeTrainee.id,
        `শিক্ষার্থী ${activeTrainee.nameBn}-এর জন্ম নিবন্ধন অনলাইন যাচাই হালনাগাদ: ${modalVerified ? 'Verified' : 'Invalid'}. ${modalRemark ? `মন্তব্য: ${modalRemark}` : ''}`
      );

      // Local optimistic update
      setTrainees(prev => prev.map(t => {
        if (t.id === activeTrainee.id) {
          return {
            ...t,
            ...updatedData
          };
        }
        return t;
      }));

      showToast(`শিক্ষার্থী ${activeTrainee.nameBn}-এর জন্ম নিবন্ধন যাচাই অবস্থা সফলভাবে সংরক্ষিত হয়েছে।`);
      setActiveTrainee(null);
    } catch (err) {
      console.error("Failed to update BRN verification:", err);
      alert("যাচাইকরণ সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  // Quick Export Handler for filtered view
  const handleQuickExport = (format: 'excel' | 'csv' | 'pdf') => {
    const scopeLabel = statusFilter === 'pending'
      ? 'অপেক্ষমাণ শিক্ষার্থী (Pending Trainees)'
      : statusFilter === 'verified'
        ? 'বৈধ ও যাচাইকৃত শিক্ষার্থী (Valid / Verified Trainees)'
        : statusFilter === 'invalid'
          ? 'অবৈধ / তথ্যে অমিল শিক্ষার্থী (Invalid Trainees)'
          : 'সকল শিক্ষার্থী (All Trainees)';

    const dateTag = new Date().toISOString().split('T')[0];
    const baseFilename = `BNFE_BRN_${statusFilter.toUpperCase()}_TRAINEES_${dateTag}`;

    const headers = [
      'ক্রমিক',
      'প্রশিক্ষণার্থী আইডি',
      'রেজিস্ট্রেশন নম্বর',
      'শিক্ষার্থীর নাম (বাংলা)',
      'শিক্ষার্থীর নাম (ইংরেজি)',
      'জন্ম নিবন্ধন নম্বর (UBRN)',
      '১৭ ডিজিট যাচাই',
      'জন্ম তারিখ',
      'লিঙ্গ',
      'মোবাইল নম্বর',
      'প্রশিক্ষণ কেন্দ্র / প্রতিষ্ঠান',
      'বৃত্তিমূলক ট্রেড',
      'প্রশিক্ষণ ব্যাচ',
      'অনলাইন যাচাই অবস্থা',
      'যাচাই মন্তব্য (Remark)',
      'যাচাইয়ের তারিখ',
      'যাচাইকারী'
    ];

    const rows = filteredTrainees.map((t, idx) => {
      const rawUbrn = normalizeUBRN(t.nidOrBirthRegistration);
      const is17 = rawUbrn.length === 17 ? '১৭ ডিজিট সঠিক' : `${rawUbrn.length} ডিজিট (১৭ নয়)`;
      const dob = normalizeBirthDate(t.dateOfBirth);
      const statusStr = t.is_brn_verified === true 
        ? 'Valid (যাচাইকৃত)' 
        : t.is_brn_verified === false 
          ? 'Invalid (অবৈধ)' 
          : 'Pending (অপেক্ষমাণ)';
      const verifiedAtStr = t.brn_verified_at ? new Date(t.brn_verified_at).toLocaleDateString('bn-BD') : '—';

      return [
        idx + 1,
        t.traineeId || '',
        t.registrationNumber || 'অপেক্ষমাণ',
        t.nameBn || '',
        t.nameEn || '',
        rawUbrn || t.nidOrBirthRegistration || 'অনুপস্থিত',
        is17,
        dob || '',
        t.gender === 'Female' ? 'নারী' : 'পুরুষ',
        t.mobileNumber || '',
        getInstituteName(t.instituteId),
        getTradeName(t.tradeId),
        getBatchName(t.batchId),
        statusStr,
        t.brn_remark || '',
        verifiedAtStr,
        t.brn_verified_by || '—'
      ];
    });

    if (format === 'excel') {
      const colWidths = [8, 16, 18, 24, 24, 22, 16, 14, 10, 16, 26, 20, 18, 20, 28, 16, 18];
      downloadExcel(baseFilename, 'BRN_Verification', headers, rows, colWidths);
      showToast(`${scopeLabel}-এর Excel (.xlsx) ফাইল ডাউনলোড সম্পন্ন হয়েছে।`);
    } else if (format === 'csv') {
      downloadCSV(baseFilename, headers, rows);
      showToast(`${scopeLabel}-এর CSV (.csv) ফাইল ডাউনলোড সম্পন্ন হয়েছে।`);
    } else if (format === 'pdf') {
      const printableItems = filteredTrainees.map((t, idx) => {
        const rawUbrn = normalizeUBRN(t.nidOrBirthRegistration);
        const is17 = rawUbrn.length === 17 ? '✓ ১৭ ডিজিট সঠিক' : `⚠️ ${toBn(rawUbrn.length)} ডিজিট`;
        const status = t.is_brn_verified === true 
          ? 'Verified' as const 
          : t.is_brn_verified === false 
            ? 'Invalid' as const 
            : 'Pending' as const;

        return {
          sl: toBn(idx + 1),
          id: t.traineeId || '',
          regNo: t.registrationNumber || 'অপেক্ষমাণ',
          nameBn: t.nameBn || '',
          nameEn: t.nameEn || '',
          ubrn: rawUbrn || t.nidOrBirthRegistration || 'অনুপস্থিত',
          ubrnValidation: is17,
          dob: normalizeBirthDate(t.dateOfBirth) || '—',
          gender: t.gender === 'Female' ? 'নারী' : 'পুরুষ',
          institute: getInstituteName(t.instituteId),
          batch: getBatchName(t.batchId),
          status,
          remark: t.brn_remark || '—',
          verifiedAt: t.brn_verified_at ? new Date(t.brn_verified_at).toLocaleDateString('bn-BD') : undefined,
          verifiedBy: t.brn_verified_by
        };
      });

      printBRNReportPDF({
        scopeLabel,
        filterDetails: activeFilterSummary,
        generatedBy: userProfile?.name || 'Course Director',
        stats: {
          total: trainees.length,
          verified: stats.verified,
          invalid: stats.invalid,
          pending: stats.pending
        },
        trainees: printableItems
      });
    }
  };

  const openExportForScope = (scope: ExportScope) => {
    setExportScope(scope);
    setIsExportModalOpen(true);
  };

  const renderStatusBadge = (t: Trainee) => {
    if (t.is_brn_verified === true) {
      return (
        <span 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs"
          title={t.brn_verified_by ? `যাচাইকারী: ${t.brn_verified_by}` : 'BDRIS অনলাইন যাচাই সম্পন্ন'}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <CheckCircle2 size={12} className="text-emerald-700 shrink-0" />
          <span>যাচাইকৃত</span>
        </span>
      );
    }
    if (t.is_brn_verified === false) {
      return (
        <span 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200/90 shadow-2xs"
          title={t.brn_remark ? `কারণ: ${t.brn_remark}` : 'সার্ভারে অমিল বা ত্রুটিযুক্ত'}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          <XCircle size={12} className="text-rose-700 shrink-0" />
          <span>অবৈধ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
        <Clock size={12} className="text-amber-600 shrink-0" />
        <span>অপেক্ষমাণ</span>
      </span>
    );
  };

  const renderBrnCard = (trainee: Trainee) => {
    const rawUbrn = normalizeUBRN(trainee.nidOrBirthRegistration);
    const is17Digit = rawUbrn.length === 17;
    const formattedDob = normalizeBirthDate(trainee.dateOfBirth);
    const isCopied = copiedId === trainee.id;

    return (
      <div
        key={trainee.id}
        className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-base border border-purple-100 shrink-0 overflow-hidden shadow-2xs">
                {trainee.photoUrl ? (
                  <img src={trainee.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  trainee.nameEn?.charAt(0) || <User size={20} />
                )}
              </div>
              <div className="min-w-0">
                <Link
                  to={`/trainees/${trainee.id}`}
                  className="font-bold text-slate-900 hover:text-purple-700 transition flex items-center space-x-1 group/link truncate"
                  title="প্রশিক্ষণার্থীর প্রোফাইল দেখুন"
                >
                  <span className="truncate">{trainee.nameBn || trainee.nameEn}</span>
                  <ExternalLink size={12} className="opacity-0 group-hover/link:opacity-100 text-purple-600 shrink-0 transition" />
                </Link>
                {trainee.nameEn && trainee.nameBn && (
                  <p className="text-[11px] text-slate-400 truncate">{trainee.nameEn}</p>
                )}
                <div className="flex items-center space-x-2 mt-0.5 text-[11px] font-mono text-slate-500">
                  <span>ID: <strong className="text-slate-700">{trainee.traineeId}</strong></span>
                  {trainee.registrationNumber && (
                    <span>• রেজিঃ {trainee.registrationNumber}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              {renderStatusBadge(trainee)}
            </div>
          </div>

          <div className="mt-3.5 bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                জন্ম নিবন্ধন নম্বর (UBRN)
              </span>
              {rawUbrn ? (
                is17Digit ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                    <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                    <span>১৭ ডিজিট</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700">
                    <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                    <span>{toBn(rawUbrn.length)} ডিজিট (১৭ প্রয়োজন)</span>
                  </span>
                )
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-slate-900 text-sm tracking-wider select-all break-all">
                {trainee.nidOrBirthRegistration || (
                  <span className="text-rose-500 italic font-sans font-normal text-xs">অনুপস্থিত</span>
                )}
              </span>
              {rawUbrn && (
                <button
                  type="button"
                  onClick={() => handleCopyUbrn(trainee.id, rawUbrn)}
                  className="p-1 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition shrink-0 cursor-pointer"
                  title={isCopied ? 'কপি সম্পন্ন!' : 'নম্বরটি কপি করুন'}
                >
                  {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 block">জন্ম তারিখ:</span>
              <span className="font-mono font-semibold text-slate-800">{formattedDob || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">লিঙ্গ:</span>
              <span className="font-medium text-slate-800">{trainee.gender === 'Female' ? 'নারী' : 'পুরুষ'}</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 block">প্রতিষ্ঠান ও ব্যাচ:</span>
              <span className="font-medium text-slate-800 block truncate" title={`${getInstituteName(trainee.instituteId)} • ${getBatchName(trainee.batchId)}`}>
                {getBatchName(trainee.batchId)} ({getInstituteName(trainee.instituteId)})
              </span>
            </div>
          </div>

          {trainee.brn_remark && (
            <div className="mt-3 bg-purple-50/60 border border-purple-100 rounded-xl p-2.5 text-xs text-purple-900">
              <span className="text-[10px] font-bold text-purple-600 uppercase block mb-0.5">যাচাই মন্তব্য:</span>
              <p className="italic font-medium leading-relaxed">{trainee.brn_remark}</p>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
          <form
            action="https://everify.bdris.gov.bd/UBRNVerification/Search"
            encType="multipart/form-data"
            method="post"
            target="_blank"
            className="flex-1"
          >
            <input type="hidden" name="UBRN" value={rawUbrn} />
            <input type="hidden" name="BirthDate" value={formattedDob} />
            <button
              type="submit"
              name="Submit"
              value="Check birth registration"
              className="w-full py-2 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/90 font-bold text-xs inline-flex items-center justify-center space-x-1.5 transition shadow-2xs cursor-pointer active:scale-95"
              title="সরকারি BDRIS সার্ভারে জন্ম নিবন্ধন অনলাইন যাচাই করুন (নতুন ট্যাবে খুলবে)"
            >
              <ExternalLink size={13} className="text-sky-600 shrink-0" />
              <span>BDRIS চেক</span>
            </button>
          </form>

          <button
            type="button"
            onClick={() => handleOpenVerifyModal(trainee)}
            className="flex-1 py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center justify-center space-x-1.5 transition shadow-2xs cursor-pointer active:scale-95"
            title="জন্ম নিবন্ধন যাচাই স্ট্যাটাস ও মন্তব্য হালনাগাদ করুন"
          >
            <ShieldCheck size={13} className="text-purple-200 shrink-0" />
            <span>যাচাইকরণ</span>
          </button>
        </div>
      </div>
    );
  };

  const renderBrnTableRow = (trainee: Trainee, sl: number) => {
    const rawUbrn = normalizeUBRN(trainee.nidOrBirthRegistration);
    const is17Digit = rawUbrn.length === 17;
    const formattedDob = normalizeBirthDate(trainee.dateOfBirth);
    const isCopied = copiedId === trainee.id;

    return (
      <tr key={trainee.id} className="hover:bg-purple-50/30 transition-colors group">
        {isColVisible('sl') && (
          <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold text-xs">
            {toBn(sl)}
          </td>
        )}
        {isColVisible('traineeInfo') && (
          <td className="px-4 py-3">
            <div className="flex items-center space-x-3">
              <Link
                to={`/trainees/${trainee.id}`}
                className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-purple-200/80 hover:ring-2 hover:ring-purple-400 transition"
                title="প্রোফাইল দেখুন"
              >
                {trainee.photoUrl ? (
                  <img src={trainee.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  trainee.nameBn?.charAt(0) || trainee.nameEn?.charAt(0) || <User size={16} />
                )}
              </Link>
              <div className="min-w-0">
                <Link
                  to={`/trainees/${trainee.id}`}
                  className="font-bold text-slate-900 hover:text-purple-700 transition block truncate text-xs sm:text-sm"
                  title="প্রোফাইল দেখুন"
                >
                  {trainee.nameBn || trainee.nameEn}
                </Link>
                <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                  <span>আইডি: <strong className="text-slate-700 font-bold">{trainee.traineeId}</strong></span>
                  {trainee.registrationNumber && (
                    <span>• রেজিঃ {trainee.registrationNumber}</span>
                  )}
                </div>
              </div>
            </div>
          </td>
        )}
        {isColVisible('ubrn') && (
          <td className="px-4 py-3 min-w-[210px]">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5">
                <span className="select-all font-mono font-bold text-slate-900 text-xs tracking-wider inline-block">
                  {trainee.nidOrBirthRegistration || (
                    <span className="text-rose-600 font-sans font-medium text-[11px] not-italic">অনুপস্থিত</span>
                  )}
                </span>
                {rawUbrn && (
                  <button
                    type="button"
                    onClick={() => handleCopyUbrn(trainee.id, rawUbrn)}
                    className="p-1 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                    title={isCopied ? 'কপি হয়েছে!' : 'UBRN নম্বর কপি করুন'}
                  >
                    {isCopied ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                )}
              </div>
              {rawUbrn ? (
                is17Digit ? (
                  <span className="inline-flex items-center text-[10.5px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                    ১৭ ডিজিট সঠিক
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10.5px] font-semibold text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 inline-block" />
                    {toBn(rawUbrn.length)} ডিজিট (১৭ প্রয়োজন)
                  </span>
                )
              ) : null}
            </div>
          </td>
        )}
        {isColVisible('dob') && (
          <td className="px-4 py-3 whitespace-nowrap">
            <div className="flex items-center space-x-1.5 text-slate-700">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="font-mono font-semibold text-xs">
                {formattedDob || <span className="text-slate-400 font-sans text-xs">নির্ধারিত নেই</span>}
              </span>
            </div>
          </td>
        )}
        {isColVisible('instituteBatch') && (
          <td className="px-4 py-3">
            <div className="font-bold text-slate-800 text-xs truncate max-w-[190px]">
              {getBatchName(trainee.batchId)}
            </div>
            <div className="text-[11px] text-slate-400 truncate max-w-[190px]">
              {getInstituteName(trainee.instituteId)}
            </div>
          </td>
        )}
        {isColVisible('status') && (
          <td className="px-4 py-3 text-center whitespace-nowrap">
            {renderStatusBadge(trainee)}
          </td>
        )}
        {isColVisible('remark') && (
          <td className="px-4 py-3 max-w-[190px]">
            {trainee.brn_remark ? (
              <span className="text-slate-700 text-[11px] line-clamp-2 leading-relaxed" title={trainee.brn_remark}>
                "{trainee.brn_remark}"
              </span>
            ) : (
              <span className="text-slate-300 italic text-[11px]">—</span>
            )}
          </td>
        )}
        {isColVisible('actions') && (
          <td className="px-4 py-3 text-right whitespace-nowrap">
            <div className="flex items-center justify-end space-x-2">
              <form
                action="https://everify.bdris.gov.bd/UBRNVerification/Search"
                encType="multipart/form-data"
                method="post"
                target="_blank"
                className="inline"
              >
                <input type="hidden" name="UBRN" value={rawUbrn} />
                <input type="hidden" name="BirthDate" value={formattedDob} />
                <button
                  type="submit"
                  name="Submit"
                  value="Check birth registration"
                  className="h-8 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 hover:border-sky-300 font-bold text-xs inline-flex items-center space-x-1.5 transition cursor-pointer active:scale-95"
                  title="সরকারি BDRIS সার্ভারে জন্ম নিবন্ধন অনলাইন যাচাই করুন (নতুন ট্যাবে খুলবে)"
                >
                  <ExternalLink size={12} className="text-sky-600 shrink-0" />
                  <span>Check online</span>
                </button>
              </form>

              <button
                type="button"
                onClick={() => handleOpenVerifyModal(trainee)}
                className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center space-x-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                title="জন্ম নিবন্ধন যাচাই স্ট্যাটাস ও মন্তব্য হালনাগাদ করুন"
              >
                <ShieldCheck size={13} className="text-purple-200 shrink-0" />
                <span>Verify</span>
              </button>
            </div>
          </td>
        )}
      </tr>
    );
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-purple-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-purple-200 border border-white/10">
                <ShieldCheck size={24} />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                জন্ম নিবন্ধন অনলাইন যাচাইকরণ (BRN verification)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-3xl leading-relaxed">
              কোর্স পরিচালকের তত্ত্বাবধানে সরকারি BDRIS সার্ভার (<code className="text-purple-300">everify.bdris.gov.bd</code>) হতে শিক্ষার্থীদের ১৭ ডিজিটের জন্ম নিবন্ধন নম্বর ও জন্ম তারিখ অনলাইন যাচাই এবং ফলাফল লিপিবদ্ধকরণ।
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
            {/* View Switcher: Card View is Default */}
            <div className="flex items-center bg-white/10 backdrop-blur-xs p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white text-purple-900 shadow-sm'
                    : 'text-purple-200 hover:text-white hover:bg-white/5'
                }`}
                title="কার্ড ভিউ (ডিফল্ট)"
              >
                <LayoutGrid size={15} />
                <span>কার্ড ভিউ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-purple-900 shadow-sm'
                    : 'text-purple-200 hover:text-white hover:bg-white/5'
                }`}
                title="টেবিল ভিউ"
              >
                <TableIcon size={15} />
                <span>টেবিল ভিউ</span>
              </button>
            </div>

            {/* Export System Button */}
            <button
              type="button"
              onClick={() => openExportForScope(statusFilter === 'all' ? 'all' : statusFilter)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 border border-purple-400 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm hover:shadow transition cursor-pointer active:scale-95"
              title="CSV, Excel ও PDF ফরম্যাটে বৈধ, অবৈধ ও অপেক্ষমাণ শিক্ষার্থীদের তালিকা এক্সপোর্ট করুন"
            >
              <Download size={15} />
              <span>এক্সপোর্ট (Export)</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              title="তথ্য রিফ্রেশ করুন"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">রিফ্রেশ</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip with Quick Export Icons */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Trainees */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between group">
          <div>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">মোট শিক্ষার্থী</span>
              <button
                type="button"
                onClick={() => openExportForScope('all')}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-700 transition p-0.5"
                title="সকল শিক্ষার্থী এক্সপোর্ট (CSV, Excel, PDF)"
              >
                <Download size={12} />
              </button>
            </div>
            <span className="text-2xl font-extrabold text-slate-800 mt-1 block">{toBn(stats.total)} জন</span>
          </div>
          <button
            type="button"
            onClick={() => openExportForScope('all')}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-800 flex items-center justify-center transition cursor-pointer"
            title="সকল শিক্ষার্থী এক্সপোর্ট করুন"
          >
            <User size={20} />
          </button>
        </div>

        {/* Pending (Default Focus) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between ring-1 ring-amber-100 group">
          <div>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">অপেক্ষমাণ (Pending)</span>
              <button
                type="button"
                onClick={() => openExportForScope('pending')}
                className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-900 transition p-0.5"
                title="অপেক্ষমাণ শিক্ষার্থী এক্সপোর্ট (CSV, Excel, PDF)"
              >
                <Download size={12} />
              </button>
            </div>
            <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{toBn(stats.pending)} জন</span>
          </div>
          <button
            type="button"
            onClick={() => openExportForScope('pending')}
            className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-800 flex items-center justify-center transition cursor-pointer"
            title="অপেক্ষমাণ শিক্ষার্থী এক্সপোর্ট করুন"
          >
            <Clock size={20} />
          </button>
        </div>

        {/* Verified / Valid */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between group">
          <div>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">বৈধ ও যাচাইকৃত (Valid)</span>
              <button
                type="button"
                onClick={() => openExportForScope('verified')}
                className="opacity-0 group-hover:opacity-100 text-emerald-600 hover:text-emerald-900 transition p-0.5"
                title="বৈধ শিক্ষার্থী এক্সপোর্ট (CSV, Excel, PDF)"
              >
                <Download size={12} />
              </button>
            </div>
            <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">{toBn(stats.verified)} জন</span>
          </div>
          <button
            type="button"
            onClick={() => openExportForScope('verified')}
            className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 flex items-center justify-center transition cursor-pointer"
            title="বৈধ শিক্ষার্থী এক্সপোর্ট করুন"
          >
            <CheckCircle2 size={20} />
          </button>
        </div>

        {/* Invalid */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between group">
          <div>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">অবৈধ / অমিল (Invalid)</span>
              <button
                type="button"
                onClick={() => openExportForScope('invalid')}
                className="opacity-0 group-hover:opacity-100 text-rose-600 hover:text-rose-900 transition p-0.5"
                title="অবৈধ শিক্ষার্থী এক্সপোর্ট (CSV, Excel, PDF)"
              >
                <Download size={12} />
              </button>
            </div>
            <span className="text-2xl font-extrabold text-rose-700 mt-1 block">{toBn(stats.invalid)} জন</span>
          </div>
          <button
            type="button"
            onClick={() => openExportForScope('invalid')}
            className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 flex items-center justify-center transition cursor-pointer"
            title="অবৈধ শিক্ষার্থী এক্সপোর্ট করুন"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Verification Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider block">যাচাইয়ের অগ্রগতি</span>
            <span className="text-2xl font-extrabold text-purple-800 mt-1 block">{toBn(stats.rate)}%</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Sparkles size={20} />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TABLE TOOLBAR (GROUP BY | SEARCH + FILTER + COLUMNS)  */}
      {/* ======================================================== */}
      <DataTableToolbar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
        searchPlaceholder="শিক্ষার্থীর নাম, আইডি, রেজিঃ বা জন্ম নিবন্ধন নম্বর..."
        groupBy={groupBy}
        onGroupByChange={(val) => setGroupBy(val as any)}
        groupByOptions={BRN_GROUP_BY_OPTIONS}
        groupByLabel="গ্রুপ করুন (Group by)"
        filterCount={activeFilterChips.length}
        onClearAllFilters={handleClearFilters}
        activeFilterChips={activeFilterChips}
        renderFilterContent={(close) => (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">যাচাই অবস্থা (Status):</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="pending">অপেক্ষমাণ (Pending - {toBn(stats.pending)} জন)</option>
                <option value="verified">বৈধ ও যাচাইকৃত (Verified - {toBn(stats.verified)} জন)</option>
                <option value="invalid">অবৈধ / অমিল (Invalid - {toBn(stats.invalid)} জন)</option>
                <option value="all">সকল অবস্থা (মোট {toBn(stats.total)} জন)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">প্রতিষ্ঠান নির্বাচন:</label>
              <select
                value={instituteFilter}
                onChange={e => { setInstituteFilter(e.target.value); setBatchFilter(''); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">সকল প্রতিষ্ঠান ({toBn(institutes.length)}টি)</option>
                {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">বৃত্তিমূলক ট্রেড:</label>
              <select
                value={tradeFilter}
                onChange={e => { setTradeFilter(e.target.value); setBatchFilter(''); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">সকল ট্রেড ({toBn(trades.length)}টি)</option>
                {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">প্রশিক্ষণ ব্যাচ:</label>
              <select
                value={batchFilter}
                onChange={e => { setBatchFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">সকল ব্যাচ ({toBn(availableBatches.length)}টি)</option>
                {availableBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { handleClearFilters(); close(); }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
              >
                ফিল্টার রিসেট
              </button>
              <button
                type="button"
                onClick={close}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
              >
                প্রয়োগ করুন
              </button>
            </div>
          </div>
        )}
        columns={columns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        extraActions={
          <div className="flex items-center space-x-2">
            {/* Unified Modern Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                className={`h-9 px-3 rounded-xl border font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-2xs active:scale-95 ${
                  isExportMenuOpen
                    ? 'bg-purple-700 text-white border-purple-700 ring-2 ring-purple-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
                title="তথ্য এক্সপোর্ট করুন (Excel, CSV, PDF)"
              >
                <Download size={14} className={isExportMenuOpen ? 'text-white' : 'text-purple-700'} />
                <span>এক্সপোর্ট</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-fadeIn">
                  <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>এক্সপোর্ট ফরম্যাট</span>
                    <span className="text-[10px] text-purple-700 font-semibold">{toBn(filteredTrainees.length)} জন</span>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleQuickExport('excel');
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <FileSpreadsheet size={15} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-emerald-800">Excel (.xlsx)</div>
                        <div className="text-[10.5px] text-slate-400">মাইক্রোসফট এক্সেল স্প্রেডশীট</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleQuickExport('csv');
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <FileText size={15} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-blue-800">CSV (.csv)</div>
                        <div className="text-[10.5px] text-slate-400">স্ট্যান্ডার্ড কমা সেপারেটেড ফাইল</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleQuickExport('pdf');
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-800 transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Printer size={15} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-purple-800">PDF Report</div>
                        <div className="text-[10.5px] text-slate-400">অফিসিয়াল প্রিন্ট বা সেভ করুন</div>
                      </div>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 my-1" />

                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        openExportForScope(statusFilter === 'all' ? 'all' : statusFilter);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                    >
                      <SlidersHorizontal size={14} />
                      <span>কাস্টম এক্সপোর্ট উইন্ডো...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 h-9">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="কার্ড ভিউ"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline text-[11px]">কার্ড</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="টেবিল ভিউ"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline text-[11px]">টেবিল</span>
              </button>
            </div>
          </div>
        }
      />

      {/* Main Content Area: Card View (Default) or Table View */}
      {loading ? (
        <TableSkeleton rows={8} cols={6} showHeader={false} showToolbar={false} />
      ) : filteredTrainees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs py-16 text-center text-slate-500 space-y-2">
          <FileText size={40} className="mx-auto text-slate-300" />
          <p className="font-semibold text-slate-700">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি</p>
          <p className="text-xs text-slate-400">
            {statusFilter === 'pending'
              ? 'বর্তমানে অপেক্ষমাণ কোনো শিক্ষার্থী নেই। আপনি "সকল" বা অন্যান্য ফিল্টার নির্বাচন করে দেখতে পারেন।'
              : 'অন্য কোনো সার্চ কি-ওয়ার্ড বা ফিল্টার নির্বাচন করে পুনরায় চেষ্টা করুন।'}
          </p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="mt-2 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-100 transition cursor-pointer"
            >
              সকল শিক্ষার্থী দেখুন
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        /* ======================================================== */
        /* 1. CARD VIEW (DEFAULT)                                   */
        /* ======================================================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
            <span>
              প্রদর্শিত হচ্ছে: <strong className="text-slate-800 font-bold">{toBn(paginatedTrainees.length)} জন</strong> (মোট {toBn(filteredTrainees.length)} জন)
            </span>
            <span className="text-[11px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-md border border-purple-200">
              কার্ড ভিউ
            </span>
          </div>

          {groupBy !== 'none' && groupedTrainees ? (
            <div className="space-y-6">
              {groupedTrainees.map(grp => {
                const isCollapsed = collapsedGroups.has(grp.key);
                return (
                  <div key={grp.key} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-4">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(grp.key)}
                      className="w-full flex items-center justify-between text-left hover:text-purple-700 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5">
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        <span className="font-bold text-slate-800 text-sm sm:text-base">{grp.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          {toBn(grp.items.length)} জন
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        মোটের {toBn(Math.round((grp.items.length / (filteredTrainees.length || 1)) * 100))}%
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {grp.items.map(trainee => renderBrnCard(trainee))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedTrainees.map((trainee) => renderBrnCard(trainee))}
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* 2. TABLE VIEW (TOGGLEABLE)                               */
        /* ======================================================== */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] scrollbar-thin">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 shadow-2xs">
                <tr>
                  {isColVisible('sl') && <th className="px-4 py-3.5 w-14 text-center">ক্রমিক</th>}
                  {isColVisible('traineeInfo') && <th className="px-4 py-3.5 min-w-[220px]">প্রশিক্ষণার্থী ও আইডি</th>}
                  {isColVisible('ubrn') && <th className="px-4 py-3.5 min-w-[210px]">জন্ম নিবন্ধন নম্বর (UBRN)</th>}
                  {isColVisible('dob') && <th className="px-4 py-3.5 min-w-[120px] whitespace-nowrap">জন্ম তারিখ</th>}
                  {isColVisible('instituteBatch') && <th className="px-4 py-3.5 min-w-[180px]">প্রতিষ্ঠান ও ব্যাচ</th>}
                  {isColVisible('status') && <th className="px-4 py-3.5 text-center min-w-[140px] whitespace-nowrap">যাচাই অবস্থা</th>}
                  {isColVisible('remark') && <th className="px-4 py-3.5 min-w-[150px]">মন্তব্য</th>}
                  {isColVisible('actions') && <th className="px-4 py-3.5 text-right min-w-[220px] whitespace-nowrap">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {groupBy !== 'none' && groupedTrainees ? (
                  groupedTrainees.map(grp => {
                    const isCollapsed = collapsedGroups.has(grp.key);
                    return (
                      <React.Fragment key={grp.key}>
                        <tr className="bg-slate-100/80 hover:bg-slate-100 border-y border-slate-200 font-bold transition">
                          <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => toggleGroupCollapse(grp.key)}
                                className="flex items-center space-x-2 text-slate-800 hover:text-purple-700 cursor-pointer"
                              >
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                <span className="text-xs sm:text-sm font-bold">{grp.title}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                  {toBn(grp.items.length)} জন
                                </span>
                              </button>
                              <span className="text-[11px] text-slate-400">
                                মোটের {toBn(Math.round((grp.items.length / (filteredTrainees.length || 1)) * 100))}%
                              </span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && grp.items.map((trainee, idx) => renderBrnTableRow(trainee, idx + 1))}
                      </React.Fragment>
                    );
                  })
                ) : (
                  paginatedTrainees.map((trainee, idx) => {
                    const sl = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                    return renderBrnTableRow(trainee, sl);
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Horizontal Scrolling Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            মোট {toBn(filteredTrainees.length)} জনের মধ্যে {toBn((currentPage - 1) * ITEMS_PER_PAGE + 1)} থেকে {toBn(Math.min(currentPage * ITEMS_PER_PAGE, filteredTrainees.length))} প্রদর্শিত হচ্ছে
          </span>

          <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <div className="flex items-center space-x-1 shrink-0 min-w-max">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="shrink-0 p-1.5 sm:p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                title="পূর্ববর্তী পৃষ্ঠা"
              >
                পূর্ববর্তী
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`shrink-0 w-8 h-8 rounded-xl font-bold transition cursor-pointer ${
                      currentPage === p
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {toBn(p)}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="shrink-0 p-1.5 sm:p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                title="পরবর্তী পৃষ্ঠা"
              >
                পরবর্তী
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EXPORT MODAL FOR VALID, INVALID & PENDING TRAINEES       */}
      {/* ======================================================== */}
      <BrnExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allTrainees={trainees}
        filteredTrainees={filteredTrainees}
        institutes={institutes}
        trades={trades}
        batches={batches}
        initialScope={exportScope}
        activeFilterSummary={activeFilterSummary}
      />

      {/* ======================================================== */}
      {/* VERIFY BIRTH REGISTRATION MODAL                          */}
      {/* ======================================================== */}
      {activeTrainee && (
        <div 
          className={`${verifyBackdropClasses} animate-fadeIn`}
          onClick={() => setActiveTrainee(null)}
        >
          <div className={verifyAlignmentClasses}>
            <div 
              ref={verifyModalRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5"
            >
              {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">Verify Birth Registration</h3>
                  <p className="text-xs text-slate-500">অনলাইন যাচাই ফলাফল ও মন্তব্য লিপিবদ্ধ করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTrainee(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Trainee Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">{activeTrainee.nameBn} ({activeTrainee.nameEn})</span>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">ID: {activeTrainee.traineeId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>জন্ম নিবন্ধন: <strong className="font-mono text-slate-800">{activeTrainee.nidOrBirthRegistration || 'অনুপস্থিত'}</strong></span>
                <span>জন্ম তারিখ: <strong className="font-mono text-slate-800">{normalizeBirthDate(activeTrainee.dateOfBirth) || '-'}</strong></span>
              </div>
            </div>

            {/* Field 1: is_brn_verified (Checkbox styled as Button with Yes / No) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                জন্ম নিবন্ধন যাচাইয়ের অবস্থা (is_brn_verified) *
              </label>

              {/* Accessible button-styled checkboxes */}
              <div className="grid grid-cols-2 gap-3">
                {/* YES Option Button */}
                <button
                  type="button"
                  onClick={() => setModalVerified(true)}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 text-sm font-bold transition-all cursor-pointer shadow-xs ${
                    modalVerified === true
                      ? 'bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-400 shadow-emerald-600/25 scale-[1.02]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    modalVerified === true ? 'bg-white text-emerald-700 border-white' : 'border-slate-300 bg-slate-100'
                  }`}>
                    {modalVerified === true && <Check size={14} className="stroke-[3]" />}
                  </div>
                  <span>Yes (সঠিক ও যাচাইকৃত)</span>
                </button>

                {/* NO Option Button (Marks as Invalid) */}
                <button
                  type="button"
                  onClick={() => setModalVerified(false)}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 text-sm font-bold transition-all cursor-pointer shadow-xs ${
                    modalVerified === false
                      ? 'bg-rose-600 border-rose-600 text-white ring-2 ring-rose-400 shadow-rose-600/25 scale-[1.02]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-rose-50 hover:border-rose-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    modalVerified === false ? 'bg-white text-rose-700 border-white' : 'border-slate-300 bg-slate-100'
                  }`}>
                    {modalVerified === false && <X size={14} className="stroke-[3]" />}
                  </div>
                  <span>No (অবৈধ / Invalid)</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                {modalVerified === true
                  ? '✓ এই শিক্ষার্থীর জন্ম নিবন্ধন অনলাইনে সঠিক ও যাচাইকৃত (Verified) হিসেবে সংরক্ষিত হবে।'
                  : '❌ এটি অবৈধ / তথ্যে অমিল রয়েছে (Invalid) হিসেবে চিহ্নিত হবে।'}
              </p>
            </div>

            {/* Field 2: brn_remark (Textarea) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                মন্তব্য (brn_remark)
              </label>
              <textarea
                rows={3}
                value={modalRemark}
                onChange={(e) => setModalRemark(e.target.value)}
                placeholder="e.g. BDRIS সার্ভারে নাম ও জন্ম তারিখ মিলেছে / জন্ম তারিখ তথ্যে অমিল রয়েছে"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />

              {/* Quick suggestion tag chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  '✓ তথ্যাদি শতভাগ সঠিক ও অনলাইন যাচাইকৃত',
                  '❌ BDRIS সার্ভারে কোনো রেকর্ড পাওয়া যায়নি (Invalid)',
                  '❌ জন্ম তারিখে অমিল পরিলক্ষিত (Invalid)',
                  '⚠️ ১৭ ডিজিটের ফরম্যাটে ভুল বা অসম্পূর্ণ'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setModalRemark(preset);
                      if (preset.includes('Invalid') || preset.includes('রেকর্ড পাওয়া যায়নি') || preset.includes('অমিল')) {
                        setModalVerified(false);
                      } else if (preset.includes('সঠিক')) {
                        setModalVerified(true);
                      }
                    }}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md transition font-medium cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTrainee(null)}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSaveVerification}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-sm hover:shadow transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <Check size={14} />
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন (Save)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default BrnVerification;
