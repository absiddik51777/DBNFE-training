import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Trainee, Institute, Trade, Batch, AttendanceRecord, ExamMark, Exam } from '../../types';
import { printCurrentDocument } from '../../lib/fileExportService';
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
  FileText,
  AlertTriangle,
  TrendingDown,
  Info,
  Flame,
  Filter,
  Sparkles,
  ShieldAlert,
  Eye,
  Activity,
  CalendarDays,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../../lib/dataService';
import { toBn, formatBengaliDate } from '../../lib/dateUtils';

// Helpers to normalize UBRN and BirthDate for BDRIS online verification
const normalizeUBRN = (val?: string): string => {
  if (!val) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let cleaned = val;
  bengaliDigits.forEach((bn, idx) => {
    cleaned = cleaned.replaceAll(bn, idx.toString());
  });
  return cleaned.replace(/[^\d]/g, '').trim();
};

const normalizeBirthDate = (dob?: string): string => {
  if (!dob) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let cleaned = dob;
  bengaliDigits.forEach((bn, idx) => {
    cleaned = cleaned.replaceAll(bn, idx.toString());
  });
  cleaned = cleaned.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  const parts = cleaned.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return cleaned;
};

// Interface for each tile in the 30-day window
interface HeatmapDay {
  dateStr: string;
  dayNumber: number;
  monthNameBn: string;
  weekdayIndex: number;
  weekdayNameBn: string;
  fullDateBn: string;
  isFriday: boolean;
  isToday: boolean;
  record?: AttendanceRecord;
  status: 'Present' | 'Absent' | 'Leave' | 'Weekend' | 'NoRecord';
  remarks?: string;
}

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
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [highlightIrregularOnly, setHighlightIrregularOnly] = useState<boolean>(false);

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
      const tBatch = batches.find(b => b.id === t.batchId) || null;
      setBatch(tBatch);
      setInstitute(institutes.find(i => i.id === t.instituteId) || (tBatch ? institutes.find(i => i.id === tBatch.instituteId) : null) || null);
      setTrade(trades.find(tr => tr.id === t.tradeId) || (tBatch ? trades.find(tr => tr.id === tBatch.tradeId) : null) || null);

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
    printCurrentDocument({ jobName: 'BNFE_Trainee_Profile' });
  };

  // Lifetime Attendance Calculations
  const totalDays = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
  const absentCount = attendanceRecords.filter(a => a.status === 'Absent').length;
  const leaveCount = attendanceRecords.filter(a => a.status === 'Leave').length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

  // Generate the last 30 days array
  const heatmapDays = useMemo<HeatmapDay[]>(() => {
    const days: HeatmapDay[] = [];
    const today = new Date();
    const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
    const BN_WEEKDAYS_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const record = attendanceRecords.find(a => a.date === dateStr);
      const weekdayIndex = d.getDay();
      const isFriday = weekdayIndex === 5;
      const isToday = i === 0;

      let status: 'Present' | 'Absent' | 'Leave' | 'Weekend' | 'NoRecord' = 'NoRecord';
      if (record) {
        status = record.status;
      } else if (isFriday) {
        status = 'Weekend';
      }

      days.push({
        dateStr,
        dayNumber: d.getDate(),
        monthNameBn: BN_MONTHS[d.getMonth()],
        weekdayIndex,
        weekdayNameBn: BN_WEEKDAYS_SHORT[weekdayIndex],
        fullDateBn: formatBengaliDate(dateStr),
        isFriday,
        isToday,
        record,
        status,
        remarks: record?.remarks,
      });
    }
    return days;
  }, [attendanceRecords]);

  // Leading empty slots to align day 0 of heatmapDays to its correct weekday column
  const leadingEmptySlots = heatmapDays.length > 0 ? heatmapDays[0].weekdayIndex : 0;

  // 30-day stats and pattern recognition for staff
  const stats30 = useMemo(() => {
    const recordedDays = heatmapDays.filter(d => d.record);
    const presents = recordedDays.filter(d => d.record?.status === 'Present').length;
    const absents = recordedDays.filter(d => d.record?.status === 'Absent').length;
    const leaves = recordedDays.filter(d => d.record?.status === 'Leave').length;
    const rate = recordedDays.length > 0 ? Math.round((presents / recordedDays.length) * 100) : null;

    // Consecutive absents (from latest recorded backwards)
    let consecutiveAbsents = 0;
    const sortedRecords = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
    for (const r of sortedRecords) {
      if (r.status === 'Absent') {
        consecutiveAbsents++;
      } else {
        break;
      }
    }

    const isCriticalRisk = consecutiveAbsents >= 3 || (recordedDays.length >= 4 && rate !== null && rate < 60) || absents >= 5;
    const isModerateRisk = !isCriticalRisk && (consecutiveAbsents >= 2 || (recordedDays.length >= 4 && rate !== null && rate < 75) || absents >= 3);
    const isGood = !isCriticalRisk && !isModerateRisk && (rate === null || rate >= 80);

    return {
      totalRecords: recordedDays.length,
      presents,
      absents,
      leaves,
      rate,
      consecutiveAbsents,
      isCriticalRisk,
      isModerateRisk,
      isGood,
    };
  }, [heatmapDays, attendanceRecords]);

  // Active selected day for inspector
  const activeSelectedDay = useMemo(() => {
    if (selectedDateStr) {
      const found = heatmapDays.find(d => d.dateStr === selectedDateStr);
      if (found) return found;
    }
    // Default to most recent absent if exists, else today
    const recentAbsent = [...heatmapDays].reverse().find(d => d.status === 'Absent');
    if (recentAbsent) return recentAbsent;
    return heatmapDays[heatmapDays.length - 1];
  }, [heatmapDays, selectedDateStr]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>প্রশিক্ষণার্থী প্রোফাইল লোড হচ্ছে...</span>
      </div>
    );
  }

  if (!trainee) {
    return (
      <div className="text-center py-12 bg-theme-surface rounded-2xl border border-theme-border">
        <p className="text-theme-text-secondary">প্রশিক্ষণার্থী পাওয়া যায়নি।</p>
        <button onClick={() => navigate('/trainees')} className="mt-4 px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold cursor-pointer">
          তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 print:p-0 print:m-0">
      {/* Top action bar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/trainees')}
            className="p-2.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary transition shadow-2xs cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-theme-text-primary">প্রশিক্ষণার্থী প্রোফাইল (Trainee Profile)</h1>
            <p className="text-xs text-theme-text-secondary mt-0.5 tabular-nums">
              রেজিস্ট্রেশন: {trainee.registrationNumber || <span className="text-theme-warning italic">অপেক্ষমাণ / পরবর্তীতে বরাদ্দযোগ্য</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Verify Birth Registration Form (BDRIS) */}
          <form
            action="https://everify.bdris.gov.bd/UBRNVerification/Search"
            encType="multipart/form-data"
            method="post"
            target="_blank"
            className="inline"
          >
            <input
              type="hidden"
              name="UBRN"
              className="form-control input-validation-error"
              value={normalizeUBRN(trainee.nidOrBirthRegistration)}
            />
            <input
              type="hidden"
              name="BirthDate"
              className="datepicker text-box single-line hasDatepicker valid"
              value={normalizeBirthDate(trainee.dateOfBirth)}
            />
            <button
              type="submit"
              name="Submit"
              value="Verify BRN"
              className="px-3.5 py-2 bg-theme-info-soft hover:opacity-90 text-theme-info border border-theme-info-border rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
              title="সরকারি BDRIS পোর্টালে জন্ম নিবন্ধন অনলাইন যাচাই করুন (নতুন ট্যাবে খুলবে)"
            >
              <ExternalLink size={16} className="text-theme-info shrink-0" />
              <span>Verify Birth Registration</span>
            </button>
          </form>

          <button
            onClick={printProfile}
            className="px-4 py-2 bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-hover rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
          >
            <Printer size={16} />
            <span>প্রিন্ট (Print)</span>
          </button>
          <Link
            to={`/trainees/edit/${trainee.id}`}
            className="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Edit2 size={16} />
            <span>সম্পাদনা</span>
          </Link>
        </div>
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: ID & Basic Details Card */}
        <div className="bg-theme-surface print:bg-white print:text-slate-900 p-6 rounded-2xl border border-theme-border print:border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="text-center">
            <div className="w-24 h-24 rounded-2xl bg-theme-primary-soft text-theme-primary-soft-fg flex items-center justify-center font-bold text-2xl mx-auto border-2 border-theme-primary-border shadow-xs">
              {trainee.photoUrl ? (
                <img src={trainee.photoUrl} alt="Photo" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <User size={48} />
              )}
            </div>

            <h2 className="text-xl font-bold text-theme-text-primary print:text-slate-900 mt-4">{trainee.nameBn}</h2>
            <p className="text-sm font-medium text-theme-text-secondary print:text-slate-600">{trainee.nameEn}</p>

            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-theme-success-soft text-theme-success border border-theme-success-border">
              {trainee.status === 'Active' ? 'সক্রিয় শিক্ষার্থী' : trainee.status === 'Completed' ? 'কোর্স সম্পন্ন' : 'ঝরে পড়া'}
            </div>
          </div>

          <div className="border-t border-theme-border pt-4 space-y-3 text-xs text-theme-text-secondary">
            <div className="flex justify-between items-center py-1 border-b border-theme-border">
              <span className="text-theme-text-muted font-medium">আইডি (ID):</span>
              <span className="font-bold text-theme-text-primary font-mono tabular-nums">{trainee.traineeId}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-theme-border">
              <span className="text-theme-text-muted font-medium">রেজিঃ নম্বর:</span>
              <span className="font-bold font-mono tabular-nums">
                {trainee.registrationNumber ? (
                  <span className="text-theme-text-primary">{trainee.registrationNumber}</span>
                ) : (
                  <span className="text-theme-warning bg-theme-warning-soft px-1.5 py-0.5 rounded border border-theme-warning-border text-[10px] font-sans font-medium">
                    অপেক্ষমাণ
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-theme-border">
              <span className="text-theme-text-muted font-medium">মোবাইল:</span>
              <span className="font-bold text-theme-text-primary font-mono tabular-nums">{trainee.mobileNumber}</span>
            </div>
            {/* Father's Name */}
            <div className="py-1.5 border-b border-theme-border space-y-0.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-theme-text-muted font-medium">পিতার নাম (বাংলা):</span>
                <span className="font-semibold text-theme-text-primary text-right">{trainee.fatherNameBn || (trainee as any).fatherName || 'উল্লেখ নেই'}</span>
              </div>
              {(trainee.fatherNameEn || (trainee as any).fatherName) && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-theme-text-muted">Father (English):</span>
                  <span className="text-theme-text-secondary font-medium text-right">{trainee.fatherNameEn || (trainee as any).fatherName}</span>
                </div>
              )}
            </div>

            {/* Mother's Name */}
            <div className="py-1.5 border-b border-theme-border space-y-0.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-theme-text-muted font-medium">মাতার নাম (বাংলা):</span>
                <span className="font-semibold text-theme-text-primary text-right">{trainee.motherNameBn || (trainee as any).motherName || 'উল্লেখ নেই'}</span>
              </div>
              {(trainee.motherNameEn || (trainee as any).motherName) && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-theme-text-muted">Mother (English):</span>
                  <span className="text-theme-text-secondary font-medium text-right">{trainee.motherNameEn || (trainee as any).motherName}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-1 border-b border-theme-border">
              <span className="text-theme-text-muted font-medium">জন্ম তারিখ:</span>
              <span className="font-medium text-theme-text-primary tabular-nums">{trainee.dateOfBirth}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-theme-border">
              <span className="text-theme-text-muted font-medium">লিঙ্গ:</span>
              <span className="font-medium text-theme-text-primary">{trainee.gender === 'Male' ? 'পুরুষ' : 'নারী'}</span>
            </div>
            <div className="py-2 border-b border-theme-border space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-theme-text-muted font-medium">এনআইডি/জন্ম নিবন্ধন:</span>
                <span className="font-bold text-theme-text-primary font-mono text-right tabular-nums">{trainee.nidOrBirthRegistration || 'নির্ধারিত নেই'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-theme-text-muted font-medium">BRN যাচাই অবস্থা:</span>
                {trainee.is_brn_verified === true ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-theme-success-soft text-theme-success border border-theme-success-border font-bold text-[11px]">
                    <CheckCircle2 size={12} className="text-theme-success" />
                    <span>যাচাইকৃত (Verified)</span>
                  </span>
                ) : trainee.is_brn_verified === false ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-theme-danger-soft text-theme-danger border border-theme-danger-border font-bold text-[11px]">
                    <XCircle size={12} className="text-theme-danger" />
                    <span>অবৈধ (Invalid)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-theme-warning-soft text-theme-warning border border-theme-warning-border font-medium text-[11px]">
                    <span>অপেক্ষমাণ (Pending)</span>
                  </span>
                )}
              </div>
              {trainee.brn_remark && (
                <div className="bg-theme-surface-subtle border border-theme-border rounded-lg p-2 text-[11px] text-theme-text-secondary">
                  <span className="font-semibold block text-[10px] text-theme-text-muted">যাচাই মন্তব্য (Remark):</span>
                  <span>{trainee.brn_remark}</span>
                </div>
              )}
              <form
                action="https://everify.bdris.gov.bd/UBRNVerification/Search"
                encType="multipart/form-data"
                method="post"
                target="_blank"
                className="w-full pt-0.5 print:hidden"
              >
                <input
                  type="hidden"
                  name="UBRN"
                  className="form-control input-validation-error"
                  value={normalizeUBRN(trainee.nidOrBirthRegistration)}
                />
                <input
                  type="hidden"
                  name="BirthDate"
                  className="datepicker text-box single-line hasDatepicker valid"
                  value={normalizeBirthDate(trainee.dateOfBirth)}
                />
                <button
                  type="submit"
                  name="Submit"
                  value="Verify BRN"
                  className="w-full py-1.5 px-3 bg-theme-info-soft hover:opacity-90 text-theme-info border border-theme-info-border rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-2xs"
                  title="সরকারি BDRIS পোর্টালে জন্ম সনদ যাচাই করুন (নতুন ট্যাবে খুলবে)"
                >
                  <ExternalLink size={13} className="text-theme-info shrink-0" />
                  <span>Verify Birth Registration</span>
                </button>
              </form>
            </div>
          </div>

          <div className="bg-theme-surface-subtle p-3.5 rounded-xl border border-theme-border text-xs text-theme-text-secondary space-y-2.5">
            <div className="flex items-start space-x-2">
              <MapPin size={15} className="text-theme-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-theme-text-primary block">স্থায়ী ঠিকানা:</span>
                <span className="text-theme-text-secondary">{trainee.permanentAddress || trainee.address}</span>
              </div>
            </div>
            {(trainee.presentAddress || trainee.sameAsPermanentAddress) && (
              <div className="flex items-start space-x-2 pt-2 border-t border-theme-border">
                <MapPin size={15} className="text-theme-info shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-theme-text-primary">বর্তমান ঠিকানা:</span>
                    {trainee.sameAsPermanentAddress && (
                      <span className="text-[10px] text-theme-primary-soft-fg bg-theme-primary-soft px-1 rounded">অনুরূপ</span>
                    )}
                  </div>
                  <span className="text-theme-text-secondary">{trainee.presentAddress || trainee.permanentAddress || trainee.address}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Training & Academics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Training Info Card */}
          <div className="bg-theme-surface print:bg-white print:text-slate-900 p-6 rounded-2xl border border-theme-border print:border-slate-200 shadow-xs">
            <h3 className="font-bold text-theme-text-primary text-base mb-4 flex items-center space-x-2 border-b border-theme-border pb-3">
              <Building2 size={18} className="text-theme-primary" />
              <span>প্রশিক্ষণ কর্মসূচি তথ্য (Training Information)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-theme-text-muted block mb-0.5">প্রতিষ্ঠান</span>
                <span className="font-bold text-theme-text-primary text-sm block">{institute?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-theme-text-muted block mb-0.5">ট্রেড</span>
                <span className="font-bold text-theme-primary text-sm block">{trade?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-theme-text-muted block mb-0.5">ব্যাচ</span>
                <span className="font-bold text-theme-text-primary text-sm block">{batch?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-theme-text-muted block mb-0.5">ভর্তির তারিখ</span>
                <span className="font-semibold text-theme-text-primary block tabular-nums">
                  {format(trainee.admissionDate || Date.now(), 'dd MMM yyyy')}
                </span>
              </div>
              <div>
                <span className="text-theme-text-muted block mb-0.5">পূর্ববর্তী স্কুল</span>
                <span className="font-semibold text-theme-text-primary block">{trainee.previousSchoolName || '-'}</span>
              </div>
              <div>
                <span className="text-theme-text-muted block mb-0.5">ড্রপআউটের কারণ</span>
                <span className="font-semibold text-theme-warning block">{trainee.reasonForDropout || '-'}</span>
              </div>
            </div>
          </div>

          {/* Attendance Section */}
          <div className="space-y-6">
            {/* All-time Attendance Summary (Compact) */}
            <div className="bg-theme-surface print:bg-white print:text-slate-900 p-5 rounded-2xl border border-theme-border print:border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-theme-border pb-2.5">
                <h3 className="font-bold text-theme-text-primary text-sm flex items-center space-x-2">
                  <Calendar size={16} className="text-theme-info" />
                  <span>সার্বিক উপস্থিতি রেকর্ড (All-Time Attendance Overview)</span>
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border tabular-nums ${
                  attendancePercentage >= 75
                    ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                    : 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
                }`}>
                  সর্বমোট হার: {toBn(attendancePercentage)}%
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5 text-center">
                <div className="bg-theme-surface-subtle p-2.5 rounded-xl border border-theme-border">
                  <span className="text-[11px] text-theme-text-secondary block">মোট ক্লাস</span>
                  <span className="text-base font-bold text-theme-text-primary mt-0.5 block tabular-nums">{toBn(totalDays)}</span>
                </div>
                <div className="bg-theme-success-soft p-2.5 rounded-xl border border-theme-success-border">
                  <span className="text-[11px] text-theme-success block">উপস্থিত</span>
                  <span className="text-base font-bold text-theme-success mt-0.5 block tabular-nums">{toBn(presentCount)}</span>
                </div>
                <div className="bg-theme-danger-soft p-2.5 rounded-xl border border-theme-danger-border">
                  <span className="text-[11px] text-theme-danger block">অনুপস্থিত</span>
                  <span className="text-base font-bold text-theme-danger mt-0.5 block tabular-nums">{toBn(absentCount)}</span>
                </div>
                <div className="bg-theme-warning-soft p-2.5 rounded-xl border border-theme-warning-border">
                  <span className="text-[11px] text-theme-warning block">ছুটি</span>
                  <span className="text-base font-bold text-theme-warning mt-0.5 block tabular-nums">{toBn(leaveCount)}</span>
                </div>
              </div>
            </div>

            {/* Visual Attendance Heatmap - Last 30 Days */}
            <div className="bg-theme-surface print:bg-white print:text-slate-900 p-6 rounded-2xl border border-theme-border print:border-slate-200 shadow-xs space-y-5">
              {/* Heatmap Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme-border pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-theme-primary-soft text-theme-primary-soft-fg">
                      <Activity size={18} />
                    </div>
                    <h3 className="font-bold text-theme-text-primary text-base">
                      গত ৩০ দিনের উপস্থিতির হিটম্যাপ (30-Day Attendance Heatmap)
                    </h3>
                  </div>
                  <p className="text-xs text-theme-text-secondary mt-1">
                    কর্মীদের দ্রুত অনিয়মিত উপস্থিতি ও ড্রপআউটের ঝুঁকি শনাক্তকরণের ভিজ্যুয়াল প্যাটার্ন
                  </p>
                </div>

                {/* Highlight Irregularities Toggle */}
                <button
                  type="button"
                  onClick={() => setHighlightIrregularOnly(prev => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer select-none print:hidden ${
                    highlightIrregularOnly
                      ? 'bg-theme-danger text-theme-danger-fg shadow-xs'
                      : 'bg-theme-surface-subtle text-theme-text-primary border border-theme-border hover:bg-theme-surface-hover'
                  }`}
                >
                  <Filter size={13} />
                  <span>{highlightIrregularOnly ? 'সব দিন প্রদর্শন' : 'অনুপস্থিতি হাইলাইট'}</span>
                </button>
              </div>

              {/* Staff Irregularity & Risk Alert Banner */}
              {stats30.isCriticalRisk && (
                <div className="bg-theme-danger-soft border border-theme-danger-border rounded-xl p-4 flex items-start space-x-3 text-theme-text-primary shadow-2xs">
                  <AlertTriangle className="text-theme-danger shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1.5 text-xs flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-theme-danger text-sm flex items-center gap-1.5">
                        জরুরি সতর্কতা: উচ্চ অনিয়মিত উপস্থিতি / ড্রপআউট ঝুঁকি
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-theme-danger text-theme-danger-fg text-[11px] uppercase tracking-wide">
                        High Dropout Risk
                      </span>
                    </div>
                    <p className="text-theme-text-primary leading-relaxed tabular-nums">
                      এই প্রশিক্ষণার্থী গত ৩০ দিনে মোট <strong>{toBn(stats30.absents)} দিন অনুপস্থিত</strong>
                      {stats30.consecutiveAbsents >= 2 && (
                        <> এবং বর্তমানে <strong>টানা {toBn(stats30.consecutiveAbsents)} দিন অনুপস্থিত</strong></>
                      )}। এই মেয়াদের উপস্থিতির হার <strong>{stats30.rate !== null ? `${toBn(stats30.rate)}%` : '০%'}</strong>।
                    </p>
                    <div className="pt-1 text-[11px] font-semibold text-theme-danger flex items-center gap-1.5">
                      <Phone size={13} className="text-theme-danger" />
                      <span>কর্মীদের করণীয়: অবিলম্বে অভিভাবক ও শিক্ষার্থীর সাথে যোগাযোগ করে কাউন্সেলিং করুন।</span>
                    </div>
                  </div>
                </div>
              )}

              {stats30.isModerateRisk && (
                <div className="bg-theme-warning-soft border border-theme-warning-border rounded-xl p-4 flex items-start space-x-3 text-theme-text-primary shadow-2xs">
                  <AlertTriangle className="text-theme-warning shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1 text-xs flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-theme-warning text-sm">
                        সতর্কতা: অনিয়মিত উপস্থিতির লক্ষণ (Moderate Irregularity)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-theme-warning text-theme-warning-fg text-[11px]">
                        Observation Needed
                      </span>
                    </div>
                    <p className="text-theme-text-primary leading-relaxed tabular-nums">
                      গত ৩০ দিনে <strong>{toBn(stats30.absents)} দিন অনুপস্থিত</strong> ও <strong>{toBn(stats30.leaves)} দিন ছুটি</strong> পরিলক্ষিত হয়েছে (উপস্থিতির হার: {stats30.rate !== null ? `${toBn(stats30.rate)}%` : '০%'})।
                    </p>
                    <div className="pt-0.5 text-[11px] font-medium text-theme-warning flex items-center gap-1">
                      <Info size={13} className="text-theme-warning" />
                      <span>পরামর্শ: ক্লাসের ধারাবাহিকতা বজায় রাখতে প্রশিক্ষণার্থীকে পর্যবেক্ষণ করুন।</span>
                    </div>
                  </div>
                </div>
              )}

              {stats30.isGood && stats30.totalRecords > 0 && (
                <div className="bg-theme-success-soft border border-theme-success-border rounded-xl p-3.5 flex items-center space-x-3 text-theme-text-primary shadow-2xs">
                  <CheckCircle2 className="text-theme-success shrink-0" size={18} />
                  <div className="text-xs flex-1">
                    <span className="font-bold text-theme-success">সন্তোষজনক উপস্থিতি (Good Attendance Record)</span>
                    <p className="text-theme-text-secondary mt-0.5 tabular-nums">
                      গত ৩০ দিনে উপস্থিতির হার <strong className="text-theme-text-primary">{toBn(stats30.rate)}%</strong>। প্রশিক্ষণার্থী ক্লাসে নিয়মিত অংশ নিচ্ছেন।
                    </p>
                  </div>
                </div>
              )}

              {/* 30-Day Quick Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-theme-surface-subtle rounded-xl p-3 border border-theme-border text-center">
                  <span className="text-[11px] font-medium text-theme-text-secondary block">৩০ দিনে উপস্থিতির হার</span>
                  <span className="text-lg font-bold text-theme-text-primary mt-0.5 block tabular-nums">
                    {stats30.rate !== null ? `${toBn(stats30.rate)}%` : 'রেকর্ড নেই'}
                  </span>
                </div>
                <div className="bg-theme-success-soft rounded-xl p-3 border border-theme-success-border text-center">
                  <span className="text-[11px] font-medium text-theme-success block">উপস্থিত দিন</span>
                  <span className="text-lg font-bold text-theme-success mt-0.5 block tabular-nums">
                    {toBn(stats30.presents)} <span className="text-xs font-normal">দিন</span>
                  </span>
                </div>
                <div className={`rounded-xl p-3 border text-center transition ${
                  stats30.absents > 0 ? 'bg-theme-danger-soft border-theme-danger-border' : 'bg-theme-surface-subtle border-theme-border'
                }`}>
                  <span className={`text-[11px] font-medium block ${stats30.absents > 0 ? 'text-theme-danger' : 'text-theme-text-secondary'}`}>
                    অনুপস্থিত দিন
                  </span>
                  <span className={`text-lg font-bold mt-0.5 block tabular-nums ${stats30.absents > 0 ? 'text-theme-danger' : 'text-theme-text-primary'}`}>
                    {toBn(stats30.absents)} <span className="text-xs font-normal">দিন</span>
                  </span>
                </div>
                <div className={`rounded-xl p-3 border text-center transition ${
                  stats30.consecutiveAbsents >= 2 ? 'bg-theme-danger-soft border-theme-danger-border' : 'bg-theme-surface-subtle border-theme-border'
                }`}>
                  <span className={`text-[11px] font-medium flex items-center justify-center gap-1 ${
                    stats30.consecutiveAbsents >= 2 ? 'text-theme-danger font-bold' : 'text-theme-text-secondary'
                  }`}>
                    {stats30.consecutiveAbsents >= 2 && <Flame size={12} className="text-theme-danger" />}
                    টানা অনুপস্থিতি
                  </span>
                  <span className={`text-lg font-bold mt-0.5 block tabular-nums ${
                    stats30.consecutiveAbsents >= 2 ? 'text-theme-danger' : 'text-theme-text-primary'
                  }`}>
                    {toBn(stats30.consecutiveAbsents)} <span className="text-xs font-normal">দিন</span>
                  </span>
                </div>
              </div>

              {/* Heatmap Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-theme-text-secondary font-medium px-1">
                  <span>গত ৩০ দিনের দিনপঞ্জি (ক্লিক করে বিস্তারিত দেখুন):</span>
                  <span className="text-[11px] text-theme-text-muted">রবিবার – শনিবার ক্যালেন্ডার রূপরেখা</span>
                </div>

                {/* Day of week headers */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-theme-text-muted pb-1 border-b border-theme-border">
                  <span className="text-theme-text-secondary">রবি</span>
                  <span className="text-theme-text-secondary">সোম</span>
                  <span className="text-theme-text-secondary">মঙ্গল</span>
                  <span className="text-theme-text-secondary">বুধ</span>
                  <span className="text-theme-text-secondary">বৃহঃ</span>
                  <span className="text-theme-accent bg-theme-accent-soft rounded py-0.5">শুক্র (ছুটি)</span>
                  <span className="text-theme-text-secondary">শনি</span>
                </div>

                {/* Calendar Grid Tiles */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Empty leading slots for calendar alignment */}
                  {Array.from({ length: leadingEmptySlots }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-11 rounded-xl bg-theme-surface-subtle/50 border border-transparent" />
                  ))}

                  {heatmapDays.map((day) => {
                    const isSelected = activeSelectedDay?.dateStr === day.dateStr;
                    const isDimmed = highlightIrregularOnly && day.status !== 'Absent' && day.status !== 'Leave';

                    let statusClasses = 'bg-theme-surface-subtle text-theme-text-secondary border border-theme-border';
                    let icon = null;

                    if (day.status === 'Present') {
                      statusClasses = 'bg-theme-success text-theme-success-fg border border-theme-success shadow-2xs hover:opacity-90';
                      icon = <CheckCircle2 size={11} className="opacity-90" />;
                    } else if (day.status === 'Absent') {
                      statusClasses = 'bg-theme-danger text-theme-danger-fg border border-theme-danger shadow-xs ring-2 ring-theme-danger/30 font-black hover:opacity-90';
                      icon = <XCircle size={11} className="opacity-90" />;
                    } else if (day.status === 'Leave') {
                      statusClasses = 'bg-theme-warning text-theme-warning-fg border border-theme-warning shadow-2xs hover:opacity-90 font-semibold';
                      icon = <Clock size={11} className="opacity-90" />;
                    } else if (day.status === 'Weekend') {
                      statusClasses = 'bg-theme-accent-soft text-theme-accent border border-dashed border-theme-accent-border hover:opacity-90';
                    } else {
                      statusClasses = 'bg-theme-surface-subtle text-theme-text-muted border border-dashed border-theme-border hover:bg-theme-surface-hover';
                    }

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => setSelectedDateStr(day.dateStr)}
                        title={`${day.fullDateBn} - ${
                          day.status === 'Present' ? 'উপস্থিত' :
                          day.status === 'Absent' ? 'অনুপস্থিত' :
                          day.status === 'Leave' ? 'ছুটি' :
                          day.status === 'Weekend' ? 'সাপ্তাহিক ছুটি (শুক্রবার)' : 'ক্লাস রেকর্ড নেই'
                        }${day.remarks ? ` (${day.remarks})` : ''}`}
                        className={`relative h-11 rounded-xl flex flex-col items-center justify-center p-1 text-xs transition cursor-pointer select-none ${statusClasses} ${
                          isSelected ? 'ring-3 ring-theme-info ring-offset-2 ring-offset-theme-surface z-10 scale-105' : ''
                        } ${isDimmed ? 'opacity-25 grayscale' : 'opacity-100'}`}
                      >
                        <div className="flex items-center space-x-0.5 tabular-nums">
                          <span className="font-bold text-[12px]">{toBn(day.dayNumber)}</span>
                          {icon}
                        </div>
                        <span className="text-[9px] opacity-85 leading-none">
                          {day.dayNumber === 1 ? day.monthNameBn : day.weekdayNameBn}
                        </span>
                        {day.isToday && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-theme-info rounded-full ring-2 ring-theme-surface" title="আজকের দিন" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Inspector */}
              {activeSelectedDay && (
                <div className="bg-theme-surface-subtle rounded-xl p-3.5 border border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary shadow-2xs">
                      <CalendarDays size={18} className="text-theme-info" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-theme-text-primary text-sm tabular-nums">
                          {activeSelectedDay.fullDateBn}
                        </span>
                        {activeSelectedDay.isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-theme-info-soft text-theme-info border border-theme-info-border">
                            আজকের দিন
                          </span>
                        )}
                      </div>
                      <p className="text-theme-text-secondary text-[11px] mt-0.5">
                        {activeSelectedDay.remarks 
                          ? `লিপিবদ্ধ মন্তব্য: "${activeSelectedDay.remarks}"`
                          : activeSelectedDay.record?.recordedBy 
                            ? `হাজিরা গ্রহণকারী: ${activeSelectedDay.record.recordedBy}`
                            : 'কোনো বিশেষ মন্তব্য নেই'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-center">
                    <span className="text-theme-text-secondary font-medium">উপস্থিতি অবস্থা:</span>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-xs border ${
                      activeSelectedDay.status === 'Present' ? 'bg-theme-success-soft text-theme-success border-theme-success-border' :
                      activeSelectedDay.status === 'Absent' ? 'bg-theme-danger-soft text-theme-danger border-theme-danger-border' :
                      activeSelectedDay.status === 'Leave' ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border' :
                      activeSelectedDay.status === 'Weekend' ? 'bg-theme-accent-soft text-theme-accent border-theme-accent-border' :
                      'bg-theme-surface text-theme-text-secondary border-theme-border'
                    }`}>
                      {activeSelectedDay.status === 'Present' ? 'উপস্থিত (Present)' :
                       activeSelectedDay.status === 'Absent' ? 'অনুপস্থিত (Absent)' :
                       activeSelectedDay.status === 'Leave' ? 'অনুমোদিত ছুটি (Leave)' :
                       activeSelectedDay.status === 'Weekend' ? 'সাপ্তাহিক ছুটি (শুক্রবার)' :
                       'ক্লাস রেকর্ড নেই (No Record)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Heatmap Legend */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-theme-border text-[11px] text-theme-text-secondary gap-y-2">
                <div className="flex items-center space-x-4 flex-wrap gap-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-theme-success inline-block shadow-2xs"></span>
                    <span>উপস্থিত</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-theme-danger inline-block shadow-2xs ring-1 ring-theme-danger/40"></span>
                    <span className="font-semibold text-theme-danger">অনুপস্থিত (অনিয়মিত ঝুঁকি)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-theme-warning inline-block shadow-2xs"></span>
                    <span>অনুমোদিত ছুটি</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-theme-accent-soft border border-dashed border-theme-accent-border inline-block"></span>
                    <span>সাপ্তাহিক ছুটি (শুক্র)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-theme-surface-subtle border border-dashed border-theme-border inline-block"></span>
                    <span>ক্লাস রেকর্ড নেই</span>
                  </div>
                </div>

                <div className="text-[10px] text-theme-text-muted italic">
                  * যেকোনো দিনে ক্লিক করে বিবরণ দেখুন
                </div>
              </div>
            </div>
          </div>

          {/* Exam Results Summary */}
          <div className="bg-theme-surface print:bg-white print:text-slate-900 p-6 rounded-2xl border border-theme-border print:border-slate-200 shadow-xs">
            <h3 className="font-bold text-theme-text-primary text-base mb-4 flex items-center space-x-2 border-b border-theme-border pb-3">
              <Award size={18} className="text-theme-accent" />
              <span>পরীক্ষার ফলাফল (Examination & Marks History)</span>
            </h3>

            {examResults.length === 0 ? (
              <p className="text-xs text-theme-text-muted py-3 text-center">এখনো কোনো পরীক্ষার ফলাফল যুক্ত করা হয়নি।</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-theme-border text-xs">
                  <thead>
                    <tr className="text-theme-text-muted text-left">
                      <th className="py-2 font-medium">পরীক্ষা</th>
                      <th className="py-2 font-medium">বিষয়</th>
                      <th className="py-2 font-medium text-center">প্রাপ্ত নম্বর</th>
                      <th className="py-2 font-medium text-center">শতকরা</th>
                      <th className="py-2 font-medium text-center">গ্রেড</th>
                      <th className="py-2 font-medium text-right">ফলাফল</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {examResults.map(({ mark, exam }) => (
                      <tr key={mark.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="py-2.5 font-semibold text-theme-text-primary">{exam?.name || 'Exam'}</td>
                        <td className="py-2.5 text-theme-text-secondary">{exam?.subject || '-'}</td>
                        <td className="py-2.5 text-center font-bold text-theme-text-primary tabular-nums">
                          {mark.marksObtained} / {exam?.totalMarks || 100}
                        </td>
                        <td className="py-2.5 text-center font-medium text-theme-text-secondary tabular-nums">{mark.percentage}%</td>
                        <td className="py-2.5 text-center font-bold text-theme-accent tabular-nums">{mark.grade}</td>
                        <td className="py-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${
                            mark.result === 'Pass'
                              ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                              : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
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
