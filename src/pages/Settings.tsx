import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, logActivity } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { 
  Settings as SettingsIcon, 
  Database, 
  AlertTriangle, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Shield, 
  Sliders, 
  Save,
  Sparkles,
  Navigation,
  Lock,
  Unlock,
  AlertOctagon,
  RefreshCw,
  Users,
  FileCheck2,
  CalendarCheck,
  Building2,
  BookOpen,
  Wrench,
  Layers,
  Info
} from 'lucide-react';
import { ActivityLog, Institute, Trade, Batch, Trainee, AttendanceRecord, Exam, ExamMark } from '../types';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const Settings: React.FC = () => {
  const { userProfile } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const { roles, setRoleLandingRoute } = usePermissions();
  const [savingLandingRoleId, setSavingLandingRoleId] = useState<string | null>(null);
  const [landingSavedNotice, setLandingSavedNotice] = useState('');

  // System Settings Hook
  const { 
    settings, 
    isDeletionAllowed, 
    toggleDataDeletion, 
    updateSettings, 
    deleteAllAttendance, 
    deleteAllTrainees, 
    deleteAllExamsAndMarks, 
    deleteAllInstitutes,
    deleteAllTrades,
    deleteAllBatches,
    purgeAllSystemData 
  } = useSystemSettings();

  // Settings configuration state
  const [minAttendance, setMinAttendance] = useState(settings.minAttendancePercentForCert || 75);
  const [minPassMarks, setMinPassMarks] = useState(settings.passMarkPercent || 40);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [togglingDeletion, setTogglingDeletion] = useState(false);

  // Live Counts & Stats
  const [counts, setCounts] = useState<{
    attendance: number;
    trainees: number;
    exams: number;
    marks: number;
    batches: number;
    institutes: number;
    trades: number;
  }>({
    attendance: 0,
    trainees: 0,
    exams: 0,
    marks: 0,
    batches: 0,
    institutes: 0,
    trades: 0
  });
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Deletion Modals State
  const [activeModal, setActiveModal] = useState<
    'attendance' | 'trainees' | 'exams' | 'institutes' | 'trades' | 'batches' | 'factory_reset' | null
  >(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [keepInstitutesAndTrades, setKeepInstitutesAndTrades] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCourseDirector = userProfile?.role === 'Course Director';

  useEffect(() => {
    fetchLogs();
    fetchCounts();
  }, []);

  useEffect(() => {
    if (settings) {
      setMinAttendance(settings.minAttendancePercentForCert || 75);
      setMinPassMarks(settings.passMarkPercent || 40);
    }
  }, [settings]);

  const fetchCounts = async () => {
    setLoadingCounts(true);
    try {
      const [att, trn, exm, mrk, btc, inst, trd] = await Promise.all([
        dataService.getItems<AttendanceRecord>('attendance'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<Exam>('exams'),
        dataService.getItems<ExamMark>('marks'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades')
      ]);
      setCounts({
        attendance: att.length,
        trainees: trn.length,
        exams: exm.length,
        marks: mrk.length,
        batches: btc.length,
        institutes: inst.length,
        trades: trd.length
      });
    } catch (err) {
      console.warn("Could not fetch counts:", err);
    } finally {
      setLoadingCounts(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(25));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
      setActivityLogs(list);
    } catch (err) {
      console.warn("Could not fetch activity logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleLandingRouteChange = async (roleId: string, route: string) => {
    setSavingLandingRoleId(roleId);
    try {
      await setRoleLandingRoute(roleId, route);
      setLandingSavedNotice('ডিফল্ট ল্যান্ডিং পেজ সফলভাবে আপডেট করা হয়েছে!');
      setTimeout(() => setLandingSavedNotice(''), 3000);
    } catch (e: any) {
      console.warn("Could not update role landing route:", e);
    } finally {
      setSavingLandingRoleId(null);
    }
  };

  const handleToggleDeletion = async () => {
    setTogglingDeletion(true);
    setErrorMessage('');
    try {
      const newState = !isDeletionAllowed;
      await toggleDataDeletion(newState);
      setStatusMessage(
        newState 
          ? 'সিস্টেম ডাটা ডিলিট অনুমতি চালু করা হয়েছে (Deletion Enabled)। এখন অনুমোদিত ব্যবহারকারীরা ডাটা মুছতে পারবেন।'
          : 'সিস্টেম ডাটা ডিলিট বন্ধ করা হয়েছে (Deletion Locked)। দুর্ঘটনা এড়াতে সকল ডিলিট একশন লক থাকবে।'
      );
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'ডিলিট সেটিংস পরিবর্তনে ত্রুটি হয়েছে');
    } finally {
      setTogglingDeletion(false);
    }
  };

  const handleExecuteAttendanceDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const count = await deleteAllAttendance();
      setStatusMessage(`সকল দৈনিক হাজিরা রেকর্ড সফলভাবে মুছে ফেলা হয়েছে (মোট ${count}টি রেকর্ড)।`);
      setActiveModal(null);
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'হাজিরা ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteTraineesDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const res = await deleteAllTrainees({ deleteAttendanceToo: true });
      setStatusMessage(`সকল প্রশিক্ষণার্থী (${res.deletedTrainees} জন) ও তাদের হাজিরা (${res.deletedAttendance}টি) মুছে ফেলা হয়েছে।`);
      setActiveModal(null);
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'প্রশিক্ষণার্থী ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteExamsDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const res = await deleteAllExamsAndMarks();
      setStatusMessage(`সকল পরীক্ষা (${res.deletedExams}টি) ও ফলাফল নম্বর (${res.deletedMarks}টি) মুছে ফেলা হয়েছে।`);
      setActiveModal(null);
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'পরীক্ষা ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteInstitutesDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const count = await deleteAllInstitutes();
      setStatusMessage(`সকল প্রতিষ্ঠান সফলভাবে মুছে ফেলা হয়েছে (মোট ${count}টি প্রতিষ্ঠান)।`);
      setActiveModal(null);
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'প্রতিষ্ঠান ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteTradesDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const count = await deleteAllTrades();
      setStatusMessage(`সকল ট্রেড সফলভাবে মুছে ফেলা হয়েছে (মোট ${count}টি ট্রেড)।`);
      setActiveModal(null);
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'ট্রেড ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteBatchesDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const count = await deleteAllBatches();
      setStatusMessage(`সকল ব্যাচ সফলভাবে মুছে ফেলা হয়েছে (মোট ${count}টি ব্যাচ)।`);
      setActiveModal(null);
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'ব্যাচ ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteFactoryReset = async () => {
    if (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim() !== 'নিশ্চিত') {
      setErrorMessage('অনুগ্রহ করে নিশ্চিত করতে বক্সে "DELETE" অথবা "নিশ্চিত" টাইপ করুন।');
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');
    try {
      await purgeAllSystemData({ 
        keepInstitutesAndTrades,
        keepLogs: false
      });
      setStatusMessage('সিস্টেম ফ্যাক্টরি রিসেট সফল হয়েছে! সমস্ত নির্বাচিত ডাটা মুছে প্রোডাকশন-রেডি ফ্রেশ স্টেট তৈরি হয়েছে।');
      setActiveModal(null);
      setDeleteConfirmationInput('');
      await fetchCounts();
      await fetchLogs();
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'সিস্টেম রিসেট ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetLocalCache = () => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে সমস্ত লোকাল ক্যাশ ডেটা মুছে ফ্রেশ শুরু করতে চান?")) {
      return;
    }
    dataService.clearAllLocalData();
    setStatusMessage('লোকাল ব্রাউজার ক্যাশ সফলভাবে রিসেট করা হয়েছে। পৃষ্ঠাটি রিফ্রেশ হচ্ছে...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const saveSettings = async () => {
    try {
      await updateSettings({
        minAttendancePercentForCert: minAttendance,
        passMarkPercent: minPassMarks
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (e: any) {
      setErrorMessage("সেটিংস সংরক্ষণে সমস্যা হয়েছে: " + e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">সিস্টেম সেটিংস ও ডাটা নিয়ন্ত্রণ (Settings & Data Control)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          সিস্টেমের প্রয়োজনীয় কনফিগারেশন, ডাটা ডিলিট পারমিশন ও ফ্যাক্টরি রিসেট পরিচালনা করুন
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center space-x-2.5 shadow-xs">
          <AlertOctagon size={18} className="text-red-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. DATA DELETION PERMISSION SWITCH (SEETINGS CONTROL)   */}
      {/* ======================================================== */}
      <div className={`p-6 sm:p-7 rounded-2xl border transition-all shadow-xs ${
        isDeletionAllowed 
          ? 'bg-amber-50/40 border-amber-200' 
          : 'bg-emerald-50/40 border-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isDeletionAllowed 
                ? 'bg-amber-100 text-amber-700 border-amber-300' 
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}>
              {isDeletionAllowed ? <Unlock size={24} /> : <Lock size={24} />}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-slate-800">
                  সিস্টেম ডাটা ডিলিট নিয়ন্ত্রণ (Data Deletion Control)
                </h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  isDeletionAllowed 
                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}>
                  {isDeletionAllowed ? 'ডিলিট সক্রিয় (Unlocked)' : 'ডিলিট বন্ধ/সুরক্ষিত (Locked)'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                {isDeletionAllowed 
                  ? 'বর্তমানে সিস্টেমে ডাটা ডিলিট সুবিধা সক্রিয় রয়েছে। দুর্ঘটনা এড়াতে অথবা ডাটা মুছে ফেলা বন্ধ রাখতে চাইলে নিচের সুইচটি বন্ধ করে রাখুন।' 
                  : 'সিস্টেমের সমস্ত ডাটা মুছে ফেলা বর্তমানে সম্পূর্ণ বন্ধ ও লক করা রয়েছে। কোনো ব্যবহারকারী বা অ্যাডমিন ভুলবশত কোনো তথ্য ডিলিট করতে পারবেন না।'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleDeletion}
            disabled={togglingDeletion}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm self-start sm:self-auto shrink-0 ${
              isDeletionAllowed
                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isDeletionAllowed ? (
              <>
                <Lock size={15} />
                <span>{togglingDeletion ? 'লক করা হচ্ছে...' : 'ডিলিট বন্ধ করুন (Lock Deletions)'}</span>
              </>
            ) : (
              <>
                <Unlock size={15} />
                <span>{togglingDeletion ? 'অনুমতি দেওয়া হচ্ছে...' : 'ডিলিট অনুমতি দিন (Unlock Deletions)'}</span>
              </>
            )}
          </button>
        </div>

        {/* Lock warning badge if deletion is off */}
        {!isDeletionAllowed && (
          <div className="mt-4 p-3 rounded-xl bg-white border border-emerald-200/80 text-xs text-emerald-900 flex items-center space-x-2">
            <Shield size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>সুরক্ষা সক্রিয়:</strong> দৈনিক হাজিরা, শিক্ষার্থী, ব্যাচ, প্রতিষ্ঠান সহ সকল ডিলিট বাটন নিষ্ক্রিয় করা আছে।
            </span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. CURRENT DATA METRICS & SUMMARY                       */}
      {/* ======================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Database size={18} className="text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">ক্লাউড ডাটাবেজ স্থিতি (Database Summary)</h3>
          </div>
          <button 
            type="button"
            onClick={fetchCounts}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
          >
            <RefreshCw size={12} className={loadingCounts ? 'animate-spin' : ''} />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block">দৈনিক হাজিরা রেকর্ড</span>
            <span className="text-lg font-bold text-indigo-700">
              {loadingCounts ? '...' : counts.attendance} টি
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block">মোট প্রশিক্ষণার্থী</span>
            <span className="text-lg font-bold text-emerald-700">
              {loadingCounts ? '...' : counts.trainees} জন
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block">পরীক্ষা ও মার্কস</span>
            <span className="text-lg font-bold text-purple-700">
              {loadingCounts ? '...' : `${counts.exams} / ${counts.marks}`}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block">ব্যাচ / প্রতিষ্ঠান</span>
            <span className="text-lg font-bold text-slate-700">
              {loadingCounts ? '...' : `${counts.batches} / ${counts.institutes}`}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. COMPREHENSIVE DATA DELETION SYSTEM                   */}
      {/* ======================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-red-50 text-red-600">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              ডাটা ক্লিনআপ ও ডিলিট অপশনসমূহ (Data Deletion Operations)
            </h2>
            <p className="text-xs text-slate-500">
              দৈনিক হাজিরা, শিক্ষার্থী তালিকা ও পরীক্ষা নম্বর মুছে ফেলার সিস্টেম
            </p>
          </div>
        </div>

        {!isDeletionAllowed && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
            <Lock size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ডাটা ডিলিট সিস্টেম বর্তমানে বন্ধ রয়েছে</p>
              <p className="text-amber-700 mt-0.5">
                নিচের যেকোনো ডিলিট অপশন ব্যবহার করতে চাইলে উপরের <strong>"ডিলিট অনুমতি দিন (Unlock Deletions)"</strong> বাটনে ক্লিক করে অনুমতি প্রদান করুন।
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Attendance Wipe */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <CalendarCheck size={16} className="text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-800">১. সকল দৈনিক হাজিরা মুছুন</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                সকল ব্যাচ ও তারিখের দৈনিক হাজিরা রেকর্ড মুছে ফেলা হবে। শিক্ষার্থী ও ব্যাচ অপরিবর্তিত থাকবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                বিদ্যমান রেকর্ড: {counts.attendance} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.attendance === 0}
              onClick={() => setActiveModal('attendance')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.attendance === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল হাজিরা রেকর্ড মুছুন</span>
            </button>
          </div>

          {/* Card 2: Trainees & Attendance Wipe */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Users size={16} className="text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-800">২. প্রশিক্ষণার্থী ও তাদের হাজিরা মুছুন</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                সকল প্রশিক্ষণার্থী তালিকা এবং তাদের সংশ্লিষ্ট সমস্ত হাজিরা তথ্য মুছে ফেলা হবে। ব্যাচ ও প্রতিষ্ঠান থাকবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                বিদ্যমান শিক্ষার্থী: {counts.trainees} জন
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.trainees === 0}
              onClick={() => setActiveModal('trainees')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.trainees === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <Trash2 size={13} />
              <span>শিক্ষার্থী ও হাজিরা মুছুন</span>
            </button>
          </div>

          {/* Card 3: Exams & Marks Wipe */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <FileCheck2 size={16} className="text-purple-600" />
                <h4 className="text-sm font-bold text-slate-800">৩. পরীক্ষা ও ফলাফল নম্বর মুছুন</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                সকল পরীক্ষার প্রশ্ন/শিডিউল এবং শিক্ষার্থীদের প্রাপ্ত ফলাফল নম্বর মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                বিদ্যমান পরীক্ষা: {counts.exams} টি • মার্কস: {counts.marks} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || (counts.exams === 0 && counts.marks === 0)}
              onClick={() => setActiveModal('exams')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || (counts.exams === 0 && counts.marks === 0)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল পরীক্ষা ও নম্বর মুছুন</span>
            </button>
          </div>

          {/* Card 4: Batches Wipe */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Layers size={16} className="text-amber-600" />
                <h4 className="text-sm font-bold text-slate-800">৪. সকল ব্যাচ মুছুন</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ক্লাউড ডাটাবেজ থেকে সকল প্রশিক্ষণ ব্যাচ মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                বিদ্যমান ব্যাচ: {counts.batches} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.batches === 0}
              onClick={() => setActiveModal('batches')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.batches === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল ব্যাচ মুছুন</span>
            </button>
          </div>

          {/* Card 5: Institutes Wipe */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 size={16} className="text-teal-600" />
                <h4 className="text-sm font-bold text-slate-800">৫. সকল প্রতিষ্ঠান মুছুন</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                সকল প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান) ক্লাউড ডাটাবেজ থেকে মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                বিদ্যমান প্রতিষ্ঠান: {counts.institutes} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.institutes === 0}
              onClick={() => setActiveModal('institutes')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.institutes === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল প্রতিষ্ঠান মুছুন</span>
            </button>
          </div>

          {/* Card 6: Trades Wipe */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Wrench size={16} className="text-cyan-600" />
                <h4 className="text-sm font-bold text-slate-800">৬. সকল ট্রেড মুছুন</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                সকল কারিগরি ও বৃত্তিমূলক ট্রেড ক্লাউড ডাটাবেজ থেকে মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                বিদ্যমান ট্রেড: {counts.trades} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.trades === 0}
              onClick={() => setActiveModal('trades')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.trades === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল ট্রেড মুছুন</span>
            </button>
          </div>

          {/* Card 7: Local Browser Cache Reset */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <RefreshCw size={16} className="text-blue-600" />
                <h4 className="text-sm font-bold text-slate-800">৭. ব্রাউজার ক্যাশ রিসেট</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                আপনার ব্রাউজারে সংরক্ষিত লোকাল মেমোরি পরিষ্কার করুন। এটি ক্লাউডের কোনো তথ্য ডিলিট করবে না।
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetLocalCache}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
            >
              <RefreshCw size={13} />
              <span>ব্রাউজার ক্যাশ রিসেট করুন</span>
            </button>
          </div>
        </div>

        {/* Card 5: Full System Factory Reset (DANGER ZONE) */}
        <div className="mt-4 p-5 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-700 border border-red-200 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900">
                  বিপদজনক অঞ্চল: সম্পূর্ণ সিস্টেম রিসেট (Full Factory Reset)
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  ক্লাউড ডাটাবেজ থেকে সকল তথ্য (হাজিরা, শিক্ষার্থী, ব্যাচ ও ফলাফল) মুছে সম্পূর্ণ নতুন অবস্থায় ফিরিয়ে নেয়
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed}
              onClick={() => {
                setDeleteConfirmationInput('');
                setActiveModal('factory_reset');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1.5 shrink-0 ${
                !isDeletionAllowed
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <Trash2 size={14} />
              <span>সম্পূর্ণ ডাটাবেজ খালি করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. CONFIRMATION MODALS                                  */}
      {/* ======================================================== */}

      {/* Modal 1: Attendance Delete Confirmation */}
      {activeModal === 'attendance' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-slate-800">সকল দৈনিক হাজিরা মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজের সমস্ত <strong>({counts.attendance} টি)</strong> দৈনিক হাজিরা রেকর্ড মুছে ফেলতে চান? এটি স্থায়ীভাবে মুছে যাবে এবং পূর্বাবস্থায় ফিরিয়ে আনা সম্ভব নয়।
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteAttendanceDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, সকল হাজিরা মুছুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Trainees Delete Confirmation */}
      {activeModal === 'trainees' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-slate-800">সকল প্রশিক্ষণার্থী ও হাজিরা মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে সমস্ত <strong>({counts.trainees} জন)</strong> প্রশিক্ষণার্থী এবং তাদের সংশ্লিষ্ট সকল হাজিরা তথ্য মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteTraineesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, প্রশিক্ষণার্থী তালিকা মুছুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Exams Delete Confirmation */}
      {activeModal === 'exams' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-slate-800">সকল পরীক্ষা ও নম্বর মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে সমস্ত <strong>({counts.exams} টি)</strong> পরীক্ষা ও তাদের ফলাফল নম্বর মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteExamsDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, পরীক্ষা ও মার্কস মুছুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Batches Delete Confirmation */}
      {activeModal === 'batches' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-slate-800">সকল প্রশিক্ষণ ব্যাচ মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজ থেকে সমস্ত <strong>({counts.batches} টি)</strong> প্রশিক্ষণ ব্যাচ মুছে ফেলতে চান? এটি স্থায়ীভাবে মুছে যাবে।
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, সকল ব্যাচ মুছুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Institutes Delete Confirmation */}
      {activeModal === 'institutes' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-slate-800">সকল প্রতিষ্ঠান মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজ থেকে সমস্ত <strong>({counts.institutes} টি)</strong> প্রতিষ্ঠান মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteInstitutesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, সকল প্রতিষ্ঠান মুছুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Trades Delete Confirmation */}
      {activeModal === 'trades' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-slate-800">সকল ট্রেড মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজ থেকে সমস্ত <strong>({counts.trades} টি)</strong> ট্রেড মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteTradesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, সকল ট্রেড মুছুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Full Factory Reset Modal (with typed confirmation) */}
      {activeModal === 'factory_reset' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-red-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertOctagon size={28} />
              <div>
                <h3 className="text-lg font-bold text-slate-800">🚨 সম্পূর্ণ সিস্টেম রিসেট নিশ্চিতকরণ</h3>
                <p className="text-xs text-red-600 font-semibold">এই অপারেশনটি সম্পূর্ণ অপরিবর্তনীয়</p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 space-y-1.5">
              <p className="font-bold">সিস্টেম থেকে নিচের তথ্যগুলো স্থায়ীভাবে মুছে যাবে:</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-800">
                <li>সকল দৈনিক হাজিরা ({counts.attendance} টি)</li>
                <li>সকল প্রশিক্ষণার্থী প্রোফাইল ({counts.trainees} জন)</li>
                <li>সকল পরীক্ষা ও মূল্যায়ন নম্বর ({counts.exams} / {counts.marks})</li>
                <li>সকল প্রশিক্ষণ ব্যাচ ({counts.batches} টি)</li>
              </ul>
            </div>

            <div className="pt-1">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepInstitutesAndTrades}
                  onChange={e => setKeepInstitutesAndTrades(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>প্রতিষ্ঠান ({counts.institutes}) ও ট্রেড ({counts.trades}) তালিকা সংরক্ষণ করুন (প্রস্তাবিত)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                নিশ্চিত করতে নিচের বক্সে <span className="font-mono text-red-600">DELETE</span> অথবা <span className="font-mono text-red-600">নিশ্চিত</span> লিখুন:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={e => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteFactoryReset}
                disabled={isDeleting || (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim() !== 'নিশ্চিত')}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 text-white ${
                  isDeleting || (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim() !== 'নিশ্চিত')
                    ? 'bg-red-300 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'রিসেট হচ্ছে...' : 'সম্পূর্ণ ডাটা মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ROLE PERMISSIONS & LANDING ROUTES (Course Director)   */}
      {/* ======================================================== */}
      {isCourseDirector && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 sm:p-7 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 text-purple-200 flex items-center justify-center border border-white/20 shrink-0">
                <Shield size={26} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">রোল ও পারমিশন সিস্টেম (Roles & Permissions)</h2>
                <p className="text-xs text-purple-200 mt-0.5">
                  সিস্টেমের প্রতিটি রোলের জন্য পেজ ভিউ এবং সকল অপারেশন পারমিশন পরিবর্তন ও নিয়ন্ত্রণ করুন
                </p>
              </div>
            </div>
            <Link
              to="/roles"
              className="px-5 py-2.5 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-sm font-bold shadow-md transition self-start sm:self-auto flex items-center space-x-2 shrink-0"
            >
              <span>রোল টেবিল ও পারমিশন ওপেন করুন</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      )}

      {/* Role Landing Pages */}
      {isCourseDirector && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Navigation size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  ভূমিকাভিত্তিক ডিফল্ট ল্যান্ডিং পেজ (Role Landing Pages)
                </h2>
                <p className="text-xs text-slate-500">
                  লগইনের পর কোন রোলের ব্যবহারকারী সরাসরি কোন পেজে প্রবেশ করবেন তা নির্ধারণ করুন
                </p>
              </div>
            </div>
            {landingSavedNotice && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {landingSavedNotice}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(role => {
              const currentLanding = role.defaultLandingRoute || (role.code === 'trainer' ? '/attendance' : '/');
              return (
                <div key={role.id} className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {role.nameBn || role.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {role.code}
                      </span>
                    </div>
                    {role.code === 'trainer' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                        হাজিরা ফলব্যাক সক্রিয়
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <select
                      value={currentLanding}
                      onChange={(e) => handleLandingRouteChange(role.id, e.target.value)}
                      disabled={savingLandingRoleId === role.id}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="/">ড্যাশবোর্ড (Dashboard - /)</option>
                      <option value="/attendance">দৈনিক হাজিরা (Daily Attendance - /attendance)</option>
                      <option value="/attendance-sheet">হাজিরা শিট (Attendance Sheet - /attendance-sheet)</option>
                      <option value="/batches">প্রশিক্ষণ ব্যাচ (Batches - /batches)</option>
                      <option value="/trainees">প্রশিক্ষণার্থী তালিকা (Trainees - /trainees)</option>
                      <option value="/institutes">প্রশিক্ষণ প্রতিষ্ঠান (Institutes - /institutes)</option>
                      <option value="/trades">বৃত্তিমূলক ট্রেড (Trades - /trades)</option>
                      <option value="/exams">পরীক্ষা ও মূল্যায়ন (Exams - /exams)</option>
                      <option value="/results">ফলাফল (Results - /results)</option>
                      <option value="/reports">প্রতিবেদন ও অ্যানালিটিক্স (Reports - /reports)</option>
                      <option value="/certificates">সার্টিফিকেট (Certificates - /certificates)</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. CERTIFICATE & GRADING RULES                          */}
      {/* ======================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Sliders size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">সনদ ও পাস নম্বর নীতিমালা (Rules & Criteria)</h2>
            <p className="text-xs text-slate-500">সার্টিফিকেট যোগ্যতা ও পরীক্ষার পাস শতকরা হার নির্ধারণ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              সার্টিফিকেটের জন্য ন্যূনতম উপস্থিতির হার (%)
            </label>
            <input
              type="number"
              min="50"
              max="100"
              value={minAttendance}
              onChange={e => setMinAttendance(parseInt(e.target.value) || 75)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              পরীক্ষায় ন্যূনতম পাস নম্বর শতকরা হার (%)
            </label>
            <input
              type="number"
              min="30"
              max="100"
              value={minPassMarks}
              onChange={e => setMinPassMarks(parseInt(e.target.value) || 40)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {settingsSaved && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
              <CheckCircle2 size={15} />
              <span>নীতিমালা সংরক্ষিত হয়েছে!</span>
            </span>
          )}
          <button
            onClick={saveSettings}
            className="ml-auto px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition"
          >
            <Save size={16} />
            <span>সংরক্ষণ করুন</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. ACTIVITY LOGS (AUDIT TRAIL)                          */}
      {/* ======================================================== */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">অডিট লগ ও সিস্টেম হিস্ট্রি (Activity Logs)</h2>
            <p className="text-xs text-slate-500">ইউজারদের কার্যক্রম ও ডাটা পরিবর্তন ইতিহাস পর্যবেক্ষণ করুন</p>
          </div>
        </div>

        {loadingLogs ? (
          <div className="py-8 text-center text-slate-400 text-xs">লগ লোড হচ্ছে...</div>
        ) : activityLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">এখনো কোনো অডিট লগ জমা হয়নি।</div>
        ) : (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {activityLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{log.action}</p>
                  <p className="text-slate-500 mt-0.5">
                    ব্যবহারকারী: <span className="text-emerald-700 font-medium">{log.userName}</span> • মডিউল: {log.module}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-3">
                  {format(log.timestamp, 'dd/MM/yy, hh:mm a')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
