import React from 'react';
import {
  CalendarCheck,
  Users,
  CalendarDays,
  ChevronRight,
  LayoutTemplate,
  Star,
} from 'lucide-react';
import type { ReportTemplate } from '../../types';
import { toBn } from '../../lib/dateUtils';
import { ReportSectionId } from './types';

interface ReportsHubProps {
  activeSection: ReportSectionId | null;
  activeTemplateId: string | null;
  highlightSelection: boolean;
  totalTrainees: number;
  totalBatches: number;
  totalTrades: number;
  currentMonthLabel: string;
  savedTemplates: ReportTemplate[];
  loadingTemplates: boolean;
  onSelectSection: (id: ReportSectionId) => void;
  onSelectSavedTemplate: (templateId: string) => void;
}

interface HubRowProps {
  id: ReportSectionId;
  icon: React.ReactNode;
  title: string;
  status: string;
  chip?: {
    label: string;
    tone: 'primary' | 'neutral';
  };
  isSelected: boolean;
  onSelect: (id: ReportSectionId) => void;
}

const HubRow: React.FC<HubRowProps> = ({
  id,
  icon,
  title,
  status,
  chip,
  isSelected,
  onSelect,
}) => {
  const chipClasses =
    chip?.tone === 'primary'
      ? 'bg-theme-primary-soft text-theme-primary border-theme-primary/25'
      : 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border';

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={isSelected ? 'page' : undefined}
      className={`w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary ${
        isSelected
          ? 'bg-theme-primary-soft/55'
          : 'bg-theme-surface hover:bg-theme-surface-hover'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${
            isSelected
              ? 'bg-theme-primary text-theme-primary-fg border-theme-primary'
              : 'bg-theme-surface-subtle text-theme-text-secondary border-theme-border'
          }`}
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-theme-text-primary leading-snug break-words">
            {title}
          </div>
          <div className="text-xs text-theme-text-secondary leading-snug break-words mt-0.5 tabular-nums">
            {status}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {chip && (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-snug border whitespace-nowrap ${chipClasses}`}
          >
            {chip.label}
          </span>
        )}
        <ChevronRight
          size={17}
          className={isSelected ? 'text-theme-primary' : 'text-theme-text-muted'}
        />
      </div>
    </button>
  );
};

export const ReportsHub: React.FC<ReportsHubProps> = ({
  activeSection,
  activeTemplateId,
  highlightSelection,
  totalTrainees,
  totalBatches,
  totalTrades,
  currentMonthLabel,
  savedTemplates,
  loadingTemplates,
  onSelectSection,
  onSelectSavedTemplate,
}) => {
  const isRowSelected = (id: ReportSectionId) =>
    highlightSelection &&
    activeSection === id &&
    !(id === 'custom-builder' && Boolean(activeTemplateId));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl sm:text-2xl font-medium text-theme-text-primary leading-snug">
          প্রতিবেদন
        </h1>
        <p className="text-xs sm:text-sm text-theme-text-secondary mt-0.5">
          প্রতিবেদন ও প্রিন্টযোগ্য ফর্ম তালিকা
        </p>
      </header>

      {/* Group 1: প্রতিবেদন */}
      <section aria-labelledby="reports-group-reports" className="space-y-1.5">
        <h2
          id="reports-group-reports"
          className="px-1 text-xs font-medium text-theme-text-secondary"
        >
          প্রতিবেদন
        </h2>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
          <HubRow
            id="monthly-attendance"
            icon={<CalendarCheck size={17} />}
            title="মাসিক হাজিরা রিপোর্ট"
            status={`${currentMonthLabel} · উপস্থিতির পরিসংখ্যান ও হার`}
            isSelected={isRowSelected('monthly-attendance')}
            onSelect={onSelectSection}
          />
          <HubRow
            id="batch-trainees"
            icon={<Users size={17} />}
            title="প্রশিক্ষণার্থীদের তালিকা ব্যাচ ভিত্তিক"
            status={`${toBn(totalBatches)} টি ব্যাচ · ${toBn(totalTrainees)} জন প্রশিক্ষণার্থী`}
            isSelected={isRowSelected('batch-trainees')}
            onSelect={onSelectSection}
          />
        </div>
      </section>

      {/* Group 2: ফর্ম */}
      <section aria-labelledby="reports-group-forms" className="space-y-1.5">
        <h2
          id="reports-group-forms"
          className="px-1 text-xs font-medium text-theme-text-secondary"
        >
          ফর্ম
        </h2>
        <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
          <HubRow
            id="trade-attendance-sheet"
            icon={<CalendarDays size={17} />}
            title="মাসিক হাজিরা সিট (ট্রেড ভিত্তিক)"
            status={`${toBn(totalTrades)} টি ট্রেড · খালি বা হাজিরাসহ প্রিন্ট সিট`}
            chip={{ label: 'ফর্ম', tone: 'primary' }}
            isSelected={isRowSelected('trade-attendance-sheet')}
            onSelect={onSelectSection}
          />
          <HubRow
            id="custom-builder"
            icon={<LayoutTemplate size={17} />}
            title="কাস্টম রিপোর্ট বিল্ডার"
            status="সরকারি প্রস্তাব, কলাম ও স্বাক্ষর সাজিয়ে টেমপ্লেট তৈরি"
            chip={{ label: 'বিল্ডার', tone: 'primary' }}
            isSelected={isRowSelected('custom-builder')}
            onSelect={onSelectSection}
          />
        </div>
      </section>

      {/* Group 3: সংরক্ষিত কাস্টম টেমপ্লেট (পুনর্ব্যবহারযোগ্য) */}
      <section aria-labelledby="reports-group-saved-templates" className="space-y-1.5">
        <div className="px-1 flex items-center justify-between gap-2">
          <h2
            id="reports-group-saved-templates"
            className="text-xs font-medium text-theme-text-secondary"
          >
            সংরক্ষিত কাস্টম টেমপ্লেট
          </h2>
          <span className="text-[11px] font-medium text-theme-text-muted tabular-nums">
            {loadingTemplates ? 'লোড হচ্ছে...' : `${toBn(savedTemplates.length)} টি`}
          </span>
        </div>

        <div className="rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden divide-y divide-theme-border">
          {loadingTemplates ? (
            <div className="px-4 py-3.5 text-xs text-theme-text-secondary">
              সংরক্ষিত টেমপ্লেট লোড হচ্ছে...
            </div>
          ) : savedTemplates.length === 0 ? (
            <button
              type="button"
              onClick={() => onSelectSection('custom-builder')}
              className="w-full min-h-[54px] px-4 py-3 text-left text-xs text-theme-text-secondary hover:bg-theme-surface-hover transition-colors cursor-pointer"
            >
              এখনও কোনো টেমপ্লেট সংরক্ষিত হয়নি। &quot;কাস্টম রিপোর্ট বিল্ডার&quot; থেকে তৈরি করে সেভ করুন।
            </button>
          ) : (
            savedTemplates.map((tpl) => {
              const selected =
                highlightSelection &&
                activeSection === 'custom-builder' &&
                activeTemplateId === tpl.id;
              const orientBn =
                tpl.page?.orientation === 'landscape' ? 'ল্যান্ডস্কেপ' : 'পোর্ট্রেট';
              const srcBn =
                tpl.dataSource === 'attendance-summary'
                  ? 'হাজিরা সারসংক্ষেপ'
                  : 'প্রশিক্ষণার্থী তালিকা';
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onSelectSavedTemplate(tpl.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary ${
                    selected
                      ? 'bg-theme-primary-soft/55'
                      : 'bg-theme-surface hover:bg-theme-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${
                        selected
                          ? 'bg-theme-primary text-theme-primary-fg border-theme-primary'
                          : 'bg-theme-surface-subtle text-theme-primary border-theme-border'
                      }`}
                    >
                      <Star size={16} className={selected ? 'fill-current' : ''} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-theme-text-primary leading-snug break-words">
                        {tpl.name}
                      </div>
                      <div className="text-xs text-theme-text-secondary leading-snug break-words mt-0.5 tabular-nums">
                        {srcBn} · {toBn(tpl.columns?.length || 0)} কলাম · {orientBn}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-snug border whitespace-nowrap bg-theme-surface-subtle text-theme-text-secondary border-theme-border">
                      ব্যবহার করুন
                    </span>
                    <ChevronRight
                      size={17}
                      className={selected ? 'text-theme-primary' : 'text-theme-text-muted'}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
