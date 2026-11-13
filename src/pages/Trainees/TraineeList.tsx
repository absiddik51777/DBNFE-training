import React, { useState, useEffect, useMemo, useRef } from 'react';
import { logActivity } from '../../lib/firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  Search, 
  Filter, 
  Download, 
  UserCheck, 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  CheckCircle2,
  Users,
  Building2,
  Wrench,
  Layers,
  Phone,
  Calendar,
  X,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  UserX,
  Award,
  ArrowUpDown,
  Upload,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { Trainee, Institute, Trade, Batch, TraineeStatus } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import { useConfirm } from '../../contexts/ConfirmationContext';
import { Link, useSearchParams } from 'react-router-dom';
import { dataService } from '../../lib/dataService';
import { toBn, safeFormatDate, normalizeUBRN } from '../../lib/dateUtils';
import { DataTableToolbar, ColumnOption, GroupByOption, ActiveFilterChip } from '../../components/TableToolbar/DataTableToolbar';
import { TraineeBulkImportModal } from '../../components/TraineeBulkImportModal';
import { TableSkeleton } from '../../components/Skeleton';
import { downloadCSV, downloadExcel, generateTraineesPDF, downloadPdfBlob } from '../../lib/exportUtils';

const ITEMS_PER_PAGE = 10;

/**
 * Helper: Classifies identification document as NID (10 or 13 digits) or BRN (17 digits)
 */
export function getDocumentType(val?: string | null): 'BRN' | 'NID' | 'OTHER' {
  if (!val) return 'OTHER';
  const digits = normalizeUBRN(val);
  if (digits.length === 17) return 'BRN';
  if (digits.length === 10 || digits.length === 13) return 'NID';
  return 'OTHER';
}

const BATCH_BADGE_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200/60',
  'bg-amber-50 text-amber-700 border-amber-200/60',
  'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  'bg-teal-50 text-teal-700 border-teal-200/60',
  'bg-purple-50 text-purple-700 border-purple-200/60',
  'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  'bg-rose-50 text-rose-700 border-rose-200/60',
];

