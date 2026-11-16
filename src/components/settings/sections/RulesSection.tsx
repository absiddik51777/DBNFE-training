import React, { useEffect, useId, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { SettingsToastType } from '../types';
import { toBn } from '../../../lib/dateUtils';
import { useActionRunner, type ActionStep } from '../../../hooks/useActionRunner';
import { ActionButton } from '../../ui/ActionButton';

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

  const attendanceId = useId();
  const passMarkId = useId();

  useEffect(() => {
    setAttendanceInput(String(settings.minAttendancePercentForCert ?? 75));
    setPassMarkInput(String(settings.passMarkPercent ?? 40));
  }, [settings.minAttendancePercentForCert, settings.passMarkPercent]);

  const attendanceCheck = validatePercent(attendanceInput);
  const passMarkCheck = validatePercent(passMarkInput);

  const saveSteps = useMemo<ActionStep<any>[]>(() => [
    {
      id: 'save-rules',
      label: 'সিস্টেম নিয়ম ও মানদণ্ড সংরক্ষণ করা হচ্ছে',
      run: async () => {
        await updateSettings({
          minAttendancePercentForCert: attendanceCheck.value,
          passMarkPercent: passMarkCheck.value,
        });
        showToast('success', 'নিয়ম ও মানদণ্ড সফলভাবে সংরক্ষিত হয়েছে।');
        return {
          attendance: attendanceCheck.value,
          passMark: passMarkCheck.value,
        };
      },
      describe: (res: { attendance: number; passMark: number }) =>
        `উপস্থিতি ${toBn(res.attendance)}% · পাস ${toBn(res.passMark)}%`,
    },
  ], [attendanceCheck.value, passMarkCheck.value, updateSettings, showToast]);

  const saveRunner = useActionRunner(saveSteps);
  const isBusy = saveRunner.phase === 'running' || saveRunner.phase === 'waiting';
  const canSave = attendanceCheck.valid && passMarkCheck.valid && !isBusy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    await saveRunner.run();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset disabled={isBusy} className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 space-y-5 min-w-0">
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
            onChange={(e) => {
              setAttendanceInput(e.target.value);
              if (saveRunner.phase === 'success' || saveRunner.phase === 'failed') {
                saveRunner.reset();
              }
            }}
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
            onChange={(e) => {
              setPassMarkInput(e.target.value);
              if (saveRunner.phase === 'success' || saveRunner.phase === 'failed') {
                saveRunner.reset();
              }
            }}
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
      </fieldset>

      {/* Sticky Save Action Bar */}
      <div className="sticky bottom-0 z-10 bg-theme-bg/95 backdrop-blur-xs pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3 flex flex-wrap items-center justify-between gap-3 overflow-visible">
          <span className="text-xs text-theme-text-secondary tabular-nums">
            বর্তমান: উপস্থিতি {toBn(settings.minAttendancePercentForCert ?? 75)}% · পাস {toBn(settings.passMarkPercent ?? 40)}%
          </span>
          <ActionButton
            runner={saveRunner}
            idleLabel="সংরক্ষণ করুন"
            idleIcon={<Save size={16} />}
            popoverTitle="নিয়ম সংরক্ষণ"
            disabled={!attendanceCheck.valid || !passMarkCheck.valid}
            onBeforeRun={() => attendanceCheck.valid && passMarkCheck.valid}
            onAutoHide={() => saveRunner.reset()}
            className="min-w-[175px]"
          />
        </div>
      </div>
    </form>
  );
};
