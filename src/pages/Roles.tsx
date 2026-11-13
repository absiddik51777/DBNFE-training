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
import { useConfirm } from '../contexts/ConfirmationContext';
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
  const { confirm, showAlert } = useConfirm();

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
      <div className="max-w-2xl mx-auto my-12 p-8 bg-theme-surface border border-theme-danger-border rounded-2xl shadow-sm text-center">
        <div className="w-16 h-16 bg-theme-danger-soft text-theme-danger rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-bold text-theme-text-primary mb-2">প্রবেশাধিকার সংরক্ষিত (Access Denied)</h2>
        <p className="text-theme-text-secondary mb-6 text-sm">
          রোল ও পারমিশন ব্যবস্থাপনা শুধুমাত্র <b>কোর্স পরিচালক (Course Director)</b> এর অধীনে পরিচালিত হয়। আপনার বর্তমান পদবী ({userProfile?.role || 'ব্যবহারকারী'}) এই সেকশনে প্রবেশের জন্য অনুমোদিত নয়।
        </p>
        <a
          href="/"
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-theme-primary text-theme-primary-fg rounded-xl text-sm font-semibold hover:bg-theme-primary-hover transition"
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
      await showAlert({
        title: 'ত্রুটি',
        message: err?.message || 'পারমিশন সংরক্ষণ ব্যর্থ হয়েছে।',
        variant: 'danger'
      });
    } finally {
      setIsSavingPerms(false);
    }
  };

  // Reset to default roles and permissions
  const handleResetToDefaults = async () => {
    const confirmed = await confirm({
      title: 'সিস্টেম রোল ও পারমিশন রিসেট',
      message: 'আপনি কি নিশ্চিতভাবে সকল রোল ও পারমিশন সিস্টেম ডিফল্ট অবস্থায় ফিরিয়ে নিতে চান?',
      detail: 'এর ফলে আপনার কাস্টমাইজ করা সকল রোল পারমিশন মুছে প্রাক-সংজ্ঞায়িত ডিফল্ট রোলগুলো পুনঃস্থাপিত হবে।',
      confirmText: 'হ্যাঁ, ডিফল্ট রিসেট করুন',
      cancelText: 'বাতিল',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      for (const defRole of DEFAULT_ROLES) {
        await dataService.saveItem('roles', defRole);
      }
      await refreshRoles();
      await showAlert({
        title: 'সফলতা',
        message: 'সকল রোল ও পারমিশন সফলভাবে ডিফল্ট অবস্থায় রিসেট হয়েছে।',
        variant: 'success'
      });
    } catch (err: any) {
      await showAlert({
        title: 'ত্রুটি',
        message: 'রিসেট ব্যর্থ হয়েছে: ' + err?.message,
        variant: 'danger'
      });
    }
  };

  // Add / Edit Role Submit
  const handleRoleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) {
      await showAlert({
        title: 'প্রয়োজনীয় তথ্য অনুপস্থিত',
        message: 'রোলের নাম প্রদান করুন।',
        variant: 'warning'
      });
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
      await showAlert({
        title: 'সফলতা',
        message: 'নতুন রোল সফলভাবে তৈরি হয়েছে!',
        variant: 'success'
      });
    } catch (err: any) {
      await showAlert({
        title: 'ত্রুটি',
        message: err?.message || 'রোল তৈরিতে সমস্যা হয়েছে।',
        variant: 'danger'
      });
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      await showAlert({
        title: 'অনুমতি নেই',
        message: 'সিস্টেম নির্ধারিত স্থায়ী রোল মুছে ফেলা সম্ভব নয়।',
        variant: 'warning'
      });
      return;
    }
    const count = getUserCountForRole(role);
    let confirmed = false;
    if (count > 0) {
      confirmed = await confirm({
        title: 'সতর্কতা: সক্রিয় ব্যবহারকারীযুক্ত রোল অপসারণ',
        message: `এই "${role.nameBn || role.name}" রোলে বর্তমানে ${count} জন ব্যবহারকারী নিযুক্ত আছেন।`,
        detail: 'রোলটি মুছে ফেললে সংশ্লিষ্ট ব্যবহারকারীদের রোল অ্যাসাইনমেন্ট বাতিল হবে এবং তাদের সিস্টেম পারমিশন সীমাবদ্ধ হয়ে পড়বে। আপনি কি নিশ্চিত?',
        confirmText: 'হ্যাঁ, মুছে ফেলুন',
        cancelText: 'বাতিল',
        variant: 'danger'
      });
    } else {
      confirmed = await confirm({
        title: 'রোল অপসারণ নিশ্চিতকরণ',
        message: `আপনি কি "${role.nameBn || role.name}" রোলটি মুছে ফেলতে চান?`,
        detail: 'এই রোলটি স্থায়ীভাবে সিস্টেম থেকে মুছে যাবে।',
        confirmText: 'হ্যাঁ, মুছুন',
        cancelText: 'বাতিল',
        variant: 'danger'
      });
    }

    if (!confirmed) return;

    try {
      await deleteRole(role.id);
      await showAlert({
        title: 'সফলতা',
        message: 'রোল সফলভাবে মুছে ফেলা হয়েছে।',
        variant: 'success'
      });
    } catch (err: any) {
      await showAlert({
        title: 'ত্রুটি',
        message: err?.message || 'রোল মোছা সম্ভব হয়নি।',
        variant: 'danger'
      });
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
              className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-xs sm:text-sm font-semibold shadow-md flex items-center space-x-2 transition"
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
            <span className="text-2xl font-bold text-white mt-1 block tabular-nums">{roles.length} টি</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">সিস্টেম রোল (System Roles)</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block tabular-nums">
              {roles.filter(r => r.isSystem).length} টি
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">মোট পারমিশন (Permissions)</span>
            <span className="text-2xl font-bold text-indigo-300 mt-1 block tabular-nums">
              {ALL_PERMISSIONS.length} টি
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block">পেজ ভিউ পারমিশন (Pages)</span>
            <span className="text-2xl font-bold text-amber-300 mt-1 block tabular-nums">
              {ALL_PERMISSIONS.filter(p => p.isPageView).length} টি
            </span>
          </div>
        </div>
      </div>

      {/* Main Control Bar */}
      <div className="bg-theme-surface rounded-2xl border border-theme-border p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
          <input
            type="text"
            placeholder="রোল নাম, কোড বা বিবরণ দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-theme-surface-subtle border border-theme-border rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary text-theme-text-primary placeholder:text-theme-text-muted"
          />
        </div>

        {/* View Switcher: Table vs Matrix */}
        <div className="flex items-center space-x-1.5 p-1 bg-theme-surface-subtle rounded-xl border border-theme-border shrink-0">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'table'
                ? 'bg-theme-surface text-theme-text-primary shadow-xs'
                : 'text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <TableIcon size={16} />
            <span>রোল তালিকা (Roles Table)</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'matrix'
                ? 'bg-theme-surface text-theme-text-primary shadow-xs'
                : 'text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <Grid size={16} />
            <span>পারমিশন ম্যাট্রিক্স (Matrix View)</span>
          </button>
        </div>
      </div>

      {/* View 1: ROLES TABLE */}
      {activeTab === 'table' && (
        <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
          <div className="p-5 border-b border-theme-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-theme-text-primary">রোল তালিকা (Roles Table)</h2>
              <p className="text-xs text-theme-text-secondary mt-0.5">
                সিস্টেমে নিবন্ধিত সকল ব্যবহারকারী ভূমিকা ও তাদের জন্য বরাদ্দকৃত পারমিশন
              </p>
            </div>
            <span className="text-xs font-semibold text-theme-text-secondary bg-theme-surface-subtle border border-theme-border px-3 py-1 rounded-full tabular-nums">
              মোট: {filteredRoles.length} টি রোল
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-theme-surface-subtle text-theme-text-secondary border-b border-theme-border text-xs font-bold uppercase tracking-wider">
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
              <tbody className="divide-y divide-theme-border">
                {filteredRoles.map((role, idx) => {
                  const permCount = role.permissions.length;
                  const totalPerms = ALL_PERMISSIONS.length;
                  const percent = Math.round((permCount / totalPerms) * 100);
                  const userCount = getUserCountForRole(role);
                  const isCourseDirectorRole = role.name === 'Course Director' || role.code === 'course_director';

                  return (
                    <tr key={role.id} className="hover:bg-theme-surface-hover transition-colors">
                      <td className="py-4 px-4 text-center font-mono text-xs text-theme-text-muted tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            isCourseDirectorRole
                              ? 'bg-theme-accent-soft text-theme-accent border-theme-accent-border'
                              : role.code === 'fma'
                              ? 'bg-theme-info-soft text-theme-info border-theme-info-border'
                              : 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border'
                          }`}>
                            <Shield size={18} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-theme-text-primary">{role.nameBn || role.name}</span>
                              {role.isSystem ? (
                                <span className="bg-theme-surface-subtle text-theme-text-secondary border border-theme-border text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  সিস্টেম ডিফল্ট
                                </span>
                              ) : (
                                <span className="bg-theme-warning-soft text-theme-warning border border-theme-warning-border text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  কাস্টম রোল
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-theme-text-secondary font-mono block mt-0.5">{role.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-theme-text-secondary">
                        <code className="bg-theme-surface-subtle border border-theme-border px-2 py-1 rounded text-theme-text-primary font-medium">
                          {role.code}
                        </code>
                      </td>
                      <td className="py-4 px-6 text-xs text-theme-text-secondary max-w-xs">
                        <p className="line-clamp-2">{role.description || 'কোনো বিবরণ প্রদান করা হয়নি'}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1.5 w-48">
                          <div className="flex items-center justify-between text-xs tabular-nums">
                            <span className="font-semibold text-theme-text-primary font-mono">
                              {permCount} / {totalPerms}
                            </span>
                            <span className={`text-[11px] font-bold ${
                              percent === 100 ? 'text-theme-accent' : percent > 50 ? 'text-theme-primary' : 'text-theme-warning'
                            }`}>
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-theme-surface-subtle rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCourseDirectorRole
                                  ? 'bg-theme-accent'
                                  : percent > 50
                                  ? 'bg-theme-primary'
                                  : 'bg-theme-warning'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-theme-surface-subtle border border-theme-border text-theme-text-primary rounded-full text-xs font-semibold tabular-nums">
                          <Users size={12} className="text-theme-text-muted" />
                          <span>{loadingUsers ? '...' : `${userCount} জন`}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenPermEditor(role)}
                            className="px-3 py-1.5 bg-theme-primary-soft hover:opacity-90 text-theme-primary-soft-fg rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-theme-primary-border"
                            title="পারমিশন কনফিগার করুন"
                          >
                            <SlidersHorizontal size={14} />
                            <span>পারমিশন পরিবর্তন</span>
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="p-1.5 text-theme-text-muted hover:text-theme-danger hover:bg-theme-danger-soft rounded-lg transition"
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
        <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
          <div className="p-5 border-b border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-theme-text-primary">পারমিশন ম্যাট্রিক্স (Permissions Matrix)</h2>
              <p className="text-xs text-theme-text-secondary mt-0.5">
                সকল রোল ও তাদের অধীনস্থ অপারেশন ও পেজ ভিউ পারমিশনের তুলনামূলক চার্ট
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium text-theme-text-secondary">
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-theme-primary flex items-center justify-center text-theme-primary-fg">
                  <Check size={10} strokeWidth={3} />
                </span>
                <span>অনুমতিপ্রাপ্ত (Granted)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-theme-surface-subtle border border-theme-border flex items-center justify-center text-theme-text-muted">
                  <X size={10} strokeWidth={3} />
                </span>
                <span>অনুমতিহীন (Denied)</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-theme-surface-subtle text-theme-text-primary text-xs font-bold border-b border-theme-border">
                  <th className="py-3 px-4 w-72 sticky left-0 bg-theme-surface-subtle z-10 border-r border-theme-border">
                    মডিউল ও অপারেশন (Module & Operation)
                  </th>
                  <th className="py-3 px-3 w-28 text-center text-[11px] uppercase border-r border-theme-border">
                    ধরন (Type)
                  </th>
                  {roles.map(r => (
                    <th key={r.id} className="py-3 px-4 text-center border-r border-theme-border min-w-32">
                      <span className="block font-bold text-theme-text-primary">{r.nameBn || r.name}</span>
                      <span className="text-[10px] text-theme-text-secondary font-mono block">{r.code}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border text-xs">
                {groupedPermissions.map(group => (
                  <React.Fragment key={group.module}>
                    <tr className="bg-theme-surface-subtle font-bold text-theme-text-primary">
                      <td colSpan={2 + roles.length} className="py-2.5 px-4 bg-theme-surface-subtle border-y border-theme-border text-theme-text-primary font-bold">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-theme-primary"></span>
                          <span>{group.moduleBn}</span>
                          <span className="text-[11px] text-theme-text-secondary font-normal tabular-nums">({group.permissions.length} টি পারমিশন)</span>
                        </div>
                      </td>
                    </tr>
                    {group.permissions.map(perm => (
                      <tr key={perm.key} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="py-2.5 px-4 sticky left-0 bg-theme-surface z-10 border-r border-theme-border">
                          <div>
                            <span className="font-semibold text-theme-text-primary block">{perm.nameBn}</span>
                            <span className="text-[11px] text-theme-text-muted font-mono block">{perm.key}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-theme-border">
                          {perm.isPageView ? (
                            <span className="inline-block bg-theme-info-soft text-theme-info border border-theme-info-border text-[10px] px-2 py-0.5 rounded font-semibold">
                              পেজ ভিউ
                            </span>
                          ) : (
                            <span className="inline-block bg-theme-surface-subtle text-theme-text-secondary border border-theme-border text-[10px] px-2 py-0.5 rounded font-medium">
                              অপারেশন
                            </span>
                          )}
                        </td>
                        {roles.map(r => {
                          const isGranted = r.name === 'Course Director' || r.permissions.includes(perm.key);
                          return (
                            <td key={r.id} className="py-2.5 px-4 text-center border-r border-theme-border">
                              <button
                                onClick={() => {
                                  if (r.name === 'Course Director') return;
                                  handleOpenPermEditor(r);
                                }}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition ${
                                  isGranted
                                    ? 'bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border hover:opacity-85'
                                    : 'bg-theme-surface-subtle text-theme-text-muted border border-theme-border hover:bg-theme-surface-hover'
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-theme-elevated rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-theme-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white border-b border-theme-border flex items-center justify-between shrink-0">
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
            <div className="px-6 py-3.5 bg-theme-surface-subtle border-b border-theme-border flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-theme-text-primary">নির্বাচিত পারমিশন:</span>
                <span className="px-2.5 py-1 bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border rounded-lg text-xs font-mono font-bold tabular-nums">
                  {selectedPermKeys.length} / {ALL_PERMISSIONS.length} টি ({Math.round((selectedPermKeys.length / ALL_PERMISSIONS.length) * 100)}%)
                </span>
              </div>

              {selectedRoleForPerms.name !== 'Course Director' ? (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllPerms}
                    className="px-2.5 py-1.5 bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-hover rounded-lg text-xs font-semibold transition"
                  >
                    সব সিলেক্ট করুন
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectPageViewsOnly}
                    className="px-2.5 py-1.5 bg-theme-info-soft border border-theme-info-border text-theme-info hover:opacity-85 rounded-lg text-xs font-semibold transition"
                  >
                    শুধুমাত্র পেজ ভিউ
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllPerms}
                    className="px-2.5 py-1.5 bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-hover rounded-lg text-xs font-semibold transition"
                  >
                    সব আন-সিলেক্ট
                  </button>
                </div>
              ) : (
                <span className="text-xs text-theme-accent bg-theme-accent-soft border border-theme-accent-border px-3 py-1 rounded-lg font-semibold flex items-center space-x-1">
                  <Lock size={12} />
                  <span>কোর্স পরিচালকের সকল পারমিশন স্বয়ংক্রিয়ভাবে সক্রিয় থাকে</span>
                </span>
              )}
            </div>

            {/* Feedback message banner */}
            {saveSuccessMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-theme-success-soft border border-theme-success-border text-theme-success text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-theme-success" />
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
                    className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden shadow-2xs"
                  >
                    {/* Module Header */}
                    <div className="px-4 py-3 bg-theme-surface-subtle border-b border-theme-border flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-theme-text-primary text-sm">{group.moduleBn}</span>
                        <span className="text-xs text-theme-text-secondary font-mono">({group.module})</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-mono font-semibold text-theme-text-secondary tabular-nums">
                          {activeCount} / {group.permissions.length} টি সক্রিয়
                        </span>
                        {selectedRoleForPerms.name !== 'Course Director' && (
                          <button
                            type="button"
                            onClick={() => handleToggleModulePerms(group.permissions)}
                            className="text-xs text-theme-primary-soft-fg hover:opacity-85 font-semibold px-2 py-0.5 rounded bg-theme-primary-soft border border-theme-primary-border transition"
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
                                ? 'bg-theme-primary-soft/45 border-theme-primary-border shadow-xs'
                                : 'bg-theme-surface-subtle/60 border-theme-border hover:bg-theme-surface-hover'
                            } ${isCourseDirectorRole ? 'cursor-not-allowed opacity-90' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isCourseDirectorRole}
                              onChange={() => handleTogglePerm(perm.key)}
                              className="mt-1 h-4 w-4 rounded border-theme-border-strong accent-emerald-600 focus:ring-theme-primary shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-theme-text-primary block">
                                  {perm.nameBn}
                                </span>
                                {perm.isPageView ? (
                                  <span className="bg-theme-info-soft text-theme-info border border-theme-info-border text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0">
                                    পেজ ভিউ
                                  </span>
                                ) : (
                                  <span className="bg-theme-surface-subtle text-theme-text-secondary border border-theme-border text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0">
                                    অপারেশন
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-theme-text-muted font-mono block mt-0.5">
                                {perm.nameEn} ({perm.key})
                              </span>
                              <p className="text-[11px] text-theme-text-secondary mt-1 leading-normal">
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
            <div className="px-6 py-4 bg-theme-surface-subtle border-t border-theme-border flex items-center justify-between shrink-0">
              <span className="text-xs text-theme-text-secondary">
                পরিবর্তনগুলো তাৎক্ষণিকভাবে সিস্টেমে কার্যকর হবে।
              </span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedRoleForPerms(null)}
                  className="px-4 py-2 border border-theme-border-strong text-theme-text-primary rounded-xl text-sm font-semibold hover:bg-theme-surface-hover transition"
                >
                  বন্ধ করুন
                </button>
                <button
                  type="button"
                  disabled={isSavingPerms || selectedRoleForPerms.name === 'Course Director'}
                  onClick={handleSavePermissions}
                  className="px-6 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-md flex items-center space-x-2 transition disabled:opacity-60"
                >
                  {isSavingPerms ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-elevated rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-theme-border">
            <div className="flex items-center justify-between pb-4 border-b border-theme-border">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-theme-primary-soft text-theme-primary-soft-fg flex items-center justify-center font-bold">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-theme-text-primary">নতুন রোল যোগ করুন (Add New Role)</h3>
                  <p className="text-xs text-theme-text-secondary">কাস্টম পদবী ও ভূমিকা তৈরির ফর্ম</p>
                </div>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-theme-text-muted hover:text-theme-text-primary p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRoleFormSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-primary mb-1">
                  রোলের নাম (English) <span className="text-theme-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assistant Director, Inspector, Auditor"
                  value={roleFormData.name}
                  onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-primary mb-1">
                  রোলের নাম (বাংলা)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সহকারী পরিচালক, পরিদর্শক, নিরীক্ষক"
                  value={roleFormData.nameBn}
                  onChange={e => setRoleFormData({ ...roleFormData, nameBn: e.target.value })}
                  className="w-full px-3.5 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-primary mb-1">
                  রোল কোড (Role Code - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="e.g. assistant_director (ফাঁকা রাখলে স্বয়ংক্রিয় তৈরি হবে)"
                  value={roleFormData.code}
                  onChange={e => setRoleFormData({ ...roleFormData, code: e.target.value })}
                  className="w-full px-3.5 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm font-mono text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-primary mb-1">
                  বিবরণ (Description)
                </label>
                <textarea
                  rows={2}
                  placeholder="এই রোলের মূল দায়িত্ব ও কর্মপরিধি উল্লেখ করুন..."
                  value={roleFormData.description}
                  onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-hidden focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-primary mb-1">
                  প্রাথমিক পারমিশন টেমপ্লেট
                </label>
                <select
                  value={roleFormData.template}
                  onChange={e => setRoleFormData({ ...roleFormData, template: e.target.value })}
                  className="w-full px-3.5 py-2 border border-theme-border-strong rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary bg-theme-surface text-theme-text-primary"
                >
                  <option value="fma">FMA টেমপ্লেট (ড্যাশবোর্ড, প্রতিষ্ঠান, ব্যাচ, শিক্ষার্থী)</option>
                  <option value="trainer">Trainer টেমপ্লেট (ব্যাচ, হাজিরা, নম্বর এন্ট্রি)</option>
                  <option value="view_only">শুধুমাত্র পেজ ভিউ (View Only - কোনো এডিট অনুমতি নেই)</option>
                  <option value="all">পূর্ণ পারমিশন (সকল অপারেশন)</option>
                </select>
                <span className="text-[11px] text-theme-text-secondary mt-1 block">
                  রোল তৈরি হওয়ার পর পারমিশন এডিটর থেকে যেকোনো সময় পরিবর্তন করতে পারবেন।
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 border border-theme-border-strong text-theme-text-primary rounded-xl text-sm font-semibold hover:bg-theme-surface-hover"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-md"
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
