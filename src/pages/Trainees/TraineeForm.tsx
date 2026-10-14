import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { logActivity } from '../../lib/firebase';
import { Institute, Trade, Batch, Trainee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, User, GraduationCap, Building2, Phone, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { dataService } from '../../lib/dataService';

const TraineeForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
          setFormData({
            ...found,
            permanentAddress: perm,
            presentAddress: pres,
            sameAsPermanentAddress: same,
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

        const assignedInst = userProfile?.instituteId || (instList[0]?.id || '');
        const assignedBatchId = (userProfile?.role === 'Trainer' && userProfile?.batchId) || '';
        const assignedBatchObj = btcList.find(b => b.id === assignedBatchId);
        const assignedTrade = assignedBatchObj?.tradeId || trdList[0]?.id || '';
        const matchingBatches = btcList.filter(b => b.instituteId === assignedInst && b.tradeId === assignedTrade);

        setFormData(prev => ({
          ...prev,
          traineeId: autoTraineeId,
          registrationNumber: '',
          permanentAddress: '',
          presentAddress: '',
          sameAsPermanentAddress: false,
          instituteId: assignedInst,
          tradeId: assignedTrade,
          batchId: assignedBatchId || matchingBatches[0]?.id || btcList[0]?.id || '',
        }));
      }
    } catch (err) {
      console.warn("Notice fetching data for trainee form:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    if (!formData.registrationNumber || !formData.registrationNumber.trim()) {
      setError('প্রশিক্ষণার্থীর রেজিস্ট্রেশন নম্বর প্রদান করুন।');
      return;
    }

    if (!formData.mobileNumber || formData.mobileNumber.length < 11) {
      setError('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (!formData.instituteId || !formData.tradeId || !formData.batchId) {
      setError('প্রতিষ্ঠান, ট্রেড এবং ব্যাচ অবশ্যই নির্বাচন করতে হবে।');
      return;
    }

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
      const traineeIdToSave = id || `TRN-${Date.now().toString().slice(-5)}`;
      const permAddr = formData.permanentAddress?.trim() || formData.address?.trim() || '';
      const presAddr = formData.sameAsPermanentAddress ? permAddr : (formData.presentAddress?.trim() || permAddr);

      const savedTrainee: Trainee = {
        id: traineeIdToSave,
        traineeId: formData.traineeId || `TR-${Date.now().toString().slice(-4)}`,
        registrationNumber: formData.registrationNumber.trim(),
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
        instituteId: formData.instituteId || '',
        tradeId: formData.tradeId || '',
        batchId: formData.batchId || '',
        admissionDate: formData.admissionDate || Date.now(),
        trainingStartDate: formData.trainingStartDate || Date.now(),
        trainingEndDate: formData.trainingEndDate || (Date.now() + 180 * 86400000),
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

      navigate('/trainees');
    } catch (err: any) {
      console.warn("Notice saving trainee:", err);
      setError('তথ্য সংরক্ষণ সম্পন্ন করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const availableBatches = batches.filter(
    b => (!formData.instituteId || b.instituteId === formData.instituteId) &&
         (!formData.tradeId || b.tradeId === formData.tradeId)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>ফর্ম লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Back button and page title */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => navigate('/trainees')}
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                রেজিস্ট্রেশন নম্বর (Registration No) *
              </label>
              <input
                type="text"
                required
                name="registrationNumber"
                value={formData.registrationNumber || ''}
                onChange={handleChange}
                placeholder="যেমন: REG-10025 বা বোর্ড নম্বর"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">রেজিস্ট্রেশন নম্বর টাইপ করুন (ম্যানুয়াল)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">প্রতিষ্ঠান (Institute) *</label>
              <select
                required
                name="instituteId"
                value={formData.instituteId}
                onChange={handleChange}
                disabled={userProfile?.role === 'Trainer' && !!userProfile.instituteId}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">প্রতিষ্ঠান নির্বাচন করুন</option>
                {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ট্রেড (Trade) *</label>
              <select
                required
                name="tradeId"
                value={formData.tradeId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">ট্রেড নির্বাচন করুন</option>
                {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ব্যাচ (Batch) *</label>
              <select
                required
                name="batchId"
                value={formData.batchId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">ব্যাচ নির্বাচন করুন</option>
                {availableBatches.length > 0 ? (
                  availableBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                ) : (
                  batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">বর্তমান স্ট্যাটাস</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Active">সক্রিয় (Active)</option>
                <option value="Completed">সম্পন্ন (Completed)</option>
                <option value="Dropped Out">ঝরে পড়া (Dropped Out)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Personal Details */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <User className="text-blue-600" size={20} />
            <h2 className="font-bold text-slate-800 text-base">২. শিক্ষার্থীর ব্যক্তিগত তথ্য (Personal Information)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">নাম (বাংলায়) *</label>
              <input
                required
                type="text"
                name="nameBn"
                value={formData.nameBn}
                onChange={handleChange}
                placeholder="e.g. মোঃ শাকিল আহমেদ"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">নাম (ইংরেজিতে) *</label>
              <input
                required
                type="text"
                name="nameEn"
                value={formData.nameEn}
                onChange={handleChange}
                placeholder="e.g. Md. Shakil Ahmed"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">পিতার নাম (বাংলায়) *</label>
              <input
                required
                type="text"
                name="fatherNameBn"
                value={formData.fatherNameBn}
                onChange={handleChange}
                placeholder="পিতার নাম বাংলায়"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">পিতার নাম (ইংরেজিতে) *</label>
              <input
                required
                type="text"
                name="fatherNameEn"
                value={formData.fatherNameEn}
                onChange={handleChange}
                placeholder="Father's Name in English"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">মাতার নাম (বাংলায়) *</label>
              <input
                required
                type="text"
                name="motherNameBn"
                value={formData.motherNameBn}
                onChange={handleChange}
                placeholder="মাতার নাম বাংলায়"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">মাতার নাম (ইংরেজিতে) *</label>
              <input
                required
                type="text"
                name="motherNameEn"
                value={formData.motherNameEn}
                onChange={handleChange}
                placeholder="Mother's Name in English"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

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
            onClick={() => navigate('/trainees')}
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
