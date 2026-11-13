import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Copy, 
  Check, 
  HelpCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { BatchSkillModule, BatchLiteracyModule } from '../types/calendar';
import { toBn } from '../lib/dateUtils';
import { saveCsvFile, FileExportResult } from '../lib/fileExportService';

interface ModuleBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  moduleType: 'skill' | 'literacy';
  onImportSuccess: (count: number) => void;
  onBulkSave: (items: any[], replaceExisting: boolean) => Promise<number>;
}

export const SKILL_DEMO_CSV = `dayNumber,moduleName,taskNo,topic,theoryMinutes,practicalMinutes,phaseGroup,toolsRequired,notes
1,বিউটি কেয়ার প্রাথমিক পরিচিতি ও কাজের শিষ্টাচার,কাজ ০১,বিউটি সেলুনের কর্মপরিবেশ ও পরিচ্ছন্নতার প্রাথমিক ধারণা অর্জন,50,70,টুলস ও বিউটি কেয়ার,সেলুন হাইজিন সামগ্রী,প্রথম দিনের পরিচিতি
2,বিউটি কেয়ার প্রাথমিক পরিচিতি ও কাজের শিষ্টাচার,কাজ ০২,গ্রাহকের সাথে পেশাদার অভিবাদন ও কুশল বিনিময় কৌশল,50,70,টুলস ও বিউটি কেয়ার,রোল প্লে সামগ্রী,
3,বিউটি কেয়ার প্রাথমিক পরিচিতি ও কাজের শিষ্টাচার,কাজ ০৩,ব্যক্তিগত পরিষ্কার-পরিচ্ছন্নতা (Personal Grooming) ও অ্যাপ্রোন পরিধান,40,80,টুলস ও বিউটি কেয়ার,পেশাগত অ্যাপ্রোন ও ইউনিফর্ম,
4,বিউটি কেয়ার প্রাথমিক পরিচিতি ও কাজের শিষ্টাচার,কাজ ০৪,কাজের স্থান প্রস্তুতকরণ ও জীবাণুমুক্তকরণের প্রাথমিক ধাপ,40,80,টুলস ও বিউটি কেয়ার,স্যানিটাইজার ও জীবাণুনাশক সামগ্রী,
53,প্রাথমিক পর্যায়ের ত্বকের পরিসেবা সম্পাদন করা,কাজ ৫৩,ত্বকের গঠন ও ত্বকের ধরণ শনাক্তকরণ কৌশল,60,60,স্কিন কেয়ার,ম্যাগনিফাইং ল্যাম্প ও স্কিন চার্ট,
71,প্রাথমিক পর্যায়ের চুল কাটা পরিসেবা সম্পাদন করা,কাজ ৭১,মাথার খুলির কাঠামো ও চুল কাটার বিভিন্ন কোণ বিশ্লেষণ,60,60,হেয়ার কাট,ম্যানিকিন হেড ও কাঁচি,
79,প্রাথমিক পর্যায়ের থ্রেডিং সম্পাদন করা,কাজ ৭৯,থ্রেডিং সুতা নির্বাচন ও হ্যান্ডলিং কৌশল,50,70,থ্রেডিং,১০০% কটন সুতা ৪০ গেজ,
86,প্রাথমিক পর্যায়ের ম্যানিকিউর ও পেডিকিউর সম্পাদন করা,কাজ ৮৬,নখ ও ত্বকের গঠন এবং নেইল অ্যানাটমি শনাক্তকরণ,50,70,ম্যানিকিউর ও পেডিকিউর,ম্যানিকিউর কিট,`;

