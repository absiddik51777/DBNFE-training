import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { UserProfile, UserRole, Institute } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Shield, CheckCircle, XCircle, Edit2, X, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../lib/dataService';

const UsersPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Trainer' as UserRole,
    instituteId: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const isCourseDirector = userProfile?.role === 'Course Director';
  const isFMA = userProfile?.role === 'FMA';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [uList, iList] = await Promise.all([
        dataService.getItems<UserProfile>('users'),
        dataService.getItems<Institute>('institutes')
      ]);
      
      setUsers(uList);
      setInstitutes(iList);
    } catch (err) {
      console.warn("Notice fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (u: UserProfile) => {
    // FMA can only edit Trainer
    if (isFMA && u.role !== 'Trainer') {
      alert("FMA শুধুমাত্র প্রশিক্ষক (Trainer) পরিচালনা করতে পারবেন।");
      return;
    }
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      instituteId: u.instituteId || '',
      status: u.status,
    });
    setIsModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedUser: UserProfile = {
        ...editingUser,
        role: formData.role,
        instituteId: formData.instituteId,
        status: formData.status,
        phone: formData.phone,
        name: formData.name,
      };

      await dataService.saveItem('users', updatedUser);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `ব্যবহারকারী প্রোফাইল আপডেট: ${formData.name} (${formData.role})`,
        'Users',
        editingUser.id
      );

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.warn("Notice updating user:", err);
      setIsModalOpen(false);
      fetchUsers();
    }
  };

  const getInstituteName = (id?: string) => {
    if (!id) return '-';
    return institutes.find(i => i.id === id)?.name || id;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ব্যবহারকারী তালিকা লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ব্যবহারকারী ও পদবী ব্যবস্থাপনা (User Management)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            নিবন্ধিত কর্মকর্তা ও প্রশিক্ষকদের পদবী ও পারমিশন নিয়ন্ত্রণ করুন
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">নাম ও ইমেইল</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">মোবাইল নম্বর</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">পদবী (Role)</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">সংযুক্ত প্রতিষ্ঠান</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">অবস্থা</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs">
                    কোনো অতিরিক্ত ব্যবহারকারী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                    {u.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      u.role === 'Course Director' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'FMA' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                    {getInstituteName(u.instituteId)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      u.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditClick(u)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="পদবী বা প্রতিষ্ঠান পরিবর্তন"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-bold text-slate-800">ব্যবহারকারী তথ্য ও পারমিশন সম্পাদন</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">নাম</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ইমেইল (Read-only)</label>
                <input
                  type="email"
                  readOnly
                  value={formData.email}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">মোবাইল নম্বর</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পদবী (Role)</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                  disabled={!isCourseDirector} // Only Course Director can change role of users
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Course Director">Course Director (কোর্স পরিচালক)</option>
                  <option value="FMA">FMA (ফিল্ড মনিটরিং অ্যাসোসিয়েট)</option>
                  <option value="Trainer">Trainer (প্রশিক্ষক)</option>
                </select>
              </div>

              {formData.role === 'Trainer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">নির্ধারিত প্রতিষ্ঠান</label>
                  <select
                    value={formData.instituteId}
                    onChange={e => setFormData({ ...formData, instituteId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">কোনোটিই নয় (Unassigned)</option>
                    {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">অ্যাকাউন্ট স্ট্যাটাস</label>
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
                  আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
