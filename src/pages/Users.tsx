import React, { useState, useEffect } from 'react';
import { logActivity } from '../lib/firebase';
import { UserProfile, UserRole, Institute, Batch, Trade } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Shield, CheckCircle, XCircle, Edit2, X, Phone, Mail, Building2, Layers, Search } from 'lucide-react';
import { dataService } from '../lib/dataService';

const UsersPage: React.FC = () => {
  const { userProfile, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Trainer' as UserRole,
    instituteId: '',
    batchId: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Add form state
  const [addFormData, setAddFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Trainer' as UserRole,
    instituteId: '',
    batchId: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const isCourseDirector = userProfile?.role === 'Course Director';
  const isFMA = userProfile?.role === 'FMA';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uList, iList, bList, tList] = await Promise.all([
        dataService.getItems<UserProfile>('users'),
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trade>('trades')
      ]);

      setUsers(uList);
      setInstitutes(iList);
      setBatches(bList);
      setTrades(tList);
    } catch (err) {
      console.warn("Notice fetching user management data:", err);
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
    setEditFormData({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      instituteId: u.instituteId || '',
      batchId: u.batchId || '',
      status: u.status,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedUser: UserProfile = {
        ...editingUser,
        name: editFormData.name.trim(),
        role: editFormData.role,
        instituteId: editFormData.role === 'Trainer' ? editFormData.instituteId : '',
        batchId: editFormData.role === 'Trainer' ? editFormData.batchId : '',
        status: editFormData.status,
        phone: editFormData.phone.trim(),
      };

      await dataService.saveItem('users', updatedUser);

      // If current user updated their own profile
      if (userProfile?.id === updatedUser.id) {
        localStorage.setItem(`bnfe_user_profile_${updatedUser.id}`, JSON.stringify(updatedUser));
        await refreshProfile();
      }

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `ব্যবহারকারী প্রোফাইল আপডেট: ${editFormData.name} (${editFormData.role}) - ব্যাচ: ${editFormData.batchId || 'N/A'}`,
        'Users',
        editingUser.id
      );

      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      console.warn("Notice updating user:", err);
      setIsEditModalOpen(false);
      fetchData();
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.name.trim() || !addFormData.email.trim()) return;

    try {
      const newId = `USR-${Date.now().toString().slice(-6)}`;
      const newUser: UserProfile = {
        id: newId,
        name: addFormData.name.trim(),
        email: addFormData.email.trim().toLowerCase(),
        phone: addFormData.phone.trim(),
        role: addFormData.role,
        instituteId: addFormData.role === 'Trainer' ? addFormData.instituteId : '',
        batchId: addFormData.role === 'Trainer' ? addFormData.batchId : '',
        status: addFormData.status,
        createdAt: Date.now(),
      };

      await dataService.saveItem('users', newUser);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `নতুন ${addFormData.role === 'Trainer' ? 'প্রশিক্ষক' : 'ব্যবহারকারী'} নিবন্ধন: ${newUser.name} (${newUser.email})`,
        'Users',
        newId
      );

      setIsAddModalOpen(false);
      setAddFormData({
        name: '',
        email: '',
        phone: '',
        role: 'Trainer',
        instituteId: institutes[0]?.id || '',
        batchId: '',
        status: 'Active',
      });
      fetchData();
    } catch (err) {
      console.warn("Notice creating new user:", err);
      setIsAddModalOpen(false);
      fetchData();
    }
  };

  const getInstituteName = (id?: string) => {
    if (!id) return '-';
    return institutes.find(i => i.id === id)?.name || id;
  };

  const getBatchInfo = (batchId?: string) => {
    if (!batchId) return null;
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return null;
    const trade = trades.find(t => t.id === batch.tradeId);
    return {
      batchName: batch.name,
      tradeName: trade?.name || '',
    };
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.phone?.includes(searchQuery));
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ব্যবহারকারী ও প্রশিক্ষক ব্যবস্থাপনা (User Management)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            প্রশিক্ষকদের প্রতিষ্ঠান ও ব্যাচ সংযুক্ত করুন এবং পদবী ও পারমিশন নিয়ন্ত্রণ করুন
          </p>
        </div>

        {(isCourseDirector || isFMA) && (
          <button
            onClick={() => {
              setAddFormData({
                name: '',
                email: '',
                phone: '',
                role: 'Trainer',
                instituteId: institutes[0]?.id || '',
                batchId: '',
                status: 'Active',
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition"
          >
            <UserPlus size={18} />
            <span>নতুন প্রশিক্ষক / ব্যবহারকারী যোগ করুন</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">পদবী ফিল্টার:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none w-full sm:w-auto"
          >
            <option value="All">সকল পদবী ({users.length})</option>
            <option value="Trainer">প্রশিক্ষক - Trainer ({users.filter(u => u.role === 'Trainer').length})</option>
            <option value="Course Director">কোর্স পরিচালক - Course Director ({users.filter(u => u.role === 'Course Director').length})</option>
            <option value="FMA">FMA ({users.filter(u => u.role === 'FMA').length})</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">নাম ও ইমেইল</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">মোবাইল নম্বর</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">পদবী (Role)</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">সংযুক্ত প্রতিষ্ঠান</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">নির্ধারিত ব্যাচ (Batch)</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">অবস্থা</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs">
                    কোনো ব্যবহারকারী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const batchInfo = getBatchInfo(u.batchId);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                        {u.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          u.role === 'Course Director' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'FMA' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {u.role === 'Trainer' ? 'প্রশিক্ষক (Trainer)' : u.role === 'Course Director' ? 'কোর্স পরিচালক' : 'FMA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                        {u.role === 'Trainer' ? (
                          <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                            <Building2 size={14} className="text-emerald-600 shrink-0" />
                            <span>{getInstituteName(u.instituteId)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">সকল প্রতিষ্ঠান</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {u.role === 'Trainer' ? (
                          batchInfo ? (
                            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                              <Layers size={13} className="text-emerald-600 shrink-0" />
                              <span>{batchInfo.batchName}</span>
                              {batchInfo.tradeName && (
                                <span className="text-[11px] font-normal text-emerald-600">({batchInfo.tradeName})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ব্যাচ অনির্ধারিত
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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
                          title="পদবী, প্রতিষ্ঠান বা ব্যাচ সম্পাদনা"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">ব্যবহারকারী ও ব্যাচ সম্পাদন</h2>
                <p className="text-xs text-slate-500">প্রশিক্ষকের প্রতিষ্ঠান ও নির্ধারিত ব্যাচ আপডেট করুন</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">নাম *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ইমেইল (Read-only)</label>
                <input
                  type="email"
                  readOnly
                  value={editFormData.email}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  value={editFormData.phone}
                  onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পদবী (Role)</label>
                <select
                  value={editFormData.role}
                  onChange={e => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                  disabled={!isCourseDirector}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Trainer">Trainer (প্রশিক্ষক)</option>
                  <option value="Course Director">Course Director (কোর্স পরিচালক)</option>
                  <option value="FMA">FMA (ফিল্ড মনিটরিং অ্যাসোসিয়েট)</option>
                </select>
              </div>

              {editFormData.role === 'Trainer' && (
                <div className="space-y-3 p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                  <div className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5">
                    <Building2 size={15} />
                    <span>প্রশিক্ষকের প্রতিষ্ঠান ও ব্যাচ অ্যাসাইনমেন্ট</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">সংযুক্ত প্রতিষ্ঠান *</label>
                    <select
                      value={editFormData.instituteId}
                      onChange={e => {
                        const newInstId = e.target.value;
                        setEditFormData({ 
                          ...editFormData, 
                          instituteId: newInstId,
                          batchId: '' // reset batch when institute changes
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">কোনোটিই নয় (Unassigned)</option>
                      {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">নির্ধারিত ব্যাচ (Assigned Batch) *</label>
                    <select
                      value={editFormData.batchId}
                      onChange={e => setEditFormData({ ...editFormData, batchId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">ব্যাচ নির্বাচন করুন (কোনোটিই নয় / Unassigned)</option>
                      {batches
                        .filter(b => !editFormData.instituteId || b.instituteId === editFormData.instituteId)
                        .map(b => {
                          const tradeName = trades.find(t => t.id === b.tradeId)?.name;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} {tradeName ? `(${tradeName})` : ''}
                            </option>
                          );
                        })}
                    </select>
                    <p className="text-[11px] text-emerald-700/90 mt-1 font-medium">
                      ✓ উপস্থিতি (Attendance) মডিউলে এই প্রশিক্ষক সরাসরি এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা দেখতে পাবেন।
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">অ্যাকাউন্ট স্ট্যাটাস</label>
                <select
                  value={editFormData.status}
                  onChange={e => setEditFormData({ ...editFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Active">সক্রিয় (Active)</option>
                  <option value="Inactive">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  আপডেট সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">নতুন ব্যবহারকারী / প্রশিক্ষক নিবন্ধন</h2>
                <p className="text-xs text-slate-500">প্রশিক্ষক হিসেবে প্রতিষ্ঠান ও ব্যাচে নিবন্ধন করুন</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পূর্ণ নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মোঃ কামরুল হাসান"
                  value={addFormData.name}
                  onChange={e => setAddFormData({ ...addFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ইমেইল ঠিকানা *</label>
                <input
                  type="email"
                  required
                  placeholder="trainer@bnfe.gov.bd"
                  value={addFormData.email}
                  onChange={e => setAddFormData({ ...addFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  placeholder="017xxxxxxxx"
                  value={addFormData.phone}
                  onChange={e => setAddFormData({ ...addFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পদবী (Role) *</label>
                <select
                  value={addFormData.role}
                  onChange={e => setAddFormData({ ...addFormData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Trainer">Trainer (প্রশিক্ষক - প্রতিষ্ঠান ও ব্যাচ ভিত্তিক)</option>
                  {isCourseDirector && (
                    <>
                      <option value="Course Director">Course Director (কোর্স পরিচালক)</option>
                      <option value="FMA">FMA (ফিল্ড মনিটরিং অ্যাসোসিয়েট)</option>
                    </>
                  )}
                </select>
              </div>

              {addFormData.role === 'Trainer' && (
                <div className="space-y-3 p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                  <div className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5">
                    <Building2 size={15} />
                    <span>প্রশিক্ষকের প্রতিষ্ঠান ও ব্যাচ নির্বাচন</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান *</label>
                    <select
                      value={addFormData.instituteId}
                      onChange={e => {
                        const newInst = e.target.value;
                        setAddFormData({
                          ...addFormData,
                          instituteId: newInst,
                          batchId: ''
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                      {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">নির্ধারিত ব্যাচ (Assigned Batch) *</label>
                    <select
                      value={addFormData.batchId}
                      onChange={e => setAddFormData({ ...addFormData, batchId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">ব্যাচ নির্বাচন করুন</option>
                      {batches
                        .filter(b => !addFormData.instituteId || b.instituteId === addFormData.instituteId)
                        .map(b => {
                          const tradeName = trades.find(t => t.id === b.tradeId)?.name;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} {tradeName ? `(${tradeName})` : ''}
                            </option>
                          );
                        })}
                    </select>
                    <p className="text-[11px] text-emerald-700/90 mt-1 font-medium">
                      ✓ উপস্থিতি মডিউলে এই প্রশিক্ষক সরাসরি এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা দেখতে পাবেন।
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  নিবন্ধন সম্পন্ন করুন
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
