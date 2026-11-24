import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { recordSimpleAuditLog } from '../lib/auditLog';
import { UserProfile, UserRole, Institute, Batch, Trade, TrainerType, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import {
  UserPlus,
  Shield,
  Check,
  Minus,
  Edit2,
  X,
  Building2,
  Search,
  RefreshCw,
  KeyRound,
  Trash2,
  ChevronDown,
  AlertTriangle,
  UserCheck,
  UserX,
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { useConfirm } from '../contexts/ConfirmationContext';
import { ActionStep, useActionRunner } from '../hooks/useActionRunner';
import { ActionButton } from '../components/ui/ActionButton';
import { ActionMessageError } from '../lib/friendlyError';
import { TruncatedText } from '../components/ui/TruncatedText';

type StatusTab = 'All' | 'Active' | 'Inactive' | 'Pending Approval';

interface AddFormErrors {
  name?: string;
  email?: string;
  phone?: string;
  batchId?: string;
  general?: string;
}

interface EditFormErrors {
  name?: string;
  phone?: string;
  general?: string;
}

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
}

const NAME_PREFIX_REGEX = /^(?:md\.?|mr\.?|mrs\.?|ms\.?|dr\.?|মোঃ|মো\.|ডাঃ|ড\.)\s+/i;

function getAvatarInitial(name?: string): string {
  const raw = (name || '').trim();
  if (!raw) return 'U';
  let cleaned = raw;
  for (let i = 0; i < 3; i++) {
    const next = cleaned.replace(NAME_PREFIX_REGEX, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  const source = cleaned || raw;
  const firstChar = Array.from(source)[0] || 'U';
  return firstChar.toLocaleUpperCase();
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

const UsersPage: React.FC = () => {
  const { userProfile, refreshProfile, sendPasswordReset } = useAuth();
  const { roles, hasPermission, isCourseDirector } = usePermissions();
  const { showAlert, confirm } = useConfirm();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rawUsers, setRawUsers] = useState<UserProfile[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<StatusTab>('All');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [togglingUserIds, setTogglingUserIds] = useState<Record<string, boolean>>({});

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, tone: ToastState['tone'] = 'info') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: Date.now(), message, tone });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 2400);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Modals state
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [addFormErrors, setAddFormErrors] = useState<AddFormErrors>({});
  const [editFormErrors, setEditFormErrors] = useState<EditFormErrors>({});

  // Refs for validation focus & forms
  const addNameInputRef = useRef<HTMLInputElement>(null);
  const addEmailInputRef = useRef<HTMLInputElement>(null);
  const addPhoneInputRef = useRef<HTMLInputElement>(null);
  const addBatchSelectRef = useRef<HTMLSelectElement>(null);

  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editPhoneInputRef = useRef<HTMLInputElement>(null);

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
  });

  const isFMA = userProfile?.role === 'FMA';

  const isUserPending = (u: UserProfile): boolean =>
    u.status === 'Pending Approval' || u.role === 'Pending';

  // Pure deduplication for display: ALWAYS prefer real Firebase Auth UID docs (!id.startsWith('USR-'))
  const deduplicateUsers = useCallback(
    (userList: UserProfile[]): UserProfile[] => {
      const groups = new Map<string, UserProfile[]>();

      for (const u of userList) {
        const email = u.email?.trim().toLowerCase();
        const key = email || `__id_${u.id}`;
        const list = groups.get(key) || [];
        list.push(u);
        groups.set(key, list);
      }

      const result: UserProfile[] = [];
      for (const list of groups.values()) {
        if (list.length === 1) {
          result.push(list[0]);
          continue;
        }

        const sorted = [...list].sort((a, b) => {
          const aIsPlaceholder = a.id.startsWith('USR-') ? 1 : 0;
          const bIsPlaceholder = b.id.startsWith('USR-') ? 1 : 0;
          if (aIsPlaceholder !== bIsPlaceholder) return aIsPlaceholder - bIsPlaceholder;

          const aIsSelf = a.id === userProfile?.id ? 0 : 1;
          const bIsSelf = b.id === userProfile?.id ? 0 : 1;
          if (aIsSelf !== bIsSelf) return aIsSelf - bIsSelf;

          const aTime = a.updatedAt || a.createdAt || 0;
          const bTime = b.updatedAt || b.createdAt || 0;
          return bTime - aTime;
        });

        const canonical = { ...sorted[0] };
        for (const sibling of sorted.slice(1)) {
          if (!canonical.name || canonical.name === 'ব্যবহারকারী') {
            if (sibling.name) canonical.name = sibling.name;
          }
          if ((!canonical.phone || canonical.phone === '-') && sibling.phone && sibling.phone !== '-') {
            canonical.phone = sibling.phone;
          }
          if (!canonical.instituteId && sibling.instituteId) {
            canonical.instituteId = sibling.instituteId;
          }
          if (!canonical.batchId && sibling.batchId) {
            canonical.batchId = sibling.batchId;
          }
          if (!canonical.trainerType && sibling.trainerType) {
            canonical.trainerType = sibling.trainerType;
          }
        }
        result.push(canonical);
      }

      return result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    [userProfile?.id]
  );

  // Save to canonical Firebase Auth UID document & clean duplicate placeholder docs
  const saveUserAndReconcileDuplicates = async (
    targetUser: UserProfile,
    updatedPayload: UserProfile,
    auditTitle: string
  ): Promise<UserProfile> => {
    const cleanEmail = (updatedPayload.email || targetUser.email || '').trim().toLowerCase();
    const sameEmailDocs = cleanEmail
      ? rawUsers.filter((r) => (r.email || '').trim().toLowerCase() === cleanEmail)
      : [];

    const realUidDoc = sameEmailDocs.find((r) => !r.id.startsWith('USR-'));
    const canonicalId = realUidDoc ? realUidDoc.id : targetUser.id;
    const finalDoc: UserProfile = {
      ...updatedPayload,
      id: canonicalId,
      email: cleanEmail || updatedPayload.email,
      updatedAt: Date.now(),
    };

    await dataService.saveItem('users', finalDoc, {
      module: 'security',
      title: auditTitle,
      actor: userProfile
        ? {
            userId: userProfile.id || '',
            user: userProfile.name || 'Course Director',
            userRole: userProfile.role || '',
          }
        : undefined,
    });

    if (isCourseDirector && sameEmailDocs.length > 1) {
      for (const dup of sameEmailDocs) {
        if (dup.id !== canonicalId) {
          await dataService
            .deleteItem('users', dup.id, true, {
              module: 'security',
              title: `ডুপ্লিকেট প্রোফাইল পরিষ্কার: ${finalDoc.name}`,
            })
            .catch(() => {});
        }
      }
    }

    return finalDoc;
  };

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const [uListRaw, iList, bList, tList] = await Promise.all([
          dataService.getItems<UserProfile>('users', true),
          dataService.getItems<Institute>('institutes'),
          dataService.getItems<Batch>('batches'),
          dataService.getItems<Trade>('trades'),
        ]);

        const currentUsers = deduplicateUsers(uListRaw);
        setRawUsers(uListRaw);
        setUsers(currentUsers);
        setInstitutes(iList);
        setBatches(bList);
        setTrades(tList);

        if (isManualRefresh) {
          showToast('তালিকা হালনাগাদ হয়েছে', 'success');
        }
      } catch (err) {
        console.warn('Notice fetching user management data:', err);
        if (isManualRefresh) {
          showToast('তালিকা হালনাগাদ করতে সমস্যা হয়েছে', 'danger');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [deduplicateUsers, showToast]
  );

  useEffect(() => {
    void fetchData(false);

    const unsubscribe = dataService.subscribeToCollection<UserProfile>('users', (freshUsers) => {
      if (Array.isArray(freshUsers)) {
        setRawUsers(freshUsers);
        setUsers(deduplicateUsers(freshUsers));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchData, deduplicateUsers]);

  const handleToggleStatus = async (u: UserProfile) => {
    if (isUserPending(u)) return;

    if (!isCourseDirector) {
      showToast('কেবলমাত্র কোর্স পরিচালক স্ট্যাটাস পরিবর্তন করতে পারবেন।', 'warning');
      return;
    }

    if (u.id === userProfile?.id) {
      showToast('আপনি নিজের অ্যাকাউন্ট নিষ্ক্রিয় করতে পারবেন না।', 'danger');
      return;
    }

    if (togglingUserIds[u.id]) return;

    const newStatus: 'Active' | 'Inactive' = u.status === 'Active' ? 'Inactive' : 'Active';
    const statusTextBn = newStatus === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়';

    setTogglingUserIds((prev) => ({ ...prev, [u.id]: true }));
    try {
      const updatedUser: UserProfile = {
        ...u,
        status: newStatus,
        updatedAt: Date.now(),
      };
      await saveUserAndReconcileDuplicates(
        u,
        updatedUser,
        `ব্যবহারকারী অ্যাকাউন্ট ${statusTextBn}: ${u.name}`
      );

      showToast(`${u.name} এখন ${statusTextBn}`, newStatus === 'Active' ? 'success' : 'info');
      await fetchData(false);
    } catch (err: any) {
      console.error('Error toggling user status:', err);
      showToast('স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে', 'danger');
    } finally {
      setTogglingUserIds((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
    }
  };

  const handleSendPasswordReset = async (u: UserProfile) => {
    if (!u.email || !u.email.includes('@')) {
      showToast('এই ব্যবহারকারীর বৈধ ইমেইল ঠিকানা নেই।', 'warning');
      return;
    }

    try {
      await sendPasswordReset(u.email);
      recordSimpleAuditLog({
        action: 'security',
        module: 'security',
        collectionName: 'users',
        targetId: u.id,
        targetLabel: u.name || u.email,
        title: `পাসওয়ার্ড রিসেট লিঙ্ক প্রেরণ: ${u.name}`,
        actor: userProfile
          ? {
              userId: userProfile.id || '',
              user: userProfile.name || 'Course Director',
              userRole: userProfile.role || '',
            }
          : undefined,
      }).catch(() => {});

      showAlert({
        title: 'পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে',
        message: `${u.name}-এর রেজিস্টার্ড ইমেইল (${u.email}) ঠিকানায় পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে।`,
        variant: 'success',
      });
    } catch (err: any) {
      console.error('Error sending reset password link:', err);
      showAlert({
        title: 'রিসেট লিঙ্ক পাঠানো যায়নি',
        message: 'ত্রুটি: ' + (err?.message || 'অনুগ্রহ করে কিছুক্ষণ পর পুনরায় চেষ্টা করুন।'),
        variant: 'danger',
      });
    }
  };

  const handleEditClick = (u: UserProfile) => {
    if (!hasPermission('edit_user') || (isFMA && u.role !== 'Trainer')) {
      showToast('এই ব্যবহারকারীকে সম্পাদনা করার অনুমতি আপনার নেই।', 'warning');
      return;
    }
    setEditingUser(u);
    setEditFormErrors({});
    editUserRunner.reset();
    setEditFormData({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
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
      showToast('কেবলমাত্র কোর্স পরিচালক ব্যবহারকারী মুছে ফেলতে পারেন।', 'warning');
      return;
    }

    if (u.id === userProfile?.id || u.email?.toLowerCase() === userProfile?.email?.toLowerCase()) {
      showToast('আপনি নিজের সক্রিয় অ্যাকাউন্ট মুছে ফেলতে পারবেন না।', 'danger');
      return;
    }

    const ok = await confirm({
      title: 'ব্যবহারকারী ডিলিট নিশ্চিতকরণ',
      message: `আপনি কি নিশ্চিতভাবে "${u.name}" (${u.email}) অ্যাকাউন্টটি ডাটাবেজ থেকে মুছে ফেলতে চান?`,
      detail: 'এই ক্রিয়ার ফলে উক্ত ব্যবহারকারীর প্রোফাইল তথ্য ও পোর্টাল অ্যাক্সেস মুছে যাবে।',
      confirmText: 'হ্যাঁ, ডিলিট করুন',
      cancelText: 'বাতিল',
      variant: 'danger',
    });

    if (!ok) return;

    try {
      const cleanEmail = (u.email || '').trim().toLowerCase();
      const matchingDocs = cleanEmail
        ? rawUsers.filter((r) => (r.email || '').trim().toLowerCase() === cleanEmail)
        : [u];
      const idsToDelete = Array.from(new Set([u.id, ...matchingDocs.map((m) => m.id)]));

      for (const delId of idsToDelete) {
        await dataService.deleteItem('users', delId, true, {
          module: 'security',
          actor: userProfile
            ? {
                userId: userProfile.id || '',
                user: userProfile.name || 'Course Director',
                userRole: userProfile.role || '',
              }
            : undefined,
        });
      }

      showToast(`${u.name} মুছে ফেলা হয়েছে`, 'success');
      await fetchData(false);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      showToast('ডিলিট ব্যর্থ হয়েছে', 'danger');
    }
  };

  const editUserSteps: ActionStep<void>[] = useMemo(
    () => [
      {
        id: 'update-user-profile',
        label: 'ব্যবহারকারীর তথ্য সংরক্ষণ করা হচ্ছে',
        run: async () => {
          if (!editingUser) {
            throw new ActionMessageError('সম্পাদনার জন্য কোনো ব্যবহারকারী নির্বাচিত নেই।');
          }
          const isApproving =
            (editingUser.status === 'Pending Approval' || editingUser.role === 'Pending') &&
            editFormData.status === 'Active';
          const updatedUser: UserProfile = {
            ...editingUser,
            name: editFormData.name.trim().slice(0, 100),
            role: editFormData.role,
            trainerType:
              editFormData.role === 'Trainer' ? editFormData.trainerType : (null as any),
            instituteId: editFormData.role === 'Trainer' ? editFormData.instituteId : '',
            batchId: editFormData.role === 'Trainer' ? editFormData.batchId : '',
            status: editFormData.status,
            phone: editFormData.phone.trim().slice(0, 30),
            updatedAt: Date.now(),
            ...(isApproving
              ? {
                  approvedBy: userProfile?.id || userProfile?.email || 'admin',
                  approvedAt: Date.now(),
                  rejectionReason: null as any,
                }
              : {}),
          };

          const savedDoc = await saveUserAndReconcileDuplicates(
            editingUser,
            updatedUser,
            `ব্যবহারকারী প্রোফাইল আপডেট: ${editFormData.name.trim()}`
          );

          if (userProfile?.id === savedDoc.id || userProfile?.id === editingUser.id) {
            await refreshProfile();
          }

          await fetchData(false);
        },
        describe: () => `${editFormData.name.trim()} এর তথ্য আপডেট হয়েছে`,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editFormData, editingUser, userProfile, rawUsers]
  );

  const editUserRunner = useActionRunner(editUserSteps);
  const isEditLocked =
    editUserRunner.phase === 'running' || editUserRunner.phase === 'waiting';

  const handleBeforeUpdate = (): boolean => {
    const errors: EditFormErrors = {};
    if (!editingUser) return false;

    const trimmedName = editFormData.name.trim();
    if (trimmedName.length < 3) {
      errors.name = 'পূর্ণ নাম লিখুন';
    }

    const digitsPhone = normalizePhoneDigits(editFormData.phone);
    if (!/^01\d{9}$/.test(digitsPhone)) {
      errors.phone = '১১ সংখ্যার মোবাইল নম্বর দিন, যেমন 017XXXXXXXX';
    }

    if (userProfile?.id === editingUser.id) {
      if (
        editFormData.role !== editingUser.role ||
        editFormData.status !== editingUser.status
      ) {
        errors.general =
          'নিরাপত্তা নীতি অনুযায়ী আপনি নিজের পদবী বা অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করতে পারবেন না।';
      }
    } else if (
      editFormData.status === 'Active' &&
      (editFormData.role === 'Pending' || !editFormData.role)
    ) {
      errors.general =
        'অ্যাকাউন্ট সক্রিয় করতে অনুগ্রহ করে একটি বৈধ পদবী (যেমন: Trainer, FMA বা Course Director) নির্বাচন করুন।';
    } else if (!isCourseDirector && editFormData.role === 'Course Director') {
      errors.general =
        'কেবলমাত্র কোর্স পরিচালক অন্য কাউকে কোর্স পরিচালক পদবী প্রদান করতে পারেন।';
    }

    setEditFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (errors.name) editNameInputRef.current?.focus();
      else if (errors.phone) editPhoneInputRef.current?.focus();
      return false;
    }
    return true;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditLocked || editUserRunner.phase === 'success') return;
    if (!handleBeforeUpdate()) return;
    await editUserRunner.run();
  };

  const handleQuickApprove = async (u: UserProfile) => {
    if (!isCourseDirector) {
      showToast('কেবলমাত্র কোর্স পরিচালক আবেদন অনুমোদন করতে পারেন।', 'warning');
      return;
    }

    try {
      const assignedRole = u.role === 'Pending' || !u.role ? 'Trainer' : u.role;
      const updatedUser: UserProfile = {
        ...u,
        role: assignedRole,
        status: 'Active',
        rejectionReason: null as any,
        approvedBy: userProfile?.id || userProfile?.email || 'Course Director',
        approvedAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveUserAndReconcileDuplicates(
        u,
        updatedUser,
        `ব্যবহারকারী অনুমোদন: ${u.name} (${assignedRole})`
      );

      showToast(`${u.name} অনুমোদিত ও সক্রিয় হয়েছেন`, 'success');
      await fetchData(false);
    } catch (err) {
      console.error('Error approving user:', err);
      showToast('অনুমোদন করতে সমস্যা হয়েছে', 'danger');
    }
  };

  const handleQuickReject = async (u: UserProfile) => {
    if (!isCourseDirector) {
      showToast('কেবলমাত্র কোর্স পরিচালক আবেদন বাতিল করতে পারেন।', 'warning');
      return;
    }

    try {
      const updatedUser: UserProfile = {
        ...u,
        status: 'Inactive',
        rejectionReason: 'কোর্স পরিচালক কর্তৃক আবেদন বাতিল করা হয়েছে',
        updatedAt: Date.now(),
      };

      await saveUserAndReconcileDuplicates(
        u,
        updatedUser,
        `ব্যবহারকারী আবেদন বাতিল: ${u.name}`
      );

      showToast(`${u.name}-এর অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে`, 'info');
      await fetchData(false);
    } catch (err) {
      console.error('Error rejecting user:', err);
      showToast('প্রক্রিয়া ব্যর্থ হয়েছে', 'danger');
    }
  };

  const addUserSteps: ActionStep<{ name: string; email: string }>[] = useMemo(
    () => [
      {
        id: 'create-user-profile',
        label: 'নতুন ব্যবহারকারী নিবন্ধন করা হচ্ছে',
        run: async () => {
          const cleanEmail = addFormData.email.trim().toLowerCase().slice(0, 150);
          const cleanPhone = normalizePhoneDigits(addFormData.phone).slice(0, 30);
          const newId = `USR-${Date.now().toString().slice(-6)}`;
          const newUser: UserProfile = {
            id: newId,
            name: addFormData.name.trim().slice(0, 100),
            email: cleanEmail,
            phone: cleanPhone,
            role: addFormData.role,
            trainerType:
              addFormData.role === 'Trainer' ? addFormData.trainerType : undefined,
            instituteId: addFormData.role === 'Trainer' ? addFormData.instituteId : '',
            batchId: addFormData.role === 'Trainer' ? addFormData.batchId : '',
            status: 'Pending Approval',
            createdAt: Date.now(),
          };

          await dataService.saveItem('users', newUser, {
            module: 'security',
            title: `নতুন ব্যবহারকারী নিবন্ধন: ${newUser.name} (${addFormData.role})`,
            actor: userProfile
              ? {
                  userId: userProfile.id || '',
                  user: userProfile.name || 'User',
                  userRole: userProfile.role || '',
                }
              : undefined,
          });

          await fetchData(false);
          return { name: newUser.name, email: cleanEmail };
        },
        describe: (res) => `${res.name} নিবন্ধিত হয়েছে (অনুমোদনের অপেক্ষায়)`,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addFormData, userProfile]
  );

  const addUserRunner = useActionRunner(addUserSteps);
  const isAddLocked =
    addUserRunner.phase === 'running' || addUserRunner.phase === 'waiting';

  const handleBeforeCreateUser = (): boolean => {
    const errors: AddFormErrors = {};
    const trimmedName = addFormData.name.trim();
    const cleanEmail = addFormData.email.trim().toLowerCase();
    const digitsPhone = normalizePhoneDigits(addFormData.phone);

    if (trimmedName.length < 3) {
      errors.name = 'পূর্ণ নাম লিখুন';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'সঠিক ইমেইল ঠিকানা দিন';
    } else {
      const existing = users.find(
        (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
      );
      if (existing) {
        errors.email = 'এই ইমেইল ইতোমধ্যে তালিকায় রয়েছে';
      }
    }

    if (!/^01\d{9}$/.test(digitsPhone)) {
      errors.phone = '১১ সংখ্যার মোবাইল নম্বর দিন, যেমন 017XXXXXXXX';
    }

    if (addFormData.role === 'Trainer' && !addFormData.batchId) {
      errors.batchId = 'একটি ব্যাচ নির্বাচন করুন';
    }

    setAddFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (errors.name) addNameInputRef.current?.focus();
      else if (errors.email) addEmailInputRef.current?.focus();
      else if (errors.phone) addPhoneInputRef.current?.focus();
      else if (errors.batchId) addBatchSelectRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddLocked || addUserRunner.phase === 'success') return;
    if (!handleBeforeCreateUser()) return;
    await addUserRunner.run();
  };

  const openAddModal = () => {
    setAddFormErrors({});
    addUserRunner.reset();
    setAddFormData({
      name: '',
      email: '',
      phone: '',
      role: 'Trainer',
      trainerType: 'Skill Trainer',
      instituteId: institutes[0]?.id || '',
      batchId: '',
    });
    setIsAddModalOpen(true);
  };

  const resetAddRunner = addUserRunner.reset;
  const resetAndCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setAddFormErrors({});
    setAddFormData({
      name: '',
      email: '',
      phone: '',
      role: 'Trainer',
      trainerType: 'Skill Trainer',
      instituteId: institutes[0]?.id || '',
      batchId: '',
    });
    resetAddRunner();
  }, [institutes, resetAddRunner]);

  const handleAddSuccessComplete = useCallback(() => {
    resetAndCloseAddModal();
    setStatusFilter('Pending Approval');
    setRoleFilter('All');
    showToast('নিবন্ধন জমা হয়েছে, অনুমোদনের অপেক্ষায়', 'success');
  }, [resetAndCloseAddModal, showToast]);

  // Escape key closes any open modal (unless action is locked)
  useEffect(() => {
    const anyModalOpen = isPermissionsModalOpen || isAddModalOpen || isEditModalOpen;
    if (!anyModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isPermissionsModalOpen) {
        setIsPermissionsModalOpen(false);
      } else if (isAddModalOpen && !isAddLocked) {
        resetAndCloseAddModal();
      } else if (isEditModalOpen && !isEditLocked) {
        setIsEditModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isPermissionsModalOpen,
    isAddModalOpen,
    isEditModalOpen,
    isAddLocked,
    isEditLocked,
    resetAndCloseAddModal,
  ]);

  const getInstituteName = (id?: string) => {
    if (!id) return '';
    return institutes.find((i) => i.id === id)?.name || id;
  };

  const getBatchInfo = (batchId?: string) => {
    if (!batchId) return null;
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return null;
    const trade = trades.find((t) => t.id === batch.tradeId);
    return {
      batchName: batch.name,
      tradeName: trade?.name || '',
    };
  };

  const getRoleDisplayLabel = (u: UserProfile): string => {
    if (u.role === 'Pending') return 'অপেক্ষমাণ (Pending)';
    const matchedRole = roles.find((r) => r.name === u.role);
    if (matchedRole?.nameBn) {
      if (u.role === 'Trainer') {
        return u.trainerType === 'Literacy Trainer'
          ? 'প্রশিক্ষক (Literacy)'
          : 'প্রশিক্ষক (Skill)';
      }
      return matchedRole.nameBn;
    }
    if (u.role === 'Course Director') return 'কোর্স পরিচালক';
    if (u.role === 'FMA') return 'FMA';
    if (u.role === 'Trainer') return 'প্রশিক্ষক';
    return u.role || 'অনির্ধারিত';
  };

  const getRoleTabLabel = (r: Role): string => {
    if (r.name === 'Course Director') return 'Course Director';
    if (r.name === 'FMA') return 'FMA';
    if (r.name === 'Trainer') return 'প্রশিক্ষক (Trainer)';
    return r.nameBn || r.name;
  };

  const getAvatarToneClasses = (role: string): string => {
    if (role === 'Course Director') {
      return 'bg-theme-accent-soft text-theme-accent border-theme-accent-border';
    }
    if (role === 'FMA') {
      return 'bg-theme-info-soft text-theme-info border-theme-info-border';
    }
    if (role === 'Pending') {
      return 'bg-theme-warning-soft text-theme-warning border-theme-warning-border';
    }
    return 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border';
  };

  const getRolePillClasses = (role: string): string => {
    if (role === 'Course Director') {
      return 'bg-theme-accent-soft text-theme-accent border-theme-accent-border';
    }
    if (role === 'FMA') {
      return 'bg-theme-info-soft text-theme-info border-theme-info-border';
    }
    if (role === 'Pending') {
      return 'bg-theme-warning-soft text-theme-warning border-theme-warning-border';
    }
    return 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border';
  };

  // Counts
  const pendingCount = useMemo(() => users.filter(isUserPending).length, [users]);
  const activeCount = useMemo(
    () => users.filter((u) => u.status === 'Active' && u.role !== 'Pending').length,
    [users]
  );
  const inactiveCount = useMemo(
    () => users.filter((u) => u.status === 'Inactive').length,
    [users]
  );

  // Filtered list
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = normalizePhoneDigits(q);

    return users.filter((u) => {
      const matchesSearch =
        !q ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (qDigits.length > 0 && normalizePhoneDigits(u.phone || '').includes(qDigits));

      const matchesRole = roleFilter === 'All' || u.role === roleFilter;

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Pending Approval'
          ? isUserPending(u)
          : statusFilter === 'Active'
          ? u.status === 'Active' && u.role !== 'Pending'
          : u.status === 'Inactive');

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const toggleExpandCard = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Permission matrix rows synced with live RolesContext
  const permissionMatrixRows = useMemo(
    () => [
      {
        label: 'ব্যবহারকারী যোগ/সম্পাদনা',
        check: (r: Role) =>
          r.name === 'Course Director' ||
          (r.permissions.includes('create_user') && r.permissions.includes('edit_user')),
      },
      {
        label: 'ব্যাচ তৈরি ও বরাদ্দ',
        check: (r: Role) =>
          r.name === 'Course Director' ||
          r.permissions.includes('create_batch') ||
          r.permissions.includes('edit_batch'),
      },
      {
        label: 'শিক্ষার্থী তালিকা দেখা',
        check: (r: Role) =>
          r.name === 'Course Director' || r.permissions.includes('view_trainees'),
      },
      {
        label: 'হাজিরা গ্রহণ',
        check: (r: Role) =>
          r.name === 'Course Director' || r.permissions.includes('take_attendance'),
      },
      {
        label: 'রিপোর্ট ডাউনলোড',
        check: (r: Role) =>
          r.name === 'Course Director' || r.permissions.includes('export_reports'),
      },
    ],
    []
  );

  const statusTabs: { key: StatusTab; label: string; count: number; isWarning?: boolean }[] = [
    { key: 'All', label: 'All', count: users.length },
    { key: 'Active', label: 'Active', count: activeCount },
    { key: 'Inactive', label: 'Inactive', count: inactiveCount },
    { key: 'Pending Approval', label: 'Pending for Approval', count: pendingCount, isWarning: true },
  ];

  const availableAddBatches = useMemo(
    () =>
      batches.filter(
        (b) => !addFormData.instituteId || b.instituteId === addFormData.instituteId
      ),
    [batches, addFormData.instituteId]
  );

  const availableEditBatches = useMemo(
    () =>
      batches.filter(
        (b) => !editFormData.instituteId || b.instituteId === editFormData.instituteId
      ),
    [batches, editFormData.instituteId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mr-3" />
        <span className="text-sm font-medium">ব্যবহারকারী তালিকা লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-20 min-[760px]:pb-6">
      {/* Page Heading Block */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="text-xs font-medium text-theme-text-muted flex items-center gap-1.5 mb-1.5"
          >
            <Link
              to="/settings"
              className="hover:text-theme-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary rounded"
            >
              Settings
            </Link>
            <span aria-hidden="true">›</span>
            <span className="text-theme-text-secondary">Users</span>
          </nav>

          <h1 className="text-2xl sm:text-[26px] font-bold text-theme-text-primary leading-tight text-balance">
            ব্যবহারকারী ও প্রশিক্ষক ব্যবস্থাপনা
          </h1>
          <p className="text-xs font-medium text-theme-text-muted mt-0.5">
            User Management
          </p>
          <p className="text-sm text-theme-text-secondary mt-1.5 leading-relaxed">
            প্রশিক্ষকদের প্রতিষ্ঠান ও ব্যাচ সংযুক্ত করুন এবং পদবী ও পারমিশন নিয়ন্ত্রণ করুন।
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="min-h-[44px] px-4 py-2 bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary border border-theme-border rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <RefreshCw
              size={17}
              strokeWidth={1.8}
              className={refreshing ? 'animate-spin motion-reduce:animate-none text-theme-primary' : 'text-theme-text-secondary'}
            />
            <span>{refreshing ? 'হালনাগাদ হচ্ছে...' : 'রিফ্রেশ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPermissionsModalOpen(true)}
            className="min-h-[44px] px-4 py-2 bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary border border-theme-border rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-xs cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <Shield size={17} strokeWidth={1.8} className="text-theme-primary" />
            <span>রোল ও পারমিশন</span>
          </button>

          {hasPermission('create_user') && (
            <button
              type="button"
              onClick={openAddModal}
              className="hidden min-[760px]:inline-flex min-h-[44px] px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-xl text-sm font-semibold shadow-sm items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:ring-offset-2"
            >
              <UserPlus size={18} strokeWidth={1.8} />
              <span>নতুন ব্যবহারকারী</span>
            </button>
          )}
        </div>
      </section>

      {/* Filter Area */}
      <section aria-label="ব্যবহারকারী ফিল্টার" className="space-y-3">
        {/* Status Segmented Control */}
        <div
          role="tablist"
          aria-label="অবস্থা অনুযায়ী ফিল্টার"
          className="bg-theme-surface-subtle p-1.5 rounded-2xl border border-theme-border overflow-x-auto no-scrollbar flex items-center gap-1"
        >
          {statusTabs.map((tab) => {
            const isSelected = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => setStatusFilter(tab.key)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary ${
                  isSelected
                    ? 'bg-theme-surface text-theme-text-primary shadow-xs'
                    : 'text-theme-text-secondary hover:text-theme-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                    tab.isWarning
                      ? isSelected
                        ? 'bg-theme-warning text-theme-warning-fg'
                        : 'bg-theme-warning-soft text-theme-warning border border-theme-warning-border'
                      : isSelected
                      ? 'bg-theme-primary-soft text-theme-primary-soft-fg'
                      : 'bg-theme-surface text-theme-text-secondary border border-theme-border'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search
            size={18}
            strokeWidth={1.8}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন…"
            aria-label="নাম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন"
            className="w-full min-h-[44px] pl-10 pr-11 py-2.5 bg-theme-surface text-theme-text-primary placeholder:text-theme-text-muted border border-theme-border rounded-2xl text-sm shadow-xs focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="সার্চ মুছুন"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] rounded-xl text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Role Segmented Control */}
        <div
          role="tablist"
          aria-label="পদবী অনুযায়ী ফিল্টার"
          className="bg-theme-surface-subtle p-1.5 rounded-2xl border border-theme-border overflow-x-auto no-scrollbar flex items-center gap-1"
        >
          <button
            role="tab"
            type="button"
            aria-selected={roleFilter === 'All'}
            onClick={() => setRoleFilter('All')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary ${
              roleFilter === 'All'
                ? 'bg-theme-surface text-theme-text-primary shadow-xs'
                : 'text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <span>All</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                roleFilter === 'All'
                  ? 'bg-theme-primary-soft text-theme-primary-soft-fg'
                  : 'bg-theme-surface text-theme-text-secondary border border-theme-border'
              }`}
            >
              {users.length}
            </span>
          </button>

          {roles.map((r) => {
            const count = users.filter((u) => u.role === r.name).length;
            const isSelected = roleFilter === r.name;
            return (
              <button
                key={r.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => setRoleFilter(r.name)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary ${
                  isSelected
                    ? 'bg-theme-surface text-theme-text-primary shadow-xs'
                    : 'text-theme-text-secondary hover:text-theme-text-primary'
                }`}
              >
                <span>{getRoleTabLabel(r)}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                    isSelected
                      ? 'bg-theme-primary-soft text-theme-primary-soft-fg'
                      : 'bg-theme-surface text-theme-text-secondary border border-theme-border'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Muted Result Line */}
        <p
          aria-live="polite"
          className="text-xs font-medium text-theme-text-muted tabular-nums px-0.5"
        >
          Showing {filteredUsers.length} User(s)
        </p>
      </section>

      {/* Empty State vs User List */}
      {filteredUsers.length === 0 ? (
        <div className="border-2 border-dashed border-theme-border rounded-2xl bg-theme-surface p-8 sm:p-12 text-center space-y-2">
          <p className="text-base font-bold text-theme-text-primary">
            কোনো ব্যবহারকারী পাওয়া যায়নি
          </p>
          <p className="text-sm text-theme-text-secondary">
            অন্য শব্দে খুঁজুন অথবা ফিল্টার বদলান।
          </p>
          {(searchQuery || statusFilter !== 'All' || roleFilter !== 'All') && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setRoleFilter('All');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-theme-surface-subtle hover:bg-theme-surface-hover border border-theme-border text-xs font-semibold text-theme-text-primary cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                সব ফিল্টার রিসেট করুন
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile (<760px): Vertical List of Cards */}
          <div className="space-y-3 min-[760px]:hidden">
            {filteredUsers.map((u) => {
              const isPending = isUserPending(u);
              const isExpanded = Boolean(expandedCardIds[u.id]);
              const batchInfo = getBatchInfo(u.batchId);
              const instName = getInstituteName(u.instituteId);
              const roleLabel = getRoleDisplayLabel(u);
              const isSelf = u.id === userProfile?.id;
              const canEdit =
                hasPermission('edit_user') && (!isFMA || u.role === 'Trainer');
              const isSwitchBusy = Boolean(togglingUserIds[u.id]);

              return (
                <article
                  key={u.id}
                  className="bg-theme-surface rounded-2xl border border-theme-border shadow-xs p-4 transition-colors"
                >
                  {/* Card Header Row */}
                  <div className="flex items-start gap-3">
                    <div
                      aria-hidden="true"
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-base shrink-0 ${getAvatarToneClasses(
                        u.role
                      )}`}
                    >
                      {getAvatarInitial(u.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-[15px] font-semibold text-theme-text-primary leading-snug break-words">
                        {u.name}
                      </h2>
                      <div className="mt-0.5 min-w-0">
                        <TruncatedText
                          text={u.email}
                          mode="pop"
                          className="font-mono text-xs text-theme-text-secondary"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpandCard(u.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `${u.name} বিস্তারিত বন্ধ করুন` : `${u.name} বিস্তারিত দেখুন`}
                      className="min-w-[44px] min-h-[44px] -mr-2 -mt-1.5 rounded-xl flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                    >
                      <ChevronDown
                        size={19}
                        strokeWidth={1.8}
                        className={`transition-transform duration-150 motion-reduce:transition-none ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Card Summary Row: Role + Status + Switch */}
                  <div className="mt-3 pt-2.5 border-t border-theme-border/60 flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${getRolePillClasses(
                        u.role
                      )}`}
                    >
                      {roleLabel}
                    </span>

                    <div className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isPending
                            ? 'bg-theme-warning'
                            : u.status === 'Active'
                            ? 'bg-theme-success'
                            : 'bg-theme-danger'
                        }`}
                      />
                      <span
                        className={
                          isPending
                            ? 'text-theme-warning'
                            : u.status === 'Active'
                            ? 'text-theme-success'
                            : 'text-theme-danger'
                        }
                      >
                        {isPending
                          ? 'অনুমোদনের অপেক্ষায়'
                          : u.status === 'Active'
                          ? 'সক্রিয়'
                          : 'নিষ্ক্রিয়'}
                      </span>
                    </div>

                    {!isPending && (
                      <div className="ml-auto flex items-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={u.status === 'Active'}
                          aria-label={`${u.name} অবস্থা পরিবর্তন করুন`}
                          disabled={isSwitchBusy || !isCourseDirector || isSelf}
                          onClick={() => void handleToggleStatus(u)}
                          className="min-h-[44px] min-w-[44px] -my-2 -mr-1.5 inline-flex items-center justify-end cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary rounded-xl px-1.5"
                        >
                          <span
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-150 motion-reduce:transition-none ${
                              u.status === 'Active'
                                ? 'bg-theme-primary'
                                : 'bg-theme-border-strong'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${
                                u.status === 'Active' ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-dashed border-theme-border space-y-2.5 text-xs">
                      <dl className="grid grid-cols-1 gap-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-theme-text-muted shrink-0">মোবাইল</dt>
                          <dd className="font-mono tabular-nums text-theme-text-primary font-medium text-right break-all">
                            {u.phone || '-'}
                          </dd>
                        </div>

                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-theme-text-muted shrink-0">পদবী</dt>
                          <dd className="text-theme-text-primary font-medium text-right">
                            {roleLabel}
                          </dd>
                        </div>

                        {u.trainerType && (
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-theme-text-muted shrink-0">ধরন</dt>
                            <dd className="text-theme-text-primary font-medium text-right">
                              {u.trainerType}
                            </dd>
                          </div>
                        )}

                        {instName && (
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-theme-text-muted shrink-0">প্রতিষ্ঠান</dt>
                            <dd className="text-theme-text-primary font-medium text-right break-words">
                              {instName}
                            </dd>
                          </div>
                        )}

                        {batchInfo && (
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-theme-text-muted shrink-0">ব্যাচ</dt>
                            <dd className="text-theme-text-primary font-medium text-right break-words">
                              {batchInfo.batchName}
                              {batchInfo.tradeName ? ` (${batchInfo.tradeName})` : ''}
                            </dd>
                          </div>
                        )}
                      </dl>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        {isPending && isCourseDirector && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleQuickApprove(u)}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-theme-success text-theme-success-fg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                            >
                              <UserCheck size={15} strokeWidth={1.8} />
                              <span>অনুমোদন</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleQuickReject(u)}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-theme-danger-soft text-theme-danger border border-theme-danger-border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                            >
                              <UserX size={15} strokeWidth={1.8} />
                              <span>বাতিল</span>
                            </button>
                          </>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleEditClick(u)}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-theme-surface-subtle hover:bg-theme-surface-hover border border-theme-border text-theme-text-primary text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                          >
                            <Edit2 size={15} strokeWidth={1.8} />
                            <span>সম্পাদনা</span>
                          </button>
                        )}

                        {isCourseDirector && u.email && (
                          <button
                            type="button"
                            onClick={() => void handleSendPasswordReset(u)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-theme-surface-subtle hover:bg-theme-surface-hover border border-theme-border text-theme-warning text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                          >
                            <KeyRound size={15} strokeWidth={1.8} />
                            <span>রিসেট</span>
                          </button>
                        )}

                        {isCourseDirector &&
                          !isSelf &&
                          u.email?.toLowerCase() !== userProfile?.email?.toLowerCase() && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(u)}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-theme-danger-soft hover:opacity-90 border border-theme-danger-border text-theme-danger text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary ml-auto"
                            >
                              <Trash2 size={15} strokeWidth={1.8} />
                              <span>মুছুন</span>
                            </button>
                          )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Desktop/Tablet (>=760px): Table inside rounded bordered container */}
          <div className="hidden min-[760px]:block bg-theme-surface rounded-2xl border border-theme-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-theme-border">
                <thead className="bg-theme-surface-subtle">
                  <tr>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-xs font-semibold text-theme-text-secondary"
                    >
                      নাম ও ইমেইল
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-xs font-semibold text-theme-text-secondary"
                    >
                      মোবাইল
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-xs font-semibold text-theme-text-secondary"
                    >
                      পদবী
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-xs font-semibold text-theme-text-secondary"
                    >
                      অবস্থা
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right text-xs font-semibold text-theme-text-secondary"
                    >
                      Active
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-theme-surface divide-y divide-theme-border">
                  {filteredUsers.map((u) => {
                    const isPending = isUserPending(u);
                    const batchInfo = getBatchInfo(u.batchId);
                    const instName = getInstituteName(u.instituteId);
                    const roleLabel = getRoleDisplayLabel(u);
                    const isSelf = u.id === userProfile?.id;
                    const canEdit =
                      hasPermission('edit_user') && (!isFMA || u.role === 'Trainer');
                    const isSwitchBusy = Boolean(togglingUserIds[u.id]);

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-theme-surface-hover transition-colors"
                      >
                        {/* নাম ও ইমেইল */}
                        <td className="px-5 py-3.5 max-w-[300px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              aria-hidden="true"
                              className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarToneClasses(
                                u.role
                              )}`}
                            >
                              {getAvatarInitial(u.name)}
                            </div>
                            <div className="min-w-0">
                              <TruncatedText
                                text={u.name}
                                mode="pop"
                                className="text-sm font-semibold text-theme-text-primary block"
                              />
                              <TruncatedText
                                text={u.email}
                                mode="pop"
                                className="text-xs font-mono text-theme-text-secondary block mt-0.5"
                              />
                            </div>
                          </div>
                        </td>

                        {/* মোবাইল */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono tabular-nums text-theme-text-primary">
                          {u.phone || '-'}
                        </td>

                        {/* পদবী */}
                        <td className="px-5 py-3.5 max-w-[260px]">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${getRolePillClasses(
                                u.role
                              )}`}
                            >
                              {roleLabel}
                            </span>
                            {u.role === 'Trainer' && (instName || batchInfo) && (
                              <TruncatedText
                                text={[
                                  instName,
                                  batchInfo
                                    ? `${batchInfo.batchName}${
                                        batchInfo.tradeName ? ` (${batchInfo.tradeName})` : ''
                                      }`
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                                mode="pop"
                                className="text-[11px] text-theme-text-secondary"
                              />
                            )}
                          </div>
                        </td>

                        {/* অবস্থা */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                            <span
                              aria-hidden="true"
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isPending
                                  ? 'bg-theme-warning'
                                  : u.status === 'Active'
                                  ? 'bg-theme-success'
                                  : 'bg-theme-danger'
                              }`}
                            />
                            <span
                              className={
                                isPending
                                  ? 'text-theme-warning'
                                  : u.status === 'Active'
                                  ? 'text-theme-success'
                                  : 'text-theme-danger'
                              }
                            >
                              {isPending
                                ? 'অনুমোদনের অপেক্ষায়'
                                : u.status === 'Active'
                                ? 'সক্রিয়'
                                : 'নিষ্ক্রিয়'}
                            </span>
                          </div>
                        </td>

                        {/* Active (Switch + Contextual Row Actions) */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isPending && isCourseDirector ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickApprove(u)}
                                  title="অনুমোদন করুন"
                                  aria-label={`${u.name} অনুমোদন করুন`}
                                  className="min-h-[40px] px-2.5 rounded-xl bg-theme-success-soft hover:opacity-90 border border-theme-success-border text-theme-success text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                                >
                                  <UserCheck size={14} strokeWidth={1.8} />
                                  <span>অনুমোদন</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickReject(u)}
                                  title="আবেদন বাতিল করুন"
                                  aria-label={`${u.name} বাতিল করুন`}
                                  className="min-h-[40px] min-w-[40px] rounded-xl text-theme-danger hover:bg-theme-danger-soft inline-flex items-center justify-center cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                                >
                                  <UserX size={16} strokeWidth={1.8} />
                                </button>
                              </>
                            ) : !isPending ? (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={u.status === 'Active'}
                                aria-label={`${u.name} সক্রিয়/নিষ্ক্রিয় করুন`}
                                disabled={isSwitchBusy || !isCourseDirector || isSelf}
                                onClick={() => void handleToggleStatus(u)}
                                className="min-h-[40px] px-1 inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary rounded-xl"
                              >
                                <span
                                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-150 motion-reduce:transition-none ${
                                    u.status === 'Active'
                                      ? 'bg-theme-primary'
                                      : 'bg-theme-border-strong'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${
                                      u.status === 'Active' ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </span>
                              </button>
                            ) : null}

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleEditClick(u)}
                                title="সম্পাদনা"
                                aria-label={`${u.name} সম্পাদনা`}
                                className="min-h-[40px] min-w-[40px] rounded-xl text-theme-text-secondary hover:text-theme-primary hover:bg-theme-surface-subtle inline-flex items-center justify-center cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                              >
                                <Edit2 size={16} strokeWidth={1.8} />
                              </button>
                            )}

                            {isCourseDirector && u.email && (
                              <button
                                type="button"
                                onClick={() => void handleSendPasswordReset(u)}
                                title={`পাসওয়ার্ড রিসেট লিঙ্ক পাঠান (${u.email})`}
                                aria-label={`${u.name} পাসওয়ার্ড রিসেট লিঙ্ক পাঠান`}
                                className="min-h-[40px] min-w-[40px] rounded-xl text-theme-warning hover:bg-theme-warning-soft inline-flex items-center justify-center cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                              >
                                <KeyRound size={16} strokeWidth={1.8} />
                              </button>
                            )}

                            {isCourseDirector &&
                              !isSelf &&
                              u.email?.toLowerCase() !== userProfile?.email?.toLowerCase() && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteUser(u)}
                                  title="ব্যবহারকারী মুছে ফেলুন"
                                  aria-label={`${u.name} মুছে ফেলুন`}
                                  className="min-h-[40px] min-w-[40px] rounded-xl text-theme-danger hover:bg-theme-danger-soft inline-flex items-center justify-center cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                                >
                                  <Trash2 size={16} strokeWidth={1.8} />
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
        </>
      )}

      {/* Phone-only (<760px) Floating Green Pill CTA */}
      {hasPermission('create_user') && (
        <button
          type="button"
          onClick={openAddModal}
          className="min-[760px]:hidden fixed right-4 z-30 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] min-h-[48px] px-5 rounded-full bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg shadow-lg inline-flex items-center gap-2 text-sm font-semibold active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:ring-offset-2"
        >
          <UserPlus size={18} strokeWidth={1.8} />
          <span>যোগ করুন</span>
        </button>
      )}

      {/* Live Toast Notification (role="status") */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`fixed z-40 left-4 right-4 min-[760px]:left-auto min-[760px]:right-6 min-[760px]:max-w-sm bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] min-[760px]:bottom-6 rounded-2xl border px-4 py-3 shadow-lg text-sm font-semibold flex items-center justify-between gap-3 ${
            toast.tone === 'success'
              ? 'bg-theme-elevated border-theme-success-border text-theme-success'
              : toast.tone === 'warning'
              ? 'bg-theme-elevated border-theme-warning-border text-theme-warning'
              : toast.tone === 'danger'
              ? 'bg-theme-elevated border-theme-danger-border text-theme-danger'
              : 'bg-theme-elevated border-theme-border-strong text-theme-text-primary'
          }`}
        >
          <span className="min-w-0 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="বার্তা বন্ধ করুন"
            className="min-w-[32px] min-h-[32px] rounded-lg hover:bg-theme-surface-hover flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Roles & Permissions Matrix Modal */}
      {isPermissionsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="roles-matrix-title"
          onClick={() => setIsPermissionsModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-2xl bg-theme-elevated border border-theme-border rounded-t-[24px] sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-theme-border flex items-start justify-between gap-3 shrink-0 bg-theme-elevated">
              <div>
                <h2
                  id="roles-matrix-title"
                  className="text-lg font-bold text-theme-text-primary leading-snug"
                >
                  রোল ও পারমিশন টেবিল
                </h2>
                <p className="text-xs text-theme-text-secondary mt-0.5">
                  কোন পদবীর কী অনুমতি আছে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(false)}
                aria-label="বন্ধ করুন"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 rounded-xl text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto rounded-xl border border-theme-border">
                <table className="min-w-full divide-y divide-theme-border text-sm">
                  <thead className="bg-theme-surface-subtle">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary whitespace-nowrap"
                      >
                        অনুমতি / কার্যক্রম
                      </th>
                      {roles.map((r) => (
                        <th
                          key={r.id}
                          scope="col"
                          className="px-4 py-3 text-center text-xs font-semibold text-theme-text-secondary whitespace-nowrap"
                        >
                          {r.name === 'Course Director'
                            ? 'অ্যাডমিন'
                            : r.name === 'FMA'
                            ? 'সুপারভাইজার'
                            : r.name === 'Trainer'
                            ? 'প্রশিক্ষক'
                            : r.nameBn || r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border bg-theme-surface">
                    {permissionMatrixRows.map((row) => (
                      <tr key={row.label} className="hover:bg-theme-surface-hover">
                        <td className="px-4 py-3 text-xs sm:text-sm font-medium text-theme-text-primary whitespace-nowrap">
                          {row.label}
                        </td>
                        {roles.map((r) => {
                          const allowed = row.check(r);
                          return (
                            <td key={r.id} className="px-4 py-3 text-center">
                              {allowed ? (
                                <span
                                  aria-label="অনুমতি আছে"
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-theme-success-soft text-theme-success"
                                >
                                  <Check size={14} strokeWidth={2.4} />
                                </span>
                              ) : (
                                <span
                                  aria-label="অনুমতি নেই"
                                  className="inline-flex items-center justify-center w-6 h-6 text-theme-text-muted"
                                >
                                  <Minus size={14} strokeWidth={2} />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 border-t border-theme-border bg-theme-elevated flex items-center justify-end gap-2.5 shrink-0">
              {isCourseDirector && (
                <Link
                  to="/roles"
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-theme-border text-sm font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover inline-flex items-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  পারমিশন সম্পাদনা
                </Link>
              )}
              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-sm font-semibold cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New User / Trainer Registration Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-modal-title"
          onClick={() => {
            if (!isAddLocked) resetAndCloseAddModal();
          }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-theme-elevated border border-theme-border rounded-t-[24px] sm:rounded-2xl shadow-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-theme-border flex items-start justify-between gap-3 shrink-0 bg-theme-elevated">
              <div>
                <h2
                  id="add-user-modal-title"
                  className="text-lg font-bold text-theme-text-primary leading-snug"
                >
                  নতুন ব্যবহারকারী / প্রশিক্ষক নিবন্ধন
                </h2>
                <p className="text-xs text-theme-text-secondary mt-0.5">
                  প্রশিক্ষক হিসেবে প্রতিষ্ঠান ও ব্যাচে নিবন্ধন করুন
                </p>
              </div>
              <button
                type="button"
                disabled={isAddLocked}
                onClick={resetAndCloseAddModal}
                aria-label="বন্ধ করুন"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 rounded-xl text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover flex items-center justify-center cursor-pointer disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            {/* Scrollable Body + Sticky Footer */}
            <form
              noValidate
              onSubmit={handleCreateNewUser}
              className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
              <fieldset
                disabled={isAddLocked || addUserRunner.phase === 'success'}
                className="px-5 sm:px-6 py-4 space-y-4 overflow-y-auto flex-1 min-w-0"
              >
                {addFormErrors.general && (
                  <div
                    role="alert"
                    className="p-3 bg-theme-danger-soft border border-theme-danger-border rounded-xl text-xs text-theme-danger font-medium"
                  >
                    {addFormErrors.general}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="add-user-name"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    পূর্ণ নাম <span className="text-theme-danger">*</span>
                  </label>
                  <input
                    id="add-user-name"
                    ref={addNameInputRef}
                    type="text"
                    placeholder="যেমন: মোঃ কামরুল হাসান"
                    value={addFormData.name}
                    onChange={(e) => {
                      setAddFormData({ ...addFormData, name: e.target.value });
                      if (addFormErrors.name) {
                        setAddFormErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-theme-surface text-theme-text-primary border rounded-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 ${
                      addFormErrors.name
                        ? 'border-theme-danger focus:border-theme-danger'
                        : 'border-theme-border-strong focus:border-theme-primary'
                    }`}
                  />
                  {addFormErrors.name && (
                    <p role="alert" className="text-xs text-theme-danger font-medium mt-1">
                      {addFormErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="add-user-email"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    ইমেইল ঠিকানা <span className="text-theme-danger">*</span>
                  </label>
                  <input
                    id="add-user-email"
                    ref={addEmailInputRef}
                    type="email"
                    placeholder="trainer@bnfe.gov.bd"
                    value={addFormData.email}
                    onChange={(e) => {
                      setAddFormData({ ...addFormData, email: e.target.value });
                      if (addFormErrors.email) {
                        setAddFormErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-theme-surface text-theme-text-primary border rounded-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 ${
                      addFormErrors.email
                        ? 'border-theme-danger focus:border-theme-danger'
                        : 'border-theme-border-strong focus:border-theme-primary'
                    }`}
                  />
                  {addFormErrors.email && (
                    <p role="alert" className="text-xs text-theme-danger font-medium mt-1">
                      {addFormErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="add-user-phone"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    মোবাইল নম্বর <span className="text-theme-danger">*</span>
                  </label>
                  <input
                    id="add-user-phone"
                    ref={addPhoneInputRef}
                    type="tel"
                    inputMode="tel"
                    placeholder="017XXXXXXXX"
                    value={addFormData.phone}
                    onChange={(e) => {
                      setAddFormData({ ...addFormData, phone: e.target.value });
                      if (addFormErrors.phone) {
                        setAddFormErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-theme-surface text-theme-text-primary border rounded-xl text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 ${
                      addFormErrors.phone
                        ? 'border-theme-danger focus:border-theme-danger'
                        : 'border-theme-border-strong focus:border-theme-primary'
                    }`}
                  />
                  {addFormErrors.phone && (
                    <p role="alert" className="text-xs text-theme-danger font-medium mt-1">
                      {addFormErrors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="add-user-role"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    পদবী (Role) <span className="text-theme-danger">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="add-user-role"
                      value={addFormData.role}
                      onChange={(e) => {
                        setAddFormData({
                          ...addFormData,
                          role: e.target.value as UserRole,
                        });
                        if (addFormErrors.batchId) {
                          setAddFormErrors((prev) => ({ ...prev, batchId: undefined }));
                        }
                      }}
                      className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                    >
                      {(isCourseDirector
                        ? roles
                        : roles.filter((r) => r.name === 'Trainer' || r.code === 'trainer')
                      ).map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name === 'Course Director'
                            ? 'অ্যাডমিন / Course Director'
                            : r.name === 'FMA'
                            ? 'সুপারভাইজার / FMA'
                            : r.name === 'Trainer'
                            ? 'প্রশিক্ষক (Trainer)'
                            : `${r.nameBn || r.name} (${r.name})`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={17}
                      strokeWidth={1.8}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                    />
                  </div>
                </div>

                {addFormData.role === 'Trainer' && (
                  <div className="space-y-3.5 p-4 bg-theme-primary-soft/55 rounded-2xl border border-theme-primary-border">
                    <div className="text-xs font-bold text-theme-primary-soft-fg flex items-center gap-1.5">
                      <Building2 size={16} strokeWidth={1.8} />
                      <span>প্রশিক্ষকের ধরন ও ব্যাচ নির্বাচন</span>
                    </div>

                    <div>
                      <label
                        htmlFor="add-trainer-type"
                        className="block text-xs font-bold text-theme-text-primary mb-1.5"
                      >
                        প্রশিক্ষকের ধরন (Trainer Type) <span className="text-theme-danger">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="add-trainer-type"
                          value={addFormData.trainerType}
                          onChange={(e) =>
                            setAddFormData({
                              ...addFormData,
                              trainerType: e.target.value as TrainerType,
                            })
                          }
                          className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm font-semibold text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                        >
                          <option value="Skill Trainer">স্কিল ট্রেইনার (Skill Trainer)</option>
                          <option value="Literacy Trainer">লিটারেসি ট্রেইনার (Literacy Trainer)</option>
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={1.8}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                        />
                      </div>
                      <p className="text-[11px] text-theme-primary-soft-fg mt-1.5 flex items-start gap-1 leading-snug">
                        <Check size={13} strokeWidth={2.4} className="shrink-0 mt-0.5" />
                        <span>
                          {addFormData.trainerType === 'Skill Trainer'
                            ? 'এই প্রশিক্ষক বৃত্তিমূলক ট্রেডের স্কিল মডিউল পরিচালনা করবেন।'
                            : 'এই প্রশিক্ষক সাধারণ শিক্ষা মডিউল পরিচালনা করবেন।'}
                        </span>
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="add-trainer-inst"
                        className="block text-xs font-bold text-theme-text-primary mb-1.5"
                      >
                        প্রতিষ্ঠান
                      </label>
                      <div className="relative">
                        <select
                          id="add-trainer-inst"
                          value={addFormData.instituteId}
                          onChange={(e) => {
                            const newInst = e.target.value;
                            setAddFormData({
                              ...addFormData,
                              instituteId: newInst,
                              batchId: '',
                            });
                          }}
                          className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                        >
                          <option value="">সকল প্রতিষ্ঠান</option>
                          {institutes.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={1.8}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="add-trainer-batch"
                        className="block text-xs font-bold text-theme-text-primary mb-1.5"
                      >
                        নির্ধারিত ব্যাচ (Assigned Batch) <span className="text-theme-danger">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="add-trainer-batch"
                          ref={addBatchSelectRef}
                          value={addFormData.batchId}
                          onChange={(e) => {
                            setAddFormData({ ...addFormData, batchId: e.target.value });
                            if (addFormErrors.batchId) {
                              setAddFormErrors((prev) => ({ ...prev, batchId: undefined }));
                            }
                          }}
                          className={`w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 ${
                            addFormErrors.batchId
                              ? 'border-theme-danger focus:border-theme-danger'
                              : 'border-theme-border-strong focus:border-theme-primary'
                          }`}
                        >
                          <option value="">ব্যাচ নির্বাচন করুন</option>
                          {availableAddBatches.map((b) => {
                            const tradeName = trades.find((t) => t.id === b.tradeId)?.name;
                            return (
                              <option key={b.id} value={b.id}>
                                {b.name} {tradeName ? `(${tradeName})` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={1.8}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                        />
                      </div>
                      {addFormErrors.batchId && (
                        <p role="alert" className="text-xs text-theme-danger font-medium mt-1">
                          {addFormErrors.batchId}
                        </p>
                      )}
                      <p className="text-[11px] text-theme-primary-soft-fg mt-1.5 font-medium flex items-start gap-1 leading-snug">
                        <Check size={13} strokeWidth={2.4} className="shrink-0 mt-0.5" />
                        <span>
                          উপস্থিতি মডিউলে এই প্রশিক্ষক সরাসরি এই ব্যাচের প্রশিক্ষণার্থীদের তালিকা দেখতে পাবেন।
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Sticky Footer */}
              <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 border-t border-theme-border bg-theme-elevated flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={isAddLocked}
                  onClick={resetAndCloseAddModal}
                  className="min-h-[44px] px-4 py-2 border border-theme-border rounded-xl text-sm font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover cursor-pointer disabled:opacity-45 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  {addUserRunner.phase === 'success' ? 'বন্ধ করুন' : 'বাতিল'}
                </button>
                <div className="flex-1 min-w-0">
                  <ActionButton
                    runner={addUserRunner}
                    type="submit"
                    idleLabel="নিবন্ধন সম্পন্ন করুন"
                    popoverTitle="ব্যবহারকারী নিবন্ধন"
                    onBeforeRun={handleBeforeCreateUser}
                    onAutoHide={handleAddSuccessComplete}
                    buttonClassName="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-modal-title"
          onClick={() => {
            if (!isEditLocked) setIsEditModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-theme-elevated border border-theme-border rounded-t-[24px] sm:rounded-2xl shadow-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-theme-border flex items-start justify-between gap-3 shrink-0 bg-theme-elevated">
              <div>
                <h2
                  id="edit-user-modal-title"
                  className="text-lg font-bold text-theme-text-primary leading-snug"
                >
                  ব্যবহারকারী ও ব্যাচ সম্পাদন
                </h2>
                <p className="text-xs text-theme-text-secondary mt-0.5">
                  প্রশিক্ষকের প্রতিষ্ঠান ও নির্ধারিত ব্যাচ আপডেট করুন
                </p>
              </div>
              <button
                type="button"
                disabled={isEditLocked}
                onClick={() => setIsEditModalOpen(false)}
                aria-label="বন্ধ করুন"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 rounded-xl text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-hover flex items-center justify-center cursor-pointer disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            {/* Scrollable Body + Sticky Footer */}
            <form
              noValidate
              onSubmit={handleUpdate}
              className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
              <fieldset
                disabled={isEditLocked || editUserRunner.phase === 'success'}
                className="px-5 sm:px-6 py-4 space-y-4 overflow-y-auto flex-1 min-w-0"
              >
                {editingUser?.id === userProfile?.id && (
                  <div className="p-3 bg-theme-warning-soft border border-theme-warning-border rounded-xl text-xs text-theme-warning flex items-center gap-2">
                    <AlertTriangle size={16} strokeWidth={1.8} className="shrink-0" />
                    <span>
                      নিরাপত্তা নীতি: আপনি নিজের পদবী বা অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করতে পারবেন না।
                    </span>
                  </div>
                )}

                {editFormErrors.general && (
                  <div
                    role="alert"
                    className="p-3 bg-theme-danger-soft border border-theme-danger-border rounded-xl text-xs text-theme-danger font-medium"
                  >
                    {editFormErrors.general}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="edit-user-name"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    নাম <span className="text-theme-danger">*</span>
                  </label>
                  <input
                    id="edit-user-name"
                    ref={editNameInputRef}
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, name: e.target.value });
                      if (editFormErrors.name) {
                        setEditFormErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-theme-surface text-theme-text-primary border rounded-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 ${
                      editFormErrors.name
                        ? 'border-theme-danger focus:border-theme-danger'
                        : 'border-theme-border-strong focus:border-theme-primary'
                    }`}
                  />
                  {editFormErrors.name && (
                    <p role="alert" className="text-xs text-theme-danger font-medium mt-1">
                      {editFormErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="edit-user-email"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    ইমেইল (Read-only)
                  </label>
                  <input
                    id="edit-user-email"
                    type="email"
                    readOnly
                    value={editFormData.email}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-theme-surface-subtle border border-theme-border rounded-xl text-sm font-mono text-theme-text-secondary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-user-phone"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    মোবাইল নম্বর <span className="text-theme-danger">*</span>
                  </label>
                  <input
                    id="edit-user-phone"
                    ref={editPhoneInputRef}
                    type="tel"
                    inputMode="tel"
                    value={editFormData.phone}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, phone: e.target.value });
                      if (editFormErrors.phone) {
                        setEditFormErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-theme-surface text-theme-text-primary border rounded-xl text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30 ${
                      editFormErrors.phone
                        ? 'border-theme-danger focus:border-theme-danger'
                        : 'border-theme-border-strong focus:border-theme-primary'
                    }`}
                  />
                  {editFormErrors.phone && (
                    <p role="alert" className="text-xs text-theme-danger font-medium mt-1">
                      {editFormErrors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="edit-user-role"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    পদবী (Role)
                  </label>
                  <div className="relative">
                    <select
                      id="edit-user-role"
                      value={editFormData.role}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, role: e.target.value as UserRole })
                      }
                      disabled={!isCourseDirector || editingUser?.id === userProfile?.id}
                      className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap disabled:bg-theme-surface-subtle disabled:text-theme-text-muted cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                    >
                      {(editFormData.role === 'Pending' ||
                        !roles.some((r) => r.name === editFormData.role)) && (
                        <option value={editFormData.role || 'Pending'}>
                          অপেক্ষমাণ (Pending - পদবী নির্বাচন করুন)
                        </option>
                      )}
                      {roles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name} ({r.nameBn || r.name})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={17}
                      strokeWidth={1.8}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                    />
                  </div>
                </div>

                {editFormData.role === 'Trainer' && (
                  <div className="space-y-3.5 p-4 bg-theme-primary-soft/55 rounded-2xl border border-theme-primary-border">
                    <div className="text-xs font-bold text-theme-primary-soft-fg flex items-center gap-1.5">
                      <Building2 size={16} strokeWidth={1.8} />
                      <span>প্রশিক্ষকের ধরন ও ব্যাচ অ্যাসাইনমেন্ট</span>
                    </div>

                    <div>
                      <label
                        htmlFor="edit-trainer-type"
                        className="block text-xs font-bold text-theme-text-primary mb-1.5"
                      >
                        প্রশিক্ষকের ধরন (Trainer Type)
                      </label>
                      <div className="relative">
                        <select
                          id="edit-trainer-type"
                          value={editFormData.trainerType}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              trainerType: e.target.value as TrainerType,
                            })
                          }
                          className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm font-semibold text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                        >
                          <option value="Skill Trainer">স্কিল ট্রেইনার (Skill Trainer)</option>
                          <option value="Literacy Trainer">লিটারেসি ট্রেইনার (Literacy Trainer)</option>
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={1.8}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="edit-trainer-inst"
                        className="block text-xs font-bold text-theme-text-primary mb-1.5"
                      >
                        সংযুক্ত প্রতিষ্ঠান
                      </label>
                      <div className="relative">
                        <select
                          id="edit-trainer-inst"
                          value={editFormData.instituteId}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              instituteId: e.target.value,
                              batchId: '',
                            })
                          }
                          className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                        >
                          <option value="">কোনোটিই নয় (Unassigned)</option>
                          {institutes.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={1.8}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="edit-trainer-batch"
                        className="block text-xs font-bold text-theme-text-primary mb-1.5"
                      >
                        নির্ধারিত ব্যাচ (Assigned Batch)
                      </label>
                      <div className="relative">
                        <select
                          id="edit-trainer-batch"
                          value={editFormData.batchId}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, batchId: e.target.value })
                          }
                          className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                        >
                          <option value="">ব্যাচ নির্বাচন করুন (Unassigned)</option>
                          {availableEditBatches.map((b) => {
                            const tradeName = trades.find((t) => t.id === b.tradeId)?.name;
                            return (
                              <option key={b.id} value={b.id}>
                                {b.name} {tradeName ? `(${tradeName})` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={1.8}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="edit-user-status"
                    className="block text-xs font-bold text-theme-text-primary mb-1.5"
                  >
                    অ্যাকাউন্ট স্ট্যাটাস
                  </label>
                  <div className="relative">
                    <select
                      id="edit-user-status"
                      value={editFormData.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value as
                          | 'Active'
                          | 'Inactive'
                          | 'Pending Approval';
                        setEditFormData((prev) => ({
                          ...prev,
                          status: nextStatus,
                          role:
                            nextStatus === 'Active' &&
                            (prev.role === 'Pending' || !prev.role)
                              ? 'Trainer'
                              : prev.role,
                        }));
                      }}
                      disabled={!isCourseDirector || editingUser?.id === userProfile?.id}
                      className="w-full min-h-[44px] appearance-none pl-3.5 pr-10 py-2 bg-theme-surface text-theme-text-primary border border-theme-border-strong rounded-xl text-sm text-ellipsis overflow-hidden whitespace-nowrap disabled:bg-theme-surface-subtle disabled:text-theme-text-muted cursor-pointer focus:border-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
                    >
                      <option value="Active">সক্রিয় (Active)</option>
                      <option value="Pending Approval">
                        অনুমোদনের অপেক্ষায় (Pending Approval)
                      </option>
                      <option value="Inactive">নিষ্ক্রিয় (Inactive)</option>
                    </select>
                    <ChevronDown
                      size={17}
                      strokeWidth={1.8}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Sticky Footer */}
              <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 border-t border-theme-border bg-theme-elevated flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={isEditLocked}
                  onClick={() => setIsEditModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 border border-theme-border rounded-xl text-sm font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover cursor-pointer disabled:opacity-45 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  {editUserRunner.phase === 'success' ? 'বন্ধ করুন' : 'বাতিল'}
                </button>
                <div className="flex-1 min-w-0">
                  <ActionButton
                    runner={editUserRunner}
                    type="submit"
                    idleLabel="আপডেট সংরক্ষণ করুন"
                    popoverTitle="ব্যবহারকারী আপডেট"
                    onBeforeRun={handleBeforeUpdate}
                    onAutoHide={() => setIsEditModalOpen(false)}
                    buttonClassName="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
