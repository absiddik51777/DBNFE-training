import React from 'react';
import { Link } from 'react-router-dom';
import type { DocumentPrintConfig } from '../../../types';
import { useTheme } from '../../../contexts/ThemeContext';
import { toBn } from '../../../lib/dateUtils';
import { getAppFontCssStack, getAppFontOption } from '../../../lib/theme';

interface BuilderPageEditorProps {
  page: DocumentPrintConfig;
  useBengaliDigits: boolean;
  onChangePage: (next: DocumentPrintConfig) => void;
  onChangeUseBengaliDigits: (next: boolean) => void;
}

export const BuilderPageEditor: React.FC<BuilderPageEditorProps> = ({
  page,
  useBengaliDigits,
  onChangePage,
  onChangeUseBengaliDigits,
}) => {
  const { fontFamily: globalFont } = useTheme();
  const activeFontOption = getAppFontOption(globalFont);
  const activeFontCss = getAppFontCssStack(globalFont);

  const update = <K extends keyof DocumentPrintConfig>(
    key: K,
    val: DocumentPrintConfig[K]
  ) => {
    onChangePage({ ...page, [key]: val });
  };

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor="crb-pg-size"
            className="block text-xs text-theme-text-secondary mb-1"
          >
            কাগজ
          </label>
          <select
            id="crb-pg-size"
            value={page.paperSize}
            onChange={(e) =>
              update('paperSize', e.target.value as DocumentPrintConfig['paperSize'])
            }
            className="w-full min-h-[44px] px-3 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <option value="a4">A4</option>
            <option value="legal">Legal</option>
            <option value="letter">Letter</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="crb-pg-orient"
            className="block text-xs text-theme-text-secondary mb-1"
          >
            দিক
          </label>
          <select
            id="crb-pg-orient"
            value={page.orientation}
            onChange={(e) =>
              update('orientation', e.target.value as 'portrait' | 'landscape')
            }
            className="w-full min-h-[44px] px-3 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <option value="portrait">পোর্ট্রেট</option>
            <option value="landscape">ল্যান্ডস্কেপ</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <span className="block text-xs text-theme-text-secondary mb-1">
            ফন্ট (গ্লোবাল থিম)
          </span>
          <div className="min-h-[44px] px-3 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border flex items-center justify-between gap-2">
            <span
              className="text-sm font-medium text-theme-text-primary truncate"
              style={{ fontFamily: activeFontCss }}
            >
              {activeFontOption.nameBn}
            </span>
            <Link
              to="/settings/theme"
              className="shrink-0 text-[11px] font-medium text-theme-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary rounded"
            >
              থিম সেটিংস থেকে পরিবর্তন
            </Link>
          </div>
        </div>

        <div>
          <label
            htmlFor="crb-pg-fs"
            className="block text-xs text-theme-text-secondary mb-1 tabular-nums"
          >
            ফন্ট সাইজ: {toBn(page.fontSizePt)} pt
          </label>
          <div className="min-h-[44px] flex items-center">
            <input
              id="crb-pg-fs"
              type="range"
              min={9}
              max={15}
              step={0.5}
              value={page.fontSizePt}
              onChange={(e) => update('fontSizePt', Number(e.target.value) || 11.5)}
              className="w-full accent-theme-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-theme-border border-t border-theme-border pt-1">
        <label className="min-h-[44px] py-1.5 flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-theme-text-primary">বাংলা অঙ্ক</span>
          <input
            type="checkbox"
            checked={useBengaliDigits}
            onChange={(e) => onChangeUseBengaliDigits(e.target.checked)}
            className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
          />
        </label>

        <label className="min-h-[44px] py-1.5 flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-theme-text-primary">পৃষ্ঠা নম্বর</span>
          <input
            type="checkbox"
            checked={page.showPageNumbers}
            onChange={(e) => update('showPageNumbers', e.target.checked)}
            className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
          />
        </label>

        <label className="min-h-[44px] py-1.5 flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-theme-text-primary">তৈরির তারিখ</span>
          <input
            type="checkbox"
            checked={page.showGeneratedDate}
            onChange={(e) => update('showGeneratedDate', e.target.checked)}
            className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
          />
        </label>

        <label className="min-h-[44px] py-1.5 flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-theme-text-primary">সকল পৃষ্ঠায় হেডার রিপিট</span>
          <input
            type="checkbox"
            checked={page.repeatHeaderOnAllPages}
            onChange={(e) => update('repeatHeaderOnAllPages', e.target.checked)}
            className="w-5 h-5 accent-theme-primary rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
