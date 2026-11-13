import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, logActivity } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useConfirm } from '../contexts/ConfirmationContext';
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
  Info,
  UserCheck
} from 'lucide-react';
import { ActivityLog, Institute, Trade, Batch, Trainee, AttendanceRecord, Exam, ExamMark } from '../types';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';
import { ThemeSettingsSection } from '../components/settings/ThemeSettingsSection';

const Settings: React.FC = () => {
  const { userProfile } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const { roles } = usePermissions();

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
  const { confirm } = useConfirm();

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

  const handleResetLocalCache = async () => {
    const confirmed = await confirm({
      title: 'লোকাল ব্রাউজার ক্যাশ রিসেট',
      message: 'আপনি কি নিশ্চিতভাবে সমস্ত লোকাল ক্যাশ ডেটা মুছে ফ্রেশ শুরু করতে চান?',
      detail: 'এর ফলে ব্রাউজারে সংরক্ষিত অফলাইন ক্যাশ মেমোরি পরিষ্কার হবে এবং সম্পূর্ণ ডেটাবেজ থেকে নতুন করে ফ্রেশ ডাটা লোড হবে।',
      confirmText: 'হ্যাঁ, ক্যাশ মুছে ফেলুন',
      cancelText: 'বাতিল',
      variant: 'warning'
    });
    if (!confirmed) {
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
    <div className="space-y-6 max-w-5xl pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-theme-text-primary">
          সিস্টেম সেটিংস ও ডাটা নিয়ন্ত্রণ (Settings &amp; Data Control)
        </h1>
        <p className="text-xs sm:text-sm text-theme-text-secondary mt-0.5">
          অ্যাপিয়ারেন্স থিম, প্রয়োজনীয় কনফিগারেশন, ডাটা ডিলিট পারমিশন ও ফ্যাক্টরি রিসেট পরিচালনা করুন
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-theme-success-soft border border-theme-success-border text-theme-success text-sm flex items-center space-x-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-theme-danger-soft border border-theme-danger-border text-theme-danger text-sm flex items-center space-x-2.5 shadow-xs">
          <AlertOctagon size={18} className="shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 0. APPEARANCE & THEME CUSTOMIZATION                      */}
      {/* ======================================================== */}
      <ThemeSettingsSection />

      {/* ======================================================== */}
      {/* 1. DATA DELETION PERMISSION SWITCH (SETTINGS CONTROL)    */}
      {/* ======================================================== */}
      <div className={`p-5 sm:p-7 rounded-2xl border transition-all shadow-xs bg-theme-surface ${
        isDeletionAllowed
          ? 'border-theme-warning-border'
          : 'border-theme-success-border'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isDeletionAllowed
                ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
                : 'bg-theme-success-soft text-theme-success border-theme-success-border'
            }`}>
              {isDeletionAllowed ? <Unlock size={24} /> : <Lock size={24} />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-theme-text-primary">
                  সিস্টেম ডাটা ডিলিট নিয়ন্ত্রণ (Data Deletion Control)
                </h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  isDeletionAllowed
                    ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
                    : 'bg-theme-success-soft text-theme-success border-theme-success-border'
                }`}>
                  {isDeletionAllowed ? 'ডিলিট সক্রিয় (Unlocked)' : 'ডিলিট বন্ধ/সুরক্ষিত (Locked)'}
                </span>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1 max-w-xl leading-relaxed">
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
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs self-start sm:self-auto shrink-0 cursor-pointer ${
              isDeletionAllowed
                ? 'bg-theme-elevated hover:bg-theme-surface-hover text-theme-text-primary border border-theme-border-strong'
                : 'bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg'
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
          <div className="mt-4 p-3 rounded-xl bg-theme-success-soft border border-theme-success-border text-xs text-theme-text-primary flex items-center space-x-2">
            <Shield size={16} className="text-theme-success shrink-0" />
            <span>
              <strong>সুরক্ষা ও ফলব্যাক সক্রিয়:</strong> স্থায়ী ডাটা ডিলিট বন্ধ থাকায় কোনো রেকর্ড ডিলিটের অনুরোধ জানানো হলে তা স্থায়ীভাবে না মুছে স্বয়ংক্রিয়ভাবে সংরক্ষণাগারে (Archive Record) স্থানান্তরিত হবে।
            </span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* PUBLIC REGISTRATION CONTROL (COURSE DIRECTOR ONLY)      */}
      {/* ======================================================== */}
      {isCourseDirector && (
        <div className={`p-5 sm:p-7 rounded-2xl border transition-all shadow-xs bg-theme-surface ${
          settings.allowPublicRegistration !== false 
            ? 'border-theme-info-border' 
            : 'border-theme-danger-border'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                settings.allowPublicRegistration !== false 
                  ? 'bg-theme-info-soft text-theme-info border-theme-info-border' 
                  : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
              }`}>
                <UserCheck size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-theme-text-primary">
                    উন্মুক্ত ব্যবহারকারী নিবন্ধন নিয়ন্ত্রণ (Public Registration Control)
                  </h2>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    settings.allowPublicRegistration !== false 
                      ? 'bg-theme-info-soft text-theme-info border-theme-info-border' 
                      : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                  }`}>
                    {settings.allowPublicRegistration !== false ? 'উন্মুক্ত নিবন্ধন চালু (Open)' : 'উন্মুক্ত নিবন্ধন বন্ধ (Closed)'}
                  </span>
                </div>
                <p className="text-xs text-theme-text-secondary mt-1 max-w-xl leading-relaxed">
                  {settings.allowPublicRegistration !== false 
                    ? 'লগইন পেজ থেকে নতুন ব্যবহারকারীগণ নিবন্ধনের আবেদন করতে পারছেন। সকল নতুন একাউন্ট সুরক্ষিতভাবে Pending Approval অবস্থায় থাকে।' 
                    : 'লগইন পেজ থেকে সাধারণ ব্যবহারকারীদের নতুন নিবন্ধন বন্ধ রয়েছে। শুধুমাত্র কোর্স পরিচালক ইউজার ম্যানেজমেন্ট থেকে নতুন ইউজার যুক্ত করতে পারবেন।'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const next = settings.allowPublicRegistration === false;
                await updateSettings({ allowPublicRegistration: next });
                setStatusMessage(`উন্মুক্ত নিবন্ধন সফলভাবে ${next ? 'চালু' : 'বন্ধ'} করা হয়েছে।`);
                setTimeout(() => setStatusMessage(''), 4000);
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs self-start sm:self-auto shrink-0 cursor-pointer ${
                settings.allowPublicRegistration !== false
                  ? 'bg-theme-danger hover:opacity-90 text-theme-danger-fg'
                  : 'bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg'
              }`}
            >
              {settings.allowPublicRegistration !== false ? (
                <>
                  <Lock size={15} />
                  <span>নিবন্ধন বন্ধ করুন (Close Registration)</span>
                </>
              ) : (
                <>
                  <Unlock size={15} />
                  <span>নিবন্ধন চালু করুন (Open Registration)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CURRENT DATA METRICS & SUMMARY                       */}
      {/* ======================================================== */}
      <div className="bg-theme-surface p-5 sm:p-6 rounded-2xl border border-theme-border shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-theme-border">
          <div className="flex items-center space-x-2">
            <Database size={18} className="text-theme-text-secondary" />
            <h3 className="text-sm font-bold text-theme-text-primary">ক্লাউড ডাটাবেজ স্থিতি (Database Summary)</h3>
          </div>
          <button 
            type="button"
            onClick={fetchCounts}
            className="text-xs text-theme-info hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loadingCounts ? 'animate-spin' : ''} />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-theme-surface-subtle rounded-xl border border-theme-border">
            <span className="text-theme-text-secondary block">দৈনিক হাজিরা রেকর্ড</span>
            <span className="text-lg font-bold text-theme-info tabular-nums">
              {loadingCounts ? '...' : counts.attendance} টি
            </span>
          </div>
          <div className="p-3 bg-theme-surface-subtle rounded-xl border border-theme-border">
            <span className="text-theme-text-secondary block">মোট প্রশিক্ষণার্থী</span>
            <span className="text-lg font-bold text-theme-primary tabular-nums">
              {loadingCounts ? '...' : counts.trainees} জন
            </span>
          </div>
          <div className="p-3 bg-theme-surface-subtle rounded-xl border border-theme-border">
            <span className="text-theme-text-secondary block">পরীক্ষা ও মার্কস</span>
            <span className="text-lg font-bold text-theme-accent tabular-nums">
              {loadingCounts ? '...' : `${counts.exams} / ${counts.marks}`}
            </span>
          </div>
          <div className="p-3 bg-theme-surface-subtle rounded-xl border border-theme-border">
            <span className="text-theme-text-secondary block">ব্যাচ / প্রতিষ্ঠান</span>
            <span className="text-lg font-bold text-theme-text-primary tabular-nums">
              {loadingCounts ? '...' : `${counts.batches} / ${counts.institutes}`}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. COMPREHENSIVE DATA DELETION SYSTEM                   */}
      {/* ======================================================== */}
      <div className="bg-theme-surface p-5 sm:p-7 rounded-2xl border border-theme-border shadow-xs space-y-5">
        <div className="flex items-center space-x-3 pb-3 border-b border-theme-border">
          <div className="p-2 rounded-xl bg-theme-danger-soft text-theme-danger border border-theme-danger-border">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-theme-text-primary">
              ডাটা ক্লিনআপ ও ডিলিট অপশনসমূহ (Data Deletion Operations)
            </h2>
            <p className="text-xs text-theme-text-secondary">
              দৈনিক হাজিরা, শিক্ষার্থী তালিকা ও পরীক্ষা নম্বর মুছে ফেলার সিস্টেম
            </p>
          </div>
        </div>

        {!isDeletionAllowed && (
          <div className="p-4 rounded-xl bg-theme-warning-soft border border-theme-warning-border text-theme-text-primary text-xs flex items-start space-x-2.5">
            <Lock size={16} className="text-theme-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ডাটা ডিলিট সিস্টেম বর্তমানে বন্ধ রয়েছে</p>
              <p className="text-theme-text-secondary mt-0.5">
                নিচের যেকোনো ডিলিট অপশন ব্যবহার করতে চাইলে উপরের <strong>"ডিলিট অনুমতি দিন (Unlock Deletions)"</strong> বাটনে ক্লিক করে অনুমতি প্রদান করুন।
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Attendance Wipe */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <CalendarCheck size={16} className="text-theme-info" />
                <h4 className="text-sm font-bold text-theme-text-primary">১. সকল দৈনিক হাজিরা মুছুন</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                সকল ব্যাচ ও তারিখের দৈনিক হাজিরা রেকর্ড মুছে ফেলা হবে। শিক্ষার্থী ও ব্যাচ অপরিবর্তিত থাকবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-theme-text-secondary bg-theme-surface px-2.5 py-0.5 rounded-md border border-theme-border tabular-nums">
                বিদ্যমান রেকর্ড: {counts.attendance} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.attendance === 0}
              onClick={() => setActiveModal('attendance')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.attendance === 0
                  ? 'bg-theme-surface text-theme-text-muted cursor-not-allowed border border-theme-border'
                  : 'bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border cursor-pointer'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল হাজিরা রেকর্ড মুছুন</span>
            </button>
          </div>

          {/* Card 2: Trainees & Attendance Wipe */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Users size={16} className="text-theme-primary" />
                <h4 className="text-sm font-bold text-theme-text-primary">২. প্রশিক্ষণার্থী ও তাদের হাজিরা মুছুন</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                সকল প্রশিক্ষণার্থী তালিকা এবং তাদের সংশ্লিষ্ট সমস্ত হাজিরা তথ্য মুছে ফেলা হবে। ব্যাচ ও প্রতিষ্ঠান থাকবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-theme-text-secondary bg-theme-surface px-2.5 py-0.5 rounded-md border border-theme-border tabular-nums">
                বিদ্যমান শিক্ষার্থী: {counts.trainees} জন
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.trainees === 0}
              onClick={() => setActiveModal('trainees')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.trainees === 0
                  ? 'bg-theme-surface text-theme-text-muted cursor-not-allowed border border-theme-border'
                  : 'bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border cursor-pointer'
              }`}
            >
              <Trash2 size={13} />
              <span>শিক্ষার্থী ও হাজিরা মুছুন</span>
            </button>
          </div>

          {/* Card 3: Exams & Marks Wipe */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <FileCheck2 size={16} className="text-theme-accent" />
                <h4 className="text-sm font-bold text-theme-text-primary">৩. পরীক্ষা ও ফলাফল নম্বর মুছুন</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                সকল পরীক্ষার প্রশ্ন/শিডিউল এবং শিক্ষার্থীদের প্রাপ্ত ফলাফল নম্বর মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-theme-text-secondary bg-theme-surface px-2.5 py-0.5 rounded-md border border-theme-border tabular-nums">
                বিদ্যমান পরীক্ষা: {counts.exams} টি • মার্কস: {counts.marks} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || (counts.exams === 0 && counts.marks === 0)}
              onClick={() => setActiveModal('exams')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || (counts.exams === 0 && counts.marks === 0)
                  ? 'bg-theme-surface text-theme-text-muted cursor-not-allowed border border-theme-border'
                  : 'bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border cursor-pointer'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল পরীক্ষা ও নম্বর মুছুন</span>
            </button>
          </div>

          {/* Card 4: Batches Wipe */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Layers size={16} className="text-theme-warning" />
                <h4 className="text-sm font-bold text-theme-text-primary">৪. সকল ব্যাচ মুছুন</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                ক্লাউড ডাটাবেজ থেকে সকল প্রশিক্ষণ ব্যাচ মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-theme-text-secondary bg-theme-surface px-2.5 py-0.5 rounded-md border border-theme-border tabular-nums">
                বিদ্যমান ব্যাচ: {counts.batches} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.batches === 0}
              onClick={() => setActiveModal('batches')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.batches === 0
                  ? 'bg-theme-surface text-theme-text-muted cursor-not-allowed border border-theme-border'
                  : 'bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border cursor-pointer'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল ব্যাচ মুছুন</span>
            </button>
          </div>

          {/* Card 5: Institutes Wipe */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 size={16} className="text-theme-primary" />
                <h4 className="text-sm font-bold text-theme-text-primary">৫. সকল প্রতিষ্ঠান মুছুন</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                সকল প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান) ক্লাউড ডাটাবেজ থেকে মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-theme-text-secondary bg-theme-surface px-2.5 py-0.5 rounded-md border border-theme-border tabular-nums">
                বিদ্যমান প্রতিষ্ঠান: {counts.institutes} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.institutes === 0}
              onClick={() => setActiveModal('institutes')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.institutes === 0
                  ? 'bg-theme-surface text-theme-text-muted cursor-not-allowed border border-theme-border'
                  : 'bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border cursor-pointer'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল প্রতিষ্ঠান মুছুন</span>
            </button>
          </div>

          {/* Card 6: Trades Wipe */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <Wrench size={16} className="text-theme-accent" />
                <h4 className="text-sm font-bold text-theme-text-primary">৬. সকল ট্রেড মুছুন</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                সকল কারিগরি ও বৃত্তিমূলক ট্রেড ক্লাউড ডাটাবেজ থেকে মুছে ফেলা হবে।
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-theme-text-secondary bg-theme-surface px-2.5 py-0.5 rounded-md border border-theme-border tabular-nums">
                বিদ্যমান ট্রেড: {counts.trades} টি
              </span>
            </div>

            <button
              type="button"
              disabled={!isDeletionAllowed || counts.trades === 0}
              onClick={() => setActiveModal('trades')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                !isDeletionAllowed || counts.trades === 0
                  ? 'bg-theme-surface text-theme-text-muted cursor-not-allowed border border-theme-border'
                  : 'bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border cursor-pointer'
              }`}
            >
              <Trash2 size={13} />
              <span>সকল ট্রেড মুছুন</span>
            </button>
          </div>

          {/* Card 7: Local Browser Cache Reset */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface-subtle flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2">
                <RefreshCw size={16} className="text-theme-info" />
                <h4 className="text-sm font-bold text-theme-text-primary">৭. ব্রাউজার ক্যাশ রিসেট</h4>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                আপনার ব্রাউজারে সংরক্ষিত লোকাল মেমোরি পরিষ্কার করুন। এটি ক্লাউডের কোনো তথ্য ডিলিট করবে না।
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetLocalCache}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-theme-info-soft hover:opacity-90 text-theme-info border border-theme-info-border cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>ব্রাউজার ক্যাশ রিসেট করুন</span>
            </button>
          </div>
        </div>

        {/* Full System Factory Reset (DANGER ZONE) */}
        <div className="mt-4 p-5 rounded-2xl bg-theme-danger-soft border border-theme-danger-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-theme-surface text-theme-danger border border-theme-danger-border shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-theme-danger">
                  বিপদজনক অঞ্চল: সম্পূর্ণ সিস্টেম রিসেট (Full Factory Reset)
                </h3>
                <p className="text-xs text-theme-text-secondary mt-0.5">
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
                  ? 'bg-theme-surface text-theme-text-muted border border-theme-border cursor-not-allowed'
                  : 'bg-theme-danger hover:opacity-90 text-theme-danger-fg cursor-pointer'
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-theme-text-primary">সকল দৈনিক হাজিরা মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজের সমস্ত <strong>({counts.attendance} টি)</strong> দৈনিক হাজিরা রেকর্ড মুছে ফেলতে চান? এটি স্থায়ীভাবে মুছে যাবে এবং পূর্বাবস্থায় ফিরিয়ে আনা সম্ভব নয়।
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteAttendanceDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-theme-danger hover:opacity-90 text-theme-danger-fg rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-theme-text-primary">সকল প্রশিক্ষণার্থী ও হাজিরা মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনি কি নিশ্চিতভাবে সমস্ত <strong>({counts.trainees} জন)</strong> প্রশিক্ষণার্থী এবং তাদের সংশ্লিষ্ট সকল হাজিরা তথ্য মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteTraineesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-theme-danger hover:opacity-90 text-theme-danger-fg rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-theme-text-primary">সকল পরীক্ষা ও নম্বর মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনি কি নিশ্চিতভাবে সমস্ত <strong>({counts.exams} টি)</strong> পরীক্ষা ও তাদের ফলাফল নম্বর মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteExamsDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-theme-danger hover:opacity-90 text-theme-danger-fg rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-theme-text-primary">সকল প্রশিক্ষণ ব্যাচ মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজ থেকে সমস্ত <strong>({counts.batches} টি)</strong> প্রশিক্ষণ ব্যাচ মুছে ফেলতে চান? এটি স্থায়ীভাবে মুছে যাবে।
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-theme-danger hover:opacity-90 text-theme-danger-fg rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-theme-text-primary">সকল প্রতিষ্ঠান মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজ থেকে সমস্ত <strong>({counts.institutes} টি)</strong> প্রতিষ্ঠান মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteInstitutesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-theme-danger hover:opacity-90 text-theme-danger-fg rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-theme-text-primary">সকল ট্রেড মোছার নিশ্চিতকরণ</h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনি কি নিশ্চিতভাবে ক্লাউড ডাটাবেজ থেকে সমস্ত <strong>({counts.trades} টি)</strong> ট্রেড মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteTradesDeletion}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold bg-theme-danger hover:opacity-90 text-theme-danger-fg rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-theme-danger-border space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-theme-danger">
              <AlertOctagon size={28} />
              <div>
                <h3 className="text-lg font-bold text-theme-text-primary">সম্পূর্ণ সিস্টেম রিসেট নিশ্চিতকরণ</h3>
                <p className="text-xs text-theme-danger font-semibold">এই অপারেশনটি সম্পূর্ণ অপরিবর্তনীয়</p>
              </div>
            </div>

            <div className="p-3.5 bg-theme-danger-soft rounded-xl border border-theme-danger-border text-xs text-theme-text-primary space-y-1.5">
              <p className="font-bold">সিস্টেম থেকে নিচের তথ্যগুলো স্থায়ীভাবে মুছে যাবে:</p>
              <ul className="list-disc list-inside space-y-0.5 text-theme-text-secondary">
                <li>সকল দৈনিক হাজিরা ({counts.attendance} টি)</li>
                <li>সকল প্রশিক্ষণার্থী প্রোফাইল ({counts.trainees} জন)</li>
                <li>সকল পরীক্ষা ও মূল্যায়ন নম্বর ({counts.exams} / {counts.marks})</li>
                <li>সকল প্রশিক্ষণ ব্যাচ ({counts.batches} টি)</li>
              </ul>
            </div>

            <div className="pt-1">
              <label className="flex items-center space-x-2 text-xs font-semibold text-theme-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepInstitutesAndTrades}
                  onChange={e => setKeepInstitutesAndTrades(e.target.checked)}
                  className="rounded border-theme-border text-theme-primary focus:ring-theme-primary w-4 h-4"
                />
                <span>প্রতিষ্ঠান ({counts.institutes}) ও ট্রেড ({counts.trades}) তালিকা সংরক্ষণ করুন (প্রস্তাবিত)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-theme-text-primary mb-1.5">
                নিশ্চিত করতে নিচের বক্সে <span className="font-mono text-theme-danger">DELETE</span> অথবা <span className="font-mono text-theme-danger">নিশ্চিত</span> লিখুন:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={e => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 bg-theme-surface border border-theme-border rounded-xl text-sm font-mono text-theme-text-primary focus:ring-2 focus:ring-theme-danger focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteFactoryReset}
                disabled={isDeleting || (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim() !== 'নিশ্চিত')}
                className="px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 bg-theme-danger hover:opacity-90 text-theme-danger-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
        <div className="bg-theme-surface p-5 sm:p-7 rounded-2xl border border-theme-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-theme-primary-soft text-theme-primary-soft-fg flex items-center justify-center border border-theme-primary-border shrink-0">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-theme-text-primary">রোল ও পারমিশন সিস্টেম (Roles &amp; Permissions)</h2>
                <p className="text-xs text-theme-text-secondary mt-0.5">
                  সিস্টেমের প্রতিটি রোলের জন্য পেজ ভিউ এবং সকল অপারেশন পারমিশন পরিবর্তন ও নিয়ন্ত্রণ করুন
                </p>
              </div>
            </div>
            <Link
              to="/roles"
              className="px-5 py-2.5 bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto flex items-center space-x-2 shrink-0"
            >
              <span>রোল টেবিল ও পারমিশন ওপেন করুন</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. CERTIFICATE & GRADING RULES                          */}
      {/* ======================================================== */}
      <div className="bg-theme-surface p-5 sm:p-7 rounded-2xl border border-theme-border shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-theme-border">
          <div className="p-2 rounded-xl bg-theme-primary-soft text-theme-primary-soft-fg">
            <Sliders size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-theme-text-primary">সনদ ও পাস নম্বর নীতিমালা (Rules &amp; Criteria)</h2>
            <p className="text-xs text-theme-text-secondary">সার্টিফিকেট যোগ্যতা ও পরীক্ষার পাস শতকরা হার নির্ধারণ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
              সার্টিফিকেটের জন্য ন্যূনতম উপস্থিতির হার (%)
            </label>
            <input
              type="number"
              min="50"
              max="100"
              value={minAttendance}
              onChange={e => setMinAttendance(parseInt(e.target.value) || 75)}
              className="w-full px-3 py-2 bg-theme-elevated border border-theme-border rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
              পরীক্ষায় ন্যূনতম পাস নম্বর শতকরা হার (%)
            </label>
            <input
              type="number"
              min="30"
              max="100"
              value={minPassMarks}
              onChange={e => setMinPassMarks(parseInt(e.target.value) || 40)}
              className="w-full px-3 py-2 bg-theme-elevated border border-theme-border rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none tabular-nums"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {settingsSaved && (
            <span className="text-xs text-theme-success font-semibold flex items-center space-x-1">
              <CheckCircle2 size={15} />
              <span>নীতিমালা সংরক্ষিত হয়েছে!</span>
            </span>
          )}
          <button
            onClick={saveSettings}
            className="ml-auto px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold flex items-center space-x-2 transition cursor-pointer"
          >
            <Save size={16} />
            <span>সংরক্ষণ করুন</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. ACTIVITY LOGS (AUDIT TRAIL)                          */}
      {/* ======================================================== */}
      <div className="bg-theme-surface p-5 sm:p-7 rounded-2xl border border-theme-border shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-theme-border">
          <div className="p-2 rounded-xl bg-theme-accent-soft text-theme-accent">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-theme-text-primary">অডিট লগ ও সিস্টেম হিস্ট্রি (Activity Logs)</h2>
            <p className="text-xs text-theme-text-secondary">ইউজারদের কার্যক্রম ও ডাটা পরিবর্তন ইতিহাস পর্যবেক্ষণ করুন</p>
          </div>
        </div>

        {loadingLogs ? (
          <div className="py-8 text-center text-theme-text-muted text-xs">লগ লোড হচ্ছে...</div>
        ) : activityLogs.length === 0 ? (
          <div className="py-8 text-center text-theme-text-muted text-xs">এখনো কোনো অডিট লগ জমা হয়নি।</div>
        ) : (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {activityLogs.map((log) => (
              <div key={log.id} className="p-3 bg-theme-surface-subtle rounded-xl border border-theme-border flex items-start justify-between text-xs gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-theme-text-primary">{log.action}</p>
                  <p className="text-theme-text-secondary mt-0.5">
                    ব্যবহারকারী: <span className="text-theme-primary font-medium">{log.userName}</span> • মডিউল: {log.module}
                  </p>
                </div>
                <span className="text-[11px] text-theme-text-muted font-mono shrink-0 tabular-nums">
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
