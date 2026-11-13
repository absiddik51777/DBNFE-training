export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export type ThemeTokenKey =
  | 'primary'
  | 'primaryHover'
  | 'primarySoft'
  | 'accent'
  | 'background'
  | 'surface'
  | 'elevatedSurface'
  | 'navigation'
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'border'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type ThemeTokens = Record<ThemeTokenKey, string>;

export type ThemePresetId =
  | 'emerald-slate'
  | 'professional-blue'
  | 'teal-modern'
  | 'indigo-professional'
  | 'forest-green'
  | 'custom';

export interface ThemePreset {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  nameBn: string;
  descriptionBn: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export interface ThemeConfig {
  mode: ThemeMode;
  presetId: ThemePresetId;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export interface ThemeTokenMeta {
  key: ThemeTokenKey;
  labelEn: string;
  labelBn: string;
  descriptionBn: string;
  group: 'brand' | 'surfaces' | 'typography' | 'status';
  cssVar: string;
}

export const THEME_STORAGE_KEY = 'bnfe_theme_config_v1';

export const DEFAULT_LIGHT_TOKENS: ThemeTokens = {
  primary: '#059669',
  primaryHover: '#047857',
  primarySoft: '#D1FAE5',
  accent: '#0D9488',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  elevatedSurface: '#FFFFFF',
  navigation: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
};

export const DEFAULT_DARK_TOKENS: ThemeTokens = {
  primary: '#34D399',
  primaryHover: '#6EE7B7',
  primarySoft: '#064E3B',
  accent: '#2DD4BF',
  background: '#020617',
  surface: '#0F172A',
  elevatedSurface: '#1E293B',
  navigation: '#0F172A',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E293B',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'emerald-slate',
    name: 'Emerald Slate',
    nameBn: 'এমেরাল্ড স্লেট (ডিফল্ট)',
    descriptionBn: 'BNFE প্রফেশনাল এমেরাল্ড ও স্লেট ডিজাইন সিস্টেম',
    light: { ...DEFAULT_LIGHT_TOKENS },
    dark: { ...DEFAULT_DARK_TOKENS },
  },
  {
    id: 'professional-blue',
    name: 'Professional Blue',
    nameBn: 'প্রফেশনাল ব্লু',
    descriptionBn: 'সরকারি ও প্রাতিষ্ঠানিক রিপোর্টিংয়ের জন্য ক্লাসিক নীল থিম',
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primarySoft: '#DBEAFE',
      accent: '#0284C7',
      info: '#0284C7',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      primary: '#60A5FA',
      primaryHover: '#93C5FD',
      primarySoft: '#1E3A8A',
      accent: '#38BDF8',
      info: '#38BDF8',
    },
  },
  {
    id: 'teal-modern',
    name: 'Teal Modern',
    nameBn: 'টিল মডার্ন',
    descriptionBn: 'আধুনিক ও স্নিগ্ধ টিল-সায়ান অ্যাক্সেন্ট প্যালট',
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      primary: '#0D9488',
      primaryHover: '#0F766E',
      primarySoft: '#CCFBF1',
      accent: '#0891B2',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      primary: '#2DD4BF',
      primaryHover: '#5EEAD4',
      primarySoft: '#134E4A',
      accent: '#22D3EE',
    },
  },
  {
    id: 'indigo-professional',
    name: 'Indigo Professional',
    nameBn: 'ইন্ডিগো প্রফেশনাল',
    descriptionBn: 'গভীর ইন্ডিগো প্রাইমারি ও নিরপেক্ষ স্লেট সারফেস',
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      primary: '#4F46E5',
      primaryHover: '#4338CA',
      primarySoft: '#E0E7FF',
      accent: '#7C3AED',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      primary: '#818CF8',
      primaryHover: '#A5B4FC',
      primarySoft: '#312E81',
      accent: '#A78BFA',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    nameBn: 'ফরেস্ট গ্রিন',
    descriptionBn: 'প্রাকৃতিক ও দৃঢ় সবুজ ব্র্যান্ডিং এবং উচ্চ বৈপরীত্য',
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      primary: '#15803D',
      primaryHover: '#166534',
      primarySoft: '#DCFCE7',
      accent: '#059669',
      success: '#15803D',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      primary: '#4ADE80',
      primaryHover: '#86EFAC',
      primarySoft: '#14532D',
      accent: '#34D399',
      success: '#4ADE80',
    },
  },
];

