import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { Plus, Edit2, Trash2, FileText, Calendar, Award, BookOpen, X } from 'lucide-react';
import { Exam, Institute, Trade, Batch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const Exams: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const { userProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'মাসিক মূল্যায়ন (Monthly Assessment)',
    instituteId: '',
    tradeId: '',
    batchId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    totalMarks: 100,
    passMarks: 40,
    subject: 'ব্যবহারিক ও তাত্ত্বিক (Practical & Theory)',
    description: '',
  });

  const canEdit = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA' || userProfile?.role === 'Trainer';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [examsList, instList, tradesList, batchesList] = await Promise.all([
        dataService.getItems<Exam>('exams'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches')
      ]);
      
      setExams(examsList);
      setInstitutes(instList);
      setTrades(tradesList);
      setBatches(batchesList);
    } catch (error) {
      console.warn("Notice fetching exams data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (exam?: Exam) => {
    if (exam) {
      setEditingExam(exam);
      setFormData({
        name: exam.name,
        type: exam.type,
        instituteId: exam.instituteId,
        tradeId: exam.tradeId,
        batchId: exam.batchId,
        date: format(new Date(exam.date), 'yyyy-MM-dd'),
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        subject: exam.subject,
        description: exam.description || '',
      });
    } else {
      setEditingExam(null);
      const defaultInst = userProfile?.instituteId || (institutes[0]?.id || '');
      setFormData({
        name: `চূড়ান্ত মূল্যায়ন পরীক্ষা (${new Date().getFullYear()})`,
        type: 'চূড়ান্ত পরীক্ষা (Final Examination)',
        instituteId: defaultInst,
        tradeId: trades[0]?.id || '',
        batchId: batches[0]?.id || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        totalMarks: 100,
        passMarks: 40,
        subject: 'ব্যবহারিক ও মৌখিক (Practical & Oral)',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (formData.passMarks > formData.totalMarks) {
      alert("পাস নম্বর মোট নম্বরের চেয়ে বেশি হতে পারে না।");
      return;
    }

    try {
      const id = editingExam ? editingExam.id : `EXM-${Date.now().toString().slice(-4)}`;
      const savedExam: Exam = {
        id,
        ...formData,
        date: new Date(formData.date).getTime(),
        createdAt: editingExam?.createdAt || Date.now(),
      };

      await dataService.saveItem('exams', savedExam);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingExam ? `পরীক্ষা আপডেট: ${formData.name}` : `নতুন পরীক্ষা তৈরি: ${formData.name}`,
        'Exams',
        id
      );

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.warn("Notice saving exam:", error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canEdit) return;
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${name}" পরীক্ষাটি মুছে ফেলতে চান?`)) {
      try {
        await dataService.deleteItem('exams', id);
        logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `পরীক্ষা মুছে ফেলা হয়েছে: ${name}`,
          'Exams',
          id
        );
        fetchData();
      } catch (error) {
        console.warn("Notice deleting exam:", error);
      }
    }
  };

  const getInstituteName = (id: string) => institutes.find(i => i.id === id)?.name || '-';
  const getTradeName = (id: string) => trades.find(t => t.id === id)?.name || '-';
  const getBatchName = (id: string) => batches.find(t => t.id === id)?.name || '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>পরীক্ষা তালিকা লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">পরীক্ষা ব্যবস্থাপনা (Examination Management)</h1>
          <p className="text-sm text-slate-500 mt-0.5">মাসিক মূল্যায়ন, মিড-টার্ম ও চূড়ান্ত পরীক্ষা তৈরি ও সময়সূচি</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition"
          >
            <Plus size={18} />
            <span>নতুন পরীক্ষা তৈরি করুন</span>
          </button>
        )}
      </div>

      {exams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <FileText size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-700 text-base">কোনো পরীক্ষা তৈরি করা হয়নি</h3>
          <p className="text-sm text-slate-400 mt-1">নম্বর এন্ট্রি ও ফলাফল প্রস্তুত করতে নতুন পরীক্ষা যুক্ত করুন।</p>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
            >
              পরীক্ষা যুক্ত করুন
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">পরীক্ষার নাম ও ধরন</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">বিষয়</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">প্রতিষ্ঠান ও ব্যাচ</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">তারিখ</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">নম্বর বণ্টন</th>
                  {canEdit && <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-800">{exam.name}</div>
                      <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-medium mt-1 inline-block">
                        {exam.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {exam.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-700">{getBatchName(exam.batchId)}</div>
                      <div className="text-xs text-slate-400">{getInstituteName(exam.instituteId)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {format(exam.date, 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs">
                      <div className="font-bold text-slate-800">মোট: {exam.totalMarks}</div>
                      <div className="text-emerald-600 font-medium">পাস: {exam.passMarks}</div>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(exam)}
                          className="text-blue-600 hover:text-blue-900 mr-3 p-1 rounded hover:bg-blue-50 transition"
                          title="সম্পাদনা"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(exam.id, exam.name)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {editingExam ? 'পরীক্ষা তথ্য সম্পাদনা' : 'নতুন পরীক্ষা তৈরি'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষার নাম *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. মিড-টার্ম পরীক্ষা ২০২৪"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষার ধরন *</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="মাসিক মূল্যায়ন (Monthly Assessment)">মাসিক মূল্যায়ন</option>
                    <option value="মিড-টার্ম (Mid-Term)">মিড-টার্ম পরীক্ষা</option>
                    <option value="চূড়ান্ত পরীক্ষা (Final Examination)">চূড়ান্ত পরীক্ষা</option>
                    <option value="ব্যবহারিক পরীক্ষা (Practical)">ব্যবহারিক পরীক্ষা</option>
                    <option value="তাত্ত্বিক পরীক্ষা (Theory)">তাত্ত্বিক পরীক্ষা</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">বিষয় (Subject) *</label>
                  <input
                    required
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. কম্পিউটার মৌলিক"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান *</label>
                  <select
                    required
                    value={formData.instituteId}
                    onChange={e => setFormData({ ...formData, instituteId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                    {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ব্যাচ *</label>
                  <select
                    required
                    value={formData.batchId}
                    onChange={e => setFormData({ ...formData, batchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">ব্যাচ নির্বাচন করুন</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">তারিখ *</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">মোট নম্বর *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="500"
                    value={formData.totalMarks}
                    onChange={e => setFormData({ ...formData, totalMarks: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">পাস নম্বর *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="500"
                    value={formData.passMarks}
                    onChange={e => setFormData({ ...formData, passMarks: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
