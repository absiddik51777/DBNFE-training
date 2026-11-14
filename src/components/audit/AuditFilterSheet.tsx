import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import {
  AUDIT_RANGE_CHIPS,
  AUDIT_TYPE_CHIPS,
  AuditDateRangePreset,
  AuditFilterType,
  AuditSheetFilters,
} from '../../lib/auditQueryBuilder';
import type { AuditLogUserOption } from '../../hooks/useAuditFilters';
import { FilterChip } from './FilterChip';

interface AuditFilterSheetProps {
  open: boolean;
  draft: AuditSheetFilters;
  onChangeDraft: React.Dispatch<React.SetStateAction<AuditSheetFilters>>;
  availableUsers: AuditLogUserOption[];
  customRangeError: string | null;
  pendingCount: number | null;
  pendingCountCapped: boolean;
  loadingPendingCount: boolean;
  onResetDraft: () => void;
  onApply: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const AuditFilterSheet: React.FC<AuditFilterSheetProps> = ({
  open,
  draft,
  onChangeDraft,
  availableUsers,
  customRangeError,
  pendingCount,
  pendingCountCapped,
  loadingPendingCount,
  onResetDraft,
  onApply,
  onClose,
  triggerRef,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef(false);

  const fromInputId = useId();
  const toInputId = useId();
  const userSelectId = useId();

  // Focus management: focus close button on open, return focus to filter button on close
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      window.setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 10);
    } else if (!open && prevOpenRef.current) {
      const btn = triggerRef.current;
      if (btn && typeof btn.focus === 'function') {
        window.setTimeout(() => btn.focus(), 10);
      }
    }
    prevOpenRef.current = open;
  }, [open, triggerRef]);

  // Escape key and Tab focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !sheetRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else if (
          document.activeElement === last ||
          !sheetRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const toggleType = (typeId: AuditFilterType) => {
    onChangeDraft((prev) => {
      const exists = prev.types.includes(typeId);
      return {
        ...prev,
        types: exists
          ? prev.types.filter((t) => t !== typeId)
          : [...prev.types, typeId],
      };
    });
  };

  const toggleRange = (rangeId: AuditDateRangePreset) => {
    onChangeDraft((prev) => {
      const nextRange = prev.range === rangeId ? null : rangeId;
      return {
        ...prev,
        range: nextRange,
        from: nextRange === 'custom' ? prev.from : '',
        to: nextRange === 'custom' ? prev.to : '',
      };
    });
  };

  const applyButtonLabel = customRangeError
    ? 'তারিখ যাচাই করুন'
    : loadingPendingCount
    ? 'হিসাব হচ্ছে...'
    : pendingCount !== null
    ? `${pendingCount}${pendingCountCapped ? '+' : ''} টি দেখুন`
    : 'ফিল্টার প্রয়োগ করুন';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-black/50 backdrop-blur-[1px] transition-opacity duration-150 motion-reduce:transition-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-filter-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="w-full md:w-[420px] max-h-[88dvh] md:max-h-full md:h-full bg-theme-elevated border-t md:border-t-0 md:border-l border-theme-border rounded-t-[20px] md:rounded-none md:rounded-l-[20px] flex flex-col overflow-hidden transition-transform duration-200 motion-reduce:transition-none"
      >
        {/* Mobile drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center md:hidden shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-theme-border-strong" aria-hidden="true" />
        </div>

        {/* Header */}
        <header className="px-4 sm:px-5 py-3 border-b border-theme-border flex items-center justify-between gap-3 shrink-0 bg-theme-surface">
          <h2
            id="audit-filter-sheet-title"
            className="text-base font-bold text-theme-text-primary"
          >
            ফিল্টার
          </h2>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="ফিল্টার বন্ধ করুন"
            className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center rounded-[12px] text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Filter Sections */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Section 1: ধরন (multi-select chips) */}
          <section aria-labelledby="filter-section-type" className="space-y-2.5">
            <h3
              id="filter-section-type"
              className="text-xs font-semibold text-theme-text-secondary"
            >
              ধরন
            </h3>
            <div className="flex flex-wrap gap-2">
              {AUDIT_TYPE_CHIPS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  label={chip.label}
                  selected={draft.types.includes(chip.id)}
                  onClick={() => toggleType(chip.id)}
                />
              ))}
            </div>
          </section>

          {/* Section 2: সময় (single-select chips + custom date range) */}
          <section aria-labelledby="filter-section-time" className="space-y-2.5">
            <h3
              id="filter-section-time"
              className="text-xs font-semibold text-theme-text-secondary"
            >
              সময়
            </h3>
            <div className="flex flex-wrap gap-2">
              {AUDIT_RANGE_CHIPS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  label={chip.label}
                  selected={draft.range === chip.id}
                  onClick={() => toggleRange(chip.id)}
                />
              ))}
            </div>

            {draft.range === 'custom' && (
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor={fromInputId}
                      className="block text-[11px] font-medium text-theme-text-secondary mb-1"
                    >
                      শুরুর তারিখ
                    </label>
                    <input
                      id={fromInputId}
                      type="date"
                      value={draft.from}
                      max={draft.to || undefined}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, from: e.target.value }))
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-[12px] bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-hidden focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={toInputId}
                      className="block text-[11px] font-medium text-theme-text-secondary mb-1"
                    >
                      শেষের তারিখ
                    </label>
                    <input
                      id={toInputId}
                      type="date"
                      value={draft.to}
                      min={draft.from || undefined}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, to: e.target.value }))
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-[12px] bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-hidden focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
                    />
                  </div>
                </div>

                {customRangeError && (
                  <p role="alert" className="text-xs font-medium text-theme-danger">
                    {customRangeError}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Section 3: ব্যবহারকারী (select) */}
          <section aria-labelledby="filter-section-user" className="space-y-2">
            <label
              id="filter-section-user"
              htmlFor={userSelectId}
              className="block text-xs font-semibold text-theme-text-secondary"
            >
              ব্যবহারকারী
            </label>
            <select
              id={userSelectId}
              value={draft.userId}
              onChange={(e) =>
                onChangeDraft((prev) => ({ ...prev, userId: e.target.value }))
              }
              className="w-full min-h-[44px] px-3 py-2 rounded-[12px] bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-hidden focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
            >
              <option value="">সব ব্যবহারকারী</option>
              {availableUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.label}
                </option>
              ))}
              {draft.userId &&
                !availableUsers.some((u) => u.userId === draft.userId) && (
                  <option value={draft.userId}>{draft.userId}</option>
                )}
            </select>
          </section>

          {/* Section 4: অবস্থান */}
          <section aria-labelledby="filter-section-location" className="space-y-2.5">
            <h3
              id="filter-section-location"
              className="text-xs font-semibold text-theme-text-secondary"
            >
              অবস্থান
            </h3>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="অবস্থানসহ"
                selected={draft.withLocation}
                onClick={() =>
                  onChangeDraft((prev) => ({
                    ...prev,
                    withLocation: !prev.withLocation,
                  }))
                }
              />
            </div>
          </section>
        </div>

        {/* Footer: Reset (draft only) & Primary Apply with live count */}
        <footer className="px-4 sm:px-5 py-3 border-t border-theme-border bg-theme-surface shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center gap-2.5">
          <button
            type="button"
            onClick={onResetDraft}
            className="min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-sm font-semibold text-theme-text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none"
          >
            রিসেট
          </button>

          <button
            type="button"
            disabled={Boolean(customRangeError)}
            onClick={onApply}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-[12px] border border-theme-primary bg-theme-primary hover:bg-theme-primary-hover text-sm font-semibold text-theme-primary-fg tabular-nums transition-colors disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none"
          >
            {applyButtonLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};
