import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Laptop, Moon, RefreshCw, Sliders, Sun } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { dataService } from '../../../lib/dataService';
import type { ThemeMode } from '../../../lib/theme';
import { ACCENT_OPTIONS, AccentPresetOption, SettingsToastType } from '../types';
import { SettingsConfirmDialog } from '../SettingsConfirmDialog';

interface AppearanceSectionProps {
  showToast: (type: SettingsToastType, message: string) => void;
}

const MODE_OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'system', label: 'সিস্টেম', icon: <Laptop size={16} /> },
  { mode: 'light', label: 'লাইট', icon: <Sun size={16} /> },
  { mode: 'dark', label: 'ডার্ক', icon: <Moon size={16} /> },
];

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ showToast }) => {
  const { config, setMode, applyConfig } = useTheme();
  const [confirmCacheOpen, setConfirmCacheOpen] = useState(false);

  const selectedAccentId = (() => {
    const primary = config.light.primary.toLowerCase();
    if (primary === '#0f766e' || config.presetId === 'emerald-slate') return 'emerald';
    const match = ACCENT_OPTIONS.find((opt) => opt.light.primary.toLowerCase() === primary);
    return match?.id || 'emerald';
  })();

  const handleSelectAccent = (option: AccentPresetOption) => {
    applyConfig({
      ...config,
      presetId: option.id === 'emerald' ? 'emerald-slate' : 'custom',
      light: {
        ...config.light,
        primary: option.light.primary,
        primaryHover: option.light.primaryHover,
        primarySoft: option.light.primarySoft,
        accent: option.light.accent,
      },
      dark: {
        ...config.dark,
        primary: option.dark.primary,
        primaryHover: option.dark.primaryHover,
        primarySoft: option.dark.primarySoft,
        accent: option.dark.accent,
      },
    });
    showToast('success', `${option.label} অ্যাক্সেন্ট কালার প্রয়োগ করা হয়েছে।`);
  };

  const handleConfirmCacheReset = () => {
    setConfirmCacheOpen(false);
    dataService.clearAllLocalData();
    showToast('success', 'ব্রাউজার ক্যাশ পরিষ্কার হয়েছে। পৃষ্ঠা পুনরায় লোড হচ্ছে...');
    window.setTimeout(() => {
      window.location.reload();
    }, 750);
  };

  return (
    <div className="space-y-4">
      {/* Theme Mode & Accent Card */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 space-y-5">
        <div className="space-y-2.5">
          <div>
            <h2 className="text-sm font-bold text-theme-text-primary">থিম মোড</h2>
            <p className="text-xs text-theme-text-secondary mt-0.5">
              ডিভাইসের সেটিংস অনুযায়ী অথবা সরাসরি লাইট/ডার্ক মোড বেছে নিন
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="থিম মোড নির্বাচন"
            className="grid grid-cols-3 gap-1 p-1 rounded-[12px] bg-theme-surface-subtle border border-theme-border"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = config.mode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(opt.mode)}
                  className={`min-h-[44px] px-3 py-2 rounded-[10px] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
                    active
                      ? 'bg-theme-surface text-theme-text-primary border border-theme-border'
                      : 'text-theme-text-secondary hover:text-theme-text-primary border border-transparent'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-theme-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-theme-text-primary">অ্যাক্সেন্ট কালার</h2>
              <p className="text-xs text-theme-text-secondary mt-0.5">
                বাটন, সক্রিয় ট্যাব ও হাইলাইটের রঙ নির্বাচন করুন
              </p>
            </div>
            <span className="text-xs font-medium text-theme-text-secondary">
              {ACCENT_OPTIONS.find((a) => a.id === selectedAccentId)?.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_OPTIONS.map((option) => {
              const isSelected = selectedAccentId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectAccent(option)}
                  aria-label={`${option.label} অ্যাক্সেন্ট`}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] min-w-[44px] p-1.5 rounded-full inline-flex items-center justify-center border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
                    isSelected
                      ? 'border-theme-text-primary bg-theme-surface-subtle'
                      : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: option.swatch }}
                  >
                    {isSelected && <Check size={15} strokeWidth={2.75} />}
                  </span>
                </button>
              );
            })}

            <Link
              to="/settings/theme"
              className="ml-auto min-h-[44px] px-3.5 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs font-semibold text-theme-text-primary inline-flex items-center gap-1.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <Sliders size={14} />
              <span>বিস্তারিত থিম এডিটর</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Browser Cache Reset Card */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-theme-text-primary">ব্রাউজার ক্যাশ</h2>
          <p className="text-xs text-theme-text-secondary leading-relaxed">
            ডিভাইসের অস্থায়ী লোকাল ক্যাশ পরিষ্কার করে ক্লাউড থেকে নতুন তথ্য লোড করে। ক্লাউড ডাটাবেজের কোনো তথ্য মুছবে না।
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmCacheOpen(true)}
          className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs sm:text-sm font-semibold text-theme-text-primary inline-flex items-center justify-center gap-2 shrink-0 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
        >
          <RefreshCw size={15} />
          <span>ব্রাউজার ক্যাশ রিসেট করুন</span>
        </button>
      </div>

      <SettingsConfirmDialog
        open={confirmCacheOpen}
        title="ব্রাউজার ক্যাশ রিসেট নিশ্চিত করুন"
        description="আপনার ব্রাউজারে সংরক্ষিত লোকাল অফলাইন ক্যাশ পরিষ্কার হবে এবং পৃষ্ঠা পুনরায় লোড হয়ে ক্লাউড থেকে তাজা ডাটা আনবে।"
        confirmLabel="হ্যাঁ, ক্যাশ রিসেট করুন"
        tone="warning"
        onConfirm={handleConfirmCacheReset}
        onClose={() => setConfirmCacheOpen(false)}
      />
    </div>
  );
};
