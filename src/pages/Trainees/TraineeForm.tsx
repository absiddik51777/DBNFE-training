import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { logActivity } from '../../lib/firebase';
import { Institute, Trade, Batch, Trainee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { ArrowLeft, Save, User, GraduationCap, Building2, Phone, Calendar, AlertCircle, ShieldAlert, CheckCircle2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../../lib/dataService';
import { FormSkeleton } from '../../components/Skeleton';

const TraineeForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preselectedBatchId = searchParams.get('batchId') || '';
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();

  const returnPage = searchParams.get('returnPage') || sessionStorage.getItem('bnfe_trainee_return_page') || '1';
  const returnScroll = searchParams.get('returnScroll') || sessionStorage.getItem('bnfe_trainee_return_scroll') || '0';

  const handleReturn = () => {
    navigate(`/trainees?page=${returnPage}&scroll=${returnScroll}`);
  };

  const canPerformAction = id ? hasPermission('edit_trainee') : hasPermission('create_trainee');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [formData, setFormData] = useState<Partial<Trainee>>({
    traineeId: '',
    registrationNumber: '',
    nameEn: '',
    nameBn: '',
    fatherNameEn: '',
    fatherNameBn: '',
    motherNameEn: '',
    motherNameBn: '',
    dateOfBirth: '2008-01-01',
    gender: 'Male',
    nidOrBirthRegistration: '',
    mobileNumber: '',
    address: '',
    permanentAddress: '',
    presentAddress: '',
    sameAsPermanentAddress: false,
    lastClassCompleted: 'Class 7 (৭ম শ্রেণি)',
    previousSchoolName: '',
    yearOfDropout: '2023',
    reasonForDropout: 'আর্থিক অসচ্ছলতা ও পারিবারিক সমস্যা',
    instituteId: userProfile?.instituteId || '',
    tradeId: '',
    batchId: '',
    admissionDate: Date.now(),
    trainingStartDate: Date.now(),
    trainingEndDate: Date.now() + 180 * 24 * 60 * 60 * 1000,
    status: 'Active',
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [instList, trdList, btcList, traineesList] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees')
      ]);

      setInstitutes(instList);
      setTrades(trdList);
      setBatches(btcList);

      if (id) {
        const found = traineesList.find(t => t.id === id);
        if (found) {
          const perm = found.permanentAddress || found.address || '';
          const pres = found.presentAddress || found.address || '';
          const same = found.sameAsPermanentAddress ?? (perm === pres && perm.length > 0);
          const foundBatch = btcList.find(b => b.id === found.batchId);
          // Hydrate with fallback for older records that may only have single fatherName / motherName
          const fNameBn = found.fatherNameBn || (found as any).fatherName || '';
          const fNameEn = found.fatherNameEn || (found as any).fatherName || '';
          const mNameBn = found.motherNameBn || (found as any).motherName || '';
          const mNameEn = found.motherNameEn || (found as any).motherName || '';

          setFormData({
            ...found,
            fatherNameBn: fNameBn,
            fatherNameEn: fNameEn,
            motherNameBn: mNameBn,
            motherNameEn: mNameEn,
            permanentAddress: perm,
            presentAddress: pres,
            sameAsPermanentAddress: same,
            instituteId: found.instituteId || foundBatch?.instituteId || '',
            tradeId: found.tradeId || foundBatch?.tradeId || '',
          });
        } else {
          setError('প্রশিক্ষণার্থী পাওয়া যায়নি।');
        }
      } else {
        // Auto-generate Trainee ID sequentially (TR-1001, TR-1002, ...)
        const existingNumbers = traineesList
          .map(t => {
            const match = t.traineeId?.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          })
          .filter(n => !isNaN(n) && n > 0);

        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 1000;
        const nextIdNumber = maxNumber >= 1000 ? maxNumber + 1 : 1001;
        const autoTraineeId = `TR-${nextIdNumber}`;

        const assignedBatchId = preselectedBatchId || (userProfile?.role === 'Trainer' && userProfile?.batchId) || btcList[0]?.id || '';
        const assignedBatchObj = btcList.find(b => b.id === assignedBatchId);
        const assignedTrade = assignedBatchObj?.tradeId || '';
        const assignedInst = assignedBatchObj?.instituteId || userProfile?.instituteId || '';

        setFormData(prev => ({
          ...prev,
          traineeId: autoTraineeId,
          registrationNumber: '',
          permanentAddress: '',
          presentAddress: '',
          sameAsPermanentAddress: false,
          instituteId: assignedInst,
          tradeId: assignedTrade,
          batchId: assignedBatchId,
          trainingStartDate: assignedBatchObj?.startDate ? new Date(assignedBatchObj.startDate).getTime() : Date.now(),
          trainingEndDate: assignedBatchObj?.endDate ? new Date(assignedBatchObj.endDate).getTime() : (Date.now() + 180 * 86400000),
        }));
      }
    } catch (err) {
      console.warn("Notice fetching data for trainee form:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === formData.batchId);
  }, [batches, formData.batchId]);

  const selectedTrade = useMemo(() => {
    const trdId = selectedBatch?.tradeId || formData.tradeId;
    return trades.find(t => t.id === trdId);
  }, [trades, selectedBatch, formData.tradeId]);

  const selectedInstitute = useMemo(() => {
    const instId = selectedBatch?.instituteId || formData.instituteId;
    return institutes.find(i => i.id === instId);
  }, [institutes, selectedBatch, formData.instituteId]);

  const handleBatchSelect = (batchId: string) => {
    const targetBatch = batches.find(b => b.id === batchId);
    setFormData(prev => ({
      ...prev,
      batchId,
      tradeId: targetBatch?.tradeId || '',
      instituteId: targetBatch?.instituteId || '',
      trainingStartDate: targetBatch?.startDate ? new Date(targetBatch.startDate).getTime() : prev.trainingStartDate,
      trainingEndDate: targetBatch?.endDate ? new Date(targetBatch.endDate).getTime() : prev.trainingEndDate,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper regex tests
  const hasEnglish = (text: string) => /[a-zA-Z]/.test(text);
  const hasBengali = (text: string) => /[\u0980-\u09FF]/.test(text);

  // Bengali-only input handler: rejects English letters
  const handleBengaliChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (hasEnglish(value)) {
      // Strip English letters
      const sanitized = value.replace(/[a-zA-Z]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      setFieldWarnings(prev => ({
        ...prev,
        [name]: 'বাংলা ফিল্ডে ইংরেজি অক্ষর লেখা যাবে না (ইংরেজি বর্ণ স্বয়ংক্রিয়ভাবে বর্জন করা হয়েছে)।'
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      setFieldWarnings(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  // English-only input handler: rejects Bengali characters
  const handleEnglishChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (hasBengali(value)) {
      // Strip Bengali characters
      const sanitized = value.replace(/[\u0980-\u09FF]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      setFieldWarnings(prev => ({
        ...prev,
        [name]: 'ইংরেজি ফিল্ডে বাংলা অক্ষর লেখা যাবে না (বাংলা বর্ণ স্বয়ংক্রিয়ভাবে বর্জন করা হয়েছে)।'
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      setFieldWarnings(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handlePermanentAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      permanentAddress: value,
      presentAddress: prev.sameAsPermanentAddress ? value : prev.presentAddress,
      address: prev.sameAsPermanentAddress ? value : (prev.presentAddress || value)
    }));
  };

  const handlePresentAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      presentAddress: value,
      sameAsPermanentAddress: false,
      address: value || prev.permanentAddress || ''
    }));
  };

  const handleSameAddressToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setFormData(prev => {
      const perm = prev.permanentAddress || '';
      return {
        ...prev,
        sameAsPermanentAddress: isChecked,
        presentAddress: isChecked ? perm : prev.presentAddress,
        address: isChecked ? perm : (prev.presentAddress || perm)
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const regNo = formData.registrationNumber?.trim() || '';

    const traineeIdVal = formData.traineeId?.trim() || '';
    if (!traineeIdVal) {
      setError('প্রশিক্ষণার্থী আইডি (Trainee ID) প্রদান করুন।');
      return;
    }

    if (!formData.nameBn?.trim()) {
      setError('শিক্ষার্থীর নাম বাংলায় প্রদান করুন।');
      return;
    }
    if (!formData.nameEn?.trim()) {
      setError('শিক্ষার্থীর নাম ইংরেজিতে প্রদান করুন।');
      return;
    }
    if (hasEnglish(formData.nameBn)) {
      setError('শিক্ষার্থীর বাংলা নামের ফিল্ডে কোনো ইংরেজি অক্ষর থাকা যাবে না।');
      return;
    }
    if (hasBengali(formData.nameEn)) {
      setError('শিক্ষার্থীর ইংরেজি নামের ফিল্ডে কোনো বাংলা অক্ষর থাকা যাবে না।');
      return;
    }

    if (!formData.fatherNameBn?.trim()) {
      setError('পিতার নাম বাংলায় প্রদান করুন।');
      return;
    }
    if (!formData.fatherNameEn?.trim()) {
      setError('পিতার নাম ইংরেজিতে প্রদান করুন।');
      return;
    }
    if (hasEnglish(formData.fatherNameBn)) {
      setError('পিতার বাংলা নামের ফিল্ডে কোনো ইংরেজি অক্ষর থাকা যাবে না।');
      return;
    }
    if (hasBengali(formData.fatherNameEn)) {
      setError('পিতার ইংরেজি নামের ফিল্ডে কোনো বাংলা অক্ষর থাকা যাবে না।');
      return;
    }

    if (!formData.motherNameBn?.trim()) {
      setError('মাতার নাম বাংলায় প্রদান করুন।');
      return;
    }
    if (!formData.motherNameEn?.trim()) {
      setError('মাতার নাম ইংরেজিতে প্রদান করুন।');
      return;
    }
    if (hasEnglish(formData.motherNameBn)) {
      setError('মাতার বাংলা নামের ফিল্ডে কোনো ইংরেজি অক্ষর থাকা যাবে না।');
      return;
    }
    if (hasBengali(formData.motherNameEn)) {
      setError('মাতার ইংরেজি নামের ফিল্ডে কোনো বাংলা অক্ষর থাকা যাবে না।');
      return;
    }

    if (!formData.mobileNumber || formData.mobileNumber.length < 11) {
      setError('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (!formData.batchId) {
      setError('প্রশিক্ষণার্থীর জন্য অবশ্যই একটি প্রশিক্ষণ ব্যাচ নির্বাচন করতে হবে।');
      return;
    }

    if (userProfile?.role === 'Trainer' && userProfile.batchId && formData.batchId !== userProfile.batchId) {
      setError('অননুমোদিত পদক্ষেপ: প্রশিক্ষক শুধুমাত্র তাঁর নির্ধারিত ব্যাচে প্রশিক্ষণার্থী যোগ বা সম্পাদনা করতে পারবেন।');
      return;
    }

    const targetBatch = batches.find(b => b.id === formData.batchId);
    if (!targetBatch) {
      setError('নির্বাচিত ব্যাচটি ডাটাবেজে পাওয়া যায়নি। অনুগ্রহ করে একটি বৈধ ব্যাচ নির্বাচন করুন।');
      return;
    }

    // Automatically resolve instituteId and tradeId directly from the selected batch
    const resolvedTradeId = targetBatch.tradeId || formData.tradeId || '';
    const resolvedInstituteId = targetBatch.instituteId || formData.instituteId || '';

    if (!formData.permanentAddress?.trim() && !formData.address?.trim()) {
      setError('স্থায়ী ঠিকানা পূরণ করুন।');
      return;
    }

    if (!formData.presentAddress?.trim() && !formData.sameAsPermanentAddress && !formData.address?.trim()) {
      setError('বর্তমান ঠিকানা পূরণ করুন অথবা "স্থায়ী ঠিকানার অনুরূপ" নির্বাচন করুন।');
      return;
    }

    setSaving(true);
    try {
      // 1. Uniqueness check for Registration Number (if provided)
      if (regNo) {
        const isRegTaken = await dataService.isRegistrationNumberTaken(regNo, id);
        if (isRegTaken) {
          setError(`রেজিস্ট্রেশন নম্বরটি ('${regNo}') ইতোমধ্যে অন্য শিক্ষার্থীর জন্য ব্যবহৃত হয়েছে। ভিন্ন বা ইউনিক রেজিস্ট্রেশন নম্বর প্রদান করুন।`);
          setSaving(false);
          return;
        }
      }

      // 2. Uniqueness check for Trainee ID
      const isIdTaken = await dataService.isTraineeIdTaken(traineeIdVal, id);
      if (isIdTaken) {
        setError(`প্রশিক্ষণার্থী আইডি ('${traineeIdVal}') ইতোমধ্যে ডাটাবেজে বিদ্যমান। ইউনিক আইডি ব্যবহার করুন।`);
        setSaving(false);
        return;
      }

      // 3. Duplicate Enrollment check (NID / Birth Cert & Mobile)
      const duplicateCheck = await dataService.checkDuplicateTrainee(
        formData.nidOrBirthRegistration || '',
        formData.mobileNumber || '',
        id
      );
      if (duplicateCheck.isDuplicate) {
        setError(duplicateCheck.reason || 'এই শিক্ষার্থীর তথ্য দিয়ে ইতোমধ্যে অন্য একটি ব্যাচে ভর্তি রয়েছে।');
        setSaving(false);
        return;
      }

      // 4. Batch Capacity check (enforce max capacity)
      if (!id || (id && formData.batchId !== targetBatch?.id)) {
        const capacityCheck = await dataService.checkBatchCapacity(formData.batchId, id);
        if (capacityCheck.isFull) {
          setError(`নির্বাচিত ব্যাচের ধারণক্ষমতা (${capacityCheck.maxCapacity} জন) পূর্ণ হয়ে গেছে। অন্য ব্যাচ নির্বাচন করুন।`);
          setSaving(false);
          return;
        }
      }
      const traineeIdToSave = id || `TRN-${Date.now().toString().slice(-5)}`;
      const permAddr = formData.permanentAddress?.trim() || formData.address?.trim() || '';
      const presAddr = formData.sameAsPermanentAddress ? permAddr : (formData.presentAddress?.trim() || permAddr);

      const savedTrainee: Trainee = {
        id: traineeIdToSave,
        traineeId: formData.traineeId || `TR-${Date.now().toString().slice(-4)}`,
        registrationNumber: (formData.registrationNumber || '').trim(),
        nameEn: formData.nameEn || '',
        nameBn: formData.nameBn || '',
        fatherNameEn: formData.fatherNameEn || '',
        fatherNameBn: formData.fatherNameBn || '',
        motherNameEn: formData.motherNameEn || '',
        motherNameBn: formData.motherNameBn || '',
        dateOfBirth: formData.dateOfBirth || '2008-01-01',
        gender: (formData.gender as any) || 'Male',
        nidOrBirthRegistration: formData.nidOrBirthRegistration || '',
        mobileNumber: formData.mobileNumber || '',
        address: presAddr || permAddr,
        permanentAddress: permAddr,
        presentAddress: presAddr,
        sameAsPermanentAddress: !!formData.sameAsPermanentAddress,
        photoUrl: formData.photoUrl || '',
        lastClassCompleted: formData.lastClassCompleted || '',
        previousSchoolName: formData.previousSchoolName || '',
        yearOfDropout: formData.yearOfDropout || '',
        reasonForDropout: formData.reasonForDropout || '',
        instituteId: resolvedInstituteId,
        tradeId: resolvedTradeId,
        batchId: formData.batchId || '',
        admissionDate: formData.admissionDate || Date.now(),
        trainingStartDate: formData.trainingStartDate || (targetBatch?.startDate ? new Date(targetBatch.startDate).getTime() : Date.now()),
        trainingEndDate: formData.trainingEndDate || (targetBatch?.endDate ? new Date(targetBatch.endDate).getTime() : (Date.now() + 180 * 86400000)),
        status: (formData.status as any) || 'Active',
        createdAt: id ? (formData.createdAt || Date.now()) : Date.now(),
      };

      await dataService.saveItem('trainees', savedTrainee);

      logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        id ? `প্রশিক্ষণার্থী তথ্য আপডেট: ${formData.nameEn}` : `নতুন শিক্ষার্থী নিবন্ধন: ${formData.nameEn} (${formData.registrationNumber})`,
        'Trainees',
        traineeIdToSave
      );

      handleReturn();
    } catch (err: any) {
      console.warn("Notice saving trainee:", err);
      setError('তথ্য সংরক্ষণ সম্পন্ন করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const availableBatches = useMemo(() => {
    return batches.filter(
      b => userProfile?.role !== 'Trainer' || !userProfile?.batchId || b.id === userProfile.batchId
    );
  }, [batches, userProfile]);

  if (loading) {
    return (
      <div className="py-6">
        <FormSkeleton sections={3} />
      </div>
    );
  }

  if (!canPerformAction) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-red-200 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-800">অনুমতি নেই (Permission Denied)</h2>
        <p className="text-sm text-slate-600">
          আপনার বর্তমান রোলের অধীনে প্রশিক্ষণার্থী {id ? 'সম্পাদনা' : 'নিবন্ধন'} করার অনুমতি নেই।
        </p>
        <button
          onClick={handleReturn}
          className="inline-flex items-center px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition"
        >
          প্রশিক্ষণার্থী তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Back button and page title */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={handleReturn}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {id ? 'প্রশিক্ষণার্থী তথ্য সম্পাদনা (Edit Trainee)' : 'নতুন প্রশিক্ষণার্থী নিবন্ধন (Trainee Registration)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            অষ্টম শ্রেণির পূর্বে ড্রপআউট শিক্ষার্থীদের বৃত্তিমূলক প্রশিক্ষণ ফর্ম
          </p>
        </div>
      </div>

      {!id && (
        <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center space-x-3 text-teal-950">
            <div className="p-2 bg-teal-600 text-white rounded-xl shrink-0 shadow-2xs">
              <Upload size={16} />
            </div>
            <div>
              <strong className="text-sm font-bold block">একসাথে একাধিক শিক্ষার্থীর তথ্য আপলোড করতে চান?</strong>
              <p className="text-teal-700 mt-0.5">এক্সেল (.xlsx) বা সিএসভি (.csv) স্প্রেডশিটের মাধ্যমে এক ক্লিকে বাল্ক ইনপুট সম্পন্ন করুন।</p>
            </div>
          </div>
          <Link
            to="/trainees"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl transition shadow-2xs shrink-0 self-start sm:self-auto flex items-center space-x-1.5"
          >
            <span>বাল্ক আপলোড করুন</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start space-x-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Official & Training Details */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Building2 className="text-emerald-600" size={20} />
            <h2 className="font-bold text-slate-800 text-base">১. প্রাতিষ্ঠানিক ও ভর্তি তথ্য (Official Training Info)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                প্রশিক্ষণার্থী আইডি (Trainee ID - Auto)
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={formData.traineeId}
                  className="w-full px-3 py-2 bg-emerald-50/70 border border-emerald-200 rounded-xl text-sm font-mono text-emerald-800 font-semibold focus:outline-none"
                />
                <span className="absolute right-2.5 top-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-sans font-medium">
                  স্বয়ংক্রিয়
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">আইডি স্বয়ংক্রিয়ভাবে নির্ধারিত</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  রেজিস্ট্রেশন নম্বর (Registration No)
                </label>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                  ঐচ্ছিক / পরবর্তীতে আপডেটযোগ্য
                </span>
              </div>
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber || ''}
                onChange={handleChange}
                placeholder="যেমন: REG-10025 (প্রাথমিক পর্যায়ে ফাঁকা রাখা যাবে)"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                প্রাথমিক ভর্তির সময় এটি ফাঁকা রাখা যাবে। রেজিস্ট্রেশন প্রক্রিয়া সম্পন্ন হলে পরবর্তীতে ইউনিক নম্বর হিসেবে আপডেট করা যাবে।
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">বর্তমান স্ট্যাটাস (Status)</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="Active">সক্রিয় (Active)</option>
                <option value="Completed">সম্পন্ন (Completed)</option>
                <option value="Dropped Out">ঝরে পড়া (Dropped Out)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">প্রশিক্ষণার্থী ভর্তি স্ট্যাটাস</p>
            </div>

            {/* Batch Selection (Single primary enrollment field) */}
            <div className="sm:col-span-2 lg:col-span-3 pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  প্রশিক্ষণ ব্যাচ নির্বাচন (Enrollment Batch) *
                </label>
                {batches.length === 0 && (
                  <Link to="/batches" className="text-xs text-emerald-700 font-semibold hover:underline">
                    + নতুন ব্যাচ তৈরি করুন
                  </Link>
                )}
              </div>
              <select
                required
                name="batchId"
                value={formData.batchId}
                onChange={e => handleBatchSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer bg-white"
              >
                <option value="">-- ব্যাচ নির্বাচন করুন --</option>
                {availableBatches.map(b => {
                  const bTrade = trades.find(t => t.id === b.tradeId);
                  const bInst = institutes.find(i => i.id === b.instituteId);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.batchCode || b.id}){bTrade ? ` • ট্রেড: ${bTrade.name}` : ''}{bInst ? ` • কেন্দ্র: ${bInst.name}` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                একজন শিক্ষার্থী মূলত একটি ব্যাচের অধীন নিবন্ধিত হয়। আলাদাভাবে প্রতিষ্ঠান ও ট্রেড নির্বাচন করার প্রয়োজন নেই; নির্বাচিত ব্যাচের ডাটা হতে প্রতিষ্ঠান ও ট্রেড স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।
              </p>
            </div>

            {/* Auto-resolved Batch Details Info Banner */}
            {selectedBatch && (
              <div className="sm:col-span-2 lg:col-span-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl animate-fadeIn space-y-2.5">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                    <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                    <span>নির্বাচিত ব্যাচ হতে স্বয়ংক্রিয়ভাবে নির্ধারিত তথ্য (Auto-linked Details):</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    কোড: {selectedBatch.batchCode || selectedBatch.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/80 p-3 rounded-xl border border-emerald-200/60">
                    <span className="text-[11px] text-slate-500 block flex items-center space-x-1">
                      <GraduationCap size={13} className="text-emerald-700" />
                      <span>বৃত্তিমূলক ট্রেড (Trade):</span>
                    </span>
                    <strong className="text-slate-800 text-xs mt-1 block">
                      {selectedTrade ? `${selectedTrade.name} (${selectedTrade.code || ''})` : (selectedBatch.tradeId ? `ট্রেড আইডি: ${selectedBatch.tradeId}` : 'ব্যাচে ট্রেড বরাদ্দ নেই')}
                    </strong>
                  </div>

                  <div className="bg-white/80 p-3 rounded-xl border border-emerald-200/60">
                    <span className="text-[11px] text-slate-500 block flex items-center space-x-1">
                      <Building2 size={13} className="text-emerald-700" />
                      <span>প্রশিক্ষণ কেন্দ্র (প্রতিষ্ঠান):</span>
                    </span>
                    <strong className="text-slate-800 text-xs mt-1 block">
                      {selectedInstitute ? `${selectedInstitute.name} (${selectedInstitute.code || selectedInstitute.id})` : (selectedBatch.instituteId ? `প্রতিষ্ঠান আইডি: ${selectedBatch.instituteId}` : 'ব্যাচে প্রতিষ্ঠান বরাদ্দ নেই')}
                    </strong>
                  </div>

                  <div className="bg-white/80 p-3 rounded-xl border border-emerald-200/60">
                    <span className="text-[11px] text-slate-500 block flex items-center space-x-1">
                      <Calendar size={13} className="text-emerald-700" />
                      <span>অর্থবছর ও ধারণক্ষমতা:</span>
                    </span>
                    <strong className="text-slate-800 text-xs mt-1 block">
                      {selectedBatch.fiscalYear || '২০২৫-২০২৬'} • আসন: {selectedBatch.maxTrainees || 30} জন
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Personal Details */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <User className="text-blue-600" size={20} />
            <h2 className="font-bold text-slate-800 text-base">২. শিক্ষার্থীর ব্যক্তিগত তথ্য (Personal Information)</h2>
          </div>

          {/* Dual Inputs (Bootstrap Multiple Inputs style) for Name, Father Name, Mother Name */}
          <div className="space-y-4">
            {/* 1. Trainee Full Name Dual Inputs Group */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  ১. শিক্ষার্থীর পূর্ণ নাম (Trainee Full Name) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">বাংলা ও ইংরেজি উভয় আবশ্যক</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 bg-slate-50/70 border border-slate-200/90 rounded-2xl">
                {/* Bangla Name */}
                <div>
                  <div className="flex rounded-xl shadow-2xs border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-white overflow-hidden transition">
                    <span className="inline-flex items-center px-3 text-xs font-semibold bg-emerald-50 text-emerald-800 border-r border-slate-200 shrink-0 select-none">
                      বাংলা
                    </span>
                    <input
                      required
                      type="text"
                      name="nameBn"
                      value={formData.nameBn || ''}
                      onChange={handleBengaliChange}
                      placeholder="বাংলায় নাম লিখুন (যেমন: মোঃ শাকিল আহমেদ)"
                      className="w-full px-3 py-2 text-sm text-slate-800 focus:outline-none bg-transparent"
                    />
                  </div>
                  {fieldWarnings.nameBn && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldWarnings.nameBn}</span>
                    </p>
                  )}
                </div>

                {/* English Name */}
                <div>
                  <div className="flex rounded-xl shadow-2xs border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white overflow-hidden transition">
                    <span className="inline-flex items-center px-3 text-xs font-semibold bg-blue-50 text-blue-800 border-r border-slate-200 shrink-0 select-none">
                      English
                    </span>
                    <input
                      required
                      type="text"
                      name="nameEn"
                      value={formData.nameEn || ''}
                      onChange={handleEnglishChange}
                      placeholder="Enter name in English (e.g. Md. Shakil Ahmed)"
                      className="w-full px-3 py-2 text-sm text-slate-800 focus:outline-none bg-transparent font-sans"
                    />
                  </div>
                  {fieldWarnings.nameEn && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldWarnings.nameEn}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Father's Name Dual Inputs Group */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  ২. পিতার নাম (Father's Name) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">বাংলা ও ইংরেজি উভয় আবশ্যক</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 bg-slate-50/70 border border-slate-200/90 rounded-2xl">
                {/* Bangla Father Name */}
                <div>
                  <div className="flex rounded-xl shadow-2xs border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-white overflow-hidden transition">
                    <span className="inline-flex items-center px-3 text-xs font-semibold bg-emerald-50 text-emerald-800 border-r border-slate-200 shrink-0 select-none">
                      বাংলা
                    </span>
                    <input
                      required
                      type="text"
                      name="fatherNameBn"
                      value={formData.fatherNameBn || ''}
                      onChange={handleBengaliChange}
                      placeholder="বাংলায় পিতার নাম লিখুন (যেমন: মোঃ রফিকুল ইসলাম)"
                      className="w-full px-3 py-2 text-sm text-slate-800 focus:outline-none bg-transparent"
                    />
                  </div>
                  {fieldWarnings.fatherNameBn && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldWarnings.fatherNameBn}</span>
                    </p>
                  )}
                </div>

                {/* English Father Name */}
                <div>
                  <div className="flex rounded-xl shadow-2xs border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white overflow-hidden transition">
                    <span className="inline-flex items-center px-3 text-xs font-semibold bg-blue-50 text-blue-800 border-r border-slate-200 shrink-0 select-none">
                      English
                    </span>
                    <input
                      required
                      type="text"
                      name="fatherNameEn"
                      value={formData.fatherNameEn || ''}
                      onChange={handleEnglishChange}
                      placeholder="Enter father's name in English (e.g. Md. Rafiqul Islam)"
                      className="w-full px-3 py-2 text-sm text-slate-800 focus:outline-none bg-transparent font-sans"
                    />
                  </div>
                  {fieldWarnings.fatherNameEn && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldWarnings.fatherNameEn}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Mother's Name Dual Inputs Group */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  ৩. মাতার নাম (Mother's Name) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">বাংলা ও ইংরেজি উভয় আবশ্যক</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 bg-slate-50/70 border border-slate-200/90 rounded-2xl">
                {/* Bangla Mother Name */}
                <div>
                  <div className="flex rounded-xl shadow-2xs border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-white overflow-hidden transition">
                    <span className="inline-flex items-center px-3 text-xs font-semibold bg-emerald-50 text-emerald-800 border-r border-slate-200 shrink-0 select-none">
                      বাংলা
                    </span>
                    <input
                      required
                      type="text"
                      name="motherNameBn"
                      value={formData.motherNameBn || ''}
                      onChange={handleBengaliChange}
                      placeholder="বাংলায় মাতার নাম লিখুন (যেমন: মোসাঃ রহিমা বেগম)"
                      className="w-full px-3 py-2 text-sm text-slate-800 focus:outline-none bg-transparent"
                    />
                  </div>
                  {fieldWarnings.motherNameBn && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldWarnings.motherNameBn}</span>
                    </p>
                  )}
                </div>

                {/* English Mother Name */}
                <div>
                  <div className="flex rounded-xl shadow-2xs border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white overflow-hidden transition">
                    <span className="inline-flex items-center px-3 text-xs font-semibold bg-blue-50 text-blue-800 border-r border-slate-200 shrink-0 select-none">
                      English
                    </span>
                    <input
                      required
                      type="text"
                      name="motherNameEn"
                      value={formData.motherNameEn || ''}
                      onChange={handleEnglishChange}
                      placeholder="Enter mother's name in English (e.g. Mst. Rahima Begum)"
                      className="w-full px-3 py-2 text-sm text-slate-800 focus:outline-none bg-transparent font-sans"
                    />
                  </div>
                  {fieldWarnings.motherNameEn && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldWarnings.motherNameEn}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">জন্ম তারিখ *</label>
              <input
                required
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">লিঙ্গ (Gender) *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Male">পুরুষ (Male)</option>
                <option value="Female">নারী (Female)</option>
                <option value="Other">অন্যান্য (Other)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">জন্ম নিবন্ধন / এনআইডি নম্বর *</label>
              <input
                required
                type="text"
                name="nidOrBirthRegistration"
                value={formData.nidOrBirthRegistration}
                onChange={handleChange}
                placeholder="১৭ ডিজিটের জন্ম নিবন্ধন বা এনআইডি"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">মোবাইল নম্বর *</label>
              <input
                required
                type="tel"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleChange}
                placeholder="017xxxxxxxx"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            {/* Separate Permanent and Present Address with 'Same as Permanent Address' checkbox */}
            <div className="sm:col-span-2 space-y-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  ঠিকানা সংক্রান্ত তথ্য (Address Details)
                </span>
                
                <label className="inline-flex items-center space-x-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 px-3 py-1.5 rounded-lg border border-emerald-200/80 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={!!formData.sameAsPermanentAddress}
                    onChange={handleSameAddressToggle}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span>স্থায়ী ঠিকানার অনুরূপ (Same as Permanent Address)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Permanent Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    স্থায়ী ঠিকানা (Permanent Address) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    name="permanentAddress"
                    value={formData.permanentAddress || ''}
                    onChange={handlePermanentAddressChange}
                    placeholder="গ্রাম/মহল্লা, ডাকঘর, উপজেলা, জেলা"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Present Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      বর্তমান ঠিকানা (Present Address) *
                    </label>
                    {formData.sameAsPermanentAddress && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        স্থায়ী ঠিকানার সাথে সংযুক্ত
                      </span>
                    )}
                  </div>
                  <textarea
                    required
                    rows={3}
                    name="presentAddress"
                    value={formData.presentAddress || ''}
                    onChange={handlePresentAddressChange}
                    readOnly={formData.sameAsPermanentAddress}
                    placeholder="গ্রাম/মহল্লা, ডাকঘর, উপজেলা, জেলা"
                    className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      formData.sameAsPermanentAddress
                        ? 'bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Dropout & Education Information */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <GraduationCap className="text-amber-600" size={20} />
            <h2 className="font-bold text-slate-800 text-base">৩. ড্রপআউট ও পূর্ববর্তী শিক্ষাগত তথ্য (Educational Background)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">সর্বশেষ উত্তীর্ণ/পঠিত শ্রেণি *</label>
              <input
                required
                type="text"
                name="lastClassCompleted"
                value={formData.lastClassCompleted}
                onChange={handleChange}
                placeholder="e.g. ৭ম শ্রেণি (Class 7)"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">পূর্ববর্তী বিদ্যালয়ের নাম *</label>
              <input
                required
                type="text"
                name="previousSchoolName"
                value={formData.previousSchoolName}
                onChange={handleChange}
                placeholder="পূর্ববর্তী স্কুলের নাম"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ঝরে পড়ার বছর (Year of Dropout) *</label>
              <input
                required
                type="text"
                name="yearOfDropout"
                value={formData.yearOfDropout}
                onChange={handleChange}
                placeholder="e.g. 2022"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ঝরে পড়ার কারণ (Reason for Dropout) *</label>
              <input
                required
                type="text"
                name="reasonForDropout"
                value={formData.reasonForDropout}
                onChange={handleChange}
                placeholder="e.g. দারিদ্র্য / পারিবারিক অসচ্ছলতা / দূরবর্তী স্কুল"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Form Submission Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleReturn}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            বাতিল
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Save size={18} />
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ সম্পন্ন করুন'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default TraineeForm;
