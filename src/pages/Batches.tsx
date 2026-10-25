import React, { useState, useEffect, useMemo } from 'react';
import { logActivity } from '../lib/firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Layers, 
  Calendar, 
  Users, 
  X, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Building2,
  Wrench,
  Clock,
  Check,
  Archive,
  Ban,
  CalendarCheck,
  CalendarDays,
  FileText,
  AlertCircle,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { Batch, Institute, Trade, Trainee, AttendanceRecord, Exam } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';
import { safeFormatDate, toBn } from '../lib/dateUtils';
import { Link } from 'react-router-dom';

const FISCAL_YEARS = ['২০২৫-২০২৬', '২০২৪-২০২৫', '২০২৬-২০২৭'];
const ITEMS_PER_PAGE = 6;

const Batches: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  
  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [viewingBatch, setViewingBatch] = useState<Batch | null>(null);

  // Safe Lifecycle Modal State (Cancel / Archive)
  const [safeLifecycleBatch, setSafeLifecycleBatch] = useState<{
    batch: Batch;
    traineeCount: number;
    attendanceCount: number;
    examCount: number;
  } | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<'archive' | 'cancel'>('archive');
  const [cancellationReason, setCancellationReason] = useState('');

  // Form State & Errors
  const [formData, setFormData] = useState({
    name: '',
    batchCode: '',
    instituteId: '',
    tradeId: '',
    fiscalYear: '২০২৫-২০২৬',
    startDate: '',
    endDate: '',
    maxTrainees: 30,
    status: 'Active' as Batch['status'],
    cancellationReason: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Search, Filter, Sort, Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstitute, setFilterInstitute] = useState('all');
  const [filterTrade, setFilterTrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFiscalYear, setFilterFiscalYear] = useState('all');
  const [sortBy, setSortBy] = useState<'code_asc' | 'date_desc' | 'name_asc' | 'trainees_desc'>('code_asc');
  const [currentPage, setCurrentPage] = useState(1);

  const { userProfile } = useAuth();
  const { hasPermission, isCourseDirector } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();

  const isDirector = isCourseDirector || userProfile?.role === 'Course Director';
  const canCreate = hasPermission('create_batch') || isDirector;
  const canEdit = hasPermission('edit_batch') || isDirector;
  const canDelete = hasPermission('delete_batch') || isDirector;
  const canSeed = hasPermission('seed_demo_trainees') || isDirector;

  useEffect(() => {
    fetchBatchesData();
  }, [userProfile]);

  const fetchBatchesData = async () => {
    setLoading(true);
    try {
      const [bList, iList, tList, trnList] = await Promise.all([
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Trainee>('trainees'),
      ]);

      setBatches(bList);
      setInstitutes(iList);
      setTrades(tList);
      setTrainees(trnList);
    } catch (error) {
      console.warn("Notice fetching batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBatchesData();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Safe Batch Code Generator: scans all batches, extracts max digits, generates BAT-0X
  const generateSafeNextBatchCode = (currentBatches: Batch[]): string => {
    const existingCodes = currentBatches.map(b => b.batchCode || b.id || '');
    const numbers = existingCodes
      .map(c => {
        const match = c.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n) && n > 0);

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    return `BAT-${String(nextNum).padStart(2, '0')}`;
  };

  // Trainees count map per batch
  const batchTraineesMap = useMemo(() => {
    const map: Record<string, number> = {};
    batches.forEach(b => {
      map[b.id] = trainees.filter(t => t.batchId === b.id).length;
    });
    return map;
  }, [batches, trainees]);

  // Overall Batch Statistics
  const stats = useMemo(() => {
    const total = batches.length;
    const active = batches.filter(b => !b.status || b.status === 'Active').length;
    const upcoming = batches.filter(b => b.status === 'Upcoming').length;
    const completed = batches.filter(b => b.status === 'Completed').length;
    const archived = batches.filter(b => b.status === 'Archived').length;
    const cancelled = batches.filter(b => b.status === 'Cancelled').length;
    const totalEnrolled = trainees.filter(t => t.batchId).length;
    return { total, active, upcoming, completed, archived, cancelled, totalEnrolled };
  }, [batches, trainees]);

  // Check possible duplicate batch warning (trade, institute, date overlap)
  const checkForDuplicates = (instId: string, trdId: string, fYear: string, sDate: string, eDate: string, excludeBatchId?: string) => {
    if (!instId || !trdId || !sDate || !eDate) {
      setDuplicateWarning(null);
      return;
    }

    const start = new Date(sDate).getTime();
    const end = new Date(eDate).getTime();

    const match = batches.find(b => {
      if (b.id === excludeBatchId) return false;
      const sameInst = b.instituteId === instId;
      const sameTrd = b.tradeId === trdId;
      const bStart = b.startDate || 0;
      const bEnd = b.endDate || 0;
      const datesOverlap = (start <= bEnd && end >= bStart);
      const sameFiscal = b.fiscalYear && fYear ? b.fiscalYear === fYear : false;

      return sameInst && sameTrd && (sameFiscal || datesOverlap);
    });

    if (match) {
      setDuplicateWarning(
        `সতর্কতা: নির্বাচিত প্রতিষ্ঠানে এই ট্রেডে ইতোমধ্যে "${match.name} (${match.batchCode || match.id})" নামক একটি ব্যাচ নির্ধারিত রয়েছে। অনুগ্রহ করে নিশ্চিত হোন যে আপনি একই সময়ে আরেকটি ব্যাচ পরিচালনা করতে চান কিনা।`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  // Open Add / Edit Modal
  const handleOpenModal = (b?: Batch) => {
    setFormErrors({});
    setDuplicateWarning(null);
    const availableInstitutes = institutes;
    const activeTrades = trades.filter(t => t.status === 'Active');
    const availableTrades = activeTrades.length > 0 ? activeTrades : trades;

    if (b) {
      setEditingBatch(b);
      setFormData({
        name: b.name,
        batchCode: b.batchCode || b.id || '',
        instituteId: b.instituteId || availableInstitutes[0]?.id || '',
        tradeId: b.tradeId || availableTrades[0]?.id || '',
        fiscalYear: b.fiscalYear || '২০২৫-২০২৬',
        startDate: safeFormatDate(b.startDate, 'yyyy-MM-dd'),
        endDate: safeFormatDate(b.endDate, 'yyyy-MM-dd'),
        maxTrainees: b.maxTrainees || 30,
        status: b.status || 'Active',
        cancellationReason: b.cancellationReason || '',
      });
    } else {
      setEditingBatch(null);
      const nextCode = generateSafeNextBatchCode(batches);
      const today = new Date();
      const sixMonthsLater = new Date(today.getTime() + 180 * 86400000);

      setFormData({
        name: '',
        batchCode: nextCode,
        instituteId: availableInstitutes[0]?.id || '',
        tradeId: availableTrades[0]?.id || '',
        fiscalYear: '২০২৫-২০২৬',
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(sixMonthsLater, 'yyyy-MM-dd'),
        maxTrainees: 30,
        status: 'Active',
        cancellationReason: '',
      });
    }
    setIsModalOpen(true);
  };

  // Form Validation
  const validateForm = async (): Promise<boolean> => {
    const errors: Record<string, string> = {};

    // 1. Batch Name
    if (!formData.name.trim()) {
      errors.name = 'ব্যাচের নাম প্রদান করা আবশ্যক।';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'ব্যাচের নাম অন্তত ৩ অক্ষরের হতে হবে।';
    }

    // 2. Batch Code
    const cleanCode = formData.batchCode.trim().toUpperCase();
    if (!cleanCode) {
      errors.batchCode = 'ব্যাচ কোড প্রদান করা আবশ্যক।';
    } else if (!/^[A-Z0-9\-_]{3,15}$/.test(cleanCode)) {
      errors.batchCode = 'ব্যাচ কোড ৩-১৫ অক্ষরের ইংরেজি বর্ণ, সংখ্যা বা ড্যাশ হতে হবে (যেমন: BAT-01)।';
    } else {
      const isDuplicate = batches.some(
        b => b.id !== editingBatch?.id && (b.batchCode?.trim().toUpperCase() === cleanCode || b.id.trim().toUpperCase() === cleanCode)
      );
      if (isDuplicate) {
        errors.batchCode = `এই ব্যাচ কোডটি ('${cleanCode}') ইতোমধ্যে অন্য একটি ব্যাচে ব্যবহৃত হয়েছে। ইউনিক কোড দিন।`;
      }
    }

    // 3. Institute and Trade
    if (!formData.instituteId) {
      errors.instituteId = 'প্রশিক্ষণ প্রতিষ্ঠান নির্বাচন করুন।';
    }
    if (!formData.tradeId) {
      errors.tradeId = 'বৃত্তিমূলক ট্রেড নির্বাচন করুন।';
    } else {
      const selectedTrade = trades.find(t => t.id === formData.tradeId);
      if (!editingBatch && selectedTrade?.status === 'Inactive') {
        errors.tradeId = 'নিষ্ক্রিয় ট্রেডে নতুন ব্যাচ বরাদ্দ দেওয়া অনুমোদিত নয়।';
      }
    }

    // 4. Dates & Consistency
    if (!formData.startDate) {
      errors.startDate = 'শুরুর তারিখ নির্বাচন করুন।';
    }
    if (!formData.endDate) {
      errors.endDate = 'সমাপ্তির তারিখ নির্বাচন করুন।';
    }
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate).getTime();
      const end = new Date(formData.endDate).getTime();
      if (end <= start) {
        errors.endDate = 'সমাপ্তির তারিখ অবশ্যই শুরুর তারিখের পরবর্তী হতে হবে।';
      } else if (end - start < 15 * 86400000) {
        errors.endDate = 'কোর্সের মেয়াদ নূন্যতম ১৫ দিন হতে হবে।';
      }
    }

    // 5. Capacity
    const capacity = Number(formData.maxTrainees);
    if (isNaN(capacity) || capacity < 5 || capacity > 100) {
      errors.maxTrainees = 'সর্বোচ্চ আসন সংখ্যা ৫ থেকে ১০০ এর মধ্যে হতে হবে (আদর্শ: ৩০)।';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const isValid = await validateForm();
    if (!isValid) return;

    setSubmitting(true);
    try {
      const cleanCode = formData.batchCode.trim().toUpperCase();
      const id = editingBatch ? editingBatch.id : `BAT-${cleanCode.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
      
      const startMs = new Date(formData.startDate).getTime();
      const endMs = new Date(formData.endDate).getTime();

      // Operational Status calculation:
      // Preserve manual administrative choices (Archived / Cancelled)
      let calculatedStatus = formData.status;
      if (formData.status !== 'Archived' && formData.status !== 'Cancelled') {
        const now = Date.now();
        if (now < startMs) {
          calculatedStatus = 'Upcoming';
        } else if (now > endMs) {
          calculatedStatus = 'Completed';
        } else {
          calculatedStatus = 'Active';
        }
      }

      const savedBatch: Batch = {
        id,
        name: formData.name.trim(),
        batchCode: cleanCode,
        instituteId: formData.instituteId,
        tradeId: formData.tradeId,
        fiscalYear: formData.fiscalYear,
        startDate: startMs,
        endDate: endMs,
        maxTrainees: Number(formData.maxTrainees),
        status: calculatedStatus,
        cancellationReason: formData.cancellationReason?.trim() || undefined,
        createdAt: editingBatch?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await dataService.saveItem('batches', savedBatch);

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingBatch 
          ? `ব্যাচ তথ্য আপডেট: ${savedBatch.name} (${savedBatch.batchCode})` 
          : `নতুন ব্যাচ তৈরি: ${savedBatch.name} (${savedBatch.batchCode})`,
        'Batches',
        id
      );

      setActionSuccessMessage(editingBatch ? 'ব্যাচের তথ্য সফলভাবে আপডেট করা হয়েছে।' : 'নতুন প্রশিক্ষণ ব্যাচ সফলভাবে যুক্ত করা হয়েছে।');
      setTimeout(() => setActionSuccessMessage(''), 3500);

      setIsModalOpen(false);
      await fetchBatchesData();
    } catch (error) {
      console.warn("Notice saving batch:", error);
      alert("ব্যাচ সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।");
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Delete Request Handler: Checks for references
  const handleDeleteRequest = async (batch: Batch) => {
    if (!canDelete) return;

    if (!isDeletionAllowed) {
      alert("সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
      return;
    }

    try {
      const usage = await dataService.checkBatchUsage(batch.id);
      
      if (usage.isReferenced) {
        // References exist! Open Safe Lifecycle Modal (Archive / Cancel)
        setSafeLifecycleBatch({
          batch,
          traineeCount: usage.traineeCount,
          attendanceCount: usage.attendanceCount,
          examCount: usage.examCount,
        });
        setLifecycleAction('archive');
        setCancellationReason('');

        // Log the blocked deletion attempt
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ব্যাচ অপসারণ চেষ্টা ব্যর্থ (রেফারেন্স বিদ্যমান): ${batch.name} (${batch.batchCode || batch.id})`,
          'Batches',
          batch.id
        );
      } else {
        // Unreferenced batch: Safe to hard delete with confirmation
        if (window.confirm(`আপনি কি নিশ্চিতভাবে "${batch.name} (${batch.batchCode || batch.id})" ব্যাচটি স্থায়ীভাবে মুছে ফেলতে চান?`)) {
          await dataService.deleteItem('batches', batch.id);
          await logActivity(
            userProfile?.id || '',
            userProfile?.name || 'User',
            `ব্যাচ স্থায়ীভাবে অপসারণ: ${batch.name} (${batch.batchCode || batch.id})`,
            'Batches',
            batch.id
          );
          setActionSuccessMessage(`"${batch.name}" ব্যাচটি সফলভাবে মুছে ফেলা হয়েছে।`);
          setTimeout(() => setActionSuccessMessage(''), 3000);
          fetchBatchesData();
        }
      }
    } catch (err) {
      console.warn("Error checking batch usage:", err);
    }
  };

  // Safe Lifecycle Submission (Archive or Cancel)
  const handleConfirmLifecycleAction = async () => {
    if (!safeLifecycleBatch || !canEdit) return;
    const { batch } = safeLifecycleBatch;

    if (lifecycleAction === 'cancel' && !cancellationReason.trim()) {
      alert("ব্যাচটি বাতিলের কারণ উল্লেখ করা আবশ্যক।");
      return;
    }

    try {
      const newStatus: Batch['status'] = lifecycleAction === 'archive' ? 'Archived' : 'Cancelled';
      const updated: Batch = {
        ...batch,
        status: newStatus,
        cancellationReason: lifecycleAction === 'cancel' ? cancellationReason.trim() : undefined,
        updatedAt: Date.now(),
      };

      await dataService.saveItem('batches', updated);

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        lifecycleAction === 'archive'
          ? `ব্যাচ আর্কাইভকরণ (রেকর্ড সংরক্ষিত): ${batch.name}`
          : `ব্যাচ বাতিলকরণ (কারণ: ${cancellationReason.trim()}): ${batch.name}`,
        'Batches',
        batch.id
      );

      setActionSuccessMessage(
        lifecycleAction === 'archive'
          ? `"${batch.name}" ব্যাচটি সফলভাবে আর্কাইভ করা হয়েছে। সকল শিক্ষার্থী ও হাজিরার রেকর্ড অক্ষত রয়েছে।`
          : `"${batch.name}" ব্যাচটি বাতিল তালিকাভুক্ত করা হয়েছে। কারণ অডিট লগে সংরক্ষিত হয়েছে।`
      );
      setTimeout(() => setActionSuccessMessage(''), 4000);

      setSafeLifecycleBatch(null);
      fetchBatchesData();
    } catch (err) {
      console.warn("Error archiving/cancelling batch:", err);
    }
  };

  // Force Hard Delete Handler for Batch (when referenced, user confirms cascade removal)
  const handleForceDeleteBatch = async () => {
    if (!safeLifecycleBatch || !canDelete) return;
    if (!isDeletionAllowed) {
      alert("🔒 সেটিংস থেকে সিস্টেম ডাটা ডিলিট বন্ধ (Disabled) রাখা হয়েছে। কোনো রেকর্ড ডিলিট করতে চাইলে সেটিংস পেজ থেকে 'ডাটা ডিলিট অনুমতি' চালু করুন।");
      return;
    }

    const { batch, traineeCount, attendanceCount } = safeLifecycleBatch;
    if (window.confirm(`⚠️ আপনি কি নিশ্চিতভাবে "${batch.name} (${batch.batchCode || batch.id})" ব্যাচটি স্থায়ীভাবে মুছে ফেলতে চান?\n\nএতে এই ব্যাচের সকল শিক্ষার্থী (${traineeCount} জন) ও হাজিরা (${attendanceCount} টি) রেকর্ড স্থায়ীভাবে মুছে যাবে!`)) {
      try {
        await dataService.deleteBatch(batch.id, true);
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ব্যাচ বলপূর্বক অপসারণ (ক্যাসকেড সহ): ${batch.name} (${batch.batchCode || batch.id})`,
          'Batches',
          batch.id
        );
        setSafeLifecycleBatch(null);
        setActionSuccessMessage(`"${batch.name}" ব্যাচ ও সংশ্লিষ্ট সকল রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`);
        setTimeout(() => setActionSuccessMessage(''), 3500);
        await fetchBatchesData();
      } catch (error: any) {
        console.warn("Notice force deleting batch:", error);
        alert("ব্যাচ ডিলিট করতে সমস্যা হয়েছে: " + (error?.message || error));
      }
    }
  };

  // Seed Demo Trainees
  const handleSeedDemoTrainees = async () => {
    setSeeding(true);
    try {
      await dataService.seedDemoTraineesForAllBatches(false);
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        'সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী যোগ করা হয়েছে',
        'Batches',
        'seed_demo_trainees'
      );
      await fetchBatchesData();
      setActionSuccessMessage('সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী সফলভাবে অন্তর্ভুক্ত করা হয়েছে!');
      setTimeout(() => setActionSuccessMessage(''), 5000);
    } catch (error) {
      console.warn("Notice seeding demo trainees in Batches:", error);
    } finally {
      setSeeding(false);
    }
  };

  const getInstituteName = (id: string) => 
    institutes.find(i => i.id === id)?.name || id || '-';

  const getTradeName = (id: string) => 
    trades.find(t => t.id === id)?.name || id || '-';

  // Filtered and Sorted Batches
  const processedBatches = useMemo(() => {
    return batches
      .filter(b => {
        // Institute filter
        if (filterInstitute !== 'all' && b.instituteId !== filterInstitute) return false;
        // Trade filter
        if (filterTrade !== 'all' && b.tradeId !== filterTrade) return false;
        // Status filter
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        // Fiscal Year filter
        if (filterFiscalYear !== 'all' && b.fiscalYear !== filterFiscalYear) return false;

        // Search text
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const nameMatch = (b.name || '').toLowerCase().includes(term);
          const codeMatch = (b.batchCode || b.id || '').toLowerCase().includes(term);
          const instMatch = getInstituteName(b.instituteId).toLowerCase().includes(term);
          const tradeMatch = getTradeName(b.tradeId).toLowerCase().includes(term);
          return nameMatch || codeMatch || instMatch || tradeMatch;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'code_asc') return (a.batchCode || a.id).localeCompare(b.batchCode || b.id);
        if (sortBy === 'date_desc') return (b.startDate || 0) - (a.startDate || 0);
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'trainees_desc') return (batchTraineesMap[b.id] || 0) - (batchTraineesMap[a.id] || 0);
        return 0;
      });
  }, [batches, filterInstitute, filterTrade, filterStatus, filterFiscalYear, searchTerm, sortBy, institutes, trades, batchTraineesMap]);

  // Pagination
  const totalPages = Math.ceil(processedBatches.length / ITEMS_PER_PAGE) || 1;
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedBatches.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedBatches, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Get Status badge
  const renderStatusBadge = (status?: Batch['status']) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">চলমান</span>;
      case 'Upcoming':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">আসন্ন</span>;
      case 'Completed':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">সম্পন্ন</span>;
      case 'Archived':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">আর্কাইভকৃত</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">বাতিলকৃত</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">চলমান</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-700">প্রশিক্ষণ ব্যাচ তালিকা লোড হচ্ছে...</p>
        <span className="text-xs text-slate-400 mt-1">প্রতিষ্ঠান ও ট্রেড ভিত্তিক ব্যাচ ডেটাবেজ সমন্বয় হচ্ছে</span>
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
            <span>প্রশিক্ষণ ব্যাচ ও শিক্ষার্থী পরিচালনা</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            প্রশিক্ষণ ব্যাচ (Training Batches)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            প্রতিষ্ঠান ও ট্রেড অনুযায়ী বরাদ্দকৃত ব্যাচের সময়সূচি, আসন সংখ্যা ও অগ্রগতি
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



          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-sm font-bold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20"
            >
              <Plus size={18} />
              <span>নতুন ব্যাচ যুক্ত করুন</span>
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
      {/* 2. SUMMARY KPI METRIC CARDS                              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">মোট ব্যাচ</span>
            <h4 className="text-2xl font-black text-slate-800">{toBn(stats.total)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">চলমান</span>
            <h4 className="text-2xl font-black text-emerald-700">{toBn(stats.active)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">আসন্ন</span>
            <h4 className="text-2xl font-black text-blue-700">{toBn(stats.upcoming)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">সম্পন্ন</span>
            <h4 className="text-2xl font-black text-slate-700">{toBn(stats.completed)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Archive size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">আর্কাইভ/বাতিল</span>
            <h4 className="text-2xl font-black text-purple-900">{toBn(stats.archived + stats.cancelled)}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">মোট শিক্ষার্থী</span>
            <h4 className="text-2xl font-black text-teal-800">{toBn(stats.totalEnrolled)}</h4>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. SEARCH, FILTERS & SORTING TOOLBAR                     */}
      {/* ======================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="ব্যাচের নাম, ব্যাচ কোড, প্রতিষ্ঠান বা ট্রেড লিখে খুঁজুন..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
              <option value="code_asc">ব্যাচ কোড (ক্রমানুসারে)</option>
              <option value="date_desc">শুরুর তারিখ (নতুন আগে)</option>
              <option value="trainees_desc">শিক্ষার্থীর সংখ্যা (সর্বোচ্চ)</option>
              <option value="name_asc">ব্যাচের নাম (অ-হ)</option>
            </select>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Institute Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">প্রতিষ্ঠান ফিল্টার:</label>
            <select
              value={filterInstitute}
              onChange={e => { setFilterInstitute(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">সকল প্রতিষ্ঠান</option>
              {institutes.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          {/* Trade Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">ট্রেড ফিল্টার:</label>
            <select
              value={filterTrade}
              onChange={e => { setFilterTrade(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">সকল ট্রেড</option>
              {trades.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">অবস্থা (Status):</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">সকল অবস্থা</option>
              <option value="Active">চলমান (Active)</option>
              <option value="Upcoming">আসন্ন (Upcoming)</option>
              <option value="Completed">সম্পন্ন (Completed)</option>
              <option value="Archived">আর্কাইভকৃত (Archived)</option>
              <option value="Cancelled">বাতিলকৃত (Cancelled)</option>
            </select>
          </div>

          {/* Fiscal Year Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">অর্থবছর:</label>
            <select
              value={filterFiscalYear}
              onChange={e => { setFilterFiscalYear(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">সকল অর্থবছর</option>
              {FISCAL_YEARS.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. BATCHES GRID (RESPONSIVE CARDS)                       */}
      {/* ======================================================== */}
      {processedBatches.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
          <Layers size={36} className="mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-sm">কোনো প্রশিক্ষণ ব্যাচ পাওয়া যায়নি</p>
          <p className="text-slate-500">
            {searchTerm || filterInstitute !== 'all' || filterTrade !== 'all' || filterStatus !== 'all'
              ? 'আপনার ফিল্টারের সাথে মিলে এমন কোনো ব্যাচ নেই। ফিল্টার পরিবর্তন করে দেখুন।'
              : 'সিস্টেমে এখনো কোনো ব্যাচ তৈরি করা হয়নি।'}
          </p>
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="mt-2 inline-flex items-center space-x-1 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              <Plus size={15} />
              <span>নতুন ব্যাচ যুক্ত করুন</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedBatches.map((b) => {
            const enrolledCount = batchTraineesMap[b.id] || 0;
            const capacity = b.maxTrainees || 30;
            const capacityPercent = Math.min(100, Math.round((enrolledCount / capacity) * 100));

            // Timeline Calculation
            const now = Date.now();
            const start = b.startDate || now;
            const end = b.endDate || now + 180 * 86400000;
            const totalDays = Math.max(1, Math.round((end - start) / 86400000));
            const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now - start) / 86400000)));
            const timelinePercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

            return (
              <div 
                key={b.id} 
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md hover:border-emerald-300/80 space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Header: Icon, Batch Code & Status */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shadow-2xs">
                        <Layers size={22} />
                      </div>
                      <div>
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 inline-block">
                          {b.batchCode || b.id}
                        </span>
                        {b.fiscalYear && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            অর্থবছর: {b.fiscalYear}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {renderStatusBadge(b.status)}
                    </div>
                  </div>

                  {/* Batch Title, Trade & Institute */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-1">
                      {b.name}
                    </h3>
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold mt-1">
                      <Wrench size={13} className="shrink-0" />
                      <span className="truncate">{getTradeName(b.tradeId)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-0.5">
                      <Building2 size={13} className="shrink-0 text-slate-400" />
                      <span className="truncate">{getInstituteName(b.instituteId)}</span>
                    </div>
                  </div>

                  {/* Enrollment Capacity Bar */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Users size={13} />
                        <span>ভর্তি শিক্ষার্থী:</span>
                      </span>
                      <span className="font-bold text-slate-800">
                        <strong className="text-emerald-700">{toBn(enrolledCount)}</strong> / {toBn(capacity)} জন ({toBn(capacityPercent)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${capacityPercent}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          capacityPercent >= 100 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Date & Course Timeline Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>মেয়াদ:</span>
                      </span>
                      <span className="font-medium text-slate-700">
                        {safeFormatDate(b.startDate, 'dd MMM yy')} - {safeFormatDate(b.endDate, 'dd MMM yy')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>অগ্রগতি:</span>
                      <span>{toBn(elapsedDays)} / {toBn(totalDays)} দিন ({toBn(timelinePercent)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${timelinePercent}%` }}
                        className="bg-blue-600 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Cancellation reason if cancelled */}
                  {b.status === 'Cancelled' && b.cancellationReason && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 flex items-start space-x-1.5">
                      <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-600" />
                      <span>বাতিলের কারণ: {b.cancellationReason}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setViewingBatch(b)}
                    className="px-2.5 py-1 text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg font-semibold transition flex items-center space-x-1"
                  >
                    <Eye size={13} />
                    <span>বিস্তারিত</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    {canEdit && (
                      <button
                        onClick={() => handleOpenModal(b)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="ব্যাচ সম্পাদন করুন"
                      >
                        <Edit2 size={15} />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteRequest(b)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="ব্যাচ মুছে ফেলা বা আর্কাইভ করুন"
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
      {/* 5. PAGINATION CONTROLS                                    */}
      {/* ======================================================== */}
      {totalPages > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            মোট {toBn(processedBatches.length)}টি ব্যাচের মধ্যে {toBn((currentPage - 1) * ITEMS_PER_PAGE + 1)} থেকে {toBn(Math.min(currentPage * ITEMS_PER_PAGE, processedBatches.length))} প্রদর্শিত হচ্ছে
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
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
                  onClick={() => handlePageChange(p)}
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
              onClick={() => handlePageChange(currentPage + 1)}
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
      {/* 6. DETAILED BATCH VIEW MODAL (INSPECTOR)                  */}
      {/* ======================================================== */}
      {viewingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md">
                    {viewingBatch.batchCode || viewingBatch.id}
                  </span>
                  {renderStatusBadge(viewingBatch.status)}
                </div>
                <h2 className="text-xl font-bold text-slate-800 mt-1">
                  {viewingBatch.name}
                </h2>
              </div>
              <button onClick={() => setViewingBatch(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান):</span>
                <span className="text-slate-900 font-bold mt-0.5 block">{getInstituteName(viewingBatch.instituteId)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">বৃত্তিমূলক ট্রেড:</span>
                <span className="text-emerald-700 font-bold mt-0.5 block">{getTradeName(viewingBatch.tradeId)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">অর্থবছর ও কোর্সের সময়সীমা:</span>
                <span className="text-slate-900 font-bold mt-0.5 block">
                  {viewingBatch.fiscalYear || '২০২৫-২০২৬'} • {safeFormatDate(viewingBatch.startDate, 'dd MMM yyyy')} হতে {safeFormatDate(viewingBatch.endDate, 'dd MMM yyyy')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold block">আসন সংখ্যা ও বর্তমান ভর্তি:</span>
                <span className="text-slate-900 font-bold mt-0.5 block">
                  মোট আসন: {toBn(viewingBatch.maxTrainees || 30)} | বর্তমানে ভর্তি: <strong className="text-emerald-700">{toBn(batchTraineesMap[viewingBatch.id] || 0)} জন</strong>
                </span>
              </div>
            </div>

            {/* Enrolled Trainees List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা ({toBn(trainees.filter(t => t.batchId === viewingBatch.id).length)} জন)
                </h4>
                <Link
                  to={`/trainees/add?batchId=${viewingBatch.id}`}
                  className="text-xs text-emerald-700 font-semibold hover:underline flex items-center space-x-1"
                >
                  <UserPlus size={13} />
                  <span>নতুন ভর্তি</span>
                </Link>
              </div>

              {trainees.filter(t => t.batchId === viewingBatch.id).length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  এই ব্যাচে এখনো কোনো শিক্ষার্থী ভর্তি করা হয়নি।
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {trainees.filter(t => t.batchId === viewingBatch.id).map(t => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-800">{t.nameBn || t.nameEn}</span>
                        <span className="text-slate-400 font-mono text-[11px] ml-2">({t.traineeId})</span>
                        <span className="text-[11px] text-slate-500 block">{t.mobileNumber || 'মোবাইল নেই'} • {t.gender === 'Female' ? 'মহিলা' : 'পুরুষ'}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        t.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.status || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions in View Drawer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Link
                  to="/attendance"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <CalendarCheck size={14} />
                  <span>দৈনিক হাজিরা</span>
                </Link>
                <Link
                  to="/attendance-sheet"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <CalendarDays size={14} />
                  <span>মাসিক শিট</span>
                </Link>
              </div>

              <button
                onClick={() => setViewingBatch(null)}
                className="px-4 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. SAFE LIFECYCLE MODAL (ARCHIVE / CANCEL WORKFLOW)      */}
      {/* ======================================================== */}
      {safeLifecycleBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  ব্যাচটি স্থায়ীভাবে মুছে ফেলা নিষিদ্ধ (Referenced Batch Protection)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ঐতিহাসিক তথ্য ও শিক্ষার্থী রেকর্ডের অখণ্ডতা রক্ষা নীতি
                </p>
              </div>
              <button 
                onClick={() => setSafeLifecycleBatch(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-950">
              <p className="font-bold">
                "{safeLifecycleBatch.batch.name}" ব্যাচের সাথে নিম্নলিখিত রেকর্ড সংযুক্ত রয়েছে:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>ভর্তিকৃত শিক্ষার্থী: <strong>{toBn(safeLifecycleBatch.traineeCount)} জন</strong></li>
                <li>দৈনিক হাজিরা রেকর্ড: <strong>{toBn(safeLifecycleBatch.attendanceCount)} টি</strong></li>
                {safeLifecycleBatch.examCount > 0 && (
                  <li>পরীক্ষা ও ফলাফল রেকর্ড: <strong>{toBn(safeLifecycleBatch.examCount)} টি</strong></li>
                )}
              </ul>
              <p className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/80">
                ⚠️ এই ব্যাচটি স্থায়ীভাবে মুছে ফেললে সংশ্লিষ্ট সকল শিক্ষার্থীর সনদ ও উপস্থিতির রেকর্ড অকার্যকর হয়ে যাবে।
              </p>
            </div>

            {/* Lifecycle Action Options */}
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-bold text-slate-700">
                নিরাপদ সমাধান নির্বাচন করুন:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLifecycleAction('archive')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    lifecycleAction === 'archive'
                      ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <Archive size={16} className="text-purple-600" />
                    <span>১. আর্কাইভ করুন</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    কোর্স সম্পন্ন বা সংরক্ষণের জন্য। সমস্ত রেকর্ড অক্ষত থাকবে।
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLifecycleAction('cancel')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    lifecycleAction === 'cancel'
                      ? 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-600/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <Ban size={16} className="text-red-600" />
                    <span>২. ব্যাচ বাতিল করুন</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    অনিবার্য কারণে কার্যক্রম স্থগিত। কারণ অডিট লগে জমা থাকবে।
                  </span>
                </button>
              </div>

              {lifecycleAction === 'cancel' && (
                <div className="mt-2 space-y-1 animate-fadeIn">
                  <label className="block text-xs font-bold text-red-700">
                    বাতিলকরণের কারণ (আবশ্যক) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="যেমন: বাজেট বরাদ্দ স্থগিত / পর্যাপ্ত শিক্ষার্থী না থাকায় স্থগিত..."
                    value={cancellationReason}
                    onChange={e => setCancellationReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleForceDeleteBatch}
                disabled={!isDeletionAllowed}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 ${
                  !isDeletionAllowed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={!isDeletionAllowed ? 'সেটিংস থেকে ডাটা ডিলিট বন্ধ রাখা হয়েছে 🔒' : 'ব্যাচ ও সকল ডাটা স্থায়ীভাবে মুছে ফেলুন'}
              >
                <Trash2 size={13} />
                <span>{isDeletionAllowed ? 'স্থায়ীভাবে ব্যাচ ও সকল ডাটা মুছুন (Hard Delete)' : 'ডিলিট লক 🔒'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSafeLifecycleBatch(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLifecycleAction}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition ${
                    lifecycleAction === 'archive'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {lifecycleAction === 'archive' ? 'আর্কাইভ নিশ্চিত করুন' : 'বাতিল নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. CREATE / EDIT BATCH MODAL                             */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingBatch ? 'ব্যাচ তথ্য সম্পাদন (Edit Batch)' : 'নতুন প্রশিক্ষণ ব্যাচ তৈরি (New Batch)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  BNFE কেন্দ্র ও ট্রেড অনুযায়ী ব্যাচের সময়সূচি ও আসন নির্ধারণ করুন
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start space-x-2 animate-fadeIn">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{duplicateWarning}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Batch Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ব্যাচের নাম *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: কম্পিউটার ১ম ব্যাচ (জানু-জুন ২০২৬)"
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

              {/* Batch Code & Fiscal Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      ব্যাচ কোড *
                    </label>
                    {!editingBatch && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, batchCode: generateSafeNextBatchCode(batches) })}
                        className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center space-x-0.5"
                      >
                        <Sparkles size={11} />
                        <span>অটো-জেনারেট</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: BAT-01"
                    value={formData.batchCode}
                    onChange={e => {
                      setFormData({ ...formData, batchCode: e.target.value });
                      if (formErrors.batchCode) setFormErrors({ ...formErrors, batchCode: '' });
                    }}
                    className={`w-full px-3.5 py-2.5 border font-mono font-bold rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase transition ${
                      formErrors.batchCode ? 'border-red-400 bg-red-50/40 text-red-900' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.batchCode && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} />
                      <span>{formErrors.batchCode}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    অর্থবছর *
                  </label>
                  <select
                    value={formData.fiscalYear}
                    onChange={e => {
                      setFormData({ ...formData, fiscalYear: e.target.value });
                      checkForDuplicates(formData.instituteId, formData.tradeId, e.target.value, formData.startDate, formData.endDate, editingBatch?.id);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {FISCAL_YEARS.map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Training Center / Institute */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান) *
                </label>
                <select
                  required
                  value={formData.instituteId}
                  onChange={e => {
                    const instId = e.target.value;
                    setFormData({ ...formData, instituteId: instId });
                    checkForDuplicates(instId, formData.tradeId, formData.fiscalYear, formData.startDate, formData.endDate, editingBatch?.id);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- প্রতিষ্ঠান নির্বাচন করুন --</option>
                  {institutes.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.code || i.id})</option>
                  ))}
                </select>
                {formErrors.instituteId && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.instituteId}</span>
                  </p>
                )}
              </div>

              {/* Vocational Trade */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বৃত্তিমূলক ট্রেড নির্বাচন *
                </label>
                <select
                  required
                  value={formData.tradeId}
                  onChange={e => {
                    const trdId = e.target.value;
                    setFormData({ ...formData, tradeId: trdId });
                    checkForDuplicates(formData.instituteId, trdId, formData.fiscalYear, formData.startDate, formData.endDate, editingBatch?.id);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- ট্রেড নির্বাচন করুন --</option>
                  {trades.map(t => {
                    const isInactive = t.status === 'Inactive';
                    const isCurrent = editingBatch && editingBatch.tradeId === t.id;
                    return (
                      <option 
                        key={t.id} 
                        value={t.id}
                        disabled={isInactive && !isCurrent}
                      >
                        {t.name} ({t.code}){isInactive ? ' - [নিষ্ক্রিয়: নতুন ব্যাচে বরাদ্দ অযোগ্য]' : ''}
                      </option>
                    );
                  })}
                </select>
                {formErrors.tradeId && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>{formErrors.tradeId}</span>
                  </p>
                )}
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কোর্স শুরুর তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => {
                      const sDate = e.target.value;
                      setFormData({ ...formData, startDate: sDate });
                      checkForDuplicates(formData.instituteId, formData.tradeId, formData.fiscalYear, sDate, formData.endDate, editingBatch?.id);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {formErrors.startDate && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">
                      {formErrors.startDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কোর্স সমাপ্তির তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => {
                      const eDate = e.target.value;
                      setFormData({ ...formData, endDate: eDate });
                      checkForDuplicates(formData.instituteId, formData.tradeId, formData.fiscalYear, formData.startDate, eDate, editingBatch?.id);
                    }}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      formErrors.endDate ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.endDate && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">
                      {formErrors.endDate}
                    </p>
                  )}
                </div>
              </div>

              {/* Seat Capacity & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    সর্বোচ্চ আসন সংখ্যা (Capacity) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    required
                    value={formData.maxTrainees}
                    onChange={e => setFormData({ ...formData, maxTrainees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">BNFE মানদণ্ড: ৩০ জন শিক্ষার্থী প্রতি ব্যাচ</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ব্যাচের বর্তমান অবস্থা (Status) *
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Active">চলমান (Active)</option>
                    <option value="Upcoming">আসন্ন (Upcoming)</option>
                    <option value="Completed">সম্পন্ন (Completed)</option>
                    <option value="Archived">আর্কাইভকৃত (Archived)</option>
                    <option value="Cancelled">বাতিলকৃত (Cancelled)</option>
                  </select>
                </div>
              </div>

              {/* Modal Action Buttons */}
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
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : editingBatch ? 'আপডেট সংরক্ষণ করুন' : 'ব্যাচ তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;
