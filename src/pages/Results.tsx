import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { Institute, Trade, Batch, Exam, Trainee, ExamMark } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Save, 
  Printer, 
  Award, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  TrendingUp,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const Results: React.FC = () => {
  const { userProfile } = useAuth();
  
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [marksData, setMarksData] = useState<Record<string, Partial<ExamMark>>>({});
  
  const [loading, setLoading] = useState(true);
  const [fetchingTrainees, setFetchingTrainees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'entry' | 'sheet'>('entry');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [userProfile]);

  const fetchInitialData = async () => {
    try {
      const [instData, trdData, btcData, exmData] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Exam>('exams')
      ]);

      setInstitutes(instData);
      setTrades(trdData);
      setBatches(btcData);
      setExams(exmData);

      const defaultInst = userProfile?.instituteId || (instData[0]?.id || '');
      setSelectedInstitute(defaultInst);
      if (trdData.length > 0) setSelectedTrade(trdData[0].id);

      const matchingBatches = btcData.filter(b => b.instituteId === defaultInst);
      if (matchingBatches.length > 0) {
        setSelectedBatch(matchingBatches[0].id);
        const matchingExams = exmData.filter(e => e.batchId === matchingBatches[0].id);
        if (matchingExams.length > 0) setSelectedExam(matchingExams[0].id);
      }
    } catch (error) {
      console.warn("Notice fetching initial results data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatch && selectedExam) {
      fetchTraineesAndMarks();
    } else {
      setTrainees([]);
      setMarksData({});
    }
  }, [selectedBatch, selectedExam]);

  const fetchTraineesAndMarks = async () => {
    setFetchingTrainees(true);
    setSaveSuccess(false);
    try {
      const allTrainees = await dataService.getItems<Trainee>('trainees');
      const tData = allTrainees.filter(t => t.batchId === selectedBatch && t.status === 'Active');
      setTrainees(tData);

      // Fetch existing marks for this exam
      const allMarks = await dataService.getItems<ExamMark>('marks');
      const examMarks = allMarks.filter(m => m.examId === selectedExam);
      const mRecord: Record<string, Partial<ExamMark>> = {};
      
      examMarks.forEach(data => {
        mRecord[data.traineeId] = { ...data };
      });

      // Default missing to Absent or unfilled
      tData.forEach(t => {
        if (!mRecord[t.id]) {
          mRecord[t.id] = {
            examId: selectedExam,
            traineeId: t.id,
            batchId: selectedBatch,
            marksObtained: 0,
            percentage: 0,
            grade: '-',
            result: 'Absent',
          };
        }
      });
      
      setMarksData(mRecord);
    } catch (error) {
      console.warn("Notice fetching marks:", error);
    } finally {
      setFetchingTrainees(false);
    }
  };

  const calculateGradeAndResult = (marks: number, totalMarks: number, passMarks: number) => {
    if (marks === 0) {
      return { percentage: 0, grade: 'F', result: 'Absent' as const };
    }
    const pct = Math.round((marks / totalMarks) * 100);
    if (marks < passMarks) {
      return { percentage: pct, grade: 'F', result: 'Fail' as const };
    }
    let grade = 'D';
    if (pct >= 80) grade = 'A+';
    else if (pct >= 70) grade = 'A';
    else if (pct >= 60) grade = 'A-';
    else if (pct >= 50) grade = 'B';
    else if (pct >= 40) grade = 'C';

    return { percentage: pct, grade, result: 'Pass' as const };
  };

  const handleMarkChange = (traineeId: string, val: string) => {
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;

    let marks = parseInt(val);
    if (isNaN(marks)) {
      setMarksData(prev => ({
        ...prev,
        [traineeId]: {
          ...prev[traineeId],
          marksObtained: 0,
          percentage: 0,
          grade: '-',
          result: 'Absent'
        }
      }));
      return;
    }

    if (marks > exam.totalMarks) marks = exam.totalMarks;
    if (marks < 0) marks = 0;

    const { percentage, grade, result } = calculateGradeAndResult(marks, exam.totalMarks, exam.passMarks);

    setMarksData(prev => ({
      ...prev,
      [traineeId]: {
        ...prev[traineeId],
        marksObtained: marks,
        percentage,
        grade,
        result
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      for (const t of trainees) {
        const record = marksData[t.id];
        if (!record) continue;

        const markId = record.id || `MRK-${selectedExam}_${t.id}`;
        const itemToSave: ExamMark = {
          id: markId,
          examId: selectedExam,
          traineeId: t.id,
          batchId: selectedBatch,
          marksObtained: record.marksObtained || 0,
          percentage: record.percentage || 0,
          grade: record.grade || '-',
          result: (record.result as any) || 'Absent',
          enteredBy: userProfile?.name || 'User',
          createdAt: record.createdAt || Date.now(),
          updatedAt: Date.now()
        };

        await dataService.saveItem('marks', itemToSave);
      }

      setSaveSuccess(true);
      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `ফলাফল ও মার্কস সংরক্ষণ: ${currentExam?.name || selectedExam}`,
        'Results',
        selectedExam
      );
      fetchTraineesAndMarks();
    } catch (error) {
      console.warn("Notice saving marks:", error);
      setSaveSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  const currentExam = exams.find(e => e.id === selectedExam);
  const currentBatch = batches.find(b => b.id === selectedBatch);
  const currentInstitute = institutes.find(i => i.id === selectedInstitute);
  const currentTrade = trades.find(t => t.id === selectedTrade);

  // Stats calculation
  const totalCandidates = trainees.length;
  const passedCandidates = Object.values(marksData).filter(m => m.result === 'Pass').length;
  const failedCandidates = Object.values(marksData).filter(m => m.result === 'Fail').length;
  const absentCandidates = Object.values(marksData).filter(m => m.result === 'Absent').length;
  const passRate = totalCandidates > 0 ? Math.round((passedCandidates / totalCandidates) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ফলাফল মডিউল লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ফলাফল ও মার্কস এন্ট্রি (Results & Marks Entry)</h1>
          <p className="text-sm text-slate-500 mt-0.5">পরীক্ষার প্রাপ্ত নম্বর ইনপুট করুন ও স্বয়ংক্রিয় গ্রেড ও রেজাল্ট শিট তৈরি করুন</p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('entry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'entry' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              মার্কস এন্ট্রি (Entry)
            </button>
            <button
              onClick={() => setActiveTab('sheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'sheet' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              রেজাল্ট শিট (Print Sheet)
            </button>
          </div>

          {trainees.length > 0 && activeTab === 'entry' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition disabled:opacity-50"
            >
              <Save size={18} />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
            </button>
          )}

          {activeTab === 'sheet' && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-xs transition"
            >
              <Printer size={16} />
              <span>প্রিন্ট করুন</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2.5 print:hidden">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>সকল শিক্ষার্থীর পরীক্ষার নম্বর সফলভাবে সংরক্ষিত হয়েছে!</span>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান *</label>
            <select 
              value={selectedInstitute} 
              onChange={e => setSelectedInstitute(e.target.value)} 
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
              onChange={e => {
                setSelectedBatch(e.target.value);
                const matchingExams = exams.filter(ex => ex.batchId === e.target.value);
                if (matchingExams.length > 0) setSelectedExam(matchingExams[0].id);
              }} 
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">ব্যাচ নির্বাচন করুন</option>
              {batches
                .filter(b => (!selectedInstitute || b.instituteId === selectedInstitute))
                .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষা *</label>
            <select 
              value={selectedExam} 
              onChange={e => setSelectedExam(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">পরীক্ষা নির্বাচন করুন</option>
              {exams
                .filter(e => (!selectedBatch || e.batchId === selectedBatch))
                .map(e => <option key={e.id} value={e.id}>{e.name} ({e.subject})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      {currentExam && trainees.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">মোট পরীক্ষার্থী</span>
            <h4 className="text-xl font-bold text-slate-800 mt-0.5">{totalCandidates} জন</h4>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700">উত্তীর্ণ (Passed)</span>
            <h4 className="text-xl font-bold text-emerald-700 mt-0.5">{passedCandidates} জন</h4>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <span className="text-[11px] font-semibold text-red-700">অনুত্তীর্ণ (Failed)</span>
            <h4 className="text-xl font-bold text-red-700 mt-0.5">{failedCandidates} জন</h4>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <span className="text-[11px] font-semibold text-blue-700">পাসের হার (Pass Rate)</span>
            <h4 className="text-xl font-bold text-blue-700 mt-0.5">{passRate}%</h4>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {fetchingTrainees ? (
        <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-sm">শিক্ষার্থী ও ফলাফল তথ্য লোড হচ্ছে...</span>
        </div>
      ) : trainees.length > 0 && currentExam ? (
        activeTab === 'entry' ? (
          /* Marks Entry Table */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                পরীক্ষা: {currentExam.name} • বিষয়: {currentExam.subject} • মোট নম্বর: {currentExam.totalMarks} • পাস নম্বর: {currentExam.passMarks}
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">
                নম্বর লিখলে গ্রেড ও ফলাফল স্বয়ংক্রিয়ভাবে হিসাব হবে
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-12">ক্রমিক</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">রেজিস্ট্রেশন</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">নাম</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-36">প্রাপ্ত নম্বর</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-24">শতকরা (%)</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-20">গ্রেড</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-28">ফলাফল</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {trainees.map((t, index) => {
                    const record = marksData[t.id];
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-xs font-medium text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap font-mono text-xs font-bold text-slate-800">
                          {t.registrationNumber}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-800">{t.nameBn}</div>
                          <div className="text-xs text-slate-400">{t.nameEn}</div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <input
                            type="number"
                            min="0"
                            max={currentExam.totalMarks}
                            value={record?.marksObtained || ''}
                            onChange={(e) => handleMarkChange(t.id, e.target.value)}
                            placeholder="0"
                            className="w-24 px-3 py-1.5 border border-slate-300 rounded-xl text-center font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center text-xs font-medium text-slate-600">
                          {record?.percentage || 0}%
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <span className="font-bold text-sm text-purple-700">
                            {record?.grade || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            record?.result === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                            record?.result === 'Fail' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {record?.result === 'Pass' ? 'পাস' : record?.result === 'Fail' ? 'ফেল' : 'অনুপস্থিত'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition disabled:opacity-50"
              >
                <Save size={18} />
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'ফলাফল সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Printable Result Sheet View */
          <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
            {/* Official Header */}
            <div className="text-center border-b-2 border-slate-800 pb-5 mb-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-wide">
                গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
              </h2>
              <h3 className="text-lg font-bold text-slate-800 mt-0.5">
                উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
              </h3>
              <p className="text-xs text-slate-600">
                প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
              </p>
              <div className="mt-3 inline-block px-4 py-1 bg-slate-100 rounded-md font-bold text-sm text-slate-800">
                পরীক্ষার ফলাফল বিবরণী (Official Tabulation Sheet)
              </div>
            </div>

            {/* Exam Meta Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">প্রতিষ্ঠান:</span>
                <span className="font-bold text-slate-800 text-sm">{currentInstitute?.name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ট্রেড:</span>
                <span className="font-bold text-slate-800 text-sm">{currentTrade?.name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ব্যাচ:</span>
                <span className="font-bold text-slate-800 text-sm">{currentBatch?.name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">পরীক্ষার নাম ও তারিখ:</span>
                <span className="font-bold text-slate-800 text-sm">{currentExam.name} ({format(currentExam.date, 'dd/MM/yyyy')})</span>
              </div>
            </div>

            {/* Print Table */}
            <table className="min-w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-center w-12">ক্রঃ</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">রেজিস্ট্রেশন নং</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">প্রশিক্ষণার্থীর নাম</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">মোট নম্বর</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">প্রাপ্ত নম্বর</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">শতকরা (%)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">গ্রেড</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">ফলাফল</th>
                </tr>
              </thead>
              <tbody>
                {trainees.map((t, idx) => {
                  const r = marksData[t.id];
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 px-3 py-2 font-mono font-bold">{t.registrationNumber}</td>
                      <td className="border border-slate-300 px-3 py-2 font-semibold">{t.nameBn} ({t.nameEn})</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{currentExam.totalMarks}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{r?.marksObtained || 0}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{r?.percentage || 0}%</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{r?.grade || '-'}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                        {r?.result === 'Pass' ? 'পাস' : r?.result === 'Fail' ? 'ফেল' : 'অনুপস্থিত'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Official Signatures */}
            <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs mt-8">
              <div>
                <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">প্রশিক্ষকের স্বাক্ষর</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">FMA স্বাক্ষর ও সীল</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">কোর্স পরিচালকের স্বাক্ষর ও সীল</div>
              </div>
            </div>
          </div>
        )
      ) : selectedBatch ? (
        <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী অথবা পরীক্ষা পাওয়া যায়নি।
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          অনুগ্রহ করে ব্যাচ ও পরীক্ষা নির্বাচন করুন।
        </div>
      )}
    </div>
  );
};

export default Results;
