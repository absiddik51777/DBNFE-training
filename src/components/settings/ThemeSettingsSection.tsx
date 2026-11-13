import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  RotateCcw,
  Check,
  Sparkles,
  Eye,
  X,
  AlertCircle,
  Home,
  Layers,
  Users,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  ThemeConfig,
  ThemeMode,
  ResolvedThemeMode,
  ThemeTokenKey,
  ThemePresetId,
  THEME_PRESETS,
  THEME_TOKEN_METADATA,
  DEFAULT_LIGHT_TOKENS,
  DEFAULT_DARK_TOKENS,
  buildThemeCssVariables,
  normalizeHexColor,
  isValidHexColor,
} from '../../lib/theme';

const GROUP_LABELS: Record<'brand' | 'surfaces' | 'typography' | 'status', { titleBn: string; sub: string }> = {
  brand: { titleBn: 'ব্র্যান্ড ও অ্যাক্সেন্ট কালার', sub: 'Brand & Accent' },
  surfaces: { titleBn: 'পটভূমি ও সারফেস', sub: 'Surfaces & Navigation' },
  typography: { titleBn: 'টেক্সট ও বর্ডার', sub: 'Typography & Borders' },
  status: { titleBn: 'স্ট্যাটাস ও অ্যালার্ট কালার', sub: 'Semantic Statuses' },
};

