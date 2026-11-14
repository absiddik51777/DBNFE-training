import React from 'react';
import {
  AlertOctagon,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { THEME_PRESETS } from '../lib/theme';
import { SETTINGS_SECTIONS } from '../components/settings/types';
import { useSettingsRouter } from '../components/settings/useSettingsRouter';
import { useSettingsData } from '../components/settings/useSettingsData';
import { SettingsHub } from '../components/settings/SettingsHub';
import { AppearanceSection } from '../components/settings/sections/AppearanceSection';
import { AccessSection } from '../components/settings/sections/AccessSection';
import { RolesSection } from '../components/settings/sections/RolesSection';
import { RulesSection } from '../components/settings/sections/RulesSection';
import { DataManagementSection } from '../components/settings/sections/DataManagementSection';
import { AuditLogsSection } from '../components/settings/sections/AuditLogsSection';
import { DangerZoneSection } from '../components/settings/sections/DangerZoneSection';

const Settings: React.FC = () => {
  const { userProfile } = useAuth();
  const { isCourseDirector: hasCourseDirectorPerm } = usePermissions();
  const { settings, isDeletionAllowed } = useSystemSettings();
  const { config: themeConfig } = useTheme();

  const isAdmin = userProfile?.role === 'Course Director' || hasCourseDirectorPerm;

  const {
    counts,
    loadingCounts,
    fetchCounts,
    exportingData,
    exportAllSystemData,
    filteredLogs,
    loadingLogs,
    loadingMoreLogs,
    hasMoreLogs,
    moduleFilter,
    setModuleFilter,
    availableLogModules,
    latestLogTimeText,
    fetchLogs,
    loadMoreLogs,
    toast,
    showToast,
    dismissToast,
  } = useSettingsData(isAdmin);

  const handleDenied = React.useCallback(
    (msg: string) => {
      showToast('warning', msg);
    },
    [showToast]
  );

  const { isDesktopSplit, activeSection, openSection, goToHub } =
    useSettingsRouter(isAdmin, handleDenied);

  const activePresetName =
    THEME_PRESETS.find((p) => p.id === themeConfig.presetId)?.name || 'Emerald Slate';
  const modeLabelBn =
    themeConfig.mode === 'system'
      ? 'সিস্টেম'
      : themeConfig.mode === 'dark'
      ? 'ডার্ক'
      : 'লাইট';
  const appearanceSummary = `${activePresetName} · ${modeLabelBn}`;

  const activeMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection) || null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'appearance':
        return <AppearanceSection showToast={showToast} />;
      case 'access':
        return <AccessSection isAdmin={isAdmin} showToast={showToast} />;
      case 'roles':
        return <RolesSection />;
      case 'rules':
        return <RulesSection showToast={showToast} />;
      case 'data':
        return (
          <DataManagementSection
            counts={counts}
            loadingCounts={loadingCounts}
            exportingData={exportingData}
            onRefreshCounts={fetchCounts}
            onExportAll={exportAllSystemData}
          />
        );
      case 'logs':
        return (
          <AuditLogsSection
            isAdmin={isAdmin}
            actor={
              userProfile
                ? {
                    userId: userProfile.id || '',
                    user: userProfile.name || 'User',
                    userRole: userProfile.role || '',
                  }
                : undefined
            }
            logs={filteredLogs}
            loadingLogs={loadingLogs}
            loadingMoreLogs={loadingMoreLogs}
            hasMoreLogs={hasMoreLogs}
            moduleFilter={moduleFilter}
            availableModules={availableLogModules}
            onChangeModuleFilter={setModuleFilter}
            onRefreshLogs={fetchLogs}
            onLoadMore={loadMoreLogs}
            onActionSuccess={async (msg) => {
              await Promise.all([fetchLogs(), fetchCounts()]);
              showToast('success', msg);
            }}
            onNavigateToData={() => openSection('data')}
          />
        );
      case 'danger':
        return (
          <DangerZoneSection
            isAdmin={isAdmin}
            counts={counts}
            onRefreshCounts={fetchCounts}
            onRefreshLogs={fetchLogs}
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-[1040px] mx-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50"
        >
          <div
            className={`rounded-[14px] border px-4 py-3 flex items-start justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-theme-elevated border-theme-danger-border text-theme-danger'
                : toast.type === 'warning'
                ? 'bg-theme-elevated border-theme-warning-border text-theme-warning'
                : 'bg-theme-elevated border-theme-success-border text-theme-success'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {toast.type === 'error' ? (
                <AlertOctagon size={17} className="shrink-0 mt-0.5" />
              ) : toast.type === 'warning' ? (
                <AlertTriangle size={17} className="shrink-0 mt-0.5" />
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
        {/* Left Hub Pane: hidden on <800px when a sub-page is open */}
        {(isDesktopSplit || !activeSection) && (
          <nav
            aria-label="সেটিংস বিভাগসমূহ"
            className="w-full min-[800px]:w-[340px] min-[800px]:shrink-0 min-[800px]:sticky min-[800px]:top-4"
          >
            <SettingsHub
              activeSection={activeSection}
              highlightSelection={isDesktopSplit}
              isAdmin={isAdmin}
              appearanceSummary={appearanceSummary}
              isPublicRegistrationOpen={settings.allowPublicRegistration !== false}
              minAttendancePercent={settings.minAttendancePercentForCert ?? 75}
              passMarkPercent={settings.passMarkPercent ?? 40}
              latestLogTimeText={latestLogTimeText}
              isDeletionAllowed={isDeletionAllowed}
              onSelectSection={openSection}
            />
          </nav>
        )}

        {/* Right Detail Pane */}
        {(isDesktopSplit || activeSection) && activeMeta && (
          <section
            aria-label={activeMeta.title}
            className="w-full max-w-[640px] min-w-0 flex-1 space-y-4"
          >
            {/* Mobile Back Header + Section Heading */}
            <header className="flex items-center gap-2.5">
              {!isDesktopSplit && (
                <button
                  type="button"
                  onClick={goToHub}
                  aria-label="সেটিংস তালিকায় ফিরে যান"
                  className="min-h-[44px] px-2.5 -ml-2 rounded-[12px] inline-flex items-center gap-1.5 text-sm font-semibold text-theme-primary hover:bg-theme-surface-hover transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
                >
                  <ArrowLeft size={18} />
                  <span>সেটিংস</span>
                </button>
              )}

              <div className={!isDesktopSplit ? 'ml-auto text-right' : ''}>
                <h1
                  className={`font-bold text-theme-text-primary tracking-tight ${
                    isDesktopSplit ? 'text-xl' : 'text-base'
                  }`}
                >
                  {activeMeta.title}
                </h1>
              </div>
            </header>

            {renderSectionContent()}
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;
