import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { Plus, Edit2, Trash2, Layers, Calendar, Users, X } from 'lucide-react';
import { Batch, Institute, Trade } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const Batches: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const { userProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    instituteId: '',
    tradeId: '',
    startDate: '',
    endDate: '',
    maxTrainees: 30,
    status: 'Active' as 'Upcoming' | 'Active' | 'Completed',
  });

  const canEdit = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bList, iList, tList] = await Promise.all([
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
      ]);

      setBatches(bList);
      setInstitutes(iList);
      setTrades(tList);
      if (iList.length > 0 && !formData.instituteId) {
        setFormData(prev => ({ ...prev, instituteId: iList[0].id }));
      }
      if (tList.length > 0 && !formData.tradeId) {
        setFormData(prev => ({ ...prev, tradeId: tList[0].id }));
      }
    } catch (error) {
      console.warn("Notice fetching batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (b?: Batch) => {
    if (b) {
      setEditingBatch(b);
      setFormData({
        name: b.name,
        instituteId: b.instituteId,
        tradeId: b.tradeId,
        startDate: format(b.startDate, 'yyyy-MM-dd'),
        endDate: format(b.endDate, 'yyyy-MM-dd'),
        maxTrainees: b.maxTrainees,
        status: b.status,
      });
    } else {
      setEditingBatch(null);
      setFormData({
        name: '',
        instituteId: institutes[0]?.id || '',
        tradeId: trades[0]?.id || '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 180 * 86400000), 'yyyy-MM-dd'),
        maxTrainees: 30,
        status: 'Active',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      const id = editingBatch ? editingBatch.id : `BAT-${Date.now().toString().slice(-4)}`;
      const savedBatch: Batch = {
        id,
        name: formData.name,
        instituteId: formData.instituteId,
        tradeId: formData.tradeId,
        startDate: new Date(formData.startDate).getTime(),
        endDate: new Date(formData.endDate).getTime(),
        maxTrainees: Number(formData.maxTrainees),
        status: formData.status,
        createdAt: editingBatch?.createdAt || Date.now(),
      };

      await dataService.saveItem('batches', savedBatch);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingBatch ? `ব্যাচ আপডেট: ${formData.name}` : `নতুন ব্যাচ তৈরি: ${formData.name}`,
        'Batches',
        id
      );

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.warn("Notice saving batch:", error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canEdit) return;
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${name}" ব্যাচটি মুছে ফেলতে চান? (Are you sure you want to delete this batch?)`)) {
      try {
        await dataService.deleteItem('batches', id);
        logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ব্যাচ মুছে ফেলা হয়েছে: ${name}`,
          'Batches',
          id
        );
        fetchData();
      } catch (error) {
        console.warn("Notice deleting batch:", error);
      }
    }
  };

  const getInstituteName = (id: string) => institutes.find(i => i.id === id)?.name || id;
  const getTradeName = (id: string) => trades.find(t => t.id === id)?.name || id;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ব্যাচ তথ্য লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">প্রশিক্ষণ ব্যাচ (Training Batches)</h1>
          <p className="text-sm text-slate-500 mt-0.5">প্রতিষ্ঠান ও ট্রেড অনুযায়ী প্রশিক্ষণার্থীদের ব্যাচ পরিচালনা</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-600/20"
          >
            <Plus size={18} />
            <span>নতুন ব্যাচ যুক্ত করুন</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {batches.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Layers size={22} />
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  b.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                  b.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                }`}>
                  {b.status === 'Active' ? 'চলমান' : b.status === 'Upcoming' ? 'আসন্ন' : 'সম্পন্ন'}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">{b.name}</h3>
                <span className="text-xs text-emerald-700 font-medium block mt-0.5">{getTradeName(b.tradeId)}</span>
                <span className="text-xs text-slate-500 block truncate">{getInstituteName(b.instituteId)}</span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <span>
                    {format(b.startDate, 'dd MMM yyyy')} - {format(b.endDate, 'dd MMM yyyy')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users size={14} className="text-slate-400 shrink-0" />
                  <span>সর্বোচ্চ আসন: {b.maxTrainees} জন</span>
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => handleOpenModal(b)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="সম্পাদন"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(b.id, b.name)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="মুছুন"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {editingBatch ? 'ব্যাচ সম্পাদন' : 'নতুন ব্যাচ তৈরি'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ব্যাচের নাম *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="যেমন: কম্পিউটার ১ম ব্যাচ (জানু-জুন ২০২৬)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">প্রশিক্ষণ প্রতিষ্ঠান *</label>
                <select
                  required
                  value={formData.instituteId}
                  onChange={e => setFormData({ ...formData, instituteId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ট্রেড নির্বাচন *</label>
                <select
                  required
                  value={formData.tradeId}
                  onChange={e => setFormData({ ...formData, tradeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">শুরুর তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">সমাপ্তির তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">সর্বোচ্চ আসন</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={formData.maxTrainees}
                    onChange={e => setFormData({ ...formData, maxTrainees: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">অবস্থা</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Active">চলমান (Active)</option>
                    <option value="Upcoming">আসন্ন (Upcoming)</option>
                    <option value="Completed">সম্পন্ন (Completed)</option>
                  </select>
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

export default Batches;
