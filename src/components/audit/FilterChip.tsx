import React from 'react';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`font-sans min-h-[40px] h-auto py-1.5 px-3.5 rounded-full border text-xs sm:text-[13px] leading-normal whitespace-nowrap shrink-0 inline-flex items-center justify-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary motion-reduce:transition-none ${
        selected
          ? 'bg-theme-primary-soft text-theme-primary-soft-fg border-theme-primary-border font-medium'
          : 'bg-theme-surface text-theme-text-secondary border-theme-border font-normal hover:bg-theme-surface-hover hover:text-theme-text-primary'
      } ${className}`}
    >
      {label}
    </button>
  );
};
