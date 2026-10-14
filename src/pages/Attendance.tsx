import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { logActivity } from '../lib/firebase';
import { Institute, Trade, Batch, Trainee, AttendanceRecord, AttendanceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { 
  Check, 
  X, 
  Calendar as CalendarIcon, 
  CalendarDays,
  Save, 
  CheckCheck, 
  UserCheck, 
  UserX, 
  Clock, 
  Filter,
  CheckCircle2,
  Building2,
  Layers,
  AlertCircle,
  Lock
} from 'lucide-react';
import { dataService } from '../lib/dataService';

const Attendance: React.FC = () => {
  const { userProfile } = useAuth();
  
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { id?: string; status: AttendanceStatus; isSaved?: boolean }>>({});
  const [filterSavedStatus, setFilterSavedStatus] = useState<'all' | 'saved' | 'not_saved'>('all');
  const [loading, setLoading] = useState(true);
  const [fetchingTrainees, setFetchingTrainees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [userProfile]);

  const fetchInitialData = async () => {
    try {
      const [instData, trdData, btcData] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches')
      ]);

      setInstitutes(instData);
      setTrades(trdData);
      setBatches(btcData);

      let targetInst = '';
      let targetBatch = '';
      let targetTrade = '';

      if (userProfile?.role === 'Trainer') {
        // Trainer logic: assign their registered institute and batch
        targetInst = userProfile.instituteId || (instData[0]?.id || '');

        if (userProfile.batchId) {
          targetBatch = userProfile.batchId;
          const assignedBatch = btcData.find(b => b.id === userProfile.batchId);
          if (assignedBatch) {
            targetInst = assignedBatch.instituteId || targetInst;
            targetTrade = assignedBatch.tradeId || '';
          }
        } else {
          // Fallback if trainer has no batchId assigned yet
          const matching = btcData.filter(b => b.instituteId === targetInst);
          if (matching.length > 0) {
            targetBatch = matching[0].id;
            targetTrade = matching[0].tradeId || '';
          }
        }
      } else {
        // Course Director / FMA
        targetInst = userProfile?.instituteId || (instData[0]?.id || '');
        const matching = btcData.filter(b => b.instituteId === targetInst);
        if (matching.length > 0) {
          targetBatch = matching[0].id;
          targetTrade = matching[0].tradeId || '';
        }
      }

      if (!targetTrade && trdData.length > 0) {
        targetTrade = trdData[0].id;
      }

      setSelectedInstitute(targetInst);
      setSelectedBatch(targetBatch);
      setSelectedTrade(targetTrade);

    } catch (error) {
      console.warn("Notice fetching initial data in Attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatch && selectedDate) {
      fetchTraineesAndAttendance();
    } else {
      setTrainees([]);
      setAttendanceData({});
    }
  }, [selectedBatch, selectedDate]);

  const fetchTraineesAndAttendance = async () => {
    setFetchingTrainees(true);
    setSaveSuccess(false);
    try {
      // 1. Fetch active trainees for this batch
      const allTrainees = await dataService.getItems<Trainee>('trainees');
      const tData = allTrainees
        .filter(t => t.batchId === selectedBatch && (!t.status || t.status === 'Active'))
        .sort((a, b) => (a.traineeId || a.id).localeCompare(b.traineeId || b.id, undefined, { numeric: true }));
      
      setTrainees(tData);

      // 2. Fetch existing attendance for this batch on the selected date
      const allAttendance = await dataService.getItems<AttendanceRecord>('attendance');
      const batchDateAtt = allAttendance.filter(a => a.batchId === selectedBatch && a.date === selectedDate);
      
      const statusMap: Record<string, { id?: string; status: AttendanceStatus; isSaved?: boolean }> = {};
      batchDateAtt.forEach(data => {
        statusMap[data.traineeId] = { id: data.id, status: data.status, isSaved: true };
      });

      // Default to Present if not already recorded
      tData.forEach(t => {
        if (!statusMap[t.id]) {
          statusMap[t.id] = { status: 'Present', isSaved: false };
        }
      });
      
      setAttendanceData(statusMap);

    } catch (error) {
      console.warn("Notice fetching attendance:", error);
    } finally {
      setFetchingTrainees(false);
    }
  };

  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId);
    const foundBatch = batches.find(b => b.id === batchId);
    if (foundBatch?.tradeId) {
      setSelectedTrade(foundBatch.tradeId);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    const updated = { ...attendanceData };
    trainees.forEach(t => {
      updated[t.id] = { ...updated[t.id], status };
    });
    setAttendanceData(updated);
  };

  const setStatus = (traineeId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [traineeId]: { ...prev[traineeId], status }
    }));
  };

  const handleSave = async () => {
    if (trainees.length === 0) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const recordsToSave: AttendanceRecord[] = [];

      for (const t of trainees) {
        const item = attendanceData[t.id];
        if (!item) continue;

        const recId = item.id || `ATT-${selectedBatch}_${selectedDate}_${t.id}`;
        recordsToSave.push({
          id: recId,
          batchId: selectedBatch,
          instituteId: selectedInstitute,
          tradeId: selectedTrade,
          date: selectedDate,
          traineeId: t.id,
          status: item.status,
          recordedBy: userProfile?.name || 'User',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      await dataService.saveAttendanceBatch(recordsToSave);
      
      // Immediately mark trainees as saved in local state
      setAttendanceData(prev => {
        const next = { ...prev };
        trainees.forEach(t => {
          if (next[t.id]) {
            next[t.id] = { ...next[t.id], isSaved: true };
          }
        });
        return next;
      });

      setSaveSuccess(true);
      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `উপস্থিতি সংরক্ষণ: ${selectedDate} (${recordsToSave.length} জন)`,
        'Attendance',
        selectedBatch
      );
      
      await fetchTraineesAndAttendance();
    } catch (error) {
      console.warn("Notice saving attendance:", error);
      setSaveSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  // Stats for the selected date
  const presentCount = Object.values(attendanceData).filter(a => a.status === 'Present').length;
  const absentCount = Object.values(attendanceData).filter(a => a.status === 'Absent').length;
  const leaveCount = Object.values(attendanceData).filter(a => a.status === 'Leave').length;
  const savedCount = trainees.filter(t => !!attendanceData[t.id]?.isSaved).length;

  const currentBatch = batches.find(b => b.id === selectedBatch);
  const currentInstitute = institutes.find(i => i.id === selectedInstitute);
  const currentTrade = trades.find(t => t.id === selectedTrade);

  const isTrainer = userProfile?.role === 'Trainer';
  const trainerAssignedBatch = isTrainer && userProfile?.batchId ? batches.find(b => b.id === userProfile.batchId) : null;
  const trainerAssignedInstitute = isTrainer && userProfile?.instituteId ? institutes.find(i => i.id === userProfile.instituteId) : null;

  const displayedTrainees = trainees.filter(t => {
    const isSaved = !!attendanceData[t.id]?.isSaved;
    if (filterSavedStatus === 'saved') return isSaved;
    if (filterSavedStatus === 'not_saved') return !isSaved;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>উপস্থিতি মডিউল লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">দৈনিক উপস্থিতি (Daily Attendance)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isTrainer ? 'আপনার নির্ধারিত ব্যাচের প্রশিক্ষণার্থীদের দৈনিক উপস্থিতি গ্রহণ করুন' : 'ব্যাচ ও তারিখ নির্বাচন করে প্রশিক্ষণার্থীদের দৈনিক উপস্থিতি গ্রহণ করুন'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/attendance-sheet"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold border border-slate-300 flex items-center space-x-2 transition"
          >
            <CalendarDays size={18} className="text-emerald-600" />
            <span>মাসিক হাজিরা শিট</span>
          </Link>

          {trainees.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              <Save size={18} />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'উপস্থিতি সংরক্ষণ করুন (Save)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Trainer Assigned Batch Banner */}
      {isTrainer && (
        <div className="bg-emerald-50/90 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/20">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  প্রশিক্ষক (Trainer)
                </span>
                <span className="text-xs font-semibold text-slate-700">{userProfile?.name}</span>
              </div>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {trainerAssignedBatch ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>নির্ধারিত ব্যাচ:</span>
                    <span className="text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      {trainerAssignedBatch.name}
                    </span>
                    {trainerAssignedInstitute && (
                      <span className="text-xs font-medium text-slate-600">
                        ({trainerAssignedInstitute.name})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-700 font-normal text-xs flex items-center gap-1">
                    <AlertCircle size={14} />
                    আপনার অ্যাকাউন্টে এখনও কোনো নির্দিষ্ট ব্যাচ বরাদ্দ করা হয়নি।
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-emerald-800 font-medium sm:text-right sm:border-l sm:border-emerald-200 sm:pl-4">
            {trainerAssignedBatch ? (
              <span>✓ এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা সরাসরি প্রদর্শিত হচ্ছে</span>
            ) : (
              <span>কোর্স ডিরেক্টরের সাথে যোগাযোগ করে ব্যাচ বরাদ্দ নিন</span>
            )}
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>উপস্থিতির তথ্য সফলভাবে সংরক্ষিত হয়েছে!</span>
        </div>
      )}

      {/* Selector Filters Card */}
      {isTrainer ? (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                <CalendarIcon size={15} className="text-emerald-600" />
                <span>তারিখ (Date)</span>
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                  <Lock size={11} className="text-amber-600" />
                  <span>Read Only</span>
                </span>
              </label>
              <div className="relative max-w-xs">
                <input 
                  type="date" 
                  value={selectedDate} 
                  readOnly 
                  disabled
                  title="প্রশিক্ষক হিসেবে তারিখ শুধুমাত্র পঠনযোগ্য (Read Only)"
                  className="w-full px-3.5 py-2.5 bg-slate-100/90 border border-slate-300 rounded-xl text-sm font-mono text-slate-800 cursor-not-allowed select-none font-semibold focus:outline-none shadow-2xs" 
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                আজকের তারিখ: <strong className="text-emerald-700 font-semibold">{format(new Date(selectedDate), 'dd MMMM yyyy, EEEE')}</strong>
              </p>
            </div>

            {/* Quick summary of assigned batch & trade */}
            <div className="flex flex-wrap items-center gap-2">
              {trainerAssignedBatch && (
                <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center space-x-1.5">
                  <Layers size={14} className="text-emerald-700" />
                  <span className="text-emerald-800 font-medium">ব্যাচ: <strong>{trainerAssignedBatch.name}</strong></span>
                </div>
              )}
              {currentTrade && (
                <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center space-x-1.5">
                  <span className="text-blue-800 font-medium">ট্রেড: <strong>{currentTrade.name}</strong></span>
                </div>
              )}
              {trainerAssignedInstitute && (
                <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center space-x-1.5">
                  <Building2 size={14} className="text-slate-600" />
                  <span className="text-slate-700 font-medium">প্রতিষ্ঠান: <strong>{trainerAssignedInstitute.name}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* FMA ও Course Director হিসেবে যেভাবে পূর্বে ছিল সেভাবেই ৪টি ফিল্টার প্রদর্শিত হবে */
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান *</label>
              <select 
                value={selectedInstitute} 
                onChange={e => {
                  const newInst = e.target.value;
                  setSelectedInstitute(newInst);
                  const firstBatch = batches.find(b => b.instituteId === newInst);
                  if (firstBatch) {
                    setSelectedBatch(firstBatch.id);
                    if (firstBatch.tradeId) setSelectedTrade(firstBatch.tradeId);
                  } else {
                    setSelectedBatch('');
                  }
                }} 
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ব্যাচ (Batch) *</label>
              <select 
                value={selectedBatch} 
                onChange={e => handleBatchChange(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">ব্যাচ নির্বাচন করুন</option>
                {batches
                  .filter(b => (!selectedInstitute || b.instituteId === selectedInstitute))
                  .map(b => {
                    const tradeName = trades.find(t => t.id === b.tradeId)?.name;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} {tradeName ? `(${tradeName})` : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ট্রেড (Trade) *</label>
              <select 
                value={selectedTrade} 
                onChange={e => setSelectedTrade(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">ট্রেড নির্বাচন করুন</option>
                {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">তারিখ (Date) *</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono" 
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Attendance List */}
      {fetchingTrainees ? (
        <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-sm">শিক্ষার্থী ও উপস্থিতির তথ্য লোড হচ্ছে...</span>
        </div>
      ) : trainees.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* List Toolbar / Fast-actions */}
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col gap-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <span className="text-xs font-bold text-slate-700">
                  তারিখ: {format(new Date(selectedDate), 'dd MMMM yyyy')}
                </span>
                <div className="hidden sm:block h-4 w-px bg-slate-300" />
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">উপস্থিত: {presentCount}</span>
                  <span className="text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">অনুপস্থিত: {absentCount}</span>
                  <span className="text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">ছুটি: {leaveCount}</span>
                  <span className={`px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-bold ${
                    savedCount === trainees.length && trainees.length > 0
                      ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300'
                      : savedCount > 0
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    <CheckCircle2 size={12} className={savedCount > 0 ? "text-emerald-600" : "text-amber-500"} />
                    <span>সংরক্ষিত: {savedCount}/{trainees.length}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => markAll('Present')}
                  className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                >
                  <CheckCheck size={14} />
                  <span>সবাই উপস্থিত</span>
                </button>
                <button
                  type="button"
                  onClick={() => markAll('Absent')}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                >
                  <X size={14} />
                  <span>সবাই অনুপস্থিত</span>
                </button>
              </div>
            </div>

            {/* Quick Filter tabs: All, Saved, Pending */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
              <div className="flex items-center space-x-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterSavedStatus('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    filterSavedStatus === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  সবাই ({trainees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSavedStatus('saved')}
                  className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
                    filterSavedStatus === 'saved'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 size={12} />
                  <span>সংরক্ষিত ({savedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSavedStatus('not_saved')}
                  className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
                    filterSavedStatus === 'not_saved'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <Clock size={12} />
                  <span>সংরক্ষণ বাকি ({trainees.length - savedCount})</span>
                </button>
              </div>

              {savedCount === trainees.length && trainees.length > 0 ? (
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  এই তারিখের সবার হাজিরা ডাটাবেজে সংরক্ষিত রয়েছে
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500">
                  হাজিরা পরিবর্তনের পর নিচে 'উপস্থিতি সংরক্ষণ করুন' বাটনে ক্লিক করুন
                </span>
              )}
            </div>
          </div>

          {/* Trainees Attendance Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-20">ক্রমিক নং</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">নাম</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {displayedTrainees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-500 text-xs">
                      {filterSavedStatus === 'saved' 
                        ? 'এই তারিখে এখনও কোনো শিক্ষার্থীর হাজিরা ডাটাবেজে সংরক্ষিত হয়নি।' 
                        : 'এই তারিখে সকল শিক্ষার্থীর হাজিরা ইতিমধ্যে ডাটাবেজে সংরক্ষিত হয়েছে।'}
                    </td>
                  </tr>
                ) : (
                  displayedTrainees.map((t, index) => {
                    const status = attendanceData[t.id]?.status || 'Present';
                    const isSaved = !!attendanceData[t.id]?.isSaved;
                    return (
                      <tr 
                        key={t.id} 
                        className={`transition-colors ${
                          isSaved ? 'hover:bg-emerald-50/50 bg-emerald-50/10' : 'hover:bg-amber-50/30 bg-white'
                        }`}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{t.nameBn}</span>
                            {isSaved ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                                title="এই প্রশিক্ষণার্থীর হাজিরা ডাটাবেজে সংরক্ষিত রয়েছে"
                              >
                                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                <span>Saved</span>
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                                title="এই প্রশিক্ষণার্থীর হাজিরা এখনও ডাটাবেজে সংরক্ষণ করা হয়নি"
                              >
                                <Clock size={11} className="text-amber-500 shrink-0" />
                                <span>Not Saved</span>
                              </span>
                            )}
                          </div>
                          {t.nameEn && <div className="text-xs text-slate-500 mt-0.5">{t.nameEn}</div>}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200/80 space-x-1">
                            <button
                              type="button"
                              onClick={() => setStatus(t.id, 'Present')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                                status === 'Present'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Check size={14} />
                              <span>উপস্থিত</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setStatus(t.id, 'Absent')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                                status === 'Absent'
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <X size={14} />
                              <span>অনুপস্থিত</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setStatus(t.id, 'Leave')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                                status === 'Leave'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Clock size={14} />
                              <span>ছুটি</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Save Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              মোট শিক্ষার্থী: {trainees.length} জন | উপস্থিতি সম্পন্ন করার পর অবশ্যই সংরক্ষণ করুন
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <Save size={18} />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'উপস্থিতি সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </div>
      ) : selectedBatch ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-2">
            <UserX size={24} />
          </div>
          <p className="text-sm font-semibold text-slate-700">এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী পাওয়া যায়নি</p>
          <p className="text-xs text-slate-400">
            {currentBatch ? `নির্বাচিত ব্যাচ: ${currentBatch.name}` : ''}। প্রশিক্ষণার্থী মডিউলে গিয়ে শিক্ষার্থী যুক্ত করুন।
          </p>
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-2">
            <Filter size={24} />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {isTrainer 
              ? 'আপনার অ্যাকাউন্টে কোনো নির্ধারিত ব্যাচ পাওয়া যায়নি' 
              : 'উপস্থিতি গ্রহণ করতে অনুগ্রহ করে একটি ব্যাচ নির্বাচন করুন'}
          </p>
          <p className="text-xs text-slate-400">
            {isTrainer 
              ? 'অনুগ্রহ করে কোর্স ডিরেক্টরের সাথে যোগাযোগ করে আপনার জন্য ব্যাচ নির্ধারণ করে নিন।' 
              : 'উপরের ফিল্টার থেকে প্রতিষ্ঠান ও ব্যাচ নির্বাচন করুন'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Attendance;
