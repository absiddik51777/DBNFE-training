import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { SettingsCounts } from '../types';

interface DataManagementSectionProps {
  counts: SettingsCounts;
  loadingCounts: boolean;
  exportingData: boolean;
  onRefreshCounts: () => Promise<void>;
  onExportAll: () => Promise<void>;
}

export const DataManagementSection: React.FC<DataManagementSectionProps> = ({
  counts,
  loadingCounts,
  exportingData,
  onRefreshCounts,
  onExportAll,
}) => {
  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: 'দৈনিক হাজিরা', value: `${counts.attendance} টি` },
    { label: 'প্রশিক্ষণার্থী', value: `${counts.trainees} জন` },
    {
      label: 'পরীক্ষা',
      value: `${counts.exams} টি`,
      sub: `মার্কস: ${counts.marks} টি`,
    },
    { label: 'ব্যাচ', value: `${counts.batches} টি` },
    { label: 'প্রতিষ্ঠান', value: `${counts.institutes} টি` },
    { label: 'ট্রেড', value: `${counts.trades} টি` },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-theme-text-primary">
              ডাটাবেজ সারাংশ
            </h2>
            <p className="text-xs text-theme-text-secondary mt-0.5">
              ক্লাউড ফায়ারস্টোরে সংরক্ষিত বর্তমান রেকর্ড সংখ্যা
            </p>
          </div>

          <button
            type="button"
            onClick={onRefreshCounts}
            disabled={loadingCounts}
            className="min-h-[44px] px-3.5 py-2 rounded-[12px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs font-semibold text-theme-text-primary inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <RefreshCw size={14} className={loadingCounts ? 'animate-spin' : ''} />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-[14px] border border-theme-border bg-theme-surface-subtle p-3.5 space-y-1"
            >
              <span className="text-xs text-theme-text-secondary block">
                {tile.label}
              </span>
              <span className="text-lg sm:text-xl font-bold text-theme-text-primary block tabular-nums">
                {loadingCounts ? '...' : tile.value}
              </span>
              {tile.sub && (
                <span className="text-[11px] text-theme-text-muted block tabular-nums">
                  {loadingCounts ? '' : tile.sub}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full Backup Export Card */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-theme-text-primary">
            সম্পূর্ণ ব্যাকআপ এক্সপোর্ট
          </h2>
          <p className="text-xs text-theme-text-secondary leading-relaxed">
            সব প্রতিষ্ঠান, ট্রেড, ব্যাচ, প্রশিক্ষণার্থী, হাজিরা, পরীক্ষা, মার্কস ও লগ একসাথে JSON ফাইল হিসেবে সংরক্ষণ করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={onExportAll}
          disabled={exportingData}
          className="min-h-[44px] px-4 py-2.5 rounded-[12px] bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 transition-colors disabled:opacity-55 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
        >
          {exportingData ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
          <span>{exportingData ? 'এক্সপোর্ট হচ্ছে...' : 'সব ডাটা এক্সপোর্ট করুন'}</span>
        </button>
      </div>
    </div>
  );
};
