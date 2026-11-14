import React, { useState } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { SettingsToastType } from '../types';

interface AccessSectionProps {
  isAdmin: boolean;
  showToast: (type: SettingsToastType, message: string) => void;
}

export const AccessSection: React.FC<AccessSectionProps> = ({ isAdmin, showToast }) => {
  const { settings, updateSettings } = useSystemSettings();
  const [updating, setUpdating] = useState(false);

  const isPublicRegistrationOpen = settings.allowPublicRegistration !== false;

  const handleToggle = async () => {
    if (!isAdmin || updating) return;
    setUpdating(true);
    try {
      const next = !isPublicRegistrationOpen;
      await updateSettings({ allowPublicRegistration: next });
      showToast(
        'success',
        next
          ? 'পাবলিক নিবন্ধন চালু করা হয়েছে।'
          : 'পাবলিক নিবন্ধন বন্ধ করা হয়েছে।'
      );
    } catch (err: any) {
      showToast('error', err?.message || 'নিবন্ধন সেটিংস পরিবর্তনে সমস্যা হয়েছে।');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-theme-text-primary">
                পাবলিক নিবন্ধন
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isPublicRegistrationOpen
                    ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
                    : 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
                }`}
              >
                {isPublicRegistrationOpen ? 'চালু' : 'বন্ধ'}
              </span>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              লগইন স্ক্রিন থেকে নতুন ব্যবহারকারীদের স্ব-নিবন্ধন আবেদন করার অনুমতি নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isPublicRegistrationOpen}
            aria-label="পাবলিক নিবন্ধন চালু বা বন্ধ করুন"
            disabled={!isAdmin || updating}
            onClick={handleToggle}
            className="min-h-[44px] min-w-[56px] inline-flex items-center justify-end shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary rounded-full"
          >
            <span
              className={`w-12 h-7 rounded-full p-0.5 border transition-colors flex items-center ${
                isPublicRegistrationOpen
                  ? 'bg-theme-primary border-theme-primary justify-end'
                  : 'bg-theme-surface-subtle border-theme-border-strong justify-start'
              }`}
            >
              <span className="w-5.5 h-5.5 rounded-full bg-white border border-black/10 block" />
            </span>
          </button>
        </div>

        <div className="rounded-[12px] border border-theme-border bg-theme-surface-subtle p-3.5 flex items-start gap-2.5">
          <Info size={16} className="text-theme-text-secondary shrink-0 mt-0.5" />
          <p className="text-xs text-theme-text-secondary leading-relaxed">
            {isPublicRegistrationOpen
              ? 'পাবলিক নিবন্ধন চালু রয়েছে। নতুন আবেদনকারীরা লগইন পেজ থেকে অ্যাকাউন্ট তৈরি করতে পারবেন এবং অ্যাডমিনের অনুমোদন না পাওয়া পর্যন্ত তাদের অ্যাকাউন্ট Pending Approval অবস্থায় থাকবে।'
              : 'পাবলিক নিবন্ধন বন্ধ রয়েছে। সাধারণ ব্যবহারকারীরা নিজেরা অ্যাকাউন্ট খুলতে পারবেন না; শুধুমাত্র কোর্স পরিচালক ব্যবহারকারী ব্যবস্থাপনা থেকে নতুন ইউজার যোগ করতে পারবেন।'}
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-[12px] border border-theme-warning-border bg-theme-warning-soft p-3.5 flex items-start gap-2.5 text-xs text-theme-text-primary">
            <ShieldAlert size={16} className="text-theme-warning shrink-0 mt-0.5" />
            <span>এই সুইচ পরিবর্তন করার অনুমতি শুধুমাত্র কোর্স পরিচালকের রয়েছে।</span>
          </div>
        )}
      </div>
    </div>
  );
};
