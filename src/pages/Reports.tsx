import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertOctagon, X } from 'lucide-react';
import type {
  AttendanceRecord,
  Batch,
  Institute,
  ReportTemplate,
  Trade,
  Trainee,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { dataService } from '../lib/dataService';
import { toBn } from '../lib/dateUtils';
import { MONTH_NAMES_BN, REPORT_SECTIONS, ReportsToast } from '../components/reports/types';
import { useReportsRouter } from '../components/reports/useReportsRouter';
import { ReportsHub } from '../components/reports/ReportsHub';
import { MonthlyAttendanceReport } from '../components/reports/sections/MonthlyAttendanceReport';
import { BatchTraineesReport } from '../components/reports/sections/BatchTraineesReport';
import { TradeAttendanceSheetForm } from '../components/reports/sections/TradeAttendanceSheetForm';
import { CustomReportBuilder } from '../components/reports/custom-builder/CustomReportBuilder';

const Reports: React.FC = () => {
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const canExport =
    hasPermission('export_reports') || hasPermission('export_attendance_sheet');

  const {
    isDesktopSplit,
    activeSection,
    activeTemplateId,
    openSection,
    setTemplateQuery,
    goToHub,
  } = useReportsRouter();

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<ReportsToast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((next: ReportsToast) => {
    setToast(next);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    if (next.type === 'success') {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 4500);
    }
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [instList, tradesList, batchesList, traineesList, attList] =
          await Promise.all([
            dataService.getItems<Institute>('institutes'),
            dataService.getItems<Trade>('trades'),
            dataService.getItems<Batch>('batches'),
            dataService.getItems<Trainee>('trainees'),
            dataService.getItems<AttendanceRecord>('attendance'),
          ]);

        if (!active) return;
        setInstitutes(instList);
        setTrades(tradesList);
        setBatches(batchesList);
        setTrainees(traineesList);
        setAttendance(attList);
      } catch (err) {
        console.warn('Failed to fetch reports data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = dataService.subscribeCollection<ReportTemplate>(
      'report_templates',
      (items) => {
        if (!active) return;
        const sorted = [...items].sort(
          (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        );
        setSavedTemplates(sorted);
        setLoadingTemplates(false);
      },
      (err) => {
        if (!active) return;
        console.warn('Failed to subscribe report_templates:', err);
        setLoadingTemplates(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const hubCounts = useMemo(() => {
    const isTrainer = userProfile?.role === 'Trainer';
    const visibleBatches = batches.filter((b) => {
      if (b.isArchived) return false;
      if (isTrainer && userProfile?.batchId) return b.id === userProfile.batchId;
      if (isTrainer && userProfile?.instituteId) {
        return b.instituteId === userProfile.instituteId;
      }
      return true;
    });

    const visibleTrainees = trainees.filter((t) => {
      if (t.status === 'Archived') return false;
      if (isTrainer && userProfile?.batchId) return t.batchId === userProfile.batchId;
      if (isTrainer && userProfile?.instituteId) {
        return t.instituteId === userProfile.instituteId;
      }
      return true;
    });

    const visibleTrades = trades.filter((tr) => !tr.isArchived);

    return {
      batchesCount: visibleBatches.length,
      traineesCount: visibleTrainees.length,
      tradesCount: visibleTrades.length,
    };
  }, [batches, trainees, trades, userProfile]);

  const currentMonthLabel = useMemo(() => {
    const now = new Date();
    return `${MONTH_NAMES_BN[now.getMonth()] || ''} ${toBn(now.getFullYear())}`;
  }, []);

  const activeMeta = REPORT_SECTIONS.find((s) => s.id === activeSection) || null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'monthly-attendance':
        return (
          <MonthlyAttendanceReport
            userProfile={userProfile}
            institutes={institutes}
            trades={trades}
            batches={batches}
            trainees={trainees}
            attendance={attendance}
            canExport={canExport}
            onNotify={showToast}
          />
        );
      case 'batch-trainees':
        return (
          <BatchTraineesReport
            userProfile={userProfile}
            institutes={institutes}
            trades={trades}
            batches={batches}
            trainees={trainees}
            canExport={canExport}
            onNotify={showToast}
          />
        );
      case 'trade-attendance-sheet':
        return (
          <TradeAttendanceSheetForm
            userProfile={userProfile}
            institutes={institutes}
            trades={trades}
            batches={batches}
            trainees={trainees}
            attendance={attendance}
            canExport={canExport}
            onNotify={showToast}
          />
        );
      case 'custom-builder':
        return (
          <CustomReportBuilder
            userProfile={userProfile}
            institutes={institutes}
            trades={trades}
            batches={batches}
            trainees={trainees}
            attendance={attendance}
            canExport={canExport}
            externalTemplates={savedTemplates}
            loadingExternalTemplates={loadingTemplates}
            requestedTemplateId={activeTemplateId}
            onSyncTemplateId={setTemplateQuery}
            onNotify={showToast}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-col min-[800px]:flex-row min-[800px]:items-start gap-6">
          <div className="w-full min-[800px]:w-[340px] min-[800px]:shrink-0 space-y-4">
            <div className="h-12 w-40 rounded-xl bg-theme-surface border border-theme-border animate-pulse" />
            <div className="h-32 rounded-[14px] bg-theme-surface border border-theme-border animate-pulse" />
            <div className="h-20 rounded-[14px] bg-theme-surface border border-theme-border animate-pulse" />
          </div>
          <div className="hidden min-[800px]:block flex-1 min-w-0 space-y-4">
            <div className="h-8 w-56 rounded-xl bg-theme-surface border border-theme-border animate-pulse" />
            <div className="h-32 rounded-[14px] bg-theme-surface border border-theme-border animate-pulse" />
            <div className="h-72 rounded-[14px] bg-theme-surface border border-theme-border animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="font-sans fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 print:hidden"
        >
          <div
            className={`rounded-[14px] border px-4 py-3 flex items-start justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-theme-elevated border-theme-danger-border text-theme-danger'
                : 'bg-theme-elevated border-theme-success-border text-theme-success'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {toast.type === 'error' ? (
                <AlertOctagon size={17} className="shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
              )}
              <span className="text-xs sm:text-sm font-medium text-theme-text-primary leading-snug">
                {toast.message}
              </span>
            </div>

            <button
              type="button"
              onClick={dismissToast}
              aria-label="বিজ্ঞপ্তি বন্ধ করুন"
              className="min-h-[32px] min-w-[32px] -mr-1 -mt-0.5 inline-flex items-center justify-center rounded-lg text-theme-text-muted hover:text-theme-text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Responsive Split (<800px hub/subpage drilldown, >=800px two-pane) */}
      <div className="flex flex-col min-[800px]:flex-row min-[800px]:items-start gap-6">
        {/* Left Hub Pane */}
        {(isDesktopSplit || !activeSection) && (
          <nav
            aria-label="প্রতিবেদন ও ফর্ম তালিকা"
            className="w-full min-[800px]:w-[340px] min-[800px]:shrink-0 min-[800px]:sticky min-[800px]:top-4 print:hidden"
          >
            <ReportsHub
              activeSection={activeSection}
              activeTemplateId={activeTemplateId}
              highlightSelection={isDesktopSplit}
              totalTrainees={hubCounts.traineesCount}
              totalBatches={hubCounts.batchesCount}
              totalTrades={hubCounts.tradesCount}
              currentMonthLabel={currentMonthLabel}
              savedTemplates={savedTemplates}
              loadingTemplates={loadingTemplates}
              onSelectSection={(id) => openSection(id)}
              onSelectSavedTemplate={(tplId) => openSection('custom-builder', tplId)}
            />
          </nav>
        )}

        {/* Right Detail Workspace Pane */}
        {(isDesktopSplit || activeSection) && activeMeta && (
          <section
            aria-label={activeMeta.title}
            className="w-full min-w-0 flex-1 space-y-4"
          >
            <header className="flex items-center gap-2.5 print:hidden">
              {!isDesktopSplit && (
                <button
                  type="button"
                  onClick={goToHub}
                  aria-label="প্রতিবেদন তালিকায় ফিরে যান"
                  className="min-h-[44px] px-2.5 -ml-2 rounded-[12px] inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <ArrowLeft size={18} />
                  <span>প্রতিবেদন</span>
                </button>
              )}

              <div className={!isDesktopSplit ? 'ml-auto text-right min-w-0' : 'min-w-0'}>
                <h1
                  className={`font-medium text-theme-text-primary leading-snug ${
                    isDesktopSplit ? 'text-xl' : 'text-base'
                  }`}
                >
                  {activeMeta.title}
                </h1>
                {isDesktopSplit && (
                  <p className="text-xs sm:text-sm text-theme-text-secondary mt-0.5">
                    {activeMeta.subtitle}
                  </p>
                )}
              </div>
            </header>

            {renderSectionContent()}
          </section>
        )}
      </div>
    </div>
  );
};

export default Reports;
