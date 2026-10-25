import React, { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';
import { Role, UserProfile } from '../types';
import { 
  ALL_PERMISSIONS, 
  ALL_PERMISSION_KEYS, 
  getGroupedPermissions, 
  DEFAULT_ROLES 
} from '../lib/permissions';
import { dataService } from '../lib/dataService';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Lock, 
  CheckCircle2, 
  SlidersHorizontal,
  Table as TableIcon,
  Grid,
  Users,
  Search,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

const RolesPage: React.FC = () => {
  const { 
    roles, 
    updateRolePermissions, 
    createRole, 
    deleteRole, 
    refreshRoles,
    isCourseDirector 
  } = usePermissions();
  const { userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'table' | 'matrix'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Modal / Drawer states
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<Role | null>(null);
  const [selectedPermKeys, setSelectedPermKeys] = useState<string[]>([]);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Add / Edit Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    nameBn: '',
    code: '',
    description: '',
    template: 'fma'
  });

  const groupedPermissions = useMemo(() => getGroupedPermissions(), []);

  // Fetch users to show count per role
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const uList = await dataService.getItems<UserProfile>('users');
        setUsers(uList);
      } catch (e) {
        console.warn("Could not fetch users list:", e);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Course Director security check
  if (!isCourseDirector) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-red-200 rounded-2xl shadow-sm text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">প্রবেশাধিকার সংরক্ষিত (Access Denied)</h2>
        <p className="text-slate-600 mb-6 text-sm">
          রোল ও পারমিশন ব্যবস্থাপনা শুধুমাত্র <b>কোর্স পরিচালক (Course Director)</b> এর অধীনে পরিচালিত হয়। আপনার বর্তমান পদবী ({userProfile?.role || 'ব্যবহারকারী'}) এই সেকশনে প্রবেশের জন্য অনুমোদিত নয়।
        </p>
        <a
          href="/"
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
        >
          <span>মূল ড্যাশবোর্ডে ফিরে যান</span>
        </a>
      </div>
    );
  }

  const getUserCountForRole = (role: Role) => {
    return users.filter(u => {
      const uRole = u.role?.trim().toLowerCase();
      return (
        uRole === role.name.trim().toLowerCase() ||
        uRole === role.code.trim().toLowerCase() ||
        uRole === role.nameBn?.trim().toLowerCase()
      );
    }).length;
  };

  // Open Permission Editor
  const handleOpenPermEditor = (role: Role) => {
    setSelectedRoleForPerms(role);
    setSelectedPermKeys([...role.permissions]);
    setSaveSuccessMsg('');
  };

  // Toggle single permission
  const handleTogglePerm = (key: string) => {
    if (selectedRoleForPerms?.name === 'Course Director') return; // Cannot alter course director's full perms
    setSelectedPermKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Toggle all permissions for a specific module
  const handleToggleModulePerms = (modulePerms: typeof ALL_PERMISSIONS) => {
    if (selectedRoleForPerms?.name === 'Course Director') return;
    const moduleKeys = modulePerms.map(p => p.key);
    const allSelected = moduleKeys.every(k => selectedPermKeys.includes(k));

    if (allSelected) {
      setSelectedPermKeys(prev => prev.filter(k => !moduleKeys.includes(k)));
    } else {
      setSelectedPermKeys(prev => Array.from(new Set([...prev, ...moduleKeys])));
    }
  };

  // Bulk actions in modal
  const handleSelectAllPerms = () => {
    if (selectedRoleForPerms?.name === 'Course Director') return;
    setSelectedPermKeys([...ALL_PERMISSION_KEYS]);
  };

  const handleDeselectAllPerms = () => {
    if (selectedRoleForPerms?.name === 'Course Director') return;
    setSelectedPermKeys([]);
  };

  const handleSelectPageViewsOnly = () => {
    if (selectedRoleForPerms?.name === 'Course Director') return;
    const pageKeys = ALL_PERMISSIONS.filter(p => p.isPageView).map(p => p.key);
    setSelectedPermKeys(pageKeys);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedRoleForPerms) return;
    setIsSavingPerms(true);
    setSaveSuccessMsg('');

    try {
      await updateRolePermissions(selectedRoleForPerms.id, selectedPermKeys);
      setSaveSuccessMsg('পারমিশন সফলভাবে সংরক্ষণ ও আপডেট করা হয়েছে!');
      setTimeout(() => {
        setSelectedRoleForPerms(null);
        setSaveSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      alert(err?.message || 'পারমিশন সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setIsSavingPerms(false);
    }
  };

  // Reset to default roles and permissions
  const handleResetToDefaults = async () => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে সকল রোল ও পারমিশন সিস্টেম ডিফল্ট অবস্থায় ফিরিয়ে নিতে চান?")) {
      return;
    }
    try {
      for (const defRole of DEFAULT_ROLES) {
        await dataService.saveItem('roles', defRole);
      }
      await refreshRoles();
      alert("সকল রোল ও পারমিশন সফলভাবে ডিফল্ট অবস্থায় রিসেট হয়েছে।");
    } catch (err: any) {
      alert("রিসেট ব্যর্থ হয়েছে: " + err?.message);
    }
  };

  // Add / Edit Role Submit
  const handleRoleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) {
      alert("রোলের নাম প্রদান করুন।");
      return;
    }

    try {
      let initialPerms: string[] = [];
      if (roleFormData.template === 'all') {
        initialPerms = [...ALL_PERMISSION_KEYS];
      } else if (roleFormData.template === 'fma') {
        initialPerms = [...DEFAULT_ROLES[1].permissions];
      } else if (roleFormData.template === 'trainer') {
        initialPerms = [...DEFAULT_ROLES[2].permissions];
      } else if (roleFormData.template === 'view_only') {
        initialPerms = ALL_PERMISSIONS.filter(p => p.isPageView).map(p => p.key);
      }

      await createRole({
        name: roleFormData.name.trim(),
        nameBn: roleFormData.nameBn.trim() || roleFormData.name.trim(),
        code: roleFormData.code.trim() || undefined,
        description: roleFormData.description.trim(),
        permissions: initialPerms,
      });

      setIsRoleModalOpen(false);
      setRoleFormData({ name: '', nameBn: '', code: '', description: '', template: 'fma' });
      alert("নতুন রোল সফলভাবে তৈরি হয়েছে!");
    } catch (err: any) {
      alert(err?.message || "রোল তৈরিতে সমস্যা হয়েছে।");
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      alert("সিস্টেম নির্ধারিত রোল মুছে ফেলা সম্ভব নয়।");
      return;
    }
    const count = getUserCountForRole(role);
    if (count > 0) {
      if (!window.confirm(`এই রোলে বর্তমানে ${count} জন ব্যবহারকারী নিযুক্ত আছেন। মুছে ফেললে তাদের পারমিশন প্রভাবিত হবে। আপনি কি নিশ্চিত?`)) {
        return;
      }
    } else {
      if (!window.confirm(`আপনি কি "${role.nameBn || role.name}" রোলটি মুছে ফেলতে চান?`)) {
        return;
      }
    }

    try {
      await deleteRole(role.id);
      alert("রোল সফলভাবে মুছে ফেলা হয়েছে।");
    } catch (err: any) {
      alert(err?.message || "রোল মোছা সম্ভব হয়নি।");
    }
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.nameBn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 opacity-10 flex items-center justify-center pointer-events-none">
          <Shield size={240} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <ShieldCheck size={14} />
              <span>শুধুমাত্র কোর্স পরিচালক (Course Director) এর নিয়ন্ত্রণে</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              রোল ও পারমিশন সিস্টেম (Roles & Permissions)
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              সিস্টেমের প্রতিটি ব্যবহারকারী রোলের বিপরীতে পেজ ভিউ (Page View) এবং সকল অপারেশনভিত্তিক পারমিশন পর্যবেক্ষণ, কনফিগার ও নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleResetToDefaults}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold border border-slate-700 flex items-center space-x-2 transition"
              title="ডিফল্ট রোল ও পারমিশনে ফিরুন"
            >
              <RotateCcw size={16} />
              <span>ডিফল্ট রিসেট</span>
            </button>
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/30 flex items-center space-x-2 transition"
            >
              <Plus size={18} />
              <span>নতুন রোল তৈরি করুন</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">মোট রোল (Total Roles)</span>
            <span className="text-2xl font-bold text-white mt-1 block">{roles.length} টি</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">সিস্টেম রোল (System Roles)</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block">
              {roles.filter(r => r.isSystem).length} টি
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">মোট পারমিশন (Permissions)</span>
            <span className="text-2xl font-bold text-indigo-300 mt-1 block">
              {ALL_PERMISSIONS.length} টি
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">পেজ ভিউ পারমিশন (Pages)</span>
            <span className="text-2xl font-bold text-amber-300 mt-1 block">
              {ALL_PERMISSIONS.filter(p => p.isPageView).length} টি
            </span>
          </div>
        </div>
      </div>

      {/* Main Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="রোল নাম, কোড বা বিবরণ দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
          />
        </div>

        {/* View Switcher: Table vs Matrix */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'table'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon size={16} />
            <span>রোল তালিকা (Roles Table)</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'matrix'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid size={16} />
            <span>পারমিশন ম্যাট্রিক্স (Matrix View)</span>
          </button>
        </div>
      </div>

      {/* View 1: ROLES TABLE */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">রোল তালিকা (Roles Table)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                সিস্টেমে নিবন্ধিত সকল ব্যবহারকারী ভূমিকা ও তাদের জন্য বরাদ্দকৃত পারমিশন
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              মোট: {filteredRoles.length} টি রোল
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">ক্র.নং</th>
                  <th className="py-3.5 px-6">রোলের নাম ও পদবী</th>
                  <th className="py-3.5 px-4">কোড (Code)</th>
                  <th className="py-3.5 px-6">বিবরণ (Description)</th>
                  <th className="py-3.5 px-6">বরাদ্দকৃত পারমিশন</th>
                  <th className="py-3.5 px-4 text-center">ব্যবহারকারী সংখ্যা</th>
                  <th className="py-3.5 px-6 text-right">অ্যাকশন (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoles.map((role, idx) => {
                  const permCount = role.permissions.length;
                  const totalPerms = ALL_PERMISSIONS.length;
                  const percent = Math.round((permCount / totalPerms) * 100);
                  const userCount = getUserCountForRole(role);
                  const isCourseDirectorRole = role.name === 'Course Director' || role.code === 'course_director';

                  return (
                    <tr key={role.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isCourseDirectorRole
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : role.code === 'fma'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            <Shield size={18} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{role.nameBn || role.name}</span>
                              {role.isSystem ? (
                                <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  সিস্টেম ডিফল্ট
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  কাস্টম রোল
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 font-mono block mt-0.5">{role.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-600">
                        <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                          {role.code}
                        </code>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600 max-w-xs">
                        <p className="line-clamp-2">{role.description || 'কোনো বিবরণ প্রদান করা হয়নি'}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1.5 w-48">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 font-mono">
                              {permCount} / {totalPerms}
                            </span>
                            <span className={`text-[11px] font-bold ${
                              percent === 100 ? 'text-purple-600' : percent > 50 ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCourseDirectorRole
                                  ? 'bg-purple-600'
                                  : percent > 50
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                          <Users size={12} className="text-slate-400" />
                          <span>{loadingUsers ? '...' : `${userCount} জন`}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenPermEditor(role)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-emerald-200/60"
                            title="পারমিশন কনফিগার করুন"
                          >
                            <SlidersHorizontal size={14} />
                            <span>পারমিশন পরিবর্তন</span>
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="রোল মুছুন"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: PERMISSIONS MATRIX VIEW */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">পারমিশন ম্যাট্রিক্স (Permissions Matrix)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                সকল রোল ও তাদের অধীনস্থ অপারেশন ও পেজ ভিউ পারমিশনের তুলনামূলক চার্ট
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium text-slate-600">
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                  <Check size={10} strokeWidth={3} />
                </span>
                <span>অনুমতিপ্রাপ্ত (Granted)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                  <X size={10} strokeWidth={3} />
                </span>
                <span>অনুমতিহীন (Denied)</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="py-3 px-4 w-72 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                    মডিউল ও অপারেশন (Module & Operation)
                  </th>
                  <th className="py-3 px-3 w-28 text-center text-[11px] uppercase border-r border-slate-200">
                    ধরন (Type)
                  </th>
                  {roles.map(r => (
                    <th key={r.id} className="py-3 px-4 text-center border-r border-slate-200 min-w-32">
                      <span className="block font-bold text-slate-800">{r.nameBn || r.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">{r.code}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {groupedPermissions.map(group => (
                  <React.Fragment key={group.module}>
                    <tr className="bg-slate-50/90 font-bold text-slate-800">
                      <td colSpan={2 + roles.length} className="py-2.5 px-4 bg-slate-100/70 border-y border-slate-200 text-slate-900 font-bold">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>{group.moduleBn}</span>
                          <span className="text-[11px] text-slate-500 font-normal">({group.permissions.length} টি পারমিশন)</span>
                        </div>
                      </td>
                    </tr>
                    {group.permissions.map(perm => (
                      <tr key={perm.key} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 sticky left-0 bg-white z-10 border-r border-slate-200">
                          <div>
                            <span className="font-semibold text-slate-800 block">{perm.nameBn}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">{perm.key}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200">
                          {perm.isPageView ? (
                            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 rounded font-semibold">
                              পেজ ভিউ
                            </span>
                          ) : (
                            <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-medium">
                              অপারেশন
                            </span>
                          )}
                        </td>
                        {roles.map(r => {
                          const isGranted = r.name === 'Course Director' || r.permissions.includes(perm.key);
                          return (
                            <td key={r.id} className="py-2.5 px-4 text-center border-r border-slate-200">
                              <button
                                onClick={() => {
                                  if (r.name === 'Course Director') return;
                                  handleOpenPermEditor(r);
                                }}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition ${
                                  isGranted
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                                title={`${r.name}: ${isGranted ? 'অনুমতি আছে' : 'অনুমতি নেই'} (ক্লিক করে পরিবর্তন করুন)`}
                              >
                                {isGranted ? (
                                  <Check size={16} strokeWidth={2.5} />
                                ) : (
                                  <X size={16} strokeWidth={2} />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PERMISSION CONFIGURATION MODAL / DRAWER */}
      {selectedRoleForPerms && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-lg text-white">
                      পারমিশন কনফিগারেশন: {selectedRoleForPerms.nameBn || selectedRoleForPerms.name}
                    </h3>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                      {selectedRoleForPerms.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    এই রোলের অধীনে কোন কোন পেজ ভিউ ও অপারেশন কার্যকর থাকবে তা টিক দিয়ে নির্বাচন করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRoleForPerms(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Actions & Counter Bar */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">নির্বাচিত পারমিশন:</span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-mono font-bold">
                  {selectedPermKeys.length} / {ALL_PERMISSIONS.length} টি ({Math.round((selectedPermKeys.length / ALL_PERMISSIONS.length) * 100)}%)
                </span>
              </div>

              {selectedRoleForPerms.name !== 'Course Director' ? (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllPerms}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
                  >
                    সব সিলেক্ট করুন
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectPageViewsOnly}
                    className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                  >
                    শুধুমাত্র পেজ ভিউ
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllPerms}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
                  >
                    সব আন-সিলেক্ট
                  </button>
                </div>
              ) : (
                <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg font-semibold flex items-center space-x-1">
                  <Lock size={12} />
                  <span>কোর্স পরিচালকের সকল পারমিশন স্বয়ংক্রিয়ভাবে সক্রিয় থাকে</span>
                </span>
              )}
            </div>

            {/* Feedback message banner */}
            {saveSuccessMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Permissions List / Modules */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {groupedPermissions.map(group => {
                const moduleKeys = group.permissions.map(p => p.key);
                const activeCount = moduleKeys.filter(k => selectedPermKeys.includes(k)).length;
                const isAllSelected = activeCount === moduleKeys.length;

                return (
                  <div
                    key={group.module}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
                  >
                    {/* Module Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 text-sm">{group.moduleBn}</span>
                        <span className="text-xs text-slate-500 font-mono">({group.module})</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-mono font-semibold text-slate-600">
                          {activeCount} / {group.permissions.length} টি সক্রিয়
                        </span>
                        {selectedRoleForPerms.name !== 'Course Director' && (
                          <button
                            type="button"
                            onClick={() => handleToggleModulePerms(group.permissions)}
                            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                          >
                            {isAllSelected ? 'সব বন্ধ' : 'সব চালু'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Module Permissions Checkboxes */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.permissions.map(perm => {
                        const isChecked = selectedPermKeys.includes(perm.key);
                        const isCourseDirectorRole = selectedRoleForPerms.name === 'Course Director';

                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start space-x-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                              isChecked
                                ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/50'
                            } ${isCourseDirectorRole ? 'cursor-not-allowed opacity-90' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isCourseDirectorRole}
                              onChange={() => handleTogglePerm(perm.key)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-800 block">
                                  {perm.nameBn}
                                </span>
                                {perm.isPageView ? (
                                  <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0">
                                    পেজ ভিউ
                                  </span>
                                ) : (
                                  <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0">
                                    অপারেশন
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                                {perm.nameEn} ({perm.key})
                              </span>
                              <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                                {perm.descriptionBn}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                পরিবর্তনগুলো তাৎক্ষণিকভাবে সিস্টেমে কার্যকর হবে।
              </span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedRoleForPerms(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition"
                >
                  বন্ধ করুন
                </button>
                <button
                  type="button"
                  disabled={isSavingPerms || selectedRoleForPerms.name === 'Course Director'}
                  onClick={handleSavePermissions}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/25 flex items-center space-x-2 transition disabled:opacity-60"
                >
                  {isSavingPerms ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>পারমিশন সংরক্ষণ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW ROLE MODAL */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">নতুন রোল যোগ করুন (Add New Role)</h3>
                  <p className="text-xs text-slate-500">কাস্টম পদবী ও ভূমিকা তৈরির ফর্ম</p>
                </div>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRoleFormSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  রোলের নাম (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assistant Director, Inspector, Auditor"
                  value={roleFormData.name}
                  onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  রোলের নাম (বাংলা)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সহকারী পরিচালক, পরিদর্শক, নিরীক্ষক"
                  value={roleFormData.nameBn}
                  onChange={e => setRoleFormData({ ...roleFormData, nameBn: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  রোল কোড (Role Code - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="e.g. assistant_director (ফাঁকা রাখলে স্বয়ংক্রিয় তৈরি হবে)"
                  value={roleFormData.code}
                  onChange={e => setRoleFormData({ ...roleFormData, code: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিবরণ (Description)
                </label>
                <textarea
                  rows={2}
                  placeholder="এই রোলের মূল দায়িত্ব ও কর্মপরিধি উল্লেখ করুন..."
                  value={roleFormData.description}
                  onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  প্রাথমিক পারমিশন টেমপ্লেট
                </label>
                <select
                  value={roleFormData.template}
                  onChange={e => setRoleFormData({ ...roleFormData, template: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="fma">FMA টেমপ্লেট (ড্যাশবোর্ড, প্রতিষ্ঠান, ব্যাচ, শিক্ষার্থী)</option>
                  <option value="trainer">Trainer টেমপ্লেট (ব্যাচ, হাজিরা, নম্বর এন্ট্রি)</option>
                  <option value="view_only">শুধুমাত্র পেজ ভিউ (View Only - কোনো এডিট অনুমতি নেই)</option>
                  <option value="all">পূর্ণ পারমিশন (সকল অপারেশন)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  রোল তৈরি হওয়ার পর পারমিশন এডিটর থেকে যেকোনো সময় পরিবর্তন করতে পারবেন।
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20"
                >
                  রোল সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPage;
