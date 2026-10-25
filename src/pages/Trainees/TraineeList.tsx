import React, { useState, useEffect, useMemo } from 'react';
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
  CheckSquare,
  Square,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  UserX,
  Award,
  ArrowUpDown
} from 'lucide-react';
import { Trainee, Institute, Trade, Batch, TraineeStatus } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import { Link } from 'react-router-dom';
import { dataService } from '../../lib/dataService';
import { toBn, safeFormatDate } from '../../lib/dateUtils';

const ITEMS_PER_PAGE = 10;

/**
 * Sanitize cell to prevent CSV formula injection (DDE / Excel formula injection)
 */
function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // If string starts with =, +, -, @, tab, or carriage return, neutralize with single quote prefix
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

const TraineeList: React.FC = () => {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstitute, setFilterInstitute] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState<'id_asc' | 'id_desc' | 'name_asc' | 'batch_asc'>('id_asc');

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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();

  const canCreate = hasPermission('create_trainee');
  const canEdit = hasPermission('edit_trainee');
  const canDelete = hasPermission('delete_trainee');
  const canExport = hasPermission('export_trainees');
  const canSeed = hasPermission('seed_demo_trainees');
  const canViewDetails = hasPermission('view_trainee_details');

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
    const total = trainees.length;
    const active = trainees.filter(t => !t.status || t.status === 'Active').length;
    const completed = trainees.filter(t => t.status === 'Completed').length;
    const dropped = trainees.filter(t => t.status === 'Dropped Out').length;
    const female = trainees.filter(t => t.gender === 'Female').length;
    const male = trainees.filter(t => t.gender === 'Male').length;
    return { total, active, completed, dropped, female, male };
  }, [trainees]);

  // Helper names
  const getInstituteName = (id?: string) => institutes.find(i => i.id === id)?.name || id || '-';
  const getTradeName = (id?: string) => trades.find(t => t.id === id)?.name || id || '-';
  const getBatchName = (id?: string) => batches.find(b => b.id === id)?.name || id || '-';

  // Dynamic Batch Filter Options: based on selected institute and trade
  const availableBatchOptions = useMemo(() => {
    return batches.filter(b => {
      if (filterInstitute && b.instituteId !== filterInstitute) return false;
      if (filterTrade && b.tradeId !== filterTrade) return false;
      return true;
    });
  }, [batches, filterInstitute, filterTrade]);

  // Filter & Search Logic
  const filteredTrainees = useMemo(() => {
    return trainees
      .filter((t) => {
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

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'id_asc') return (a.traineeId || a.id).localeCompare(b.traineeId || b.id);
        if (sortBy === 'id_desc') return (b.traineeId || b.id).localeCompare(a.traineeId || a.id);
        if (sortBy === 'name_asc') return (a.nameBn || a.nameEn || '').localeCompare(b.nameBn || b.nameEn || '');
        if (sortBy === 'batch_asc') return (getBatchName(a.batchId)).localeCompare(getBatchName(b.batchId));
        return 0;
      });
  }, [trainees, searchTerm, filterInstitute, filterTrade, filterBatch, filterGender, filterStatus, sortBy, batches]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterInstitute) count++;
    if (filterTrade) count++;
    if (filterBatch) count++;
    if (filterGender) count++;
    if (filterStatus) count++;
    if (searchTerm) count++;
    return count;
  }, [filterInstitute, filterTrade, filterBatch, filterGender, filterStatus, searchTerm]);

  const handleClearFilters = () => {
    setSearchTerm('');
    if (userProfile?.role !== 'Trainer') {
      setFilterInstitute('');
      setFilterBatch('');
    }
    setFilterTrade('');
    setFilterGender('');
    setFilterStatus('');
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

  // Safe Delete Flow
  const handleDeleteRequest = async (trainee: Trainee) => {
    if (!canDelete) return;

    if (!isDeletionAllowed) {
      alert("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
      return;
    }

    try {
      const usage = await dataService.checkTraineeUsage(trainee.id);
      if (usage.isReferenced) {
        // Referenced! Block hard deletion and open status transition modal
        setSafeDeleteModalTrainee({
          trainee,
          attendanceCount: usage.attendanceCount,
          marksCount: usage.marksCount
        });

        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রশিক্ষণার্থী মোছার চেষ্টা ব্যর্থ (রেকর্ড বিদ্যমান): ${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})`,
          'Trainees',
          trainee.id
        );
      } else {
        // Unreferenced: Safe to hard delete with confirmation
        const confirmed = window.confirm(
          `আপনি কি নিশ্চিতভাবে "${trainee.nameBn || trainee.nameEn} (${trainee.traineeId})" এর রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?`
        );
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

  // Change status of a referenced trainee instead of deleting
  const handleUpdateStatusSafe = async (status: TraineeStatus) => {
    if (!safeDeleteModalTrainee || !canEdit) return;
    const { trainee } = safeDeleteModalTrainee;

    try {
      const updated: Trainee = {
        ...trainee,
        status,
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

      setActionSuccessMessage(`"${trainee.nameBn || trainee.nameEn}" শিক্ষার্থীর স্ট্যাটাস '${status === 'Dropped Out' ? 'ঝরে পড়া' : 'সম্পন্ন'}' হিসেবে আপডেট করা হয়েছে।`);
      setTimeout(() => setActionSuccessMessage(''), 3500);

      setSafeDeleteModalTrainee(null);
      fetchData();
    } catch (err) {
      console.warn("Could not update trainee status:", err);
    }
  };

  // Bulk Status Update for selected trainees
  const handleBulkStatusUpdate = async (newStatus: TraineeStatus) => {
    if (selectedIds.size === 0 || !canEdit) return;

    if (!window.confirm(`আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedIds.size} জন শিক্ষার্থীর স্ট্যাটাস '${newStatus}' করতে চান?`)) {
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

  // Enhanced CSV Export: UTF-8 BOM, sanitized fields, respects selection or active filters
  const handleExportCSV = () => {
    if (!canExport) {
      alert("আপনার সিএসভি এক্সপোর্ট করার অনুমতি নেই।");
      return;
    }

    const exportList = selectedIds.size > 0 
      ? trainees.filter(t => selectedIds.has(t.id))
      : filteredTrainees;

    if (exportList.length === 0) {
      alert("এক্সপোর্ট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।");
      return;
    }

    const headers = [
      'প্রশিক্ষণার্থী আইডি (Trainee ID)',
      'রেজিস্ট্রেশন নম্বর (Reg No)',
      'পূর্ণ নাম (বাংলা)',
      'পূর্ণ নাম (ইংরেজি)',
      'পিতার নাম (বাংলা)',
      'মাতার নাম (বাংলা)',
      'জন্ম তারিখ',
      'লিঙ্গ',
      'জাতীয় পরিচয়পত্র / জন্মনিবন্ধন',
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

      return [
        sanitizeCsvCell(t.traineeId || ''),
        sanitizeCsvCell(t.registrationNumber || ''),
        sanitizeCsvCell(t.nameBn || ''),
        sanitizeCsvCell(t.nameEn || ''),
        sanitizeCsvCell(t.fatherNameBn || t.fatherNameEn || ''),
        sanitizeCsvCell(t.motherNameBn || t.motherNameEn || ''),
        sanitizeCsvCell(t.dateOfBirth || ''),
        sanitizeCsvCell(t.gender || 'Male'),
        sanitizeCsvCell(t.nidOrBirthRegistration || ''),
        sanitizeCsvCell(t.mobileNumber || ''),
        sanitizeCsvCell(inst),
        sanitizeCsvCell(trd),
        sanitizeCsvCell(btc),
        sanitizeCsvCell(pres),
        sanitizeCsvCell(perm),
        sanitizeCsvCell(t.lastClassCompleted || ''),
        sanitizeCsvCell(t.status || 'Active')
      ];
    });

    // UTF-8 BOM '\uFEFF' ensures Bengali renders cleanly in Microsoft Excel / LibreOffice
    const csvString = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `BNFE_Trainee_List_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Audit log
    logActivity(
      userProfile?.id || '',
      userProfile?.name || 'User',
      `প্রশিক্ষণার্থী তালিকা সিএসভি এক্সপোর্ট সম্পন্ন (${exportList.length} জন)`,
      'Trainees',
      'export_csv'
    );
  };

  const renderStatusBadge = (status?: TraineeStatus) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">সক্রিয়</span>;
      case 'Completed':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">কোর্স সম্পন্ন</span>;
      case 'Dropped Out':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">ঝরে পড়া</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">সক্রিয়</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-700">প্রশিক্ষণার্থী তালিকা লোড হচ্ছে...</p>
        <span className="text-xs text-slate-400 mt-1">BNFE শিক্ষার্থী তথ্য সমন্বয় করা হচ্ছে</span>
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



          {canExport && (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-2xs transition"
              title="বাংলা ফন্টসহ সিএসভি ফাইলে এক্সপোর্ট করুন"
            >
              <Download size={15} className="text-emerald-700" />
              <span>এক্সপোর্ট (CSV)</span>
              {selectedIds.size > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {toBn(selectedIds.size)}
                </span>
              )}
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
      {/* 2. SUMMARY KPI METRIC CARDS                              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">মোট শিক্ষার্থী</span>
            <h4 className="text-2xl font-black text-slate-800">{toBn(stats.total)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">সক্রিয়</span>
            <h4 className="text-2xl font-black text-emerald-700">{toBn(stats.active)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">সম্পন্ন</span>
            <h4 className="text-2xl font-black text-blue-700">{toBn(stats.completed)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">ঝরে পড়া</span>
            <h4 className="text-2xl font-black text-amber-700">{toBn(stats.dropped)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">নারী শিক্ষার্থী</span>
            <h4 className="text-2xl font-black text-pink-700">{toBn(stats.female)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">পুরুষ শিক্ষার্থী</span>
            <h4 className="text-2xl font-black text-indigo-700">{toBn(stats.male)}</h4>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. SEARCH, ADVANCED FILTERS & VIEW MODE TOOLBAR          */}
      {/* ======================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Search & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="শিক্ষার্থীর নাম (বাংলা/ইংরেজি), রেজিস্ট্রেশন নম্বর, আইডি বা মোবাইল লিখে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Sort Selector */}
            <div className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <ArrowUpDown size={14} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="id_asc">আইডি (ছোট থেকে বড়)</option>
                <option value="id_desc">আইডি (বড় থেকে ছোট)</option>
                <option value="name_asc">নাম (অ-হ)</option>
                <option value="batch_asc">ব্যাচ অনুসারে</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'table' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="টেবিল ভিউ"
              >
                <TableIcon size={16} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="কার্ড ভিউ"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Institute Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">প্রতিষ্ঠান:</label>
            <select
              value={filterInstitute}
              onChange={(e) => { 
                setFilterInstitute(e.target.value); 
                setFilterBatch(''); 
                setCurrentPage(1); 
              }}
              disabled={userProfile?.role === 'Trainer' && !!userProfile.instituteId}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            >
              <option value="">সকল প্রতিষ্ঠান</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {/* Trade Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">বৃত্তিমূলক ট্রেড:</label>
            <select
              value={filterTrade}
              onChange={(e) => { 
                setFilterTrade(e.target.value); 
                setFilterBatch(''); 
                setCurrentPage(1); 
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল ট্রেড</option>
              {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Batch Filter (Filtered by selected institute and trade) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">প্রশিক্ষণ ব্যাচ:</label>
            <select
              value={filterBatch}
              onChange={(e) => { setFilterBatch(e.target.value); setCurrentPage(1); }}
              disabled={userProfile?.role === 'Trainer' && !!userProfile.batchId}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            >
              <option value="">সকল ব্যাচ ({toBn(availableBatchOptions.length)}টি)</option>
              {availableBatchOptions.map(b => <option key={b.id} value={b.id}>{b.name} ({b.batchCode || b.id})</option>)}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">লিঙ্গ:</label>
            <select
              value={filterGender}
              onChange={(e) => { setFilterGender(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল লিঙ্গ</option>
              <option value="Male">পুরুষ (Male)</option>
              <option value="Female">নারী (Female)</option>
              <option value="Other">অন্যান্য</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">স্ট্যাটাস:</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল অবস্থা</option>
              <option value="Active">সক্রিয় (Active)</option>
              <option value="Completed">সম্পন্ন (Completed)</option>
              <option value="Dropped Out">ঝরে পড়া (Dropped Out)</option>
            </select>
          </div>
        </div>

        {/* Active Filters Bar and Clear All */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-600 font-medium">
              সক্রিয় ফিল্টার প্রয়োগকৃত ({toBn(activeFiltersCount)}টি) • প্রাপ্ত ফলাফল: <strong className="text-emerald-700">{toBn(filteredTrainees.length)} জন</strong>
            </span>
            <button
              onClick={handleClearFilters}
              className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline"
            >
              সকল ফিল্টার রিসেট করুন
            </button>
          </div>
        )}
      </div>

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
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-xl font-bold transition flex items-center space-x-1"
              >
                <Download size={14} />
                <span>নির্বাচিত এক্সপোর্ট</span>
              </button>
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
          <p className="text-slate-500">
            {activeFiltersCount > 0 
              ? 'আপনার অনুসন্ধান বা ফিল্টারের সাথে মিলে এমন কোনো শিক্ষার্থী নেই।'
              : 'সিস্টেমে এখনো কোনো শিক্ষার্থী ভর্তি করা হয়নি।'}
          </p>
          {canCreate && (
            <Link
              to="/trainees/add"
              className="mt-2 inline-flex items-center space-x-1 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              <Plus size={15} />
              <span>নতুন শিক্ষার্থী ভর্তি করুন</span>
            </Link>
          )}
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
                      {paginatedList.every(t => selectedIds.has(t.id)) ? (
                        <CheckSquare size={17} className="text-emerald-600" />
                      ) : (
                        <Square size={17} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">আইডি ও রেজিঃ</th>
                  <th className="px-4 py-3.5">শিক্ষার্থীর নাম</th>
                  <th className="px-4 py-3.5">প্রতিষ্ঠান ও ট্রেড</th>
                  <th className="px-4 py-3.5">ব্যাচ</th>
                  <th className="px-4 py-3.5">যোগাযোগ</th>
                  <th className="px-4 py-3.5 text-center">স্ট্যাটাস</th>
                  <th className="px-4 py-3.5 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {paginatedList.map((t) => {
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

                      {/* ID and Reg */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 block text-xs">
                          {t.traineeId || 'N/A'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          রেজিঃ {t.registrationNumber}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800 text-xs leading-snug">
                          {t.nameBn || t.nameEn}
                        </div>
                        {t.nameEn && t.nameBn && (
                          <div className="text-[11px] text-slate-400 italic">
                            {t.nameEn}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          পিতা: {t.fatherNameBn || t.fatherNameEn || '-'}
                        </span>
                      </td>

                      {/* Institute & Trade */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 truncate max-w-[160px]">
                          {getInstituteName(t.instituteId)}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium truncate max-w-[160px]">
                          {getTradeName(t.tradeId)}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200 font-semibold text-[11px]">
                          {getBatchName(t.batchId)}
                        </span>
                      </td>

                      {/* Contact / Gender */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        <div>{t.mobileNumber || '-'}</div>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {t.gender === 'Female' ? 'নারী' : t.gender === 'Male' ? 'পুরুষ' : 'অন্যান্য'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(t.status)}
                      </td>

                      {/* Actions */}
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
                              to={`/trainees/edit/${t.id}`}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="তথ্য সম্পাদনা"
                            >
                              <Edit2 size={16} />
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteRequest(t)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="মুছে ফেলুন বা স্ট্যাটাস পরিবর্তন করুন"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* 5B. RESPONSIVE CARDS VIEW (FOR MOBILE & TABLET)          */
        /* ======================================================== */
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
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                        {t.traineeId || 'N/A'}
                      </span>
                    </div>
                    {renderStatusBadge(t.status)}
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-snug">
                      {t.nameBn || t.nameEn}
                    </h3>
                    {t.nameEn && t.nameBn && (
                      <p className="text-[11px] text-slate-400 italic">{t.nameEn}</p>
                    )}
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      রেজিস্ট্রেশন: <strong>{t.registrationNumber}</strong>
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5 truncate">
                      <Layers size={13} className="text-purple-600 shrink-0" />
                      <span className="truncate">{getBatchName(t.batchId)}</span>
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

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center space-x-1">
                      <Phone size={12} className="text-slate-400" />
                      <span className="font-mono">{t.mobileNumber || 'মোবাইল নেই'}</span>
                    </span>
                    <span>{t.gender === 'Female' ? 'নারী' : 'পুরুষ'}</span>
                  </div>
                </div>

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
                        to={`/trainees/edit/${t.id}`}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="সম্পাদনা"
                      >
                        <Edit2 size={15} />
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteRequest(t)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="মুছুন"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. PAGINATION CONTROLS                                    */}
      {/* ======================================================== */}
      {totalPages > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            মোট {toBn(filteredTrainees.length)} জন শিক্ষার্থীর মধ্যে {toBn((currentPage - 1) * ITEMS_PER_PAGE + 1)} থেকে {toBn(Math.min(currentPage * ITEMS_PER_PAGE, filteredTrainees.length))} প্রদর্শিত হচ্ছে
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
              title="পূর্ববর্তী পৃষ্ঠা"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-8 h-8 rounded-xl font-bold transition ${
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
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
              title="পরবর্তী পৃষ্ঠা"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. SAFE DELETION / STATUS TRANSITION MODAL               */}
      {/* ======================================================== */}
      {safeDeleteModalTrainee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
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
              <span className="font-bold text-slate-800 block">নিরাপদ স্ট্যাটাস পরিবর্তন নির্বাচন করুন:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatusSafe('Dropped Out')}
                  className="p-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl font-bold transition flex items-center justify-center space-x-1"
                >
                  <UserX size={15} />
                  <span>ঝরে পড়া (Dropped Out)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatusSafe('Completed')}
                  className="p-2.5 bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-900 rounded-xl font-bold transition flex items-center justify-center space-x-1"
                >
                  <Award size={15} />
                  <span>কোর্স সম্পন্ন (Completed)</span>
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
      )}
    </div>
  );
};

export default TraineeList;
