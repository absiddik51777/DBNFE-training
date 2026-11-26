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

function parseTemplateParam(search: string): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const val = params.get('tpl')?.trim();
    return val ? val : null;
  } catch {
    return null;
  }
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
  const activeTemplateId =
    rawSection === 'custom-builder' ? parseTemplateParam(location.search) : null;

  const effectiveSection: ReportSectionId | null =
    rawSection ?? (isDesktopSplit ? 'monthly-attendance' : null);

  const openSection = useCallback(
    (sectionId: ReportSectionId, templateId?: string | null) => {
      if (sectionId === 'custom-builder' && templateId) {
        navigate(`/reports?tpl=${encodeURIComponent(templateId)}#custom-builder`);
        return;
      }
      navigate(`/reports#${sectionId}`);
    },
    [navigate]
  );

  const setTemplateQuery = useCallback(
    (templateId: string | null) => {
      const targetUrl = templateId
        ? `/reports?tpl=${encodeURIComponent(templateId)}#custom-builder`
        : '/reports#custom-builder';
      navigate(targetUrl, { replace: true });
    },
    [navigate]
  );

  const goToHub = useCallback(() => {
    navigate('/reports');
  }, [navigate]);

  return {
    isDesktopSplit,
    activeSection: effectiveSection,
    activeTemplateId,
    openSection,
    setTemplateQuery,
    goToHub,
  };
}
