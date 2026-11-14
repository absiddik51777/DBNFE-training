import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import type { AuditLocation } from '../../types';

interface LocationRowProps {
  location?: AuditLocation;
  isAdmin: boolean;
}

export const LocationRow: React.FC<LocationRowProps> = ({ location, isAdmin }) => {
  if (!location) return null;

  // Non-admin users never see coordinates, accuracy, or external map links
  if (!isAdmin) {
    if (location.status !== 'granted') return null;
    return (
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-theme-text-secondary">
          <MapPin size={15} className="text-theme-primary shrink-0" aria-hidden="true" />
          <span className="text-[11px] text-theme-text-muted">অবস্থান</span>
        </div>
        <span className="font-semibold text-theme-text-primary">অবস্থান সংরক্ষিত</span>
      </div>
    );
  }

  if (location.status === 'granted') {
    const accuracyMeters =
      typeof location.accuracy === 'number' && Number.isFinite(location.accuracy)
        ? Math.max(1, Math.round(location.accuracy))
        : null;
    const accuracyText = accuracyMeters
      ? `প্রায় ${accuracyMeters} মিটারের মধ্যে`
      : 'অবস্থান সংরক্ষিত';

    const hasCoords =
      typeof location.lat === 'number' &&
      Number.isFinite(location.lat) &&
      typeof location.lng === 'number' &&
      Number.isFinite(location.lng);

    const mapUrl = hasCoords
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${location.lat},${location.lng}`)}`
      : null;

    return (
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[10px] border border-theme-border bg-theme-primary-soft text-theme-primary flex items-center justify-center shrink-0">
            <MapPin size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] text-theme-text-muted">কাজের অবস্থান</div>
            <div className="font-semibold text-theme-text-primary mt-0.5 tabular-nums">
              {accuracyText}
            </div>
          </div>
        </div>

        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-3 py-1.5 rounded-[10px] border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-xs font-semibold text-theme-primary inline-flex items-center gap-1.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary shrink-0"
          >
            <span>ম্যাপে দেখুন</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  const fallbackText =
    location.status === 'denied'
      ? 'অনুমতি দেওয়া হয়নি'
      : 'অবস্থান পাওয়া যায়নি';

  return (
    <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5 flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-theme-text-secondary">
        <MapPin size={15} className="text-theme-text-muted shrink-0" aria-hidden="true" />
        <span className="text-[11px] text-theme-text-muted">কাজের অবস্থান</span>
      </div>
      <span className="font-medium text-theme-text-secondary">{fallbackText}</span>
    </div>
  );
};
