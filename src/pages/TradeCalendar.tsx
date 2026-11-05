import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  BookOpen, 
  Plus, 
  FolderOpen, 
  Download, 
  Trash2, 
  Edit3, 
  Search, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles,
  Info,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Check,
  AlertTriangle,
  X
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trade, Batch } from '../types';
import { TradeSkillModule, TradeLiteracyModule } from '../types/calendar';
import { SHIKHON_COURSE_INFO, SHIKHON_PHASES } from '../data/shikhonCalendarData';
import { dataService } from '../lib/dataService';
import { toBn } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import ModuleInputModal from '../components/ModuleInputModal';
import ModuleBulkImportModal from '../components/ModuleBulkImportModal';

const TradeCalendar: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission, isCourseDirector } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Active sub-tab: 'skill' | 'literacy'
  const [activeTab, setActiveTab] = useState<'skill' | 'literacy'>('skill');

  // Modules list for the selected trade
  const [skillModules, setSkillModules] = useState<TradeSkillModule[]>([]);
  const [literacyModules, setLiteracyModules] = useState<TradeLiteracyModule[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [singleModalType, setSingleModalType] = useState<'skill' | 'literacy'>('skill');
  const [editingModule, setEditingModule] = useState<TradeSkillModule | TradeLiteracyModule | null>(null);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalType, setBulkModalType] = useState<'skill' | 'literacy'>('skill');

  // Custom in-app Confirmation Modal States (eliminates browser alert/confirm)
  const [deletingModule, setDeletingModule] = useState<{
    id: string;
    type: 'skill' | 'literacy';
    dayNumber: number;
    moduleName?: string;
    topic?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const canManage = isCourseDirector || userProfile?.role === 'FMA' || hasPermission('edit_trade') || hasPermission('update_shikhon_calendar');

  // Load trades and batches
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [tradesList, batchesList] = await Promise.all([
          dataService.getItems<Trade>('trades'),
          dataService.getItems<Batch>('batches')
        ]);
        setTrades(tradesList);
        setBatches(batchesList);

        const paramTradeId = searchParams.get('tradeId');
        if (paramTradeId && tradesList.some(t => t.id === paramTradeId)) {
          setSelectedTradeId(paramTradeId);
        } else if (tradesList.length > 0) {
          setSelectedTradeId(tradesList[0].id);
        }
      } catch (err) {
        console.error("Failed to load trades:", err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Sync tradeId to searchParams
  useEffect(() => {
    if (selectedTradeId) {
      setSearchParams({ tradeId: selectedTradeId });
      loadTradeModules(selectedTradeId);
    }
  }, [selectedTradeId]);

  const loadTradeModules = async (tradeId: string) => {
    if (!tradeId) return;
    setModulesLoading(true);
    try {
      const [skills, literacy] = await Promise.all([
        dataService.getTradeSkillModules(tradeId),
        dataService.getTradeLiteracyModules(tradeId)
      ]);
      setSkillModules(skills);
      setLiteracyModules(literacy);
    } catch (err) {
      console.warn("Error loading trade modules:", err);
    } finally {
      setModulesLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4500);
  };

  const selectedTrade = useMemo(() => {
    return trades.find(t => t.id === selectedTradeId) || trades[0] || null;
  }, [trades, selectedTradeId]);

  const tradeBatches = useMemo(() => {
    return batches.filter(b => b.tradeId === selectedTradeId);
  }, [batches, selectedTradeId]);

  // Dynamic phase groups from the actual trade's skill modules in database
  const availablePhases = useMemo(() => {
    const set = new Set<string>();
    skillModules.forEach(m => {
      if (m.phaseGroup && m.phaseGroup.trim()) set.add(m.phaseGroup.trim());
    });
    return Array.from(set);
  }, [skillModules]);

  // Dynamic categories from literacy modules
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    literacyModules.forEach(m => {
      if (m.category && m.category.trim()) set.add(m.category.trim());
    });
    return Array.from(set);
  }, [literacyModules]);

  // Filtered Skill Modules
  const filteredSkillModules = useMemo(() => {
    return skillModules.filter(m => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTopic = m.topic?.toLowerCase().includes(q);
        const matchName = m.moduleName?.toLowerCase().includes(q);
        const matchTask = m.taskNo?.toLowerCase().includes(q);
        const matchDay = m.dayNumber.toString().includes(q) || toBn(m.dayNumber).includes(q);
        if (!matchTopic && !matchName && !matchTask && !matchDay) return false;
      }
      if (selectedPhase !== 'all' && m.phaseGroup !== selectedPhase) {
        return false;
      }
      return true;
    }).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [skillModules, searchQuery, selectedPhase]);

  // Filtered Literacy Modules
  const filteredLiteracyModules = useMemo(() => {
    return literacyModules.filter(m => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTopic = m.topic?.toLowerCase().includes(q);
        const matchName = m.moduleName?.toLowerCase().includes(q);
        const matchTask = m.taskNo?.toLowerCase().includes(q);
        const matchDay = m.dayNumber.toString().includes(q) || toBn(m.dayNumber).includes(q);
        if (!matchTopic && !matchName && !matchTask && !matchDay) return false;
      }
      if (selectedCategory !== 'all' && m.category !== selectedCategory) {
        return false;
      }
      return true;
    }).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [literacyModules, searchQuery, selectedCategory]);

  // Download Demo CSV
  const downloadDemoCSV = (type: 'skill' | 'literacy') => {
    if (type === 'skill') {
      const csvHeader = "dayNumber,moduleName,taskNo,topic,theoryMinutes,practicalMinutes,phaseGroup,toolsRequired,notes\n";
      const sampleRows = [
        `1,টুলস পরিচিতি,কাজ ০১,সৌন্দর্য চর্চায় ব্যবহৃত বিভিন্ন যন্ত্রপাতি ও উপকরণের পরিচিতি,৫০,৭০,টুলস ও বিউটি কেয়ার,কাঁচি চিরুনি ট্রিমার,প্রাথমিক নিরাপত্তা নির্দেশনা`,
        `2,টুলস জীবাণুমুক্তকরণ,কাজ ০২,যন্ত্রপাতি পরিষ্কার ও স্বাস্থ্যসম্মতভাবে জীবাণুমুক্তকরণ পদ্ধতি,৪০,৮০,টুলস ও বিউটি কেয়ার,স্টেরিলাইজার ড্রপস অ্যালকোহল,পরিচ্ছন্নতার গুরুত্ব`,
        `3,স্কিন টাইপ বিশ্লেষণ,কাজ ০৩,ত্বকের প্রকারভেদ নির্ণয় ও ক্লায়েন্ট কাউন্সেলিং,৬০,৬০,স্কিন কেয়ার,ম্যাগনিফাইং গ্লাস কটন স্কিন অ্যানালাইজার,সঠিক পরামর্শ প্রদান`
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `trade_${selectedTrade?.code || 'sample'}_demo_skill_modules.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const csvHeader = "dayNumber,moduleName,taskNo,topic,startTime,endTime,totalMinutes,category,notes\n";
      const sampleRows = [
        `1,মৌলিক বাংলা দক্ষতা,কাজ ০১,দৈনন্দিন যোগাযোগে প্রমিত ও শুদ্ধ বাংলা ভাষার ব্যবহার,০৯:০০,১১:০০,120,বাংলা,মৌখিক অনুশীলন`,
        `2,গাণিতিক দক্ষতা,কাজ ০২,ব্যাবহারিক হিসাব-নিকাশ যোগ বিয়োগ ও পরিমাপ পদ্ধতি,০৯:০০,১১:০০,120,গণিত,ব্যবসায়িক হিসাব`,
        `3,মৌলিক ইংরেজি,কাজ ০৩,ক্লায়েন্টদের সাথে অভ্যর্থনা ও সাধারণ ইংরেজি শিষ্টাচার,০৯:০০,১১:০০,120,ইংরেজি,স্পোকেন ড্রিল`
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `trade_${selectedTrade?.code || 'sample'}_demo_literacy_modules.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Request single module delete
  const handleRequestDeleteModule = (item: TradeSkillModule | TradeLiteracyModule, type: 'skill' | 'literacy') => {
    setDeletingModule({
      id: item.id,
      type,
      dayNumber: item.dayNumber,
      moduleName: item.moduleName,
      topic: item.topic
    });
  };

  // Confirm delete single module
  const handleConfirmDelete = async () => {
    if (!deletingModule || !selectedTradeId) return;
    setIsDeleting(true);
    try {
      if (deletingModule.type === 'skill') {
        await dataService.deleteTradeSkillModule(deletingModule.id, selectedTradeId);
        await loadTradeModules(selectedTradeId);
        showToast(`ক্লাস #${toBn(deletingModule.dayNumber)} স্কিল মডিউল সফলভাবে মুছে ফেলা হয়েছে।`);
      } else {
        await dataService.deleteTradeLiteracyModule(deletingModule.id, selectedTradeId);
        await loadTradeModules(selectedTradeId);
        showToast(`ক্লাস #${toBn(deletingModule.dayNumber)} লিটারেসি মডিউল সফলভাবে মুছে ফেলা হয়েছে।`);
      }
      setDeletingModule(null);
    } catch (e) {
      console.error("Delete error:", e);
      showToast("মডিউল মুছতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirm clear all modules for current trade
  const handleConfirmClearTradeModules = async () => {
    if (!selectedTradeId) return;
    setIsClearing(true);
    try {
      await dataService.clearTradeModules(selectedTradeId);
      await loadTradeModules(selectedTradeId);
      setIsClearModalOpen(false);
      showToast(`"${selectedTrade?.name}" ট্রেডের সকল কারিকুলাম ও মডিউল ডাটা খালি করা হয়েছে।`);
    } catch (e) {
      console.error("Clear modules error:", e);
      showToast("ডাটা খালি করতে সমস্যা হয়েছে।");
    } finally {
      setIsClearing(false);
    }
  };

  // Confirm reset to BNFE defaults
  const handleConfirmReset = async () => {
    if (!selectedTradeId) return;
    setIsResetting(true);
    try {
      const res = await dataService.seedTradeWithDefaultModules(selectedTradeId);
      await loadTradeModules(selectedTradeId);
      setIsResetModalOpen(false);
      showToast(`সফলভাবে "${selectedTrade?.name}" ট্রেডের জন্য ${toBn(res.skillCount)}টি স্কিল ও ${toBn(res.literacyCount)}টি লিটারেসি মডিউল লোড করা হয়েছে!`);
    } catch (e) {
      console.error("Reset error:", e);
      showToast("ডিফল্ট মডিউল লোড ব্যর্থ হয়েছে।");
    } finally {
      setIsResetting(false);
    }
  };

  // Save single module
  const handleSaveSingleModule = async (data: any) => {
    if (singleModalType === 'skill') {
      await dataService.saveTradeSkillModule({ ...data, tradeId: selectedTradeId } as TradeSkillModule);
      await loadTradeModules(selectedTradeId);
      showToast(`স্কিল মডিউল (দিন #${toBn(data.dayNumber)}) সফলভাবে সংরক্ষিত হয়েছে।`);
    } else {
      await dataService.saveTradeLiteracyModule({ ...data, tradeId: selectedTradeId } as TradeLiteracyModule);
      await loadTradeModules(selectedTradeId);
      showToast(`লিটারেসি মডিউল (দিন #${toBn(data.dayNumber)}) সফলভাবে সংরক্ষিত হয়েছে।`);
    }
  };

  // Bulk Save handler
  const handleBulkSave = async (items: any[], replaceExisting: boolean) => {
    if (bulkModalType === 'skill') {
      const count = await dataService.bulkSaveTradeSkillModules(selectedTradeId, items, replaceExisting);
      await loadTradeModules(selectedTradeId);
      return count;
    } else {
      const count = await dataService.bulkSaveTradeLiteracyModules(selectedTradeId, items, replaceExisting);
      await loadTradeModules(selectedTradeId);
      return count;
    }
  };

  // Calculate totals
  const totalSkillHours = (skillModules.reduce((acc, m) => acc + (m.totalMinutes || 0), 0) / 60).toFixed(1);
  const totalLiteracyHours = (literacyModules.reduce((acc, m) => acc + (m.totalMinutes || 0), 0) / 60).toFixed(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs font-semibold animate-in fade-in slide-in-from-bottom-5 duration-300 border border-slate-700">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. PAGE HEADER & REUSABLE CURRICULUM BANNER             */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-emerald-200">
              <Sparkles size={14} className="text-amber-300" />
              <span>ট্রেড ভিত্তিক মাস্টার শিখন কারিকুলাম • Reusable Master Syllabus</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              ট্রেড ভিত্তিক শিখন কারিকুলাম ও ক্যালেন্ডার
            </h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              প্রতিটি বৃত্তিমূলক ট্রেডের ৯২ কার্যদিবসের (৩৬৮ ঘণ্টা) স্বতন্ত্র ও রি-ইউজেবল পাঠ পরিকল্পনা। এখানে সংরক্ষিত মডিউলসমূহ সংশ্লিষ্ট ট্রেডের সকল বর্তমান ও ভবিষ্যৎ ব্যাচের জন্য প্রযোজ্য হবে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/shikhon-calendar"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold transition shadow-sm"
            >
              <Layers size={16} className="text-emerald-700" />
              <span>ব্যাচ ভিত্তিক ক্যালেন্ডার দেখুন</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TRADE SELECTOR CARD & REUSABILITY EXPLANATION        */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wrench size={14} className="text-emerald-600" />
              বৃত্তিমূলক ট্রেড নির্বাচন (Select Trade)
            </span>
            <p className="text-xs text-slate-500">
              যে ট্রেডের কারিকুলাম দেখতে বা পরিবর্তন করতে চান তা নির্বাচন করুন:
            </p>
          </div>

          <div className="w-full md:w-96">
            <select
              value={selectedTradeId}
              onChange={(e) => setSelectedTradeId(e.target.value)}
              className="w-full bg-slate-50 border-2 border-emerald-500/40 rounded-xl p-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}) - {t.duration || '৬ মাস'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Trade Overview & Reusability Note */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <ShieldCheck size={18} />
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-bold text-emerald-900 text-sm">
                রি-ইউজেবল কারিকুলাম নীতি ({selectedTrade?.name})
              </p>
              <p className="leading-relaxed">
                এই ট্রেডের জন্য সংরক্ষিত <strong>{toBn(skillModules.length)}টি স্কিল</strong> ও <strong>{toBn(literacyModules.length)}টি লিটারেসি</strong> মডিউল এই ট্রেডের অন্তর্ভুক্ত <strong>{toBn(tradeBatches.length)}টি ব্যাচে</strong> স্বয়ংক্রিয়ভাবে সক্রিয় রয়েছে। নতুন কোনো ব্যাচ তৈরি হলে তারাও তাৎক্ষণিকভাবে এই কারিকুলামটি পাবে।
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="md:col-span-4 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="block text-[11px] text-slate-500 font-medium">অন্তর্ভুক্ত ব্যাচ</span>
              <span className="text-lg font-extrabold text-slate-900">{toBn(tradeBatches.length)}টি ব্যাচ</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="block text-[11px] text-slate-500 font-medium">মোট কোর্স সময়</span>
              <span className="text-lg font-extrabold text-emerald-700">৩৬৮ ঘণ্টা</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. TABS NAVIGATION & ACTIONS BAR                        */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('skill')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'skill'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Wrench size={16} />
            <span>স্কিল ফোকাসড মডিউল ({toBn(skillModules.length)})</span>
          </button>

          <button
            onClick={() => setActiveTab('literacy')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'literacy'
                ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen size={16} />
            <span>লিটারেসি ও জীবন-দক্ষতা মডিউল ({toBn(literacyModules.length)})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                onClick={() => setIsClearModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                title="এই ট্রেডের সকল মডিউল তালিকা সম্পূর্ণ খালি করুন যাতে নতুন করে ইনপুট দেওয়া যায়"
              >
                <Trash2 size={14} className="text-rose-600" />
                <span>সকল মডিউল খালি করুন</span>
              </button>

              <button
                onClick={() => setIsResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                title="সরকারি BNFE স্ট্যান্ডার্ড সিলেবাস রিস্টোর করুন"
              >
                <RotateCcw size={14} />
                <span>ডিফল্ট সিলেবাস রিস্টোর</span>
              </button>
            </>
          )}

          <button
            onClick={() => downloadDemoCSV(activeTab)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition"
            title="বাল্ক ইনপুটের নমুনা ডেমো ফাইল"
          >
            <Download size={14} className="text-amber-700" />
            <span>ডেমো ফাইল (.csv)</span>
          </button>

          {canManage && (
            <>
              <button
                onClick={() => {
                  setBulkModalType(activeTab);
                  setIsBulkModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
              >
                <FolderOpen size={14} />
                <span>বাল্ক ইনপুট (CSV)</span>
              </button>

              <button
                onClick={() => {
                  setSingleModalType(activeTab);
                  setEditingModule(null);
                  setIsSingleModalOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition shadow-xs ${
                  activeTab === 'skill' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                <Plus size={15} />
                <span>+ নতুন {activeTab === 'skill' ? 'স্কিল' : 'লিটারেসি'} মডিউল</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. SEARCH & FILTER BAR                                  */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="বিষয়, কাজ বা মডিউল খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {activeTab === 'skill' ? (
          <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">বিভাগ:</span>
            <button
              onClick={() => setSelectedPhase('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedPhase === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              সকল বিভাগ ({toBn(skillModules.length)})
            </button>
            {availablePhases.map((p) => {
              const count = skillModules.filter(m => m.phaseGroup === p).length;
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPhase(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedPhase === p
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {p} ({toBn(count)})
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">বিষয়:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              সকল বিষয় ({toBn(literacyModules.length)})
            </button>
            {availableCategories.map((c) => {
              const count = literacyModules.filter(m => m.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === c
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {c} ({toBn(count)})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. TABLE: SKILL MODULES (FOR SELECTED TRADE)            */}
      {/* ======================================================== */}
      {activeTab === 'skill' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="font-bold text-slate-800">
              {selectedTrade?.name} • স্কিল মডিউল তালিকা ({toBn(filteredSkillModules.length)}টি দেখানো হচ্ছে)
            </span>
            <span>মোট স্কিল সময়: <strong className="text-emerald-700">{toBn(totalSkillHours)} ঘণ্টা</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <th className="py-3 px-3 w-16 text-center">দিন #</th>
                  <th className="py-3 px-3 w-24 text-center">কাজ নং</th>
                  <th className="py-3 px-4 min-w-[180px]">মডিউলের নাম ও বিভাগ</th>
                  <th className="py-3 px-4 min-w-[240px]">পঠিত বিষয় / শিখন ফল (Topic)</th>
                  <th className="py-3 px-3 text-center">তাত্ত্বিক</th>
                  <th className="py-3 px-3 text-center">ব্যবহারিক</th>
                  <th className="py-3 px-3 text-center">মোট সময়</th>
                  <th className="py-3 px-4 min-w-[160px]">প্রয়োজনীয় উপকরণ</th>
                  <th className="py-3 px-3 w-24 text-center">একশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {modulesLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      মডিউল লোড করা হচ্ছে...
                    </td>
                  </tr>
                ) : filteredSkillModules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      এই ট্রেডের জন্য কোনো স্কিল মডিউল পাওয়া যায়নি। "+ নতুন স্কিল মডিউল" বা "ডিফল্ট সিলেবাস রিস্টোর" বাটনে ক্লিক করুন।
                    </td>
                  </tr>
                ) : (
                  filteredSkillModules.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        {toBn(item.dayNumber)}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-emerald-800 bg-emerald-50/50">
                        {item.taskNo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{item.moduleName}</span>
                        <span className="text-[10px] text-slate-500">{item.phaseGroup || 'সাধারণ'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{item.topic}</p>
                        {item.notes && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">নোট: {item.notes}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{toBn(item.theoryMinutes)} মি.</td>
                      <td className="py-3 px-3 text-center font-medium text-emerald-700">{toBn(item.practicalMinutes)} মি.</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{toBn(item.totalMinutes)} মি.</td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {item.toolsRequired || '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {canManage ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setSingleModalType('skill');
                                setEditingModule(item);
                                setIsSingleModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="সম্পাদনা করুন"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleRequestDeleteModule(item, 'skill')}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">লকড</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. TABLE: LITERACY MODULES (FOR SELECTED TRADE)         */}
      {/* ======================================================== */}
      {activeTab === 'literacy' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="font-bold text-slate-800">
              {selectedTrade?.name} • লিটারেসি ও জীবন-দক্ষতা মডিউল তালিকা ({toBn(filteredLiteracyModules.length)}টি দেখানো হচ্ছে)
            </span>
            <span>মোট লিটারেসি সময়: <strong className="text-blue-700">{toBn(totalLiteracyHours)} ঘণ্টা</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <th className="py-3 px-3 w-16 text-center">দিন #</th>
                  <th className="py-3 px-3 w-24 text-center">কাজ নং</th>
                  <th className="py-3 px-4 min-w-[180px]">মডিউল ও বিষয় বিভাগ</th>
                  <th className="py-3 px-4 min-w-[240px]">পঠিত বিষয় / পাঠ শিরোনাম (Topic)</th>
                  <th className="py-3 px-3 text-center">সময়সূচি (শুরু - শেষ)</th>
                  <th className="py-3 px-3 text-center">মোট সময়</th>
                  <th className="py-3 px-4 min-w-[160px]">বিশেষ নির্দেশনা / নোট</th>
                  <th className="py-3 px-3 w-24 text-center">একশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {modulesLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      মডিউল লোড করা হচ্ছে...
                    </td>
                  </tr>
                ) : filteredLiteracyModules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      এই ট্রেডের জন্য কোনো লিটারেসি মডিউল পাওয়া যায়নি। "+ নতুন লিটারেসি মডিউল" বা "ডিফল্ট সিলেবাস রিস্টোর" বাটনে ক্লিক করুন।
                    </td>
                  </tr>
                ) : (
                  filteredLiteracyModules.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        {toBn(item.dayNumber)}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-blue-800 bg-blue-50/50">
                        {item.taskNo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{item.moduleName}</span>
                        <span className="text-[10px] text-blue-700">{item.category || 'বাংলা'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{item.topic}</p>
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{item.startTime} - {item.endTime}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{toBn(item.totalMinutes)} মি.</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {item.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {canManage ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setSingleModalType('literacy');
                                setEditingModule(item);
                                setIsSingleModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                              title="সম্পাদনা করুন"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleRequestDeleteModule(item, 'literacy')}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">লকড</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. MODALS                                                */}
      {/* ======================================================== */}
      <ModuleBulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        batchId={selectedTradeId}
        batchName={selectedTrade?.name || 'ট্রেড কারিকুলাম'}
        moduleType={bulkModalType}
        onImportSuccess={async (count: number) => {
          await loadTradeModules(selectedTradeId);
          showToast(`সফলভাবে ${toBn(count)}টি ${bulkModalType === 'skill' ? 'স্কিল' : 'লিটারেসি'} মডিউল আমদানি করা হয়েছে!`);
        }}
        onBulkSave={handleBulkSave}
      />

      <ModuleInputModal
        isOpen={isSingleModalOpen}
        onClose={() => {
          setIsSingleModalOpen(false);
          setEditingModule(null);
        }}
        batchId={selectedTradeId}
        batchName={selectedTrade?.name || 'ট্রেড কারিকুলাম'}
        moduleType={singleModalType}
        initialData={editingModule as any}
        onSave={handleSaveSingleModule}
      />

      {/* 7.1 Single Module Delete Confirmation Modal */}
      {deletingModule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                মডিউল মুছে ফেলার নিশ্চয়তা
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                আপনি কি নিশ্চিত যে আপনি এই মডিউলটি স্থায়ীভাবে মুছে ফেলতে চান?
              </p>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>ধরণ:</span>
                  <span className="font-semibold text-slate-700">
                    {deletingModule.type === 'skill' ? 'স্কিল ফোকাসড মডিউল' : 'লিটারেসি ও জীবন-দক্ষতা মডিউল'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>ক্লাস দিবস:</span>
                  <span className="font-bold text-slate-900">দিন #{toBn(deletingModule.dayNumber)}</span>
                </div>
                {deletingModule.moduleName && (
                  <div className="flex items-start justify-between text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>মডিউল:</span>
                    <span className="font-semibold text-slate-800 text-right max-w-[220px]">{deletingModule.moduleName}</span>
                  </div>
                )}
                {deletingModule.topic && (
                  <div className="flex items-start justify-between text-slate-500 pt-1">
                    <span>পাঠ / বিষয়:</span>
                    <span className="text-slate-700 text-right max-w-[220px]">{deletingModule.topic}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingModule(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছে ফেলুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7.2 Clear All Modules for Trade Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                সকল মডিউল ডাটা খালি করার নিশ্চয়তা
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                আপনি <strong>"{selectedTrade?.name}"</strong> ট্রেডের জন্য বর্তমানের সকল স্কিল ও লিটারেসি মডিউল সম্পূর্ণ মুছে ফেলতে যাচ্ছেন। এরপর টেবিলটি খালি থাকবে যাতে আপনি নতুন করে একক বা বাল্ক CSV ইনপুট দিতে পারেন।
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 mb-5 flex items-start space-x-2">
                <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <span>
                  বর্তমানে মোট {toBn(skillModules.length)}টি স্কিল ও {toBn(literacyModules.length)}টি লিটারেসি মডিউল মুছে যাবে।
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleConfirmClearTradeModules}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  <Trash2 size={14} />
                  <span>{isClearing ? 'ডাটা খালি করা হচ্ছে...' : 'হ্যাঁ, সকল মডিউল খালি করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7.3 Reset Defaults Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                <RotateCcw size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                ডিফল্ট BNFE সিলেবাস রিস্টোর
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                আপনি কি <strong>"{selectedTrade?.name}"</strong> ট্রেডের জন্য সরকারি BNFE স্ট্যান্ডার্ড ৯২ কার্যদিবসের আদর্শ কারিকুলাম ও মডিউলসমূহ লোড করতে চান?
              </p>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleConfirmReset}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  <RotateCcw size={14} />
                  <span>{isResetting ? 'লোড করা হচ্ছে...' : 'হ্যাঁ, রিস্টোর করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeCalendar;
