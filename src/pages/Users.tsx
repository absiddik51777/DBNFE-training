import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { logActivity } from '../lib/firebase';
import { UserProfile, UserRole, Institute, Batch, Trade, TrainerType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { 
  Users, 
  UserPlus, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Edit2, 
  X, 
  Phone, 
  Mail, 
  Building2, 
  Layers, 
  Search, 
  SlidersHorizontal, 
  Wrench, 
  BookOpen, 
  UserCheck, 
  UserX, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  KeyRound,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { useConfirm } from '../contexts/ConfirmationContext';

const UsersPage: React.FC = () => {
  const { userProfile, refreshProfile, sendPasswordReset } = useAuth();
  const { roles, hasPermission, isCourseDirector } = usePermissions();
  const { showAlert, confirm } = useConfirm();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

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
    trainerType: 'Skill Trainer' as TrainerType,
    instituteId: '',
    batchId: '',
    status: 'Active' as 'Active' | 'Inactive' | 'Pending Approval',
  });

  // Add form state
  const [addFormData, setAddFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Trainer' as UserRole,
    trainerType: 'Skill Trainer' as TrainerType,
    instituteId: '',
    batchId: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const isFMA = userProfile?.role === 'FMA';

  // Helper to deduplicate users by email, merging data and keeping the most complete profile
  const deduplicateUsers = (userList: UserProfile[]): UserProfile[] => {
    const emailMap = new Map<string, UserProfile>();
    const duplicatesToDelete: string[] = [];

    for (const u of userList) {
      const email = u.email?.trim().toLowerCase();
      if (!email) {
        emailMap.set(u.id, u);
        continue;
      }

      if (!emailMap.has(email)) {
        emailMap.set(email, u);
      } else {
        const existing = emailMap.get(email)!;
        const existingHasPhone = !!existing.phone && existing.phone !== '-';
        const currentHasPhone = !!u.phone && u.phone !== '-';

        let primary = existing;
        let duplicate = u;

        if (!existingHasPhone && currentHasPhone) {
          primary = { ...existing, ...u };
          duplicate = existing;
          emailMap.set(email, primary);
        } else {
          primary = { ...u, ...existing };
          duplicate = u;
          emailMap.set(email, primary);
        }

        if (duplicate.id && duplicate.id !== primary.id) {
          duplicatesToDelete.push(duplicate.id);
        }
      }
    }

    // Auto-clean duplicates in background if Course Director
    if (isCourseDirector && duplicatesToDelete.length > 0) {
      duplicatesToDelete.forEach(dupId => {
        dataService.deleteItem('users', dupId).catch(() => {});
      });
    }

    return Array.from(emailMap.values());
  };

  useEffect(() => {
    fetchData();

    // Real-time synchronization across multiple devices/browsers
    const unsubscribe = dataService.subscribeToCollection<UserProfile>('users', (freshUsers) => {
      if (Array.isArray(freshUsers) && freshUsers.length > 0) {
        setUsers(deduplicateUsers(freshUsers));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [uListRaw, iList, bList, tList] = await Promise.all([
        dataService.getItems<UserProfile>('users', true), // forceFresh: true to avoid stale cache across devices
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trade>('trades')
      ]);

      let currentUsers = deduplicateUsers(uListRaw);

      // Auto-reconcile known Firebase Authentication users (such as Burhanuddin) into Firestore
      if (isCourseDirector) {
        const burhanuddinEmail = 'mdbourhanuddin189@gmail.com';
        const exists = currentUsers.some(
          u => u.email && u.email.trim().toLowerCase() === burhanuddinEmail
        );

        if (!exists) {
          try {
            const burhanuddinProfile: UserProfile = {
              id: 'USR-bourhanuddin',
              name: 'মোঃ বোরহান উদ্দিন (Md Bourhanuddin)',
              email: burhanuddinEmail,
              phone: '01700-000000',
              role: 'Trainer',
              trainerType: 'Skill Trainer',
              instituteId: iList[0]?.id || '',
              batchId: bList[0]?.id || '',
              status: 'Active',
              createdAt: 1731000000000,
              updatedAt: Date.now()
            };
            await dataService.saveItem('users', burhanuddinProfile);
            currentUsers = deduplicateUsers(await dataService.getItems<UserProfile>('users', true));
            console.log("Auto-reconciled Burhanuddin into Firestore:", burhanuddinEmail);
          } catch (reconcileErr) {
            console.warn("Notice reconciling auth user:", reconcileErr);
          }
        }
      }

      setUsers(currentUsers);
      setInstitutes(iList);
      setBatches(bList);
      setTrades(tList);

      if (isManualRefresh) {
        showAlert({
          title: 'তথ্য সিঙ্ক সম্পন্ন',
          message: `ক্লাউড সার্ভার থেকে সর্বশেষ মোট ${currentUsers.length} জন ব্যবহারকারীর তথ্য সিঙ্ক করা হয়েছে।`,
          variant: 'success'
        });
      }
    } catch (err) {
      console.warn("Notice fetching user management data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleStatus = async (u: UserProfile) => {
    if (!isCourseDirector) {
      showAlert({
        title: 'সীমাবদ্ধ অনুমতি',
        message: 'কেবলমাত্র কোর্স পরিচালক ব্যবহারকারীর স্ট্যাটাস পরিবর্তন করতে পারবেন।',
        variant: 'warning'
      });
      return;
    }

    if (u.id === userProfile?.id) {
      showAlert({
        title: 'অনুমতি নেই',
        message: 'নিরাপত্তা নীতি অনুযায়ী আপনি নিজের অ্যাকাউন্ট নিষ্ক্রিয় করতে পারবেন না।',
        variant: 'danger'
      });
      return;
    }

    const newStatus: 'Active' | 'Inactive' = u.status === 'Active' ? 'Inactive' : 'Active';
    const statusTextBn = newStatus === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়';

    try {
      const updatedUser: UserProfile = {
        ...u,
        status: newStatus,
        updatedAt: Date.now()
      };
      await dataService.saveItem('users', updatedUser);
      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Course Director',
        `ব্যবহারকারী অ্যাকাউন্ট ${statusTextBn} করা হয়েছে: ${u.name} (${u.email})`,
        'Security',
        u.id
      );

      showAlert({
        title: 'স্ট্যাটাস আপডেট সম্পন্ন',
        message: `${u.name}-এর অ্যাকাউন্ট সফলভাবে ${statusTextBn} করা হয়েছে।`,
        variant: newStatus === 'Active' ? 'success' : 'info'
      });

      // Refresh list
      fetchData();
    } catch (err: any) {
      console.error("Error toggling user status:", err);
      showAlert({
        title: 'ত্রুটি',
        message: 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে: ' + (err?.message || ''),
        variant: 'danger'
      });
    }
  };

  const handleSendPasswordReset = async (u: UserProfile) => {
    if (!u.email || !u.email.includes('@')) {
      showAlert({
        title: 'ইমেইল অনুপস্থিত',
        message: 'এই ব্যবহারকারীর কোনো বৈধ ইমেইল ঠিকানা সংরক্ষিত নেই।',
        variant: 'warning'
      });
      return;
    }

    try {
      await sendPasswordReset(u.email);
      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Course Director',
        `পাসওয়ার্ড রিসেট লিঙ্ক প্রেরণ: ${u.name} (${u.email})`,
        'Security',
        u.id
      );

      showAlert({
        title: 'পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে',
        message: `${u.name}-এর রেজিস্টার্ড ইমেইল (${u.email}) ঠিকানায় পাসওয়ার্ড রিসেট লিঙ্ক সফলভাবে পাঠানো হয়েছে। ব্যবহারকারী তার ইনবক্স থেকে নতুন পাসওয়ার্ড সেট করতে পারবেন।`,
        variant: 'success'
      });
    } catch (err: any) {
      console.error("Error sending reset password link:", err);
      showAlert({
        title: 'রিসেট লিঙ্ক পাঠানো যায়নি',
        message: 'ত্রুটি: ' + (err?.message || 'অনুগ্রহ করে কিছুক্ষণ পর পুনরায় চেষ্টা করুন।'),
        variant: 'danger'
      });
    }
  };

  const handleEditClick = (u: UserProfile) => {
    // FMA can only edit Trainer
    if (isFMA && u.role !== 'Trainer') {
      showAlert({
        title: 'সীমাবদ্ধ অনুমতি',
        message: 'FMA শুধুমাত্র প্রশিক্ষক (Trainer) পরিচালনা করতে পারবেন।',
        variant: 'warning'
      });
      return;
    }
    setEditingUser(u);
    setEditFormData({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      trainerType: u.trainerType || 'Skill Trainer',
      instituteId: u.instituteId || '',
      batchId: u.batchId || '',
      status: u.status,
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (!isCourseDirector) {
      showAlert({
        title: 'অনুমতি নেই',
        message: 'কেবলমাত্র কোর্স পরিচালক ব্যবহারকারী মুছে ফেলতে পারেন।',
        variant: 'warning'
      });
      return;
    }

    if (u.id === userProfile?.id || u.email?.toLowerCase() === userProfile?.email?.toLowerCase()) {
      showAlert({
        title: 'নিরাপত্তা নিষেধাজ্ঞা',
        message: 'নিরাপত্তা নীতি অনুযায়ী আপনি নিজের সক্রিয় অ্যাকাউন্ট মুছে ফেলতে পারবেন না।',
        variant: 'danger'
      });
      return;
    }

    const ok = await confirm({
      title: 'ব্যবহারকারী ডিলিট নিশ্চিতকরণ',
      message: `আপনি কি নিশ্চিতভাবে "${u.name}" (${u.email}) অ্যাকাউন্টটি ডাটাবেজ থেকে মুছে ফেলতে চান?`,
      detail: 'এই ক্রিয়ার ফলে উক্ত ব্যবহারকারীর যাবতীয় প্রোফাইল তথ্য এবং পোর্টাল অ্যাক্সেস সম্পূর্ণরূপে মুছে যাবে।',
      confirmText: 'হ্যাঁ, ডিলিট করুন',
      cancelText: 'বাতিল',
      variant: 'danger'
    });

    if (!ok) return;

    try {
      await dataService.deleteItem('users', u.id);
      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Course Director',
        `ব্যবহারকারী অ্যাকাউন্ট ডিলিট করা হয়েছে: ${u.name} (${u.email})`,
        'Security',
        u.id
      );

      showAlert({
        title: 'ব্যবহারকারী মুছে ফেলা হয়েছে',
        message: `${u.name}-এর অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে।`,
        variant: 'success'
      });

      fetchData();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      showAlert({
        title: 'ডিলিট ব্যর্থ হয়েছে',
        message: 'ত্রুটি: ' + (err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'),
        variant: 'danger'
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // RBAC Security Guard: A user cannot modify their own role or status
    if (userProfile?.id === editingUser.id) {
      if (editFormData.role !== editingUser.role || editFormData.status !== editingUser.status) {
        showAlert({
          title: 'নিরাপত্তা নিষেধাজ্ঞা',
          message: 'নিরাপত্তা নীতি অনুযায়ী আপনি নিজের পদবী বা অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করতে পারবেন না।',
          variant: 'danger'
        });
        return;
      }
    }

    // RBAC Security Guard: Only Course Director can grant Course Director role
    if (!isCourseDirector && editFormData.role === 'Course Director') {
      showAlert({
        title: 'অনুমতি নেই',
        message: 'কেবলমাত্র কোর্স পরিচালক অন্য কাউকে কোর্স পরিচালক পদবী প্রদান করতে পারেন।',
        variant: 'danger'
      });
      return;
    }

    try {
      const isApproving = editingUser.status === 'Pending Approval' && editFormData.status === 'Active';
      const updatedUser: UserProfile = {
        ...editingUser,
        name: editFormData.name.trim(),
        role: editFormData.role,
        trainerType: editFormData.role === 'Trainer' ? editFormData.trainerType : undefined,
        instituteId: editFormData.role === 'Trainer' ? editFormData.instituteId : '',
        batchId: editFormData.role === 'Trainer' ? editFormData.batchId : '',
        status: editFormData.status,
        phone: editFormData.phone.trim(),
        ...(isApproving ? {
          approvedBy: userProfile?.id || userProfile?.email || 'admin',
          approvedAt: Date.now()
        } : {})
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
        `ব্যবহারকারী প্রোফাইল আপডেট: ${editFormData.name} (${editFormData.role}${editFormData.role === 'Trainer' ? ` - ${editFormData.trainerType}` : ''}) [স্ট্যাটাস: ${editFormData.status}]`,
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

  const handleQuickApprove = async (u: UserProfile) => {
    if (!isCourseDirector) {
      showAlert({
        title: 'সীমাবদ্ধ অনুমতি',
        message: 'কেবলমাত্র কোর্স পরিচালক নতুন অ্যাকাউন্ট অনুমোদন করতে পারেন।',
        variant: 'warning'
      });
      return;
    }

    try {
      const assignedRole = (u.role === 'Pending' || !u.role) ? 'Trainer' : u.role;
      const updatedUser: UserProfile = {
        ...u,
        role: assignedRole,
        status: 'Active',
        approvedBy: userProfile?.id || userProfile?.email || 'Course Director',
        approvedAt: Date.now(),
        updatedAt: Date.now()
      };

      await dataService.saveItem('users', updatedUser);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Course Director',
        `ব্যবহারকারী অনুমোদন সম্পন্ন: ${u.name} (${u.email}) - পদবী: ${assignedRole}`,
        'Security',
        u.id
      );

      showAlert({
        title: 'অ্যাকাউন্ট অনুমোদিত',
        message: `${u.name} (${u.email}) সফলভাবে অনুমোদিত এবং সক্রিয় করা হয়েছে।`,
        variant: 'success'
      });
      fetchData();
    } catch (err) {
      console.error("Error approving user:", err);
      showAlert({
        title: 'ত্রুটি',
        message: 'ব্যবহারকারী অনুমোদন করতে সমস্যা হয়েছে।',
        variant: 'danger'
      });
    }
  };

  const handleQuickReject = async (u: UserProfile) => {
    if (!isCourseDirector) {
      showAlert({
        title: 'সীমাবদ্ধ অনুমতি',
        message: 'কেবলমাত্র কোর্স পরিচালক আবেদন বাতিল করতে পারেন।',
        variant: 'warning'
      });
      return;
    }

    try {
      const updatedUser: UserProfile = {
        ...u,
        status: 'Inactive',
        rejectionReason: 'কোর্স পরিচালক কর্তৃক আবেদন বাতিল করা হয়েছে',
        updatedAt: Date.now()
      };

      await dataService.saveItem('users', updatedUser);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'Course Director',
        `ব্যবহারকারী আবেদন বাতিল: ${u.name} (${u.email})`,
        'Security',
        u.id
      );

      showAlert({
        title: 'আবেদন বাতিল',
        message: `${u.name}-এর অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।`,
        variant: 'info'
      });
      fetchData();
    } catch (err) {
      console.error("Error rejecting user:", err);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.name.trim() || !addFormData.email.trim()) return;

    const cleanEmail = addFormData.email.trim().toLowerCase();
    const existing = users.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
    if (existing) {
      showAlert({
        title: 'ইমেইল ইতোমধ্যে বিদ্যমান',
        message: `এই ইমেইল (${cleanEmail}) ইতোমধ্যে ব্যবহারকারী তালিকায় রয়েছে। আপনি তালিকা থেকে তাকে সম্পাদন (Edit) করতে পারেন।`,
        variant: 'warning'
      });
      return;
    }

    try {
      const newId = `USR-${Date.now().toString().slice(-6)}`;
      const newUser: UserProfile = {
        id: newId,
        name: addFormData.name.trim(),
        email: cleanEmail,
        phone: addFormData.phone.trim(),
        role: addFormData.role,
        trainerType: addFormData.role === 'Trainer' ? addFormData.trainerType : undefined,
        instituteId: addFormData.role === 'Trainer' ? addFormData.instituteId : '',
        batchId: addFormData.role === 'Trainer' ? addFormData.batchId : '',
        status: addFormData.status,
        createdAt: Date.now(),
      };

      await dataService.saveItem('users', newUser);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `নতুন ${addFormData.role === 'Trainer' ? (addFormData.trainerType === 'Literacy Trainer' ? 'লিটারেসি প্রশিক্ষক' : 'স্কিল প্রশিক্ষক') : 'ব্যবহারকারী'} নিবন্ধন: ${newUser.name} (${newUser.email})`,
        'Users',
        newId
      );

      showAlert({
        title: 'ব্যবহারকারী সফলভাবে যুক্ত হয়েছে',
        message: `${newUser.name} (${cleanEmail}) ডাটাবেজে সংরক্ষিত হয়েছে। তিনি লগইন করলে সরাসরি এই অ্যাকাউন্টে প্রবেশ করতে পারবেন।`,
        variant: 'success'
      });

      setIsAddModalOpen(false);
      setAddFormData({
        name: '',
        email: '',
        phone: '',
        role: 'Trainer',
        trainerType: 'Skill Trainer',
        instituteId: institutes[0]?.id || '',
        batchId: '',
        status: 'Active',
      });
      fetchData();
    } catch (err: any) {
      console.warn("Notice creating new user:", err);
      showAlert({
        title: 'ত্রুটি',
        message: 'ব্যবহারকারী সংরক্ষণ করা যায়নি: ' + (err?.message || ''),
        variant: 'danger'
      });
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

  const pendingCount = users.filter(u => u.status === 'Pending Approval').length;

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.phone?.includes(searchQuery));
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ব্যবহারকারী তালিকা লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">ব্যবহারকারী ও প্রশিক্ষক ব্যবস্থাপনা (User Management)</h1>
          <p className="text-sm text-theme-text-secondary mt-0.5">
            প্রশিক্ষকদের প্রতিষ্ঠান ও ব্যাচ সংযুক্ত করুন এবং পদবী ও পারমিশন নিয়ন্ত্রণ করুন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3.5 py-2.5 bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary border border-theme-border-strong rounded-xl text-sm font-semibold flex items-center space-x-2 transition shadow-xs disabled:opacity-60 cursor-pointer"
            title="ক্লাউড সার্ভার থেকে ব্যবহারকারী তালিকা সরাসরি সিঙ্ক করুন"
          >
            <RefreshCw size={16} className={`${refreshing ? 'animate-spin text-theme-primary' : 'text-theme-text-secondary'}`} />
            <span>{refreshing ? 'সিঙ্ক হচ্ছে...' : 'রিফ্রেশ (Sync)'}</span>
          </button>

          {isCourseDirector && (
            <Link
              to="/roles"
              className="px-4 py-2.5 bg-theme-accent-soft hover:opacity-90 text-theme-accent border border-theme-accent-border rounded-xl text-sm font-semibold flex items-center space-x-2 transition"
            >
              <Shield size={18} />
              <span>রোল ও পারমিশন টেবিল (Roles Table)</span>
            </Link>
          )}

          {hasPermission('create_user') && (
            <button
              onClick={() => {
                setAddFormData({
                  name: '',
                  email: '',
                  phone: '',
                  role: 'Trainer',
                  trainerType: 'Skill Trainer',
                  instituteId: institutes[0]?.id || '',
                  batchId: '',
                  status: 'Active',
                });
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-sm flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <UserPlus size={18} />
              <span>নতুন প্রশিক্ষক / ব্যবহারকারী যোগ করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-theme-border pb-3">
        <button
          onClick={() => setStatusFilter('All')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer tabular-nums ${
            statusFilter === 'All'
              ? 'bg-theme-primary text-theme-primary-fg shadow-xs'
              : 'bg-theme-surface text-theme-text-secondary hover:bg-theme-surface-hover border border-theme-border'
          }`}
        >
          সকল ব্যবহারকারী ({users.length})
        </button>

        <button
          onClick={() => setStatusFilter('Pending Approval')}
          className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer tabular-nums ${
            statusFilter === 'Pending Approval'
              ? 'bg-theme-warning text-theme-warning-fg shadow-xs'
              : 'bg-theme-warning-soft text-theme-warning hover:opacity-90 border border-theme-warning-border'
          }`}
        >
          <Clock size={14} />
          <span>অনুমোদনের অপেক্ষায়</span>
          {pendingCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
              statusFilter === 'Pending Approval' ? 'bg-theme-surface text-theme-warning' : 'bg-theme-warning text-theme-warning-fg'
            }`}>
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setStatusFilter('Active')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer tabular-nums ${
            statusFilter === 'Active'
              ? 'bg-theme-success text-theme-success-fg shadow-xs'
              : 'bg-theme-surface text-theme-text-secondary hover:bg-theme-surface-hover border border-theme-border'
          }`}
        >
          সক্রিয় ({users.filter(u => u.status === 'Active').length})
        </button>

        <button
          onClick={() => setStatusFilter('Inactive')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer tabular-nums ${
            statusFilter === 'Inactive'
              ? 'bg-theme-danger text-theme-danger-fg shadow-xs'
              : 'bg-theme-surface text-theme-text-secondary hover:bg-theme-surface-hover border border-theme-border'
          }`}
        >
          নিষ্ক্রিয় ({users.filter(u => u.status === 'Inactive').length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-theme-surface p-4 rounded-2xl border border-theme-border shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3.5 py-2 bg-theme-surface-subtle text-theme-text-primary placeholder:text-theme-text-muted border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
          />
          <Search className="absolute left-3 top-2.5 text-theme-text-muted" size={16} />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-theme-text-secondary whitespace-nowrap">পদবী ফিল্টার:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-theme-border-strong rounded-xl text-sm bg-theme-surface-subtle text-theme-text-primary focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none w-full sm:w-auto cursor-pointer tabular-nums"
          >
            <option value="All">সকল পদবী ({users.length})</option>
            {roles.map(r => (
              <option key={r.id} value={r.name}>
                {r.nameBn || r.name} ({users.filter(u => u.role === r.name).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-theme-border">
            <thead className="bg-theme-surface-subtle">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">নাম ও ইমেইল</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">মোবাইল নম্বর</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">পদবী (Role)</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">সংযুক্ত প্রতিষ্ঠান</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">নির্ধারিত ব্যাচ (Batch)</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">অবস্থা</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="bg-theme-surface divide-y divide-theme-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-theme-text-muted text-xs">
                    কোনো ব্যবহারকারী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const batchInfo = getBatchInfo(u.batchId);
                  const isPending = u.status === 'Pending Approval';
                  return (
                    <tr key={u.id} className={`hover:bg-theme-surface-hover transition-colors ${isPending ? 'bg-theme-warning-soft/30' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-theme-text-primary flex items-center space-x-1.5">
                          <span>{u.name}</span>
                          {isPending && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-theme-warning text-theme-warning-fg font-semibold">নতুন</span>
                          )}
                        </div>
                        <div className="text-xs text-theme-text-secondary font-mono">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-theme-text-secondary font-mono tabular-nums">
                        {u.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                          u.role === 'Course Director' ? 'bg-theme-accent-soft text-theme-accent border-theme-accent-border' :
                          u.role === 'FMA' ? 'bg-theme-info-soft text-theme-info border-theme-info-border' : 
                          u.role === 'Pending' ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border' :
                          u.trainerType === 'Literacy Trainer' ? 'bg-theme-info-soft text-theme-info border-theme-info-border' : 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border'
                        }`}>
                          {u.role === 'Trainer' 
                            ? (u.trainerType === 'Literacy Trainer' ? 'লিটারেসি প্রশিক্ষক (Literacy)' : 'স্কিল প্রশিক্ষক (Skill)')
                            : u.role === 'Course Director' ? 'কোর্স পরিচালক' : u.role === 'Pending' ? 'অপেক্ষমাণ' : 'FMA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-theme-text-secondary">
                        {u.role === 'Trainer' ? (
                          <div className="flex items-center space-x-1.5 font-medium text-theme-text-primary">
                            <Building2 size={14} className="text-theme-primary shrink-0" />
                            <span>{getInstituteName(u.instituteId)}</span>
                          </div>
                        ) : (
                          <span className="text-theme-text-muted">সকল প্রতিষ্ঠান</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {u.role === 'Trainer' ? (
                          batchInfo ? (
                            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-theme-primary-soft border border-theme-primary-border text-theme-primary-soft-fg font-semibold">
                              <Layers size={13} className="text-theme-primary shrink-0" />
                              <span>{batchInfo.batchName}</span>
                              {batchInfo.tradeName && (
                                <span className="text-[11px] font-normal text-theme-primary">({batchInfo.tradeName})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-theme-warning font-medium bg-theme-warning-soft px-2 py-0.5 rounded border border-theme-warning-border">
                              ব্যাচ অনির্ধারিত
                            </span>
                          )
                        ) : (
                          <span className="text-theme-text-muted">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          u.status === 'Active' 
                            ? 'bg-theme-success-soft text-theme-success border-theme-success-border' 
                            : u.status === 'Pending Approval'
                            ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border font-bold'
                            : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                        }`}>
                          {u.status === 'Active' ? 'সক্রিয়' : u.status === 'Pending Approval' ? 'অনুমোদনের অপেক্ষায়' : 'নিষ্ক্রিয়'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isCourseDirector && u.status === 'Pending Approval' && (
                            <>
                              <button
                                onClick={() => handleQuickApprove(u)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                                title="অ্যাকাউন্ট অনুমোদন ও সক্রিয় করুন"
                              >
                                <UserCheck size={14} />
                                <span>অনুমোদন</span>
                              </button>
                              <button
                                onClick={() => handleQuickReject(u)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-theme-danger-soft hover:opacity-90 text-theme-danger border border-theme-danger-border rounded-lg text-xs font-semibold transition cursor-pointer"
                                title="আবেদন বাতিল করুন"
                              >
                                <UserX size={14} />
                                <span>বাতিল</span>
                              </button>
                            </>
                          )}

                          {/* Quick Inactive / Active Toggle for Course Director (cannot toggle own account) */}
                          {isCourseDirector && u.id !== userProfile?.id && u.status !== 'Pending Approval' && (
                            u.status === 'Active' ? (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className="p-1.5 text-theme-danger hover:bg-theme-danger-soft rounded-lg transition cursor-pointer"
                                title="অ্যাকাউন্ট নিষ্ক্রিয় করুন (Deactivate)"
                              >
                                <UserX size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className="p-1.5 text-theme-success hover:bg-theme-success-soft rounded-lg transition cursor-pointer"
                                title="অ্যাকাউন্ট সক্রিয় করুন (Activate)"
                              >
                                <UserCheck size={16} />
                              </button>
                            )
                          )}

                          {/* Password Reset Email Trigger */}
                          {isCourseDirector && u.email && (
                            <button
                              onClick={() => handleSendPasswordReset(u)}
                              className="p-1.5 text-theme-warning hover:bg-theme-warning-soft rounded-lg transition cursor-pointer"
                              title={`পাসওয়ার্ড রিসেট লিঙ্ক পাঠান (${u.email})`}
                            >
                              <KeyRound size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => handleEditClick(u)}
                            className="p-1.5 text-theme-info hover:bg-theme-info-soft rounded-lg transition cursor-pointer"
                            title="পদবী, প্রতিষ্ঠান বা ব্যাচ সম্পাদনা"
                          >
                            <Edit2 size={16} />
                          </button>

                          {isCourseDirector && u.id !== userProfile?.id && u.email?.toLowerCase() !== userProfile?.email?.toLowerCase() && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-theme-danger hover:bg-theme-danger-soft rounded-lg transition cursor-pointer"
                              title="ব্যবহারকারী মুছে ফেলুন (Delete User)"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-4">
              <div>
                <h2 className="text-lg font-bold text-theme-text-primary">ব্যবহারকারী ও ব্যাচ সম্পাদন</h2>
                <p className="text-xs text-theme-text-secondary">প্রশিক্ষকের প্রতিষ্ঠান ও নির্ধারিত ব্যাচ আপডেট করুন</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-theme-text-muted hover:text-theme-text-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {editingUser?.id === userProfile?.id && (
              <div className="p-3 mb-3 bg-theme-warning-soft border border-theme-warning-border rounded-xl text-xs text-theme-warning flex items-center space-x-2">
                <AlertTriangle size={16} className="shrink-0 text-theme-warning" />
                <span>নিরাপত্তা নীতি: আপনি নিজের পদবী বা অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করতে পারবেন না।</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">নাম *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ইমেইল (Read-only)</label>
                <input
                  type="email"
                  readOnly
                  value={editFormData.email}
                  className="w-full px-3 py-2 bg-theme-surface-subtle border border-theme-border rounded-xl text-sm font-mono text-theme-text-secondary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  value={editFormData.phone}
                  onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পদবী (Role)</label>
                <select
                  value={editFormData.role}
                  onChange={e => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                  disabled={!isCourseDirector || editingUser?.id === userProfile?.id}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none disabled:bg-theme-surface-subtle disabled:text-theme-text-muted cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.nameBn || r.name})
                    </option>
                  ))}
                </select>
              </div>

              {editFormData.role === 'Trainer' && (
                <div className="space-y-3 p-3.5 bg-theme-primary-soft/60 rounded-xl border border-theme-primary-border">
                  <div className="text-xs font-bold text-theme-primary-soft-fg flex items-center space-x-1.5">
                    <Building2 size={15} />
                    <span>প্রশিক্ষকের ধরন ও ব্যাচ অ্যাসাইনমেন্ট</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রশিক্ষকের ধরন (Trainer Type) *</label>
                    <select
                      value={editFormData.trainerType}
                      onChange={e => setEditFormData({ ...editFormData, trainerType: e.target.value as TrainerType })}
                      className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm font-semibold focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
                    >
                      <option value="Skill Trainer">স্কিল ট্রেইনার (Skill Trainer - বৃত্তিমূলক ট্রেড)</option>
                      <option value="Literacy Trainer">লিটারেসি ট্রেইনার (Literacy Trainer - সাক্ষরতা ও জীবন দক্ষতা)</option>
                    </select>
                    <p className="text-[11px] text-theme-text-secondary mt-1">
                      {editFormData.trainerType === 'Skill Trainer' 
                        ? '✓ এই প্রশিক্ষক বৃত্তিমূলক ট্রেডের স্কিল মডিউল পরিচালনা করবেন।' 
                        : '✓ এই প্রশিক্ষক সাক্ষরতা ও জীবন দক্ষতা মডিউল পরিচালনা করবেন।'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">সংযুক্ত প্রতিষ্ঠান *</label>
                    <select
                      value={editFormData.instituteId}
                      onChange={e => {
                        const newInstId = e.target.value;
                        setEditFormData({ 
                          ...editFormData, 
                          instituteId: newInstId,
                          batchId: ''
                        });
                      }}
                      className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">কোনোটিই নয় (Unassigned)</option>
                      {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">নির্ধারিত ব্যাচ (Assigned Batch) *</label>
                    <select
                      value={editFormData.batchId}
                      onChange={e => setEditFormData({ ...editFormData, batchId: e.target.value })}
                      className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
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
                    <p className="text-[11px] text-theme-primary mt-1 font-medium">
                      ✓ উপস্থিতি (Attendance) মডিউলে এই প্রশিক্ষক সরাসরি এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা দেখতে পাবেন।
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">অ্যাকাউন্ট স্ট্যাটাস</label>
                <select
                  value={editFormData.status}
                  onChange={e => setEditFormData({ ...editFormData, status: e.target.value as any })}
                  disabled={!isCourseDirector || editingUser?.id === userProfile?.id}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none disabled:bg-theme-surface-subtle disabled:text-theme-text-muted cursor-pointer"
                >
                  <option value="Active">সক্রিয় (Active)</option>
                  <option value="Pending Approval">অনুমোদনের অপেক্ষায় (Pending Approval)</option>
                  <option value="Inactive">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-theme-border rounded-xl text-sm font-medium text-theme-text-secondary hover:bg-theme-surface-hover cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-theme-elevated rounded-2xl max-w-md w-full p-6 shadow-xl border border-theme-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-4">
              <div>
                <h2 className="text-lg font-bold text-theme-text-primary">নতুন ব্যবহারকারী / প্রশিক্ষক নিবন্ধন</h2>
                <p className="text-xs text-theme-text-secondary">প্রশিক্ষক হিসেবে প্রতিষ্ঠান ও ব্যাচে নিবন্ধন করুন</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-theme-text-muted hover:text-theme-text-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পূর্ণ নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মোঃ কামরুল হাসান"
                  value={addFormData.name}
                  onChange={e => setAddFormData({ ...addFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">ইমেইল ঠিকানা *</label>
                <input
                  type="email"
                  required
                  placeholder="trainer@bnfe.gov.bd"
                  value={addFormData.email}
                  onChange={e => setAddFormData({ ...addFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  placeholder="017xxxxxxxx"
                  value={addFormData.phone}
                  onChange={e => setAddFormData({ ...addFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">পদবী (Role) *</label>
                <select
                  value={addFormData.role}
                  onChange={e => setAddFormData({ ...addFormData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
                >
                  {isCourseDirector ? (
                    roles.map(r => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.nameBn || r.name})
                      </option>
                    ))
                  ) : (
                    roles.filter(r => r.name === 'Trainer' || r.code === 'trainer').map(r => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.nameBn || r.name})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {addFormData.role === 'Trainer' && (
                <div className="space-y-3 p-3.5 bg-theme-primary-soft/60 rounded-xl border border-theme-primary-border">
                  <div className="text-xs font-bold text-theme-primary-soft-fg flex items-center space-x-1.5">
                    <Building2 size={15} />
                    <span>প্রশিক্ষকের ধরন ও ব্যাচ নির্বাচন</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রশিক্ষকের ধরন (Trainer Type) *</label>
                    <select
                      value={addFormData.trainerType}
                      onChange={e => setAddFormData({ ...addFormData, trainerType: e.target.value as TrainerType })}
                      className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm font-semibold focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
                    >
                      <option value="Skill Trainer">স্কিল ট্রেইনার (Skill Trainer - বৃত্তিমূলক ট্রেড)</option>
                      <option value="Literacy Trainer">লিটারেসি ট্রেইনার (Literacy Trainer - সাক্ষরতা ও জীবন দক্ষতা)</option>
                    </select>
                    <p className="text-[11px] text-theme-text-secondary mt-1">
                      {addFormData.trainerType === 'Skill Trainer' 
                        ? '✓ এই প্রশিক্ষক বৃত্তিমূলক ট্রেডের স্কিল মডিউল পরিচালনা করবেন।' 
                        : '✓ এই প্রশিক্ষক সাক্ষরতা ও জীবন দক্ষতা মডিউল পরিচালনা করবেন।'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">প্রতিষ্ঠান *</label>
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
                      className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                      {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">নির্ধারিত ব্যাচ (Assigned Batch) *</label>
                    <select
                      value={addFormData.batchId}
                      onChange={e => setAddFormData({ ...addFormData, batchId: e.target.value })}
                      className="w-full px-3 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm focus:ring-2 focus:ring-theme-primary/25 focus:border-theme-primary focus:outline-none cursor-pointer"
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
                    <p className="text-[11px] text-theme-primary mt-1 font-medium">
                      ✓ উপস্থিতি মডিউলে এই প্রশিক্ষক সরাসরি এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা দেখতে পাবেন।
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-theme-border rounded-xl text-sm font-medium text-theme-text-secondary hover:bg-theme-surface-hover cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
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
