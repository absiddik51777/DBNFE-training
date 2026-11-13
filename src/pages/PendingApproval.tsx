import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Clock, ShieldCheck, LogOut, RefreshCw, AlertCircle, Phone, Mail, User } from 'lucide-react';
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
    <div className="min-h-screen bg-theme-bg text-theme-text-primary flex flex-col justify-center items-center p-4 selection:bg-theme-primary selection:text-theme-primary-fg">
      <div className="w-full max-w-lg text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-theme-warning text-theme-warning-fg rounded-2xl shadow-md mb-3">
          <Clock size={32} />
        </div>
        <h1 className="text-2xl font-bold text-theme-text-primary tracking-tight">
          অ্যাকাউন্ট অনুমোদনের অপেক্ষায়
        </h1>
        <p className="text-sm font-medium text-theme-text-secondary mt-1">
          উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) প্রশিক্ষণ পোর্টাল
        </p>
      </div>

      <div className="w-full max-w-lg bg-theme-surface rounded-2xl shadow-xl border border-theme-border overflow-hidden p-6 sm:p-7 space-y-5">
        <div className="p-4 bg-theme-warning-soft border border-theme-warning-border rounded-xl flex items-start space-x-3 text-theme-text-primary text-xs sm:text-sm">
          <Clock className="w-5 h-5 text-theme-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold text-theme-warning">অনুমোদনের জন্য কোর্স পরিচালকের টেবিলে অপেক্ষমাণ</strong>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              আপনার একাউন্টটি সফলভাবে নিবন্ধিত হয়েছে। তথ্যের নিরাপত্তা নিশ্চিতকল্পে কোর্স পরিচালক (Course Director) কর্তৃক যাচাই ও অনুমোদন সম্পন্ন হওয়ার পর আপনি আপনার দায়িত্বপ্রাপ্ত মডিউলে প্রবেশাধিকার পাবেন।
            </p>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-theme-success-soft border border-theme-success-border rounded-xl text-theme-success text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="bg-theme-surface-subtle border border-theme-border rounded-xl p-4 space-y-2.5 text-xs">
          <span className="font-bold text-theme-text-primary block text-xs border-b border-theme-border pb-2">
            আপনার নিবন্ধিত অ্যাকাউন্টের বিবরণ:
          </span>
          <div className="flex items-center justify-between text-theme-text-secondary py-1 border-b border-theme-border">
            <span className="flex items-center space-x-1.5">
              <User size={14} />
              <span>নাম:</span>
            </span>
            <strong className="text-theme-text-primary">{userProfile?.name || 'ব্যবহারকারী'}</strong>
          </div>
          <div className="flex items-center justify-between text-theme-text-secondary py-1 border-b border-theme-border">
            <span className="flex items-center space-x-1.5">
              <Mail size={14} />
              <span>ইমেইল:</span>
            </span>
            <strong className="font-mono text-theme-text-primary">{userProfile?.email || 'N/A'}</strong>
          </div>
          {userProfile?.phone && (
            <div className="flex items-center justify-between text-theme-text-secondary py-1 border-b border-theme-border">
              <span className="flex items-center space-x-1.5">
                <Phone size={14} />
                <span>মোবাইল:</span>
              </span>
              <strong className="font-mono text-theme-text-primary">{toBn(userProfile.phone)}</strong>
            </div>
          )}
          <div className="flex items-center justify-between text-theme-text-secondary py-1">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck size={14} />
              <span>বর্তমান অবস্থা:</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-theme-warning-soft text-theme-warning border border-theme-warning-border">
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
            className="w-full sm:flex-1 py-2.5 px-4 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? 'যাচাই হচ্ছে...' : 'পুনরায় চেক করুন'}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto py-2.5 px-5 bg-theme-elevated border border-theme-border hover:bg-theme-surface-hover text-theme-text-primary font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            <LogOut size={15} className="text-theme-text-secondary" />
            <span>লগআউট</span>
          </button>
        </div>
      </div>

      <div className="mt-5 text-center text-xs text-theme-text-muted">
        বাংলাদেশ উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) • প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
      </div>
    </div>
  );
};
