import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { AuditChange } from '../../types';
import { getFieldLabelBn } from '../../lib/auditLog';
import { formatAuditValue } from './auditFormatters';

interface DiffListProps {
  changes: AuditChange[];
  isAdmin: boolean;
}

export const DiffList: React.FC<DiffListProps> = ({ changes, isAdmin }) => {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-theme-text-secondary">
        পরিবর্তিত তথ্য ({changes.length} টি)
      </h3>
      <div className="rounded-[14px] border border-theme-border bg-theme-surface divide-y divide-theme-border overflow-hidden">
        {changes.map((change, idx) => {
          const label = change.label || getFieldLabelBn(change.field);
          const beforeStr = formatAuditValue(change.before, change.field, isAdmin);
          const afterStr = formatAuditValue(change.after, change.field, isAdmin);

          return (
            <div key={`${change.field}-${idx}`} className="p-3 space-y-1.5">
              <div className="text-xs font-semibold text-theme-text-primary">
                {label}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-block max-w-full break-words px-2 py-0.5 rounded-[8px] border border-theme-danger-border bg-theme-danger-soft text-theme-danger line-through">
                  {beforeStr}
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="text-theme-text-muted shrink-0"
                />
                <span className="inline-block max-w-full break-words px-2 py-0.5 rounded-[8px] border border-theme-success-border bg-theme-success-soft text-theme-success font-medium">
                  {afterStr}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
