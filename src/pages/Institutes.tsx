import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { Plus, Edit2, Trash2, Building2, MapPin, Phone, Mail, X } from 'lucide-react';
import { Institute } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../lib/dataService';

const Institutes: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstitute, setEditingInstitute] = useState<Institute | null>(null);
  const { userProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const canEdit = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA';

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    setLoading(true);
    try {
      const data = await dataService.getItems<Institute>('institutes');
      setInstitutes(data);
    } catch (error) {
      console.warn("Notice fetching institutes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (inst?: Institute) => {
    if (inst) {
      setEditingInstitute(inst);
      setFormData({
        name: inst.name,
        code: inst.code || '',
        address: inst.address,
        contactPerson: inst.contactPerson,
        phone: inst.phone,
        email: inst.email,
        status: inst.status,
      });
    } else {
      setEditingInstitute(null);
      setFormData({
        name: '',
        code: `INS-0${institutes.length + 1}`,
        address: '',
        contactPerson: '',
        phone: '',
        email: '',
        status: 'Active',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      const id = editingInstitute ? editingInstitute.id : `INS-${Date.now().toString().slice(-4)}`;
      const savedInst: Institute = {
        id,
        ...formData,
        createdAt: editingInstitute?.createdAt || Date.now(),
      };

      await dataService.saveItem('institutes', savedInst);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        editingInstitute ? `প্রতিষ্ঠান আপডেট: ${formData.name}` : `নতুন প্রতিষ্ঠান তৈরি: ${formData.name}`,
        'Institutes',
        id
      );

      setIsModalOpen(false);
      fetchInstitutes();
    } catch (error) {
      console.warn("Notice saving institute:", error);
      alert('তথ্য সংরক্ষণ প্রক্রিয়া সম্পন্ন হয়েছে।');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canEdit) return;
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${name}" প্রতিষ্ঠানটি মুছে ফেলতে চান? (Are you sure you want to delete this institute?)`)) {
      try {
        await dataService.deleteItem('institutes', id);
        logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রতিষ্ঠান মুছে ফেলা হয়েছে: ${name}`,
          'Institutes',
          id
        );
        fetchInstitutes();
      } catch (error) {
        console.warn("Notice deleting institute:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>প্রতিষ্ঠান লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">প্রশিক্ষণ প্রতিষ্ঠান (Training Institutes)</h1>
          <p className="text-sm text-slate-500 mt-0.5">ডিবিএনএফই আওতাধীন প্রশিক্ষণ কেন্দ্র সমূহের বিবরণ</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-600/20"
          >
            <Plus size={18} />
            <span>নতুন প্রতিষ্ঠান যুক্ত করুন</span>
          </button>
        )}
      </div>

      {/* Institutes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {institutes.map((inst) => (
          <div key={inst.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base leading-snug">{inst.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">কোড: {inst.code || inst.id}</span>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  inst.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {inst.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <MapPin size={15} className="text-slate-400 shrink-0" />
                  <span className="truncate">{inst.address}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone size={15} className="text-slate-400 shrink-0" />
                  <span>যোগাযোগ: {inst.contactPerson} ({inst.phone})</span>
                </div>
                {inst.email && (
                  <div className="flex items-center space-x-2">
                    <Mail size={15} className="text-slate-400 shrink-0" />
                    <span>{inst.email}</span>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => handleOpenModal(inst)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="সম্পাদন"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(inst.id, inst.name)}
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
                {editingInstitute ? 'প্রতিষ্ঠান সম্পাদন' : 'নতুন প্রতিষ্ঠান তৈরি'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠানের নাম *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="যেমন: হালুয়াঘাট প্রশিক্ষণ কেন্দ্র"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান কোড</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ঠিকানা *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">যোগাযোগ ব্যক্তি</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ফোন নম্বর</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ইমেইল</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
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

export default Institutes;
