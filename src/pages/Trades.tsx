import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { Plus, Edit2, Trash2, Wrench, Clock, X } from 'lucide-react';
import { Trade } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../lib/dataService';

const Trades: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const { userProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration: '৬ মাস (৩৬০ ঘণ্টা)',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const canEdit = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA';

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const data = await dataService.getItems<Trade>('trades');
      setTrades(data);
    } catch (error) {
      console.warn("Notice fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (trade?: Trade) => {
    if (trade) {
      setEditingTrade(trade);
      setFormData({
        name: trade.name,
        code: trade.code,
        description: trade.description,
        duration: trade.duration,
        status: trade.status,
      });
    } else {
      setEditingTrade(null);
      setFormData({
        name: '',
        code: `TRD-0${trades.length + 1}`,
        description: '',
        duration: '৬ মাস (৩৬০ ঘণ্টা)',
        status: 'Active',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      const id = editingTrade ? editingTrade.id : `TRD-${Date.now().toString().slice(-4)}`;
      const savedTrade: Trade = {
        id,
        ...formData,
        createdAt: editingTrade?.createdAt || Date.now(),
      };

      await dataService.saveItem('trades', savedTrade);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingTrade ? `ট্রেড আপডেট: ${formData.name}` : `নতুন ট্রেড তৈরি: ${formData.name}`,
        'Trades',
        id
      );

      setIsModalOpen(false);
      fetchTrades();
    } catch (error) {
      console.warn("Notice saving trade:", error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canEdit) return;
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${name}" ট্রেডটি মুছে ফেলতে চান? (Are you sure you want to delete this trade?)`)) {
      try {
        await dataService.deleteItem('trades', id);
        logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `ট্রেড মুছে ফেলা হয়েছে: ${name}`,
          'Trades',
          id
        );
        fetchTrades();
      } catch (error) {
        console.warn("Notice deleting trade:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ট্রেড তথ্য লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">বৃত্তিমূলক ট্রেড (Vocational Trades)</h1>
          <p className="text-sm text-slate-500 mt-0.5">প্রশিক্ষণার্থীদের জন্য বরাদ্দকৃত কারিগরি ট্রেড তালিকা</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-600/20"
          >
            <Plus size={18} />
            <span>নতুন ট্রেড যুক্ত করুন</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {trades.map((trade) => (
          <div key={trade.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Wrench size={22} />
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  trade.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {trade.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">{trade.name}</h3>
                <span className="text-xs text-slate-400 font-mono">কোড: {trade.code}</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                {trade.description}
              </p>

              <div className="flex items-center space-x-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <Clock size={14} className="text-slate-400" />
                <span>মেয়াদ: {trade.duration}</span>
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => handleOpenModal(trade)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="সম্পাদন"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(trade.id, trade.name)}
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
                {editingTrade ? 'ট্রেড তথ্য সম্পাদন' : 'নতুন ট্রেড তৈরি'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ট্রেডের নাম *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="যেমন: কম্পিউটার অফিস অ্যাপ্লিকেশন"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ট্রেড কোড *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">কোর্সের মেয়াদ *</label>
                <input
                  type="text"
                  required
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">বিবরণ</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">স্ট্যাটাস</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Active">সক্রিয় (Active)</option>
                  <option value="Inactive">নিষ্ক্রিয় (Inactive)</option>
                </select>
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

export default Trades;
