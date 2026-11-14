import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileText, Calendar, Award, BookOpen, X } from 'lucide-react';
import { Exam, Institute, Trade, Batch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useConfirm } from '../contexts/ConfirmationContext';
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
  const { confirm, showAlert } = useConfirm();
  
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

  const { hasPermission } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();

  const canCreate = hasPermission('create_exam');
  const canEdit = hasPermission('edit_exam');
  const canDelete = hasPermission('delete_exam');

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

  const isTrainer = userProfile?.role === 'Trainer';

  const displayedExams = exams.filter(exam => {
    if (isTrainer) {
      if (userProfile.batchId && exam.batchId !== userProfile.batchId) return false;
      if (userProfile.instituteId && exam.instituteId !== userProfile.instituteId) return false;
    }
    return true;
  });

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
      let defaultInst = userProfile?.instituteId || (institutes[0]?.id || '');
      let defaultBatch = batches[0]?.id || '';
      let defaultTrade = trades[0]?.id || '';

      if (isTrainer) {
        if (userProfile.batchId) defaultBatch = userProfile.batchId;
        const b = batches.find(item => item.id === defaultBatch);
        if (b) {
          defaultInst = b.instituteId || defaultInst;
          defaultTrade = b.tradeId || defaultTrade;
        }
      }

      setFormData({
        name: `চূড়ান্ত মূল্যায়ন পরীক্ষা (${new Date().getFullYear()})`,
        type: 'চূড়ান্ত পরীক্ষা (Final Examination)',
        instituteId: defaultInst,
        tradeId: defaultTrade,
        batchId: defaultBatch,
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
      await showAlert({
        title: 'অকার্যকর নম্বর',
        message: "পাস নম্বর মোট নম্বরের চেয়ে বেশি হতে পারে না।",
        variant: 'warning'
      });
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

      await dataService.saveItem('exams', savedExam, {
        actor: userProfile ? { userId: userProfile.id || '', user: userProfile.name || 'User', userRole: userProfile.role || '' } : undefined,
      });

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.warn("Notice saving exam:", error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete && !canEdit) return;
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'পরীক্ষা সংরক্ষণাগারে স্থানান্তর (Fallback to Archive)',
        message: `সিস্টেম সেটিংস অনুযায়ী পরীক্ষা স্থায়ীভাবে মুছে ফেলা বন্ধ (Denied) রয়েছে। আপনি কি "${name}" পরীক্ষাটি মুছে ফেলার পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ সংরক্ষণাগারে স্থানান্তর করলে শিক্ষার্থীদের প্রাপ্ত নম্বর ও মূল্যায়ন রেকর্ড ডাটাবেজে সুরক্ষিত থাকবে এবং পরীক্ষাটি সক্রিয় তালিকা থেকে সংরক্ষণাগারে স্থানান্তরিত হবে।',
        confirmText: 'হ্যাঁ, পরীক্ষা আর্কাইভ করুন (Archive)',
        cancelText: 'বাতিল',
        variant: 'warning'
      });

      if (confirmed) {
        try {
          await dataService.archiveRecord(
            'exams',
            id,
            'সিস্টেমে ডিলিট নিষিদ্ধ থাকায় সংরক্ষণাগারে স্থানান্তর',
            userProfile ? { userId: userProfile.id || '', user: userProfile.name || 'User', userRole: userProfile.role || '' } : undefined
          );
          fetchData();
        } catch (error) {
          console.warn("Notice archiving exam:", error);
        }
      }
      return;
    }

    const confirmed = await confirm({
      title: 'পরীক্ষা মুছে ফেলার নিশ্চিতকরণ',
      message: `আপনি কি নিশ্চিতভাবে "${name}" পরীক্ষাটি মুছে ফেলতে চান?`,
      detail: 'এই পরীক্ষা এবং এর সাথে সম্পর্কিত গ্রেডিং ডাটা সিস্টেম থেকে অপসারিত হবে।',
      confirmText: 'হ্যাঁ, মুছে ফেলুন',
      cancelText: 'বাতিল',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        await dataService.deleteItem('exams', id, true, {
          actor: userProfile ? { userId: userProfile.id || '', user: userProfile.name || 'User', userRole: userProfile.role || '' } : undefined,
        });
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
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>পরীক্ষা তালিকা লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">পরীক্ষা ব্যবস্থাপনা (Examination Management)</h1>
          <p className="text-sm text-theme-text-secondary mt-0.5">মাসিক মূল্যায়ন, মিড-টার্ম ও চূড়ান্ত পরীক্ষা তৈরি ও সময়সূচি</p>
        </div>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition cursor-pointer"
          >
            <Plus size={18} />
            <span>নতুন পরীক্ষা তৈরি করুন</span>
          </button>
        )}
      </div>

      {displayedExams.length === 0 ? (
        <div className="bg-theme-surface rounded-2xl border border-theme-border p-12 text-center text-theme-text-secondary">
          <FileText size={48} className="mx-auto text-theme-text-muted mb-3" />
          <h3 className="font-bold text-theme-text-primary text-base">কোনো পরীক্ষা তৈরি করা হয়নি</h3>
          <p className="text-sm text-theme-text-muted mt-1">নম্বর এন্ট্রি ও ফলাফল প্রস্তুত করতে নতুন পরীক্ষা যুক্ত করুন।</p>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 px-4 py-2 bg-theme-primary text-theme-primary-fg rounded-xl text-sm font-semibold hover:bg-theme-primary-hover transition cursor-pointer"
            >
              পরীক্ষা যুক্ত করুন
            </button>
          )}
        </div>
      ) : (
        <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-theme-border">
              <thead className="bg-theme-surface-subtle">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">পরীক্ষার নাম ও ধরন</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">বিষয়</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">প্রতিষ্ঠান ও ব্যাচ</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">তারিখ</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">নম্বর বণ্টন</th>
                  {(canEdit || canDelete) && <th className="px-6 py-3.5 text-right text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="bg-theme-surface divide-y divide-theme-border">
                {displayedExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-theme-surface-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-theme-text-primary">{exam.name}</div>
                      <span className="text-[11px] px-2 py-0.5 bg-theme-accent-soft text-theme-accent border border-theme-accent-border rounded-md font-medium mt-1 inline-block">
                        {exam.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary font-medium">
                      {exam.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-theme-text-primary">{getBatchName(exam.batchId)}</div>
                      <div className="text-xs text-theme-text-muted">{getInstituteName(exam.instituteId)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-theme-text-secondary tabular-nums">
                      {format(exam.date, 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs tabular-nums">
                      <div className="font-bold text-theme-text-primary">মোট: {exam.totalMarks}</div>
                      <div className="text-theme-primary font-medium">পাস: {exam.passMarks}</div>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenModal(exam)}
                            className="text-theme-info hover:bg-theme-info-soft mr-2 p-1.5 rounded-lg transition cursor-pointer"
                            title="সম্পাদনা"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(exam.id, exam.name)}
                            className="text-theme-danger hover:bg-theme-danger-soft p-1.5 rounded-lg transition cursor-pointer"
                            title={!isDeletionAllowed ? 'আর্কাইভে স্থানান্তর (ডিলিট বন্ধ থাকায়)' : 'মুছে ফেলুন বা সংরক্ষণাগারে পাঠান'}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-theme-elevated text-theme-text-primary rounded-2xl max-w-lg w-full p-6 shadow-xl border border-theme-border">
            <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-4">
              <h2 className="text-lg font-bold text-theme-text-primary">
                {editingExam ? 'পরীক্ষা তথ্য সম্পাদনা' : 'নতুন পরীক্ষা তৈরি'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-theme-text-muted hover:text-theme-text-primary p-1 rounded-lg transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পরীক্ষার নাম *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. মিড-টার্ম পরীক্ষা ২০২৪"
                  className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পরীক্ষার ধরন *</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                  >
                    <option value="মাসিক মূল্যায়ন (Monthly Assessment)">মাসিক মূল্যায়ন</option>
                    <option value="মিড-টার্ম (Mid-Term)">মিড-টার্ম পরীক্ষা</option>
                    <option value="চূড়ান্ত পরীক্ষা (Final Examination)">চূড়ান্ত পরীক্ষা</option>
                    <option value="ব্যবহারিক পরীক্ষা (Practical)">ব্যবহারিক পরীক্ষা</option>
                    <option value="তাত্ত্বিক পরীক্ষা (Theory)">তাত্ত্বিক পরীক্ষা</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">বিষয় (Subject) *</label>
                  <input
                    required
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. কম্পিউটার মৌলিক"
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                  />
                </div>
              </div>

              {!isTrainer && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রতিষ্ঠান *</label>
                    <select
                      required
                      value={formData.instituteId}
                      onChange={e => setFormData({ ...formData, instituteId: e.target.value })}
                      className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                    >
                      <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                      {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ব্যাচ *</label>
                    <select
                      required
                      value={formData.batchId}
                      onChange={e => setFormData({ ...formData, batchId: e.target.value })}
                      className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none"
                    >
                      <option value="">ব্যাচ নির্বাচন করুন</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">তারিখ *</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">মোট নম্বর *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="500"
                    value={formData.totalMarks}
                    onChange={e => setFormData({ ...formData, totalMarks: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পাস নম্বর *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="500"
                    value={formData.passMarks}
                    onChange={e => setFormData({ ...formData, passMarks: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong text-theme-text-primary rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-theme-border rounded-xl text-sm font-medium text-theme-text-secondary hover:bg-theme-surface-hover transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-xs transition cursor-pointer"
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
