import React, { useState, useEffect, useMemo } from 'react';
import { logActivity } from '../lib/firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  X,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { Institute } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { dataService } from '../lib/dataService';
import { TableSkeleton } from '../components/Skeleton';
import { toBn } from '../lib/dateUtils';
import DataTableToolbar, { ColumnOption, GroupByOption } from '../components/TableToolbar/DataTableToolbar';

const DEFAULT_INSTITUTE_COLUMNS: ColumnOption[] = [
  { id: 'code', label: 'প্রতিষ্ঠান কোড (Code)', visible: true },
  { id: 'name', label: 'প্রতিষ্ঠানের নাম (Name)', visible: true },
  { id: 'address', label: 'ঠিকানা (Address)', visible: true },
  { id: 'contact', label: 'যোগাযোগ (Contact)', visible: true },
  { id: 'status', label: 'স্ট্যাটাস (Status)', visible: true },
  { id: 'actions', label: 'পদক্ষেপ (Actions)', visible: true, required: true },
];

const INSTITUTE_GROUP_BY_OPTIONS: GroupByOption[] = [
  { id: 'none', label: 'গ্রুপ ছাড়া (Default)' },
  { id: 'status', label: 'অবস্থা অনুযায়ী (By Status)' },
  { id: 'address', label: 'এলাকা/ঠিকানা অনুযায়ী (By Address)' },
];

