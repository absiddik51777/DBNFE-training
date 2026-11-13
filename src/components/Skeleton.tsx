import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-theme-border/70 rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
};

export const TableSkeleton: React.FC<{
  rows?: number;
  cols?: number;
  showHeader?: boolean;
  showToolbar?: boolean;
}> = ({ rows = 8, cols = 6, showHeader = true, showToolbar = true }) => {
  return (
    <div className="space-y-4 w-full" aria-busy="true" aria-label="Loading table data">
      {showToolbar && (
        <div className="bg-theme-surface p-4 rounded-2xl border border-theme-border shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <Skeleton className="h-9 w-full sm:w-72 rounded-xl" />
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-2xs overflow-hidden">
        {showHeader && (
          <div className="bg-theme-surface-subtle border-b border-theme-border px-5 py-3.5 flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        )}

        <div className="divide-y divide-theme-border">
          <div className="px-5 py-3.5 bg-theme-surface-subtle flex items-center gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton
                key={`th-${i}`}
                className={`h-4 ${i === 0 ? 'w-12' : i === 1 ? 'w-36' : 'flex-1'} rounded`}
              />
            ))}
          </div>

          {Array.from({ length: rows }).map((_, rIdx) => (
            <div key={`tr-${rIdx}`} className="px-5 py-3.5 flex items-center gap-4">
              {Array.from({ length: cols }).map((_, cIdx) => (
                <Skeleton
                  key={`td-${rIdx}-${cIdx}`}
                  className={`h-4 ${
                    cIdx === 0
                      ? 'w-10'
                      : cIdx === 1
                      ? 'w-32'
                      : cIdx === cols - 1
                      ? 'w-20'
                      : 'flex-1'
                  } rounded`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 bg-theme-surface-subtle border-t border-theme-border flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-theme-surface p-5 rounded-2xl border border-theme-border shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="pt-2 border-t border-theme-border flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" aria-busy="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-theme-surface p-4 rounded-2xl border border-theme-border shadow-2xs space-y-2"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
};

export const FormSkeleton: React.FC<{ sections?: number }> = ({ sections = 3 }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6" aria-busy="true">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-64 rounded" />
          <Skeleton className="h-3.5 w-40 rounded" />
        </div>
      </div>

      <div className="space-y-5">
        {Array.from({ length: sections }).map((_, idx) => (
          <div
            key={idx}
            className="bg-theme-surface p-6 rounded-2xl border border-theme-border shadow-2xs space-y-4"
          >
            <div className="flex items-center space-x-2 pb-3 border-b border-theme-border">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-48 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-end space-x-3 pt-3">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
