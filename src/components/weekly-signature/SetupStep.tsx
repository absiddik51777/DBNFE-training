import React from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Info, Settings } from 'lucide-react';
import { toBnDigits, type WeekDayInfo } from './utils';

export interface BatchPickerOption {
  id: string;
  label: string;
  instituteName: string;
  tradeName: string;
  traineeCount: number;
}

interface BatchPickerProps {
  batches: BatchPickerOption[];
  selectedBatchId: string;
  loading: boolean;
  locked: boolean;
  onChangeBatch: (batchId: string) => void;
}

export const BatchPicker: React.FC<BatchPickerProps> = ({
  batches,
  selectedBatchId,
  loading,
  locked,
  onChangeBatch,
}) => {
  const selected = batches.find((b) => b.id === selectedBatchId) || null;

  return (
    <section className="rounded-[14px] bg-[var(--ws-surface)] border border-[var(--ws-border)] p-4 space-y-2.5">
      <label
        htmlFor="ws-batch-select"
        className="block text-[15.5px] font-semibold text-[var(--ws-text)]"
      >
        ১. ব্যাচ বাছুন
      </label>

      <select
        id="ws-batch-select"
        value={selectedBatchId}
        disabled={loading || locked || batches.length === 0}
        onChange={(e) => onChangeBatch(e.target.value)}
        className="w-full min-h-[44px] px-3.5 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14.5px] text-[var(--ws-text)] disabled:opacity-70 focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] cursor-pointer"
      >
        {loading ? (
          <option value="">ব্যাচ লোড হচ্ছে...</option>
        ) : batches.length === 0 ? (
          <option value="">কোনো ব্যাচ পাওয়া যায়নি</option>
        ) : (
          batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))
        )}
      </select>

      {selected && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[var(--ws-muted)] leading-snug tabular-nums">
          <span>{selected.instituteName}</span>
          <span aria-hidden="true">·</span>
          <span>{selected.tradeName}</span>
          <span aria-hidden="true">·</span>
          <span>প্রশিক্ষণার্থী: {toBnDigits(selected.traineeCount)} জন</span>
        </div>
      )}
    </section>
  );
};

interface WeekPickerProps {
  pickedDateIso: string;
  jumpedFromWeekend: boolean;
  onChangeDate: (isoDate: string) => void;
  onShiftWeek: (deltaWeeks: -1 | 1) => void;
}

export const WeekPicker: React.FC<WeekPickerProps> = ({
  pickedDateIso,
  jumpedFromWeekend,
  onChangeDate,
  onShiftWeek,
}) => {
  return (
    <section className="rounded-[14px] bg-[var(--ws-surface)] border border-[var(--ws-border)] p-4 space-y-3">
      <h2 className="text-[15.5px] font-semibold text-[var(--ws-text)]">
        ২. সপ্তাহ বাছুন
      </h2>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onShiftWeek(-1)}
          aria-label="আগের সপ্তাহ"
          className="w-[44px] h-[44px] rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-text)] hover:border-[var(--ws-accent)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
        >
          <ChevronLeft size={19} />
        </button>

        <div className="relative flex-1 min-w-0">
          <input
            type="date"
            value={pickedDateIso}
            onChange={(e) => {
              if (e.target.value) onChangeDate(e.target.value);
            }}
            aria-label="সপ্তাহের যেকোনো তারিখ বাছুন"
            className="w-full h-[44px] px-3.5 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14.5px] text-[var(--ws-text)] focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => onShiftWeek(1)}
          aria-label="পরের সপ্তাহ"
          className="w-[44px] h-[44px] rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-text)] hover:border-[var(--ws-accent)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
        >
          <ChevronRight size={19} />
        </button>
      </div>

      {jumpedFromWeekend && (
        <p
          role="status"
          className="rounded-[10px] bg-[var(--ws-accent)]/12 border border-[var(--ws-accent)]/30 px-3 py-2 text-[13px] text-[var(--ws-accent)] flex items-start gap-2 leading-snug"
        >
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>শুক্র ও শনিবার বন্ধ, তাই পরের রবিবার থেকে সপ্তাহ ধরা হয়েছে।</span>
        </p>
      )}
    </section>
  );
};

interface DayChecklistProps {
  weekDays: WeekDayInfo[];
  checkedIsos: Record<string, boolean>;
  onToggleDay: (iso: string) => void;
}

