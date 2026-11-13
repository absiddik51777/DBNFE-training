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
import { usePermissions } from '../contexts/PermissionsContext';
import { dataService } from '../lib/dataService';
import { printCurrentDocument } from '../lib/fileExportService';

const Results: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const canEnterMarks = hasPermission('enter_marks') || hasPermission('edit_marks');
  
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
  const [saveError, setSaveError] = useState('');

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

      let defaultInst = userProfile?.instituteId || (instData[0]?.id || '');
      let defaultBatch = '';

      if (userProfile?.role === 'Trainer') {
        if (userProfile.batchId) {
          defaultBatch = userProfile.batchId;
          const assigned = btcData.find(b => b.id === userProfile.batchId);
          if (assigned) {
            defaultInst = assigned.instituteId || defaultInst;
            if (assigned.tradeId) setSelectedTrade(assigned.tradeId);
          }
        } else {
          const matchingBatches = btcData.filter(b => b.instituteId === defaultInst);
          if (matchingBatches.length > 0) defaultBatch = matchingBatches[0].id;
        }
      } else {
        const matchingBatches = btcData.filter(b => b.instituteId === defaultInst);
        if (matchingBatches.length > 0) defaultBatch = matchingBatches[0].id;
      }

      setSelectedInstitute(defaultInst);
      setSelectedBatch(defaultBatch);
      if (defaultBatch) {
        const matchingExams = exmData.filter(e => e.batchId === defaultBatch);
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
    setSaveError('');
    if (userProfile?.role === 'Trainer' && userProfile.batchId && selectedBatch !== userProfile.batchId) {
      setSaveError("অননুমোদিত পদক্ষেপ: প্রশিক্ষক শুধুমাত্র তাঁর নির্ধারিত ব্যাচের পরীক্ষার নম্বর সংরক্ষণ করতে পারেন।");
      return;
    }

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
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ফলাফল মডিউল লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">ফলাফল ও মার্কস এন্ট্রি (Results & Marks Entry)</h1>
          <p className="text-sm text-theme-text-secondary mt-0.5">পরীক্ষার প্রাপ্ত নম্বর ইনপুট করুন ও স্বয়ংক্রিয় গ্রেড ও রেজাল্ট শিট তৈরি করুন</p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          <div className="inline-flex p-1 bg-theme-surface-subtle rounded-xl border border-theme-border">
            <button
              onClick={() => setActiveTab('entry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'entry' ? 'bg-theme-elevated text-theme-primary shadow-2xs' : 'text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              মার্কস এন্ট্রি (Entry)
            </button>
            <button
              onClick={() => setActiveTab('sheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'sheet' ? 'bg-theme-elevated text-theme-primary shadow-2xs' : 'text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              রেজাল্ট শিট (Print Sheet)
            </button>
          </div>

          {trainees.length > 0 && activeTab === 'entry' && canEnterMarks && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-sm flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              <Save size={18} />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
            </button>
          )}

          {activeTab === 'sheet' && (
            <button
              type="button"
              onClick={() => printCurrentDocument({ jobName: 'BNFE_Result_Sheet', landscape: true })}
              className="px-4 py-2 bg-theme-elevated border border-theme-border-strong hover:bg-theme-surface-hover text-theme-text-primary rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-xs transition cursor-pointer"
            >
              <Printer size={16} />
              <span>প্রিন্ট করুন</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-theme-success-soft border border-theme-success-border text-theme-success text-sm flex items-center space-x-2.5 print:hidden">
          <CheckCircle2 size={18} className="text-theme-success shrink-0" />
          <span>সকল শিক্ষার্থীর পরীক্ষার নম্বর সফলভাবে সংরক্ষিত হয়েছে!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-theme-danger-soft border border-theme-danger-border text-theme-danger text-sm flex items-center space-x-2.5 print:hidden">
          <AlertCircle size={18} className="text-theme-danger shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="bg-theme-surface p-5 rounded-2xl border border-theme-border shadow-xs print:hidden">
        <div className={`grid ${userProfile?.role === 'Trainer' ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'} gap-4`}>
          {userProfile?.role !== 'Trainer' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রতিষ্ঠান *</label>
                <select 
                  value={selectedInstitute} 
                  onChange={e => setSelectedInstitute(e.target.value)} 
                  className="w-full px-3 py-2 bg-theme-surface-subtle border border-theme-border text-theme-text-primary rounded-xl text-sm focus:bg-theme-surface focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                >
                  <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                  {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ট্রেড *</label>
                <select 
                  value={selectedTrade} 
                  onChange={e => setSelectedTrade(e.target.value)} 
                  className="w-full px-3 py-2 bg-theme-surface-subtle border border-theme-border text-theme-text-primary rounded-xl text-sm focus:bg-theme-surface focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                >
                  <option value="">ট্রেড নির্বাচন করুন</option>
                  {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                  ব্যাচ *
                </label>
                <select 
                  value={selectedBatch} 
                  onChange={e => {
                    setSelectedBatch(e.target.value);
                    const matchingExams = exams.filter(ex => ex.batchId === e.target.value);
                    if (matchingExams.length > 0) setSelectedExam(matchingExams[0].id);
                  }} 
                  className="w-full px-3 py-2 bg-theme-surface-subtle border border-theme-border text-theme-text-primary rounded-xl text-sm focus:bg-theme-surface focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                >
                  <option value="">ব্যাচ নির্বাচন করুন</option>
                  {batches
                    .filter(b => (!selectedInstitute || b.instituteId === selectedInstitute))
                    .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পরীক্ষা *</label>
            <select 
              value={selectedExam} 
              onChange={e => setSelectedExam(e.target.value)} 
              className="w-full px-3 py-2 bg-theme-surface-subtle border border-theme-border text-theme-text-primary rounded-xl text-sm focus:bg-theme-surface focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
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
          <div className="bg-theme-surface p-4 rounded-xl border border-theme-border shadow-2xs">
            <span className="text-[11px] font-semibold text-theme-text-secondary">মোট পরীক্ষার্থী</span>
            <h4 className="text-xl font-bold text-theme-text-primary mt-0.5 tabular-nums">{totalCandidates} জন</h4>
          </div>
          <div className="bg-theme-success-soft p-4 rounded-xl border border-theme-success-border">
            <span className="text-[11px] font-semibold text-theme-success">উত্তীর্ণ (Passed)</span>
            <h4 className="text-xl font-bold text-theme-success mt-0.5 tabular-nums">{passedCandidates} জন</h4>
          </div>
          <div className="bg-theme-danger-soft p-4 rounded-xl border border-theme-danger-border">
            <span className="text-[11px] font-semibold text-theme-danger">অনুত্তীর্ণ (Failed)</span>
            <h4 className="text-xl font-bold text-theme-danger mt-0.5 tabular-nums">{failedCandidates} জন</h4>
          </div>
          <div className="bg-theme-info-soft p-4 rounded-xl border border-theme-info-border">
            <span className="text-[11px] font-semibold text-theme-info">পাসের হার (Pass Rate)</span>
            <h4 className="text-xl font-bold text-theme-info mt-0.5 tabular-nums">{passRate}%</h4>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {fetchingTrainees ? (
        <div className="py-12 text-center text-theme-text-secondary bg-theme-surface rounded-2xl border border-theme-border">
          <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-sm">শিক্ষার্থী ও ফলাফল তথ্য লোড হচ্ছে...</span>
        </div>
      ) : trainees.length > 0 && currentExam ? (
        activeTab === 'entry' ? (
          /* Marks Entry Table */
          <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
            <div className="p-4 bg-theme-surface-subtle border-b border-theme-border flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text-primary tabular-nums">
                পরীক্ষা: {currentExam.name} • বিষয়: {currentExam.subject} • মোট নম্বর: {currentExam.totalMarks} • পাস নম্বর: {currentExam.passMarks}
              </span>
              <span className="text-xs text-theme-text-secondary hidden sm:inline">
                নম্বর লিখলে গ্রেড ও ফলাফল স্বয়ংক্রিয়ভাবে হিসাব হবে
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-theme-border">
                <thead className="bg-theme-surface-subtle">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase w-12">ক্রমিক</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">রেজিস্ট্রেশন</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">নাম</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase w-36">প্রাপ্ত নম্বর</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase w-24">শতকরা (%)</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase w-20">গ্রেড</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase w-28">ফলাফল</th>
                  </tr>
                </thead>
                <tbody className="bg-theme-surface divide-y divide-theme-border">
                  {trainees.map((t, index) => {
                    const record = marksData[t.id];
                    return (
                      <tr key={t.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-xs font-medium text-theme-text-muted tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap font-mono tabular-nums text-xs font-bold text-theme-text-primary">
                          {t.registrationNumber}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="text-sm font-semibold text-theme-text-primary">{t.nameBn || t.nameEn}</div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <input
                            type="number"
                            min="0"
                            max={currentExam.totalMarks}
                            value={record?.marksObtained || ''}
                            onChange={(e) => handleMarkChange(t.id, e.target.value)}
                            placeholder="0"
                            className="w-24 px-3 py-1.5 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-center font-bold text-sm tabular-nums focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center text-xs font-medium text-theme-text-secondary tabular-nums">
                          {record?.percentage || 0}%
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <span className="font-bold text-sm text-theme-accent">
                            {record?.grade || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            record?.result === 'Pass' ? 'bg-theme-success-soft text-theme-success border border-theme-success-border' :
                            record?.result === 'Fail' ? 'bg-theme-danger-soft text-theme-danger border border-theme-danger-border' : 'bg-theme-surface-subtle text-theme-text-secondary border border-theme-border'
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

            {canEnterMarks && (
              <div className="p-4 bg-theme-surface-subtle border-t border-theme-border flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-sm flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <Save size={18} />
                  <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'ফলাফল সংরক্ষণ করুন'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Printable Result Sheet View */
          <div className="bg-theme-surface text-theme-text-primary p-8 sm:p-12 rounded-2xl border border-theme-border shadow-xs print:bg-white print:text-slate-900 print:border-none print:shadow-none print:p-0">
            {/* Official Header */}
            <div className="text-center border-b-2 border-theme-border-strong print:border-slate-800 pb-5 mb-6">
              <h2 className="text-xl font-bold text-theme-text-primary print:text-slate-900 tracking-wide">
                গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
              </h2>
              <h3 className="text-lg font-bold text-theme-text-primary print:text-slate-800 mt-0.5">
                উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
              </h3>
              <p className="text-xs text-theme-text-secondary print:text-slate-600">
                প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
              </p>
              <div className="mt-3 inline-block px-4 py-1 bg-theme-surface-subtle print:bg-slate-100 rounded-md font-bold text-sm text-theme-text-primary print:text-slate-800">
                পরীক্ষার ফলাফল বিবরণী (Official Tabulation Sheet)
              </div>
            </div>

            {/* Exam Meta Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-6 bg-theme-surface-subtle print:bg-slate-50 p-4 rounded-xl border border-theme-border print:border-slate-200">
              <div>
                <span className="text-theme-text-secondary print:text-slate-500 block">প্রতিষ্ঠান:</span>
                <span className="font-bold text-theme-text-primary print:text-slate-800 text-sm">{currentInstitute?.name || '-'}</span>
              </div>
              <div>
                <span className="text-theme-text-secondary print:text-slate-500 block">ট্রেড:</span>
                <span className="font-bold text-theme-text-primary print:text-slate-800 text-sm">{currentTrade?.name || '-'}</span>
              </div>
              <div>
                <span className="text-theme-text-secondary print:text-slate-500 block">ব্যাচ:</span>
                <span className="font-bold text-theme-text-primary print:text-slate-800 text-sm">{currentBatch?.name || '-'}</span>
              </div>
              <div>
                <span className="text-theme-text-secondary print:text-slate-500 block">পরীক্ষার নাম ও তারিখ:</span>
                <span className="font-bold text-theme-text-primary print:text-slate-800 text-sm tabular-nums">{currentExam.name} ({format(currentExam.date, 'dd/MM/yyyy')})</span>
              </div>
            </div>

            {/* Print Table */}
            <table className="min-w-full border-collapse border border-theme-border-strong print:border-slate-300 text-xs">
              <thead className="bg-theme-surface-subtle print:bg-slate-100">
                <tr>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center w-12">ক্রঃ</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-left">রেজিস্ট্রেশন নং</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-left">প্রশিক্ষণার্থীর নাম</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center">মোট নম্বর</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center">প্রাপ্ত নম্বর</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center">শতকরা (%)</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center">গ্রেড</th>
                  <th className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center">ফলাফল</th>
                </tr>
              </thead>
              <tbody>
                {trainees.map((t, idx) => {
                  const r = marksData[t.id];
                  return (
                    <tr key={t.id} className="hover:bg-theme-surface-hover print:hover:bg-transparent">
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center tabular-nums">{idx + 1}</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 font-mono tabular-nums font-bold">{t.registrationNumber}</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 font-semibold">{t.nameBn || t.nameEn}</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center tabular-nums">{currentExam.totalMarks}</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center font-bold tabular-nums">{r?.marksObtained || 0}</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center tabular-nums">{r?.percentage || 0}%</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center font-bold">{r?.grade || '-'}</td>
                      <td className="border border-theme-border-strong print:border-slate-300 px-3 py-2 text-center font-bold">
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
                <div className="border-t border-theme-border-strong print:border-slate-400 pt-1 font-semibold text-theme-text-secondary print:text-slate-700">প্রশিক্ষকের স্বাক্ষর</div>
              </div>
              <div>
                <div className="border-t border-theme-border-strong print:border-slate-400 pt-1 font-semibold text-theme-text-secondary print:text-slate-700">FMA স্বাক্ষর ও সীল</div>
              </div>
              <div>
                <div className="border-t border-theme-border-strong print:border-slate-400 pt-1 font-semibold text-theme-text-secondary print:text-slate-700">কোর্স পরিচালকের স্বাক্ষর ও সীল</div>
              </div>
            </div>
          </div>
        )
      ) : selectedBatch ? (
        <div className="py-12 text-center text-theme-text-muted bg-theme-surface rounded-2xl border border-theme-border">
          এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী অথবা পরীক্ষা পাওয়া যায়নি।
        </div>
      ) : (
        <div className="py-12 text-center text-theme-text-muted bg-theme-surface rounded-2xl border border-theme-border">
          অনুগ্রহ করে ব্যাচ ও পরীক্ষা নির্বাচন করুন।
        </div>
      )}
    </div>
  );
};

export default Results;
