import React, { useId, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Image as ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  clampReportLogoSize,
  isSafeLogoUrl,
  MAX_REPORT_LOGO_SIZE_PX,
  MIN_REPORT_LOGO_SIZE_PX,
  optimizeLogoFileToDataUrl,
  readSavedReportLogos,
  removeSavedReportLogo,
  sanitizeLogoUrl,
  saveReportLogoPreset,
  type SavedReportLogo,
} from '../../lib/reportLogoUtils';

interface ReportLogoControlsProps {
  leftLogoUrl?: string;
  rightLogoUrl?: string;
  logoSizePx?: number;
  onChange: (patch: {
    leftLogoUrl?: string;
    rightLogoUrl?: string;
    logoSizePx?: number;
  }) => void;
  compact?: boolean;
}

const SIZE_PRESETS = [
  { label: 'ছোট', px: 46 },
  { label: 'মাঝারি', px: 60 },
  { label: 'বড়', px: 78 },
] as const;

export const ReportLogoControls: React.FC<ReportLogoControlsProps> = ({
  leftLogoUrl = '',
  rightLogoUrl = '',
  logoSizePx,
  onChange,
  compact = false,
}) => {
  const uid = useId().replace(/:/g, '_');
  const leftInputRef = useRef<HTMLInputElement | null>(null);
  const rightInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadingSlot, setUploadingSlot] = useState<'left' | 'right' | null>(null);
  const [urlInputSlot, setUrlInputSlot] = useState<'left' | 'right' | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedLogos, setSavedLogos] = useState<SavedReportLogo[]>(() =>
    readSavedReportLogos()
  );

  const safeLeft = sanitizeLogoUrl(leftLogoUrl);
  const safeRight = sanitizeLogoUrl(rightLogoUrl);
  const currentSize = clampReportLogoSize(logoSizePx);
  const hasAnyLogo = Boolean(safeLeft || safeRight);

  const handleFileSelect = async (
    slot: 'left' | 'right',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg('');
    setUploadingSlot(slot);
    try {
      const optimized = await optimizeLogoFileToDataUrl(file);
      const nextSaved = saveReportLogoPreset({
        label: file.name,
        url: optimized,
        slotHint: slot,
      });
      setSavedLogos(nextSaved);
      onChange(
        slot === 'left'
          ? { leftLogoUrl: optimized, logoSizePx: currentSize }
          : { rightLogoUrl: optimized, logoSizePx: currentSize }
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'লোগো আপলোড করা সম্ভব হয়নি।'
      );
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleApplyUrl = (slot: 'left' | 'right') => {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setUrlInputSlot(null);
      setUrlDraft('');
      return;
    }
    if (!isSafeLogoUrl(trimmed)) {
      setErrorMsg('সঠিক ইমেজ URL (https:// বা /...) দিন।');
      return;
    }
    setErrorMsg('');
    const nextSaved = saveReportLogoPreset({
      label: slot === 'left' ? 'বাম লোগো (URL)' : 'ডান লোগো (URL)',
      url: trimmed,
      slotHint: slot,
    });
    setSavedLogos(nextSaved);
    onChange(
      slot === 'left'
        ? { leftLogoUrl: trimmed, logoSizePx: currentSize }
        : { rightLogoUrl: trimmed, logoSizePx: currentSize }
    );
    setUrlInputSlot(null);
    setUrlDraft('');
  };

  const handleSwapLogos = () => {
    onChange({
      leftLogoUrl: safeRight,
      rightLogoUrl: safeLeft,
      logoSizePx: currentSize,
    });
  };

  const renderSlotCard = (
    slot: 'left' | 'right',
    title: string,
    hint: string,
    currentUrl: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const isBusy = uploadingSlot === slot;
    const showUrlBox = urlInputSlot === slot;

    return (
      <div className="rounded-xl border border-theme-border bg-theme-surface-subtle p-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-theme-text-primary leading-snug">
              {title}
            </div>
            <div className="text-[11px] text-theme-text-muted leading-snug">
              {hint}
            </div>
          </div>

          {currentUrl && (
            <button
              type="button"
              onClick={() =>
                onChange(slot === 'left' ? { leftLogoUrl: '' } : { rightLogoUrl: '' })
              }
              title="লোগো সরান"
              aria-label={`${title} সরান`}
              className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-12 h-12 rounded-lg border border-theme-border bg-white flex items-center justify-center shrink-0 overflow-hidden p-1">
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={title}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <ImageIcon size={20} className="text-slate-300" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
            <input
              ref={inputRef}
              id={`logo-upload-${uid}-${slot}`}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              onChange={(e) => handleFileSelect(slot, e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
              className="min-h-[34px] px-2.5 rounded-lg bg-theme-surface border border-theme-border hover:border-theme-primary text-xs font-medium text-theme-text-primary inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              <span>{currentUrl ? 'পরিবর্তন' : 'আপলোড'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                if (showUrlBox) {
                  setUrlInputSlot(null);
                  setUrlDraft('');
                } else {
                  setUrlInputSlot(slot);
                  setUrlDraft(currentUrl.startsWith('data:') ? '' : currentUrl);
                }
              }}
              title="ইমেজ লিংক (URL) দিন"
              className={`min-h-[34px] px-2 rounded-lg border text-xs inline-flex items-center gap-1 transition cursor-pointer ${
                showUrlBox
                  ? 'bg-theme-primary-soft border-theme-primary text-theme-primary font-medium'
                  : 'bg-theme-surface border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <Link2 size={13} />
              <span>URL</span>
            </button>
          </div>
        </div>

        {showUrlBox && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text-primary focus:outline-none focus:border-theme-primary"
            />
            <button
              type="button"
              onClick={() => handleApplyUrl(slot)}
              className="h-9 px-2.5 rounded-lg bg-theme-primary text-theme-primary-fg text-xs font-medium shrink-0 cursor-pointer"
            >
              ব্যবহার
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-theme-border bg-theme-surface p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ImageIcon size={15} className="text-theme-primary shrink-0" />
          <span className="text-xs sm:text-[13px] font-semibold text-theme-text-primary">
            শীর্ষ লোগো (বাম ও ডান)
          </span>
        </div>

        {hasAnyLogo && (
          <button
            type="button"
            onClick={handleSwapLogos}
            title="বাম ও ডান লোগো অদলবদল করুন"
            className="px-2 py-1 rounded-lg border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-[11px] font-medium text-theme-text-secondary hover:text-theme-text-primary inline-flex items-center gap-1 transition cursor-pointer"
          >
            <ArrowLeftRight size={12} />
            <span>অদলবদল</span>
          </button>
        )}
      </div>

      <div className={compact ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5' : 'grid grid-cols-1 gap-2.5'}>
        {renderSlotCard(
          'left',
          'বাম পাশের লোগো (Top Left)',
          'যেমন: সরকারি লোগো',
          safeLeft,
          leftInputRef
        )}
        {renderSlotCard(
          'right',
          'ডান পাশের লোগো (Top Right)',
          'যেমন: নজরুল বর্ষের লোগো',
          safeRight,
          rightInputRef
        )}
      </div>

      {hasAnyLogo && (
        <div className="pt-1 space-y-1.5 border-t border-theme-border">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`logo-size-${uid}`}
              className="text-[11.5px] font-medium text-theme-text-secondary"
            >
              লোগোর আকার ({currentSize} px)
            </label>
            <div className="flex items-center gap-1">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.px}
                  type="button"
                  onClick={() => onChange({ logoSizePx: preset.px })}
                  className={`px-2 py-0.5 rounded-md border text-[11px] transition cursor-pointer ${
                    Math.abs(currentSize - preset.px) <= 3
                      ? 'bg-theme-primary-soft border-theme-primary text-theme-primary font-medium'
                      : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:text-theme-text-primary'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <input
            id={`logo-size-${uid}`}
            type="range"
            min={MIN_REPORT_LOGO_SIZE_PX}
            max={MAX_REPORT_LOGO_SIZE_PX}
            step={2}
            value={currentSize}
            onChange={(e) => onChange({ logoSizePx: Number(e.target.value) })}
            className="w-full accent-theme-primary cursor-pointer"
          />
        </div>
      )}

      {savedLogos.length > 0 && (
        <div className="pt-1.5 border-t border-theme-border space-y-1.5">
          <div className="text-[11px] font-medium text-theme-text-secondary">
            সংরক্ষিত লোগো থেকে দ্রুত যোগ করুন:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {savedLogos.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface-subtle p-1 pr-1.5"
              >
                <div className="w-7 h-7 rounded bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                  <img
                    src={item.url}
                    alt={item.label}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <span className="text-[11px] text-theme-text-primary max-w-[78px] truncate">
                  {item.label}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ leftLogoUrl: item.url, logoSizePx: currentSize })
                  }
                  className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border hover:border-theme-primary text-[10.5px] font-medium text-theme-text-primary cursor-pointer"
                >
                  বাম
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ rightLogoUrl: item.url, logoSizePx: currentSize })
                  }
                  className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border hover:border-theme-primary text-[10.5px] font-medium text-theme-text-primary cursor-pointer"
                >
                  ডান
                </button>
                <button
                  type="button"
                  onClick={() => setSavedLogos(removeSavedReportLogo(item.id))}
                  aria-label="সংরক্ষিত লোগো মুছুন"
                  className="p-0.5 text-theme-text-muted hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg bg-theme-danger-soft border border-theme-danger-border px-2.5 py-1.5 text-xs text-theme-danger"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};
