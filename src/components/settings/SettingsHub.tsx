import React from 'react';
import {
  Palette,
  UserCheck,
  Shield,
  SlidersHorizontal,
  Database,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { SettingsSectionId } from './types';

interface SettingsHubProps {
  activeSection: SettingsSectionId | null;
  highlightSelection: boolean;
  isAdmin: boolean;
  appearanceSummary: string;
  isPublicRegistrationOpen: boolean;
  minAttendancePercent: number;
  passMarkPercent: number;
  latestLogTimeText: string;
  isDeletionAllowed: boolean;
  onSelectSection: (id: SettingsSectionId) => void;
}

interface HubRowProps {
  id: SettingsSectionId;
  icon: React.ReactNode;
  title: string;
  status: string;
  chip?: {
    label: string;
    tone: 'green' | 'red' | 'amber' | 'neutral';
  };
  isSelected: boolean;
  dangerRow?: boolean;
  onSelect: (id: SettingsSectionId) => void;
}

const HubRow: React.FC<HubRowProps> = ({
  id,
  icon,
  title,
  status,
  chip,
  isSelected,
  dangerRow = false,
  onSelect,
}) => {
  const chipClasses =
    chip?.tone === 'green'
      ? 'bg-theme-success-soft text-theme-success border-theme-success-border'
      : chip?.tone === 'red'
      ? 'bg-theme-danger-soft text-theme-danger border-theme-danger-border'
      : chip?.tone === 'amber'
      ? 'bg-theme-warning-soft text-theme-warning border-theme-warning-border'
      : 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border';

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={isSelected ? 'page' : undefined}
      className={`w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary ${
        dangerRow
          ? isSelected
            ? 'bg-theme-danger-soft'
            : 'bg-theme-danger-soft/55 hover:bg-theme-danger-soft'
          : isSelected
          ? 'bg-theme-primary-soft/55'
          : 'bg-theme-surface hover:bg-theme-surface-hover'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${
            dangerRow
              ? 'bg-theme-surface text-theme-danger border-theme-danger-border'
              : isSelected
              ? 'bg-theme-primary text-theme-primary-fg border-theme-primary'
              : 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border'
          }`}
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-theme-text-primary truncate">
            {title}
          </div>
          <div className="text-xs text-theme-text-secondary truncate mt-0.5 tabular-nums">
            {status}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {chip && (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${chipClasses}`}
          >
            {chip.label}
          </span>
        )}
        <ChevronRight
          size={17}
          className={
            dangerRow
              ? 'text-theme-danger'
              : isSelected
              ? 'text-theme-primary'
              : 'text-theme-text-muted'
          }
        />
      </div>
    </button>
  );
};

export const SettingsHub: React.FC<SettingsHubProps> = ({
  activeSection,
  highlightSelection,
  isAdmin,
  appearanceSummary,
  isPublicRegistrationOpen,
  minAttendancePercent,
  passMarkPercent,
  latestLogTimeText,
  isDeletionAllowed,
  onSelectSection,
}) => {
  const isRowSelected = (id: SettingsSectionId) =>
    highlightSelection && activeSection === id;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-theme-text-primary tracking-tight">
          সেটিংস
        </h1>
        <p className="text-xs sm:text-sm text-theme-text-secondary mt-0.5">
          সিস্টেম নিয়ন্ত্রণ ও কনফিগারেশন
        </p>
      </header>

      {/* Group 1: সাধারণ */}
      <section aria-labelledby="settings-group-general" className="space-y-1.5">
        <h2
          id="settings-group-general"
          className="px-1 text-xs font-semibold text-theme-text-secondary"
        >
          সাধারণ
        </h2>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
          <HubRow
            id="appearance"
            icon={<Palette size={17} />}
            title="থিম ও অ্যাপিয়ারেন্স"
            status={appearanceSummary}
            isSelected={isRowSelected('appearance')}
            onSelect={onSelectSection}
          />
          <HubRow
            id="access"
            icon={<UserCheck size={17} />}
            title="নিবন্ধন ও অ্যাক্সেস"
            status="পাবলিক নিবন্ধন"
            chip={{
              label: isPublicRegistrationOpen ? 'চালু' : 'বন্ধ',
              tone: isPublicRegistrationOpen ? 'green' : 'red',
            }}
            isSelected={isRowSelected('access')}
            onSelect={onSelectSection}
          />
          <HubRow
            id="roles"
            icon={<Shield size={17} />}
            title="রোল ও পারমিশন"
            status="কে কী করতে পারবে"
            isSelected={isRowSelected('roles')}
            onSelect={onSelectSection}
          />
          <HubRow
            id="rules"
            icon={<SlidersHorizontal size={17} />}
            title="নিয়ম ও মানদণ্ড"
            status={`উপস্থিতি ${minAttendancePercent}% · পাস ${passMarkPercent}%`}
            isSelected={isRowSelected('rules')}
            onSelect={onSelectSection}
          />
        </div>
      </section>

      {/* Group 2: ডাটা ও নিরীক্ষা */}
      <section aria-labelledby="settings-group-data" className="space-y-1.5">
        <h2
          id="settings-group-data"
          className="px-1 text-xs font-semibold text-theme-text-secondary"
        >
          ডাটা ও নিরীক্ষা
        </h2>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
          <HubRow
            id="data"
            icon={<Database size={17} />}
            title="ডাটা ব্যবস্থাপনা"
            status="ডাটাবেস সারাংশ ও এক্সপোর্ট"
            isSelected={isRowSelected('data')}
            onSelect={onSelectSection}
          />
          <HubRow
            id="logs"
            icon={<Clock size={17} />}
            title="অডিট লগ"
            status={`সর্বশেষ: ${latestLogTimeText}`}
            isSelected={isRowSelected('logs')}
            onSelect={onSelectSection}
          />
        </div>
      </section>

      {/* Group 3: ঝুঁকিপূর্ণ (Course Director / Admin only) */}
      {isAdmin && (
        <section aria-labelledby="settings-group-risk" className="space-y-1.5">
          <h2
            id="settings-group-risk"
            className="px-1 text-xs font-semibold text-theme-danger"
          >
            ঝুঁকিপূর্ণ
          </h2>
          <div className="rounded-[14px] border border-theme-danger-border bg-theme-surface overflow-hidden">
            <HubRow
              id="danger"
              icon={<AlertTriangle size={17} />}
              title="ডেঞ্জার জোন"
              status="ডিলিট ও ফ্যাক্টরি রিসেট"
              chip={{
                label: isDeletionAllowed ? 'আনলকড' : 'লক করা',
                tone: isDeletionAllowed ? 'amber' : 'neutral',
              }}
              isSelected={isRowSelected('danger')}
              dangerRow
              onSelect={onSelectSection}
            />
          </div>
        </section>
      )}
    </div>
  );
};
