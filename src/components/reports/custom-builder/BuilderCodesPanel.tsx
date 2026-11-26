import React from 'react';
import { Copy, Plus } from 'lucide-react';
import {
  DATA_CODE_DICTIONARY,
  LastFocusTarget,
  ReportContextTokens,
} from './fieldCatalog';

interface BuilderCodesPanelProps {
  docContext: ReportContextTokens;
  sampleRowTokens: Record<string, string>;
  lastFocusTarget: LastFocusTarget | null;
  onCopyCode: (codeKey: string) => void;
  onInsertCode: (codeKey: string) => void;
}

const TARGET_LABEL: Record<LastFocusTarget['kind'], string> = {
  heading: 'শিরোনাম ট্যাব',
  column: 'টেবিল ট্যাব',
  signature: 'স্বাক্ষর ট্যাব',
};

export const BuilderCodesPanel: React.FC<BuilderCodesPanelProps> = ({
  docContext,
  sampleRowTokens,
  lastFocusTarget,
  onCopyCode,
  onInsertCode,
}) => {
  const getExample = (key: string): string => {
    if (key in sampleRowTokens) return sampleRowTokens[key] || '—';
    if (key in docContext) {
      return docContext[key as keyof ReportContextTokens] || '—';
    }
    return '—';
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-theme-text-secondary bg-theme-surface-subtle border border-theme-border rounded-[12px] px-3 py-2.5 leading-relaxed">
        যেকোনো ঘরে <strong className="text-theme-text-primary">{'{{কোড}}'}</strong>{' '}
        লিখলে রিপোর্টে আসল তথ্য বসবে। &quot;যোগ&quot; চাপলে শেষবার লেখা ঘরে (
        <span className="font-medium text-theme-primary">
          {lastFocusTarget
            ? TARGET_LABEL[lastFocusTarget.kind]
            : 'এখনও কোনো ঘর নির্বাচিত নেই — তখন কপি হবে'}
        </span>
        ) বসবে।
      </p>

      <div className="space-y-4">
        {DATA_CODE_DICTIONARY.map((grp) => (
          <div key={grp.group} className="space-y-1">
            <div className="flex items-center justify-between gap-2 pb-1">
              <h3 className="text-xs sm:text-sm font-medium text-theme-text-primary">
                {grp.group}
              </h3>
              <span className="text-[11px] text-theme-text-secondary">
                {grp.usage}
              </span>
            </div>

            <div className="divide-y divide-theme-border border-t border-theme-border">
              {grp.items.map((item) => {
                const exVal = getExample(item.key);
                return (
                  <div
                    key={item.key}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <code className="inline-block font-mono text-[12px] font-medium bg-theme-primary-soft text-theme-primary px-2 py-0.5 rounded-[7px] border border-theme-primary/20">
                        {`{{${item.key}}}`}
                      </code>
                      <div className="text-[11.5px] text-theme-text-secondary mt-0.5 truncate">
                        {item.desc} · যেমন: {exVal}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onCopyCode(item.key)}
                        className="min-h-[36px] px-2.5 rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary hover:text-theme-text-primary text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                      >
                        <Copy size={12} />
                        <span>কপি</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onInsertCode(item.key)}
                        className="min-h-[36px] px-2.5 rounded-[10px] border border-theme-primary/35 bg-theme-primary-soft text-theme-primary hover:opacity-90 text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                      >
                        <Plus size={12} />
                        <span>যোগ</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
