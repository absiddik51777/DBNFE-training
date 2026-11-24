import React, { useEffect, useState } from 'react';
import {
  FileText,
  Loader2,
  Minus,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  SlidersHorizontal,
  Type,
  X,
} from 'lucide-react';
import type {
  DocumentPrintConfig,
  WeeklySignatureHeading,
  WeeklySignatureMargins,
} from '../../types';
import {
  DEFAULT_SHEET_HEADING,
  DEFAULT_SHEET_PAGE_CONFIG,
  FONT_FAMILY_OPTIONS,
  PAPER_SIZE_OPTIONS,
  getFontCssStack,
  toBnDigits,
} from '../weekly-signature/utils';
import {
  DEFAULT_DOCUMENT_PRINT_CONFIG,
  normalizeDocumentPrintConfig,
} from '../../lib/documentFrameService';

interface DocumentSettingsModalProps {
  open: boolean;
  config: DocumentPrintConfig;
  defaultOrientation?: 'portrait' | 'landscape';
  heading?: WeeklySignatureHeading;
  defaultHeading?: WeeklySignatureHeading;
  supportsSignatures?: boolean;
  supportsGeneratedDate?: boolean;
  saving?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (next: {
    config: DocumentPrintConfig;
    heading?: WeeklySignatureHeading;
  }) => Promise<void> | void;
}

type ModalTab = 'page' | 'heading';

const MARGIN_FIELDS: ReadonlyArray<{ key: keyof WeeklySignatureMargins; label: string }> = [
  { key: 'top', label: 'উপরে (মিমি)' },
  { key: 'bottom', label: 'নিচে (মিমি)' },
  { key: 'left', label: 'বাম (মিমি)' },
  { key: 'right', label: 'ডান (মিমি)' },
];

const MARGIN_PRESETS: ReadonlyArray<{ label: string; value: number }> = [
  { label: 'কম (৬)', value: 6 },
  { label: 'স্ট্যান্ডার্ড (১০)', value: 10 },
  { label: 'বেশি (১৫)', value: 15 },
];

const FONT_SIZE_PRESETS = [9, 10, 11, 12, 14] as const;

