import React, { useEffect, useId, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { SettingsToastType } from '../types';

interface RulesSectionProps {
  showToast: (type: SettingsToastType, message: string) => void;
}

function validatePercent(raw: string): { valid: boolean; value: number; error?: string } {
  if (raw.trim() === '') {
    return { valid: false, value: 0, error: 'একটি সংখ্যা লিখুন (০ থেকে ১০০)।' };
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return { valid: false, value: 0, error: 'মান অবশ্যই ০ থেকে ১০০ এর মধ্যে হতে হবে।' };
  }
  return { valid: true, value: Math.round(num) };
}

export const RulesSection: React.FC<RulesSectionProps> = ({ showToast }) => {
  const { settings, updateSettings } = useSystemSettings();

  const [attendanceInput, setAttendanceInput] = useState<string>(
    String(settings.minAttendancePercentForCert ?? 75)
  );
  const [passMarkInput, setPassMarkInput] = useState<string>(
    String(settings.passMarkPercent ?? 40)
  );
  const [saving, setSaving] = useState(false);

  const attendanceId = useId();
  const passMarkId = useId();

  useEffect(() => {
    setAttendanceInput(String(settings.minAttendancePercentForCert ?? 75));
    setPassMarkInput(String(settings.passMarkPercent ?? 40));
  }, [settings.minAttendancePercentForCert, settings.passMarkPercent]);

  const attendanceCheck = validatePercent(attendanceInput);
  const passMarkCheck = validatePercent(passMarkInput);
  const canSave = attendanceCheck.valid && passMarkCheck.valid && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      await updateSettings({
        minAttendancePercentForCert: attendanceCheck.value,
        passMarkPercent: passMarkCheck.value,
      });
      showToast('success', 'নিয়ম ও মানদণ্ড সফলভাবে সংরক্ষিত হয়েছে।');
    } catch (err: any) {
      showToast('error', err?.message || 'নিয়ম সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor={attendanceId}
            className="block text-sm font-semibold text-theme-text-primary"
          >
            সার্টিফিকেটের জন্য ন্যূনতম উপস্থিতির হার (%)
          </label>
          <p className="text-xs text-theme-text-secondary">
            প্রশিক্ষণার্থীর সনদপত্র পাওয়ার জন্য ন্যূনতম প্রয়োজনীয় উপস্থিতির শতকরা হার (০–১০০)।
          </p>
          <input
            id={attendanceId}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={attendanceInput}
            onChange={(e) => setAttendanceInput(e.target.value)}
            aria-invalid={!attendanceCheck.valid}
            className={`w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-elevated border text-sm text-theme-text-primary tabular-nums focus:outline-hidden focus:ring-2 ${
              attendanceCheck.valid
                ? 'border-theme-border-strong focus:ring-theme-primary/30 focus:border-theme-primary'
                : 'border-theme-danger focus:ring-theme-danger/30 focus:border-theme-danger'
            }`}
          />
          {!attendanceCheck.valid && (
            <p className="text-xs text-theme-danger font-medium" role="alert">
              {attendanceCheck.error}
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-theme-border space-y-1.5">
          <label
            htmlFor={passMarkId}
            className="block text-sm font-semibold text-theme-text-primary"
          >
            পরীক্ষায় ন্যূনতম পাস নম্বর (%)
          </label>
          <p className="text-xs text-theme-text-secondary">
            মূল্যায়ন পরীক্ষায় উত্তীর্ণ হওয়ার ন্যূনতম শতকরা নম্বর (০–১০০)।
          </p>
          <input
            id={passMarkId}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={passMarkInput}
            onChange={(e) => setPassMarkInput(e.target.value)}
            aria-invalid={!passMarkCheck.valid}
            className={`w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-elevated border text-sm text-theme-text-primary tabular-nums focus:outline-hidden focus:ring-2 ${
              passMarkCheck.valid
                ? 'border-theme-border-strong focus:ring-theme-primary/30 focus:border-theme-primary'
                : 'border-theme-danger focus:ring-theme-danger/30 focus:border-theme-danger'
            }`}
          />
          {!passMarkCheck.valid && (
            <p className="text-xs text-theme-danger font-medium" role="alert">
              {passMarkCheck.error}
            </p>
          )}
        </div>
      </div>

      {/* Sticky Save Action Bar */}
      <div className="sticky bottom-0 z-10 bg-theme-bg/95 backdrop-blur-xs pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3 flex items-center justify-between gap-3">
          <span className="text-xs text-theme-text-secondary tabular-nums">
            বর্তমান: উপস্থিতি {settings.minAttendancePercentForCert ?? 75}% · পাস {settings.passMarkPercent ?? 40}%
          </span>
          <button
            type="submit"
            disabled={!canSave}
            className="min-h-[44px] px-5 py-2 rounded-[12px] bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
