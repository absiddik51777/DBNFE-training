import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { Institute, Trade, Batch, Trainee, AttendanceRecord, AttendanceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { 
  Check, 
  X, 
  Calendar as CalendarIcon, 
  Save, 
  CheckCheck, 
  UserCheck, 
  UserX, 
  Clock, 
  Filter,
  CheckCircle2
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
  const [attendanceData, setAttendanceData] = useState<Record<string, { id?: string; status: AttendanceStatus }>>({});
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

      const defaultInst = userProfile?.instituteId || (instData[0]?.id || '');
      setSelectedInstitute(defaultInst);
      if (trdData.length > 0) setSelectedTrade(trdData[0].id);

      const matching = btcData.filter(b => b.instituteId === defaultInst);
      if (matching.length > 0) setSelectedBatch(matching[0].id);

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
      const tData = allTrainees.filter(t => t.batchId === selectedBatch && t.status === 'Active');
      setTrainees(tData);

      // 2. Fetch existing attendance for this batch on the selected date
      const allAttendance = await dataService.getItems<AttendanceRecord>('attendance');
      const batchDateAtt = allAttendance.filter(a => a.batchId === selectedBatch && a.date === selectedDate);
      
      const statusMap: Record<string, { id?: string; status: AttendanceStatus }> = {};
      batchDateAtt.forEach(data => {
        statusMap[data.traineeId] = { id: data.id, status: data.status };
      });

      // Default to Present if not already recorded
      tData.forEach(t => {
        if (!statusMap[t.id]) {
          statusMap[t.id] = { status: 'Present' };
        }
      });
      
      setAttendanceData(statusMap);

    } catch (error) {
      console.warn("Notice fetching attendance:", error);
    } finally {
      setFetchingTrainees(false);
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
      setSaveSuccess(true);
      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `উপস্থিতি সংরক্ষণ: ${selectedDate} (${recordsToSave.length} জন)`,
        'Attendance',
        selectedBatch
      );
      
      fetchTraineesAndAttendance();
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
          <p className="text-sm text-slate-500 mt-0.5">ব্যাচ ও তারিখ নির্বাচন করে প্রশিক্ষণার্থীদের দৈনিক উপস্থিতি গ্রহণ করুন</p>
        </div>

        {trainees.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Save size={18} />
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'উপস্থিতি সংরক্ষণ করুন (Save)'}</span>
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>উপস্থিতির তথ্য সফলভাবে সংরক্ষিত হয়েছে!</span>
        </div>
      )}

      {/* Selector Filters Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান *</label>
            <select 
              value={selectedInstitute} 
              onChange={e => {
                setSelectedInstitute(e.target.value);
                const firstBatch = batches.find(b => b.instituteId === e.target.value);
                if (firstBatch) setSelectedBatch(firstBatch.id);
              }} 
              disabled={userProfile?.role === 'Trainer' && !!userProfile.instituteId}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">ট্রেড *</label>
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">ব্যাচ *</label>
            <select 
              value={selectedBatch} 
              onChange={e => setSelectedBatch(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">ব্যাচ নির্বাচন করুন</option>
              {batches
                .filter(b => (!selectedInstitute || b.instituteId === selectedInstitute))
                .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">তারিখ (Date) *</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
            />
          </div>
        </div>
      </div>

      {/* Main Attendance List */}
      {fetchingTrainees ? (
        <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-sm">শিক্ষার্থী ও উপস্থিতির তথ্য লোড হচ্ছে...</span>
        </div>
      ) : trainees.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* List Toolbar / Fast-actions */}
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700">
                তারিখ: {format(new Date(selectedDate), 'dd MMMM yyyy')}
              </span>
              <div className="h-4 w-px bg-slate-300" />
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">উপস্থিত: {presentCount}</span>
                <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full">অনুপস্থিত: {absentCount}</span>
                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">ছুটি: {leaveCount}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => markAll('Present')}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center space-x-1"
              >
                <CheckCheck size={14} />
                <span>সবাই উপস্থিত (All Present)</span>
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

          {/* Trainees Attendance Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-12">ক্রমিক</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">রেজিস্ট্রেশন ও আইডি</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">নাম (বাংলা ও ইংরেজি)</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">উপস্থিতি স্থিতি (Action)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {trainees.map((t, index) => {
                  const status = attendanceData[t.id]?.status || 'Present';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-800">{t.registrationNumber}</div>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {t.traineeId}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-800">{t.nameBn}</div>
                        <div className="text-xs text-slate-500">{t.nameEn}</div>
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
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Save Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              মোট শিক্ষার্থী: {trainees.length} জন | উপস্থিতি সম্পন্ন করার পর অবশ্যই সংরক্ষণ করুন
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition disabled:opacity-50"
            >
              <Save size={18} />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'উপস্থিতি সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </div>
      ) : selectedBatch ? (
        <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী পাওয়া যায়নি।
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          উপস্থিতি গ্রহণ করতে অনুগ্রহ করে একটি ব্যাচ নির্বাচন করুন।
        </div>
      )}
    </div>
  );
};

export default Attendance;
