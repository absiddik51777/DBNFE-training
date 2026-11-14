import React, { useState } from 'react';
import { AlertTriangle, Lock, ShieldAlert, Trash2, Unlock } from 'lucide-react';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { SettingsCounts, SettingsToastType } from '../types';
import { SettingsConfirmDialog } from '../SettingsConfirmDialog';

type WipeEntityKey =
  | 'attendance'
  | 'trainees'
  | 'exams'
  | 'batches'
  | 'institutes'
  | 'trades';

interface DangerZoneSectionProps {
  isAdmin: boolean;
  counts: SettingsCounts;
  onRefreshCounts: () => Promise<void>;
  onRefreshLogs: () => Promise<void>;
  showToast: (type: SettingsToastType, message: string) => void;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  isAdmin,
  counts,
  onRefreshCounts,
  onRefreshLogs,
  showToast,
}) => {
  const {
    isDeletionAllowed,
    toggleDataDeletion,
    deleteAllAttendance,
    deleteAllTrainees,
    deleteAllExamsAndMarks,
    deleteAllBatches,
    deleteAllInstitutes,
    deleteAllTrades,
    purgeAllSystemData,
  } = useSystemSettings();

  const [togglingLock, setTogglingLock] = useState(false);
  const [pendingWipe, setPendingWipe] = useState<WipeEntityKey | null>(null);
  const [factoryResetOpen, setFactoryResetOpen] = useState(false);
  const [keepInstitutesAndTrades, setKeepInstitutesAndTrades] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isAdmin) {
    return (
      <div className="rounded-[14px] border border-theme-danger-border bg-theme-surface p-6 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-theme-danger-soft text-theme-danger border border-theme-danger-border flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-base font-bold text-theme-text-primary">
          প্রবেশাধিকার সংরক্ষিত
        </h2>
        <p className="text-xs text-theme-text-secondary">
          ডেঞ্জার জোন শুধুমাত্র অ্যাডমিন (Course Director) ব্যবহার করতে পারবেন।
        </p>
      </div>
    );
  }

  const isLocked = !isDeletionAllowed;

  const handleToggleLock = async () => {
    if (togglingLock) return;
    setTogglingLock(true);
    try {
      // If currently locked, unlocking enables deletion (true); if unlocked, locking sets false
      const nextDeletionAllowed = isLocked;
      await toggleDataDeletion(nextDeletionAllowed);
      showToast(
        nextDeletionAllowed ? 'warning' : 'success',
        nextDeletionAllowed
          ? 'ডিলিট আনলক করা হয়েছে। কাজ শেষে পুনরায় লক করুন।'
          : 'ডিলিট লক সক্রিয় করা হয়েছে।'
      );
    } catch (err: any) {
      showToast('error', err?.message || 'ডিলিট লক পরিবর্তন করা যায়নি।');
    } finally {
      setTogglingLock(false);
    }
  };

  const wipeRows: {
    key: WipeEntityKey;
    label: string;
    count: number;
    countLabel: string;
    detail: string;
  }[] = [
    {
      key: 'attendance',
      label: 'দৈনিক হাজিরা',
      count: counts.attendance,
      countLabel: `${counts.attendance} টি রেকর্ড`,
      detail: `মোট ${counts.attendance} টি দৈনিক হাজিরা রেকর্ড স্থায়ীভাবে মুছে যাবে।`,
    },
    {
      key: 'trainees',
      label: 'প্রশিক্ষণার্থী ও হাজিরা',
      count: counts.trainees + counts.attendance,
      countLabel: `${counts.trainees} জন · হাজিরা ${counts.attendance} টি`,
      detail: `মোট ${counts.trainees} জন প্রশিক্ষণার্থী এবং তাদের সংশ্লিষ্ট ${counts.attendance} টি হাজিরা রেকর্ড মুছে যাবে।`,
    },
    {
      key: 'exams',
      label: 'পরীক্ষা ও ফলাফল',
      count: counts.exams + counts.marks,
      countLabel: `${counts.exams} টি পরীক্ষা · ${counts.marks} টি মার্কস`,
      detail: `মোট ${counts.exams} টি পরীক্ষা এবং ${counts.marks} টি ফলাফল নম্বর মুছে যাবে।`,
    },
    {
      key: 'batches',
      label: 'ব্যাচ',
      count: counts.batches,
      countLabel: `${counts.batches} টি ব্যাচ`,
      detail: `মোট ${counts.batches} টি প্রশিক্ষণ ব্যাচ স্থায়ীভাবে মুছে যাবে।`,
    },
    {
      key: 'institutes',
      label: 'প্রতিষ্ঠান',
      count: counts.institutes,
      countLabel: `${counts.institutes} টি প্রতিষ্ঠান`,
      detail: `মোট ${counts.institutes} টি প্রশিক্ষণ প্রতিষ্ঠান মুছে যাবে।`,
    },
    {
      key: 'trades',
      label: 'ট্রেড',
      count: counts.trades,
      countLabel: `${counts.trades} টি ট্রেড`,
      detail: `মোট ${counts.trades} টি ট্রেড স্থায়ীভাবে মুছে যাবে।`,
    },
  ];

  const activeWipeRow = wipeRows.find((r) => r.key === pendingWipe) || null;

  const handleRowDeleteClick = (row: (typeof wipeRows)[number]) => {
    if (isLocked) {
      showToast('warning', 'আগে ডিলিট আনলক করুন');
      return;
    }
    if (row.count === 0) {
      showToast('warning', `${row.label} বিভাগে কোনো রেকর্ড নেই।`);
      return;
    }
    setPendingWipe(row.key);
  };

  const handleConfirmSingleWipe = async () => {
    if (!pendingWipe || isDeleting) return;
    setIsDeleting(true);
    try {
      let msg = '';
      if (pendingWipe === 'attendance') {
        const deleted = await deleteAllAttendance();
        msg = `সকল দৈনিক হাজিরা (${deleted}টি) মুছে ফেলা হয়েছে।`;
      } else if (pendingWipe === 'trainees') {
        const res = await deleteAllTrainees({ deleteAttendanceToo: true });
        msg = `প্রশিক্ষণার্থী (${res.deletedTrainees} জন) ও হাজিরা (${res.deletedAttendance}টি) মুছে ফেলা হয়েছে।`;
      } else if (pendingWipe === 'exams') {
        const res = await deleteAllExamsAndMarks();
        msg = `পরীক্ষা (${res.deletedExams}টি) ও মার্কস (${res.deletedMarks}টি) মুছে ফেলা হয়েছে।`;
      } else if (pendingWipe === 'batches') {
        const deleted = await deleteAllBatches();
        msg = `সকল ব্যাচ (${deleted}টি) মুছে ফেলা হয়েছে।`;
      } else if (pendingWipe === 'institutes') {
        const deleted = await deleteAllInstitutes();
        msg = `সকল প্রতিষ্ঠান (${deleted}টি) মুছে ফেলা হয়েছে।`;
      } else if (pendingWipe === 'trades') {
        const deleted = await deleteAllTrades();
        msg = `সকল ট্রেড (${deleted}টি) মুছে ফেলা হয়েছে।`;
      }
      setPendingWipe(null);
      await Promise.all([onRefreshCounts(), onRefreshLogs()]);
      showToast('success', msg);
    } catch (err: any) {
      showToast('error', err?.message || 'ডাটা মুছতে সমস্যা হয়েছে।');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTriggerFactoryReset = () => {
    if (isLocked) {
      showToast('warning', 'আগে ডিলিট আনলক করুন');
      return;
    }
    setFactoryResetOpen(true);
  };

  const handleConfirmFactoryReset = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await purgeAllSystemData({
        keepInstitutesAndTrades,
        keepLogs: false,
      });
      setFactoryResetOpen(false);
      await Promise.all([onRefreshCounts(), onRefreshLogs()]);
      showToast('success', 'সম্পূর্ণ ফ্যাক্টরি রিসেট সম্পন্ন হয়েছে।');
    } catch (err: any) {
      showToast('error', err?.message || 'ফ্যাক্টরি রিসেট ব্যর্থ হয়েছে।');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Delete Lock Switch */}
      <div
        className={`rounded-[14px] border bg-theme-surface p-4 sm:p-5 space-y-3 ${
          isLocked ? 'border-theme-border' : 'border-theme-warning-border'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${
                isLocked
                  ? 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border'
                  : 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
              }`}
            >
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-theme-text-primary">
                  ডিলিট লক
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isLocked
                      ? 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border'
                      : 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
                  }`}
                >
                  {isLocked ? 'লক করা' : 'আনলকড'}
                </span>
              </div>
              <p className="text-xs text-theme-text-secondary leading-relaxed">
                {isLocked
                  ? 'নিরাপত্তার স্বার্থে সকল ডিলিট অ্যাকশন লক করা আছে। ডাটা মুছতে চাইলে সুইচটি অফ (আনলক) করুন।'
                  : 'ডিলিট আনলক করা হয়েছে। নিচের যেকোনো ডাটা মুছে ফেলার পর নিরাপত্তার জন্য আবার লক করে দিন।'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isLocked}
            aria-label="ডিলিট লক চালু বা বন্ধ করুন"
            disabled={togglingLock}
            onClick={handleToggleLock}
            className="min-h-[44px] min-w-[56px] inline-flex items-center justify-end shrink-0 cursor-pointer disabled:opacity-55 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary rounded-full"
          >
            <span
              className={`w-12 h-7 rounded-full p-0.5 border transition-colors flex items-center ${
                isLocked
                  ? 'bg-theme-primary border-theme-primary justify-end'
                  : 'bg-theme-warning border-theme-warning justify-start'
              }`}
            >
              <span className="w-5.5 h-5.5 rounded-full bg-white border border-black/10 block" />
            </span>
          </button>
        </div>
      </div>

      {/* 6 Compact Entity Delete Rows */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
        {wipeRows.map((row) => (
          <div
            key={row.key}
            className="px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-theme-text-primary">
                {row.label}
              </div>
              <div className="text-xs text-theme-text-secondary tabular-nums mt-0.5">
                {row.countLabel}
              </div>
            </div>

            <button
              type="button"
              aria-disabled={isLocked}
              onClick={() => handleRowDeleteClick(row)}
              className={`min-h-[44px] px-3.5 py-2 rounded-[12px] border text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors focus-visible:outline-hidden focus-visible:ring-2 ${
                isLocked
                  ? 'border-theme-border bg-theme-surface-subtle text-theme-text-muted hover:bg-theme-surface-hover focus-visible:ring-theme-primary'
                  : 'border-theme-danger-border bg-theme-surface text-theme-danger hover:bg-theme-danger-soft focus-visible:ring-theme-danger'
              }`}
            >
              {isLocked ? <Lock size={14} /> : <Trash2 size={14} />}
              <span>মুছুন</span>
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Separate Card: Full Factory Reset */}
      <div className="rounded-[14px] border border-theme-danger-border bg-theme-danger-soft/45 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[12px] border border-theme-danger-border bg-theme-surface text-theme-danger flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-sm font-bold text-theme-danger">
              সম্পূর্ণ ফ্যাক্টরি রিসেট
            </h2>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              সিস্টেমের সকল হাজিরা, প্রশিক্ষণার্থী, পরীক্ষা, মার্কস, ব্যাচ ও অডিট লগ স্থায়ীভাবে মুছে নতুন অবস্থায় ফিরিয়ে আনুন।
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-disabled={isLocked}
          onClick={handleTriggerFactoryReset}
          className={`min-h-[44px] px-4 py-2 rounded-[12px] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors focus-visible:outline-hidden focus-visible:ring-2 ${
            isLocked
              ? 'border border-theme-border bg-theme-surface text-theme-text-muted hover:bg-theme-surface-hover focus-visible:ring-theme-primary'
              : 'border border-theme-danger bg-theme-danger text-theme-danger-fg hover:opacity-90 focus-visible:ring-theme-danger'
          }`}
        >
          {isLocked ? <Lock size={14} /> : <Trash2 size={14} />}
          <span>সম্পূর্ণ রিসেট করুন</span>
        </button>
      </div>

      {/* Single Entity Delete Confirmation Dialog (requires DELETE) */}
      <SettingsConfirmDialog
        open={Boolean(activeWipeRow)}
        title={activeWipeRow ? `${activeWipeRow.label} মুছে ফেলুন` : ''}
        description={
          activeWipeRow
            ? `আপনি কি নিশ্চিতভাবে "${activeWipeRow.label}" এর সকল ডাটা স্থায়ীভাবে মুছে ফেলতে চান?`
            : ''
        }
        impactDetail={activeWipeRow?.detail}
        confirmLabel="স্থায়ীভাবে মুছুন"
        requireKeyword="DELETE"
        tone="danger"
        isProcessing={isDeleting}
        onConfirm={handleConfirmSingleWipe}
        onClose={() => {
          if (!isDeleting) setPendingWipe(null);
        }}
      />

      {/* Full Factory Reset Confirmation Dialog (requires RESET) */}
      <SettingsConfirmDialog
        open={factoryResetOpen}
        title="সম্পূর্ণ ফ্যাক্টরি রিসেট নিশ্চিত করুন"
        description="এই অপারেশনের মাধ্যমে ক্লাউড ডাটাবেজের সমস্ত প্রশিক্ষণ কার্যক্রম সংক্রান্ত তথ্য স্থায়ীভাবে মুছে যাবে।"
        impactDetail={`প্রভাবিত ডাটা: হাজিরা ${counts.attendance} টি · প্রশিক্ষণার্থী ${counts.trainees} জন · পরীক্ষা ${counts.exams} টি · মার্কস ${counts.marks} টি · ব্যাচ ${counts.batches} টি`}
        confirmLabel="ফ্যাক্টরি রিসেট সম্পন্ন করুন"
        requireKeyword="RESET"
        tone="danger"
        isProcessing={isDeleting}
        onConfirm={handleConfirmFactoryReset}
        onClose={() => {
          if (!isDeleting) setFactoryResetOpen(false);
        }}
      >
        <label className="min-h-[44px] px-3 py-2 rounded-[12px] border border-theme-border bg-theme-surface flex items-center gap-2.5 text-xs font-semibold text-theme-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={keepInstitutesAndTrades}
            onChange={(e) => setKeepInstitutesAndTrades(e.target.checked)}
            className="w-4 h-4 rounded border-theme-border-strong text-theme-primary focus:ring-theme-primary"
          />
          <span className="tabular-nums">
            প্রতিষ্ঠান ({counts.institutes}) ও ট্রেড ({counts.trades}) তালিকা সংরক্ষণ করুন
          </span>
        </label>
      </SettingsConfirmDialog>
    </div>
  );
};
