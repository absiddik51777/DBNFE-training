import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Trainee, Institute, Trade, Batch, AttendanceRecord, ExamMark, Exam } from '../../types';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Award, 
  BookOpen, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Printer, 
  Edit2, 
  FileText 
} from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../../lib/dataService';

const TraineeProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [trainee, setTrainee] = useState<Trainee | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [examResults, setExamResults] = useState<{ mark: ExamMark; exam?: Exam }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [trainees, institutes, trades, batches, allAtt, marks, exams] = await Promise.all([
        dataService.getItems<Trainee>('trainees'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<AttendanceRecord>('attendance'),
        dataService.getItems<ExamMark>('marks'),
        dataService.getItems<Exam>('exams'),
      ]);

      const t = trainees.find(item => item.id === id);
      if (!t) {
        setLoading(false);
        return;
      }

      setTrainee(t);
      setInstitute(institutes.find(i => i.id === t.instituteId) || null);
      setTrade(trades.find(tr => tr.id === t.tradeId) || null);
      setBatch(batches.find(b => b.id === t.batchId) || null);

      const attList = allAtt.filter(a => a.traineeId === id);
      setAttendanceRecords(attList);

      const tMarks = marks.filter(m => m.traineeId === id).map(m => ({
        mark: m,
        exam: exams.find(e => e.id === m.examId)
      }));
      setExamResults(tMarks);

    } catch (err) {
      console.warn("Notice fetching trainee profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const printProfile = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>প্রশিক্ষণার্থী প্রোফাইল লোড হচ্ছে...</span>
      </div>
    );
  }

  if (!trainee) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500">প্রশিক্ষণার্থী পাওয়া যায়নি।</p>
        <button onClick={() => navigate('/trainees')} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">
          তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  // Attendance Calculations
  const totalDays = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
  const absentCount = attendanceRecords.filter(a => a.status === 'Absent').length;
  const leaveCount = attendanceRecords.filter(a => a.status === 'Leave').length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 print:p-0 print:m-0">
      {/* Top action bar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/trainees')}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">প্রশিক্ষণার্থী প্রোফাইল (Trainee Profile)</h1>
            <p className="text-xs text-slate-500 mt-0.5">রেজিস্ট্রেশন: {trainee.registrationNumber}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={printProfile}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-2xs transition"
          >
            <Printer size={16} />
            <span>প্রিন্ট (Print)</span>
          </button>
          <Link
            to={`/trainees/edit/${trainee.id}`}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Edit2 size={16} />
            <span>সম্পাদনা</span>
          </Link>
        </div>
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: ID & Basic Details Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="text-center">
            <div className="w-24 h-24 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-2xl mx-auto border-2 border-emerald-500/20 shadow-xs">
              {trainee.photoUrl ? (
                <img src={trainee.photoUrl} alt="Photo" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <User size={48} />
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-800 mt-4">{trainee.nameBn}</h2>
            <p className="text-sm font-medium text-slate-500">{trainee.nameEn}</p>

            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {trainee.status === 'Active' ? 'সক্রিয় শিক্ষার্থী' : trainee.status === 'Completed' ? 'কোর্স সম্পন্ন' : 'ঝরে পড়া'}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3 text-xs text-slate-600">
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">আইডি (ID):</span>
              <span className="font-bold text-slate-800 font-mono">{trainee.traineeId}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">রেজিঃ নম্বর:</span>
              <span className="font-bold text-slate-800 font-mono">{trainee.registrationNumber}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">মোবাইল:</span>
              <span className="font-bold text-slate-800 font-mono">{trainee.mobileNumber}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">জন্ম তারিখ:</span>
              <span className="font-medium text-slate-800">{trainee.dateOfBirth}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">লিঙ্গ:</span>
              <span className="font-medium text-slate-800">{trainee.gender === 'Male' ? 'পুরুষ' : 'নারী'}</span>
            </div>
            <div className="flex justify-between items-start py-1">
              <span className="text-slate-400 font-medium">এনআইডি/জন্ম নিবন্ধন:</span>
              <span className="font-bold text-slate-800 font-mono text-right">{trainee.nidOrBirthRegistration}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-600">
            <div className="flex items-start space-x-2">
              <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <span>{trainee.address}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Training & Academics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Training Info Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Building2 size={18} className="text-emerald-600" />
              <span>প্রশিক্ষণ কর্মসূচি তথ্য (Training Information)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">প্রতিষ্ঠান</span>
                <span className="font-bold text-slate-800 text-sm block">{institute?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">ট্রেড</span>
                <span className="font-bold text-emerald-700 text-sm block">{trade?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">ব্যাচ</span>
                <span className="font-bold text-slate-800 text-sm block">{batch?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">ভর্তির তারিখ</span>
                <span className="font-semibold text-slate-700 block">
                  {format(trainee.admissionDate || Date.now(), 'dd MMM yyyy')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">পূর্ববর্তী স্কুল</span>
                <span className="font-semibold text-slate-700 block">{trainee.previousSchoolName || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">ড্রপআউটের কারণ</span>
                <span className="font-semibold text-amber-700 block">{trainee.reasonForDropout || '-'}</span>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Calendar size={18} className="text-blue-600" />
                <span>উপস্থিতির সারসংক্ষেপ (Attendance Summary)</span>
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                attendancePercentage >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                উপস্থিতির হার: {attendancePercentage}%
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">মোট ক্লাস</span>
                <span className="text-lg font-bold text-slate-800 mt-0.5 block">{totalDays}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <span className="text-[11px] text-emerald-700 block">উপস্থিত</span>
                <span className="text-lg font-bold text-emerald-700 mt-0.5 block">{presentCount}</span>
              </div>
              <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                <span className="text-[11px] text-red-700 block">অনুপস্থিত</span>
                <span className="text-lg font-bold text-red-700 mt-0.5 block">{absentCount}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <span className="text-[11px] text-amber-700 block">ছুটি</span>
                <span className="text-lg font-bold text-amber-700 mt-0.5 block">{leaveCount}</span>
              </div>
            </div>
          </div>

          {/* Exam Results Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Award size={18} className="text-purple-600" />
              <span>পরীক্ষার ফলাফল (Examination & Marks History)</span>
            </h3>

            {examResults.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">এখনো কোনো পরীক্ষার ফলাফল যুক্ত করা হয়নি।</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead>
                    <tr className="text-slate-400 text-left">
                      <th className="py-2 font-medium">পরীক্ষা</th>
                      <th className="py-2 font-medium">বিষয়</th>
                      <th className="py-2 font-medium text-center">প্রাপ্ত নম্বর</th>
                      <th className="py-2 font-medium text-center">শতকরা</th>
                      <th className="py-2 font-medium text-center">গ্রেড</th>
                      <th className="py-2 font-medium text-right">ফলাফল</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {examResults.map(({ mark, exam }) => (
                      <tr key={mark.id}>
                        <td className="py-2.5 font-semibold text-slate-800">{exam?.name || 'Exam'}</td>
                        <td className="py-2.5 text-slate-600">{exam?.subject || '-'}</td>
                        <td className="py-2.5 text-center font-bold text-slate-800">
                          {mark.marksObtained} / {exam?.totalMarks || 100}
                        </td>
                        <td className="py-2.5 text-center font-medium text-slate-600">{mark.percentage}%</td>
                        <td className="py-2.5 text-center font-bold text-purple-700">{mark.grade}</td>
                        <td className="py-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            mark.result === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {mark.result === 'Pass' ? 'পাস' : 'ফেল'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraineeProfile;