export const THEME_TOKEN_METADATA: ThemeTokenMeta[] = [
  {
    key: 'primary',
    labelEn: 'Primary',
    labelBn: 'প্রাইমারি কালার',
    descriptionBn: 'মূল বাটন, অ্যাক্টিভ ট্যাব ও ব্র্যান্ড হাইলাইট',
    group: 'brand',
    cssVar: '--theme-primary',
  },
  {
    key: 'primaryHover',
    labelEn: 'Primary Hover',
    labelBn: 'প্রাইমারি হোভার',
    descriptionBn: 'বাটন বা লিঙ্কে মাউস/টাচ করলে রঙ',
    group: 'brand',
    cssVar: '--theme-primary-hover',
  },
  {
    key: 'primarySoft',
    labelEn: 'Primary Soft',
    labelBn: 'প্রাইমারি সফট টিন্ট',
    descriptionBn: 'হালকা ব্যাজ, অ্যাক্টিভ পিল ও আইকন ব্যাকগ্রাউন্ড',
    group: 'brand',
    cssVar: '--theme-primary-soft',
  },
  {
    key: 'accent',
    labelEn: 'Accent',
    labelBn: 'অ্যাক্সেন্ট কালার',
    descriptionBn: 'সেকেন্ডারি হাইলাইট ও চার্টের পরিপূরক রঙ',
    group: 'brand',
    cssVar: '--theme-accent',
  },
  {
    key: 'background',
    labelEn: 'Background',
    labelBn: 'পৃষ্ঠার ব্যাকগ্রাউন্ড',
    descriptionBn: 'মূল পেজের সামগ্রিক পটভূমির রঙ',
    group: 'surfaces',
    cssVar: '--theme-bg',
  },
  {
    key: 'surface',
    labelEn: 'Surface / Cards',
    labelBn: 'কার্ড ও সারফেস',
    descriptionBn: 'তথ্যের কার্ড, ফর্ম প্যানেল ও টেবিল কন্টেইনার',
    group: 'surfaces',
    cssVar: '--theme-surface',
  },
  {
    key: 'elevatedSurface',
    labelEn: 'Elevated Surface',
    labelBn: 'উন্নত/পপওভার সারফেস',
    descriptionBn: 'মডাল, ড্রপডাউন, ইনপুট ও ভাসমান উপাদান',
    group: 'surfaces',
    cssVar: '--theme-elevated',
  },
  {
    key: 'navigation',
    labelEn: 'Navigation',
    labelBn: 'নেভিগেশন বার',
    descriptionBn: 'সাইডবার, টপ হেডার ও মোবাইল বটম নেভিগেশন',
    group: 'surfaces',
    cssVar: '--theme-nav',
  },
  {
    key: 'textPrimary',
    labelEn: 'Primary Text',
    labelBn: 'মূল লেখা (Text)',
    descriptionBn: 'শিরোনাম, নাম ও প্রধান তথ্যের রঙ',
    group: 'typography',
    cssVar: '--theme-text-primary',
  },
  {
    key: 'textSecondary',
    labelEn: 'Secondary Text',
    labelBn: 'সেকেন্ডারি লেখা',
    descriptionBn: 'সাবটাইটেল, বিবরণ ও টেবিল কলাম লেবেল',
    group: 'typography',
    cssVar: '--theme-text-secondary',
  },
  {
    key: 'textMuted',
    labelEn: 'Muted Text',
    labelBn: 'হালকা/মিউটেড লেখা',
    descriptionBn: 'প্লেসহোল্ডার, হেল্পার টেক্সট ও নিষ্ক্রিয় আইকন',
    group: 'typography',
    cssVar: '--theme-text-muted',
  },
  {
    key: 'border',
    labelEn: 'Border',
    labelBn: 'বর্ডার ও ডিভাইডার',
    descriptionBn: 'কার্ড, টেবিল ও ইনপুটের সীমারেখা',
    group: 'typography',
    cssVar: '--theme-border',
  },
  {
    key: 'success',
    labelEn: 'Success',
    labelBn: 'সাফল্য (Success)',
    descriptionBn: 'উপস্থিত, পাস ও অনুমোদিত অবস্থা',
    group: 'status',
    cssVar: '--theme-success',
  },
  {
    key: 'warning',
    labelEn: 'Warning',
    labelBn: 'সতর্কতা (Warning)',
    descriptionBn: 'ছুটি, অপেক্ষমাণ ও সতর্কতামূলক বার্তা',
    group: 'status',
    cssVar: '--theme-warning',
  },
  {
    key: 'danger',
    labelEn: 'Danger',
    labelBn: 'বিপদ/ত্রুটি (Danger)',
    descriptionBn: 'অনুপস্থিত, ফেল, ডিলিট ও ত্রুটি নির্দেশক',
    group: 'status',
    cssVar: '--theme-danger',
  },
  {
    key: 'info',
    labelEn: 'Info',
    labelBn: 'তথ্য (Info)',
    descriptionBn: 'সাধারণ বিজ্ঞপ্তি, পরিসংখ্যান ও তথ্য কার্ড',
    group: 'status',
    cssVar: '--theme-info',
  },
];

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'system',
  presetId: 'emerald-slate',
  light: { ...DEFAULT_LIGHT_TOKENS },
  dark: { ...DEFAULT_DARK_TOKENS },
};

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;
const HEX_SHORT_REGEX = /^#([0-9A-Fa-f]{3})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value.trim());
}

