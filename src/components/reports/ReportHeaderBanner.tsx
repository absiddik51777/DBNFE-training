import React from 'react';
import {
  clampReportLogoSize,
  sanitizeLogoUrl,
} from '../../lib/reportLogoUtils';

interface ReportHeaderBannerProps {
  leftLogoUrl?: string;
  rightLogoUrl?: string;
  logoSizePx?: number;
  scale?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Symmetrical 3-column official report header container:
 * renders optional Top Left and Top Right logos while keeping the
 * centered government & office titles optically dead-center.
 */
export const ReportHeaderBanner: React.FC<ReportHeaderBannerProps> = ({
  leftLogoUrl,
  rightLogoUrl,
  logoSizePx,
  scale = 1,
  className = '',
  children,
}) => {
  const safeLeft = sanitizeLogoUrl(leftLogoUrl);
  const safeRight = sanitizeLogoUrl(rightLogoUrl);
  const hasAnyLogo = Boolean(safeLeft || safeRight);

  if (!hasAnyLogo) {
    return <div className={`text-center ${className}`}>{children}</div>;
  }

  const baseSize = clampReportLogoSize(logoSizePx);
  const renderedSize = Math.max(30, Math.round(baseSize * scale));

  const renderLogoImg = (src: string, alt: string) => {
    const isHttp = /^https?:\/\//i.test(src);
    return (
      <img
        src={src}
        alt={alt}
        crossOrigin={isHttp ? 'anonymous' : undefined}
        style={{
          maxWidth: `${renderedSize}px`,
          maxHeight: `${renderedSize}px`,
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    );
  };

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div
        style={{
          width: `${renderedSize}px`,
          minWidth: `${renderedSize}px`,
          minHeight: `${renderedSize}px`,
        }}
        className="shrink-0 flex items-center justify-start"
      >
        {safeLeft ? renderLogoImg(safeLeft, 'বাম পাশের লোগো') : null}
      </div>

      <div className="flex-1 min-w-0 text-center">{children}</div>

      <div
        style={{
          width: `${renderedSize}px`,
          minWidth: `${renderedSize}px`,
          minHeight: `${renderedSize}px`,
        }}
        className="shrink-0 flex items-center justify-end"
      >
        {safeRight ? renderLogoImg(safeRight, 'ডান পাশের লোগো') : null}
      </div>
    </div>
  );
};
