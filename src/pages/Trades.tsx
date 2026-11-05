import React, { useState, useEffect, useMemo } from 'react';
import { logActivity } from '../lib/firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Wrench, 
  Clock, 
  X, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Info, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Users, 
  FileText,
  AlertCircle,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { Trade, Batch, Trainee, Exam } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { dataService } from '../lib/dataService';
import { safeFormatDate, toBn } from '../lib/dateUtils';

const DURATION_PRESETS = [
  '৬ মাস (৩৬০ ঘণ্টা)',
  '৩ মাস (১৮০ ঘণ্টা)',
  '৪ মাস (২৪০ ঘণ্টা)',
  '১ বছর (৭২০ ঘণ্টা)',
  'কাস্টম (অন্যান্য)'
];

const ITEMS_PER_PAGE = 6;

const Trades: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  
  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [safeDeleteModalTrade, setSafeDeleteModalTrade] = useState<{
    trade: Trade;
    batchCount: number;
    traineeCount: number;
    examCount: number;
  } | null>(null);

  // Form State & Errors
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    description: '',
    duration: '৬ মাস (৩৬০ ঘণ্টা)',
    customDuration: '',
    status: 'Active' as 'Active' | 'Inactive' | 'Archived',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Search, Filter, Sort, Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive' | 'duplicates'>('all');
  const [sortBy, setSortBy] = useState<'code_asc' | 'code_desc' | 'name_asc' | 'created_desc'>('code_asc');
  const [currentPage, setCurrentPage] = useState(1);

  const { userProfile } = useAuth();
  const { hasPermission, isCourseDirector } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();
  const { confirm, showAlert } = useConfirm();

  const isDirector = isCourseDirector || userProfile?.role === 'Course Director';
  const canCreate = hasPermission('create_trade') || isDirector;
  const canEdit = hasPermission('edit_trade') || isDirector;
  const canDelete = hasPermission('delete_trade') || isDirector;

  useEffect(() => {
    fetchTradesData();
  }, []);

  const fetchTradesData = async () => {
    setLoading(true);
    try {
      const [tradesList, batchesList, traineesList, examsList] = await Promise.all([
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<Exam>('exams')
      ]);

      setTrades(tradesList);
      setBatches(batchesList);
      setTrainees(traineesList);
      setExams(examsList);
    } catch (error) {
      console.warn("Notice fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaultTrades = async () => {
    try {
      setLoading(true);
      await dataService.seedDefaultTrades();
      await fetchTradesData();
      setActionSuccessMessage('ডিফল্ট ট্রেড তালিকা সফলভাবে লোড করা হয়েছে।');
      setTimeout(() => setActionSuccessMessage(''), 3000);
    } catch (e: any) {
      await showAlert({
        title: 'ত্রুটি',
        message: "ডিফল্ট ট্রেড লোড করতে সমস্যা হয়েছে: " + e.message,
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTradesData();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Safe Trade Code Generator: scans all trades, extracts max digits, generates TRD-0X without collisions
  const generateSafeNextTradeCode = (currentList: Trade[]): string => {
    const existingCodes = currentList.map(t => t.code || '');
    const numbers = existingCodes
      .map(c => {
        const match = c.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n) && n > 0);

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    return `TRD-${String(nextNum).padStart(2, '0')}`;
  };

  // Identify duplicate trade codes in the database (e.g. TRD-01 appearing multiple times)
  const duplicateCodesMap = useMemo(() => {
    const codeCounts: Record<string, number> = {};
    trades.forEach(t => {
      const clean = (t.code || '').trim().toUpperCase();
      if (clean) {
        codeCounts[clean] = (codeCounts[clean] || 0) + 1;
      }
    });

    const duplicates = new Set<string>();
    Object.entries(codeCounts).forEach(([code, count]) => {
      if (count > 1) duplicates.add(code);
    });
    return duplicates;
  }, [trades]);

  const duplicateTradesCount = useMemo(() => {
    return trades.filter(t => duplicateCodesMap.has((t.code || '').trim().toUpperCase())).length;
  }, [trades, duplicateCodesMap]);

  // Trade relationship usage map (batch count, trainee count, exam count per trade ID)
  const tradeUsageMap = useMemo(() => {
    const map: Record<string, { batchCount: number; traineeCount: number; examCount: number }> = {};
    trades.forEach(t => {
      const bCount = batches.filter(b => b.tradeId === t.id).length;
      const tCount = trainees.filter(tr => tr.tradeId === t.id).length;
      const eCount = exams.filter(ex => ex.tradeId === t.id).length;
      map[t.id] = { batchCount: bCount, traineeCount: tCount, examCount: eCount };
    });
    return map;
  }, [trades, batches, trainees, exams]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = trades.length;
    const active = trades.filter(t => t.status === 'Active').length;
    const inactive = trades.filter(t => t.status === 'Inactive').length;
    const totalBatchesWithTrade = batches.filter(b => b.tradeId).length;
    const totalTraineesWithTrade = trainees.filter(t => t.tradeId).length;
    return { total, active, inactive, totalBatchesWithTrade, totalTraineesWithTrade };
  }, [trades, batches, trainees]);

  // Open Add/Edit Modal
  const handleOpenModal = (trade?: Trade) => {
    setFormErrors({});
    if (trade) {
      setEditingTrade(trade);
      const isPreset = DURATION_PRESETS.includes(trade.duration);
      setFormData({
        name: trade.name,
        nameEn: trade.nameEn || '',
        code: trade.code,
        description: trade.description || '',
        duration: isPreset ? trade.duration : 'কাস্টম (অন্যান্য)',
        customDuration: isPreset ? '' : trade.duration,
        status: trade.status,
      });
    } else {
      setEditingTrade(null);
      const nextCode = generateSafeNextTradeCode(trades);
      setFormData({
        name: '',
        nameEn: '',
        code: nextCode,
        description: '',
        duration: '৬ মাস (৩৬০ ঘণ্টা)',
        customDuration: '',
        status: 'Active',
      });
    }
    setIsModalOpen(true);
  };

  // Form Validation
  const validateForm = async (): Promise<boolean> => {
    const errors: Record<string, string> = {};

    // 1. Name validation
    if (!formData.name.trim()) {
      errors.name = 'বাংলায় ট্রেডের নাম প্রদান করা আবশ্যক।';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'ট্রেডের নাম অন্তত ৩ অক্ষরের হতে হবে।';
    }

    // 2. Code validation
    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      errors.code = 'ট্রেড কোড প্রদান করা আবশ্যক।';
    } else if (!/^[A-Z0-9\-_]{3,15}$/.test(cleanCode)) {
      errors.code = 'ট্রেড কোড ৩-১৫ অক্ষরের ইংরেজি বর্ণ, সংখ্যা বা ড্যাশ হতে হবে (যেমন: TRD-01)।';
    } else {
      // Uniqueness check (excluding current trade if editing)
      const isDuplicate = trades.some(
        t => t.id !== editingTrade?.id && (t.code || '').trim().toUpperCase() === cleanCode
      );
      if (isDuplicate) {
        errors.code = `এই ট্রেড কোডটি ('${cleanCode}') ইতিমধ্যে অন্য একটি ট্রেডে ব্যবহৃত হয়েছে। ইউনিক কোড ব্যবহার করুন।`;
      }
    }

    // 3. Duration validation
    const finalDuration = formData.duration === 'কাস্টম (অন্যান্য)' ? formData.customDuration.trim() : formData.duration;
    if (!finalDuration) {
      errors.duration = 'কোর্সের মেয়াদ ও ঘণ্টার বিবরণ প্রদান করুন।';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submit (Save / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const isValid = await validateForm();
    if (!isValid) return;

    setSubmitting(true);
    try {
      const cleanCode = formData.code.trim().toUpperCase();
      const finalDuration = formData.duration === 'কাস্টম (অন্যান্য)' ? formData.customDuration.trim() : formData.duration;
      
      const id = editingTrade ? editingTrade.id : `TRD-${cleanCode.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

      const savedTrade: Trade = {
        id,
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        code: cleanCode,
        description: formData.description.trim(),
        duration: finalDuration,
        status: formData.status,
        createdAt: editingTrade?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await dataService.saveItem('trades', savedTrade);

      // Log activity
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingTrade 
          ? `ট্রেড তথ্য আপডেট: ${savedTrade.name} (${savedTrade.code})` 
          : `নতুন ট্রেড তৈরি: ${savedTrade.name} (${savedTrade.code})`,
        'Trades',
        id
      );

      setActionSuccessMessage(editingTrade ? 'ট্রেডের তথ্য সফলভাবে আপডেট করা হয়েছে।' : 'নতুন ট্রেড সফলভাবে যুক্ত করা হয়েছে।');
      setTimeout(() => setActionSuccessMessage(''), 3000);

      setIsModalOpen(false);
      await fetchTradesData();
    } catch (error) {
      console.warn("Notice saving trade:", error);
      await showAlert({
        title: 'সংরক্ষণ ব্যর্থ',
        message: "ট্রেড সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।",
        variant: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Request Flow: Checks references and opens safe deactivation if referenced
  const handleDeleteRequest = async (trade: Trade) => {
    if (!canDelete) return;

    // Fallback to archive when deleting is denied
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'ট্রেড সংরক্ষণাগারে স্থানান্তর (Fallback to Archive)',
        message: `সিস্টেম সেটিংস অনুযায়ী ট্রেড স্থায়ীভাবে মুছে ফেলা বন্ধ (Denied) রয়েছে। আপনি কি "${trade.name} (${trade.code})" ট্রেডটি মুছে ফেলার পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ সংরক্ষণাগারে স্থানান্তর করলে সংশ্লিষ্ট ব্যাচ ক্ষতিগ্রস্ত হবে না এবং ট্রেডটি সক্রিয় তালিকা থেকে সংরক্ষণাগারে নিরাপদে রাখা হবে।',
        confirmText: 'হ্যাঁ, ট্রেড আর্কাইভ করুন (Archive)',
        cancelText: 'বাতিল',
        variant: 'warning'
      });

      if (confirmed) {
        await dataService.archiveRecord('trades', trade.id, 'সিস্টেম ডিলিট বন্ধ থাকায় ব্যবহারকারীর নির্দেশে সংরক্ষণাগারে স্থানান্তর');
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ট্রেড সংরক্ষণাগারে স্থানান্তরিত (ডিলিট বন্ধ থাকায় ফলব্যাক): ${trade.name} (${trade.code})`,
          'Trades',
          trade.id
        );
        setActionSuccessMessage(`"${trade.name}" ট্রেডটি সফলভাবে সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        await fetchTradesData();
      }
      return;
    }

    const usage = tradeUsageMap[trade.id] || { batchCount: 0, traineeCount: 0, examCount: 0 };
    const isReferenced = usage.batchCount > 0 || usage.traineeCount > 0 || usage.examCount > 0;

    if (isReferenced) {
      // Referenced by batches/trainees: Open modal with BOTH safe deactivate and hard delete options
      setSafeDeleteModalTrade({
        trade,
        batchCount: usage.batchCount,
        traineeCount: usage.traineeCount,
        examCount: usage.examCount,
      });

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `ট্রেড অপসারণ ডায়ালগ ওপেন (রেফারেন্স বিদ্যমান): ${trade.name} (${trade.code})`,
        'Trades',
        trade.id
      );
    } else {
      // Unreferenced trade: Safe to hard delete directly with confirmation modal
      const confirmed = await confirm({
        title: 'ট্রেড অপসারণের নিশ্চিতকরণ',
        message: `আপনি কি নিশ্চিতভাবে "${trade.name} (${trade.code})" ট্রেডটি সিস্টেম থেকে সম্পূর্ণরূপে মুছে ফেলতে চান?`,
        detail: 'এই অপারেশনের ফলে ট্রেডের সমস্ত তথ্য অপসারিত হবে।',
        confirmText: 'হ্যাঁ, মুছে ফেলুন',
        cancelText: 'বাতিল',
        variant: 'danger'
      });

      if (confirmed) {
        try {
          await dataService.deleteTrade(trade.id);
          await logActivity(
            userProfile?.id || '',
            userProfile?.name || 'User',
            `ট্রেড স্থায়ীভাবে অপসারণ: ${trade.name} (${trade.code})`,
            'Trades',
            trade.id
          );
          setActionSuccessMessage(`"${trade.name}" ট্রেডটি সফলভাবে মুছে ফেলা হয়েছে।`);
          setTimeout(() => setActionSuccessMessage(''), 3000);
          fetchTradesData();
        } catch (error: any) {
          console.warn("Notice deleting trade:", error);
          await showAlert({
            title: 'ব্যর্থতা',
            message: "ট্রেড ডিলিট করতে সমস্যা হয়েছে: " + (error?.message || error),
            variant: 'danger'
          });
        }
      }
    }
  };

  // Force Hard Delete Handler (when referenced, user confirms removal)
  const handleForceDeleteTrade = async () => {
    if (!safeDeleteModalTrade || !canDelete) return;
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'ট্রেড সংরক্ষণাগারে স্থানান্তর (Fallback to Archive)',
        message: `সিস্টেম সেটিংস অনুযায়ী ট্রেড ডিলিট বন্ধ (Denied) রাখা হয়েছে। আপনি কি "${safeDeleteModalTrade.trade.name}" ট্রেডটি মুছে ফেলার পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ সংরক্ষণাগারে পাঠালে সংশ্লিষ্ট সকল ব্যাচ তথ্য সুরক্ষিত থাকবে এবং ট্রেডটি সংরক্ষণাগারে থাকবে।',
        confirmText: 'হ্যাঁ, সংরক্ষণাগারে পাঠান',
        cancelText: 'বাতিল',
        variant: 'warning'
      });
      if (confirmed) {
        await dataService.archiveRecord('trades', safeDeleteModalTrade.trade.id, 'ডিলিট নিষিদ্ধ থাকায় সংরক্ষণাগারে স্থানান্তর');
        setSafeDeleteModalTrade(null);
        setActionSuccessMessage(`"${safeDeleteModalTrade.trade.name}" ট্রেডটি সংরক্ষণাগারে স্থানান্তর করা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        await fetchTradesData();
      }
      return;
    }

    const { trade } = safeDeleteModalTrade;
    const confirmed = await confirm({
      title: 'বলপূর্বক ট্রেড অপসারণের নিশ্চিতকরণ',
      message: `আপনি কি নিশ্চিতভাবে "${trade.name} (${trade.code})" ট্রেডটি মুছে ফেলতে চান?`,
      detail: '⚠️ সতর্কতা: সংশ্লিষ্ট ব্যাচ থেকে এই ট্রেডের লিংক বাতিল করা হবে।',
      confirmText: 'হ্যাঁ, মুছে ফেলুন',
      cancelText: 'বাতিল',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        await dataService.deleteTrade(trade.id);
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ট্রেড বলপূর্বক অপসারণ: ${trade.name} (${trade.code})`,
          'Trades',
          trade.id
        );
        setSafeDeleteModalTrade(null);
        setActionSuccessMessage(`"${trade.name}" ট্রেডটি সফলভাবে মুছে ফেলা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3000);
        await fetchTradesData();
      } catch (error: any) {
        console.warn("Notice force deleting trade:", error);
        await showAlert({
          title: 'ব্যর্থতা',
          message: "ট্রেড ডিলিট করতে সমস্যা হয়েছে: " + (error?.message || error),
          variant: 'danger'
        });
      }
    }
  };

  // Safe Deactivate Handler (Preserves Foreign Keys)
  const handleConfirmDeactivate = async () => {
    if (!safeDeleteModalTrade || !canEdit) return;
    const { trade } = safeDeleteModalTrade;

    try {
      const updated: Trade = {
        ...trade,
        status: 'Inactive',
        updatedAt: Date.now(),
      };
      await dataService.saveItem('trades', updated);

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `ট্রেড নিষ্ক্রিয়করণ (ঐতিহাসিক রেকর্ড সংরক্ষিত): ${trade.name} (${trade.code})`,
        'Trades',
        trade.id
      );

      setActionSuccessMessage(`"${trade.name}" ট্রেডটি সফলভাবে নিষ্ক্রিয় করা হয়েছে। বিদ্যমান ব্যাচ ও শিক্ষার্থীদের রেকর্ড অক্ষত রয়েছে।`);
      setTimeout(() => setActionSuccessMessage(''), 4000);

      setSafeDeleteModalTrade(null);
      fetchTradesData();
    } catch (err) {
      console.warn("Could not deactivate trade:", err);
    }
  };

  // Filtered & Sorted Trades List
  const processedTrades = useMemo(() => {
    return trades
      .filter(t => {
        // Status filter
        if (statusFilter === 'Active' && t.status !== 'Active') return false;
        if (statusFilter === 'Inactive' && t.status !== 'Inactive') return false;
        if (statusFilter === 'duplicates') {
          const clean = (t.code || '').trim().toUpperCase();
          if (!duplicateCodesMap.has(clean)) return false;
        }

        // Search filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const nameMatch = (t.name || '').toLowerCase().includes(term);
          const nameEnMatch = (t.nameEn || '').toLowerCase().includes(term);
          const codeMatch = (t.code || '').toLowerCase().includes(term);
          const descMatch = (t.description || '').toLowerCase().includes(term);
          return nameMatch || nameEnMatch || codeMatch || descMatch;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'code_asc') return (a.code || '').localeCompare(b.code || '');
        if (sortBy === 'code_desc') return (b.code || '').localeCompare(a.code || '');
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'created_desc') return (b.createdAt || 0) - (a.createdAt || 0);
        return 0;
      });
  }, [trades, statusFilter, searchTerm, sortBy, duplicateCodesMap]);

  // Pagination slice
  const totalPages = Math.ceil(processedTrades.length / ITEMS_PER_PAGE) || 1;
  const paginatedTrades = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedTrades.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedTrades, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-700">বৃত্তিমূলক ট্রেড তালিকা লোড হচ্ছে...</p>
        <span className="text-xs text-slate-400 mt-1">BNFE অনুমোদিত কারিগরি কোর্স ডেটা সমন্বয় হচ্ছে</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ======================================================== */}
      {/* 1. HEADER BANNER & ACTION BAR                            */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 mb-1">
            <span>উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)</span>
            <span>•</span>
            <span>বৃত্তিমূলক কোর্স পরিচালনা</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            বৃত্তিমূলক ট্রেড (Vocational Trades)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ঝরে পড়া কিশোর-কিশোরীদের দক্ষতা বৃদ্ধির জন্য অনুমোদিত কারিগরি ট্রেড তালিকা ও মেয়াদ
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition flex items-center space-x-1 shadow-2xs"
            title="তথ্য রিফ্রেশ করুন"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">রিফ্রেশ</span>
          </button>

          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-sm font-bold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20"
            >
              <Plus size={18} />
              <span>নতুন ট্রেড যুক্ত করুন</span>
            </button>
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
      {/* 2. DUPLICATE CODE ALERT BANNER (IF DETECTED IN DATABASE) */}
      {/* ======================================================== */}
      {duplicateTradesCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                ডুপ্লিকেট ট্রেড কোড সতর্কতা ({toBn(duplicateTradesCount)}টি রেকর্ড)
              </h3>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                ডাটাবেজে <strong>{Array.from(duplicateCodesMap).join(', ')}</strong> কোডটি একাধিক ট্রেডে বিদ্যমান রয়েছে। প্রাতিষ্ঠানিক রেফারেন্সের অখণ্ডতা বজায় রাখতে রেকর্ডগুলো স্বয়ংক্রিয়ভাবে পরিবর্তন করা হয়নি।
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStatusFilter('duplicates');
              setCurrentPage(1);
            }}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shrink-0 self-start sm:self-auto"
          >
            ডুপ্লিকেটগুলো ফিল্টার করুন
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SUMMARY KPI METRIC CARDS                              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Wrench size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">মোট ট্রেড</span>
            <h4 className="text-2xl font-black text-slate-800">{toBn(stats.total)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">সক্রিয় ট্রেড</span>
            <h4 className="text-2xl font-black text-emerald-700">{toBn(stats.active)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">নিষ্ক্রিয় ট্রেড</span>
            <h4 className="text-2xl font-black text-slate-600">{toBn(stats.inactive)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">সংযুক্ত ব্যাচ</span>
            <h4 className="text-2xl font-black text-purple-700">{toBn(stats.totalBatchesWithTrade)}</h4>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. SEARCH, FILTERS & SORTING TOOLBAR                     */}
      {/* ======================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="ট্রেডের নাম (বাংলা/ইংরেজি), ট্রেড কোড বা বিবরণ লিখে খুঁজুন..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
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

          {/* Sort Selector */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1">
              <ArrowUpDown size={14} />
              <span>সাজান:</span>
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="code_asc">ট্রেড কোড (ক্রমানুসারে)</option>
              <option value="code_desc">ট্রেড কোড (বিপরীত)</option>
              <option value="name_asc">ট্রেডের নাম (অ-হ)</option>
              <option value="created_desc">সর্বশেষ যুক্তকৃত</option>
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5 flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center space-x-1">
            <Filter size={13} />
            <span>ফিল্টার:</span>
          </span>
          <button
            onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সকল ট্রেড ({toBn(trades.length)})
          </button>
          <button
            onClick={() => { setStatusFilter('Active'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'Active'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            সক্রিয় ট্রেড ({toBn(stats.active)})
          </button>
          <button
            onClick={() => { setStatusFilter('Inactive'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'Inactive'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            নিষ্ক্রিয় ট্রেড ({toBn(stats.inactive)})
          </button>
          {duplicateTradesCount > 0 && (
            <button
              onClick={() => { setStatusFilter('duplicates'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'duplicates'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
              }`}
            >
              ডুপ্লিকেট কোড সতর্কতা ({toBn(duplicateTradesCount)})
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. TRADES GRID (RESPONSIVE CARDS)                        */}
      {/* ======================================================== */}
      {processedTrades.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
          <Wrench size={36} className="mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-sm">কোনো ট্রেড পাওয়া যায়নি</p>
          <p className="text-slate-500">
            {searchTerm ? 'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো ট্রেড নেই।' : 'সিস্টেমে এখনো কোনো ট্রেড অন্তর্ভুক্ত করা হয়নি।'}
          </p>
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="mt-2 inline-flex items-center space-x-1 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              <Plus size={15} />
              <span>নতুন ট্রেড যুক্ত করুন</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedTrades.map((trade) => {
            const usage = tradeUsageMap[trade.id] || { batchCount: 0, traineeCount: 0, examCount: 0 };
            const cleanCode = (trade.code || '').trim().toUpperCase();
            const isDuplicateCode = duplicateCodesMap.has(cleanCode);

            return (
              <div 
                key={trade.id} 
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md relative overflow-hidden ${
                  isDuplicateCode ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200/90'
                }`}
              >
                {/* Duplicate Badge */}
                {isDuplicateCode && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg flex items-center space-x-1 shadow-2xs">
                    <AlertTriangle size={10} />
                    <span>ডুপ্লিকেট কোড</span>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Card Header: Icon & Status */}
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shadow-2xs">
                      <Wrench size={22} />
                    </div>

                    <div className="flex items-center space-x-1.5 pt-0.5 pr-2">
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                        trade.status === 'Active' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {trade.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Code */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-base leading-snug">
                      {trade.name}
                    </h3>
                    {trade.nameEn && (
                      <p className="text-xs text-slate-400 italic font-sans mt-0.5">
                        {trade.nameEn}
                      </p>
                    )}
                    <div className="flex items-center space-x-2 mt-1.5">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        কোড: {trade.code}
                      </span>
                      {trade.updatedAt && (
                        <span className="text-[10px] text-slate-400">
                          আপডেট: {safeFormatDate(trade.updatedAt, 'dd/MM/yy')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 min-h-[32px]">
                    {trade.description || 'ট্রেডের বিস্তারিত বিবরণ উল্লেখ করা হয়নি।'}
                  </p>

                  {/* Duration */}
                  <div className="flex items-center space-x-1.5 text-xs text-slate-600 py-1.5 px-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Clock size={14} className="text-emerald-600 shrink-0" />
                    <span>কোর্সের মেয়াদ: <strong>{trade.duration}</strong></span>
                  </div>

                  {/* Relationship Badges (Batches & Trainees using this trade) */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                    <div className="flex items-center space-x-1.5 p-1.5 bg-purple-50/70 border border-purple-100 rounded-lg">
                      <Layers size={13} className="text-purple-600" />
                      <span>সংযুক্ত ব্যাচ: <strong className="text-purple-900">{toBn(usage.batchCount)}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-blue-50/70 border border-blue-100 rounded-lg">
                      <Users size={13} className="text-blue-600" />
                      <span>শিক্ষার্থী: <strong className="text-blue-900">{toBn(usage.traineeCount)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                {(canEdit || canDelete) && (
                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 mt-4 text-xs">
                    <span className="text-[10px] text-slate-400 font-medium">
                      আইডি: {trade.id}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenModal(trade)}
                          className="px-2.5 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg font-semibold transition flex items-center space-x-1"
                          title="ট্রেড তথ্য সম্পাদনা করুন"
                        >
                          <Edit2 size={13} />
                          <span>সম্পাদনা</span>
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteRequest(trade)}
                          className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-semibold transition flex items-center space-x-1"
                          title={usage.batchCount > 0 ? "সংযুক্ত রেফারেন্স থাকায় নিষ্ক্রিয়করণ প্রযোজ্য" : "ট্রেড মুছে ফেলুন"}
                        >
                          <Trash2 size={13} />
                          <span>মুছুন</span>
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

      {/* ======================================================== */}
      {/* 6. PAGINATION CONTROLS                                    */}
      {/* ======================================================== */}
      {totalPages > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            মোট {toBn(processedTrades.length)}টি ট্রেডের মধ্যে {toBn((currentPage - 1) * ITEMS_PER_PAGE + 1)} থেকে {toBn(Math.min(currentPage * ITEMS_PER_PAGE, processedTrades.length))} প্রদর্শিত হচ্ছে
          </span>

          <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <div className="flex items-center space-x-1 shrink-0 min-w-max">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
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
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="shrink-0 p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                title="পরবর্তী পৃষ্ঠা"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. SAFE DELETE / DEACTIVATION MODAL                       */}
      {/* ======================================================== */}
      {safeDeleteModalTrade && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  ট্রেড অপসারণ ও রেফারেন্স সতর্কতা (Trade Reference Alert)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  এই ট্রেডের সাথে সম্পর্কিত রেকর্ড বিদ্যমান। আপনি নিরাপদে নিষ্ক্রিয় করতে পারেন অথবা স্থায়ীভাবে ডিলিট করতে পারেন।
                </p>
              </div>
              <button 
                onClick={() => setSafeDeleteModalTrade(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-950">
              <p className="font-bold">
                "{safeDeleteModalTrade.trade.name} ({safeDeleteModalTrade.trade.code})" ট্রেডটির সাথে নিম্নলিখিত তথ্য যুক্ত রয়েছে:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>সংযুক্ত ব্যাচ: <strong>{toBn(safeDeleteModalTrade.batchCount)} টি</strong></li>
                <li>নিবন্ধিত শিক্ষার্থী: <strong>{toBn(safeDeleteModalTrade.traineeCount)} জন</strong></li>
                {safeDeleteModalTrade.examCount > 0 && (
                  <li>পরীক্ষা ও মূল্যায়ন: <strong>{toBn(safeDeleteModalTrade.examCount)} টি</strong></li>
                )}
              </ul>
              <p className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/80">
                ⚠️ স্থায়ীভাবে ডিলিট করলে সংশ্লিষ্ট ব্যাচসমূহ থেকে এই ট্রেডের লিংক বাতিল হয়ে যাবে।
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSafeDeleteModalTrade(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                নিরাপদে নিষ্ক্রিয় করুন (Deactivate)
              </button>
              <button
                type="button"
                onClick={handleForceDeleteTrade}
                disabled={!isDeletionAllowed}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 ${
                  !isDeletionAllowed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={!isDeletionAllowed ? 'সেটিংস থেকে ডাটা ডিলিট বন্ধ রাখা হয়েছে 🔒' : 'ট্রেডটি স্থায়ীভাবে মুছে ফেলুন'}
              >
                <Trash2 size={13} />
                <span>{isDeletionAllowed ? 'স্থায়ীভাবে ডিলিট করুন (Hard Delete)' : 'ডিলিট লক 🔒'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. CREATE / EDIT TRADE MODAL                              */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingTrade ? 'ট্রেডের তথ্য সম্পাদনা (Edit Trade)' : 'নতুন বৃত্তিমূলক ট্রেড নিবন্ধন (New Trade)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  BNFE কারিগরি শিক্ষা মানদণ্ড অনুযায়ী কোর্স বিবরণ পূরণ করুন
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Bengali Trade Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ট্রেডের নাম (বাংলা) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: কম্পিউটার অফিস অ্যাপ্লিকেশান ও গ্রাফিক্স ডিজাইন"
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition ${
                    formErrors.name ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.name}</span>
                  </p>
                )}
              </div>

              {/* English Trade Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ট্রেডের নাম (ইংরেজি - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Office Application & Graphics"
                  value={formData.nameEn}
                  onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-sans focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
              </div>

              {/* Trade Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    ইউনিক ট্রেড কোড *
                  </label>
                  {!editingTrade && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, code: generateSafeNextTradeCode(trades) })}
                      className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center space-x-0.5"
                    >
                      <Sparkles size={11} />
                      <span>পরবর্তী কোড অটো-জেনারেট</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="যেমন: TRD-01"
                  value={formData.code}
                  onChange={e => {
                    setFormData({ ...formData, code: e.target.value });
                    if (formErrors.code) setFormErrors({ ...formErrors, code: '' });
                  }}
                  className={`w-full px-3.5 py-2.5 border font-mono font-bold rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase transition ${
                    formErrors.code ? 'border-red-400 bg-red-50/40 text-red-900' : 'border-slate-300'
                  }`}
                />
                {formErrors.code ? (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.code}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    ট্রেড কোডটি ডাটাবেজে সম্পূর্ণ ইউনিক হতে হবে।
                  </p>
                )}
              </div>

              {/* Training Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  কোর্সের মেয়াদ ও প্রশিক্ষণ ঘণ্টা *
                </label>
                <select
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  {DURATION_PRESETS.map(preset => (
                    <option key={preset} value={preset}>{preset}</option>
                  ))}
                </select>

                {formData.duration === 'কাস্টম (অন্যান্য)' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="কাস্টম মেয়াদ লিখুন (যেমন: ২ মাস (১২০ ঘণ্টা))"
                      value={formData.customDuration}
                      onChange={e => setFormData({ ...formData, customDuration: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ট্রেডের বিবরণ ও বিষয়বস্তু (ঐচ্ছিক)
                </label>
                <textarea
                  rows={3}
                  placeholder="কোর্সের মূল কারিকুলাম, ব্যবহারিক বিষয়াদি এবং প্রশিক্ষণ লক্ষ্যের সংক্ষিপ্ত বিবরণ..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ট্রেড স্ট্যাটাস *
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="Active">সক্রিয় (Active - নতুন ব্যাচে বরাদ্দযোগ্য)</option>
                  <option value="Inactive">নিষ্ক্রিয় (Inactive - নতুন ব্যাচে বরাদ্দ স্থগিত)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  নিষ্ক্রিয় ট্রেডগুলো বিদ্যমান রেকর্ডে সংরক্ষিত থাকবে কিন্তু নতুন ব্যাচে নির্বাচন করা যাবে না।
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : editingTrade ? 'আপডেট সংরক্ষণ করুন' : 'ট্রেড তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trades;