export function normalizeHexColor(value: string): string | null {
  let clean = value.trim();
  if (!clean.startsWith('#')) {
    clean = `#${clean}`;
  }
  const shortMatch = clean.match(HEX_SHORT_REGEX);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (HEX_COLOR_REGEX.test(clean)) {
    return clean.toUpperCase();
  }
  return null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex) || '#059669';
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Returns crisp readable foreground (#FFFFFF or #0F172A) for any arbitrary HEX background.
 */
export function getReadableForeground(bgHex: string): string {
  const lum = getRelativeLuminance(bgHex);
  return lum > 0.36 ? '#0F172A' : '#FFFFFF';
}

export function blendHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  const r = Math.round(a.r * (1 - w) + b.r * w);
  const g = Math.round(a.g * (1 - w) + b.g * w);
  const bl = Math.round(a.b * (1 - w) + b.b * w);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function buildThemeCssVariables(
  tokens: ThemeTokens,
  resolvedMode: ResolvedThemeMode
): Record<string, string> {
  const isDark = resolvedMode === 'dark';
  const softAlpha = isDark ? 0.16 : 0.11;
  const borderAlpha = isDark ? 0.32 : 0.26;

  const surfaceSubtle = blendHex(tokens.surface, tokens.background, isDark ? 0.45 : 0.72);
  const surfaceHover = blendHex(tokens.surface, tokens.textPrimary, isDark ? 0.07 : 0.035);
  const primaryTextOnSoft = isDark
    ? blendHex(tokens.primary, '#FFFFFF', 0.32)
    : blendHex(tokens.primary, '#0F172A', 0.18);

  return {
    '--theme-primary': tokens.primary,
    '--theme-primary-hover': tokens.primaryHover,
    '--theme-primary-soft': tokens.primarySoft,
    '--theme-primary-fg': getReadableForeground(tokens.primary),
    '--theme-primary-soft-fg': primaryTextOnSoft,
    '--theme-primary-border': hexToRgba(tokens.primary, borderAlpha),
    '--theme-primary-ring': hexToRgba(tokens.primary, isDark ? 0.35 : 0.22),

    '--theme-accent': tokens.accent,
    '--theme-accent-fg': getReadableForeground(tokens.accent),
    '--theme-accent-soft': hexToRgba(tokens.accent, softAlpha),
    '--theme-accent-border': hexToRgba(tokens.accent, borderAlpha),

    '--theme-bg': tokens.background,
    '--theme-surface': tokens.surface,
    '--theme-surface-subtle': surfaceSubtle,
    '--theme-surface-hover': surfaceHover,
    '--theme-elevated': tokens.elevatedSurface,
    '--theme-nav': tokens.navigation,

    '--theme-text-primary': tokens.textPrimary,
    '--theme-text-secondary': tokens.textSecondary,
    '--theme-text-muted': tokens.textMuted,
    '--theme-border': tokens.border,
    '--theme-border-strong': blendHex(tokens.border, tokens.textSecondary, isDark ? 0.35 : 0.25),

    '--theme-success': tokens.success,
    '--theme-success-fg': getReadableForeground(tokens.success),
    '--theme-success-soft': hexToRgba(tokens.success, softAlpha),
    '--theme-success-border': hexToRgba(tokens.success, borderAlpha),

    '--theme-warning': tokens.warning,
    '--theme-warning-fg': getReadableForeground(tokens.warning),
    '--theme-warning-soft': hexToRgba(tokens.warning, softAlpha),
    '--theme-warning-border': hexToRgba(tokens.warning, borderAlpha),

    '--theme-danger': tokens.danger,
    '--theme-danger-fg': getReadableForeground(tokens.danger),
    '--theme-danger-soft': hexToRgba(tokens.danger, softAlpha),
    '--theme-danger-border': hexToRgba(tokens.danger, borderAlpha),

    '--theme-info': tokens.info,
    '--theme-info-fg': getReadableForeground(tokens.info),
    '--theme-info-soft': hexToRgba(tokens.info, softAlpha),
    '--theme-info-border': hexToRgba(tokens.info, borderAlpha),
  };
}

export function applyThemeToDocument(
  tokens: ThemeTokens,
  resolvedMode: ResolvedThemeMode
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (resolvedMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = resolvedMode;

  const vars = buildThemeCssVariables(tokens, resolvedMode);
  Object.entries(vars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  // Update theme-color meta tag for Android WebView / mobile status bar tinting
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', tokens.navigation);
  }
}

function sanitizeTokens(
  partial: Partial<ThemeTokens> | undefined,
  defaults: ThemeTokens
): ThemeTokens {
  const result: ThemeTokens = { ...defaults };
  if (!partial || typeof partial !== 'object') return result;

  (Object.keys(defaults) as ThemeTokenKey[]).forEach((key) => {
    const candidate = partial[key];
    if (typeof candidate === 'string') {
      const normalized = normalizeHexColor(candidate);
      if (normalized) {
        result[key] = normalized;
      }
    }
  });
  return result;
}

export function loadThemeConfig(): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME_CONFIG;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;

    const mode: ThemeMode =
      parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system'
        ? parsed.mode
        : 'system';

    const validPresetIds: ThemePresetId[] = [
      'emerald-slate',
      'professional-blue',
      'teal-modern',
      'indigo-professional',
      'forest-green',
      'custom',
    ];
    const presetId: ThemePresetId = validPresetIds.includes(parsed.presetId as ThemePresetId)
      ? (parsed.presetId as ThemePresetId)
      : 'emerald-slate';

    return {
      mode,
      presetId,
      light: sanitizeTokens(parsed.light, DEFAULT_LIGHT_TOKENS),
      dark: sanitizeTokens(parsed.dark, DEFAULT_DARK_TOKENS),
    };
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

export function saveThemeConfig(config: ThemeConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Could not persist theme config to localStorage:', err);
  }
}
