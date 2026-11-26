import React from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import type { ReportTemplateSignature } from '../../../types';
import { toBn } from '../../../lib/dateUtils';
import type { LastFocusTarget } from './fieldCatalog';

interface BuilderSignaturesEditorProps {
  signatures: ReportTemplateSignature[];
  showSignatures: boolean;
  onChangeSignatures: (next: ReportTemplateSignature[]) => void;
  onToggleShowSignatures: (next: boolean) => void;
  onFocusTarget?: (target: LastFocusTarget) => void;
}

const MAX_SIGNATURES = 4;

export const BuilderSignaturesEditor: React.FC<BuilderSignaturesEditorProps> = ({
  signatures,
  showSignatures,
  onChangeSignatures,
  onToggleShowSignatures,
  onFocusTarget,
}) => {
  const handleAdd = () => {
    if (signatures.length >= MAX_SIGNATURES) return;
    const idx = signatures.length + 1;
    onChangeSignatures([
      ...signatures,
      {
        id: `sig_${Date.now()}_${idx}`,
        label: 'নতুন স্বাক্ষর',
        name: '',
        designation: '',
      },
    ]);
  };

  const handleRemove = (id: string) => {
    onChangeSignatures(signatures.filter((s) => s.id !== id));
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= signatures.length) return;
    const copy = [...signatures];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChangeSignatures(copy);
  };

  const updateSig = (id: string, patch: Partial<ReportTemplateSignature>) => {
    onChangeSignatures(
      signatures.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  return (
    <div className="space-y-3">
      <label className="min-h-[44px] flex items-center justify-between gap-3 cursor-pointer select-none border-b border-theme-border pb-2">
        <span className="text-sm text-theme-text-primary">
          রিপোর্টের শেষে স্বাক্ষর দেখান ({toBn(signatures.length)}/{toBn(MAX_SIGNATURES)})
        </span>
        <input
          type="checkbox"
          checked={showSignatures}
          onChange={(e) => onToggleShowSignatures(e.target.checked)}
          className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
        />
      </label>

      {signatures.map((sig, idx) => (
        <div
          key={sig.id}
          className="rounded-[12px] border border-theme-border bg-theme-surface-subtle p-3 space-y-2.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-[8px] bg-theme-primary-soft text-theme-primary text-xs font-semibold grid place-items-center shrink-0 tabular-nums">
              {toBn(idx + 1)}
            </span>
            <strong className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-theme-text-primary truncate">
              {sig.label.trim() || 'স্বাক্ষর'}
            </strong>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleMove(idx, -1)}
                disabled={idx === 0}
                aria-label="স্বাক্ষর আগে নিন"
                className="min-w-[36px] min-h-[36px] rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary inline-flex items-center justify-center disabled:opacity-40 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleMove(idx, 1)}
                disabled={idx === signatures.length - 1}
                aria-label="স্বাক্ষর পরে নিন"
                className="min-w-[36px] min-h-[36px] rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary inline-flex items-center justify-center disabled:opacity-40 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(sig.id)}
                aria-label="স্বাক্ষর মুছুন"
                className="min-w-[36px] min-h-[36px] rounded-[10px] border border-theme-border bg-theme-surface hover:bg-theme-danger-soft text-theme-danger inline-flex items-center justify-center transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label
                htmlFor={`crb-sig-label-${sig.id}`}
                className="block text-xs text-theme-text-secondary mb-1"
              >
                পদবি / লেবেল
              </label>
              <input
                id={`crb-sig-label-${sig.id}`}
                type="text"
                maxLength={120}
                value={sig.label}
                onFocus={() =>
                  onFocusTarget?.({ kind: 'signature', index: idx, key: 'label' })
                }
                onChange={(e) => updateSig(sig.id, { label: e.target.value })}
                placeholder="যেমন: প্রশিক্ষক / কোর্স পরিচালক"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              />
            </div>

            <div>
              <label
                htmlFor={`crb-sig-name-${sig.id}`}
                className="block text-xs text-theme-text-secondary mb-1"
              >
                নাম (ঐচ্ছিক — {'{{trainer}}'} ব্যবহারযোগ্য)
              </label>
              <input
                id={`crb-sig-name-${sig.id}`}
                type="text"
                maxLength={120}
                value={sig.name || ''}
                onFocus={() =>
                  onFocusTarget?.({ kind: 'signature', index: idx, key: 'name' })
                }
                onChange={(e) => updateSig(sig.id, { name: e.target.value })}
                placeholder="কর্মকর্তা / প্রশিক্ষকের নাম"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              />
            </div>

            <div>
              <label
                htmlFor={`crb-sig-desig-${sig.id}`}
                className="block text-xs text-theme-text-secondary mb-1"
              >
                অতিরিক্ত পরিচয়
              </label>
              <input
                id={`crb-sig-desig-${sig.id}`}
                type="text"
                maxLength={150}
                value={sig.designation || ''}
                onFocus={() =>
                  onFocusTarget?.({ kind: 'signature', index: idx, key: 'designation' })
                }
                onChange={(e) => updateSig(sig.id, { designation: e.target.value })}
                placeholder="যেমন: স্কিল ট্রেইনার"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              />
            </div>
          </div>
        </div>
      ))}

      {signatures.length < MAX_SIGNATURES && (
        <button
          type="button"
          onClick={handleAdd}
          className="w-full min-h-[46px] px-4 rounded-xl border border-dashed border-theme-primary bg-theme-surface hover:bg-theme-primary-soft/50 text-theme-primary text-sm font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
        >
          <Plus size={16} />
          <span>স্বাক্ষরের ঘর যোগ করুন</span>
        </button>
      )}

      <p className="text-xs text-theme-text-secondary bg-theme-surface-subtle rounded-[10px] px-3 py-2">
        নাম ফাঁকা রাখলে শুধু লাইন ও পদবি ছাপা হবে — হাতে স্বাক্ষরের জন্য।
      </p>
    </div>
  );
};