const TraineeList: React.FC = () => {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstitute, setFilterInstitute] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // NID & BRN Document Filters (both selected default)
  const [filterIncludeNid, setFilterIncludeNid] = useState(true);
  const [filterIncludeBrn, setFilterIncludeBrn] = useState(true);
  const [sortBy, setSortBy] = useState<'id_asc' | 'id_desc' | 'name_asc' | 'batch_asc'>('id_asc');

  // Group By State
  const [groupBy, setGroupBy] = useState<string>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Export Dropdown State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingFile, setIsExportingFile] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pdfExportProgress, setPdfExportProgress] = useState('');
  const [pdfExportPercent, setPdfExportPercent] = useState<number>(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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

  // Column Visibility State (saved in localStorage)
  const DEFAULT_TRAINEE_COLUMNS: ColumnOption[] = [
    { id: 'id_reg_status', label: 'আইডি, রেজিঃ ও স্ট্যাটাস (ID, Reg & Status)', visible: true },
    { id: 'trainee_info', label: 'প্রশিক্ষণার্থী (Trainee Info)', visible: true, required: true },
    { id: 'batch_info', label: 'প্রতিষ্ঠান, ট্রেড ও ব্যাচ (Batch Info)', visible: true },
    { id: 'id_doc_info', label: 'পরিচয়পত্র ও বয়স (ID Doc & Age)', visible: true, required: true },
    { id: 'present_address', label: 'বর্তমান ঠিকানা (Present Address)', visible: true },
    { id: 'prev_education', label: 'পূর্ববর্তী শিক্ষা (Previous Education)', visible: true },
    { id: 'guardian_info', label: 'মাতার নাম ও অভিভাবক (Guardian Info)', visible: false },
    { id: 'permanent_address', label: 'স্থায়ী ঠিকানা (Permanent Address)', visible: false },
    { id: 'attendance_marks', label: 'উপস্থিতি ও মূল্যায়ন (Attendance & Marks)', visible: false },
    { id: 'actions', label: 'পদক্ষেপ (Actions)', visible: true, required: true },
  ];

  const [columns, setColumns] = useState<ColumnOption[]>(() => {
    try {
      const saved = localStorage.getItem('bnfe_trainee_visible_columns_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_TRAINEE_COLUMNS.map(col => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible
        }));
      }
    } catch (e) {}
    return DEFAULT_TRAINEE_COLUMNS;
  });

  const toggleColumn = (colId: string) => {
    setColumns(prev => {
      const next = prev.map(c => c.id === colId && !c.required ? { ...c, visible: !c.visible } : c);
      try {
        const map: Record<string, boolean> = {};
        next.forEach(c => { map[c.id] = c.visible; });
        localStorage.setItem('bnfe_trainee_visible_columns_v3', JSON.stringify(map));
      } catch (e) {}
      return next;
    });
  };

  const resetColumns = () => {
    setColumns(DEFAULT_TRAINEE_COLUMNS);
    try {
      localStorage.removeItem('bnfe_trainee_visible_columns_v3');
    } catch (e) {}
  };

  const isColVisible = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    return col ? col.visible : true;
  };

  // Helper: Format Date of Birth to DD-MM-YYYY
  const formatDobToDDMMYYYY = (dobStr?: string): string => {
    if (!dobStr) return '-';
    const clean = dobStr.trim();
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [yyyy, mm, dd] = parts;
      return `${toBn(dd)}-${toBn(mm)}-${toBn(yyyy)}`;
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return dobStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${toBn(dd)}-${toBn(mm)}-${toBn(yyyy)}`;
  };

  // Helper: Calculate age in years and months at batch start date
  const calculateAgeAtBatchStart = (t: Trainee): string => {
    if (!t.dateOfBirth) return '-';
    const birthDate = new Date(t.dateOfBirth);
    if (isNaN(birthDate.getTime())) return '-';

    const batch = batches.find(b => b.id === t.batchId);
    const refDateMs = batch?.startDate || t.trainingStartDate;
    const refDate = refDateMs ? new Date(refDateMs) : new Date();
    if (isNaN(refDate.getTime())) return '-';

    let years = refDate.getFullYear() - birthDate.getFullYear();
    let months = refDate.getMonth() - birthDate.getMonth();
    let days = refDate.getDate() - birthDate.getDate();

    if (days < 0) {
      months -= 1;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years < 0) return '-';
    if (years === 0 && months === 0) return '১ মাসের কম';
    if (years === 0) return `${toBn(months)} মাস`;
    if (months === 0) return `${toBn(years)} বছর`;
    return `${toBn(years)} বছর ${toBn(months)} মাস`;
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const GROUP_BY_OPTIONS: GroupByOption[] = [
    { id: 'none', label: 'গ্রুপ ছাড়া (Default)' },
    { id: 'batch', label: 'ব্যাচ অনুযায়ী (By Batch)' },
    { id: 'trade', label: 'ট্রেড অনুযায়ী (By Trade)' },
    { id: 'institute', label: 'প্রতিষ্ঠান অনুযায়ী (By Institute)' },
    { id: 'gender', label: 'লিঙ্গ অনুযায়ী (By Gender)' },
    { id: 'status', label: 'স্ট্যাটাস অনুযায়ী (By Status)' },
    { id: 'docType', label: 'পরিচয়পত্রের ধরন (NID vs BRN)' },
  ];

  // View mode (table or cards for mobile/tablet)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Row selection for bulk operations / export
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Safe delete / status modal state
  const [safeDeleteModalTrainee, setSafeDeleteModalTrainee] = useState<{
    trainee: Trainee;
    attendanceCount: number;
    marksCount: number;
  } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize currentPage from URL search param or sessionStorage
  const initialPage = useMemo(() => {
    const pParam = searchParams.get('page');
    if (pParam && !isNaN(Number(pParam))) {
      return Math.max(1, parseInt(pParam, 10));
    }
    const stored = sessionStorage.getItem('bnfe_trainee_return_page');
    if (stored && !isNaN(Number(stored))) {
      return Math.max(1, parseInt(stored, 10));
    }
    return 1;
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(initialPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    sessionStorage.setItem('bnfe_trainee_return_page', String(newPage));
  };

  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();
  const { confirm, showAlert } = useConfirm();

  const canCreate = hasPermission('create_trainee');
  const canEdit = hasPermission('edit_trainee');
  const canDelete = hasPermission('delete_trainee');
  const canExport = hasPermission('export_trainees');
  const canSeed = hasPermission('seed_demo_trainees');
  const canViewDetails = hasPermission('view_trainee_details');

  // Restore scroll position after loading completes
  useEffect(() => {
    if (!loading) {
      const scrollParam = searchParams.get('scroll') || sessionStorage.getItem('bnfe_trainee_return_scroll');
      if (scrollParam) {
        const scrollY = parseInt(scrollParam, 10);
        if (!isNaN(scrollY) && scrollY > 0) {
          const timer = setTimeout(() => {
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            sessionStorage.removeItem('bnfe_trainee_return_scroll');
          }, 120);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [loading]);

  const getEditUrl = (traineeId: string) => {
    const scrollPos = typeof window !== 'undefined' ? Math.round(window.scrollY) : 0;
    return `/trainees/edit/${traineeId}?returnPage=${currentPage}&returnScroll=${scrollPos}`;
  };

  const handleEditClick = () => {
    const scrollPos = typeof window !== 'undefined' ? Math.round(window.scrollY) : 0;
    sessionStorage.setItem('bnfe_trainee_return_page', String(currentPage));
    sessionStorage.setItem('bnfe_trainee_return_scroll', String(scrollPos));
  };

  useEffect(() => {
    fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [instData, tradesData, batchesData, traineesData] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees')
      ]);
      
      setInstitutes(instData);
      setTrades(tradesData);
      setBatches(batchesData);
      setTrainees(traineesData);

      // Auto-filter if user is Trainer assigned to a batch or institute
      if (userProfile?.role === 'Trainer') {
        if (userProfile.instituteId && !filterInstitute) {
          setFilterInstitute(userProfile.instituteId);
        }
        if (userProfile.batchId && !filterBatch) {
          setFilterBatch(userProfile.batchId);
        }
      }
    } catch (error) {
      console.warn("Notice fetching trainees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Trainee KPI Stats
  const stats = useMemo(() => {
    const scopedList = userProfile?.role === 'Trainer' && userProfile.batchId
      ? trainees.filter(t => t.batchId === userProfile.batchId)
      : trainees;

    const total = scopedList.length;
    const active = scopedList.filter(t => !t.status || t.status === 'Active').length;
    const completed = scopedList.filter(t => t.status === 'Completed').length;
    const dropped = scopedList.filter(t => t.status === 'Dropped Out').length;
    const archived = scopedList.filter(t => t.status === 'Archived' || t.isArchived).length;
    const female = scopedList.filter(t => t.gender === 'Female').length;
    const male = scopedList.filter(t => t.gender === 'Male').length;
    return { total, active, completed, dropped, archived, female, male };
  }, [trainees, userProfile]);

  // Helper names
  const getInstituteName = (id?: string) => institutes.find(i => i.id === id)?.name || id || '-';
  const getTradeName = (id?: string) => trades.find(t => t.id === id)?.name || id || '-';
  const getBatchName = (id?: string) => batches.find(b => b.id === id)?.name || id || '-';

  // Dynamic Batch Filter Options: based on selected institute and trade
  const availableBatchOptions = useMemo(() => {
    if (userProfile?.role === 'Trainer' && userProfile.batchId) {
      return batches.filter(b => b.id === userProfile.batchId);
    }
    return batches.filter(b => {
      if (filterInstitute && b.instituteId !== filterInstitute) return false;
      if (filterTrade && b.tradeId !== filterTrade) return false;
      return true;
    });
  }, [batches, filterInstitute, filterTrade, userProfile]);

  // Filter & Search Logic
  const filteredTrainees = useMemo(() => {
    return trainees
      .filter((t) => {
        // Strict Trainer Batch Isolation: Trainers cannot see or act upon trainees outside their assigned batch
        if (userProfile?.role === 'Trainer' && userProfile.batchId && t.batchId !== userProfile.batchId) {
          return false;
        }
        // Search text: Name (BN/EN), Reg No, Trainee ID, Mobile
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const matchNameEn = (t.nameEn || '').toLowerCase().includes(term);
          const matchNameBn = (t.nameBn || '').includes(term);
          const matchReg = (t.registrationNumber || '').toLowerCase().includes(term);
          const matchId = (t.traineeId || t.id || '').toLowerCase().includes(term);
          const matchPhone = (t.mobileNumber || '').includes(term);
          if (!matchNameEn && !matchNameBn && !matchReg && !matchId && !matchPhone) {
            return false;
          }
        }

        // Dropdown Filters
        if (filterInstitute && t.instituteId !== filterInstitute) return false;
        if (filterTrade && t.tradeId !== filterTrade) return false;
        if (filterBatch && t.batchId !== filterBatch) return false;
        if (filterGender && t.gender !== filterGender) return false;
        if (filterStatus) {
          const tStatus = t.status || 'Active';
          if (tStatus !== filterStatus) return false;
        }

        // NID & BRN Document Filters (both selected default)
        const docType = getDocumentType(t.nidOrBirthRegistration);
        if (filterIncludeNid && !filterIncludeBrn) {
          // Strictly only NID (10 or 13 digits)
          if (docType !== 'NID') return false;
        } else if (filterIncludeBrn && !filterIncludeNid) {
          // Strictly only BRN (17 digits)
          if (docType !== 'BRN') return false;
        } else if (!filterIncludeNid && !filterIncludeBrn) {
          // Neither selected -> return empty
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'id_asc') return (a.traineeId || a.id).localeCompare(b.traineeId || b.id);
        if (sortBy === 'id_desc') return (b.traineeId || b.id).localeCompare(a.traineeId || a.id);
        if (sortBy === 'name_asc') return (a.nameBn || a.nameEn || '').localeCompare(b.nameBn || b.nameEn || '');
        if (sortBy === 'batch_asc') return (getBatchName(a.batchId)).localeCompare(getBatchName(b.batchId));
        return 0;
      });
  }, [trainees, searchTerm, filterInstitute, filterTrade, filterBatch, filterGender, filterStatus, filterIncludeNid, filterIncludeBrn, sortBy, batches]);

  const isTrainer = userProfile?.role === 'Trainer';

  // Real-time document counts for NID and BRN within scoped data
  const docCounts = useMemo(() => {
    let nid = 0;
    let brn = 0;
    let other = 0;
    trainees.forEach(t => {
      if (userProfile?.role === 'Trainer' && userProfile.batchId && t.batchId !== userProfile.batchId) {
        return;
      }
      const dt = getDocumentType(t.nidOrBirthRegistration);
      if (dt === 'NID') nid++;
      else if (dt === 'BRN') brn++;
      else other++;
    });
    return { nid, brn, other };
  }, [trainees, userProfile]);

  // Batch tabs data with trainee counts (matching User Screenshot 1)
  const batchTabsData = useMemo(() => {
    const scopedList = trainees.filter(t => {
      if (userProfile?.role === 'Trainer' && userProfile.batchId && t.batchId !== userProfile.batchId) return false;
      if (filterInstitute && t.instituteId !== filterInstitute) return false;
      if (filterTrade && t.tradeId !== filterTrade) return false;
      return true;
    });

    const totalCount = scopedList.length;

    const counts = new Map<string, number>();
    scopedList.forEach(t => {
      if (t.batchId) {
        counts.set(t.batchId, (counts.get(t.batchId) || 0) + 1);
      }
    });

    const items = availableBatchOptions.map((b, idx) => ({
      id: b.id,
      name: b.name,
      code: b.batchCode,
      count: counts.get(b.id) || 0,
      idx
    }));

    return { totalCount, items };
  }, [trainees, availableBatchOptions, filterInstitute, filterTrade, userProfile]);

  // Active filter chips (matching screenshot removable tags)
  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (!isTrainer && filterInstitute) {
      const inst = institutes.find(i => i.id === filterInstitute);
      chips.push({
        id: 'institute',
        label: 'প্রতিষ্ঠান',
        valueLabel: inst ? inst.name : filterInstitute,
        onRemove: () => { setFilterInstitute(''); setFilterBatch(''); setCurrentPage(1); }
      });
    }
    if (!isTrainer && filterTrade) {
      const trd = trades.find(t => t.id === filterTrade);
      chips.push({
        id: 'trade',
        label: 'ট্রেড',
        valueLabel: trd ? trd.name : filterTrade,
        onRemove: () => { setFilterTrade(''); setFilterBatch(''); setCurrentPage(1); }
      });
    }
    if (!isTrainer && filterBatch) {
      const btc = batches.find(b => b.id === filterBatch);
      chips.push({
        id: 'batch',
        label: 'ব্যাচ',
        valueLabel: btc ? btc.name : filterBatch,
        onRemove: () => { setFilterBatch(''); setCurrentPage(1); }
      });
    }
    if (filterGender) {
      chips.push({
        id: 'gender',
        label: 'লিঙ্গ',
        valueLabel: filterGender === 'Female' ? 'নারী' : filterGender === 'Male' ? 'পুরুষ' : 'অন্যান্য',
        onRemove: () => { setFilterGender(''); setCurrentPage(1); }
      });
    }
    if (filterStatus) {
      chips.push({
        id: 'status',
        label: 'স্ট্যাটাস',
        valueLabel: filterStatus === 'Active' ? 'সক্রিয়' : filterStatus === 'Completed' ? 'সম্পন্ন' : filterStatus === 'Dropped Out' ? 'ঝরে পড়া' : filterStatus === 'Archived' ? 'আর্কাইভকৃত' : filterStatus,
        onRemove: () => { setFilterStatus(''); setCurrentPage(1); }
      });
    }
    if (!filterIncludeNid || !filterIncludeBrn) {
      chips.push({
        id: 'doc',
        label: 'পরিচয়পত্র',
        valueLabel: filterIncludeNid && !filterIncludeBrn ? 'শুধু NID' : !filterIncludeNid && filterIncludeBrn ? 'শুধু BRN' : 'উভয়ই বন্ধ',
        onRemove: () => { setFilterIncludeNid(true); setFilterIncludeBrn(true); setCurrentPage(1); }
      });
    }
    return chips;
  }, [isTrainer, filterInstitute, filterTrade, filterBatch, filterGender, filterStatus, filterIncludeNid, filterIncludeBrn, institutes, trades, batches]);

  const activeFiltersCount = activeFilterChips.length;

  // Grouped trainees list when Group By is active
  const groupedTrainees = useMemo(() => {
    if (groupBy === 'none') return null;

    const map = new Map<string, { title: string; subtitle?: string; items: Trainee[] }>();

    filteredTrainees.forEach(t => {
      let key = '';
      let title = '';
      let subtitle: string | undefined = undefined;

      if (groupBy === 'batch') {
        key = t.batchId || 'unassigned';
        title = t.batchId ? getBatchName(t.batchId) : 'ব্যাচ অনির্ধারিত';
        subtitle = t.batchId ? `ট্রেড: ${getTradeName(t.tradeId)}` : undefined;
      } else if (groupBy === 'trade') {
        key = t.tradeId || 'unassigned';
        title = t.tradeId ? getTradeName(t.tradeId) : 'ট্রেড অনির্ধারিত';
      } else if (groupBy === 'institute') {
        key = t.instituteId || 'unassigned';
        title = t.instituteId ? getInstituteName(t.instituteId) : 'প্রতিষ্ঠান অনির্ধারিত';
      } else if (groupBy === 'gender') {
        key = t.gender || 'Unknown';
        title = t.gender === 'Female' ? 'নারী শিক্ষার্থী (Female)' : t.gender === 'Male' ? 'পুরুষ শিক্ষার্থী (Male)' : 'অন্যান্য লিঙ্গ';
      } else if (groupBy === 'status') {
        key = t.status || 'Active';
        title = t.status === 'Active' ? 'সক্রিয় শিক্ষার্থী (Active)' : t.status === 'Completed' ? 'সম্পন্ন (Completed)' : t.status === 'Dropped Out' ? 'ঝরে পড়া (Dropped Out)' : t.status === 'Archived' ? 'সংরক্ষণাগার / আর্কাইভকৃত (Archived)' : (t.status || 'অন্যান্য');
      } else if (groupBy === 'docType') {
        const dt = getDocumentType(t.nidOrBirthRegistration);
        key = dt;
        title = dt === 'BRN' ? 'জন্ম নিবন্ধন সনদ (BRN - ১৭ ডিজিট)' : dt === 'NID' ? 'জাতীয় পরিচয়পত্র (NID - ১০ বা ১৩ ডিজিট)' : 'অনুপস্থিত বা অনির্ধারিত ডকুমেন্ট';
      }

      if (!map.has(key)) {
        map.set(key, { title, subtitle, items: [] });
      }
      map.get(key)!.items.push(t);
    });

    const list: { key: string; title: string; subtitle?: string; items: Trainee[] }[] = [];
    map.forEach((val, key) => {
      list.push({ key, title: val.title, subtitle: val.subtitle, items: val.items });
    });

    return list;
  }, [filteredTrainees, groupBy, batches, trades, institutes]);

  const handleClearFilters = () => {
    setSearchTerm('');
    if (!isTrainer) {
      setFilterInstitute('');
      setFilterBatch('');
      setFilterTrade('');
    }
    setFilterGender('');
    setFilterStatus('');
    setFilterIncludeNid(true);
    setFilterIncludeBrn(true);
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredTrainees.length / ITEMS_PER_PAGE) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrainees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTrainees, currentPage]);

  // Selection handlers
  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    const allPageSelected = paginatedList.every(t => next.has(t.id));
    if (allPageSelected) {
      paginatedList.forEach(t => next.delete(t.id));
    } else {
      paginatedList.forEach(t => next.add(t.id));
    }
    setSelectedIds(next);
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredTrainees.map(t => t.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Safe Delete Flow: Fallback to archive when deleting is denied
  const handleDeleteRequest = async (trainee: Trainee) => {
    if (!canDelete) return;

    // 1. If system deletion is denied by settings, fallback to archive with confirmation
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'রেকর্ড আর্কাইভে স্থানান্তর (Fallback to Archive)',
        message: `সিস্টেম সেটিংস অনুযায়ী ডাটা স্থায়ীভাবে মুছে ফেলা বন্ধ (Denied) রয়েছে। আপনি কি "${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})" শিক্ষার্থীর রেকর্ডটি ডিলিটের পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ আর্কাইভে স্থানান্তর করলে শিক্ষার্থীর যাবতীয় ইতিহাস, হাজিরা ও পরীক্ষার তথ্য ডাটাবেজে অক্ষুণ্ণ রেখে সক্রিয় তালিকা থেকে লুকায়িত রাখা হবে। পরবর্তীতে যে কোনো সময় এটি সক্রিয় তালিকায় ফিরিয়ে আনা যাবে।',
        confirmText: 'হ্যাঁ, আর্কাইভে পাঠান (Archive)',
        cancelText: 'বাতিল',
        variant: 'warning',
      });

      if (confirmed) {
        await dataService.archiveRecord('trainees', trainee.id, 'সিস্টেমে ডিলিট বন্ধ থাকায় ব্যবহারকারীর নির্দেশে সংরক্ষণাগারে স্থানান্তর');
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রশিক্ষণার্থী আর্কাইভে স্থানান্তর (ডিলিট নিষিদ্ধ থাকায় ফলব্যাক): ${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})`,
          'Trainees',
          trainee.id
        );
        setActionSuccessMessage(`"${trainee.nameBn || trainee.nameEn}" শিক্ষার্থীর রেকর্ড সফলভাবে আর্কাইভে স্থানান্তর করা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        fetchData();
      }
      return;
    }

    try {
      const usage = await dataService.checkTraineeUsage(trainee.id);
      if (usage.isReferenced) {
        // Referenced! Block hard deletion and open status/archive transition modal
        setSafeDeleteModalTrainee({
          trainee,
          attendanceCount: usage.attendanceCount,
          marksCount: usage.marksCount
        });

        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রশিক্ষণার্থী মোছার চেষ্টা (রেকর্ড বিদ্যমান থাকায় বিকল্প ট্রানজিশন উন্মুক্ত): ${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})`,
          'Trainees',
          trainee.id
        );
      } else {
        // Unreferenced: Safe to hard delete with beautiful confirmation modal
        const confirmed = await confirm({
          title: 'প্রশিক্ষণার্থী রেকর্ড অপসারণ',
          message: `আপনি কি নিশ্চিতভাবে "${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})" এর রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?`,
          detail: 'এই অপারেশনের ফলে শিক্ষার্থীর তথ্য ডাটাবেজ থেকে স্থায়ীভাবে মুছে যাবে এবং এটি পূর্বাবস্থায় ফেরানো যাবে না।',
          confirmText: 'হ্যাঁ, মুছে ফেলুন',
          cancelText: 'বাতিল',
          variant: 'danger',
        });
        if (confirmed) {
          await dataService.deleteItem('trainees', trainee.id);
          await logActivity(
            userProfile?.id || '',
            userProfile?.name || 'User',
            `প্রশিক্ষণার্থী স্থায়ীভাবে অপসারণ: ${trainee.nameBn || trainee.nameEn} (${trainee.registrationNumber})`,
            'Trainees',
            trainee.id
          );
          setActionSuccessMessage(`"${trainee.nameBn || trainee.nameEn}" শিক্ষার্থীর রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`);
          setTimeout(() => setActionSuccessMessage(''), 3000);
          fetchData();
        }
      }
    } catch (err) {
      console.warn("Error checking trainee usage:", err);
    }
  };

  // Change status of a referenced trainee instead of deleting (Supports Archive)
  const handleUpdateStatusSafe = async (status: TraineeStatus) => {
    if (!safeDeleteModalTrainee || !canEdit) return;
    const { trainee } = safeDeleteModalTrainee;

    try {
      const isArchiving = status === 'Archived';
      const updated: Trainee = {
        ...trainee,
        status,
        isArchived: isArchiving,
        archivedAt: isArchiving ? Date.now() : undefined,
        archivedReason: isArchiving ? 'রেফারেন্স ডেটা বিদ্যমান থাকায় মোছার পরিবর্তে সংরক্ষণাগারে স্থানান্তর' : undefined,
        updatedAt: Date.now()
      };
      await dataService.saveItem('trainees', updated);

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `প্রশিক্ষণার্থী স্ট্যাটাস পরিবর্তন: ${trainee.nameBn} -> ${status}`,
        'Trainees',
        trainee.id
      );

      const statusLabels: Record<string, string> = {
        'Active': 'সক্রিয়',
        'Completed': 'কোর্স সম্পন্ন',
        'Dropped Out': 'ঝরে পড়া',
        'Archived': 'সংরক্ষণাগার (আর্কাইভ)'
      };
      setActionSuccessMessage(`"${trainee.nameBn || trainee.nameEn}" শিক্ষার্থীর স্ট্যাটাস '${statusLabels[status] || status}' হিসেবে আপডেট করা হয়েছে।`);
      setTimeout(() => setActionSuccessMessage(''), 3500);

      setSafeDeleteModalTrainee(null);
      fetchData();
    } catch (err) {
      console.warn("Could not update trainee status:", err);
    }
  };

  // Restore/Unarchive an archived trainee
  const handleRestoreTrainee = async (trainee: Trainee) => {
    if (!canEdit) return;
    try {
      await dataService.unarchiveRecord('trainees', trainee.id);
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `আর্কাইভ থেকে প্রশিক্ষণার্থী পুনরুদ্ধার: ${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})`,
        'Trainees',
        trainee.id
      );
      setActionSuccessMessage(`"${trainee.nameBn || trainee.nameEn}" শিক্ষার্থী সফলভাবে সক্রিয় তালিকায় ফিরিয়ে আনা হয়েছে।`);
      setTimeout(() => setActionSuccessMessage(''), 3500);
      fetchData();
    } catch (err) {
      console.warn("Could not unarchive trainee:", err);
    }
  };

  // Bulk Status Update for selected trainees
  const handleBulkStatusUpdate = async (newStatus: TraineeStatus) => {
    if (selectedIds.size === 0 || !canEdit) return;

    const confirmed = await confirm({
      title: 'বাল্ক স্ট্যাটাস পরিবর্তন',
      message: `আপনি কি নিশ্চিতভাবে নির্বাচিত ${toBn(selectedIds.size)} জন শিক্ষার্থীর স্ট্যাটাস '${newStatus === 'Dropped Out' ? 'ঝরে পড়া' : newStatus === 'Completed' ? 'কোর্স সম্পন্ন' : 'সক্রিয়'}' করতে চান?`,
      confirmText: 'হ্যাঁ, পরিবর্তন করুন',
      cancelText: 'বাতিল',
      variant: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      const selectedTrainees = trainees.filter(t => selectedIds.has(t.id));
      for (const t of selectedTrainees) {
        await dataService.saveItem('trainees', { ...t, status: newStatus, updatedAt: Date.now() });
      }

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `বাল্ক স্ট্যাটাস আপডেট (${selectedIds.size} জন শিক্ষার্থী -> ${newStatus})`,
        'Trainees',
        'bulk_status'
      );

      setActionSuccessMessage(`নির্বাচিত ${selectedIds.size} জন শিক্ষার্থীর স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে।`);
      setTimeout(() => setActionSuccessMessage(''), 3500);
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      console.warn("Bulk status update failed:", err);
    }
  };

  // Seed demo trainees
  const handleSeedDemoTrainees = async () => {
    setSeeding(true);
    try {
      await dataService.seedDemoTraineesForAllBatches(false);
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        'সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী অন্তর্ভুক্তকরণ',
        'Trainees',
        'seed_demo_trainees'
      );
      await fetchData();
      setActionSuccessMessage('সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী সফলভাবে যুক্ত করা হয়েছে!');
      setTimeout(() => setActionSuccessMessage(''), 5000);
    } catch (error) {
      console.warn("Notice seeding demo trainees:", error);
    } finally {
      setSeeding(false);
    }
  };

  // Enhanced Export: Supports Direct PDF (.pdf), Excel (.xlsx) and CSV
  const handleExportData = async (formatType: 'csv' | 'excel' | 'pdf') => {
    if (isExportingFile || isPdfExporting) return;

    if (!canExport) {
      await showAlert({
        title: 'অনুমতি নেই',
        message: "আপনার তথ্য এক্সপোর্ট করার অনুমতি নেই।",
        variant: 'warning'
      });
      return;
    }

    const exportList = selectedIds.size > 0 
      ? filteredTrainees.filter(t => selectedIds.has(t.id))
      : filteredTrainees;

    if (exportList.length === 0) {
      await showAlert({
        title: 'তথ্য নেই',
        message: "এক্সপোর্ট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।",
        variant: 'info'
      });
      return;
    }

    // Direct PDF Export (Specifically optimized for Android APK and Web)
    if (formatType === 'pdf') {
      try {
        const estPages = Math.ceil(exportList.length / 8) || 1;
        setIsPdfExporting(true);
        setPdfExportPercent(5);
        setPdfCurrentPage(1);
        setPdfTotalPages(estPages);
        setPdfExportProgress('পিডিএফ ইঞ্জিন প্রস্তুত হচ্ছে...');

        const activeFilterSummary = [
          filterInstitute ? `প্রতিষ্ঠান: ${getInstituteName(filterInstitute)}` : '',
          filterTrade ? `ট্রেড: ${getTradeName(filterTrade)}` : '',
          filterBatch ? `ব্যাচ: ${getBatchName(filterBatch)}` : '',
          searchTerm ? `অনুসন্ধান: "${searchTerm}"` : ''
        ].filter(Boolean).join(' • ');

        const dateStr = new Date().toISOString().split('T')[0];
        const batchNamePart = filterBatch ? `_${getBatchName(filterBatch).replace(/\s+/g, '_')}` : '';
        const baseFilename = `BNFE_Trainee_List${batchNamePart}_${dateStr}.pdf`;

        const pdfBlob = await generateTraineesPDF({
          trainees: exportList,
          institutes,
          trades,
          batches,
          filterDetails: activeFilterSummary || undefined,
          generatedBy: userProfile?.name || 'কোর্স পরিচালক',
          onProgress: (current, total, msg, percent) => {
            setPdfCurrentPage(current);
            setPdfTotalPages(total);
            setPdfExportProgress(msg);
            if (typeof percent === 'number') {
              setPdfExportPercent(percent);
            } else {
              setPdfExportPercent(Math.min(95, Math.round((current / total) * 100)));
            }
          }
        });

        setPdfExportPercent(100);
        setPdfExportProgress('Downloads ফোল্ডারে সংরক্ষণ হচ্ছে...');
        const downloadRes = await downloadPdfBlob(pdfBlob, baseFilename, 'প্রশিক্ষণার্থী তালিকা');

        if (downloadRes.success) {
          setActionSuccessMessage(`${downloadRes.message} (${toBn(exportList.length)} জন শিক্ষার্থী)`);
          setTimeout(() => setActionSuccessMessage(''), 6000);
          logActivity(
            userProfile?.id || '',
            userProfile?.name || 'User',
            `প্রশিক্ষণার্থী তালিকা PDF এক্সপোর্ট সম্পন্ন (${exportList.length} জন)`,
            'Trainees',
            'export_pdf'
          );
        } else {
          await showAlert({
            title: 'ডাউনলোড ব্যর্থ',
            message: downloadRes.message || 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
            variant: 'danger'
          });
        }
      } catch (pdfErr: any) {
        console.error('PDF Export Error:', pdfErr);
        await showAlert({
          title: 'এক্সপোর্ট ত্রুটি',
          message: pdfErr?.message || 'পিডিএফ ফাইল তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
          variant: 'danger'
        });
      } finally {
        setTimeout(() => {
          setIsPdfExporting(false);
          setPdfExportProgress('');
          setPdfExportPercent(0);
        }, 800);
      }
      return;
    }

    const headers = [
      'প্রশিক্ষণার্থী আইডি (Trainee ID)',
      'রেজিস্ট্রেশন নম্বর (Reg No)',
      'পূর্ণ নাম (বাংলা)',
      'পূর্ণ নাম (ইংরেজি)',
      'পিতার নাম (বাংলা)',
      'পিতার নাম (ইংরেজি)',
      'মাতার নাম (বাংলা)',
      'মাতার নাম (ইংরেজি)',
      'জন্ম তারিখ',
      'লিঙ্গ',
      'পরিচয়পত্রের ধরন (Doc Type)',
      'জাতীয় পরিচয়পত্র / জন্মনিবন্ধন নম্বর (NID/UBRN)',
      'জন্মনিবন্ধন অনলাইন যাচাই অবস্থা',
      'যাচাই মন্তব্য (Remark)',
      'যাচাইকরণের তারিখ',
      'মোবাইল নম্বর',
      'প্রশিক্ষণ প্রতিষ্ঠান',
      'বৃত্তিমূলক ট্রেড',
      'প্রশিক্ষণ ব্যাচ',
      'বর্তমান ঠিকানা',
      'স্থায়ী ঠিকানা',
      'সর্বশেষ পাসকৃত শ্রেণি',
      'স্ট্যাটাস'
    ];

    const rows = exportList.map(t => {
      const inst = getInstituteName(t.instituteId);
      const trd = getTradeName(t.tradeId);
      const btc = getBatchName(t.batchId);
      const perm = t.permanentAddress || t.address || '';
      const pres = t.presentAddress || t.address || '';
      
      const dt = getDocumentType(t.nidOrBirthRegistration);
      const docTypeLabel = dt === 'BRN'
        ? 'জন্ম নিবন্ধন (BRN - ১৭ ডিজিট)'
        : dt === 'NID'
          ? `জাতীয় পরিচয়পত্র (NID - ${toBn(normalizeUBRN(t.nidOrBirthRegistration).length)} ডিজিট)`
          : 'অনুপস্থিত / অনির্ধারিত';

      const brnStatus = t.is_brn_verified === true
        ? 'Valid (যাচাইকৃত)'
        : t.is_brn_verified === false
          ? 'Invalid (অবৈধ)'
          : 'Pending (অপেক্ষমাণ)';
      const brnVerifiedAt = t.brn_verified_at ? safeFormatDate(t.brn_verified_at, 'yyyy-MM-dd') : '';

      return [
        t.traineeId || '',
        t.registrationNumber || '',
        t.nameBn || '',
        t.nameEn || '',
        t.fatherNameBn || (t as any).fatherName || '',
        t.fatherNameEn || (t as any).fatherName || '',
        t.motherNameBn || (t as any).motherName || '',
        t.motherNameEn || (t as any).motherName || '',
        t.dateOfBirth || '',
        t.gender === 'Female' ? 'নারী' : 'পুরুষ',
        docTypeLabel,
        t.nidOrBirthRegistration || '',
        brnStatus,
        t.brn_remark || '',
        brnVerifiedAt,
        t.mobileNumber || '',
        inst,
        trd,
        btc,
        pres,
        perm,
        t.lastClassCompleted || '',
        t.status || 'Active'
      ];
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const baseFilename = `BNFE_Trainee_List_${dateStr}`;

    setIsExportingFile(true);
    try {
      const exportResult = formatType === 'excel'
        ? await downloadExcel(
            baseFilename,
            'Trainees',
            headers,
            rows,
            [18, 16, 24, 24, 20, 20, 20, 20, 14, 10, 26, 24, 20, 24, 16, 16, 26, 22, 20, 24, 24, 18, 14]
          )
        : await downloadCSV(baseFilename, headers, rows);

      if (exportResult.success) {
        setActionSuccessMessage(`${exportResult.message} (${toBn(exportList.length)} জন শিক্ষার্থী)`);
        setTimeout(() => setActionSuccessMessage(''), 6000);
        logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রশিক্ষণার্থী তালিকা ${formatType.toUpperCase()} এক্সপোর্ট সম্পন্ন (${exportList.length} জন)`,
          'Trainees',
          `export_${formatType}`
        );
      } else {
        await showAlert({
          title: 'ডাউনলোড ব্যর্থ',
          message: exportResult.message || 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
          variant: 'danger'
        });
      }
    } catch (exportErr: any) {
      console.error('Export Error:', exportErr);
      await showAlert({
        title: 'এক্সপোর্ট ত্রুটি',
        message: exportErr?.message || 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
        variant: 'danger'
      });
    } finally {
      setIsExportingFile(false);
    }
  };

  const renderStatusBadge = (status?: TraineeStatus) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">সক্রিয়</span>;
      case 'Completed':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">কোর্স সম্পন্ন</span>;
      case 'Dropped Out':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">ঝরে পড়া</span>;
      case 'Archived':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-800 border border-slate-300 flex items-center space-x-1"><Archive size={11} className="inline mr-1" /><span>আর্কাইভকৃত</span></span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">সক্রিয়</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <div className="h-4 w-48 bg-slate-200/80 rounded animate-pulse mb-2" />
            <div className="h-8 w-72 bg-slate-200/80 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="h-12 w-full bg-slate-100 rounded-2xl animate-pulse mb-2" />
        <TableSkeleton rows={8} cols={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* ======================================================== */}
      {/* 1. HEADER BANNER & ACTION BAR                            */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 mb-1">
            <span>উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)</span>
            <span>•</span>
            <span>ঝরে পড়া কিশোর-কিশোরী নিবন্ধন</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            প্রশিক্ষণার্থী তালিকা (Trainee List)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            কারিগরি দক্ষতা উন্নয়ন কোর্সে ভর্তিকৃত শিক্ষার্থীদের সার্বিক তথ্য ও নিবন্ধন রেজিস্টার
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition flex items-center space-x-1 shadow-2xs"
            title="তথ্য রিফ্রেশ করুন"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">রিফ্রেশ</span>
          </button>

          {/* Export Dropdown (Excel & CSV under Export Button dropdown) */}
          {canExport && (
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 shadow-2xs transition cursor-pointer"
                title="তথ্য এক্সপোর্ট করুন (Export Data)"
              >
                <Download size={15} className="text-emerald-700" />
                <span>এক্সপোর্ট (Export)</span>
                {selectedIds.size > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {toBn(selectedIds.size)}
                  </span>
                )}
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 text-xs animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1.5 flex items-center justify-between">
                    <span>এক্সপোর্ট ফরম্যাট নির্বাচন করুন</span>
                    {selectedIds.size > 0 && (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[9.5px]">
                        নির্বাচিত {toBn(selectedIds.size)} জন
                      </span>
                    )}
                  </div>

                  {/* Option 1: Direct PDF (.pdf) File Download (APK & Mobile Friendly) */}
                  <button
                    type="button"
                    disabled={isPdfExporting || isExportingFile}
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportData('pdf');
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-800 flex items-center space-x-2.5 transition cursor-pointer font-medium mb-1 border border-transparent hover:border-rose-100 group disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <FileText size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 group-hover:text-rose-900">পিডিএফ (.pdf) ফাইল</span>
                        <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-bold">সরাসরি ডাউনলোড</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">টেবিল অনুযায়ী পূর্ণাঙ্গ তালিকা ও APK বান্ধব</div>
                    </div>
                  </button>

                  {/* Option 2: Microsoft Excel (.xlsx) */}
                  <button
                    type="button"
                    disabled={isExportingFile || isPdfExporting}
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportData('excel');
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center space-x-2.5 transition cursor-pointer font-medium disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">মাইক্রোসফট এক্সেল (.xlsx)</div>
                      <div className="text-[10px] text-slate-500">টেক্সট ফরম্যাট সহ স্প্রেডশিট</div>
                    </div>
                  </button>

                  {/* Option 3: CSV (.csv) */}
                  <button
                    type="button"
                    disabled={isExportingFile || isPdfExporting}
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportData('csv');
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-teal-50 text-slate-700 hover:text-teal-800 flex items-center space-x-2.5 transition cursor-pointer font-medium mt-1 disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <Download size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">সিএসভি (.csv) ফাইল</div>
                      <div className="text-[10px] text-slate-500">বাংলা ইউনিকোড UTF-8 ফরম্যাট</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {canCreate && (
            <button
              onClick={() => setBulkImportOpen(true)}
              className="px-3.5 py-2.5 bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
              title="এক্সেল অথবা সিএসভি ফাইলের মাধ্যমে একযোগে একাধিক শিক্ষার্থী নিবন্ধন করুন"
            >
              <Upload size={16} className="text-teal-700" />
              <span>বাল্ক ইনপুট (Excel/CSV)</span>
            </button>
          )}

          {canCreate && (
            <Link
              to="/trainees/add"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20 transition"
            >
              <Plus size={18} />
              <span>নতুন শিক্ষার্থী ভর্তি</span>
            </Link>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. TABLE TOOLBAR (GROUP BY | SEARCH + FILTER + COLUMNS)  */}
      {/* ======================================================== */}
      <DataTableToolbar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
        searchPlaceholder="শিক্ষার্থীর নাম, আইডি, রেজিঃ বা মোবাইল..."
        groupBy={groupBy}
        onGroupByChange={(val) => setGroupBy(val)}
        groupByOptions={GROUP_BY_OPTIONS}
        groupByLabel="গ্রুপ করুন (Group by)"
        filterCount={activeFilterChips.length}
        onClearAllFilters={handleClearFilters}
        activeFilterChips={activeFilterChips}
        renderFilterContent={(close) => (
          <div className="space-y-3.5 text-xs">
            {!isTrainer && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">প্রশিক্ষণ প্রতিষ্ঠান:</label>
                  <select
                    value={filterInstitute}
                    onChange={(e) => { 
                      setFilterInstitute(e.target.value); 
                      setFilterBatch(''); 
                      setCurrentPage(1); 
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">সকল প্রতিষ্ঠান ({toBn(institutes.length)}টি)</option>
                    {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">বৃত্তিমূলক ট্রেড:</label>
                  <select
                    value={filterTrade}
                    onChange={(e) => { 
                      setFilterTrade(e.target.value); 
                      setFilterBatch(''); 
                      setCurrentPage(1); 
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">সকল ট্রেড ({toBn(trades.length)}টি)</option>
                    {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">প্রশিক্ষণ ব্যাচ:</label>
                  <select
                    value={filterBatch}
                    onChange={(e) => { setFilterBatch(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">সকল ব্যাচ ({toBn(availableBatchOptions.length)}টি)</option>
                    {availableBatchOptions.map(b => <option key={b.id} value={b.id}>{b.name} ({b.batchCode || b.id})</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">লিঙ্গ:</label>
                <select
                  value={filterGender}
                  onChange={(e) => { setFilterGender(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">সকল লিঙ্গ</option>
                  <option value="Male">পুরুষ (Male)</option>
                  <option value="Female">নারী (Female)</option>
                  <option value="Other">অন্যান্য</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">স্ট্যাটাস:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">সকল অবস্থা</option>
                  <option value="Active">সক্রিয় (Active)</option>
                  <option value="Completed">সম্পন্ন (Completed)</option>
                  <option value="Dropped Out">ঝরে পড়া (Dropped Out)</option>
                  <option value="Archived">সংরক্ষণাগার (Archived)</option>
                </select>
              </div>
            </div>

            {/* 2. Document Type Segmented Control (Matching User Screenshot 2) */}
            <div className="pt-2.5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800">
                  Document Type (পরিচয়পত্রের ধরন)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setFilterIncludeNid(true);
                    setFilterIncludeBrn(true);
                    setCurrentPage(1);
                  }}
                  className={`text-[11px] font-bold transition cursor-pointer ${
                    filterIncludeNid && filterIncludeBrn
                      ? 'text-emerald-700 hover:underline'
                      : 'text-slate-500 hover:text-emerald-600 hover:underline'
                  }`}
                  title="উভয় ডকুমেন্ট ফিল্টার একসাথে চালু করুন"
                >
                  {filterIncludeNid && filterIncludeBrn ? '✓ উভয়ই সক্রিয় (Both)' : 'উভয়ই দেখুন (Select Both)'}
                </button>
              </div>

              {/* Segmented Dual Card Container */}
              <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex items-stretch gap-1.5">
                {/* BRN Card (Matching Screenshot 2 Mint Green) */}
                <button
                  type="button"
                  onClick={() => {
                    if (filterIncludeBrn && !filterIncludeNid) {
                      setFilterIncludeNid(true);
                    } else if (filterIncludeNid && filterIncludeBrn) {
                      setFilterIncludeNid(false);
                    } else {
                      setFilterIncludeBrn(true);
                      setFilterIncludeNid(false);
                    }
                    setCurrentPage(1);
                  }}
                  className={`flex-1 py-3 px-3 rounded-xl transition cursor-pointer text-center relative flex flex-col items-center justify-center ${
                    filterIncludeBrn
                      ? 'bg-[#A7F3D0] text-emerald-950 border border-emerald-300 shadow-2xs ring-1 ring-emerald-500/20'
                      : 'bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800'
                  }`}
                >
                  <div className="font-extrabold text-base sm:text-lg tracking-wide flex items-center justify-center space-x-1.5 text-emerald-950">
                    <span>BRN</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      filterIncludeBrn ? 'bg-emerald-300/80 text-emerald-950' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {toBn(docCounts.brn)}
                    </span>
                  </div>
                  <div className={`text-xs font-semibold mt-0.5 ${
                    filterIncludeBrn ? 'text-emerald-900' : 'text-slate-600'
                  }`}>
                    Birth Registration
                  </div>
                  <div className={`text-[10px] mt-0.5 ${
                    filterIncludeBrn ? 'text-emerald-800/80' : 'text-slate-400'
                  }`}>
                    (১৭ ডিজিট)
                  </div>
                </button>

                {/* NID Card (Coordinated with website brand) */}
                <button
                  type="button"
                  onClick={() => {
                    if (filterIncludeNid && !filterIncludeBrn) {
                      setFilterIncludeBrn(true);
                    } else if (filterIncludeNid && filterIncludeBrn) {
                      setFilterIncludeBrn(false);
                    } else {
                      setFilterIncludeNid(true);
                      setFilterIncludeBrn(false);
                    }
                    setCurrentPage(1);
                  }}
                  className={`flex-1 py-3 px-3 rounded-xl transition cursor-pointer text-center relative flex flex-col items-center justify-center ${
                    filterIncludeNid
                      ? 'bg-teal-100/90 text-teal-950 border border-teal-300 shadow-2xs ring-1 ring-teal-500/20'
                      : 'bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800'
                  }`}
                >
                  <div className="font-extrabold text-base sm:text-lg tracking-wide flex items-center justify-center space-x-1.5 text-slate-800">
                    <span className={filterIncludeNid ? 'text-teal-950' : 'text-slate-700'}>NID</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      filterIncludeNid ? 'bg-teal-200/90 text-teal-950' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {toBn(docCounts.nid)}
                    </span>
                  </div>
                  <div className={`text-xs font-semibold mt-0.5 ${
                    filterIncludeNid ? 'text-teal-900' : 'text-slate-600'
                  }`}>
                    National ID
                  </div>
                  <div className={`text-[10px] mt-0.5 ${
                    filterIncludeNid ? 'text-teal-800/80' : 'text-slate-400'
                  }`}>
                    (১০ বা ১৩ ডিজিট)
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
        columns={columns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        extraActions={
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-2.5 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <ArrowUpDown size={13} className="text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer pr-1"
                title="সাজানোর ক্রম"
              >
                <option value="id_asc">আইডি (ছোট-বড়)</option>
                <option value="id_desc">আইডি (বড়-ছোট)</option>
                <option value="name_asc">নাম (অ-হ)</option>
                <option value="batch_asc">ব্যাচ অনুসারে</option>
              </select>
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 h-9">
              <button
                onClick={() => setViewMode('table')}
                className={`h-7 px-2 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'table' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="টেবিল ভিউ"
              >
                <TableIcon size={14} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`h-7 px-2 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="কার্ড ভিউ"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        }
      />

      {/* ======================================================== */}
      {/* 3.5 BATCH TABS FILTER BAR (MATCHING USER SCREENSHOT 1)   */}
      {/* ======================================================== */}
      {availableBatchOptions.length > 0 && (
        <div className="bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200/90 shadow-2xs p-1.5 flex items-center overflow-x-auto no-scrollbar scroll-smooth gap-1 sm:gap-1.5">
          {/* 'All' Tab with total count */}
          <button
            type="button"
            onClick={() => {
              setFilterBatch('');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 shrink-0 transition cursor-pointer ${
              !filterBatch
                ? 'bg-white shadow-xs border border-slate-200/90 text-emerald-800 font-bold ring-2 ring-emerald-500/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>All</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition ${
              !filterBatch
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {toBn(batchTabsData.totalCount)}
            </span>
          </button>

          {/* Individual Batch Tabs with soft-colored pill badges */}
          {batchTabsData.items.map((batch) => {
            const isSelected = filterBatch === batch.id;
            const badgeColor = BATCH_BADGE_COLORS[batch.idx % BATCH_BADGE_COLORS.length];

            return (
              <button
                key={batch.id}
                type="button"
                onClick={() => {
                  setFilterBatch(isSelected ? '' : batch.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 shrink-0 transition cursor-pointer ${
                  isSelected
                    ? 'bg-white shadow-xs border border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title={batch.name}
              >
                <span className="truncate max-w-[170px] sm:max-w-[220px]">{batch.name}</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition ${
                  isSelected
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                    : badgeColor
                }`}>
                  {toBn(batch.count)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. BULK SELECTION ACTION BAR (WHEN ROWS ARE SELECTED)     */}
      {/* ======================================================== */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-900 text-white p-3.5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center space-x-3 text-xs">
            <span className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center font-bold">
              {toBn(selectedIds.size)}
            </span>
            <span>
              জন শিক্ষার্থী নির্বাচিত হয়েছে (মোট {toBn(filteredTrainees.length)} জনের মধ্যে)
            </span>
            {selectedIds.size < filteredTrainees.length && (
              <button
                onClick={handleSelectAllFiltered}
                className="underline text-emerald-200 hover:text-white font-bold"
              >
                ফিল্টারকৃত সকল {toBn(filteredTrainees.length)} জন নির্বাচন করুন
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 text-xs">
            {canExport && (
              <div className="flex items-center space-x-1.5">
                <button
                  disabled={isExportingFile || isPdfExporting}
                  onClick={() => handleExportData('excel')}
                  className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-xl font-bold transition flex items-center space-x-1 disabled:opacity-50"
                  title="নির্বাচিত শিক্ষার্থীদের এক্সেল (.xlsx) ফাইলে এক্সপোর্ট"
                >
                  <FileSpreadsheet size={13} />
                  <span>এক্সেল</span>
                </button>
                <button
                  disabled={isExportingFile || isPdfExporting}
                  onClick={() => handleExportData('csv')}
                  className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-xl font-bold transition flex items-center space-x-1 disabled:opacity-50"
                  title="নির্বাচিত শিক্ষার্থীদের সিএসভি (.csv) ফাইলে এক্সপোর্ট"
                >
                  <Download size={13} />
                  <span>সিএসভি</span>
                </button>
              </div>
            )}

            {canEdit && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handleBulkStatusUpdate('Completed')}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-xl font-bold transition"
                >
                  কোর্স সম্পন্ন
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate('Dropped Out')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold transition"
                >
                  ঝরে পড়া
                </button>
              </div>
            )}

            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1.5 text-emerald-200 hover:text-white font-semibold"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. TRAINEES DATA TABLE (DESKTOP / DEFAULT VIEW)          */}
      {/* ======================================================== */}
      {filteredTrainees.length === 0 ? (
        <div className="bg-white p-16 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl space-y-2">
          <Users size={40} className="mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-sm">কোনো প্রশিক্ষণার্থী পাওয়া যায়নি</p>
          <p className="text-slate-500 max-w-md mx-auto">
            {!filterIncludeNid && !filterIncludeBrn
              ? 'NID এবং জন্ম নিবন্ধন ফিল্টারের উভয়টিই বন্ধ রয়েছে। প্রশিক্ষণার্থীদের তালিকা দেখতে অনুগ্রহ করে NID বা BRN অন করুন।'
              : activeFiltersCount > 0 
                ? 'আপনার অনুসন্ধান বা ফিল্টারের সাথে মিলে এমন কোনো শিক্ষার্থী নেই।'
                : 'সিস্টেমে এখনো কোনো শিক্ষার্থী ভর্তি করা হয়নি।'}
          </p>
          {!filterIncludeNid && !filterIncludeBrn ? (
            <button
              type="button"
              onClick={() => {
                setFilterIncludeNid(true);
                setFilterIncludeBrn(true);
              }}
              className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer"
            >
              <span>NID ও BRN উভয় ফিল্টার চালু করুন (ডিফল্ট)</span>
            </button>
          ) : canCreate ? (
            <Link
              to="/trainees/add"
              className="mt-2 inline-flex items-center space-x-1 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              <Plus size={15} />
              <span>নতুন শিক্ষার্থী ভর্তি করুন</span>
            </Link>
          ) : null}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllOnPage}
                      className="text-slate-500 hover:text-slate-800"
                      title="এই পৃষ্ঠার সব নির্বাচন করুন"
                    >
                      {paginatedList.length > 0 && paginatedList.every(t => selectedIds.has(t.id)) ? (
                        <CheckSquare size={17} className="text-emerald-600" />
                      ) : (
                        <Square size={17} />
                      )}
                    </button>
                  </th>
                  {isColVisible('id_reg_status') && <th className="px-4 py-3.5">আইডি</th>}
                  {isColVisible('trainee_info') && <th className="px-4 py-3.5">প্রশিক্ষণার্থী</th>}
                  {isColVisible('batch_info') && <th className="px-4 py-3.5">ব্যাচ</th>}
                  {isColVisible('id_doc_info') && <th className="px-4 py-3.5 whitespace-nowrap min-w-[170px]">পরিচয়পত্র</th>}
                  {isColVisible('present_address') && <th className="px-4 py-3.5">বর্তমান ঠিকানা</th>}
                  {isColVisible('prev_education') && <th className="px-4 py-3.5">পূর্ববর্তী শিক্ষাগত তথ্য</th>}
                  {isColVisible('guardian_info') && <th className="px-4 py-3.5">অভিভাবক</th>}
                  {isColVisible('permanent_address') && <th className="px-4 py-3.5">স্থায়ী ঠিকানা</th>}
                  {isColVisible('attendance_marks') && <th className="px-4 py-3.5">মূল্যায়ন</th>}
                  {isColVisible('actions') && <th className="px-4 py-3.5 text-right">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {groupBy !== 'none' && groupedTrainees ? (
                  groupedTrainees.map(grp => {
                    const isCollapsed = collapsedGroups.has(grp.key);
                    const allGroupSelected = grp.items.length > 0 && grp.items.every(t => selectedIds.has(t.id));
                    return (
                      <React.Fragment key={grp.key}>
                        {/* Group Header Row */}
                        <tr className="bg-slate-100/80 hover:bg-slate-100 border-y border-slate-200 font-bold transition">
                          <td colSpan={1 + columns.filter(c => c.visible).length} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => toggleGroupCollapse(grp.key)}
                                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition cursor-pointer"
                                >
                                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <span className="text-xs sm:text-sm text-slate-800 font-bold">
                                  {grp.title}
                                </span>
                                {grp.subtitle && (
                                  <span className="text-xs font-normal text-slate-500 hidden sm:inline">
                                    • {grp.subtitle}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {toBn(grp.items.length)} জন
                                </span>
                              </div>

                              <div className="flex items-center space-x-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = new Set(selectedIds);
                                    if (allGroupSelected) {
                                      grp.items.forEach(t => next.delete(t.id));
                                    } else {
                                      grp.items.forEach(t => next.add(t.id));
                                    }
                                    setSelectedIds(next);
                                  }}
                                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                                >
                                  {allGroupSelected ? 'গ্রুপ আনসিলেক্ট' : 'গ্রুপের সব সিলেক্ট'}
                                </button>
                                <span className="text-[11px] text-slate-400">
                                  মোটের {toBn(Math.round((grp.items.length / (filteredTrainees.length || 1)) * 100))}%
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Group Rows */}
                        {!isCollapsed && grp.items.map(t => {
                          const isChecked = selectedIds.has(t.id);
                          return (
                            <tr 
                              key={t.id} 
                              className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-emerald-50/40' : ''}`}
                            >
                              <td className="px-4 py-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelectRow(t.id)}
                                  className="text-slate-400 hover:text-slate-700"
                                >
                                  {isChecked ? (
                                    <CheckSquare size={16} className="text-emerald-600" />
                                  ) : (
                                    <Square size={16} />
                                  )}
                                </button>
                              </td>

                              {/* 1. ID, Reg & Status */}
                              {isColVisible('id_reg_status') && (
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span className="font-mono font-bold text-slate-800 block text-xs">
                                    {t.traineeId || 'N/A'}
                                  </span>
                                  <span className="text-[11px] font-mono block mt-0.5">
                                    {t.registrationNumber ? (
                                      <span className="text-slate-500">রেজিঃ {t.registrationNumber}</span>
                                    ) : (
                                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                                        রেজিঃ অপেক্ষমাণ
                                      </span>
                                    )}
                                  </span>
                                  <div className="mt-1">
                                    {renderStatusBadge(t.status)}
                                  </div>
                                </td>
                              )}

                              {/* 2. Trainee Info (Mandatory, Links to Profile) */}
                              {isColVisible('trainee_info') && (
                                <td className="px-4 py-3.5">
                                  <Link
                                    to={`/trainees/${t.id}`}
                                    className="group block hover:text-emerald-700 transition"
                                    title="প্রশিক্ষণার্থীর প্রোফাইল দেখুন"
                                  >
                                    <div className="font-bold text-slate-800 text-xs leading-snug group-hover:text-emerald-700 flex items-center space-x-1">
                                      <span>{t.nameBn || t.nameEn}</span>
                                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-emerald-600 transition shrink-0" />
                                    </div>
                                  </Link>
                                  <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-600 mt-1">
                                    <Phone size={11} className="text-slate-400 shrink-0" />
                                    <span>{t.mobileNumber || '-'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    পিতা: {t.fatherNameBn || t.fatherNameEn || '-'}
                                  </div>
                                </td>
                              )}

                              {/* 3. Batch, Institute & Trade */}
                              {isColVisible('batch_info') && (
                                <td className="px-4 py-3.5">
                                  <div className="font-semibold text-slate-800 truncate max-w-[170px]" title={getInstituteName(t.instituteId)}>
                                    {getInstituteName(t.instituteId)}
                                  </div>
                                  <div className="text-[11px] text-emerald-700 font-medium truncate max-w-[170px] mt-0.5" title={getTradeName(t.tradeId)}>
                                    {getTradeName(t.tradeId)}
                                  </div>
                                  <div className="mt-1">
                                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200 font-semibold text-[11px] inline-block">
                                      {getBatchName(t.batchId)}
                                    </span>
                                  </div>
                                </td>
                              )}

                              {/* 4. ID Document & Age */}
                              {isColVisible('id_doc_info') && (
                                <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                                  <div className="font-mono font-bold text-slate-800 text-xs tracking-wider select-all mb-1">
                                    {t.nidOrBirthRegistration ? (
                                      t.nidOrBirthRegistration
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-normal italic font-sans">
                                        আইডি নেই
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-600">
                                    জন্ম: <span className="font-mono font-medium">{formatDobToDDMMYYYY(t.dateOfBirth)}</span>
                                  </div>
                                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                                    বয়স: <span className="font-bold text-slate-700">{calculateAgeAtBatchStart(t)}</span>
                                  </div>
                                </td>
                              )}

                              {/* 5. Present Address */}
                              {isColVisible('present_address') && (
                                <td className="px-4 py-3.5">
                                  <div className="text-xs text-slate-700 max-w-[180px] break-words line-clamp-2" title={t.presentAddress || t.address || '-'}>
                                    {t.presentAddress || t.address || '-'}
                                  </div>
                                </td>
                              )}

                              {/* 6. Previous Education & Dropout Info */}
                              {isColVisible('prev_education') && (
                                <td className="px-4 py-3.5 text-xs text-slate-600">
                                  <div>
                                    <span className="font-semibold text-slate-800">
                                      {t.lastClassCompleted || '-'}
                                    </span>
                                    {t.yearOfDropout && (
                                      <span className="text-[11px] text-amber-700 ml-1">
                                        (ঝরে পড়ার বছর: {toBn(t.yearOfDropout)})
                                      </span>
                                    )}
                                  </div>
                                  {t.previousSchoolName && (
                                    <div className="text-[11px] text-slate-500 truncate max-w-[160px] mt-0.5" title={t.previousSchoolName}>
                                      বিদ্যালয়: {t.previousSchoolName}
                                    </div>
                                  )}
                                  {t.reasonForDropout && (
                                    <div className="text-[10.5px] text-slate-400 italic truncate max-w-[160px] mt-0.5" title={t.reasonForDropout}>
                                      কারণ: {t.reasonForDropout}
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* 7. Guardian Info (Hideable, default hidden) */}
                              {isColVisible('guardian_info') && (
                                <td className="px-4 py-3.5 text-xs text-slate-600">
                                  <div className="font-medium text-slate-800">
                                    মাতা: {t.motherNameBn || t.motherNameEn || '-'}
                                  </div>
                                </td>
                              )}

                              {/* 8. Permanent Address (Hideable, default hidden) */}
                              {isColVisible('permanent_address') && (
                                <td className="px-4 py-3.5">
                                  <div className="text-xs text-slate-600 max-w-[180px] break-words line-clamp-2" title={t.permanentAddress || t.address || '-'}>
                                    {t.permanentAddress || t.address || '-'}
                                  </div>
                                </td>
                              )}

                              {/* 9. Attendance & Marks (Hideable, default hidden) */}
                              {isColVisible('attendance_marks') && (
                                <td className="px-4 py-3.5 text-xs text-slate-500">
                                  <span>-</span>
                                </td>
                              )}

                              {/* 10. Actions (Mandatory) */}
                              {isColVisible('actions') && (
                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-1">
                                    {canViewDetails && (
                                      <Link
                                        to={`/trainees/${t.id}`}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                        title="প্রোফাইল দেখুন"
                                      >
                                        <Eye size={16} />
                                      </Link>
                                    )}
                                    {canEdit && (
                                      <Link
                                        to={getEditUrl(t.id)}
                                        onClick={handleEditClick}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="তথ্য সম্পাদনা"
                                      >
                                        <Edit2 size={16} />
                                      </Link>
                                    )}
                                    {(t.status === 'Archived' || t.isArchived) && canEdit && (
                                      <button
                                        onClick={() => handleRestoreTrainee(t)}
                                        className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                        title="সক্রিয় তালিকায় পুনরুদ্ধার করুন (Restore)"
                                      >
                                        <ArchiveRestore size={16} />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => handleDeleteRequest(t)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title={!isDeletionAllowed ? 'আর্কাইভে পাঠান (ডিলিট বন্ধ থাকায়)' : 'মুছে ফেলুন বা সংরক্ষণাগারে পাঠান'}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  paginatedList.map((t) => {
                    const isChecked = selectedIds.has(t.id);
                    return (
                      <tr 
                        key={t.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-emerald-50/40' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectRow(t.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isChecked ? (
                              <CheckSquare size={16} className="text-emerald-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>

                        {/* 1. ID, Reg & Status */}
                        {isColVisible('id_reg_status') && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-800 block text-xs">
                              {t.traineeId || 'N/A'}
                            </span>
                            <span className="text-[11px] font-mono block mt-0.5">
                              {t.registrationNumber ? (
                                <span className="text-slate-500">রেজিঃ {t.registrationNumber}</span>
                              ) : (
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                                  রেজিঃ অপেক্ষমাণ
                                </span>
                              )}
                            </span>
                            <div className="mt-1">
                              {renderStatusBadge(t.status)}
                            </div>
                          </td>
                        )}

                        {/* 2. Trainee Info (Mandatory, Links to Profile) */}
                        {isColVisible('trainee_info') && (
                          <td className="px-4 py-3.5">
                            <Link
                              to={`/trainees/${t.id}`}
                              className="group block hover:text-emerald-700 transition"
                              title="প্রশিক্ষণার্থীর প্রোফাইল দেখুন"
                            >
                              <div className="font-bold text-slate-800 text-xs leading-snug group-hover:text-emerald-700 flex items-center space-x-1">
                                <span>{t.nameBn || t.nameEn}</span>
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-emerald-600 transition shrink-0" />
                              </div>
                            </Link>
                            <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-600 mt-1">
                              <Phone size={11} className="text-slate-400 shrink-0" />
                              <span>{t.mobileNumber || '-'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              পিতা: {t.fatherNameBn || t.fatherNameEn || '-'}
                            </div>
                          </td>
                        )}

                        {/* 3. Batch, Institute & Trade */}
                        {isColVisible('batch_info') && (
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-800 truncate max-w-[170px]" title={getInstituteName(t.instituteId)}>
                              {getInstituteName(t.instituteId)}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-medium truncate max-w-[170px] mt-0.5" title={getTradeName(t.tradeId)}>
                              {getTradeName(t.tradeId)}
                            </div>
                            <div className="mt-1">
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200 font-semibold text-[11px] inline-block">
                                {getBatchName(t.batchId)}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* 4. ID Document & Age */}
                        {isColVisible('id_doc_info') && (
                          <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-800 text-xs tracking-wider select-all mb-1">
                              {t.nidOrBirthRegistration ? (
                                t.nidOrBirthRegistration
                              ) : (
                                <span className="text-[10px] text-slate-400 font-normal italic font-sans">
                                  আইডি নেই
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              জন্ম: <span className="font-mono font-medium">{formatDobToDDMMYYYY(t.dateOfBirth)}</span>
                            </div>
                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              বয়স: <span className="font-bold text-slate-700">{calculateAgeAtBatchStart(t)}</span>
                            </div>
                          </td>
                        )}

                        {/* 5. Present Address */}
                        {isColVisible('present_address') && (
                          <td className="px-4 py-3.5">
                            <div className="text-xs text-slate-700 max-w-[180px] break-words line-clamp-2" title={t.presentAddress || t.address || '-'}>
                              {t.presentAddress || t.address || '-'}
                            </div>
                          </td>
                        )}

                        {/* 6. Previous Education & Dropout Info */}
                        {isColVisible('prev_education') && (
                          <td className="px-4 py-3.5 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold text-slate-800">
                                {t.lastClassCompleted || '-'}
                              </span>
                              {t.yearOfDropout && (
                                <span className="text-[11px] text-amber-700 ml-1">
                                  (ঝরে পড়ার বছর: {toBn(t.yearOfDropout)})
                                </span>
                              )}
                            </div>
                            {t.previousSchoolName && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[160px] mt-0.5" title={t.previousSchoolName}>
                                বিদ্যালয়: {t.previousSchoolName}
                              </div>
                            )}
                            {t.reasonForDropout && (
                              <div className="text-[10.5px] text-slate-400 italic truncate max-w-[160px] mt-0.5" title={t.reasonForDropout}>
                                কারণ: {t.reasonForDropout}
                              </div>
                            )}
                          </td>
                        )}

                        {/* 7. Guardian Info (Hideable, default hidden) */}
                        {isColVisible('guardian_info') && (
                          <td className="px-4 py-3.5 text-xs text-slate-600">
                            <div className="font-medium text-slate-800">
                              মাতা: {t.motherNameBn || t.motherNameEn || '-'}
                            </div>
                          </td>
                        )}

                        {/* 8. Permanent Address (Hideable, default hidden) */}
                        {isColVisible('permanent_address') && (
                          <td className="px-4 py-3.5">
                            <div className="text-xs text-slate-600 max-w-[180px] break-words line-clamp-2" title={t.permanentAddress || t.address || '-'}>
                              {t.permanentAddress || t.address || '-'}
                            </div>
                          </td>
                        )}

                        {/* 9. Attendance & Marks (Hideable, default hidden) */}
                        {isColVisible('attendance_marks') && (
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            <span>-</span>
                          </td>
                        )}

                        {/* 10. Actions (Mandatory) */}
                        {isColVisible('actions') && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1">
                              {canViewDetails && (
                                <Link
                                  to={`/trainees/${t.id}`}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                  title="প্রোফাইল দেখুন"
                                >
                                  <Eye size={16} />
                                </Link>
                              )}
                              {canEdit && (
                                <Link
                                  to={getEditUrl(t.id)}
                                  onClick={handleEditClick}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="তথ্য সম্পাদনা"
                                >
                                  <Edit2 size={16} />
                                </Link>
                              )}
                              {(t.status === 'Archived' || t.isArchived) && canEdit && (
                                <button
                                  onClick={() => handleRestoreTrainee(t)}
                                  className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                  title="সক্রিয় তালিকায় পুনরুদ্ধার করুন (Restore)"
                                >
                                  <ArchiveRestore size={16} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteRequest(t)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title={!isDeletionAllowed ? 'আর্কাইভে পাঠান (ডিলিট বন্ধ থাকায়)' : 'মুছে ফেলুন বা সংরক্ষণাগারে পাঠান'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* 5B. RESPONSIVE CARDS VIEW (FOR MOBILE & TABLET)          */
        /* ======================================================== */
        <div className="space-y-6">
          {groupBy !== 'none' && groupedTrainees ? (
            groupedTrainees.map(grp => {
              const isCollapsed = collapsedGroups.has(grp.key);
              return (
                <div key={grp.key} className="space-y-3">
                  <div className="bg-slate-100 p-3 rounded-2xl flex items-center justify-between border border-slate-200">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(grp.key)}
                      className="flex items-center space-x-2 text-slate-800 font-bold"
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <span className="text-sm">{grp.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {toBn(grp.items.length)} জন
                      </span>
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {grp.items.map(t => {
                        const isChecked = selectedIds.has(t.id);
                        return (
                          <div 
                            key={t.id}
                            className={`bg-white rounded-2xl border p-4.5 shadow-xs flex flex-col justify-between space-y-3 transition hover:shadow-md ${
                              isChecked ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200/90'
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSelectRow(t.id)}
                                    className="text-slate-400 hover:text-slate-700"
                                  >
                                    {isChecked ? (
                                      <CheckSquare size={16} className="text-emerald-600" />
                                    ) : (
                                      <Square size={16} />
                                    )}
                                  </button>
                                  {isColVisible('id_reg_status') && (
                                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                                      {t.traineeId || 'N/A'}
                                    </span>
                                  )}
                                </div>
                                {isColVisible('id_reg_status') && renderStatusBadge(t.status)}
                              </div>

                              {isColVisible('trainee_info') && (
                                <div>
                                  <Link
                                    to={`/trainees/${t.id}`}
                                    className="group block hover:text-emerald-700 transition"
                                    title="প্রশিক্ষণার্থীর প্রোফাইল দেখুন"
                                  >
                                    <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-emerald-700 flex items-center space-x-1">
                                      <span>{t.nameBn || t.nameEn}</span>
                                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-emerald-600 transition shrink-0" />
                                    </h3>
                                    {t.nameEn && t.nameBn && (
                                      <p className="text-[11px] text-slate-400 italic">{t.nameEn}</p>
                                    )}
                                  </Link>
                                  <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-600 mt-1">
                                    <Phone size={11} className="text-slate-400 shrink-0" />
                                    <span>{t.mobileNumber || '-'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    পিতা: {t.fatherNameBn || t.fatherNameEn || '-'}
                                  </div>
                                  {isColVisible('id_reg_status') && (
                                    <span className="text-[11px] text-slate-500 block mt-1">
                                      রেজিস্ট্রেশন:{' '}
                                      {t.registrationNumber ? (
                                        <strong className="font-mono text-slate-700">{t.registrationNumber}</strong>
                                      ) : (
                                        <span className="text-amber-700 font-normal italic text-[10px] bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                          অপেক্ষমাণ
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}

                              {isColVisible('batch_info') && (
                                <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <Layers size={13} className="text-purple-600 shrink-0" />
                                    <span className="truncate font-semibold text-purple-900">{getBatchName(t.batchId)}</span>
                                  </div>
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <Wrench size={13} className="text-emerald-600 shrink-0" />
                                    <span className="truncate">{getTradeName(t.tradeId)}</span>
                                  </div>
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <Building2 size={13} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{getInstituteName(t.instituteId)}</span>
                                  </div>
                                </div>
                              )}

                              {isColVisible('id_doc_info') && (
                                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 space-y-1">
                                  <div className="font-mono font-bold text-slate-800 text-xs tracking-wider select-all break-all">
                                    {t.nidOrBirthRegistration ? (
                                      t.nidOrBirthRegistration
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-normal italic font-sans">
                                        আইডি নেই
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                    <span>জন্ম: <strong className="font-mono text-slate-700">{formatDobToDDMMYYYY(t.dateOfBirth)}</strong></span>
                                    <span>বয়স: <strong className="text-slate-700">{calculateAgeAtBatchStart(t)}</strong></span>
                                  </div>
                                </div>
                              )}

                              {isColVisible('present_address') && (
                                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                                  <span className="text-[10px] text-slate-400 block">বর্তমান ঠিকানা:</span>
                                  <span className="text-slate-700 line-clamp-2">{t.presentAddress || t.address || '-'}</span>
                                </div>
                              )}

                              {isColVisible('prev_education') && (
                                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                                  <span className="text-[10px] text-slate-400 block">পূর্ববর্তী শিক্ষা:</span>
                                  <span className="font-medium text-slate-700">{t.lastClassCompleted || '-'}</span>
                                  {t.yearOfDropout && (
                                    <span className="text-[11px] text-amber-700 ml-1">
                                      (ঝরে পড়ার বছর: {toBn(t.yearOfDropout)})
                                    </span>
                                  )}
                                  {t.previousSchoolName && (
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{t.previousSchoolName}</div>
                                  )}
                                </div>
                              )}
                            </div>

                            {isColVisible('actions') && (
                              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                {canViewDetails && (
                                  <Link
                                    to={`/trainees/${t.id}`}
                                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1"
                                  >
                                    <Eye size={13} />
                                    <span>প্রোফাইল</span>
                                  </Link>
                                )}

                                <div className="flex items-center space-x-1">
                                  {canEdit && (
                                    <Link
                                      to={getEditUrl(t.id)}
                                      onClick={handleEditClick}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                      title="সম্পাদনা"
                                    >
                                      <Edit2 size={15} />
                                    </Link>
                                  )}
                                  {(t.status === 'Archived' || t.isArchived) && canEdit && (
                                    <button
                                      onClick={() => handleRestoreTrainee(t)}
                                      className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                      title="সক্রিয় তালিকায় ফিরিয়ে আনুন (Restore)"
                                    >
                                      <ArchiveRestore size={15} />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteRequest(t)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                      title={!isDeletionAllowed ? 'আর্কাইভে পাঠান (ডিলিট বন্ধ থাকায়)' : 'মুছুন বা সংরক্ষণাগারে পাঠান'}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedList.map(t => {
                const isChecked = selectedIds.has(t.id);
                return (
                  <div 
                    key={t.id}
                    className={`bg-white rounded-2xl border p-4.5 shadow-xs flex flex-col justify-between space-y-3 transition hover:shadow-md ${
                      isChecked ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200/90'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectRow(t.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isChecked ? (
                              <CheckSquare size={16} className="text-emerald-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                          {isColVisible('id_reg_status') && (
                            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                              {t.traineeId || 'N/A'}
                            </span>
                          )}
                        </div>
                        {isColVisible('id_reg_status') && renderStatusBadge(t.status)}
                      </div>

                      {isColVisible('trainee_info') && (
                        <div>
                          <Link
                            to={`/trainees/${t.id}`}
                            className="group block hover:text-emerald-700 transition"
                            title="প্রশিক্ষণার্থীর প্রোফাইল দেখুন"
                          >
                            <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-emerald-700 flex items-center space-x-1">
                              <span>{t.nameBn || t.nameEn}</span>
                              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-emerald-600 transition shrink-0" />
                            </h3>
                            {t.nameEn && t.nameBn && (
                              <p className="text-[11px] text-slate-400 italic">{t.nameEn}</p>
                            )}
                          </Link>
                          <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-600 mt-1">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{t.mobileNumber || '-'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            পিতা: {t.fatherNameBn || t.fatherNameEn || '-'}
                          </div>
                          {isColVisible('id_reg_status') && (
                            <span className="text-[11px] text-slate-500 block mt-1">
                              রেজিস্ট্রেশন:{' '}
                              {t.registrationNumber ? (
                                <strong className="font-mono text-slate-700">{t.registrationNumber}</strong>
                              ) : (
                                <span className="text-amber-700 font-normal italic text-[10px] bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                  অপেক্ষমাণ
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {isColVisible('batch_info') && (
                        <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                          <div className="flex items-center space-x-1.5 truncate">
                            <Layers size={13} className="text-purple-600 shrink-0" />
                            <span className="truncate font-semibold text-purple-900">{getBatchName(t.batchId)}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 truncate">
                            <Wrench size={13} className="text-emerald-600 shrink-0" />
                            <span className="truncate">{getTradeName(t.tradeId)}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 truncate">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{getInstituteName(t.instituteId)}</span>
                          </div>
                        </div>
                      )}

                      {isColVisible('id_doc_info') && (
                        <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 space-y-1">
                          <div className="font-mono font-bold text-slate-800 text-xs tracking-wider select-all break-all">
                            {t.nidOrBirthRegistration ? (
                              t.nidOrBirthRegistration
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal italic font-sans">
                                আইডি নেই
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between">
                            <span>জন্ম: <strong className="font-mono text-slate-700">{formatDobToDDMMYYYY(t.dateOfBirth)}</strong></span>
                            <span>বয়স: <strong className="text-slate-700">{calculateAgeAtBatchStart(t)}</strong></span>
                          </div>
                        </div>
                      )}

                      {isColVisible('present_address') && (
                        <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 block">বর্তমান ঠিকানা:</span>
                          <span className="text-slate-700 line-clamp-2">{t.presentAddress || t.address || '-'}</span>
                        </div>
                      )}

                      {isColVisible('prev_education') && (
                        <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 block">পূর্ববর্তী শিক্ষা:</span>
                          <span className="font-medium text-slate-700">{t.lastClassCompleted || '-'}</span>
                          {t.yearOfDropout && (
                            <span className="text-[11px] text-amber-700 ml-1">
                              (ঝরে পড়ার বছর: {toBn(t.yearOfDropout)})
                            </span>
                          )}
                          {t.previousSchoolName && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{t.previousSchoolName}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {isColVisible('actions') && (
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        {canViewDetails && (
                          <Link
                            to={`/trainees/${t.id}`}
                            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1"
                          >
                            <Eye size={13} />
                            <span>প্রোফাইল</span>
                          </Link>
                        )}

                        <div className="flex items-center space-x-1">
                          {canEdit && (
                            <Link
                              to={getEditUrl(t.id)}
                              onClick={handleEditClick}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="সম্পাদনা"
                            >
                              <Edit2 size={15} />
                            </Link>
                          )}
                          {(t.status === 'Archived' || t.isArchived) && canEdit && (
                            <button
                              onClick={() => handleRestoreTrainee(t)}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                              title="সক্রিয় তালিকায় ফিরিয়ে আনুন (Restore)"
                            >
                              <ArchiveRestore size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteRequest(t)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title={!isDeletionAllowed ? 'আর্কাইভে পাঠান (ডিলিট বন্ধ থাকায়)' : 'মুছুন বা সংরক্ষণাগারে পাঠান'}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pagination or Grouping summary */}
      {groupBy !== 'none' && groupedTrainees ? (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-600 font-medium">
            গ্রুপ অনুযায়ী মোটের <strong className="text-emerald-700">{toBn(filteredTrainees.length)} জন</strong> শিক্ষার্থী {toBn(groupedTrainees.length)}টি গ্রুপে প্রদর্শিত হচ্ছে
          </span>
          <button
            type="button"
            onClick={() => setGroupBy('none')}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
          >
            গ্রুপ ছাড়া সাধারণ ভিউতে ফিরুন (Show Flat Table)
          </button>
        </div>
      ) : (
        totalPages > 1 && (
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              মোট {toBn(filteredTrainees.length)} জন শিক্ষার্থীর মধ্যে {toBn((currentPage - 1) * ITEMS_PER_PAGE + 1)} থেকে {toBn(Math.min(currentPage * ITEMS_PER_PAGE, filteredTrainees.length))} প্রদর্শিত হচ্ছে
            </span>

            <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              <div className="flex items-center space-x-1 shrink-0 min-w-max">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="shrink-0 p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                  title="পূর্ববর্তী পৃষ্ঠা"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const p = idx + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`shrink-0 w-8 h-8 rounded-xl font-bold transition ${
                        currentPage === p
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {toBn(p)}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="shrink-0 p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                  title="পরবর্তী পৃষ্ঠা"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )
      )}


      {/* ======================================================== */}
      {/* 7. SAFE DELETION / STATUS TRANSITION MODAL               */}
      {/* ======================================================== */}
      {safeDeleteModalTrainee && (
        <div 
          className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-slate-900/60 backdrop-blur-xs z-50 overscroll-contain animate-fadeIn"
          onClick={() => setSafeDeleteModalTrainee(null)}
        >
          <div className="min-h-full w-full flex items-start sm:items-center justify-center p-3 sm:p-4 pt-6 sm:py-6 pb-16">
            <div 
              className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  শিক্ষার্থীর রেকর্ড স্থায়ীভাবে মুছে ফেলা নিষিদ্ধ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ঐতিহাসিক হাজিরা ও সরকারি পরীক্ষার ফলাফল সংরক্ষণ নীতি
                </p>
              </div>
              <button 
                onClick={() => setSafeDeleteModalTrainee(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-950">
              <p className="font-bold">
                "{safeDeleteModalTrainee.trainee.nameBn || safeDeleteModalTrainee.trainee.nameEn} ({safeDeleteModalTrainee.trainee.traineeId})" শিক্ষার্থীর সাথে নিম্নলিখিত তথ্য সংরক্ষিত রয়েছে:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>সংরক্ষিত ক্লাসের হাজিরা: <strong>{toBn(safeDeleteModalTrainee.attendanceCount)} টি</strong></li>
                <li>মূল্যায়ন ও পরীক্ষার নম্বর: <strong>{toBn(safeDeleteModalTrainee.marksCount)} টি</strong></li>
              </ul>
              <p className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/80">
                ⚠️ এই রেকর্ড মুছে ফেললে ব্যাচের সামগ্রিক উপস্থিতি খাতা ও মূল্যায়ন রেজিস্টারের অখণ্ডতা নষ্ট হবে।
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">মুছে ফেলার বিকল্প নির্বাচন করুন (Fallback Options):</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatusSafe('Archived')}
                  className="p-2.5 bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition flex items-center justify-center space-x-1.5"
                >
                  <Archive size={15} className="text-slate-600" />
                  <span>আর্কাইভ করুন (Archive)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatusSafe('Dropped Out')}
                  className="p-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl font-bold transition flex items-center justify-center space-x-1"
                >
                  <UserX size={15} />
                  <span>ঝরে পড়া (Dropout)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatusSafe('Completed')}
                  className="p-2.5 bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-900 rounded-xl font-bold transition flex items-center justify-center space-x-1"
                >
                  <Award size={15} />
                  <span>কোর্স সম্পন্ন</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSafeDeleteModalTrainee(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                ফিরে যান
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* PDF Export Progress Loading Overlay */}
      {isPdfExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-inner">
              <RefreshCw size={28} className="animate-spin text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">পিডিএফ ফাইল প্রস্তুত হচ্ছে...</h3>
              <p className="text-xs text-slate-600 mt-1 font-medium min-h-[18px]">
                {pdfExportProgress || 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন'}
              </p>
            </div>
            
            {/* Functional Animated Progress Bar */}
            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 px-0.5">
                <span className="text-[11px] text-slate-500 font-medium">
                  {pdfCurrentPage > 0 ? `পৃষ্ঠা: ${toBn(pdfCurrentPage)} / ${toBn(pdfTotalPages)}` : 'প্রসেসিং...'}
                </span>
                <span className="text-emerald-700 font-bold font-mono text-xs">
                  {toBn(pdfExportPercent)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/80 p-0.5 shadow-inner">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${Math.max(5, Math.min(100, pdfExportPercent))}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse"></div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">টেবিলের সকল কলাম ও মার্জিন নির্ভুলভাবে প্রস্তুত হচ্ছে</p>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <TraineeBulkImportModal
        isOpen={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSuccess={(count) => {
          setActionSuccessMessage(`এক্সেল/সিএসভি থেকে ${toBn(count)} জন শিক্ষার্থীর তথ্য সফলভাবে ডাটাবেজে সংরক্ষণ করা হয়েছে!`);
          setTimeout(() => setActionSuccessMessage(''), 4500);
          fetchData();
        }}
        batches={batches}
        institutes={institutes}
        trades={trades}
        existingTrainees={trainees}
      />
    </div>
  );
};

export default TraineeList;
