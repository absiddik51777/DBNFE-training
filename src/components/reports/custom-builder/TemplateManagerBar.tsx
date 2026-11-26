import React from 'react';
import { CopyPlus, Loader2, Save, Star, Trash2 } from 'lucide-react';
import type { ReportTemplate } from '../../../types';
import { toBn } from '../../../lib/dateUtils';
import { BUILDER_PRESETS } from './fieldCatalog';

interface TemplateManagerBarProps {
  templates: ReportTemplate[];
  loadingTemplates: boolean;
  activePresetId: string | null;
  selectedTemplateId: string | null;
  templateName: string;
  hasUnsavedChanges: boolean;
  saving: boolean;
  deleting: boolean;
  canModifySelected: boolean;
  canDeleteSelected: boolean;
  onSelectSavedTemplate: (tpl: ReportTemplate) => void;
  onStartFromPreset: (presetId: string) => void;
  onChangeName: (name: string) => void;
  onSaveTemplate: () => void;
  onSaveAsNew: () => void;
  onDeleteSelected: () => void;
}

export const TemplateManagerBar: React.FC<TemplateManagerBarProps> = ({
  templates,
  loadingTemplates,
  activePresetId,
  selectedTemplateId,
  templateName,
  hasUnsavedChanges,
  saving,
  deleting,
  canModifySelected,
  canDeleteSelected,
  onSelectSavedTemplate,
  onStartFromPreset,
  onChangeName,
  onSaveTemplate,
  onSaveAsNew,
  onDeleteSelected,
}) => {
  const isBusy = saving || deleting;

  return (
    <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium text-theme-text-primary">
            রিপোর্ট টেমপ্লেট
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-theme-border bg-theme-surface-subtle text-theme-text-secondary tabular-nums">
            {loadingTemplates
              ? 'লোড হচ্ছে...'
              : `সংরক্ষিত: ${toBn(templates.length)} টি`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {selectedTemplateId ? (
            hasUnsavedChanges ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-theme-warning-border bg-theme-warning-soft text-theme-warning">
                অসংরক্ষিত পরিবর্তন
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-theme-success-border bg-theme-success-soft text-theme-success">
                ডাটাবেইজে সংরক্ষিত
              </span>
            )
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-theme-border bg-theme-surface-subtle text-theme-text-secondary">
              প্রিসেট খসড়া (সংরক্ষণযোগ্য)
            </span>
          )}
        </div>
      </div>

      {/* Saved Templates Strip (Wrapped so every saved template stays visible) */}
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-theme-text-secondary">
            সংরক্ষিত টেমপ্লেট (পুনর্ব্যবহার করতে ক্লিক করুন):
          </div>
          <div
            role="tablist"
            aria-label="সংরক্ষিত টেমপ্লেটসমূহ"
            className="flex flex-wrap items-center gap-1.5"
          >
            {templates.map((tpl) => {
              const isActive = selectedTemplateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={isBusy}
                  onClick={() => onSelectSavedTemplate(tpl)}
                  className={`min-h-[38px] px-3.5 rounded-full border text-xs sm:text-[13px] font-medium inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
                    isActive
                      ? 'bg-theme-primary-soft text-theme-primary border-theme-primary'
                      : 'bg-theme-surface-subtle text-theme-text-primary border-theme-border hover:bg-theme-surface-hover'
                  }`}
                >
                  <Star size={12} className={isActive ? 'fill-current' : 'text-theme-primary'} />
                  <span>{tpl.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Starter Presets */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-theme-text-secondary">
          নতুন শুরু (স্টার্টার প্রিসেট):
        </div>
        <div
          role="tablist"
          aria-label="স্টার্টার প্রিসেট"
          className="flex flex-wrap items-center gap-1.5"
        >
          {BUILDER_PRESETS.map((preset) => {
            const isActive = !selectedTemplateId && activePresetId === preset.presetId;
            return (
              <button
                key={preset.presetId}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={isBusy}
                onClick={() => onStartFromPreset(preset.presetId)}
                className={`min-h-[36px] px-3 rounded-full border text-xs font-medium transition cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary ${
                  isActive
                    ? 'bg-theme-primary-soft text-theme-primary border-theme-primary'
                    : 'bg-theme-surface text-theme-text-secondary border-theme-border hover:bg-theme-surface-hover hover:text-theme-text-primary'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Name Input + Inline Save / Copy / Delete Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <input
          id="crb-tpl-name"
          type="text"
          maxLength={160}
          aria-label="টেমপ্লেটের নাম"
          value={templateName}
          disabled={isBusy}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="টেমপ্লেটের নাম লিখুন (যেমন: বৃত্তি প্রস্তাবনা)"
          className="flex-1 min-w-[200px] min-h-[44px] px-3.5 py-2 rounded-xl bg-theme-surface-subtle border border-theme-border text-sm text-theme-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
        />

        <button
          type="button"
          disabled={isBusy || (Boolean(selectedTemplateId) && !canModifySelected)}
          onClick={onSaveTemplate}
          className="min-h-[44px] px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 transition disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          <span>{selectedTemplateId ? 'আপডেট' : 'সংরক্ষণ করুন'}</span>
        </button>

        {selectedTemplateId && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onSaveAsNew}
            title="নতুন নামে আলাদা টেমপ্লেট হিসেবে সংরক্ষণ করুন"
            className="min-h-[44px] px-3.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 shrink-0 transition disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            <CopyPlus size={15} />
            <span>নতুন হিসেবে সেভ</span>
          </button>
        )}

        {selectedTemplateId && canDeleteSelected && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onDeleteSelected}
            className="min-h-[44px] px-3.5 rounded-xl border border-theme-danger-border bg-theme-surface hover:bg-theme-danger-soft text-theme-danger text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 shrink-0 transition disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
          >
            {deleting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            <span>মুছুন</span>
          </button>
        )}
      </div>
    </div>
  );
};