export const DocumentSettingsModal: React.FC<DocumentSettingsModalProps> = ({
  open,
  config,
  defaultOrientation = 'portrait',
  heading,
  defaultHeading,
  supportsSignatures = false,
  supportsGeneratedDate = false,
  saving = false,
  errorMessage = '',
  onClose,
  onSave,
}) => {
  const hasHeadingTab = Boolean(heading);
  const [activeTab, setActiveTab] = useState<ModalTab>('page');
  const [draftConfig, setDraftConfig] = useState<DocumentPrintConfig>(() =>
    normalizeDocumentPrintConfig(config, defaultOrientation)
  );
  const [draftHeading, setDraftHeading] = useState<WeeklySignatureHeading>(
    heading || defaultHeading || DEFAULT_SHEET_HEADING
  );

  useEffect(() => {
    if (!open) return;
    setActiveTab('page');
    setDraftConfig(normalizeDocumentPrintConfig(config, defaultOrientation));
    if (heading) {
      setDraftHeading(heading);
    }
  }, [open, config, defaultOrientation, heading]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    await onSave({
      config: normalizeDocumentPrintConfig(draftConfig, defaultOrientation),
      heading: hasHeadingTab
        ? {
            govtTitle: draftHeading.govtTitle.trim(),
            officeTitle: draftHeading.officeTitle.trim(),
            officeAddress: draftHeading.officeAddress.trim(),
            programTitle: draftHeading.programTitle.trim(),
            sheetTitle: draftHeading.sheetTitle.trim(),
          }
        : undefined,
    });
  };

  const handleResetDefault = () => {
    if (activeTab === 'heading' && hasHeadingTab) {
      setDraftHeading({ ...(defaultHeading || DEFAULT_SHEET_HEADING) });
    } else {
      setDraftConfig({
        ...DEFAULT_DOCUMENT_PRINT_CONFIG,
        orientation: defaultOrientation,
        margins: { ...DEFAULT_DOCUMENT_PRINT_CONFIG.margins },
      });
    }
  };

  const updateMargin = (side: keyof WeeklySignatureMargins, rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setDraftConfig((prev) => ({
      ...prev,
      margins: {
        ...prev.margins,
        [side]: parsed,
      },
    }));
  };

  const applyUniformMargin = (mm: number) => {
    setDraftConfig((prev) => ({
      ...prev,
      margins: { top: mm, right: mm, bottom: mm, left: mm },
    }));
  };

  const stepFontSize = (delta: number) => {
    setDraftConfig((prev) => ({
      ...prev,
      fontSizePt: Math.min(16, Math.max(8, Math.round((prev.fontSizePt + delta) * 2) / 2)),
    }));
  };

  const previewFontCss = getFontCssStack(draftConfig.fontFamily);
  const previewScale = draftConfig.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-frame-settings-title"
      onClick={() => {
        if (!saving) onClose();
      }}
      className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-theme-surface text-theme-text-primary border border-theme-border rounded-t-[20px] sm:rounded-[18px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3 border-b border-theme-border space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="doc-frame-settings-title"
                className="text-[16px] font-semibold text-theme-text-primary leading-snug"
              >
                ডকুমেন্ট ও পেইজ সেটিংস
              </h2>
              <p className="text-[12px] text-theme-text-secondary mt-0.5 leading-snug">
                পেপার সাইজ, ওরিয়েন্টেশন, মার্জিন, ফন্ট ও পেজিনেশন নিয়ন্ত্রণ করুন
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="w-10 h-10 rounded-xl bg-theme-surface-subtle border border-theme-border text-theme-text-secondary hover:text-theme-text-primary flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {hasHeadingTab && (
            <div
              role="tablist"
              aria-label="সেটিংস বিভাগ"
              className="grid grid-cols-2 gap-1.5 p-1 rounded-[12px] bg-theme-surface-subtle border border-theme-border"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'page'}
                onClick={() => setActiveTab('page')}
                className={`min-h-[40px] px-3 rounded-[9px] text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'page'
                    ? 'bg-theme-surface text-theme-text-primary shadow-xs border border-theme-border'
                    : 'text-theme-text-secondary hover:text-theme-text-primary'
                }`}
              >
                <FileText size={15} />
                <span>পেইজ ও ফন্ট</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'heading'}
                onClick={() => setActiveTab('heading')}
                className={`min-h-[40px] px-3 rounded-[9px] text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'heading'
                    ? 'bg-theme-surface text-theme-text-primary shadow-xs border border-theme-border'
                    : 'text-theme-text-secondary hover:text-theme-text-primary'
                }`}
              >
                <Type size={15} />
                <span>পেইজ হেডিং</span>
              </button>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain">
            {activeTab === 'page' ? (
              <div className="space-y-4">
                {/* 1. Paper Size */}
                <div>
                  <span className="block text-[12.5px] font-medium text-theme-text-secondary mb-1.5">
                    ১. পেপার সাইজ
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {PAPER_SIZE_OPTIONS.map((opt) => {
                      const active = draftConfig.paperSize === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setDraftConfig((prev) => ({ ...prev, paperSize: opt.value }))
                          }
                          className={`min-h-[54px] px-2.5 py-2 rounded-[12px] border text-center transition cursor-pointer ${
                            active
                              ? 'bg-theme-primary-soft border-theme-primary text-theme-text-primary'
                              : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
                          }`}
                        >
                          <div className="text-[14px] font-semibold leading-tight">
                            {opt.label}
                          </div>
                          <div className="text-[11px] opacity-85 mt-0.5 leading-tight tabular-nums">
                            {opt.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Orientation */}
                <div>
                  <span className="block text-[12.5px] font-medium text-theme-text-secondary mb-1.5">
                    ২. ওরিয়েন্টেশন
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig((prev) => ({ ...prev, orientation: 'portrait' }))
                      }
                      className={`min-h-[46px] px-3 py-2 rounded-[12px] border inline-flex items-center justify-center gap-2 text-[13.5px] font-medium transition cursor-pointer ${
                        draftConfig.orientation === 'portrait'
                          ? 'bg-theme-primary-soft border-theme-primary text-theme-text-primary'
                          : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
                      }`}
                    >
                      <RectangleVertical size={16} />
                      <span>লম্বালম্বি (Portrait)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig((prev) => ({ ...prev, orientation: 'landscape' }))
                      }
                      className={`min-h-[46px] px-3 py-2 rounded-[12px] border inline-flex items-center justify-center gap-2 text-[13.5px] font-medium transition cursor-pointer ${
                        draftConfig.orientation === 'landscape'
                          ? 'bg-theme-primary-soft border-theme-primary text-theme-text-primary'
                          : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
                      }`}
                    >
                      <RectangleHorizontal size={16} />
                      <span>আড়াআড়ি (Landscape)</span>
                    </button>
                  </div>
                </div>

                {/* 3. Margin */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-theme-text-secondary">
                      ৩. মার্জিন (৪ – ৩৫ মিমি)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {MARGIN_PRESETS.map((preset) => {
                        const isMatch =
                          draftConfig.margins.top === preset.value &&
                          draftConfig.margins.right === preset.value &&
                          draftConfig.margins.bottom === preset.value &&
                          draftConfig.margins.left === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => applyUniformMargin(preset.value)}
                            className={`px-2 py-1 rounded-[8px] border text-[11.5px] font-medium transition cursor-pointer ${
                              isMatch
                                ? 'bg-theme-primary-soft border-theme-primary text-theme-primary'
                                : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MARGIN_FIELDS.map((field) => (
                      <div key={field.key}>
                        <label
                          htmlFor={`doc-margin-${field.key}`}
                          className="block text-[11.5px] text-theme-text-secondary mb-1"
                        >
                          {field.label}
                        </label>
                        <input
                          id={`doc-margin-${field.key}`}
                          type="number"
                          min={4}
                          max={35}
                          step={0.5}
                          value={draftConfig.margins[field.key]}
                          onChange={(e) => updateMargin(field.key, e.target.value)}
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-[10px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary tabular-nums focus:outline-none focus:border-theme-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Font Family */}
                <div>
                  <label
                    htmlFor="doc-font-family"
                    className="block text-[12.5px] font-medium text-theme-text-secondary mb-1.5"
                  >
                    ৪. ফন্ট ফ্যামিলি
                  </label>
                  <select
                    id="doc-font-family"
                    value={draftConfig.fontFamily}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        fontFamily: e.target.value as DocumentPrintConfig['fontFamily'],
                      }))
                    }
                    className="w-full min-h-[44px] px-3.5 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary cursor-pointer focus:outline-none focus:border-theme-primary"
                  >
                    {FONT_FAMILY_OPTIONS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Font Size */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="doc-font-size"
                      className="text-[12.5px] font-medium text-theme-text-secondary"
                    >
                      ৫. ফন্ট সাইজ (৮ – ১৬ pt)
                    </label>
                    <div className="flex items-center gap-1">
                      {FONT_SIZE_PRESETS.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() =>
                            setDraftConfig((prev) => ({ ...prev, fontSizePt: pt }))
                          }
                          className={`px-2 py-1 rounded-[8px] border text-[11.5px] font-medium tabular-nums transition cursor-pointer ${
                            draftConfig.fontSizePt === pt
                              ? 'bg-theme-primary-soft border-theme-primary text-theme-primary'
                              : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
                          }`}
                        >
                          {toBnDigits(pt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepFontSize(-0.5)}
                      disabled={draftConfig.fontSizePt <= 8}
                      aria-label="ফন্ট সাইজ কমান"
                      className="w-[44px] h-[44px] rounded-[10px] bg-theme-surface-subtle border border-theme-border text-theme-text-primary flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      id="doc-font-size"
                      type="number"
                      min={8}
                      max={16}
                      step={0.5}
                      value={draftConfig.fontSizePt}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          setDraftConfig((prev) => ({ ...prev, fontSizePt: val }));
                        }
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-[10px] bg-theme-surface-subtle border border-theme-border text-center text-[14.5px] font-medium text-theme-text-primary tabular-nums focus:outline-none focus:border-theme-primary"
                    />
                    <button
                      type="button"
                      onClick={() => stepFontSize(0.5)}
                      disabled={draftConfig.fontSizePt >= 16}
                      aria-label="ফন্ট সাইজ বাড়ান"
                      className="w-[44px] h-[44px] rounded-[10px] bg-theme-surface-subtle border border-theme-border text-theme-text-primary flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="rounded-[12px] border border-theme-border bg-white text-black px-3.5 py-2 text-center">
                    <div
                      style={{
                        fontFamily: previewFontCss,
                        fontSize: `${(12 * previewScale).toFixed(2)}px`,
                      }}
                      className="leading-snug font-medium"
                    >
                      নমুনা: মাসিক হাজিরা প্রতিবেদন — উপানুষ্ঠানিক শিক্ষা ব্যুরো ({toBnDigits(draftConfig.fontSizePt)} pt)
                    </div>
                  </div>
                </div>

                {/* 6. Relevant Document Settings */}
                <div className="rounded-[12px] border border-theme-border bg-theme-surface-subtle p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-theme-text-primary">
                    <SlidersHorizontal size={14} className="text-theme-primary" />
                    <span>৬. প্রাসঙ্গিক ডকুমেন্ট সেটিংস</span>
                  </div>

                  <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
                    <span className="text-[13px] text-theme-text-primary">
                      সকল পেইজে হেডার রিপিট করুন
                    </span>
                    <input
                      type="checkbox"
                      checked={draftConfig.repeatHeaderOnAllPages}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          repeatHeaderOnAllPages: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-theme-primary rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
                    <span className="text-[13px] text-theme-text-primary">
                      একাধিক পেইজে নিচে পৃষ্ঠা নম্বর দেখান
                    </span>
                    <input
                      type="checkbox"
                      checked={draftConfig.showPageNumbers}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          showPageNumbers: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-theme-primary rounded cursor-pointer"
                    />
                  </label>

                  {supportsSignatures && (
                    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
                      <span className="text-[13px] text-theme-text-primary">
                        প্রতিবেদনের শেষে স্বাক্ষরের ঘর দেখান
                      </span>
                      <input
                        type="checkbox"
                        checked={draftConfig.showSignatures}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            showSignatures: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-theme-primary rounded cursor-pointer"
                      />
                    </label>
                  )}

                  {supportsGeneratedDate && (
                    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
                      <span className="text-[13px] text-theme-text-primary">
                        তৈরির তারিখ দেখান
                      </span>
                      <input
                        type="checkbox"
                        checked={draftConfig.showGeneratedDate}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            showGeneratedDate: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-theme-primary rounded cursor-pointer"
                      />
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="doc-h-govt"
                    className="block text-[12.5px] font-medium text-theme-text-secondary mb-1"
                  >
                    শীর্ষ লাইন (সরকার)
                  </label>
                  <input
                    id="doc-h-govt"
                    type="text"
                    maxLength={200}
                    value={draftHeading.govtTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, govtTitle: e.target.value }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary focus:outline-none focus:border-theme-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="doc-h-office"
                    className="block text-[12.5px] font-medium text-theme-text-secondary mb-1"
                  >
                    কার্যালয়ের নাম
                  </label>
                  <input
                    id="doc-h-office"
                    type="text"
                    maxLength={200}
                    value={draftHeading.officeTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, officeTitle: e.target.value }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary focus:outline-none focus:border-theme-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="doc-h-address"
                    className="block text-[12.5px] font-medium text-theme-text-secondary mb-1"
                  >
                    ঠিকানা
                  </label>
                  <input
                    id="doc-h-address"
                    type="text"
                    maxLength={250}
                    value={draftHeading.officeAddress}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({
                        ...prev,
                        officeAddress: e.target.value,
                      }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary focus:outline-none focus:border-theme-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="doc-h-program"
                    className="block text-[12.5px] font-medium text-theme-text-secondary mb-1"
                  >
                    কার্যক্রম / প্রকল্পের নাম
                  </label>
                  <textarea
                    id="doc-h-program"
                    rows={3}
                    maxLength={400}
                    value={draftHeading.programTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({
                        ...prev,
                        programTitle: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary leading-relaxed resize-y focus:outline-none focus:border-theme-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="doc-h-sheet"
                    className="block text-[12.5px] font-medium text-theme-text-secondary mb-1"
                  >
                    প্রতিবেদনের শিরোনাম
                  </label>
                  <input
                    id="doc-h-sheet"
                    type="text"
                    maxLength={200}
                    value={draftHeading.sheetTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, sheetTitle: e.target.value }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-theme-surface-subtle border border-theme-border text-[14px] text-theme-text-primary focus:outline-none focus:border-theme-primary"
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-[10px] bg-theme-danger-soft border border-theme-danger-border px-3 py-2 text-[12.5px] text-theme-danger leading-snug"
              >
                {errorMessage}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-3 border-t border-theme-border flex flex-wrap items-center justify-between gap-2 shrink-0 bg-theme-surface">
            <button
              type="button"
              disabled={saving}
              onClick={handleResetDefault}
              className="min-h-[44px] px-3 rounded-[12px] text-[13px] font-medium text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-subtle inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={15} />
              <span>ডিফল্ট</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-[12px] border border-theme-border bg-transparent hover:bg-theme-surface-subtle text-[13.5px] font-medium text-theme-text-primary transition cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 rounded-[12px] bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                <span>{saving ? 'প্রয়োগ হচ্ছে...' : 'প্রয়োগ করুন'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
