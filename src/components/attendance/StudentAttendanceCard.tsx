import React, { useRef, useState } from 'react';
import type { AttendanceStatus, Trainee } from '../../types';
import { toBn } from '../../lib/dateUtils';
import {
  getDisplayInitial,
  getDisplayName,
  triggerHaptic,
  type ExtendedAttendanceStatus,
  type SevenDaySummary,
  type TraineeAttendanceItem,
} from './types';
import { TruncatedText } from '../ui/TruncatedText';

interface StudentAttendanceCardProps {
  item: TraineeAttendanceItem;
  summary: SevenDaySummary;
  isLocked: boolean;
  canInteract: boolean;
  onSelectStatus: (traineeId: string, status: AttendanceStatus) => void;
  onSwipeStatus: (traineeId: string, status: 'Present' | 'Absent') => void;
  onOpenDetail: (trainee: Trainee) => void;
}

const SWIPE_THRESHOLD = 80;
const MAX_DRAG_PX = 104;

export const StudentAttendanceCard: React.FC<StudentAttendanceCardProps> = ({
  item,
  summary,
  isLocked,
  canInteract,
  onSelectStatus,
  onSwipeStatus,
  onOpenDetail,
}) => {
  const { trainee, status, initialStatus, leaveReason, initialLeaveReason } = item;
  const isDirty =
    status !== initialStatus || (leaveReason || '') !== (initialLeaveReason || '');

  const [dragX, setDragX] = useState(0);
  const touchStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    axis: 'none' | 'x' | 'y';
  }>({ active: false, startX: 0, startY: 0, axis: 'none' });
  const lastSwipeAtRef = useRef(0);

  const disabled = isLocked || !canInteract;
  const displayName = getDisplayName(trainee);
  const initialLetter = getDisplayInitial(trainee);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStateRef.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      axis: 'none',
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const st = touchStateRef.current;
    if (!st.active || disabled || e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - st.startX;
    const dy = t.clientY - st.startY;

    if (st.axis === 'none') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.25) {
        st.axis = 'x';
      } else {
        st.axis = 'y';
        return;
      }
    }

    if (st.axis === 'x') {
      const clamped = Math.max(-MAX_DRAG_PX, Math.min(MAX_DRAG_PX, dx));
      setDragX(clamped);
    }
  };

  const handleTouchEnd = () => {
    const st = touchStateRef.current;
    if (!st.active) return;

    if (st.axis === 'x') {
      if (dragX >= SWIPE_THRESHOLD) {
        lastSwipeAtRef.current = Date.now();
        triggerHaptic(12);
        onSwipeStatus(item.id, 'Present');
      } else if (dragX <= -SWIPE_THRESHOLD) {
        lastSwipeAtRef.current = Date.now();
        triggerHaptic(12);
        onSwipeStatus(item.id, 'Absent');
      }
    }

    touchStateRef.current = { active: false, startX: 0, startY: 0, axis: 'none' };
    setDragX(0);
  };

  const handleNameTap = () => {
    if (Date.now() - lastSwipeAtRef.current < 320) return;
    onOpenDetail(trainee);
  };

  // Whole-card border & soft glow by status (no left border)
  const cardSurfaceClass =
    status === 'Present'
      ? 'border-[var(--green)]/45 bg-[var(--green)]/[0.06] shadow-[0_4px_16px_-6px_color-mix(in_srgb,var(--green)_35%,transparent)]'
      : status === 'Absent'
        ? 'border-[var(--red)]/45 bg-[var(--red)]/[0.06] shadow-[0_4px_16px_-6px_color-mix(in_srgb,var(--red)_35%,transparent)]'
        : status === 'Leave'
          ? 'border-[var(--amber)]/45 bg-[var(--amber)]/[0.07] shadow-[0_4px_16px_-6px_color-mix(in_srgb,var(--amber)_35%,transparent)]'
          : 'border-[var(--border)] bg-[var(--surface)] shadow-2xs';

  const avatarClass =
    status === 'Present'
      ? 'bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/30'
      : status === 'Absent'
        ? 'bg-[var(--red)]/15 text-[var(--red)] border-[var(--red)]/30'
        : status === 'Leave'
          ? 'bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/30'
          : 'bg-[var(--surface2)] text-[var(--muted)] border-[var(--border)]';

  const dotColorClass = (dotStatus: ExtendedAttendanceStatus) => {
    if (dotStatus === 'Present') return 'bg-[var(--green)]';
    if (dotStatus === 'Absent') return 'bg-[var(--red)]';
    if (dotStatus === 'Leave') return 'bg-[var(--amber)]';
    return 'bg-[var(--gray)]/35';
  };

  const showRightHint = dragX > 24;
  const showLeftHint = dragX < -24;

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Swipe Reveal Underlay */}
      {(showRightHint || showLeftHint) && (
        <div
          className={`absolute inset-0 rounded-2xl flex items-center px-4 text-sm font-medium text-white transition-opacity ${
            showRightHint
              ? 'justify-start bg-[var(--green)]/85'
              : 'justify-end bg-[var(--red)]/85'
          }`}
        >
          <span>{showRightHint ? 'উপস্থিত' : 'অনুপস্থিত'}</span>
        </div>
      )}

      {/* Main Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={
          dragX !== 0
            ? { transform: `translateX(${dragX}px)`, transition: 'none' }
            : { transform: 'translateX(0px)', transition: 'transform 180ms ease-out' }
        }
        className={`relative rounded-2xl border px-3 py-2.5 flex items-center justify-between gap-2.5 transition-colors select-none touch-pan-y ${cardSurfaceClass} ${
          isDirty ? '[outline:2px_dashed_var(--amber)] [outline-offset:-1px]' : ''
        }`}
      >
        {/* Left: Avatar + Name + 7-day strip + Leave tag (tappable for detail sheet) */}
        <button
          type="button"
          onClick={handleNameTap}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer rounded-xl py-0.5 active:opacity-75"
        >
          <div
            className={`w-10 h-10 rounded-full border flex items-center justify-center text-base font-medium shrink-0 ${avatarClass}`}
          >
            {initialLetter}
          </div>

          <div className="min-w-0 flex-1">
            <TruncatedText
              as="div"
              text={displayName}
              mode="pop"
              className="text-[15.5px] font-medium text-[var(--text)] leading-snug"
            />

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              {/* 7-day dots + % */}
              <div className="inline-flex items-center gap-1" aria-label="৭ দিনের হাজিরা">
                {summary.dots.map((d) => (
                  <span
                    key={d.date}
                    className={`w-[7px] h-[7px] rounded-full shrink-0 ${dotColorClass(d.status)}`}
                    title={`${toBn(d.dayNumber)} তারিখ`}
                  />
                ))}
                <span
                  className={`ml-1 text-[11.5px] tabular-nums leading-none ${
                    summary.isLow
                      ? 'text-[var(--red)] font-medium'
                      : 'text-[var(--muted)] font-normal'
                  }`}
                >
                  {summary.ratePercent !== null
                    ? `${summary.isLow ? '⚠ ' : ''}${toBn(summary.ratePercent)}%`
                    : '—'}
                </span>
              </div>

              {/* Leave reason tag */}
              {status === 'Leave' && leaveReason && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] leading-none bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/35 whitespace-nowrap">
                  {leaveReason}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Right: 3 compact 42px status buttons (উ, অ, ছু) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              triggerHaptic(10);
              onSelectStatus(item.id, 'Present');
            }}
            aria-label={`${displayName} উপস্থিত`}
            aria-pressed={status === 'Present'}
            className={`w-[42px] h-[42px] rounded-xl text-[15px] font-medium flex items-center justify-center border transition active:scale-95 ${
              status === 'Present'
                ? 'bg-[var(--green)] text-white dark:text-slate-950 border-[var(--green)] shadow-xs'
                : 'bg-[var(--surface2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
            } ${disabled ? 'opacity-55 cursor-not-allowed active:scale-100' : 'cursor-pointer'}`}
          >
            উ
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              triggerHaptic(10);
              onSelectStatus(item.id, 'Absent');
            }}
            aria-label={`${displayName} অনুপস্থিত`}
            aria-pressed={status === 'Absent'}
            className={`w-[42px] h-[42px] rounded-xl text-[15px] font-medium flex items-center justify-center border transition active:scale-95 ${
              status === 'Absent'
                ? 'bg-[var(--red)] text-white dark:text-slate-950 border-[var(--red)] shadow-xs'
                : 'bg-[var(--surface2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
            } ${disabled ? 'opacity-55 cursor-not-allowed active:scale-100' : 'cursor-pointer'}`}
          >
            অ
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              triggerHaptic(10);
              onSelectStatus(item.id, 'Leave');
            }}
            aria-label={`${displayName} ছুটি`}
            aria-pressed={status === 'Leave'}
            className={`w-[42px] h-[42px] rounded-xl text-[15px] font-medium flex items-center justify-center border transition active:scale-95 ${
              status === 'Leave'
                ? 'bg-[var(--amber)] text-white dark:text-slate-950 border-[var(--amber)] shadow-xs'
                : 'bg-[var(--surface2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
            } ${disabled ? 'opacity-55 cursor-not-allowed active:scale-100' : 'cursor-pointer'}`}
          >
            ছু
          </button>
        </div>
      </div>
    </div>
  );
};