export const DayChecklist: React.FC<DayChecklistProps> = ({
  weekDays,
  checkedIsos,
  onToggleDay,
}) => {
  return (
    <section className="rounded-[14px] bg-[var(--ws-surface)] border border-[var(--ws-border)] p-4 space-y-3">
      <div>
        <h2 className="text-[15.5px] font-semibold text-[var(--ws-text)]">
          ৩. তারিখ নিশ্চিত করুন
        </h2>
        <p className="text-[12.5px] text-[var(--ws-muted)] mt-0.5 leading-snug">
          সরকারি ছুটি বা বিশেষ কারণে কোনো দিন বাদ দিতে চাইলে টিক চিহ্ন তুলে দিন।
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {weekDays.map((day) => {
          const checked = Boolean(checkedIsos[day.iso]);
          return (
            <label
              key={day.iso}
              className={`min-h-[54px] px-3.5 py-2.5 rounded-[12px] border flex items-center justify-between gap-3 cursor-pointer select-none transition ${
                checked
                  ? 'bg-[var(--ws-accent)]/10 border-[var(--ws-accent)] text-[var(--ws-text)]'
                  : 'bg-[var(--ws-surface2)] border-[var(--ws-border)] text-[var(--ws-muted)] opacity-80'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleDay(day.iso)}
                className="sr-only"
              />

              <div className="min-w-0">
                <div className="text-[14.5px] font-medium text-[var(--ws-text)] leading-snug">
                  {day.weekdayBn}
                </div>
                <div className="text-[12.5px] text-[var(--ws-muted)] leading-snug tabular-nums">
                  {day.fullDateBn}
                </div>
              </div>

              {/* Custom checkmark indicator */}
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                  checked
                    ? 'bg-[var(--ws-accent)] border-[var(--ws-accent)] text-white dark:text-slate-950'
                    : 'bg-[var(--ws-surface)] border-[var(--ws-border)] text-transparent'
                }`}
              >
                <Check size={15} strokeWidth={2.75} />
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
};

interface SetupStepProps {
  batches: BatchPickerOption[];
  selectedBatchId: string;
  loadingBatches: boolean;
  batchLocked: boolean;
  onChangeBatch: (batchId: string) => void;
  pickedDateIso: string;
  jumpedFromWeekend: boolean;
  weekDays: WeekDayInfo[];
  checkedIsos: Record<string, boolean>;
  selectedCount: number;
  onChangeDate: (isoDate: string) => void;
  onShiftWeek: (deltaWeeks: -1 | 1) => void;
  onToggleDay: (iso: string) => void;
  onConfirm: () => void;
  onOpenHeadingSettings: () => void;
}

export const SetupStep: React.FC<SetupStepProps> = ({
  batches,
  selectedBatchId,
  loadingBatches,
  batchLocked,
  onChangeBatch,
  pickedDateIso,
  jumpedFromWeekend,
  weekDays,
  checkedIsos,
  selectedCount,
  onChangeDate,
  onShiftWeek,
  onToggleDay,
  onConfirm,
  onOpenHeadingSettings,
}) => {
  const canCreate =
    selectedCount > 0 && !loadingBatches && (batches.length === 0 || Boolean(selectedBatchId));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[var(--ws-accent)]">
            <CalendarDays size={20} />
            <span className="text-xs font-medium">হাতে স্বাক্ষরের জন্য প্রিন্ট ফরম্যাট</span>
          </div>
          <h1 className="text-[21px] sm:text-[23px] font-semibold text-[var(--ws-text)] leading-tight">
            সাপ্তাহিক স্বাক্ষর হাজিরা সিট
          </h1>
          <p className="text-[13.5px] text-[var(--ws-muted)] leading-relaxed">
            একটি সিটে এক সপ্তাহের (রবি – বৃহস্পতি, ৫ দিন) হাজিরা থাকবে। শুক্র ও শনিবার বন্ধ।
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenHeadingSettings}
          aria-label="পেইজ ও হেডিং সেটিংস"
          title="পেইজ, ফন্ট ও হেডিং সেটিংস"
          className="w-11 h-11 rounded-[12px] bg-[var(--ws-surface)] border border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)] hover:border-[var(--ws-accent)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
        >
          <Settings size={18} />
        </button>
      </div>

      <BatchPicker
        batches={batches}
        selectedBatchId={selectedBatchId}
        loading={loadingBatches}
        locked={batchLocked}
        onChangeBatch={onChangeBatch}
      />

      <WeekPicker
        pickedDateIso={pickedDateIso}
        jumpedFromWeekend={jumpedFromWeekend}
        onChangeDate={onChangeDate}
        onShiftWeek={onShiftWeek}
      />

      <DayChecklist
        weekDays={weekDays}
        checkedIsos={checkedIsos}
        onToggleDay={onToggleDay}
      />

      <button
        type="button"
        disabled={!canCreate}
        onClick={onConfirm}
        className="w-full h-[48px] px-5 rounded-[14px] bg-[var(--ws-accent)] text-white dark:text-slate-950 text-[15px] font-medium flex items-center justify-center transition cursor-pointer active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
      >
        {loadingBatches
          ? 'তথ্য লোড হচ্ছে...'
          : canCreate
          ? `সিট তৈরি করুন (${toBnDigits(selectedCount)} দিন)`
          : 'কমপক্ষে একটি তারিখ বাছুন'}
      </button>
    </div>
  );
};
