import type { ThemeTokens } from '../../lib/theme';

export type SettingsSectionId =
  | 'appearance'
  | 'access'
  | 'roles'
  | 'rules'
  | 'data'
  | 'logs'
  | 'danger';

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  'appearance',
  'access',
  'roles',
  'rules',
  'data',
  'logs',
  'danger',
];

export type SettingsGroupId = 'general' | 'data' | 'risk';

export interface SettingsSectionMeta {
  id: SettingsSectionId;
  group: SettingsGroupId;
  title: string;
  adminOnly?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { id: 'appearance', group: 'general', title: 'থিম ও অ্যাপিয়ারেন্স' },
  { id: 'access', group: 'general', title: 'নিবন্ধন ও অ্যাক্সেস' },
  { id: 'roles', group: 'general', title: 'রোল ও পারমিশন' },
  { id: 'rules', group: 'general', title: 'নিয়ম ও মানদণ্ড' },
  { id: 'data', group: 'data', title: 'ডাটা ব্যবস্থাপনা' },
  { id: 'logs', group: 'data', title: 'অডিট লগ' },
  { id: 'danger', group: 'risk', title: 'ডেঞ্জার জোন', adminOnly: true },
];

export interface AccentPresetOption {
  id: string;
  label: string;
  swatch: string;
  light: Pick<ThemeTokens, 'primary' | 'primaryHover' | 'primarySoft' | 'accent'>;
  dark: Pick<ThemeTokens, 'primary' | 'primaryHover' | 'primarySoft' | 'accent'>;
}

export const ACCENT_OPTIONS: AccentPresetOption[] = [
  {
    id: 'emerald',
    label: 'এমেরাল্ড',
    swatch: '#0f766e',
    light: {
      primary: '#0f766e',
      primaryHover: '#115e59',
      primarySoft: '#ccfbf1',
      accent: '#0f766e',
    },
    dark: {
      primary: '#2dd4bf',
      primaryHover: '#5eead4',
      primarySoft: '#134e4a',
      accent: '#2dd4bf',
    },
  },
  {
    id: 'blue',
    label: 'নীল',
    swatch: '#2563eb',
    light: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primarySoft: '#dbeafe',
      accent: '#0284c7',
    },
    dark: {
      primary: '#60a5fa',
      primaryHover: '#93c5fd',
      primarySoft: '#1e3a8a',
      accent: '#38bdf8',
    },
  },
  {
    id: 'teal',
    label: 'সায়ান',
    swatch: '#0891b2',
    light: {
      primary: '#0891b2',
      primaryHover: '#0e7490',
      primarySoft: '#cffafe',
      accent: '#0284c7',
    },
    dark: {
      primary: '#22d3ee',
      primaryHover: '#67e8f9',
      primarySoft: '#164e63',
      accent: '#38bdf8',
    },
  },
  {
    id: 'indigo',
    label: 'ইন্ডিগো',
    swatch: '#4f46e5',
    light: {
      primary: '#4f46e5',
      primaryHover: '#4338ca',
      primarySoft: '#e0e7ff',
      accent: '#6366f1',
    },
    dark: {
      primary: '#818cf8',
      primaryHover: '#a5b4fc',
      primarySoft: '#312e81',
      accent: '#818cf8',
    },
  },
];

export interface SettingsCounts {
  attendance: number;
  trainees: number;
  exams: number;
  marks: number;
  batches: number;
  institutes: number;
  trades: number;
}

export type SettingsToastType = 'success' | 'error' | 'warning';

export interface SettingsToast {
  id: number;
  type: SettingsToastType;
  message: string;
}
