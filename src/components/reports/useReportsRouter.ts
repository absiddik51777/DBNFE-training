import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { REPORT_SECTION_IDS, ReportSectionId } from './types';

function parseHashSection(hash: string): ReportSectionId | null {
  const cleaned = (hash || '').replace(/^#/, '').trim().toLowerCase();
  if ((REPORT_SECTION_IDS as string[]).includes(cleaned)) {
    return cleaned as ReportSectionId;
  }
  return null;
}

export function useReportsRouter() {
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

  const effectiveSection: ReportSectionId | null =
    rawSection ?? (isDesktopSplit ? 'monthly-attendance' : null);

  const openSection = useCallback(
    (sectionId: ReportSectionId) => {
      navigate(`/reports#${sectionId}`);
    },
    [navigate]
  );

  const goToHub = useCallback(() => {
    navigate('/reports');
  }, [navigate]);

  return {
    isDesktopSplit,
    activeSection: effectiveSection,
    openSection,
    goToHub,
  };
}
