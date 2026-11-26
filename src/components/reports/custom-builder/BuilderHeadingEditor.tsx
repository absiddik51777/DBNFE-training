import React from 'react';
import type { ReportTemplate } from '../../../types';
import { HEADER_QUICK_TOKENS, LastFocusTarget } from './fieldCatalog';

interface BuilderHeadingEditorProps {
  heading: ReportTemplate['heading'];
  onChangeHeading: (next: ReportTemplate['heading']) => void;
  onFocusTarget?: (target: LastFocusTarget) => void;
}

export const BuilderHeadingEditor: React.FC<BuilderHeadingEditorProps> = ({
  heading,
  onChangeHeading,
  onFocusTarget,
}) => {
  const updateField = <K extends keyof ReportTemplate['heading']>(
    key: K,
    value: ReportTemplate['heading'][K]
  ) => {
    onChangeHeading({
      ...heading,
      [key]: value,
    });
  };

  const appendToken = (key: 'reportTitle' | 'memoNumber', tokenKey: string) => {
    updateField(key, `${heading[key] || ''}{{${tokenKey}}}`);
  };

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="crb-h-govt"
          className="block text-xs text-theme-text-secondary mb-1"
        >
          সরকারি শিরোনাম
        </label>
        <input
          id="crb-h-govt"
          type="text"
          maxLength={200}
          value={heading.govtTitle}
          onFocus={() => onFocusTarget?.({ kind: 'heading', key: 'govtTitle' })}
          onChange={(e) => updateField('govtTitle', e.target.value)}
          placeholder="গণপ্রজাতন্ত্রী বাংলাদেশ সরকার"
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
        />
      </div>

      <div>
        <label
          htmlFor="crb-h-office"
          className="block text-xs text-theme-text-secondary mb-1"
        >
          অফিসের নাম
        </label>
        <input
          id="crb-h-office"
          type="text"
          maxLength={200}
          value={heading.officeTitle}
          onFocus={() => onFocusTarget?.({ kind: 'heading', key: 'officeTitle' })}
          onChange={(e) => updateField('officeTitle', e.target.value)}
          placeholder="জেলা উপানুষ্ঠানিক শিক্ষা ব্যুরো"
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
        />
      </div>

      <div>
        <label
          htmlFor="crb-h-addr"
          className="block text-xs text-theme-text-secondary mb-1"
        >
          ঠিকানা
        </label>
        <input
          id="crb-h-addr"
          type="text"
          maxLength={250}
          value={heading.officeAddress}
          onFocus={() => onFocusTarget?.({ kind: 'heading', key: 'officeAddress' })}
          onChange={(e) => updateField('officeAddress', e.target.value)}
          placeholder="কালেক্টরেট ভবন, ময়মনসিংহ"
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
        />
      </div>

      <div>
        <label
          htmlFor="crb-h-title"
          className="block text-xs text-theme-text-secondary mb-1"
        >
          রিপোর্টের নাম
        </label>
        <input
          id="crb-h-title"
          type="text"
          maxLength={250}
          value={heading.reportTitle}
          onFocus={() => onFocusTarget?.({ kind: 'heading', key: 'reportTitle' })}
          onChange={(e) => updateField('reportTitle', e.target.value)}
          placeholder="প্রশিক্ষণ সমাপ্তির সনদ প্রদানের প্রস্তাব"
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {HEADER_QUICK_TOKENS.map((tok) => (
            <button
              key={tok.key}
              type="button"
              onClick={() => appendToken('reportTitle', tok.key)}
              className="min-h-[28px] px-2 py-0.5 rounded-[8px] border border-dashed border-theme-primary bg-theme-primary-soft text-theme-primary text-xs font-medium hover:opacity-90 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              + {tok.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="crb-h-program"
          className="block text-xs text-theme-text-secondary mb-1"
        >
          কার্যক্রমের বিবরণ
        </label>
        <textarea
          id="crb-h-program"
          rows={2}
          maxLength={400}
          value={heading.programTitle}
          onFocus={() => onFocusTarget?.({ kind: 'heading', key: 'programTitle' })}
          onChange={(e) => updateField('programTitle', e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary leading-relaxed resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
        />
      </div>

      <div className="divide-y divide-theme-border border-t border-theme-border pt-1">
        <div className="py-1.5 space-y-2">
          <label className="min-h-[44px] flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-sm text-theme-text-primary">
              স্মারক নম্বর ও তারিখ দেখান
            </span>
            <input
              type="checkbox"
              checked={heading.showMemo}
              onChange={(e) => updateField('showMemo', e.target.checked)}
              className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
            />
          </label>

          {heading.showMemo && (
            <div className="pb-1.5">
              <label
                htmlFor="crb-h-memo"
                className="block text-xs text-theme-text-secondary mb-1"
              >
                স্মারক নম্বর
              </label>
              <input
                id="crb-h-memo"
                type="text"
                maxLength={200}
                value={heading.memoNumber}
                onFocus={() => onFocusTarget?.({ kind: 'heading', key: 'memoNumber' })}
                onChange={(e) => updateField('memoNumber', e.target.value)}
                placeholder="৩৮.০১.৬১০০.০০১.{{batch}}/২৬"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {HEADER_QUICK_TOKENS.map((tok) => (
                  <button
                    key={tok.key}
                    type="button"
                    onClick={() => appendToken('memoNumber', tok.key)}
                    className="min-h-[28px] px-2 py-0.5 rounded-[8px] border border-dashed border-theme-primary bg-theme-primary-soft text-theme-primary text-xs font-medium hover:opacity-90 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                  >
                    + {tok.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="min-h-[44px] py-1.5 flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-theme-text-primary">
            প্রতিষ্ঠান · ট্রেড · ব্যাচ লাইন
          </span>
          <input
            type="checkbox"
            checked={heading.showMetaLine}
            onChange={(e) => updateField('showMetaLine', e.target.checked)}
            className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