const Institutes: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstitute, setEditingInstitute] = useState<Institute | null>(null);
  const { userProfile } = useAuth();
  const { hasPermission, isCourseDirector } = usePermissions();
  const { isDeletionAllowed } = useSystemSettings();
  const { confirm, showAlert } = useConfirm();
  
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Search, Filter, ViewMode & Group By
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'address'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Column Visibility
  const [columns, setColumns] = useState<ColumnOption[]>(() => {
    try {
      const saved = localStorage.getItem('bnfe_institute_visible_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_INSTITUTE_COLUMNS.map(col => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible
        }));
      }
    } catch (e) {}
    return DEFAULT_INSTITUTE_COLUMNS;
  });

  const toggleColumn = (colId: string) => {
    setColumns(prev => {
      const next = prev.map(c => c.id === colId && !c.required ? { ...c, visible: !c.visible } : c);
      try {
        const map: Record<string, boolean> = {};
        next.forEach(c => { map[c.id] = c.visible; });
        localStorage.setItem('bnfe_institute_visible_columns', JSON.stringify(map));
      } catch (e) {}
      return next;
    });
  };

  const resetColumns = () => {
    setColumns(DEFAULT_INSTITUTE_COLUMNS);
    try {
      localStorage.removeItem('bnfe_institute_visible_columns');
    } catch (e) {}
  };

  const isColVisible = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    return col ? col.visible : true;
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSearchTerm('');
  };

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (statusFilter !== 'all') {
      chips.push({
        id: 'status',
        label: statusFilter === 'Active' ? 'অবস্থা: সক্রিয়' : 'অবস্থা: নিষ্ক্রিয়',
        onRemove: () => setStatusFilter('all')
      });
    }
    return chips;
  }, [statusFilter]);

  const processedInstitutes = useMemo(() => {
    return institutes.filter(inst => {
      if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const nameMatch = (inst.name || '').toLowerCase().includes(term);
        const codeMatch = (inst.code || '').toLowerCase().includes(term);
        const addrMatch = (inst.address || '').toLowerCase().includes(term);
        const contactMatch = (inst.contactPerson || '').toLowerCase().includes(term);
        const phoneMatch = (inst.phone || '').toLowerCase().includes(term);
        return nameMatch || codeMatch || addrMatch || contactMatch || phoneMatch;
      }
      return true;
    });
  }, [institutes, statusFilter, searchTerm]);

  const groupedInstitutes = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, { title: string; items: Institute[] }>();

    processedInstitutes.forEach(inst => {
      let key = '';
      let title = '';
      if (groupBy === 'status') {
        key = inst.status || 'Active';
        title = inst.status === 'Active' ? 'সক্রিয় প্রতিষ্ঠান (Active)' : 'নিষ্ক্রিয় প্রতিষ্ঠান (Inactive)';
      } else if (groupBy === 'address') {
        const parts = (inst.address || '').split(',').map(s => s.trim()).filter(Boolean);
        key = parts[parts.length - 1] || 'অন্যান্য এলাকা';
        title = `এলাকা/জেলা: ${key}`;
      }
      if (!map.has(key)) map.set(key, { title, items: [] });
      map.get(key)!.items.push(inst);
    });

    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      title: val.title,
      items: val.items
    }));
  }, [processedInstitutes, groupBy]);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    status: 'Active' as 'Active' | 'Inactive' | 'Archived',
  });

  const isDirector = isCourseDirector || userProfile?.role === 'Course Director';
  const canCreate = hasPermission('create_institute') || isDirector;
  const canEdit = hasPermission('edit_institute') || isDirector;
  const canDelete = hasPermission('delete_institute') || isDirector;

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const handleSeedDefaults = async () => {
    try {
      setLoading(true);
      await dataService.seedDefaultInstitutes();
      await fetchInstitutes();
      setStatusMessage('ডিফল্ট প্রতিষ্ঠান তালিকা সফলভাবে লোড করা হয়েছে।');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (e: any) {
      setErrorMessage("ডিফল্ট প্রতিষ্ঠান লোড করতে সমস্যা হয়েছে: " + e.message);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error: any) {
      console.warn("Notice saving institute:", error);
      setErrorMessage("তথ্য সংরক্ষণে সমস্যা হয়েছে: " + (error?.message || error));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete && !canEdit) {
      await showAlert({
        title: 'অনুমতি নেই',
        message: 'আপনার প্রতিষ্ঠান মুছে ফেলার অনুমতি নেই।',
        variant: 'danger'
      });
      return;
    }
    if (!isDeletionAllowed) {
      const confirmed = await confirm({
        title: 'প্রতিষ্ঠান সংরক্ষণাগারে স্থানান্তর (Fallback to Archive)',
        message: `সিস্টেম সেটিংস অনুযায়ী প্রতিষ্ঠান স্থায়ীভাবে মুছে ফেলা বন্ধ (Denied) রয়েছে। আপনি কি "${name}" প্রতিষ্ঠানটি মুছে ফেলার পরিবর্তে সংরক্ষণাগারে (Archive) পাঠাতে চান?`,
        detail: 'ℹ️ সংরক্ষণাগারে স্থানান্তর করলে সংশ্লিষ্ট ব্যাচের ইতিহাস অক্ষুণ্ণ থাকবে এবং প্রতিষ্ঠানটি সক্রিয় তালিকা থেকে সংরক্ষণাগারে স্থানান্তরিত হবে।',
        confirmText: 'হ্যাঁ, প্রতিষ্ঠান আর্কাইভ করুন (Archive)',
        cancelText: 'বাতিল',
        variant: 'warning'
      });

      if (confirmed) {
        try {
          await dataService.archiveRecord('institutes', id, 'সিস্টেমে ডিলিট নিষিদ্ধ থাকায় সংরক্ষণাগারে স্থানান্তর');
          await logActivity(
            userProfile?.id || '',
            userProfile?.name || 'User',
            `প্রতিষ্ঠান সংরক্ষণাগারে স্থানান্তরিত (ডিলিট বন্ধ থাকায় ফলব্যাক): ${name}`,
            'Institutes',
            id
          );
          setStatusMessage(`"${name}" প্রতিষ্ঠানটি সফলভাবে সংরক্ষণাগারে (Archive) স্থানান্তর করা হয়েছে।`);
          setTimeout(() => setStatusMessage(''), 3500);
          await fetchInstitutes();
        } catch (error: any) {
          setErrorMessage("প্রতিষ্ঠান আর্কাইভে স্থানান্তরে সমস্যা হয়েছে: " + (error?.message || error));
        }
      }
      return;
    }

    const confirmed = await confirm({
      title: 'প্রতিষ্ঠান মুছে ফেলার নিশ্চিতকরণ',
      message: `আপনি কি নিশ্চিতভাবে "${name}" প্রতিষ্ঠানটি মুছে ফেলতে চান?`,
      detail: 'প্রতিষ্ঠানটি মুছে ফেললে এর সাথে সংশ্লিষ্ট তথ্য সিস্টেমে প্রভাবিত হতে পারে।',
      confirmText: 'হ্যাঁ, মুছে ফেলুন',
      cancelText: 'বাতিল',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        await dataService.deleteInstitute(id);
        await logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রতিষ্ঠান মুছে ফেলা হয়েছে: ${name}`,
          'Institutes',
          id
        );
        setStatusMessage(`"${name}" প্রতিষ্ঠানটি সফলভাবে মুছে ফেলা হয়েছে।`);
        setTimeout(() => setStatusMessage(''), 3500);
        await fetchInstitutes();
      } catch (error: any) {
        console.warn("Notice deleting institute:", error);
        setErrorMessage("প্রতিষ্ঠান ডিলিট করতে সমস্যা হয়েছে: " + (error?.message || error));
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-theme-surface-subtle rounded animate-pulse" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-theme-success-soft border border-theme-success-border text-theme-success text-sm flex items-center space-x-2">
          <span>✓ {statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-theme-danger-soft border border-theme-danger-border text-theme-danger text-sm flex items-center space-x-2">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">প্রশিক্ষণ প্রতিষ্ঠান (Training Institutes)</h1>
          <p className="text-sm text-theme-text-secondary mt-0.5">ডিবিএনএফই আওতাধীন প্রশিক্ষণ কেন্দ্র সমূহের বিবরণ</p>
        </div>
        <div className="flex items-center space-x-2">
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={18} />
              <span>নতুন প্রতিষ্ঠান যুক্ত করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {institutes.length === 0 ? (
        <div className="bg-theme-surface p-12 text-center text-theme-text-secondary rounded-2xl border border-dashed border-theme-border text-sm space-y-3">
          <Building2 size={40} className="mx-auto text-theme-text-muted" />
          <div>
            <p className="font-bold text-theme-text-primary text-base">কোনো প্রশিক্ষণ প্রতিষ্ঠান পাওয়া যায়নি</p>
            <p className="text-xs text-theme-text-muted mt-1">সব প্রতিষ্ঠান মুছে ফেলা হয়েছে অথবা এখনো কোনো প্রতিষ্ঠান যোগ করা হয়নি।</p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              নতুন প্রতিষ্ঠান তৈরি করুন
            </button>
            <button
              type="button"
              onClick={handleSeedDefaults}
              className="px-4 py-2 bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary rounded-xl text-xs font-semibold border border-theme-border cursor-pointer"
            >
              ডিফল্ট প্রতিষ্ঠান তালিকা লোড করুন (Seed Defaults)
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <DataTableToolbar
            searchTerm={searchTerm}
            onSearchChange={(val) => setSearchTerm(val)}
            searchPlaceholder="প্রতিষ্ঠানের নাম, কোড, ঠিকানা বা যোগাযোগ..."
            groupBy={groupBy}
            onGroupByChange={(val) => setGroupBy(val as any)}
            groupByOptions={INSTITUTE_GROUP_BY_OPTIONS}
            groupByLabel="গ্রুপ করুন (Group by)"
            filterCount={activeFilterChips.length}
            onClearAllFilters={handleClearFilters}
            activeFilterChips={activeFilterChips}
            renderFilterContent={(close) => (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">অবস্থা (Status):</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-theme-surface-subtle border border-theme-border rounded-xl text-theme-text-primary font-medium focus:bg-theme-elevated focus:outline-none focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary"
                  >
                    <option value="all">সকল প্রতিষ্ঠান ({toBn(institutes.length)}টি)</option>
                    <option value="Active">সক্রিয় প্রতিষ্ঠান ({toBn(institutes.filter(i => i.status === 'Active').length)}টি)</option>
                    <option value="Inactive">নিষ্ক্রিয় প্রতিষ্ঠান ({toBn(institutes.filter(i => i.status === 'Inactive').length)}টি)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-theme-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { handleClearFilters(); close(); }}
                    className="text-xs text-theme-danger hover:opacity-80 font-semibold cursor-pointer"
                  >
                    ফিল্টার রিসেট
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="px-3 py-1.5 bg-theme-primary text-theme-primary-fg rounded-lg text-xs font-bold hover:bg-theme-primary-hover transition cursor-pointer"
                  >
                    প্রয়োগ করুন
                  </button>
                </div>
              </div>
            )}
            columns={columns}
            onToggleColumn={toggleColumn}
            onResetColumns={resetColumns}
            extraActions={
              <div className="flex items-center bg-theme-surface-subtle p-0.5 rounded-xl border border-theme-border h-9">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`h-7 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-theme-surface text-theme-text-primary shadow-2xs' : 'text-theme-text-secondary hover:text-theme-text-primary'
                  }`}
                  title="টেবিল ভিউ"
                >
                  <TableIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`h-7 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'cards' ? 'bg-theme-surface text-theme-text-primary shadow-2xs' : 'text-theme-text-secondary hover:text-theme-text-primary'
                  }`}
                  title="কার্ড ভিউ"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            }
          />

          {processedInstitutes.length === 0 ? (
            <div className="bg-theme-surface p-12 text-center text-theme-text-secondary rounded-2xl border border-dashed border-theme-border text-sm space-y-2">
              <Building2 size={36} className="mx-auto text-theme-text-muted" />
              <p className="font-bold text-theme-text-primary">কোনো প্রতিষ্ঠান পাওয়া যায়নি</p>
              <p className="text-xs text-theme-text-muted">আপনার ফিল্টার বা অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না।</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-theme-border text-left">
                  <thead className="bg-theme-surface-subtle text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider">
                    <tr>
                      {isColVisible('code') && <th className="px-4 py-3.5">কোড</th>}
                      {isColVisible('name') && <th className="px-4 py-3.5">প্রতিষ্ঠানের নাম</th>}
                      {isColVisible('address') && <th className="px-4 py-3.5">ঠিকানা</th>}
                      {isColVisible('contact') && <th className="px-4 py-3.5">যোগাযোগ</th>}
                      {isColVisible('status') && <th className="px-4 py-3.5 text-center">স্ট্যাটাস</th>}
                      {isColVisible('actions') && <th className="px-4 py-3.5 text-right">পদক্ষেপ</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-theme-surface divide-y divide-theme-border text-xs">
                    {groupBy !== 'none' && groupedInstitutes ? (
                      groupedInstitutes.map(grp => {
                        const isCollapsed = collapsedGroups.has(grp.key);
                        return (
                          <React.Fragment key={grp.key}>
                            <tr className="bg-theme-surface-subtle hover:bg-theme-surface-hover border-y border-theme-border font-bold transition">
                              <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-2.5">
                                <div className="flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupCollapse(grp.key)}
                                    className="flex items-center space-x-2 text-theme-text-primary hover:text-theme-primary cursor-pointer"
                                  >
                                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                    <span className="text-xs sm:text-sm font-bold">{grp.title}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-theme-info-soft text-theme-info border border-theme-info-border tabular-nums">
                                      {toBn(grp.items.length)}টি প্রতিষ্ঠান
                                    </span>
                                  </button>
                                  <span className="text-[11px] text-theme-text-muted tabular-nums">
                                    মোটের {toBn(Math.round((grp.items.length / (processedInstitutes.length || 1)) * 100))}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed && grp.items.map(inst => (
                              <tr key={inst.id} className="hover:bg-theme-surface-hover transition">
                                {isColVisible('code') && (
                                  <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-theme-text-primary tabular-nums">
                                    {inst.code || inst.id}
                                  </td>
                                )}
                                {isColVisible('name') && (
                                  <td className="px-4 py-3.5 font-bold text-theme-text-primary">
                                    {inst.name}
                                  </td>
                                )}
                                {isColVisible('address') && (
                                  <td className="px-4 py-3.5 text-theme-text-secondary max-w-xs truncate">
                                    {inst.address}
                                  </td>
                                )}
                                {isColVisible('contact') && (
                                  <td className="px-4 py-3.5 text-theme-text-secondary whitespace-nowrap">
                                    <div>{inst.contactPerson}</div>
                                    <div className="text-[11px] text-theme-text-muted tabular-nums">{inst.phone}</div>
                                  </td>
                                )}
                                {isColVisible('status') && (
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                                      inst.status === 'Active'
                                        ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                                        : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                                    }`}>
                                      {inst.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                                    </span>
                                  </td>
                                )}
                                {isColVisible('actions') && (
                                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      {canEdit && (
                                        <button
                                          onClick={() => handleOpenModal(inst)}
                                          className="p-1.5 text-theme-info hover:bg-theme-info-soft rounded-lg transition cursor-pointer"
                                          title="সম্পাদন"
                                        >
                                          <Edit2 size={15} />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDelete(inst.id, inst.name)}
                                          className="p-1.5 rounded-lg transition text-theme-danger hover:bg-theme-danger-soft cursor-pointer"
                                          title={!isDeletionAllowed ? 'আর্কাইভে স্থানান্তর (ডিলিট বন্ধ থাকায়)' : 'মুছুন বা সংরক্ষণাগারে পাঠান'}
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      processedInstitutes.map(inst => (
                        <tr key={inst.id} className="hover:bg-theme-surface-hover transition">
                          {isColVisible('code') && (
                            <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-theme-text-primary tabular-nums">
                              {inst.code || inst.id}
                            </td>
                          )}
                          {isColVisible('name') && (
                            <td className="px-4 py-3.5 font-bold text-theme-text-primary">
                              {inst.name}
                            </td>
                          )}
                          {isColVisible('address') && (
                            <td className="px-4 py-3.5 text-theme-text-secondary max-w-xs truncate">
                              {inst.address}
                            </td>
                          )}
                          {isColVisible('contact') && (
                            <td className="px-4 py-3.5 text-theme-text-secondary whitespace-nowrap">
                              <div>{inst.contactPerson}</div>
                              <div className="text-[11px] text-theme-text-muted tabular-nums">{inst.phone}</div>
                            </td>
                          )}
                          {isColVisible('status') && (
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                                inst.status === 'Active'
                                  ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                                  : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                              }`}>
                                {inst.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                              </span>
                            </td>
                          )}
                          {isColVisible('actions') && (
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                {canEdit && (
                                  <button
                                    onClick={() => handleOpenModal(inst)}
                                    className="p-1.5 text-theme-info hover:bg-theme-info-soft rounded-lg transition cursor-pointer"
                                    title="সম্পাদন"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDelete(inst.id, inst.name)}
                                    className="p-1.5 rounded-lg transition text-theme-danger hover:bg-theme-danger-soft cursor-pointer"
                                    title={!isDeletionAllowed ? 'আর্কাইভে স্থানান্তর (ডিলিট বন্ধ থাকায়)' : 'মুছুন বা সংরক্ষণাগারে পাঠান'}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            groupBy !== 'none' && groupedInstitutes ? (
              <div className="space-y-6">
                {groupedInstitutes.map(grp => {
                  const isCollapsed = collapsedGroups.has(grp.key);
                  return (
                    <div key={grp.key} className="bg-theme-surface-subtle rounded-2xl border border-theme-border p-4 space-y-4">
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(grp.key)}
                        className="w-full flex items-center justify-between text-left hover:text-theme-primary transition cursor-pointer"
                      >
                        <div className="flex items-center space-x-2.5">
                          {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                          <span className="font-bold text-theme-text-primary text-sm sm:text-base">{grp.title}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-theme-info-soft text-theme-info border border-theme-info-border tabular-nums">
                            {toBn(grp.items.length)}টি প্রতিষ্ঠান
                          </span>
                        </div>
                        <span className="text-xs text-theme-text-muted tabular-nums">
                          মোটের {toBn(Math.round((grp.items.length / (processedInstitutes.length || 1)) * 100))}%
                        </span>
                      </button>
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {grp.items.map(inst => (
                            <div key={inst.id} className="bg-theme-surface rounded-2xl border border-theme-border p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
                              <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 rounded-xl bg-theme-info-soft text-theme-info flex items-center justify-center font-bold">
                                      <Building2 size={24} />
                                    </div>
                                    <div>
                                      <h3 className="font-bold text-theme-text-primary text-base leading-snug">{inst.name}</h3>
                                      <span className="text-xs text-theme-text-muted font-mono tabular-nums">কোড: {inst.code || inst.id}</span>
                                    </div>
                                  </div>
                                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                                    inst.status === 'Active'
                                      ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                                      : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                                  }`}>
                                    {inst.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                                  </span>
                                </div>

                                <div className="space-y-2 text-xs text-theme-text-secondary pt-2 border-t border-theme-border">
                                  <div className="flex items-center space-x-2">
                                    <MapPin size={15} className="text-theme-text-muted shrink-0" />
                                    <span className="truncate">{inst.address}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Phone size={15} className="text-theme-text-muted shrink-0" />
                                    <span className="tabular-nums">যোগাযোগ: {inst.contactPerson} ({inst.phone})</span>
                                  </div>
                                  {inst.email && (
                                    <div className="flex items-center space-x-2">
                                      <Mail size={15} className="text-theme-text-muted shrink-0" />
                                      <span>{inst.email}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {(canEdit || canDelete) && (
                                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-theme-border mt-4">
                                  {canEdit && (
                                    <button
                                      onClick={() => handleOpenModal(inst)}
                                      className="p-1.5 text-theme-info hover:bg-theme-info-soft rounded-lg transition cursor-pointer"
                                      title="সম্পাদন"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDelete(inst.id, inst.name)}
                                      className="p-1.5 rounded-lg transition text-theme-danger hover:bg-theme-danger-soft cursor-pointer"
                                      title={!isDeletionAllowed ? 'আর্কাইভে স্থানান্তর (ডিলিট বন্ধ থাকায়)' : 'মুছুন বা সংরক্ষণাগারে পাঠান'}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {processedInstitutes.map((inst) => (
                  <div key={inst.id} className="bg-theme-surface rounded-2xl border border-theme-border p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-xl bg-theme-info-soft text-theme-info flex items-center justify-center font-bold">
                            <Building2 size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-theme-text-primary text-base leading-snug">{inst.name}</h3>
                            <span className="text-xs text-theme-text-muted font-mono tabular-nums">কোড: {inst.code || inst.id}</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          inst.status === 'Active'
                            ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                            : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                        }`}>
                          {inst.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-theme-text-secondary pt-2 border-t border-theme-border">
                        <div className="flex items-center space-x-2">
                          <MapPin size={15} className="text-theme-text-muted shrink-0" />
                          <span className="truncate">{inst.address}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone size={15} className="text-theme-text-muted shrink-0" />
                          <span className="tabular-nums">যোগাযোগ: {inst.contactPerson} ({inst.phone})</span>
                        </div>
                        {inst.email && (
                          <div className="flex items-center space-x-2">
                            <Mail size={15} className="text-theme-text-muted shrink-0" />
                            <span>{inst.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(canEdit || canDelete) && (
                      <div className="flex items-center justify-end space-x-2 pt-4 border-t border-theme-border mt-4">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenModal(inst)}
                            className="p-1.5 text-theme-info hover:bg-theme-info-soft rounded-lg transition cursor-pointer"
                            title="সম্পাদন"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(inst.id, inst.name)}
                            className="p-1.5 rounded-lg transition text-theme-danger hover:bg-theme-danger-soft cursor-pointer"
                            title={!isDeletionAllowed ? 'আর্কাইভে স্থানান্তর (ডিলিট বন্ধ থাকায়)' : 'মুছুন বা সংরক্ষণাগারে পাঠান'}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border text-theme-text-primary">
            <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-4">
              <h2 className="text-lg font-bold text-theme-text-primary">
                {editingInstitute ? 'প্রতিষ্ঠান সম্পাদন' : 'নতুন প্রতিষ্ঠান তৈরি'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-theme-text-muted hover:text-theme-text-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রতিষ্ঠানের নাম *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none"
                  placeholder="যেমন: হালুয়াঘাট প্রশিক্ষণ কেন্দ্র"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রতিষ্ঠান কোড</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ঠিকানা *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">যোগাযোগ ব্যক্তি</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ফোন নম্বর</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ইমেইল</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">স্ট্যাটাস</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-theme-surface border border-theme-border-strong rounded-xl text-sm text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:outline-none"
                >
                  <option value="Active">সক্রিয় (Active)</option>
                  <option value="Inactive">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-theme-border rounded-xl text-sm font-medium text-theme-text-secondary hover:bg-theme-surface-hover cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
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