export const ThemeSettingsSection: React.FC = () => {
  const { config, resolvedMode, setMode, applyConfig, selectPreset, restoreDefaultTheme } = useTheme();

  // Draft state for live preview before clicking Apply Changes
  const [draftConfig, setDraftConfig] = useState<ThemeConfig>(config);
  const [editTabMode, setEditTabMode] = useState<ResolvedThemeMode>(resolvedMode);
  const [hexInputs, setHexInputs] = useState<Record<string, string>>({});
  const [hexErrors, setHexErrors] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState('');

  // Sync draft when persisted config updates externally (e.g. mode quick switch or restore default)
  useEffect(() => {
    setDraftConfig(config);
    setHexInputs({});
    setHexErrors({});
  }, [config]);

  const isDirty = useMemo(() => {
    return JSON.stringify(draftConfig) !== JSON.stringify(config);
  }, [draftConfig, config]);

  const hasValidationErrors = Object.keys(hexErrors).length > 0;

  const currentEditingTokens = editTabMode === 'dark' ? draftConfig.dark : draftConfig.light;
  const currentDefaultTokens = editTabMode === 'dark' ? DEFAULT_DARK_TOKENS : DEFAULT_LIGHT_TOKENS;

  const previewCssVars = useMemo(() => {
    const vars = buildThemeCssVariables(currentEditingTokens, editTabMode);
    return vars as React.CSSProperties;
  }, [currentEditingTokens, editTabMode]);

  const handleModeSelect = (nextMode: ThemeMode) => {
    setMode(nextMode);
    setDraftConfig((prev) => ({ ...prev, mode: nextMode }));
    if (nextMode === 'light' || nextMode === 'dark') {
      setEditTabMode(nextMode);
    }
  };

  const handlePresetDraftSelect = (presetId: Exclude<ThemePresetId, 'custom'>) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraftConfig((prev) => ({
      ...prev,
      presetId: preset.id,
      light: { ...preset.light },
      dark: { ...preset.dark },
    }));
    setHexInputs({});
    setHexErrors({});
  };

  const handleTokenColorPickerChange = (key: ThemeTokenKey, value: string) => {
    const normalized = normalizeHexColor(value);
    if (!normalized) return;

    const inputKey = `${editTabMode}:${key}`;
    setHexInputs((prev) => {
      const next = { ...prev };
      delete next[inputKey];
      return next;
    });
    setHexErrors((prev) => {
      const next = { ...prev };
      delete next[inputKey];
      return next;
    });

    setDraftConfig((prev) => ({
      ...prev,
      presetId: 'custom',
      light: editTabMode === 'light' ? { ...prev.light, [key]: normalized } : prev.light,
      dark: editTabMode === 'dark' ? { ...prev.dark, [key]: normalized } : prev.dark,
    }));
  };

  const handleHexTextChange = (key: ThemeTokenKey, rawValue: string) => {
    const inputKey = `${editTabMode}:${key}`;
    setHexInputs((prev) => ({ ...prev, [inputKey]: rawValue }));

    const trimmed = rawValue.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

    if (isValidHexColor(withHash)) {
      const normalized = withHash.toUpperCase();
      setHexErrors((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      setDraftConfig((prev) => ({
        ...prev,
        presetId: 'custom',
        light: editTabMode === 'light' ? { ...prev.light, [key]: normalized } : prev.light,
        dark: editTabMode === 'dark' ? { ...prev.dark, [key]: normalized } : prev.dark,
      }));
    } else {
      setHexErrors((prev) => ({
        ...prev,
        [inputKey]: 'সঠিক ৬-ডিজিট HEX কোড দিন (যেমন #059669)',
      }));
    }
  };

  const handleResetSingleToken = (key: ThemeTokenKey) => {
    const defaultVal = currentDefaultTokens[key];
    handleTokenColorPickerChange(key, defaultVal);
  };

  const handleResetCurrentMode = () => {
    setDraftConfig((prev) => ({
      ...prev,
      presetId: 'custom',
      light: editTabMode === 'light' ? { ...DEFAULT_LIGHT_TOKENS } : prev.light,
      dark: editTabMode === 'dark' ? { ...DEFAULT_DARK_TOKENS } : prev.dark,
    }));
    setHexInputs({});
    setHexErrors({});
  };

  const handleApplyChanges = () => {
    if (hasValidationErrors) return;
    applyConfig(draftConfig);
    setSavedNotice('থিম ও কালার পরিবর্তন সফলভাবে প্রয়োগ ও সংরক্ষণ করা হয়েছে!');
    setTimeout(() => setSavedNotice(''), 3500);
  };

  const handleCancelChanges = () => {
    setDraftConfig(config);
    setHexInputs({});
    setHexErrors({});
  };

  const handleRestoreDefaultTheme = () => {
    restoreDefaultTheme();
    setSavedNotice('সিস্টেম ডিফল্ট "Emerald Slate" থিমে ফিরিয়ে আনা হয়েছে।');
    setTimeout(() => setSavedNotice(''), 3500);
  };

  const groupedTokens = useMemo(() => {
    const groups: Array<'brand' | 'surfaces' | 'typography' | 'status'> = [
      'brand',
      'surfaces',
      'typography',
      'status',
    ];
    return groups.map((group) => ({
      group,
      meta: GROUP_LABELS[group],
      tokens: THEME_TOKEN_METADATA.filter((t) => t.group === group),
    }));
  }, []);

  return (
    <section className="bg-theme-surface p-5 sm:p-7 rounded-2xl border border-theme-border shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-theme-border">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 rounded-xl bg-theme-primary-soft text-theme-primary-soft-fg border border-theme-primary-border shrink-0">
            <Palette size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-theme-text-primary">
              অ্যাপিয়ারেন্স ও থিম কাস্টমাইজেশন (Appearance &amp; Theme Settings)
            </h2>
            <p className="text-xs text-theme-text-secondary mt-0.5 leading-relaxed">
              Light Mode, Dark Mode বা System Default নির্বাচন করুন এবং উভয় মোডের জন্য প্রতিটি কালার টোকেন স্বাধীনভাবে কাস্টমাইজ করুন।
            </p>
          </div>
        </div>

        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-theme-surface-subtle text-theme-text-secondary border border-theme-border self-start sm:self-center shrink-0">
          {resolvedMode === 'dark' ? <Moon size={13} className="text-theme-primary" /> : <Sun size={13} className="text-theme-primary" />}
          <span>সক্রিয় মোড: {resolvedMode === 'dark' ? 'Dark' : 'Light'}</span>
        </span>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-theme-success-soft border border-theme-success-border text-theme-success text-xs sm:text-sm font-semibold flex items-center space-x-2">
          <CheckCircle2 size={17} className="shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 1. APPEARANCE MODE SELECTOR (IMMEDIATE APPLY) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-theme-text-primary uppercase tracking-wider">
            ১. অ্যাপিয়ারেন্স মোড (Appearance Mode)
          </h3>
          <span className="text-[11px] text-theme-text-muted">তাৎক্ষণিক পরিবর্তনযোগ্য</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'light' as ThemeMode,
              title: 'Light Mode',
              titleBn: 'লাইট মোড',
              desc: 'পরিষ্কার সাদা সারফেস ও উচ্চ পাঠযোগ্যতা',
              icon: <Sun size={18} />,
            },
            {
              id: 'dark' as ThemeMode,
              title: 'Dark Mode',
              titleBn: 'ডার্ক মোড',
              desc: 'কম আলোতে আরামদায়ক গভীর স্লেট ইন্টারফেস',
              icon: <Moon size={18} />,
            },
            {
              id: 'system' as ThemeMode,
              title: 'System Default',
              titleBn: 'সিস্টেম ডিফল্ট',
              desc: 'ডিভাইস/ওএস সেটিংস অনুযায়ী স্বয়ংক্রিয় পরিবর্তন',
              icon: <Monitor size={18} />,
            },
          ].map((m) => {
            const isSelected = config.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeSelect(m.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
                  isSelected
                    ? 'bg-theme-primary-soft border-theme-primary text-theme-text-primary ring-2 ring-theme-primary/20'
                    : 'bg-theme-surface-subtle border-theme-border text-theme-text-secondary hover:border-theme-border-strong hover:bg-theme-surface-hover'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    isSelected
                      ? 'bg-theme-primary text-theme-primary-fg border-transparent'
                      : 'bg-theme-surface text-theme-text-secondary border-theme-border'
                  }`}
                >
                  {m.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-theme-text-primary">{m.titleBn}</span>
                    {isSelected && <Check size={15} className="text-theme-primary shrink-0" />}
                  </div>
                  <span className="block text-[11px] font-medium text-theme-text-muted">{m.title}</span>
                  <p className="text-[11px] text-theme-text-secondary mt-1 leading-snug">{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. THEME PRESETS */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-theme-text-primary uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles size={14} className="text-theme-primary" />
            <span>২. থিম প্রিসেট (Theme Presets)</span>
          </h3>
          {draftConfig.presetId === 'custom' && (
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-theme-accent-soft text-theme-accent font-semibold border border-theme-accent-border">
              কাস্টম কালার সক্রিয় (Custom)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {THEME_PRESETS.map((preset) => {
            const isSelected = draftConfig.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetDraftSelect(preset.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                  isSelected
                    ? 'bg-theme-primary-soft/60 border-theme-primary ring-2 ring-theme-primary/20'
                    : 'bg-theme-surface-subtle border-theme-border hover:border-theme-border-strong hover:bg-theme-surface-hover'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-theme-text-primary truncate">{preset.name}</p>
                    <p className="text-[10px] text-theme-text-secondary truncate">{preset.nameBn}</p>
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-theme-primary text-theme-primary-fg flex items-center justify-center shrink-0">
                      <Check size={12} />
                    </span>
                  )}
                </div>

                {/* Mini Light/Dark Swatches */}
                <div className="flex items-center justify-between pt-1 border-t border-theme-border">
                  <div className="flex items-center -space-x-1">
                    <span
                      className="w-4 h-4 rounded-full border border-white/60 shadow-2xs"
                      style={{ backgroundColor: preset.light.primary }}
                      title="Light Primary"
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/60 shadow-2xs"
                      style={{ backgroundColor: preset.light.accent }}
                      title="Light Accent"
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: preset.light.background }}
                      title="Light Background"
                    />
                  </div>
                  <div className="flex items-center -space-x-1">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700 shadow-2xs"
                      style={{ backgroundColor: preset.dark.primary }}
                      title="Dark Primary"
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700 shadow-2xs"
                      style={{ backgroundColor: preset.dark.surface }}
                      title="Dark Surface"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. INDEPENDENT LIGHT & DARK COLOR EDITOR + LIVE PREVIEW */}
      <div className="space-y-4 pt-2 border-t border-theme-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-theme-text-primary uppercase tracking-wider">
              ৩. বিস্তারিত কালার কাস্টমাইজেশন (Independent Light &amp; Dark Tokens)
            </h3>
            <p className="text-xs text-theme-text-secondary mt-0.5">
              Light এবং Dark মোডের জন্য আলাদাভাবে রঙ পরিবর্তন করুন ও নিচে লাইভ প্রিভিউ দেখুন।
            </p>
          </div>

          {/* Mode Tab Switcher for Independent Editing */}
          <div className="inline-flex p-1 rounded-xl bg-theme-surface-subtle border border-theme-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setEditTabMode('light')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                editTabMode === 'light'
                  ? 'bg-theme-surface text-theme-primary shadow-xs border border-theme-border'
                  : 'text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <Sun size={14} />
              <span>Light Theme Colors</span>
            </button>
            <button
              type="button"
              onClick={() => setEditTabMode('dark')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                editTabMode === 'dark'
                  ? 'bg-theme-surface text-theme-primary shadow-xs border border-theme-border'
                  : 'text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <Moon size={14} />
              <span>Dark Theme Colors</span>
            </button>
          </div>
        </div>

        {/* Live Theme Preview Panel (Scoped CSS Variables from Draft) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-theme-text-primary flex items-center space-x-1.5">
              <Eye size={14} className="text-theme-primary" />
              <span>লাইভ থিম প্রিভিউ ({editTabMode === 'dark' ? 'Dark Mode' : 'Light Mode'})</span>
            </span>
            <span className="text-[11px] text-theme-text-muted">রঙ পরিবর্তনের সাথে সাথে আপডেট হয়</span>
          </div>

          <div
            style={{
              ...previewCssVars,
              backgroundColor: 'var(--theme-bg)',
              color: 'var(--theme-text-primary)',
              borderColor: 'var(--theme-border)',
            }}
            className="rounded-2xl border overflow-hidden transition-colors"
          >
            {/* Preview Top Header Bar */}
            <div
              style={{
                backgroundColor: 'var(--theme-nav)',
                borderColor: 'var(--theme-border)',
              }}
              className="px-4 py-2.5 border-b flex items-center justify-between gap-2"
            >
              <div className="flex items-center space-x-2">
                <span
                  style={{
                    backgroundColor: 'var(--theme-primary)',
                    color: 'var(--theme-primary-fg)',
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                >
                  B
                </span>
                <div>
                  <span style={{ color: 'var(--theme-text-primary)' }} className="text-xs font-bold block leading-tight">
                    BNFE ট্রেইনিং
                  </span>
                  <span style={{ color: 'var(--theme-text-secondary)' }} className="text-[10px] block leading-tight">
                    প্রিভিউ নেভিগেশন হেডার
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <span
                  style={{
                    backgroundColor: 'var(--theme-primary-soft)',
                    color: 'var(--theme-primary-soft-fg)',
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                >
                  Active Role
                </span>
                <span
                  style={{
                    backgroundColor: 'var(--theme-primary)',
                    color: 'var(--theme-primary-fg)',
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                >
                  প্রাইমারি বাটন
                </span>
              </div>
            </div>

            {/* Preview Body Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Content & Input */}
              <div
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                }}
                className="md:col-span-2 p-3.5 rounded-xl border space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p style={{ color: 'var(--theme-text-primary)' }} className="text-xs font-bold">
                      প্রশিক্ষণার্থী ও হাজিরা সারসংক্ষেপ
                    </p>
                    <p style={{ color: 'var(--theme-text-secondary)' }} className="text-[11px]">
                      সেকেন্ডারি লেখা ও{' '}
                      <span style={{ color: 'var(--theme-text-muted)' }}>মিউটেড প্লেসহোল্ডার</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    style={{
                      backgroundColor: 'var(--theme-elevated)',
                      color: 'var(--theme-text-primary)',
                      borderColor: 'var(--theme-border)',
                    }}
                    className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold"
                  >
                    সেকেন্ডারি
                  </button>
                </div>

                {/* Mini Input Preview */}
                <div
                  style={{
                    backgroundColor: 'var(--theme-elevated)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                  className="px-3 py-1.5 rounded-lg border text-[11px]"
                >
                  শিক্ষার্থীর নাম অনুসন্ধান করুন...
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span
                    style={{
                      backgroundColor: 'var(--theme-success-soft)',
                      color: 'var(--theme-success)',
                      borderColor: 'var(--theme-success-border)',
                    }}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold"
                  >
                    <CheckCircle2 size={10} />
                    <span>উপস্থিত (Success)</span>
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--theme-warning-soft)',
                      color: 'var(--theme-warning)',
                      borderColor: 'var(--theme-warning-border)',
                    }}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold"
                  >
                    <AlertTriangle size={10} />
                    <span>ছুটি (Warning)</span>
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--theme-danger-soft)',
                      color: 'var(--theme-danger)',
                      borderColor: 'var(--theme-danger-border)',
                    }}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold"
                  >
                    <AlertCircle size={10} />
                    <span>অনুপস্থিত (Danger)</span>
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--theme-info-soft)',
                      color: 'var(--theme-info)',
                      borderColor: 'var(--theme-info-border)',
                    }}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold"
                  >
                    <Info size={10} />
                    <span>তথ্য (Info)</span>
                  </span>
                </div>
              </div>

              {/* Card 2: Mini Bottom Navigation Preview */}
              <div
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                }}
                className="p-3 rounded-xl border flex flex-col justify-between space-y-2"
              >
                <span style={{ color: 'var(--theme-text-secondary)' }} className="text-[10px] font-bold uppercase">
                  বটম নেভিগেশন প্রিভিউ
                </span>
                <div
                  style={{
                    backgroundColor: 'var(--theme-nav)',
                    borderColor: 'var(--theme-border)',
                  }}
                  className="grid grid-cols-4 border rounded-xl overflow-hidden py-1.5"
                >
                  {[
                    { label: 'হোম', icon: <Home size={14} />, active: true },
                    { label: 'ব্যাচ', icon: <Layers size={14} />, active: false },
                    { label: 'শিক্ষার্থী', icon: <Users size={14} />, active: false },
                    { label: 'হাজিরা', icon: <CalendarCheck size={14} />, active: false },
                  ].map((tab) => (
                    <div
                      key={tab.label}
                      style={{
                        color: tab.active ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                      }}
                      className="relative flex flex-col items-center justify-center py-0.5"
                    >
                      {tab.active && (
                        <span
                          style={{ backgroundColor: 'var(--theme-primary)' }}
                          className="w-5 h-0.5 rounded-full mb-1"
                        />
                      )}
                      {tab.icon}
                      <span className="text-[9px] font-semibold mt-0.5">{tab.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Token Color Editors Grouped */}
        <div className="space-y-4">
          {groupedTokens.map(({ group, meta, tokens }) => (
            <div key={group} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-theme-text-primary">
                  {meta.titleBn} <span className="text-theme-text-muted font-medium">({meta.sub})</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tokens.map((tokenMeta) => {
                  const currentHex = currentEditingTokens[tokenMeta.key];
                  const defaultHex = currentDefaultTokens[tokenMeta.key];
                  const inputKey = `${editTabMode}:${tokenMeta.key}`;
                  const displayHex = hexInputs[inputKey] ?? currentHex;
                  const errorMsg = hexErrors[inputKey];
                  const isModified = currentHex.toUpperCase() !== defaultHex.toUpperCase();

                  return (
                    <div
                      key={tokenMeta.key}
                      className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {/* Visual Color Picker Swatch */}
                        <label
                          className="relative w-10 h-10 rounded-xl border border-theme-border-strong overflow-hidden shrink-0 cursor-pointer shadow-2xs"
                          style={{ backgroundColor: currentHex }}
                          title={`${tokenMeta.labelEn} রঙ নির্বাচন করুন`}
                        >
                          <input
                            type="color"
                            value={currentHex}
                            onChange={(e) => handleTokenColorPickerChange(tokenMeta.key, e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            aria-label={`${tokenMeta.labelEn} color picker`}
                          />
                        </label>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-theme-text-primary truncate">
                              {tokenMeta.labelEn}
                            </span>
                            {isModified && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-theme-primary-soft text-theme-primary-soft-fg font-semibold shrink-0">
                                পরিবর্তিত
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-theme-text-secondary truncate">
                            {tokenMeta.labelBn} • {tokenMeta.descriptionBn}
                          </p>
                          {errorMsg && (
                            <p className="text-[10px] text-theme-danger font-semibold mt-0.5">
                              {errorMsg}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <input
                          type="text"
                          value={displayHex}
                          onChange={(e) => handleHexTextChange(tokenMeta.key, e.target.value)}
                          maxLength={7}
                          spellCheck={false}
                          aria-label={`${tokenMeta.labelEn} HEX code`}
                          className={`w-22 px-2 py-1.5 rounded-lg border text-xs font-mono uppercase bg-theme-elevated text-theme-text-primary focus:outline-none focus:ring-2 ${
                            errorMsg
                              ? 'border-theme-danger focus:ring-theme-danger/30'
                              : 'border-theme-border focus:ring-theme-primary/30 focus:border-theme-primary'
                          }`}
                        />
                        {isModified && (
                          <button
                            type="button"
                            onClick={() => handleResetSingleToken(tokenMeta.key)}
                            className="p-1.5 rounded-lg text-theme-text-secondary hover:text-theme-primary hover:bg-theme-surface transition cursor-pointer"
                            title={`ডিফল্ট (${defaultHex}) এ রিসেট করুন`}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons Footer */}
        <div className="pt-4 border-t border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetCurrentMode}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary flex items-center space-x-1.5 transition cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>বর্তমান মোড রিসেট ({editTabMode === 'dark' ? 'Dark' : 'Light'})</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreDefaultTheme}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-secondary hover:text-theme-text-primary flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Palette size={14} />
              <span>ডিফল্ট থিমে ফিরুন (Emerald Slate)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 sm:ml-auto">
            {isDirty && (
              <button
                type="button"
                onClick={handleCancelChanges}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-secondary flex items-center space-x-1.5 transition cursor-pointer"
              >
                <X size={14} />
                <span>বাতিল (Cancel)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={!isDirty || hasValidationErrors}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg flex items-center space-x-2 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check size={15} />
              <span>পরিবর্তন প্রয়োগ করুন (Apply Changes)</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ThemeSettingsSection;
