import React, { useState, useEffect } from 'react';
import { Institute, Trade, Batch, Trainee, Exam, ExamMark, AttendanceRecord } from '../types';
import { 
  FileText, 
  Download, 
  Printer, 
  Filter, 
  Users, 
  Calendar, 
  Award, 
  Building2, 
  Layers 
} from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

type ReportType = 
  | 'trainees_master' 
  | 'institute_trainees' 
  | 'trade_trainees' 
  | 'attendance_summary' 
  | 'exam_results' 
  | 'completion_certificates';

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('trainees_master');
  
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);

  // Filters
  const [filterInstitute, setFilterInstitute] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterBatch, setFilterBatch] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [instList, tradesList, batchesList, traineesList, attList, examsList, marksList] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<AttendanceRecord>('attendance'),
        dataService.getItems<Exam>('exams'),
        dataService.getItems<ExamMark>('marks')
      ]);

      setInstitutes(instList);
      setTrades(tradesList);
      setBatches(batchesList);
      setTrainees(traineesList);
      setAttendance(attList);
      setExams(examsList);
      setMarks(marksList);

    } catch (err) {
      console.warn("Notice fetching reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getInstituteName = (id: string) => institutes.find(i => i.id === id)?.name || '-';
  const getTradeName = (id: string) => trades.find(t => t.id === id)?.name || '-';
  const getBatchName = (id: string) => batches.find(t => t.id === id)?.name || '-';

  // Filter trainees
  const filteredTrainees = trainees.filter(t => {
    const matchInst = !filterInstitute || t.instituteId === filterInstitute;
    const matchTrade = !filterTrade || t.tradeId === filterTrade;
    const matchBatch = !filterBatch || t.batchId === filterBatch;
    return matchInst && matchTrade && matchBatch;
  });

  const exportCurrentReportCSV = () => {
    let csv = '';
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    if (reportType === 'trainees_master' || reportType === 'institute_trainees' || reportType === 'trade_trainees') {
      csv = 'SL,Registration No,Name (BN),Name (EN),Mobile,Gender,Institute,Trade,Batch,Status\n';
      filteredTrainees.forEach((t, i) => {
        csv += `${i + 1},"${t.registrationNumber}","${t.nameBn}","${t.nameEn}","${t.mobileNumber}","${t.gender}","${getInstituteName(t.instituteId)}","${getTradeName(t.tradeId)}","${getBatchName(t.batchId)}","${t.status}"\n`;
      });
    } else if (reportType === 'attendance_summary') {
      csv = 'SL,Registration No,Name,Total Classes,Present,Absent,Percentage (%)\n';
      filteredTrainees.forEach((t, i) => {
        const traineeAtt = attendance.filter(a => a.traineeId === t.id);
        const present = traineeAtt.filter(a => a.status === 'Present').length;
        const total = traineeAtt.length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        csv += `${i + 1},"${t.registrationNumber}","${t.nameBn}",${total},${present},${total - present},${pct}%\n`;
      });
    } else if (reportType === 'exam_results') {
      csv = 'SL,Registration No,Name,Exam,Marks,Grade,Result\n';
      marks.forEach((m, i) => {
        const trainee = trainees.find(t => t.id === m.traineeId);
        const exam = exams.find(e => e.id === m.examId);
        if (trainee && exam) {
          csv += `${i + 1},"${trainee.registrationNumber}","${trainee.nameBn}","${exam.name}",${m.marksObtained},"${m.grade}","${m.result}"\n`;
        }
      });
    } else {
      csv = 'SL,Registration No,Name,Institute,Trade,Attendance %,Exam Result,Certificate Status\n';
      filteredTrainees.forEach((t, i) => {
        const traineeAtt = attendance.filter(a => a.traineeId === t.id);
        const present = traineeAtt.filter(a => a.status === 'Present').length;
        const total = traineeAtt.length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        const passed = marks.some(m => m.traineeId === t.id && m.result === 'Pass');
        const eligible = total > 0 && pct >= 75 && passed;
        csv += `${i + 1},"${t.registrationNumber}","${t.nameBn}","${getInstituteName(t.instituteId)}","${getTradeName(t.tradeId)}",${pct}%,${passed ? 'Pass' : 'Pending'},${eligible ? 'Eligible' : 'Not Eligible'}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `bnfe_report_${reportType}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>প্রতিবেদন লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">প্রতিবেদন ও অ্যানালিটিক্স (Reports & Analytics)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            প্রশিক্ষণার্থী, উপস্থিতি, ফলাফল ও সনদপত্র সম্পর্কিত বিস্তারিত রিপোর্ট প্রস্তুত ও ডাউনলোড
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={exportCurrentReportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition"
          >
            <Download size={16} />
            <span>এক্সপোর্ট (CSV)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-xs transition"
          >
            <Printer size={16} />
            <span>প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap gap-1.5 print:hidden">
        {[
          { id: 'trainees_master', name: 'প্রশিক্ষণার্থী তালিকা', icon: Users },
          { id: 'attendance_summary', name: 'উপস্থিতির সারসংক্ষেপ', icon: Calendar },
          { id: 'exam_results', name: 'পরীক্ষার ফলাফল', icon: Award },
          { id: 'completion_certificates', name: 'কোর্স সমাপন ও সনদ যোগ্যতা', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={16} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Options Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">প্রতিষ্ঠান ফিল্টার</label>
            <select
              value={filterInstitute}
              onChange={e => setFilterInstitute(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">সকল প্রতিষ্ঠান</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">ট্রেড ফিল্টার</label>
            <select
              value={filterTrade}
              onChange={e => setFilterTrade(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">সকল ট্রেড</option>
              {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">ব্যাচ ফিল্টার</label>
            <select
              value={filterBatch}
              onChange={e => setFilterBatch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">সকল ব্যাচ</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Generated Report View Sheet */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Printable Official Header */}
        <div className="text-center border-b-2 border-slate-800 pb-5 mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-wide">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h2>
          <h3 className="text-lg font-bold text-slate-800 mt-0.5">উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)</h3>
          <p className="text-xs text-slate-600">ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কর্মসূচি</p>
          <div className="mt-3 inline-block px-4 py-1 bg-slate-100 rounded-md font-bold text-sm text-slate-800">
            {reportType === 'trainees_master' && 'প্রশিক্ষণার্থী তালিকা প্রতিবেদন (Trainee Master Report)'}
            {reportType === 'attendance_summary' && 'উপস্থিতি সারসংক্ষেপ প্রতিবেদন (Attendance Report)'}
            {reportType === 'exam_results' && 'পরীক্ষার ফলাফল বিবরণী (Examination Results Report)'}
            {reportType === 'completion_certificates' && 'কোর্স সমাপন ও সনদপত্র যোগ্যতা বিবরণী'}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            প্রতিবেদন প্রস্তুতের তারিখ: {format(new Date(), 'dd MMMM yyyy, hh:mm a')}
          </div>
        </div>

        {/* Report Table Render */}
        <div className="overflow-x-auto">
          {reportType === 'trainees_master' && (
            <table className="min-w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-center w-12">ক্রঃ</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">রেজিঃ নম্বর</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">নাম (বাংলা ও ইংরেজি)</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">পিতা ও মাতা</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">প্রতিষ্ঠান ও ট্রেড</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">ব্যাচ</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">মোবাইল</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainees.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-3 py-2 text-center">{idx + 1}</td>
                    <td className="border border-slate-300 px-3 py-2 font-mono font-bold">{t.registrationNumber}</td>
                    <td className="border border-slate-300 px-3 py-2 font-medium">
                      <div>{t.nameBn}</div>
                      <div className="text-slate-500">{t.nameEn}</div>
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      <div>পিতা: {t.fatherNameBn}</div>
                      <div>মাতা: {t.motherNameBn}</div>
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      <div className="font-semibold">{getInstituteName(t.instituteId)}</div>
                      <div className="text-emerald-700">{getTradeName(t.tradeId)}</div>
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{getBatchName(t.batchId)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-mono">{t.mobileNumber}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-semibold">
                      {t.status === 'Active' ? 'সক্রিয়' : t.status === 'Completed' ? 'সম্পন্ন' : 'ঝরে পড়া'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'attendance_summary' && (
            <table className="min-w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-center w-12">ক্রঃ</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">রেজিস্ট্রেশন</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">নাম</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">প্রতিষ্ঠান ও ট্রেড</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">মোট ক্লাস</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">উপস্থিত</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">অনুপস্থিত</th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-bold">উপস্থিতির শতকরা (%)</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainees.map((t, idx) => {
                  const traineeAtt = attendance.filter(a => a.traineeId === t.id);
                  const present = traineeAtt.filter(a => a.status === 'Present').length;
                  const total = traineeAtt.length;
                  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 px-3 py-2 font-mono font-bold">{t.registrationNumber}</td>
                      <td className="border border-slate-300 px-3 py-2 font-medium">{t.nameBn}</td>
                      <td className="border border-slate-300 px-3 py-2">{getInstituteName(t.instituteId)} - {getTradeName(t.tradeId)}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{total}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700 font-bold">{present}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{total - present}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-900">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {reportType === 'exam_results' && (
            <table className="min-w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-center w-12">ক্রঃ</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">রেজিস্ট্রেশন</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">শিক্ষার্থীর নাম</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">পরীক্ষার নাম</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">প্রাপ্ত নম্বর</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">শতকরা (%)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">গ্রেড</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">ফলাফল</th>
                </tr>
              </thead>
              <tbody>
                {marks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-slate-300 py-6 text-center text-slate-400">
                      কোনো ফলাফল রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  marks.map((m, idx) => {
                    const trainee = trainees.find(t => t.id === m.traineeId);
                    const exam = exams.find(e => e.id === m.examId);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 px-3 py-2 font-mono font-bold">{trainee?.registrationNumber || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 font-medium">{trainee?.nameBn || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2">{exam?.name || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-bold">{m.marksObtained}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center">{m.percentage}%</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-bold text-purple-700">{m.grade}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                          {m.result === 'Pass' ? 'পাস' : 'ফেল'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {reportType === 'completion_certificates' && (
            <table className="min-w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-center w-12">ক্রঃ</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">রেজিস্ট্রেশন</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">নাম</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">প্রতিষ্ঠান ও ট্রেড</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">উপস্থিতি হার</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">পরীক্ষায় উত্তীর্ণ?</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">সার্টিফিকেট যোগ্যতা</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainees.map((t, idx) => {
                  const traineeAtt = attendance.filter(a => a.traineeId === t.id);
                  const present = traineeAtt.filter(a => a.status === 'Present').length;
                  const total = traineeAtt.length;
                  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                  const passed = marks.some(m => m.traineeId === t.id && m.result === 'Pass');
                  const eligible = total > 0 && pct >= 75 && passed;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 px-3 py-2 font-mono font-bold">{t.registrationNumber}</td>
                      <td className="border border-slate-300 px-3 py-2 font-medium">{t.nameBn}</td>
                      <td className="border border-slate-300 px-3 py-2">{getInstituteName(t.instituteId)} - {getTradeName(t.tradeId)}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{pct}%</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                        {passed ? 'হ্যাঁ (পাস)' : 'মুল্যায়ন চলমান'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                          eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {eligible ? 'সনদ যোগ্য (Eligible)' : 'অযোগ্য'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Official Signatures for Prints */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs mt-8">
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">প্রতিবেদন প্রস্তুতকারী</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">উপজেলা/ফিল্ড কর্মকর্তা</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">সহকারী পরিচালক / ডিবিএনএফই</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
