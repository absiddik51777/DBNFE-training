import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { THEME_PRESETS } from '../lib/theme';
import { ThemeSettingsSection } from '../components/settings/ThemeSettingsSection';

const ThemeSettings: React.FC = () => {
  const { config, resolvedMode } = useTheme();

  const activePreset = THEME_PRESETS.find((p) => p.id === config.presetId);
  const presetLabel = activePreset ? activePreset.name : 'Custom';
  const modeLabel =
    config.mode === 'system'
      ? `System (${resolvedMode === 'dark' ? 'Dark' : 'Light'})`
      : config.mode === 'dark'
      ? 'Dark Mode'
      : 'Light Mode';

  return (
    <div className="space-y-6 max-w-5xl pb-20">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-theme-text-muted">
            <Link
              to="/settings"
              className="hover:text-theme-primary font-medium transition-colors whitespace-nowrap"
            >
              সেটিংস (Settings)
            </Link>
            <ChevronRight size={13} aria-hidden="true" className="shrink-0" />
            <span className="text-theme-text-primary font-semibold truncate">
              থিম ও অ্যাপিয়ারেন্স (Theme Settings)
            </span>
          </nav>

          <h1 className="text-xl sm:text-2xl font-bold text-theme-text-primary">
            থিম ও অ্যাপিয়ারেন্স সেটিংস (Theme &amp; Appearance)
          </h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-theme-text-secondary">
            <span className="inline-flex items-center space-x-1 font-medium text-theme-text-primary">
              {config.mode === 'system' ? (
                <Monitor size={13} className="text-theme-primary" />
              ) : resolvedMode === 'dark' ? (
                <Moon size={13} className="text-theme-primary" />
              ) : (
                <Sun size={13} className="text-theme-primary" />
              )}
              <span>{modeLabel}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>প্রিসেট: {presetLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Light ও Dark মোডের কালার টোকেন স্বাধীনভাবে কাস্টমাইজ করুন</span>
          </div>
        </div>

        <Link
          to="/settings"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary border border-theme-border text-xs sm:text-sm font-semibold transition shadow-2xs self-start sm:self-center shrink-0 whitespace-nowrap"
        >
          <ArrowLeft size={16} />
          <span>সেটিংসে ফিরুন</span>
        </Link>
      </div>

      {/* Main Theme Customization Workspace */}
      <ThemeSettingsSection hideHeader />
    </div>
  );
};

export default ThemeSettings;
