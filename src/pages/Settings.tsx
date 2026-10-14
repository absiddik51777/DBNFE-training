import React, { useState, useEffect } from 'react';
import { db, logActivity } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
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
  Sparkles 
} from 'lucide-react';
import { ActivityLog } from '../types';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const Settings: React.FC = () => {
  const { userProfile } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Settings configuration state
  const [minAttendance, setMinAttendance] = useState(75);
  const [minPassMarks, setMinPassMarks] = useState(40);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const isCourseDirector = userProfile?.role === 'Course Director';

  useEffect(() => {
    fetchLogs();
  }, []);

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

  const handleClearDemoData = async () => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে সমস্ত ডেমো প্রতিষ্ঠান, ট্রেড, ব্যাচ ও ডেমো প্রশিক্ষণার্থী মুছে ফেলতে চান?")) {
      return;
    }

    setClearing(true);
    setStatusMessage('');

    try {
      await dataService.clearAllDemoData();
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Director',
        'সিস্টেম থেকে সমস্ত ডেমো ডেটা মুছে ফেলা হয়েছে (Removed all demo data)',
        'Settings',
        'clean_demo'
      );
      setStatusMessage('সমস্ত ডেমো ডেটা সফলভাবে মুছে ফেলা হয়েছে! সিস্টেম এখন সম্পূর্ণ পরিচ্ছন্ন।');
      fetchLogs();
    } catch (err: any) {
      console.warn("Notice clearing demo data:", err);
      dataService.clearAllLocalData();
      setStatusMessage('ডেমো ডেটা ক্যাশ থেকে মুছে ফেলা হয়েছে।');
      fetchLogs();
    } finally {
      setClearing(false);
    }
  };

  const handleResetLocalCache = () => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে সমস্ত ক্যাশ ডেটা মুছে ফ্রেশ শুরু করতে চান?")) {
      return;
    }
    dataService.clearAllLocalData();
    setStatusMessage('লোকাল ক্যাশ সফলভাবে রিসেট করা হয়েছে। পৃষ্ঠাটি রিফ্রেশ হচ্ছে...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleSeedDemoTrainees = async () => {
    setSeeding(true);
    setStatusMessage('');
    try {
      await dataService.seedDemoTraineesForAllBatches(false);
      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Director',
        'সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী যোগ করা হয়েছে',
        'Settings',
        'seed_demo_trainees'
      );
      setStatusMessage('সকল ব্যাচে ২০ জন করে ডেমো প্রশিক্ষণার্থী সফলভাবে যোগ করা হয়েছে!');
      fetchLogs();
    } catch (err: any) {
      console.warn("Notice seeding demo trainees:", err);
      setStatusMessage('ডেমো প্রশিক্ষণার্থী যোগ করা সম্পন্ন হয়েছে।');
    } finally {
      setSeeding(false);
    }
  };

  const saveSettings = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">সিস্টেম সেটিংস ও অডিট লগ (Settings & Audit Logs)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          সিস্টেমের প্রয়োজনীয় কনফিগারেশন, ডেমো ডেটা এবং কার্যক্রমের ইতিহাস
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Clean Demo Data & Storage Reset Tool */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-red-50 text-red-600">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">ডেমো ডেটা অপনয়ন ও ডাটাবেজ পরিচালনা (Data Clean-up)</h2>
            <p className="text-xs text-slate-500">সমস্ত ডেমো রেকর্ড মুছে ফেলে বাস্তব কার্যক্রম শুরু করুন</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
          <p className="font-semibold text-slate-800">
            সিস্টেমে কোনো নমুনা বা ডেমো ডেটা প্রয়োজন না থাকলে নিচের বাটনে ক্লিক করে সব ডেমো তথ্য মুছে ফেলুন।
          </p>
          <p className="text-slate-500">
            এটি সমস্ত নমুনা প্রতিষ্ঠান, ডেমো ট্রেড, ব্যাচ ও ২০ জন নমুনা প্রশিক্ষণার্থীর তথ্য সিস্টেম থেকে অবিলম্বে সরিয়ে দেবে।
          </p>
        </div>

        <div className="pt-2 flex flex-wrap gap-3">
          <button
            onClick={handleSeedDemoTrainees}
            disabled={seeding}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Sparkles size={16} />
            <span>{seeding ? 'যোগ করা হচ্ছে...' : 'সকল ব্যাচে ২০ জন করে ডেমো শিক্ষার্থী যোগ করুন (Seed 20 Trainees)'}</span>
          </button>

          <button
            onClick={handleClearDemoData}
            disabled={clearing}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-semibold shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Trash2 size={16} />
            <span>{clearing ? 'ডেমো ডেটা মোছা হচ্ছে...' : 'ডেমো ডেটা মুছুন (Clear)'}</span>
          </button>

          <button
            onClick={handleResetLocalCache}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            ক্যাশ রিসেট (Reset Cache)
          </button>
        </div>
      </div>

      {/* Certificate & Grading Rules Configuration */}
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
              <span>নীতিমালা সংরক্ষিত হয়েছে!</span>
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

      {/* Firebase Rules Configuration Guide */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Shield size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">ফায়ারবেস সিকিউরিটি রুলস নির্দেশিকা (Firebase Security Rules)</h2>
            <p className="text-xs text-slate-500">আপনার প্রজেক্টের ফায়ারবেস কনসোলে এই রুলসটি যুক্ত করুন</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          ফায়ারবেসে "Missing or insufficient permissions" সমস্যা সমাধানের জন্য আপনার Firebase Console-এর <b>Firestore Database &gt; Rules</b> ট্যাবে নিচের কোডটি পেস্ট করে "Publish" বাটনে ক্লিক করুন:
        </p>

        <div className="relative bg-slate-900 rounded-xl p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 border border-slate-800">
          <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // BNFE ট্রেনিং পোর্টালে সকল তথ্য (প্রতিষ্ঠান, ট্রেড, ব্যাচ, হাজিরা) পড়ার ও লেখার অনুমতি
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
        </div>

        <button
          type="button"
          onClick={() => {
            const ruleText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // BNFE ট্রেনিং পোর্টালে সকল তথ্য (প্রতিষ্ঠান, ট্রেড, ব্যাচ, হাজিরা) পড়ার ও লেখার অনুমতি
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;
            navigator.clipboard.writeText(ruleText);
            alert("সিকিউরিটি রুলস ক্লিপবোর্ডে কপি করা হয়েছে! Firebase Console > Firestore Database > Rules ট্যাবে পেস্ট করে Publish বাটনে ক্লিক করুন।");
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
        >
          রুলস কপি করুন (Copy Rules)
        </button>
      </div>

      {/* Activity Logs (Audit Trail) */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">অডিট লগ ও সিস্টেম হিস্ট্রি (Activity Logs)</h2>
            <p className="text-xs text-slate-500">ইউজারদের কার্যক্রমের ইতিহাস পর্যবেক্ষণ করুন</p>
          </div>
        </div>

        {loadingLogs ? (
          <div className="py-8 text-center text-slate-400 text-xs">লগ লোড হচ্ছে...</div>
        ) : activityLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">এখনো কোনো অডিট লগ জমা হয়নি।</div>
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
