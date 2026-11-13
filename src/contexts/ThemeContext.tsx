import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ThemeConfig,
  ThemeMode,
  ResolvedThemeMode,
  ThemeTokens,
  ThemePresetId,
  ThemeTokenKey,
  DEFAULT_THEME_CONFIG,
  DEFAULT_LIGHT_TOKENS,
  DEFAULT_DARK_TOKENS,
  THEME_PRESETS,
  loadThemeConfig,
  saveThemeConfig,
  resolveThemeMode,
  applyThemeToDocument,
  normalizeHexColor,
} from '../lib/theme';

interface ThemeContextValue {
  config: ThemeConfig;
  resolvedMode: ResolvedThemeMode;
  activeTokens: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  applyConfig: (nextConfig: ThemeConfig) => void;
  selectPreset: (presetId: Exclude<ThemePresetId, 'custom'>) => void;
  resetModeTokens: (modeToReset: ResolvedThemeMode) => void;
  restoreDefaultTheme: () => void;
  updateSingleToken: (
    targetMode: ResolvedThemeMode,
    key: ThemeTokenKey,
    hexValue: string
  ) => void;
  chartPalette: {
    primary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    textPrimary: string;
    textSecondary: string;
    surface: string;
    border: string;
    grid: string;
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ThemeConfig>(() => loadThemeConfig());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to OS/browser color-scheme changes for System Default mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy Safari/WebView fallback
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const resolvedMode: ResolvedThemeMode = useMemo(() => {
    if (config.mode === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return config.mode;
  }, [config.mode, systemPrefersDark]);

  const activeTokens: ThemeTokens = useMemo(() => {
    return resolvedMode === 'dark' ? config.dark : config.light;
  }, [config.dark, config.light, resolvedMode]);

  // Apply CSS custom properties & .dark class immediately on any change
  useEffect(() => {
    applyThemeToDocument(activeTokens, resolvedMode);
  }, [activeTokens, resolvedMode]);

  const applyConfig = useCallback((nextConfig: ThemeConfig) => {
    setConfig(nextConfig);
    saveThemeConfig(nextConfig);
    const nextResolved =
      nextConfig.mode === 'system' ? resolveThemeMode('system') : nextConfig.mode;
    applyThemeToDocument(
      nextResolved === 'dark' ? nextConfig.dark : nextConfig.light,
      nextResolved
    );
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      applyConfig({
        ...config,
        mode,
      });
    },
    [config, applyConfig]
  );

  const selectPreset = useCallback(
    (presetId: Exclude<ThemePresetId, 'custom'>) => {
      const preset = THEME_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      applyConfig({
        ...config,
        presetId: preset.id,
        light: { ...preset.light },
        dark: { ...preset.dark },
      });
    },
    [config, applyConfig]
  );

  const resetModeTokens = useCallback(
    (modeToReset: ResolvedThemeMode) => {
      const nextConfig: ThemeConfig = {
        ...config,
        presetId: 'custom',
        light: modeToReset === 'light' ? { ...DEFAULT_LIGHT_TOKENS } : config.light,
        dark: modeToReset === 'dark' ? { ...DEFAULT_DARK_TOKENS } : config.dark,
      };
      applyConfig(nextConfig);
    },
    [config, applyConfig]
  );

  const restoreDefaultTheme = useCallback(() => {
    applyConfig({
      mode: config.mode,
      presetId: DEFAULT_THEME_CONFIG.presetId,
      light: { ...DEFAULT_LIGHT_TOKENS },
      dark: { ...DEFAULT_DARK_TOKENS },
    });
  }, [config.mode, applyConfig]);

  const updateSingleToken = useCallback(
    (targetMode: ResolvedThemeMode, key: ThemeTokenKey, hexValue: string) => {
      const normalized = normalizeHexColor(hexValue);
      if (!normalized) return;
      const nextConfig: ThemeConfig = {
        ...config,
        presetId: 'custom',
        light:
          targetMode === 'light'
            ? { ...config.light, [key]: normalized }
            : config.light,
        dark:
          targetMode === 'dark'
            ? { ...config.dark, [key]: normalized }
            : config.dark,
      };
      applyConfig(nextConfig);
    },
    [config, applyConfig]
  );

  const chartPalette = useMemo(
    () => ({
      primary: activeTokens.primary,
      accent: activeTokens.accent,
      success: activeTokens.success,
      warning: activeTokens.warning,
      danger: activeTokens.danger,
      info: activeTokens.info,
      textPrimary: activeTokens.textPrimary,
      textSecondary: activeTokens.textSecondary,
      surface: activeTokens.elevatedSurface,
      border: activeTokens.border,
      grid: activeTokens.border,
    }),
    [activeTokens]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      config,
      resolvedMode,
      activeTokens,
      setMode,
      applyConfig,
      selectPreset,
      resetModeTokens,
      restoreDefaultTheme,
      updateSingleToken,
      chartPalette,
    }),
    [
      config,
      resolvedMode,
      activeTokens,
      setMode,
      applyConfig,
      selectPreset,
      resetModeTokens,
      restoreDefaultTheme,
      updateSingleToken,
      chartPalette,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
