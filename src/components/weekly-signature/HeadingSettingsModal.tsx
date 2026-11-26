import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Loader2,
  Minus,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Type,
  X,
} from 'lucide-react';
import type { WeeklySignatureMargins, WeeklySignaturePageConfig } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getAppFontCssStack, getAppFontOption } from '../../lib/theme';
import {
  DEFAULT_SHEET_HEADING,
  DEFAULT_SHEET_PAGE_CONFIG,
  PAPER_SIZE_OPTIONS,
  normalizePageConfig,
  toBnDigits,
  type SignatureSheetHeading,
} from './utils';

interface HeadingSettingsModalProps {
  open: boolean;
  heading: SignatureSheetHeading;
  pageConfig: WeeklySignaturePageConfig;
  saving: boolean;
  errorMessage: string;
  onClose: () => void;
  onSave: (next: {
    heading: SignatureSheetHeading;
    pageConfig: WeeklySignaturePageConfig;
  }) => Promise<void> | void;
}

type ModalTab = 'heading' | 'page';

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

export const HeadingSettingsModal: React.FC<HeadingSettingsModalProps> = ({
  open,
  heading,
  pageConfig,
  saving,
  errorMessage,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('heading');
  const [draftHeading, setDraftHeading] = useState<SignatureSheetHeading>(heading);
  const [draftPage, setDraftPage] = useState<WeeklySignaturePageConfig>(() =>
    normalizePageConfig(pageConfig)
  );
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraftHeading(heading);
    setDraftPage(normalizePageConfig(pageConfig));
    const raf = window.requestAnimationFrame(() => {
      firstInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, heading, pageConfig]);

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
      heading: {
        govtTitle: draftHeading.govtTitle.trim(),
        officeTitle: draftHeading.officeTitle.trim(),
        officeAddress: draftHeading.officeAddress.trim(),
        programTitle: draftHeading.programTitle.trim(),
        sheetTitle: draftHeading.sheetTitle.trim(),
      },
      pageConfig: normalizePageConfig(draftPage),
    });
  };

  const handleResetDefault = () => {
    if (activeTab === 'heading') {
      setDraftHeading({ ...DEFAULT_SHEET_HEADING });
    } else {
      setDraftPage({
        ...DEFAULT_SHEET_PAGE_CONFIG,
        margins: { ...DEFAULT_SHEET_PAGE_CONFIG.margins },
      });
    }
  };

  const updateMargin = (side: keyof WeeklySignatureMargins, rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setDraftPage((prev) => ({
      ...prev,
      margins: {
        ...prev.margins,
        [side]: parsed,
      },
    }));
  };

  const applyUniformMargin = (mm: number) => {
    setDraftPage((prev) => ({
      ...prev,
      margins: { top: mm, right: mm, bottom: mm, left: mm },
    }));
  };

  const stepFontSize = (delta: number) => {
    setDraftPage((prev) => ({
      ...prev,
      fontSizePt: Math.min(16, Math.max(8, Math.round((prev.fontSizePt + delta) * 2) / 2)),
    }));
  };

  const { fontFamily: globalFont } = useTheme();
  const activeFontOpt = getAppFontOption(globalFont);
  const previewFontCss = getAppFontCssStack(globalFont);
  const previewScale = draftPage.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-heading-modal-title"
      onClick={() => {
        if (!saving) onClose();
      }}
      className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-[var(--ws-surface)] text-[var(--ws-text)] border border-[var(--ws-border)] rounded-t-[20px] sm:rounded-[18px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3 border-b border-[var(--ws-border)] space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="ws-heading-modal-title"
                className="text-[16px] font-semibold text-[var(--ws-text)] leading-snug"
              >
                পেইজ ও হেডিং সেটিংস
              </h2>
              <p className="text-[12px] text-[var(--ws-muted)] mt-0.5 leading-snug">
                হেডিং টেক্সট, পেপার সাইজ, মার্জিন এবং ফন্ট কাস্টমাইজ করুন
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="w-10 h-10 rounded-xl bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
            >
              <X size={18} />
            </button>
          </div>

          {/* 2-Tab Switcher */}
          <div
            role="tablist"
            aria-label="সেটিংস বিভাগ"
            className="grid grid-cols-2 gap-1.5 p-1 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'heading'}
              onClick={() => setActiveTab('heading')}
              className={`min-h-[40px] px-3 rounded-[9px] text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] ${
                activeTab === 'heading'
                  ? 'bg-[var(--ws-surface)] text-[var(--ws-text)] shadow-sm border border-[var(--ws-border)]'
                  : 'text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
              }`}
            >
              <Type size={15} />
              <span>পেইজ হেডিং</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'page'}
              onClick={() => setActiveTab('page')}
              className={`min-h-[40px] px-3 rounded-[9px] text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] ${
                activeTab === 'page'
                  ? 'bg-[var(--ws-surface)] text-[var(--ws-text)] shadow-sm border border-[var(--ws-border)]'
                  : 'text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
              }`}
            >
              <FileText size={15} />
              <span>পেইজ ও ফন্ট</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain">
            {activeTab === 'heading' ? (
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="ws-h-govt"
                    className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1"
                  >
                    শীর্ষ লাইন (সরকার)
                  </label>
                  <input
                    ref={firstInputRef}
                    id="ws-h-govt"
                    type="text"
                    maxLength={200}
                    value={draftHeading.govtTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, govtTitle: e.target.value }))
                    }
                    placeholder={DEFAULT_SHEET_HEADING.govtTitle}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14px] text-[var(--ws-text)] focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ws-h-office"
                    className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1"
                  >
                    কার্যালয়ের নাম
                  </label>
                  <input
                    id="ws-h-office"
                    type="text"
                    maxLength={200}
                    value={draftHeading.officeTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, officeTitle: e.target.value }))
                    }
                    placeholder={DEFAULT_SHEET_HEADING.officeTitle}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14px] text-[var(--ws-text)] focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ws-h-address"
                    className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1"
                  >
                    ঠিকানা
                  </label>
                  <input
                    id="ws-h-address"
                    type="text"
                    maxLength={250}
                    value={draftHeading.officeAddress}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, officeAddress: e.target.value }))
                    }
                    placeholder={DEFAULT_SHEET_HEADING.officeAddress}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14px] text-[var(--ws-text)] focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ws-h-program"
                    className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1"
                  >
                    কার্যক্রম / প্রকল্পের নাম
                  </label>
                  <textarea
                    id="ws-h-program"
                    rows={3}
                    maxLength={400}
                    value={draftHeading.programTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, programTitle: e.target.value }))
                    }
                    placeholder={DEFAULT_SHEET_HEADING.programTitle}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14px] text-[var(--ws-text)] leading-relaxed resize-y focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ws-h-sheet"
                    className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1"
                  >
                    সিটের শিরোনাম
                  </label>
                  <input
                    id="ws-h-sheet"
                    type="text"
                    maxLength={200}
                    value={draftHeading.sheetTitle}
                    onChange={(e) =>
                      setDraftHeading((prev) => ({ ...prev, sheetTitle: e.target.value }))
                    }
                    placeholder={DEFAULT_SHEET_HEADING.sheetTitle}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14px] text-[var(--ws-text)] focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Paper Size */}
                <div>
                  <span className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1.5">
                    ১. পেপার সাইজ
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {PAPER_SIZE_OPTIONS.map((opt) => {
                      const active = draftPage.paperSize === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setDraftPage((prev) => ({ ...prev, paperSize: opt.value }))
                          }
                          className={`min-h-[54px] px-2.5 py-2 rounded-[12px] border text-center transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] ${
                            active
                              ? 'bg-[var(--ws-accent)]/12 border-[var(--ws-accent)] text-[var(--ws-text)]'
                              : 'bg-[var(--ws-surface2)] border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
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
                  <span className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1.5">
                    ২. ওরিয়েন্টেশন
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPage((prev) => ({ ...prev, orientation: 'portrait' }))
                      }
                      className={`min-h-[46px] px-3 py-2 rounded-[12px] border inline-flex items-center justify-center gap-2 text-[13.5px] font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] ${
                        draftPage.orientation === 'portrait'
                          ? 'bg-[var(--ws-accent)]/12 border-[var(--ws-accent)] text-[var(--ws-text)]'
                          : 'bg-[var(--ws-surface2)] border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
                      }`}
                    >
                      <RectangleVertical size={16} />
                      <span>লম্বালম্বি (Portrait)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPage((prev) => ({ ...prev, orientation: 'landscape' }))
                      }
                      className={`min-h-[46px] px-3 py-2 rounded-[12px] border inline-flex items-center justify-center gap-2 text-[13.5px] font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)] ${
                        draftPage.orientation === 'landscape'
                          ? 'bg-[var(--ws-accent)]/12 border-[var(--ws-accent)] text-[var(--ws-text)]'
                          : 'bg-[var(--ws-surface2)] border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
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
                    <span className="text-[12.5px] font-medium text-[var(--ws-muted)]">
                      ৩. মার্জিন (৪ – ৩৫ মিমি)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {MARGIN_PRESETS.map((preset) => {
                        const isMatch =
                          draftPage.margins.top === preset.value &&
                          draftPage.margins.right === preset.value &&
                          draftPage.margins.bottom === preset.value &&
                          draftPage.margins.left === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => applyUniformMargin(preset.value)}
                            className={`px-2 py-1 rounded-[8px] border text-[11.5px] font-medium transition cursor-pointer ${
                              isMatch
                                ? 'bg-[var(--ws-accent)]/15 border-[var(--ws-accent)] text-[var(--ws-accent)]'
                                : 'bg-[var(--ws-surface2)] border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
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
                          htmlFor={`ws-margin-${field.key}`}
                          className="block text-[11.5px] text-[var(--ws-muted)] mb-1"
                        >
                          {field.label}
                        </label>
                        <input
                          id={`ws-margin-${field.key}`}
                          type="number"
                          min={4}
                          max={35}
                          step={0.5}
                          value={draftPage.margins[field.key]}
                          onChange={(e) => updateMargin(field.key, e.target.value)}
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-[10px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[14px] text-[var(--ws-text)] tabular-nums focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Global Font Info */}
                <div>
                  <span className="block text-[12.5px] font-medium text-[var(--ws-muted)] mb-1.5">
                    ৪. ফন্ট ফ্যামিলি (গ্লোবাল থিম ফন্ট)
                  </span>
                  <div
                    style={{ fontFamily: previewFontCss }}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] flex items-center justify-between gap-2"
                  >
                    <span className="text-[14px] font-medium text-[var(--ws-text)]">
                      {activeFontOpt.name} ({activeFontOpt.nameBn})
                    </span>
                    <span className="text-[11px] text-[var(--ws-muted)] shrink-0">
                      থিম সেটিংস থেকে নিয়ন্ত্রিত
                    </span>
                  </div>
                </div>

                {/* 5. Font Size */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="ws-font-size"
                      className="text-[12.5px] font-medium text-[var(--ws-muted)]"
                    >
                      ৫. ফন্ট সাইজ (৮ – ১৬ pt)
                    </label>
                    <div className="flex items-center gap-1">
                      {FONT_SIZE_PRESETS.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setDraftPage((prev) => ({ ...prev, fontSizePt: pt }))}
                          className={`px-2 py-1 rounded-[8px] border text-[11.5px] font-medium tabular-nums transition cursor-pointer ${
                            draftPage.fontSizePt === pt
                              ? 'bg-[var(--ws-accent)]/15 border-[var(--ws-accent)] text-[var(--ws-accent)]'
                              : 'bg-[var(--ws-surface2)] border-[var(--ws-border)] text-[var(--ws-muted)] hover:text-[var(--ws-text)]'
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
                      disabled={draftPage.fontSizePt <= 8}
                      aria-label="ফন্ট সাইজ কমান"
                      className="w-[44px] h-[44px] rounded-[10px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-text)] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      id="ws-font-size"
                      type="number"
                      min={8}
                      max={16}
                      step={0.5}
                      value={draftPage.fontSizePt}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          setDraftPage((prev) => ({ ...prev, fontSizePt: val }));
                        }
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-[10px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-center text-[14.5px] font-medium text-[var(--ws-text)] tabular-nums focus:outline-none focus:border-[var(--ws-accent)] focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => stepFontSize(0.5)}
                      disabled={draftPage.fontSizePt >= 16}
                      aria-label="ফন্ট সাইজ বাড়ান"
                      className="w-[44px] h-[44px] rounded-[10px] bg-[var(--ws-surface2)] border border-[var(--ws-border)] text-[var(--ws-text)] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Live Font & Size Sample Preview */}
                  <div className="rounded-[12px] border border-[var(--ws-border)] bg-white text-black px-3.5 py-2.5 text-center">
                    <div
                      style={{
                        fontFamily: previewFontCss,
                        fontSize: `${(12 * previewScale).toFixed(2)}px`,
                      }}
                      className="leading-snug font-medium"
                    >
                      নমুনা: প্রশিক্ষণার্থী হাজিরা সিট — সানজিদা আক্তার ({toBnDigits(draftPage.fontSizePt)} pt)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-[10px] bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400 leading-snug"
              >
                {errorMessage}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-3 border-t border-[var(--ws-border)] flex flex-wrap items-center justify-between gap-2 shrink-0 bg-[var(--ws-surface)]">
            <button
              type="button"
              disabled={saving}
              onClick={handleResetDefault}
              className="min-h-[44px] px-3 rounded-[12px] text-[13px] font-medium text-[var(--ws-muted)] hover:text-[var(--ws-text)] hover:bg-[var(--ws-surface2)] inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
            >
              <RotateCcw size={15} />
              <span>ডিফল্ট</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-[12px] border border-[var(--ws-border)] bg-transparent hover:bg-[var(--ws-surface2)] text-[13.5px] font-medium text-[var(--ws-text)] transition cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 rounded-[12px] bg-[var(--ws-accent)] text-white dark:text-slate-950 text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--ws-accent)]"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
