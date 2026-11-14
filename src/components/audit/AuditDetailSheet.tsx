import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, CheckCircle2, DatabaseBackup, RotateCcw, X } from 'lucide-react';
import type { ActivityLog } from '../../types';
import { undoChange, restoreRecord } from '../../lib/auditActions';
import type { AuditActor } from '../../lib/auditLog';
import {
  formatAuditTimestamp,
  formatAuditValue,
  getActionLabelBn,
  getCollectionLabelBn,
  getModuleLabelBn,
} from './auditFormatters';
import { DiffList } from './DiffList';
import { LocationRow } from './LocationRow';
import { SnapshotView } from './SnapshotView';
import { ConfirmActionDialog } from './ConfirmActionDialog';

interface AuditDetailSheetProps {
  log: ActivityLog | null;
  isAdmin: boolean;
  actor?: AuditActor;
  onClose: () => void;
  onActionSuccess?: (message: string) => Promise<void> | void;
  onNavigateToData?: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const AuditDetailSheet: React.FC<AuditDetailSheetProps> = ({
  log,
  isAdmin,
  actor,
  onClose,
  onActionSuccess,
  onNavigateToData,
  triggerRef,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef(false);

  const [confirmMode, setConfirmMode] = useState<'undo' | 'restore' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset confirmation dialog whenever selected log changes
  useEffect(() => {
    setConfirmMode(null);
    setActionError(null);
    setIsProcessing(false);
  }, [log?.id]);

  useEffect(() => {
    const isOpen = Boolean(log);

    if (isOpen && !prevOpenRef.current) {
      window.setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 10);
    }

    if (!isOpen && prevOpenRef.current) {
      const btn = triggerRef?.current;
      if (btn && typeof btn.focus === 'function') {
        window.setTimeout(() => btn.focus(), 10);
      }
    }

    prevOpenRef.current = isOpen;
  }, [log, triggerRef]);

  useEffect(() => {
    if (!log) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmMode) return; // Let ConfirmActionDialog handle Escape/focus while open

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
          if (document.activeElement === first || !sheetRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !sheetRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmMode, log, onClose]);

  const canUndo = Boolean(
    isAdmin &&
      log &&
      log.action === 'update' &&
      !log.reverted &&
      log.collection &&
      log.targetId &&
      Array.isArray(log.changes) &&
      log.changes.length > 0
  );

  const isDeleteLog = Boolean(
    log && (log.action === 'delete' || log.action === 'bulk_delete')
  );

  const hasRestorableSnapshot = Boolean(
    log &&
      ((log.snapshot && typeof log.snapshot === 'object' && Object.keys(log.snapshot).length > 0) ||
        (Array.isArray(log.related) && log.related.length > 0) ||
        (log.snapshotChunkCount ?? 0) > 0)
  );

  const canRestore = Boolean(
    isAdmin &&
      isDeleteLog &&
      log &&
      !log.reverted &&
      log.snapshotComplete !== false &&
      hasRestorableSnapshot
  );

  const showBackupRestoreHint = Boolean(
    isAdmin && isDeleteLog && log && !log.reverted && log.snapshotComplete === false
  );

  const confirmSummaryLines = useMemo(() => {
    if (!log || !confirmMode) return [];
    if (confirmMode === 'undo') {
      return (log.changes || []).map(
        (c) =>
          `${c.label || c.field}: ${formatAuditValue(c.after, c.field, isAdmin)} → ${formatAuditValue(c.before, c.field, isAdmin)}`
      );
    }

    const lines: string[] = [];
    if (log.action === 'delete' && log.targetLabel) {
      lines.push(`মূল রেকর্ড: ${log.targetLabel}`);
    } else if (log.action === 'bulk_delete') {
      const total = log.count ?? log.related?.length ?? 0;
      lines.push(`মোট রেকর্ড: ${total} টি`);
      (log.targetNames || []).slice(0, 5).forEach((name) => {
        lines.push(name);
      });
      if ((log.count ?? 0) > 5) {
        lines.push(`এবং আরও ${(log.count ?? 0) - 5} টি রেকর্ড`);
      }
    }
    if ((log.related?.length ?? 0) > 0 && log.action === 'delete') {
      lines.push(`সংশ্লিষ্ট রেকর্ড: ${log.related!.length} টি`);
    } else if ((log.snapshotChunkCount ?? 0) > 0) {
      lines.push(`স্ন্যাপশট খণ্ড: ${log.snapshotChunkCount} টি`);
    }
    return lines;
  }, [confirmMode, isAdmin, log]);

  if (!log) return null;

  const actorName = log.user || log.userName || 'অজানা';
  const moduleLabel = getModuleLabelBn(log.module);
  const actionLabel = getActionLabelBn(log.action);
  const collectionLabel = getCollectionLabelBn(log.collection);
  const formattedTime = formatAuditTimestamp(log.createdAt ?? log.timestamp);
  const revertedTime = formatAuditTimestamp(log.revertedAt);

  const handleConfirmExecute = async () => {
    if (!confirmMode || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      let msg = '';
      if (confirmMode === 'undo') {
        const res = await undoChange(log, actor);
        msg = `${res.revertedFields} টি ক্ষেত্রের পরিবর্তন সফলভাবে পূর্বাবস্থায় ফেরত নেওয়া হয়েছে।`;
      } else {
        const res = await restoreRecord(log, actor);
        msg =
          res.skippedCount > 0
            ? `${res.restoredCount} টি রেকর্ড পুনরুদ্ধার করা হয়েছে (${res.skippedCount} টি ইতোমধ্যে বিদ্যমান থাকায় স্কিপ করা হয়েছে)।`
            : `${res.restoredCount} টি রেকর্ড সফলভাবে পুনরুদ্ধার করা হয়েছে।`;
      }
      setConfirmMode(null);
      if (onActionSuccess) {
        await onActionSuccess(msg);
      }
    } catch (err: any) {
      setActionError(err?.message || 'অপারেশনটি সম্পন্ন করা যায়নি।');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-black/50 backdrop-blur-[1px] motion-reduce:transition-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-sheet-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !confirmMode) {
            onClose();
          }
        }}
      >
        <div
          ref={sheetRef}
          className="w-full md:w-[480px] max-h-[88dvh] md:max-h-full md:h-full bg-theme-elevated border-t md:border-t-0 md:border-l border-theme-border rounded-t-[18px] md:rounded-none md:rounded-l-[18px] flex flex-col overflow-hidden motion-reduce:transition-none"
        >
          {/* Header */}
          <header className="px-4 sm:px-5 py-3.5 border-b border-theme-border flex items-start justify-between gap-3 shrink-0 bg-theme-surface">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {actionLabel && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-theme-primary-soft text-theme-primary border border-theme-primary/20">
                    {actionLabel}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-theme-surface-subtle text-theme-text-secondary border border-theme-border">
                  {moduleLabel}
                </span>
              </div>
              <h2
                id="audit-detail-sheet-title"
                className="text-sm sm:text-base font-bold text-theme-text-primary leading-snug break-words"
              >
                {log.title || log.action}
              </h2>
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="বিস্তারিত বন্ধ করুন"
              className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 inline-flex items-center justify-center rounded-[12px] text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-hover transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary shrink-0"
            >
              <X size={18} />
            </button>
          </header>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
            {/* Reverted status banner */}
            {log.reverted && (
              <div className="rounded-[12px] border border-theme-success-border bg-theme-success-soft px-3.5 py-2.5 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-theme-success shrink-0 mt-0.5" />
                <div className="text-xs text-theme-text-primary leading-relaxed">
                  <span className="font-bold">ফেরত নেওয়া হয়েছে</span>
                  {log.revertedBy ? ` · ${log.revertedBy}` : ''}
                  {revertedTime ? ` · ${revertedTime}` : ''}
                </div>
              </div>
            )}

            {/* Actor & Meta card */}
            <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[11px] text-theme-text-muted">ব্যবহারকারী</div>
                <div className="font-semibold text-theme-text-primary mt-0.5">
                  {actorName}
                  {log.userRole ? (
                    <span className="ml-1.5 text-[11px] font-normal text-theme-text-secondary">
                      ({log.userRole})
                    </span>
                  ) : null}
                </div>
              </div>

              {formattedTime && (
                <div>
                  <div className="text-[11px] text-theme-text-muted">সময়</div>
                  <div className="font-mono tabular-nums font-medium text-theme-text-primary mt-0.5">
                    {formattedTime}
                  </div>
                </div>
              )}

              {(log.targetLabel || collectionLabel) && (
                <div className="sm:col-span-2 pt-2 border-t border-theme-border flex flex-wrap items-center justify-between gap-2">
                  {log.targetLabel && (
                    <div>
                      <span className="text-[11px] text-theme-text-muted">লক্ষ্য: </span>
                      <span className="font-semibold text-theme-text-primary">
                        {log.targetLabel}
                      </span>
                    </div>
                  )}
                  {collectionLabel && (
                    <span className="text-[11px] text-theme-text-secondary">
                      সংগ্রহ: {collectionLabel}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Location (shown when captured) */}
            <LocationRow location={log.location} isAdmin={isAdmin} />

            {/* Field diffs (update) */}
            {Array.isArray(log.changes) && log.changes.length > 0 && (
              <DiffList changes={log.changes} isAdmin={isAdmin} />
            )}

            {/* Snapshot / Bulk delete / Related docs */}
            <SnapshotView log={log} isAdmin={isAdmin} />

            {/* Optional extra details note */}
            {log.details && log.details !== (log.title || log.action) && (
              <div className="rounded-[12px] border border-theme-border bg-theme-surface-subtle px-3.5 py-2.5 text-xs text-theme-text-secondary leading-relaxed">
                {log.details}
              </div>
            )}
          </div>

          {/* Admin-only Footer Actions */}
          {(canUndo || canRestore || showBackupRestoreHint) && (
            <footer className="px-4 sm:px-5 py-3 border-t border-theme-border bg-theme-surface shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              {canUndo && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirmMode('undo');
                  }}
                  className="min-h-[44px] w-full px-4 py-2 rounded-[12px] border border-theme-primary bg-theme-primary hover:bg-theme-primary-hover text-xs sm:text-sm font-semibold text-theme-primary-fg inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <RotateCcw size={16} />
                  <span>পরিবর্তন ফেরত নিন (Undo Change)</span>
                </button>
              )}

              {canRestore && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirmMode('restore');
                  }}
                  className="min-h-[44px] w-full px-4 py-2 rounded-[12px] border border-theme-primary bg-theme-primary hover:bg-theme-primary-hover text-xs sm:text-sm font-semibold text-theme-primary-fg inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <ArchiveRestore size={16} />
                  <span>পুনরুদ্ধার করুন (Restore)</span>
                </button>
              )}

              {showBackupRestoreHint && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-xs font-medium text-theme-text-secondary">
                    ব্যাকআপ থেকে পুনরুদ্ধার করুন
                  </span>
                  {onNavigateToData && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToData();
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs font-semibold text-theme-primary inline-flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary shrink-0"
                    >
                      <DatabaseBackup size={15} />
                      <span>ডাটা ব্যবস্থাপনা</span>
                    </button>
                  )}
                </div>
              )}
            </footer>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Undo / Restore */}
      <ConfirmActionDialog
        open={confirmMode !== null}
        mode={confirmMode || 'undo'}
        title={
          confirmMode === 'undo'
            ? 'পরিবর্তন ফেরত নেওয়ার নিশ্চিতকরণ'
            : 'রেকর্ড পুনরুদ্ধারের নিশ্চিতকরণ'
        }
        summaryLines={confirmSummaryLines}
        warningNote={
          confirmMode === 'undo'
            ? 'সর্বশেষ অবস্থার সাথে মিল না থাকলে স্বয়ংক্রিয়ভাবে বাতিল হবে এবং কোনো তথ্য ওভাররাইট করা হবে না।'
            : 'বিদ্যমান কোনো আইডি আগে থেকেই থাকলে তা ওভাররাইট না করে নিরাপদে স্কিপ করা হবে।'
        }
        confirmLabel={
          confirmMode === 'undo' ? 'হ্যাঁ, ফেরত নিন' : 'হ্যাঁ, পুনরুদ্ধার করুন'
        }
        isProcessing={isProcessing}
        errorMessage={actionError}
        onConfirm={handleConfirmExecute}
        onClose={() => {
          if (!isProcessing) {
            setConfirmMode(null);
            setActionError(null);
          }
        }}
      />
    </>
  );
};

