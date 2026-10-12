import React, { useState, useEffect } from 'react';
import { Trainee, Institute, Trade, Batch, AttendanceRecord, ExamMark } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Search, 
  FileCheck, 
  Building2, 
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const MIN_ATTENDANCE_REQUIRED = 75; // 75% minimum attendance required

const Certificates: React.FC = () => {
  const { userProfile } = useAuth();
  
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, { total: number; present: number; pct: number }>>({});
  const [examPassedSummary, setExamPassedSummary] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTraineeForCert, setSelectedTraineeForCert] = useState<Trainee | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [instList, tradesList, batchesList, tList, attList, marksList] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<AttendanceRecord>('attendance'),
        dataService.getItems<ExamMark>('marks')
      ]);

      setTrainees(tList);
      setInstitutes(instList);
      setTrades(tradesList);
      setBatches(batchesList);

      // Calculate attendance per trainee
      const attMap: Record<string, { total: number; present: number; pct: number }> = {};
      attList.forEach(att => {
        if (!attMap[att.traineeId]) {
          attMap[att.traineeId] = { total: 0, present: 0, pct: 0 };
        }
        attMap[att.traineeId].total += 1;
        if (att.status === 'Present') {
          attMap[att.traineeId].present += 1;
        }
      });

      Object.keys(attMap).forEach(id => {
        const item = attMap[id];
        item.pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
      });
      setAttendanceSummary(attMap);

      // Calculate passed exams per trainee
      const passMap: Record<string, boolean> = {};
      marksList.forEach(m => {
        if (m.result === 'Pass') {
          passMap[m.traineeId] = true;
        }
      });
      setExamPassedSummary(passMap);

      if (tList.length > 0) {
        setSelectedTraineeForCert(tList[0]);
      }

    } catch (err) {
      console.warn("Notice fetching certificate data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getInstituteName = (id: string) => institutes.find(i => i.id === id)?.name || '-';
  const getTradeName = (id: string) => trades.find(t => t.id === id)?.name || '-';
  const getBatchName = (id: string) => batches.find(t => t.id === id)?.name || '-';

  const isEligible = (t: Trainee) => {
    const attPct = attendanceSummary[t.id]?.pct ?? 0;
    const hasPassed = examPassedSummary[t.id] ?? false;
    return attPct >= MIN_ATTENDANCE_REQUIRED && hasPassed;
  };

  const filtered = trainees.filter(t => 
    t.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.nameBn.includes(searchTerm) ||
    t.registrationNumber.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>সার্টিফিকেট মডিউল লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">সার্টিফিকেট ও কোর্স সমাপন (Certificates & Completion)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ন্যূনতম ৭৫% উপস্থিতি ও পরীক্ষায় উত্তীর্ণ শিক্ষার্থীদের সরকারি সনদপত্র প্রদান
          </p>
        </div>

        {selectedTraineeForCert && (
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition"
          >
            <Printer size={16} />
            <span>সার্টিফিকেট প্রিন্ট (Print Certificate)</span>
          </button>
        )}
      </div>

      {/* Main Grid: Eligibility List & Certificate Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
        {/* Left Side: Trainee Eligibility Table (Hidden during print) */}
        <div className="lg:col-span-5 space-y-4 print:hidden">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="প্রশিক্ষণার্থী খুঁজুন..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                </div>
              ) : (
                filtered.map(t => {
                  const eligible = isEligible(t);
                  const attPct = attendanceSummary[t.id]?.pct ?? 0;
                  const isSelected = selectedTraineeForCert?.id === t.id;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTraineeForCert(t)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                          : 'border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{t.nameBn}</h4>
                          <p className="text-xs text-slate-500">{t.nameEn}</p>
                          <span className="text-[11px] font-mono text-slate-400">{t.registrationNumber}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                          eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {eligible ? 'সনদ যোগ্য' : 'অযোগ্য'}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                        <span>উপস্থিতি: <b className="text-slate-800">{attPct}%</b></span>
                        <span>ট্রেড: <b className="text-slate-800">{getTradeName(t.tradeId)}</b></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Certificate Certificate Canvas */}
        <div className="lg:col-span-7">
          {selectedTraineeForCert ? (
            <div className="bg-white rounded-3xl border-8 border-double border-emerald-800/40 p-8 sm:p-12 shadow-md relative overflow-hidden text-center print:border-4 print:p-6 print:m-0 print:shadow-none">
              {/* Corner Ornaments */}
              <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-emerald-800" />
              <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-emerald-800" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-emerald-800" />
              <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-emerald-800" />

              {/* Watermark Logo Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <GraduationCap size={360} className="text-emerald-900" />
              </div>

              {/* Government Header */}
              <div className="mb-6 relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
                </h3>
                <h2 className="text-xl font-bold text-emerald-950 mt-1">
                  উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
                </h2>
                <p className="text-xs text-slate-500">
                  প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
                </p>
                <div className="w-24 h-1 bg-amber-500 mx-auto mt-3 rounded-full" />
              </div>

              {/* Certificate Title */}
              <div className="my-6 relative z-10">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  বৃত্তিমূলক প্রশিক্ষণ সমাপনী সনদপত্র
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1 font-serif">
                  CERTIFICATE OF VOCATIONAL TRAINING
                </h1>
              </div>

              {/* Body Content */}
              <div className="text-sm text-slate-700 leading-relaxed max-w-lg mx-auto space-y-3 relative z-10">
                <p>প্রত্যয়ন করা যাচ্ছে যে,</p>
                <p className="text-2xl font-bold text-emerald-800 border-b border-dashed border-emerald-300 pb-1">
                  {selectedTraineeForCert.nameBn} ({selectedTraineeForCert.nameEn})
                </p>
                <p className="text-xs text-slate-600">
                  পিতা: {selectedTraineeForCert.fatherNameBn} • মাতা: {selectedTraineeForCert.motherNameBn}
                </p>
                <p className="text-xs font-mono text-slate-500">
                  রেজিস্ট্রেশন নং: {selectedTraineeForCert.registrationNumber}
                </p>
                <p className="pt-2">
                  সফলতার সাথে উপানুষ্ঠানিক শিক্ষা ব্যুরো পরিচালিত ঝরে পড়া শিক্ষার্থীদের জন্য{' '}
                  <span className="font-bold text-slate-900">{getTradeName(selectedTraineeForCert.tradeId)}</span> ট্রেডে{' '}
                  <span className="font-bold text-slate-900">{getInstituteName(selectedTraineeForCert.instituteId)}</span> কেন্দ্রে{' '}
                  <span className="font-bold text-slate-900">৬ মাস মেয়াদী</span> বৃত্তিমূলক দক্ষতা প্রশিক্ষণ সম্পন্ন করেছেন।
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-16 mt-8 border-t border-slate-200 text-xs text-slate-600 relative z-10">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    কেন্দ্রীয় প্রশিক্ষক
                  </div>
                  <span className="text-[10px] text-slate-400">Trainer</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    ফিল্ড মনিটরিং অ্যাসোসিয়েট
                  </div>
                  <span className="text-[10px] text-slate-400">FMA, DBNFE</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    কোর্স পরিচালক
                  </div>
                  <span className="text-[10px] text-slate-400">Course Director</span>
                </div>
              </div>

              {/* Certificate Issue Footer */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                <span>সনদ নং: CERT-BNFE-{selectedTraineeForCert.registrationNumber.slice(-6)}</span>
                <span>ইস্যুর তারিখ: {format(new Date(), 'dd MMMM yyyy')}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              বামদিকের তালিকা থেকে শিক্ষার্থী নির্বাচন করুন।
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Certificates;
