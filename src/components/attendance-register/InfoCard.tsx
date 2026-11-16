import React from 'react';
import { Check, X, Umbrella, MoreVertical } from 'lucide-react';
import { TruncatedText } from '../ui/TruncatedText';

interface InfoCardProps {
  tradeName: string;
  instituteName: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  children?: React.ReactNode;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  tradeName,
  instituteName,
  menuOpen,
  onToggleMenu,
  menuButtonRef,
  children,
}) => {
  return (
    <section className="relative rounded-[14px] bg-[var(--reg-surface)] border border-[var(--reg-border)] py-[10px] px-[12px] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <TruncatedText
          as="p"
          text={`${tradeName || 'ট্রেড'} · ${instituteName || 'প্রতিষ্ঠান'}`}
          mode="pop"
          className="text-[14px] text-[var(--reg-text)] leading-snug min-w-0 flex-1"
        >
          <strong className="font-semibold">{tradeName || 'ট্রেড'}</strong>
          <span className="mx-1.5 text-[var(--reg-muted)]" aria-hidden="true">
            ·
          </span>
          <span className="text-[var(--reg-muted)]">{instituteName || 'প্রতিষ্ঠান'}</span>
        </TruncatedText>

        <div className="relative shrink-0 print:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onToggleMenu}
            aria-label="রেজিস্টার অপশন মেনু"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="w-[34px] h-[34px] rounded-full bg-[var(--reg-surface2)] border border-[var(--reg-border)] text-[var(--reg-text)] hover:border-[var(--reg-accent)] flex items-center justify-center cursor-pointer active:scale-95 transition focus-visible:outline-2 focus-visible:outline-[var(--reg-accent)]"
          >
            <MoreVertical size={17} />
          </button>
          {children}
        </div>
      </div>

      {/* Icon Legend */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--reg-border)]/80 text-[12px]">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--reg-green)]/10 text-[var(--reg-green)] border border-[var(--reg-green)]/25">
          <Check size={13} strokeWidth={2.5} aria-hidden="true" />
          <span>উপস্থিত</span>
        </span>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--reg-red)]/10 text-[var(--reg-red)] border border-[var(--reg-red)]/25">
          <X size={13} strokeWidth={2.5} aria-hidden="true" />
          <span>অনুপস্থিত</span>
        </span>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--reg-amber)]/10 text-[var(--reg-amber)] border border-[var(--reg-amber)]/25">
          <Umbrella size={13} strokeWidth={2.2} aria-hidden="true" />
          <span>ছুটি</span>
        </span>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--reg-surface2)] text-[var(--reg-muted)] border border-[var(--reg-border)]">
          <span className="font-mono leading-none" aria-hidden="true">
            -
          </span>
          <span>তথ্য নেই</span>
        </span>
      </div>
    </section>
  );
};
