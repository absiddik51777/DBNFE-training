import React, { useState, useEffect } from 'react';
import { X, Check, BookOpen, Layers, Clock, Wrench } from 'lucide-react';
import { BatchSkillModule, BatchLiteracyModule } from '../types/calendar';
import { toBn } from '../lib/dateUtils';

interface ModuleInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  moduleType: 'skill' | 'literacy';
  initialData?: BatchSkillModule | BatchLiteracyModule | null;
  onSave: (data: any) => Promise<void>;
}

const ModuleInputModal: React.FC<ModuleInputModalProps> = ({
  isOpen,
  onClose,
  batchId,
  batchName,
  moduleType,
  initialData,
  onSave
}) => {
  const isSkill = moduleType === 'skill';

  // Common Fields
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [moduleName, setModuleName] = useState<string>('');
  const [taskNo, setTaskNo] = useState<string>('কাজ ০১');
  const [topic, setTopic] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Skill-Specific Fields
  const [theoryMinutes, setTheoryMinutes] = useState<number>(50);
  const [practicalMinutes, setPracticalMinutes] = useState<number>(70);
  const [phaseGroup, setPhaseGroup] = useState<string>('টুলস ও বিউটি কেয়ার');
  const [toolsRequired, setToolsRequired] = useState<string>('');

  // Literacy-Specific Fields
  const [startTime, setStartTime] = useState<string>('০৯:০০');
  const [endTime, setEndTime] = useState<string>('১১:০০');
  const [totalMinutes, setTotalMinutes] = useState<number>(120);
  const [category, setCategory] = useState<string>('বাংলা');

  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    setErrorMessage('');
    if (initialData) {
      setDayNumber(initialData.dayNumber || 1);
      setModuleName(initialData.moduleName || '');
      setTaskNo(initialData.taskNo || 'কাজ ০১');
      setTopic(initialData.topic || '');
      setNotes(initialData.notes || '');

      if (isSkill) {
        const sm = initialData as BatchSkillModule;
        setTheoryMinutes(sm.theoryMinutes || 50);
        setPracticalMinutes(sm.practicalMinutes || 70);
        setPhaseGroup(sm.phaseGroup || 'টুলস ও বিউটি কেয়ার');
        setToolsRequired(sm.toolsRequired || '');
      } else {
        const lm = initialData as BatchLiteracyModule;
        setStartTime(lm.startTime || '০৯:০০');
        setEndTime(lm.endTime || '১১:০০');
        setTotalMinutes(lm.totalMinutes || 120);
        setCategory(lm.category || 'বাংলা');
      }
    } else {
      // Default new entry
      setDayNumber(1);
      setModuleName(isSkill ? 'বিউটি কেয়ার প্রাথমিক পরিচিতি ও কাজের শিষ্টাচার' : 'মৌলিক বাংলা দক্ষতা প্রয়োগ করা');
      setTaskNo('কাজ ০১');
      setTopic('');
      setNotes('');
      setTheoryMinutes(50);
      setPracticalMinutes(70);
      setPhaseGroup('টুলস ও বিউটি কেয়ার');
      setToolsRequired('');
      setStartTime('০৯:০০');
      setEndTime('১১:০০');
      setTotalMinutes(120);
      setCategory('বাংলা');
    }
  }, [initialData, isSkill, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!topic.trim()) {
      setErrorMessage('পঠিত বিষয় বা টপিক অবশ্যই পূরণ করতে হবে।');
      return;
    }

    setSaving(true);
    try {
      if (isSkill) {
        const payload: BatchSkillModule = {
          id: (initialData as BatchSkillModule)?.id || `tsm_${batchId}_${dayNumber}_${Date.now()}`,
          batchId,
          dayNumber: Number(dayNumber),
          moduleName: moduleName.trim(),
          taskNo: taskNo.trim(),
          topic: topic.trim(),
          theoryMinutes: Number(theoryMinutes),
          practicalMinutes: Number(practicalMinutes),
          totalMinutes: Number(theoryMinutes) + Number(practicalMinutes),
          phaseGroup,
          toolsRequired: toolsRequired.trim(),
          notes: notes.trim(),
          createdAt: (initialData as BatchSkillModule)?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        await onSave(payload);
      } else {
        const payload: BatchLiteracyModule = {
          id: (initialData as BatchLiteracyModule)?.id || `tlm_${batchId}_${dayNumber}_${Date.now()}`,
          batchId,
          dayNumber: Number(dayNumber),
          moduleName: moduleName.trim(),
          taskNo: taskNo.trim(),
          topic: topic.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          totalMinutes: Number(totalMinutes),
          category,
          notes: notes.trim(),
          createdAt: (initialData as BatchLiteracyModule)?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        await onSave(payload);
      }
      onClose();
    } catch (err: any) {
      console.error("Save module error:", err);
      setErrorMessage(err?.message || "মডিউল সংরক্ষণ ব্যাহত হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 my-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Layers size={13} className="text-emerald-600" />
              <span>ব্যাচ/ট্রেড: {batchName}</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
              {initialData ? 'মডিউল সম্পাদনা (Edit Module)' : (isSkill ? 'নতুন স্কিল ফোকাসড মডিউল যুক্তকরণ' : 'নতুন লিটারেসি ফোকাসড মডিউল যুক্তকরণ')}
            </h2>
            <p className="text-xs text-slate-500">
              {isSkill ? 'স্বতন্ত্র স্কিল ফোকাসড কারিকুলাম ও শিখন পরিকল্পনা' : 'স্বতন্ত্র লিটারেসি ফোকাসড কারিকুলাম ও শিখন পরিকল্পনা'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                কার্যদিবস / ক্লাস নং *
              </label>
              <input
                type="number"
                min={1}
                max={150}
                required
                value={dayNumber}
                onChange={(e) => setDayNumber(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                কাজ নং (Task No) *
              </label>
              <input
                type="text"
                required
                value={taskNo}
                onChange={(e) => setTaskNo(e.target.value)}
                placeholder="যেমন: কাজ ০১"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {isSkill ? 'বিভাগ / ফেজ' : 'বিষয় বিভাগ'} *
              </label>
              {isSkill ? (
                <select
                  value={phaseGroup}
                  onChange={(e) => setPhaseGroup(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
                >
                  <option value="টুলস ও বিউটি কেয়ার">টুলস ও বিউটি কেয়ার</option>
                  <option value="স্কিন কেয়ার">স্কিন কেয়ার</option>
                  <option value="হেয়ার কেয়ার">হেয়ার কেয়ার</option>
                  <option value="হেয়ার কাট">হেয়ার কাট</option>
                  <option value="থ্রেডিং">থ্রেডিং</option>
                  <option value="ম্যানিকিউর ও পেডিকিউর">ম্যানিকিউর ও পেডিকিউর</option>
                  <option value="অন্যান্য স্কিল">অন্যান্য স্কিল</option>
                </select>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
                >
                  <option value="বাংলা">১. মৌলিক বাংলা দক্ষতা</option>
                  <option value="ইংরেজি">২. মৌলিক ইংরেজি দক্ষতা</option>
                  <option value="গণিত">৩. মৌলিক গাণিতিক ধারণা</option>
                  <option value="পেশাগত স্বাস্থ্য ও নিরাপত্তা">৪. পেশাগত নিরাপত্তা ও স্বাস্থ্যচর্চা</option>
                  <option value="জীবন-দক্ষতা">৫. জীবন-দক্ষতা</option>
                  <option value="উদ্যোক্তা দক্ষতা">৬. মৌলিক উদ্যোক্তা দক্ষতা</option>
                  <option value="ডিজিটাল স্বাক্ষরতা">৭. ডিজিটাল স্বাক্ষরতা</option>
                  <option value="অন্যান্য লিটারেসি">অন্যান্য লিটারেসি</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              মডিউলের নাম (Module Title) *
            </label>
            <input
              type="text"
              required
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder={isSkill ? 'যেমন: প্রাথমিক পর্যায়ের ত্বকের পরিসেবা (Skin Care) সম্পাদন করা' : 'যেমন: মৌলিক বাংলা দক্ষতা প্রয়োগ করা'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              পঠিত বিষয় / শিখন ফল (Learning Outcome / Topic) *
            </label>
            <textarea
              rows={2}
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={isSkill ? 'যেমন: ত্বক পরিষ্কারকরণ (Cleansing) ও মেকআপ রিমুভাল পদ্ধতি অনুশীলন' : 'যেমন: স্বরবর্ণ ও ব্যঞ্জনবর্ণের সঠিক উচ্চারণ ও লিখিত রূপ শনাক্তকরণ'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
          </div>

          {/* Time & Specific Fields */}
          {isSkill ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <div>
                <label className="block text-emerald-900 font-bold mb-1">
                  তাত্ত্বিক সময় (মিনিট)
                </label>
                <input
                  type="number"
                  min={0}
                  value={theoryMinutes}
                  onChange={(e) => setTheoryMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border border-emerald-200 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-emerald-900 font-bold mb-1">
                  ব্যবহারিক সময় (মিনিট)
                </label>
                <input
                  type="number"
                  min={0}
                  value={practicalMinutes}
                  onChange={(e) => setPracticalMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border border-emerald-200 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-emerald-900 font-bold mb-1">
                  সর্বমোট স্কিল সময়
                </label>
                <div className="p-2 bg-emerald-100/70 rounded-xl text-center font-black text-emerald-900">
                  {toBn(Number(theoryMinutes) + Number(practicalMinutes))} মিনিট
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100">
              <div>
                <label className="block text-blue-900 font-bold mb-1">
                  শুরুর সময়
                </label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="০৯:০০"
                  className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-blue-900 font-bold mb-1">
                  সমাপ্তির সময়
                </label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="১১:০০"
                  className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-blue-900 font-bold mb-1">
                  মোট লিটারেসি মিনিট
                </label>
                <input
                  type="number"
                  min={0}
                  value={totalMinutes}
                  onChange={(e) => setTotalMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-slate-800 font-bold"
                />
              </div>
            </div>
          )}

          {isSkill && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                প্রয়োজনীয় যন্ত্রপাতি ও উপকরণ (Tools & Equipment)
              </label>
              <input
                type="text"
                value={toolsRequired}
                onChange={(e) => setToolsRequired(e.target.value)}
                placeholder="যেমন: ম্যাগনিফাইং ল্যাম্প, ক্লিনজিং মিল্ক, স্টিমার"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              বিশেষ নোট / নির্দেশনা
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="অতিরিক্ত নির্দেশনা বা রেফারেন্স"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <span>সংরক্ষণ হচ্ছে...</span>
              ) : (
                <>
                  <Check size={16} />
                  <span>সংরক্ষণ নিশ্চিত করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModuleInputModal;
