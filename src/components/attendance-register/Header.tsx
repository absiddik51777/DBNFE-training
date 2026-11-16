import React from 'react';
import { GraduationCap, Sun, Moon } from 'lucide-react';
import { getRoleLabelBn } from './types';
import { TruncatedText } from '../ui/TruncatedText';

interface HeaderProps {
  role?: string;
  resolvedMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  resolvedMode,
  onToggleTheme,
}) => {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-[var(--reg-surface)]/95 backdrop-blur-md border-b border-[var(--reg-border)] px-3.5 pt-[env(safe-area-inset-top,0px)] print:hidden">
      <div className="h-[54px] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--reg-accent)] text-white dark:text-slate-950 flex items-center justify-center shrink-0">
            <GraduationCap size={18} />
          </div>
          <div className="min-w-0 leading-tight">
            <TruncatedText
              text="BNFE ট্রেনিং"
              mode="pop"
              className="block text-[14.5px] font-medium text-[var(--reg-text)]"
            />
            <TruncatedText
              text="উপানুষ্ঠানিক শিক্ষা ব্যুরো"
              mode="pop"
              className="block text-[11px] text-[var(--reg-accent)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[var(--reg-accent)]/12 text-[var(--reg-accent)] border border-[var(--reg-accent)]/30 whitespace-nowrap">
            {getRoleLabelBn(role)}
          </span>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={resolvedMode === 'dark' ? 'লাইট থিমে যান' : 'ডার্ক থিমে যান'}
            className="w-9 h-9 rounded-xl bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[var(--reg-text)] flex items-center justify-center cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            {resolvedMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
};
