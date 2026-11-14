import React, { useMemo } from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import type { ActivityLog } from '../../types';
import {
  formatAuditValue,
  getCollectionLabelBn,
  getSnapshotFieldLabel,
} from './auditFormatters';

interface SnapshotViewProps {
  log: ActivityLog;
  isAdmin: boolean;
}

const HIDDEN_SNAPSHOT_KEYS = new Set(['id']);

export const SnapshotView: React.FC<SnapshotViewProps> = ({ log, isAdmin }) => {
  const snapshotEntries = useMemo(() => {
    if (!log.snapshot || typeof log.snapshot !== 'object') return [];
    return Object.entries(log.snapshot).filter(
      ([key, val]) => !HIDDEN_SNAPSHOT_KEYS.has(key) && val !== undefined
    );
  }, [log.snapshot]);

  const relatedSummary = useMemo(() => {
    const items = log.related || [];
    if (items.length === 0) return [];
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.collection, (map.get(item.collection) || 0) + 1);
    }
    return Array.from(map.entries()).map(([col, count]) => ({
      collection: col,
      label: getCollectionLabelBn(col),
      count,
    }));
  }, [log.related]);

  const isBulk = log.action === 'bulk_delete' || (log.count !== undefined && (log.targetNames?.length || 0) > 0);
  const previewNames = (log.targetNames || []).slice(0, 10);
  const totalBulkCount = log.count ?? log.targetNames?.length ?? log.related?.length ?? 0;
  const remainingCount = totalBulkCount > previewNames.length ? totalBulkCount - previewNames.length : 0;

  return (
    <div className="space-y-3">
      {/* Incomplete snapshot notice */}
      {log.snapshotComplete === false && (
        <div className="rounded-[12px] border border-theme-warning-border bg-theme-warning-soft px-3.5 py-2.5 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-theme-warning shrink-0 mt-0.5" />
          <p className="text-xs text-theme-text-primary leading-relaxed">
            সম্পূর্ণ স্ন্যাপশট সংরক্ষিত হয়নি — ডাটার পরিমাণ নির্ধারিত সীমার বেশি বা এটি ফ্যাক্টরি রিসেট অপারেশন ছিল।
          </p>
        </div>
      )}

      {/* Bulk delete summary & first 10 item names */}
      {isBulk && totalBulkCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-theme-text-secondary">
              প্রভাবিত রেকর্ড তালিকা
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-theme-border bg-theme-surface-subtle text-theme-text-primary tabular-nums">
              মোট {totalBulkCount} টি
            </span>
          </div>

          {previewNames.length > 0 && (
            <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3 space-y-2">
              <ul className="space-y-1">
                {previewNames.map((name, idx) => (
                  <li
                    key={`${name}-${idx}`}
                    className="text-xs text-theme-text-primary flex items-center gap-2"
                  >
                    <span className="w-5 h-5 rounded-md bg-theme-surface-subtle border border-theme-border text-[10px] font-mono text-theme-text-secondary inline-flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
              {remainingCount > 0 && (
                <p className="text-xs font-semibold text-theme-text-secondary pt-1 border-t border-theme-border tabular-nums">
                  আরও {remainingCount} টি রেকর্ড
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snapshot fields read-only view */}
      {snapshotEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-theme-text-secondary">
            সংরক্ষিত রেকর্ডের তথ্য (স্ন্যাপশট)
          </h3>
          <dl className="rounded-[14px] border border-theme-border bg-theme-surface divide-y divide-theme-border overflow-hidden">
            {snapshotEntries.map(([key, value]) => (
              <div
                key={key}
                className="px-3.5 py-2.5 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3"
              >
                <dt className="text-xs font-medium text-theme-text-secondary">
                  {getSnapshotFieldLabel(key)}
                </dt>
                <dd className="text-xs font-semibold text-theme-text-primary break-words">
                  {formatAuditValue(value, key, isAdmin)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Related dependent records summary */}
      {(relatedSummary.length > 0 || (log.snapshotChunkCount ?? 0) > 0) && (
        <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-theme-text-primary">
            <Database size={14} className="text-theme-text-secondary shrink-0" />
            <span className="tabular-nums">
              সংশ্লিষ্ট রেকর্ড:{' '}
              {relatedSummary.length > 0
                ? `${log.related?.length || 0} টি`
                : `${log.snapshotChunkCount} টি খণ্ডে সংরক্ষিত`}
            </span>
          </div>
          {relatedSummary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {relatedSummary.map((item) => (
                <span
                  key={item.collection}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-theme-border bg-theme-surface-subtle text-theme-text-secondary tabular-nums"
                >
                  {item.label}: {item.count} টি
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
