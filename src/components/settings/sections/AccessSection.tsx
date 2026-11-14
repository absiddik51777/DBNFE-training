import React, { useState } from 'react';
import { Info, MapPin, ShieldAlert } from 'lucide-react';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import type { AuditLocationMode } from '../../../types';
import { SettingsToastType } from '../types';

interface AccessSectionProps {
  isAdmin: boolean;
  showToast: (type: SettingsToastType, message: string) => void;
}

const LOCATION_MODE_OPTIONS: ReadonlyArray<{
  value: AuditLocationMode;
  label: string;
  description: string;
}> = [
  {
    value: 'off',
    label: 'বন্ধ',
    description: 'কোনো কাজের সময় অবস্থান সংগ্রহ বা সংরক্ষণ করা হবে না।',
  },
  {
    value: 'optional',
    label: 'ঐচ্ছিক',
    description: 'অনুমতি থাকলে অবস্থান সংরক্ষণ করবে, না থাকলেও কাজ চালিয়ে যাবে।',
  },
  {
    value: 'required',
    label: 'বাধ্যতামূলক',
    description: 'মুছে ফেলা বা ফেরত নেওয়ার কাজের আগে অবস্থান অনুমতি বাধ্যতামূলক।',
  },
];

export const AccessSection: React.FC<AccessSectionProps> = ({ isAdmin, showToast }) => {
  const { settings, updateSettings } = useSystemSettings();
  const [updating, setUpdating] = useState(false);
  const [updatingLocationMode, setUpdatingLocationMode] = useState(false);

  const isPublicRegistrationOpen = settings.allowPublicRegistration !== false;
  const locationMode: AuditLocationMode = settings.auditLocationMode || 'optional';

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

  const handleLocationModeChange = async (nextMode: AuditLocationMode) => {
    if (!isAdmin || updatingLocationMode || nextMode === locationMode) return;
    setUpdatingLocationMode(true);
    try {
      await updateSettings({ auditLocationMode: nextMode });
      const label =
        LOCATION_MODE_OPTIONS.find((opt) => opt.value === nextMode)?.label || nextMode;
      showToast('success', `কাজের অবস্থান সংরক্ষণ '${label}' করা হয়েছে।`);
    } catch (err: any) {
      showToast('error', err?.message || 'অবস্থান সেটিংস পরিবর্তনে সমস্যা হয়েছে।');
    } finally {
      setUpdatingLocationMode(false);
    }
  };

  const currentLocationOption =
    LOCATION_MODE_OPTIONS.find((opt) => opt.value === locationMode) ||
    LOCATION_MODE_OPTIONS[1];

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

      {/* Audit Location Setting */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin size={16} className="text-theme-primary shrink-0" />
              <h2 className="text-sm font-bold text-theme-text-primary">
                কাজের অবস্থান সংরক্ষণ
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  locationMode === 'off'
                    ? 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border'
                    : locationMode === 'required'
                    ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
                    : 'bg-theme-success-soft text-theme-success border-theme-success-border'
                }`}
              >
                {currentLocationOption.label}
              </span>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              তথ্য পরিবর্তন, সংযোজন বা মুছে ফেলার সময় অডিট লগে ব্যবহারকারীর আনুমানিক অবস্থান সংরক্ষণের নীতি নির্ধারণ করুন।
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="কাজের অবস্থান সংরক্ষণ"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        >
          {LOCATION_MODE_OPTIONS.map((option) => {
            const selected = locationMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!isAdmin || updatingLocationMode}
                onClick={() => handleLocationModeChange(option.value)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-[12px] border text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary disabled:opacity-60 disabled:cursor-not-allowed ${
                  selected
                    ? 'border-theme-primary bg-theme-primary-soft text-theme-text-primary'
                    : 'border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-secondary'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-theme-text-primary">
                    {option.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selected
                        ? 'border-theme-primary bg-theme-primary'
                        : 'border-theme-border-strong bg-theme-surface'
                    }`}
                  >
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-[11px] text-theme-text-secondary leading-snug mt-1">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="rounded-[12px] border border-theme-border bg-theme-surface-subtle p-3.5 flex items-start gap-2.5">
          <Info size={16} className="text-theme-text-secondary shrink-0 mt-0.5" />
          <p className="text-xs text-theme-text-secondary leading-relaxed">
            প্রতিটি কাজের সময় ব্যবহারকারীর আনুমানিক অবস্থান সংরক্ষণ করা হয়। শুধু অ্যাডমিন এটি দেখতে পারবেন।
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-[12px] border border-theme-warning-border bg-theme-warning-soft p-3.5 flex items-start gap-2.5 text-xs text-theme-text-primary">
            <ShieldAlert size={16} className="text-theme-warning shrink-0 mt-0.5" />
            <span>এই নীতি পরিবর্তন করার অনুমতি শুধুমাত্র কোর্স পরিচালকের রয়েছে।</span>
          </div>
        )}
      </div>
    </div>
  );
};
