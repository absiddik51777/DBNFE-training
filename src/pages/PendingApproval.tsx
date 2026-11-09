import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Clock, ShieldCheck, LogOut, RefreshCw, AlertCircle, Phone, Mail, User } from 'lucide-react';
import { toBn } from '../lib/dateUtils';

export const PendingApproval: React.FC = () => {
  const { userProfile, signOut, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const handleRefresh = async () => {
    setChecking(true);
    setMessage('');
    try {
      await refreshProfile();
      setMessage('স্ট্যাটাস আপডেট যাচাই করা হয়েছে।');
    } catch {
      setMessage('স্ট্যাটাস যাচাই সম্পন্ন করা যায়নি। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      {/* Header Banner */}
      <div className="w-full max-w-lg text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 text-white rounded-2xl shadow-lg mb-3 shadow-amber-500/20">
          <Clock size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          অ্যাকাউন্ট অনুমোদনের অপেক্ষায়
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) প্রশিক্ষণ পোর্টাল
        </p>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden p-6 sm:p-7 space-y-5">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900 text-xs sm:text-sm">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">অনুমোদনের জন্য কোর্স পরিচালকের টেবিলে অপেক্ষমাণ</strong>
            <p className="text-xs text-amber-800 leading-relaxed">
              আপনার একাউন্টটি সফলভাবে নিবন্ধিত হয়েছে। তথ্যের নিরাপত্তা নিশ্চিতকল্পে কোর্স পরিচালক (Course Director) কর্তৃক যাচাই ও অনুমোদন সম্পন্ন হওয়ার পর আপনি আপনার দায়িত্বপ্রাপ্ত মডিউলে প্রবেশাধিকার পাবেন।
            </p>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* User Details Summary */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-xs">
          <span className="font-bold text-slate-700 block text-xs border-b border-slate-200/70 pb-2">
            আপনার নিবন্ধিত অ্যাকাউন্টের বিবরণ:
          </span>
          <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <User size={14} />
              <span>নাম:</span>
            </span>
            <strong className="text-slate-800">{userProfile?.name || 'ব্যবহারকারী'}</strong>
          </div>
          <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <Mail size={14} />
              <span>ইমেইল:</span>
            </span>
            <strong className="font-mono text-slate-800">{userProfile?.email || 'N/A'}</strong>
          </div>
          {userProfile?.phone && (
            <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
              <span className="flex items-center space-x-1.5 text-slate-500">
                <Phone size={14} />
                <span>মোবাইল:</span>
              </span>
              <strong className="font-mono text-slate-800">{toBn(userProfile.phone)}</strong>
            </div>
          )}
          <div className="flex items-center justify-between text-slate-600 py-1">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <ShieldCheck size={14} />
              <span>বর্তমান অবস্থা:</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <Clock size={11} />
              <span>Pending Approval</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={checking}
            className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? 'যাচাই হচ্ছে...' : 'পুনরায় চেক করুন'}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto py-2.5 px-5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-2xs"
          >
            <LogOut size={15} className="text-slate-500" />
            <span>লগআউট</span>
          </button>
        </div>
      </div>

      <div className="mt-5 text-center text-xs text-slate-500">
        বাংলাদেশ উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) • প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
      </div>
    </div>
  );
};
