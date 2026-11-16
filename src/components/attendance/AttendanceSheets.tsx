import React, { useEffect, useMemo, useState } from 'react';
import { X, Phone, Lock, Check } from 'lucide-react';
import type { AttendanceRecord, Batch, Trainee } from '../../types';
import { toBn } from '../../lib/dateUtils';
import { useActionRunner, type ActionStep } from '../../hooks/useActionRunner';
import { ActionButton } from '../ui/ActionButton';
import {
  BN_MONTHS,
  EDIT_UNLOCK_REASONS,
  LEAVE_REASONS,
  getDisplayInitial,
  getDisplayName,
  type ExtendedAttendanceStatus,
} from './types';
import { TruncatedText } from '../ui/TruncatedText';

interface BottomSheetShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const BottomSheetShell: React.FC<BottomSheetShellProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[560px] bg-[var(--surface)] text-[var(--text)] border-t border-x border-[var(--border)] rounded-t-[24px] shadow-2xl max-h-[88vh] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <TruncatedText
              as="h2"
              text={title}
              mode="pop"
              className="text-[17px] font-medium text-[var(--text)] leading-snug"
            />
            {subtitle && (
              <TruncatedText
                as="p"
                text={subtitle}
                mode="pop"
                className="text-xs text-[var(--muted)] mt-0.5"
              />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="w-9 h-9 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sheet Body */}
        <div className="p-4 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 1. Leave Reason Bottom Sheet                                               */
/* -------------------------------------------------------------------------- */

interface LeaveReasonSheetProps {
  trainee: Trainee | null;
  currentReason?: string;
  onSelectReason: (reason: string) => void;
  onClose: () => void;
}

export const LeaveReasonSheet: React.FC<LeaveReasonSheetProps> = ({
  trainee,
  currentReason,
  onSelectReason,
  onClose,
}) => {
  return (
    <BottomSheetShell
      open={Boolean(trainee)}
      onClose={onClose}
      title="ছুটির কারণ নির্বাচন করুন"
      subtitle={trainee ? getDisplayName(trainee) : undefined}
    >
      <div className="grid grid-cols-1 gap-2.5">
        {LEAVE_REASONS.map((reason) => {
          const isSelected = currentReason === reason;
          return (
            <button
              key={reason}
              type="button"
              onClick={() => onSelectReason(reason)}
              className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between transition active:scale-[0.99] cursor-pointer ${
                isSelected
                  ? 'border-[var(--amber)] bg-[var(--amber)]/12 text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] hover:border-[var(--amber)]/50'
              }`}
            >
              <span className="text-[15.5px] font-medium">{reason}</span>
              {isSelected && <Check size={18} className="text-[var(--amber)] shrink-0" />}
            </button>
          );
        })}
      </div>
    </BottomSheetShell>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Edit Unlock Reason Bottom Sheet                                         */
/* -------------------------------------------------------------------------- */

interface EditUnlockReasonSheetProps {
  open: boolean;
  dateLabel: string;
  onConfirmReason: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

export const EditUnlockReasonSheet: React.FC<EditUnlockReasonSheetProps> = ({
  open,
  dateLabel,
  onConfirmReason,
  onClose,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');

  const steps: ActionStep<{ reason: string }>[] = useMemo(
    () => [
      {
        id: 'unlock-attendance-day',
        label: 'সম্পাদনার অনুমতি ও অডিট লগ সংরক্ষণ',
        run: async () => {
          await onConfirmReason(selectedReason);
          return { reason: selectedReason };
        },
        describe: (res) => `আনলক সম্পন্ন (${res.reason})`,
      },
    ],
    [onConfirmReason, selectedReason]
  );

  const runner = useActionRunner(steps);
  const isBusy = runner.phase === 'running' || runner.phase === 'waiting';
  const isSuccess = runner.phase === 'success';

  useEffect(() => {
    if (open) {
      setSelectedReason('');
      runner.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <BottomSheetShell
      open={open}
      onClose={() => {
        if (!isBusy) onClose();
      }}
      title="হাজিরা সম্পাদনার কারণ"
      subtitle={`${dateLabel} · কারণটি অডিট লগে সংরক্ষিত হবে`}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {EDIT_UNLOCK_REASONS.map((reason) => {
            const active = selectedReason === reason;
            return (
              <button
                key={reason}
                type="button"
                disabled={isBusy || isSuccess}
                onClick={() => setSelectedReason(reason)}
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer disabled:opacity-60 ${
                  active
                    ? 'border-[var(--amber)] bg-[var(--amber)]/12 text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] hover:border-[var(--amber)]/45'
                }`}
              >
                <span className="text-[15px] font-medium">{reason}</span>
                {active && <Check size={18} className="text-[var(--amber)] shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 flex items-start gap-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="flex-1 min-h-[46px] rounded-2xl border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[15px] font-medium cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isSuccess ? 'বন্ধ করুন' : 'বাতিল'}
          </button>
          <ActionButton
            runner={runner}
            idleLabel="আনলক করুন"
            idleIcon={<Lock size={15} />}
            popoverTitle="আনলক প্রক্রিয়া"
            disabled={!selectedReason}
            onAutoHide={onClose}
            className="flex-1 min-w-0"
            buttonClassName="min-h-[46px] rounded-2xl text-[15px]"
          />
        </div>
      </div>
    </BottomSheetShell>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Student Detail Bottom Sheet                                             */
/* -------------------------------------------------------------------------- */

interface StudentDetailSheetProps {
  trainee: Trainee | null;
  monthPrefix: string; // YYYY-MM
  maxDayInMonth: number; // e.g., 15
  batchAttendanceRecords: AttendanceRecord[];
  liveSelectedDate: string;
  liveStatusForSelectedDate?: ExtendedAttendanceStatus;
  onClose: () => void;
}

export const StudentDetailSheet: React.FC<StudentDetailSheetProps> = ({
  trainee,
  monthPrefix,
  maxDayInMonth,
  batchAttendanceRecords,
  liveSelectedDate,
  liveSelectedDate: _unused,
  liveStatusForSelectedDate,
  onClose,
}) => {
  void _unused;
  if (!trainee) return null;

  const traineeRecords = batchAttendanceRecords.filter((r) => r.traineeId === trainee.id);
  const recordByDate = new Map<string, ExtendedAttendanceStatus>();
  traineeRecords.forEach((r) => recordByDate.set(r.date, r.status));
  if (liveStatusForSelectedDate) {
    recordByDate.set(liveSelectedDate, liveStatusForSelectedDate);
  }

  let presentTotal = 0;
  let absentTotal = 0;
  let leaveTotal = 0;
  recordByDate.forEach((st) => {
    if (st === 'Present') presentTotal++;
    else if (st === 'Absent') absentTotal++;
    else if (st === 'Leave') leaveTotal++;
  });

  const markedTotal = presentTotal + absentTotal + leaveTotal;
  const overallRate = markedTotal > 0 ? Math.round((presentTotal / markedTotal) * 100) : 0;

  const [yStr, mStr] = monthPrefix.split('-');
  const monthIdx = Math.max(0, Math.min(11, parseInt(mStr || '1', 10) - 1));
  const monthTitle = `${BN_MONTHS[monthIdx]} ${toBn(yStr || '')}`;

  const days = Array.from({ length: maxDayInMonth }, (_, i) => i + 1);
  const phone = (trainee.mobileNumber || '').trim();

  return (
    <BottomSheetShell
      open={Boolean(trainee)}
      onClose={onClose}
      title={getDisplayName(trainee)}
      subtitle={
        trainee.nameEn && trainee.nameEn !== trainee.nameBn ? trainee.nameEn : undefined
      }
    >
      <div className="space-y-4">
        {/* Profile + Phone Call CTA */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface2)] border border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[var(--green)]/15 text-[var(--green)] border border-[var(--green)]/30 flex items-center justify-center text-lg font-medium shrink-0">
              {getDisplayInitial(trainee)}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--muted)]">মোবাইল নম্বর</div>
              <TruncatedText
                as="div"
                text={phone ? toBn(phone) : 'নম্বর নেই'}
                mode="pop"
                className="text-[15px] font-medium text-[var(--text)] tabular-nums"
              />
            </div>
          </div>

          {phone && (
            <a
              href={`tel:${phone}`}
              className="min-h-[42px] px-3.5 rounded-xl bg-[var(--green)] text-white dark:text-slate-950 text-sm font-medium inline-flex items-center gap-1.5 shrink-0 active:scale-95"
            >
              <Phone size={15} />
              <span>কল করুন</span>
            </a>
          )}
        </div>

        {/* Total Counts */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2.5 rounded-2xl bg-[var(--green)]/10 border border-[var(--green)]/30 text-center">
            <div className="text-lg font-medium text-[var(--green)] tabular-nums">
              {toBn(presentTotal)}
            </div>
            <div className="text-[11.5px] text-[var(--muted)]">উপস্থিত</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[var(--red)]/10 border border-[var(--red)]/30 text-center">
            <div className="text-lg font-medium text-[var(--red)] tabular-nums">
              {toBn(absentTotal)}
            </div>
            <div className="text-[11.5px] text-[var(--muted)]">অনুপস্থিত</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[var(--amber)]/10 border border-[var(--amber)]/30 text-center">
            <div className="text-lg font-medium text-[var(--amber)] tabular-nums">
              {toBn(leaveTotal)}
            </div>
            <div className="text-[11.5px] text-[var(--muted)]">ছুটি</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] text-center">
            <div
              className={`text-lg font-medium tabular-nums ${
                markedTotal > 0 && overallRate < 70
                  ? 'text-[var(--red)]'
                  : 'text-[var(--text)]'
              }`}
            >
              {markedTotal > 0 ? `${toBn(overallRate)}%` : '—'}
            </div>
            <div className="text-[11.5px] text-[var(--muted)]">উপস্থিতি</div>
          </div>
        </div>

        {/* 15-Day Colored Grid (Days 1 to maxDayInMonth) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--text)]">
              চলতি মাসের হাজিরা ({monthTitle})
            </span>
            <span className="text-xs text-[var(--muted)]">
              দিন ১–{toBn(maxDayInMonth)}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {days.map((dayNum) => {
              const iso = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
              const st = recordByDate.get(iso) || 'Unmarked';
              const boxClass =
                st === 'Present'
                  ? 'bg-[var(--green)] text-white dark:text-slate-950 border-[var(--green)]'
                  : st === 'Absent'
                    ? 'bg-[var(--red)] text-white dark:text-slate-950 border-[var(--red)]'
                    : st === 'Leave'
                      ? 'bg-[var(--amber)] text-white dark:text-slate-950 border-[var(--amber)]'
                      : 'bg-[var(--surface2)] text-[var(--muted)] border-[var(--border)]';

              const labelBn =
                st === 'Present'
                  ? 'উ'
                  : st === 'Absent'
                    ? 'অ'
                    : st === 'Leave'
                      ? 'ছু'
                      : '·';

              return (
                <div
                  key={iso}
                  className={`rounded-xl border py-2 px-1 flex flex-col items-center justify-center ${boxClass}`}
                >
                  <span className="text-xs tabular-nums leading-none opacity-90">
                    {toBn(dayNum)}
                  </span>
                  <span className="text-xs font-medium mt-1 leading-none">{labelBn}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheetShell>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Monthly Heatmap Bottom Sheet                                            */
/* -------------------------------------------------------------------------- */

interface MonthlyHeatmapSheetProps {
  open: boolean;
  batchName: string;
  monthPrefix: string; // YYYY-MM
  maxDayInMonth: number;
  trainees: Trainee[];
  batchAttendanceRecords: AttendanceRecord[];
  liveSelectedDate: string;
  liveStatusByTraineeId: Record<string, ExtendedAttendanceStatus>;
  onClose: () => void;
}

export const MonthlyHeatmapSheet: React.FC<MonthlyHeatmapSheetProps> = ({
  open,
  batchName,
  monthPrefix,
  maxDayInMonth,
  trainees,
  batchAttendanceRecords,
  liveSelectedDate,
  liveStatusByTraineeId,
  onClose,
}) => {
  if (!open) return null;

  const [yStr, mStr] = monthPrefix.split('-');
  const monthIdx = Math.max(0, Math.min(11, parseInt(mStr || '1', 10) - 1));
  const monthTitle = `${BN_MONTHS[monthIdx]} ${toBn(yStr || '')}`;
  const days = Array.from({ length: maxDayInMonth }, (_, i) => i + 1);

  const recordLookup = new Map<string, ExtendedAttendanceStatus>();
  batchAttendanceRecords.forEach((r) => {
    if (r.date.startsWith(monthPrefix)) {
      recordLookup.set(`${r.traineeId}_${r.date}`, r.status);
    }
  });

  if (liveSelectedDate.startsWith(monthPrefix)) {
    Object.entries(liveStatusByTraineeId).forEach(([tid, st]) => {
      recordLookup.set(`${tid}_${liveSelectedDate}`, st);
    });
  }

  return (
    <BottomSheetShell
      open={open}
      onClose={onClose}
      title={`মাসিক হাজিরা শিট (${monthTitle})`}
      subtitle={batchName}
    >
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-max min-w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--surface2)] border-b border-[var(--border)]">
                <th className="sticky left-0 z-10 bg-[var(--surface2)] text-left px-3 py-2 font-medium text-[var(--text)] w-[140px] border-r border-[var(--border)]">
                  শিক্ষার্থীর নাম
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="px-1.5 py-2 text-center font-medium text-[var(--muted)] tabular-nums w-[28px]"
                  >
                    {toBn(d)}
                  </th>
                ))}
                <th className="px-2.5 py-2 text-right font-medium text-[var(--text)] w-[48px] border-l border-[var(--border)]">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((trainee) => {
                let present = 0;
                let marked = 0;

                const cells = days.map((dayNum) => {
                  const iso = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                  const st = recordLookup.get(`${trainee.id}_${iso}`) || 'Unmarked';
                  if (st !== 'Unmarked') {
                    marked++;
                    if (st === 'Present') present++;
                  }
                  const squareClass =
                    st === 'Present'
                      ? 'bg-[var(--green)]'
                      : st === 'Absent'
                        ? 'bg-[var(--red)]'
                        : st === 'Leave'
                          ? 'bg-[var(--amber)]'
                          : 'bg-[var(--gray)]/25';

                  return (
                    <td key={iso} className="px-1 py-2 text-center">
                      <span
                        className={`inline-block w-4 h-4 rounded-[4px] align-middle ${squareClass}`}
                        title={`${getDisplayName(trainee)} - ${toBn(dayNum)} তারিখ`}
                      />
                    </td>
                  );
                });

                const pct = marked > 0 ? Math.round((present / marked) * 100) : null;

                return (
                  <tr
                    key={trainee.id}
                    className="border-b last:border-b-0 border-[var(--border)]"
                  >
                    <td className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2 font-medium text-[var(--text)] w-[140px] border-r border-[var(--border)]">
                      <TruncatedText as="div" text={getDisplayName(trainee)} mode="pop" className="w-full" />
                    </td>
                    {cells}
                    <td
                      className={`px-2.5 py-2 text-right tabular-nums font-medium border-l border-[var(--border)] ${
                        pct !== null && pct < 70 ? 'text-[var(--red)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {pct !== null ? `${toBn(pct)}%` : '—'}
                    </td>
                  </tr>
                );
              })}

              {trainees.length === 0 && (
                <tr>
                  <td
                    colSpan={days.length + 2}
                    className="py-8 text-center text-[var(--muted)]"
                  >
                    কোনো শিক্ষার্থী পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)] pt-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-[var(--green)]" />
            উপস্থিত
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-[var(--red)]" />
            অনুপস্থিত
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-[var(--amber)]" />
            ছুটি
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-[var(--gray)]/35" />
            বাকি
          </span>
        </div>
      </div>
    </BottomSheetShell>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Batch Switcher Sheet (For Course Director / FMA only)                   */
/* -------------------------------------------------------------------------- */

interface BatchPickerSheetProps {
  open: boolean;
  batches: Batch[];
  selectedBatchId: string;
  onSelectBatch: (batchId: string) => void;
  onClose: () => void;
}

export const BatchPickerSheet: React.FC<BatchPickerSheetProps> = ({
  open,
  batches,
  selectedBatchId,
  onSelectBatch,
  onClose,
}) => {
  return (
    <BottomSheetShell
      open={open}
      onClose={onClose}
      title="ব্যাচ নির্বাচন করুন"
      subtitle={`মোট ${toBn(batches.length)}টি ব্যাচ`}
    >
      <div className="space-y-2">
        {batches.map((b) => {
          const active = b.id === selectedBatchId;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onSelectBatch(b.id);
                onClose();
              }}
              className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                active
                  ? 'border-[var(--green)] bg-[var(--green)]/10 text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text)]'
              }`}
            >
              <TruncatedText text={b.name} mode="pop" className="text-[15px] font-medium min-w-0" />
              {active && <Check size={18} className="text-[var(--green)] shrink-0" />}
            </button>
          );
        })}
      </div>
    </BottomSheetShell>
  );
};
