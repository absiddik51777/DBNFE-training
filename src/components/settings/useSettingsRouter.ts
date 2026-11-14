import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SETTINGS_SECTION_IDS, SettingsSectionId } from './types';

function parseHashSection(hash: string): SettingsSectionId | null {
  const cleaned = (hash || '').replace(/^#/, '').trim().toLowerCase();
  if ((SETTINGS_SECTION_IDS as string[]).includes(cleaned)) {
    return cleaned as SettingsSectionId;
  }
  return null;
}

export function useSettingsRouter(
  isAdmin: boolean,
  onDenied?: (message: string) => void
) {
  const location = useLocation();
  const navigate = useNavigate();

  const [isDesktopSplit, setIsDesktopSplit] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(min-width: 800px)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 800px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopSplit(e.matches);

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  const rawSection = parseHashSection(location.hash);

  // Guard admin-only #danger hash
  useEffect(() => {
    if (rawSection === 'danger' && !isAdmin) {
      onDenied?.('ডেঞ্জার জোন শুধুমাত্র কোর্স পরিচালকের জন্য সংরক্ষিত।');
      navigate(isDesktopSplit ? '/settings#appearance' : '/settings', { replace: true });
    }
  }, [rawSection, isAdmin, isDesktopSplit, navigate, onDenied]);

  const effectiveSection: SettingsSectionId | null =
    rawSection === 'danger' && !isAdmin
      ? isDesktopSplit
        ? 'appearance'
        : null
      : rawSection ?? (isDesktopSplit ? 'appearance' : null);

  const openSection = useCallback(
    (sectionId: SettingsSectionId) => {
      if (sectionId === 'danger' && !isAdmin) {
        onDenied?.('ডেঞ্জার জোন শুধুমাত্র কোর্স পরিচালকের জন্য সংরক্ষিত।');
        return;
      }
      navigate(`/settings#${sectionId}`);
    },
    [isAdmin, navigate, onDenied]
  );

  const goToHub = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  return {
    isDesktopSplit,
    activeSection: effectiveSection,
    openSection,
    goToHub,
  };
}