export const LITERACY_DEMO_CSV = `dayNumber,moduleName,taskNo,topic,startTime,endTime,totalMinutes,category,notes
1,মৌলিক বাংলা দক্ষতা প্রয়োগ করা,কাজ ০১,স্বরবর্ণ ও ব্যঞ্জনবর্ণের সঠিক উচ্চারণ ও লিখিত রূপ শনাক্তকরণ,০৯:০০,১১:০০,120,বাংলা,বাংলা বর্ণমালা চার্ট
2,মৌলিক বাংলা দক্ষতা প্রয়োগ করা,কাজ ০২,যুক্তবর্ণের গঠন ও সহজ শব্দ পাঠ এবং খাতায় লেখার অনুশীলন,০৯:০০,১১:০০,120,বাংলা,
9,মৌলিক ইংরেজি দক্ষতা প্রয়োগ করা,কাজ ০৯,English Alphabet (Capital & Small) শনাক্তকরণ ও উচ্চারণ,০৯:০০,১১:০০,120,ইংরেজি,ইংরেজি ফ্ল্যাশ কার্ড
10,মৌলিক ইংরেজি দক্ষতা প্রয়োগ করা,কাজ ১০,সহজ ইংরেজি শুভেচ্ছা বাক্য বিনিময় (Greetings & Courtesies),০৯:০০,১১:০০,120,ইংরেজি,
17,মৌলিক গাণিতিক ধারণা প্রয়োগ করা,কাজ ১৭,১ থেকে ১০০ পর্যন্ত সংখ্যা গণনা ও ক্রমিক সংখ্যা লিখন,০৯:০০,১১:০০,120,গণিত,ডিজিটাল স্কেল ও পরিমাপক
27,কর্মক্ষেত্রে পেশাগত নিরাপত্তা ও স্বাস্থ্যচর্চা,কাজ ২৭,কর্মক্ষেত্রের সম্ভাব্য বিপদসমূহ শনাক্তকরণ ও সতর্কতা চিহ্ন পাঠ,০৯:০০,১১:০০,120,পেশাগত স্বাস্থ্য ও নিরাপত্তা,হ্যাজার্ড পোস্টার
33,জীবন-দক্ষতাকে কার্যকরভাবে ব্যবহার করা,কাজ ৩৩,নিজের সবলতা ও দুর্বলতা বিশ্লেষণ (SWOT) ও লক্ষ্য নির্ধারণ,০৯:০০,১১:০০,120,জীবন-দক্ষতা,SWOT চার্ট
37,মৌলিক উদ্যোক্তা দক্ষতা ব্যবহার করা,কাজ ৩৭,উদ্যোক্তার গুণাবলি ও স্থানীয় বাজারের চাহিদা নিরূপণ,০৯:০০,১১:০০,120,উদ্যোক্তা দক্ষতা,মার্কেট সার্ভে শিট
49,সেক্টর ভিত্তিক ডিজিটাল স্বাক্ষরতা প্রয়োগ করা,কাজ ৪৯,স্মার্টফোন ও ইন্টারনেটের মৌলিক পরিচিতি ও সার্চ কৌশল,০৯:০০,১১:০০,120,ডিজিটাল স্বাক্ষরতা,স্মার্টফোন ডেমো`;

export const downloadDemoCSV = async (type: 'skill' | 'literacy'): Promise<FileExportResult> => {
  const content = type === 'skill' ? SKILL_DEMO_CSV : LITERACY_DEMO_CSV;
  const filename = type === 'skill' ? 'demo_skill_modules.csv' : 'demo_literacy_modules.csv';

  return saveCsvFile(filename, content.trim(), 'template');
};

