import React from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import type { ReportFieldKey, ReportTemplateColumn } from '../../../types';
import { toBn } from '../../../lib/dateUtils';
import {
  FIELD_CATALOG,
  FIELD_GROUPS_ORDER,
  getFieldOption,
  LastFocusTarget,
} from './fieldCatalog';
import { CodeAutocompleteField } from './CodeAutocompleteField';

interface BuilderColumnsEditorProps {
  columns: ReportTemplateColumn[];
  onChangeColumns: (next: ReportTemplateColumn[]) => void;
  onFocusTarget?: (target: LastFocusTarget) => void;
}

const MAX_COLUMNS = 20;

export const BuilderColumnsEditor: React.FC<BuilderColumnsEditorProps> = ({
  columns,
  onChangeColumns,
  onFocusTarget,
}) => {
  const handleAddColumn = () => {
    if (columns.length >= MAX_COLUMNS) return;
    const nextIdx = columns.length + 1;
    const nextCol: ReportTemplateColumn = {
      id: `col_${Date.now()}_${nextIdx}`,
      label: 'নতুন কলাম',
      field: 'blank',
      widthWeight: 12,
      align: 'center',
    };
    onChangeColumns([...columns, nextCol]);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length <= 1) return;
    onChangeColumns(columns.filter((c) => c.id !== id));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const copy = [...columns];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChangeColumns(copy);
  };

  const updateColumn = (id: string, patch: Partial<ReportTemplateColumn>) => {
    onChangeColumns(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleFieldChange = (
    col: ReportTemplateColumn,
    nextField: ReportFieldKey | 'custom' | 'blank'
  ) => {
    const prevMeta = getFieldOption(col.field);
    const nextMeta = getFieldOption(nextField);

    const shouldReplaceLabel =
      !col.label.trim() ||
      col.label === 'নতুন কলাম' ||
      (prevMeta && col.label === prevMeta.defaultColLabel);

    updateColumn(col.id, {
      field: nextField,
      label: shouldReplaceLabel && nextMeta ? nextMeta.defaultColLabel : col.label,
      widthWeight: nextMeta ? nextMeta.defaultWeight : col.widthWeight,
      align: nextMeta ? nextMeta.defaultAlign : col.align,
      ...(nextField === 'custom' ? { text: col.text || '' } : { text: undefined }),
    });
  };

  return (
    <div className="space-y-2.5">
      {columns.map((col, idx) => (
        <div
          key={col.id}
          className="rounded-[12px] border border-theme-border bg-theme-surface-subtle p-3 space-y-2.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-[8px] bg-theme-primary-soft text-theme-primary text-xs font-semibold grid place-items-center shrink-0 tabular-nums">
              {toBn(idx + 1)}
            </span>
            <strong className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-theme-text-primary truncate">
              {col.label.trim() || '(শিরোনামহীন)'}
            </strong>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleMove(idx, -1)}
                disabled={idx === 0}
                aria-label="কলাম উপরে নিন"
                className="min-w-[36px] min-h-[36px] rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary inline-flex items-center justify-center disabled:opacity-40 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleMove(idx, 1)}
                disabled={idx === columns.length - 1}
                aria-label="কলাম নিচে নিন"
                className="min-w-[36px] min-h-[36px] rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary inline-flex items-center justify-center disabled:opacity-40 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveColumn(col.id)}
                disabled={columns.length <= 1}
                aria-label="কলাম মুছুন"
                className="min-w-[36px] min-h-[36px] rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-danger-soft text-theme-danger inline-flex items-center justify-center disabled:opacity-40 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <label
                htmlFor={`crb-col-label-${col.id}`}
                className="block text-xs text-theme-text-secondary mb-1"
              >
                টেবিল হেড
              </label>
              <CodeAutocompleteField
                id={`crb-col-label-${col.id}`}
                maxLength={120}
                value={col.label}
                onFocus={() =>
                  onFocusTarget?.({ kind: 'column', index: idx, key: 'label' })
                }
                onChangeValue={(val) => updateColumn(col.id, { label: val })}
                placeholder="যেমন: প্রশিক্ষণার্থীর নাম"
                scope="document"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              />
            </div>

            <div>
              <label
                htmlFor={`crb-col-field-${col.id}`}
                className="block text-xs text-theme-text-secondary mb-1"
              >
                ঘরের তথ্য (ডাটা সোর্স)
              </label>
              <select
                id={`crb-col-field-${col.id}`}
                value={col.field}
                onChange={(e) =>
                  handleFieldChange(
                    col,
                    e.target.value as ReportFieldKey | 'custom' | 'blank'
                  )
                }
                className="w-full min-h-[44px] px-3 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                {FIELD_GROUPS_ORDER.map((grp) => (
                  <optgroup key={grp} label={grp}>
                    {FIELD_CATALOG.filter((f) => f.group === grp).map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.labelBn}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {col.field === 'custom' && (
              <div>
                <label
                  htmlFor={`crb-col-custom-${col.id}`}
                  className="block text-xs text-theme-text-secondary mb-1"
                >
                  সূত্র — <code className="font-mono">{'{{'}</code> লিখলে কোড সাজেশন আসবে
                </label>
                <CodeAutocompleteField
                  id={`crb-col-custom-${col.id}`}
                  multiline
                  rows={2}
                  maxLength={200}
                  value={col.text || ''}
                  onFocus={() =>
                    onFocusTarget?.({ kind: 'column', index: idx, key: 'text' })
                  }
                  onChangeValue={(val) => updateColumn(col.id, { text: val })}
                  placeholder="{{nameBn}}&#10;পিতা: {{fatherNameBn}}"
                  scope="all"
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary leading-relaxed resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={`crb-col-weight-${col.id}`}
                  className="block text-xs text-theme-text-secondary mb-1"
                >
                  প্রস্থ (আপেক্ষিক)
                </label>
                <input
                  id={`crb-col-weight-${col.id}`}
                  type="number"
                  min={3}
                  max={60}
                  value={col.widthWeight}
                  onChange={(e) =>
                    updateColumn(col.id, {
                      widthWeight: Math.min(100, Math.max(3, Number(e.target.value) || 10)),
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                />
              </div>

              <div>
                <label
                  htmlFor={`crb-col-align-${col.id}`}
                  className="block text-xs text-theme-text-secondary mb-1"
                >
                  সারিবদ্ধ
                </label>
                <select
                  id={`crb-col-align-${col.id}`}
                  value={col.align}
                  onChange={(e) =>
                    updateColumn(col.id, {
                      align: e.target.value as 'left' | 'center' | 'right',
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <option value="left">বামে</option>
                  <option value="center">মাঝে</option>
                  <option value="right">ডানে</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAddColumn}
        disabled={columns.length >= MAX_COLUMNS}
        className="w-full min-h-[46px] px-4 rounded-xl border border-dashed border-theme-primary bg-theme-surface hover:bg-theme-primary-soft/50 text-theme-primary text-sm font-medium inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
      >
        <Plus size={16} />
        <span>কলাম যোগ করুন ({toBn(columns.length)}/{toBn(MAX_COLUMNS)})</span>
      </button>
    </div>
  );
};