const ModuleBulkImportModal: React.FC<ModuleBulkImportModalProps> = ({
  isOpen,
  onClose,
  batchId,
  batchName,
  moduleType,
  onImportSuccess,
  onBulkSave
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState<string>('');
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedDemo, setCopiedDemo] = useState<boolean>(false);
  const [downloadingDemo, setDownloadingDemo] = useState<boolean>(false);
  const [demoDownloadNotice, setDemoDownloadNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const isSkill = moduleType === 'skill';
  const typeLabelBn = isSkill ? 'স্কিল ফোকাসড মডিউল' : 'লিটারেসি ফোকাসড মডিউল';
  const demoContent = isSkill ? SKILL_DEMO_CSV : LITERACY_DEMO_CSV;

  // Simple CSV parser supporting quotes and commas/tabs
  const parseCSVContent = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setParseErrors(['ফাইলে কোনো ডাটা পাওয়া যায়নি অথবা শিরোনাম (Header) অনুপস্থিত।']);
      setParsedRows([]);
      return;
    }

    const errors: string[] = [];
    const rows: any[] = [];

    // Parse header
    const rawHeader = lines[0];
    const delimiter = rawHeader.includes('\t') ? '\t' : ',';
    const headers = rawHeader.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Split line considering simple quotes
      let values: string[] = [];
      if (delimiter === '\t') {
        values = line.split('\t').map(v => v.trim().replace(/^["']|["']$/g, ''));
      } else {
        // Regex for comma separation with optional quotes
        const re = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
        let match;
        const rowVals: string[] = [];
        while ((match = re.exec(line))) {
          rowVals.push((match[1] || match[2] || match[3] || '').trim());
        }
        values = rowVals;
      }

      if (values.length < 3) {
        errors.push(`লাইন ${i + 1}: প্রয়োজনীয় কলামের তথ্য অপূর্ণ রয়েছে।`);
        continue;
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });

      if (isSkill) {
        const dayNumber = parseInt(rowObj['daynumber'] || rowObj['day'] || rowObj['ক্লাস'] || values[0], 10);
        const moduleName = rowObj['modulename'] || rowObj['module'] || rowObj['মডিউল'] || values[1] || 'সাধারণ স্কিল মডিউল';
        const taskNo = rowObj['taskno'] || rowObj['task'] || rowObj['কাজ'] || values[2] || `কাজ ${dayNumber || i}`;
        const topic = rowObj['topic'] || rowObj['শিখনফল'] || rowObj['বিষয়'] || values[3] || '';
        const theoryMin = parseInt(rowObj['theoryminutes'] || rowObj['theory'] || values[4] || '50', 10) || 50;
        const practicalMin = parseInt(rowObj['practicalminutes'] || rowObj['practical'] || values[5] || '70', 10) || 70;
        const phaseGroup = rowObj['phasegroup'] || rowObj['phase'] || values[6] || 'টুলস ও বিউটি কেয়ার';
        const toolsRequired = rowObj['toolsrequired'] || rowObj['tools'] || values[7] || '';
        const notes = rowObj['notes'] || values[8] || '';

        if (!topic) {
          errors.push(`লাইন ${i + 1}: পঠিত বিষয় (Topic) খালি রাখা যাবে না।`);
          continue;
        }

        rows.push({
          id: `skill_${dayNumber || i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dayNumber: dayNumber || i,
          moduleName,
          taskNo,
          topic,
          theoryMinutes: theoryMin,
          practicalMinutes: practicalMin,
          totalMinutes: theoryMin + practicalMin,
          phaseGroup,
          toolsRequired,
          notes,
          batchId
        } as BatchSkillModule);
      } else {
        const dayNumber = parseInt(rowObj['daynumber'] || rowObj['day'] || rowObj['ক্লাস'] || values[0], 10);
        const moduleName = rowObj['modulename'] || rowObj['module'] || rowObj['মডিউল'] || values[1] || 'মৌলিক লিটারেসি দক্ষতা';
        const taskNo = rowObj['taskno'] || rowObj['task'] || rowObj['কাজ'] || values[2] || `কাজ ${dayNumber || i}`;
        const topic = rowObj['topic'] || rowObj['শিখনফল'] || rowObj['বিষয়'] || values[3] || '';
        const startTime = rowObj['starttime'] || rowObj['start'] || values[4] || '০৯:০০';
        const endTime = rowObj['endtime'] || rowObj['end'] || values[5] || '১১:০০';
        const totalMinutes = parseInt(rowObj['totalminutes'] || rowObj['duration'] || values[6] || '120', 10) || 120;
        const category = rowObj['category'] || rowObj['বিভাগ'] || values[7] || 'বাংলা';
        const notes = rowObj['notes'] || values[8] || '';

        if (!topic) {
          errors.push(`লাইন ${i + 1}: পঠিত বিষয় (Topic) খালি রাখা যাবে না।`);
          continue;
        }

        rows.push({
          id: `lit_${dayNumber || i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dayNumber: dayNumber || i,
          moduleName,
          taskNo,
          topic,
          startTime,
          endTime,
          totalMinutes,
          category,
          notes,
          batchId
        } as BatchLiteracyModule);
      }
    }

    setParseErrors(errors);
    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCSVContent(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handlePasteChange = (text: string) => {
    setPastedText(text);
    if (text.trim().length > 10) {
      parseCSVContent(text);
    } else {
      setParsedRows([]);
      setParseErrors([]);
    }
  };

  const handleCopyDemo = () => {
    navigator.clipboard.writeText(demoContent);
    setCopiedDemo(true);
    setTimeout(() => setCopiedDemo(false), 2000);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    try {
      const count = await onBulkSave(parsedRows, replaceExisting);
      onImportSuccess(count);
      onClose();
    } catch (err) {
      console.error("Bulk save error:", err);
      setParseErrors(['ডাটা সংরক্ষণে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট ও পারমিশন পরীক্ষা করুন।']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Layers size={13} className="text-emerald-600" />
              <span>ব্যাচ: {batchName}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {typeLabelBn} বাল্ক ইনপুট (Bulk Module Import)
            </h2>
            <p className="text-xs text-slate-500">
              CSV ফাইল আপলোড বা সরাসরি টেক্সট পেস্ট করে একসাথে একাধিক স্বতন্ত্র মডিউল যুক্ত করুন।
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Demo Template Bar (MANDATORY REQUIREMENT) */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-amber-950 flex items-center gap-1.5 text-sm">
              <Sparkles size={16} className="text-amber-600" />
              <span>বাল্ক ইনপুটের নমুনা ডেমো ফাইল (Official Demo Template)</span>
            </div>
            <p className="text-amber-800 text-[11px]">
              ভুল এড়াতে নিচের ডেমো ফাইলটি ডাউনলোড করে এক্সেল বা নোটে এডিট করে আপলোড করুন।
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={downloadingDemo}
              onClick={async () => {
                if (downloadingDemo) return;
                setDownloadingDemo(true);
                setDemoDownloadNotice(null);
                const res = await downloadDemoCSV(moduleType);
                setDemoDownloadNotice({
                  type: res.success ? 'success' : 'error',
                  text: res.message
                });
                setDownloadingDemo(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              title="ডেমো CSV ফাইল ডাউনলোড করুন"
            >
              <Download size={14} />
              <span>{downloadingDemo ? 'সংরক্ষণ হচ্ছে...' : 'ডেমো ফাইল ডাউনলোড (.csv)'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyDemo}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 font-semibold transition cursor-pointer"
              title="নমুনা টেক্সট কপি করুন"
            >
              {copiedDemo ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedDemo ? 'কপি হয়েছে' : 'টেক্সট কপি'}</span>
            </button>
          </div>
        </div>

        {demoDownloadNotice && (
          <div className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            demoDownloadNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {demoDownloadNotice.type === 'success' ? (
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={14} className="text-rose-600 shrink-0" />
            )}
            <span>{demoDownloadNotice.text}</span>
          </div>
        )}

        {/* Tab Selection (Upload vs Paste) */}
        <div className="flex items-center space-x-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-4 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload size={14} />
            <span>CSV ফাইল আপলোড</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 px-4 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={14} />
            <span>সরাসরি টেক্সট পেস্ট (Paste CSV/TSV)</span>
          </button>
        </div>

        {/* Input Methods */}
        <div className="space-y-4">
          {activeTab === 'upload' ? (
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 transition">
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">
                কম্পিউটার থেকে CSV ফাইল নির্বাচন করুন
              </p>
              <p className="text-[11px] text-slate-400 mt-1 mb-3">
                UTF-8 এনকোডেড .csv বা .txt ফাইল সমর্থন করে
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 file:cursor-pointer"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                CSV অথবা ট্যাব সেপারেটেড টেক্সট পেস্ট করুন:
              </label>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={demoContent}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}
        </div>

        {/* Parse Feedback & Preview */}
        {parseErrors.length > 0 && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-900">
              <AlertCircle size={15} />
              <span>ত্রুটি শনাক্ত হয়েছে:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
              {parseErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>সফলভাবে {toBn(parsedRows.length)}টি মডিউল রো পার্স করা হয়েছে (প্রিভিউ):</span>
              </span>
              <span className="text-slate-500 font-normal">
                প্রথম ৫টি রো প্রদর্শিত হচ্ছে
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-36 overflow-y-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 border-b">দিন</th>
                    <th className="p-2 border-b">মডিউল</th>
                    <th className="p-2 border-b">কাজ নং</th>
                    <th className="p-2 border-b">পঠিত বিষয় / টপিক</th>
                    {isSkill ? (
                      <>
                        <th className="p-2 border-b text-center">তাত্ত্বিক</th>
                        <th className="p-2 border-b text-center">ব্যবহারিক</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2 border-b text-center">সময়</th>
                        <th className="p-2 border-b text-center">বিভাগ</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {parsedRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-bold">{toBn(row.dayNumber)}</td>
                      <td className="p-2 truncate max-w-xs">{row.moduleName}</td>
                      <td className="p-2 font-semibold text-emerald-700">{row.taskNo}</td>
                      <td className="p-2 truncate max-w-xs">{row.topic}</td>
                      {isSkill ? (
                        <>
                          <td className="p-2 text-center">{toBn(row.theoryMinutes)}মি</td>
                          <td className="p-2 text-center">{toBn(row.practicalMinutes)}মি</td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 text-center">{row.startTime} - {row.endTime}</td>
                          <td className="p-2 text-center">{row.category}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Replacement Option */}
            <div className="pt-2 flex items-center space-x-2 text-xs text-slate-700">
              <input
                type="checkbox"
                id="replaceExisting"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="replaceExisting" className="font-semibold cursor-pointer">
                এই ব্যাচের পূর্বের সকল {typeLabelBn} মুছে দিয়ে নতুন করে প্রতিস্থাপন করুন (Replace all)
              </label>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            বাতিল
          </button>

          <button
            type="button"
            disabled={parsedRows.length === 0 || loading}
            onClick={handleExecuteImport}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading ? (
              <span>সংরক্ষণ হচ্ছে...</span>
            ) : (
              <>
                <Check size={16} />
                <span>{toBn(parsedRows.length)}টি মডিউল ব্যাচে ইনপুট নিশ্চিত করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleBulkImportModal;
