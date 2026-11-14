import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AuditActor } from '../../../lib/auditLog';
import { useAuditFilters } from '../../../hooks/useAuditFilters';
import { AuditLogList } from '../../audit/AuditLogList';

interface AuditLogsSectionProps {
  isAdmin: boolean;
  actor?: AuditActor;
  onActionSuccess?: (message: string) => Promise<void> | void;
  onNavigateToData?: () => void;
}

export const AuditLogsSection: React.FC<AuditLogsSectionProps> = ({
  isAdmin,
  actor,
  onActionSuccess,
  onNavigateToData,
}) => {
  const {
    appliedFilters,
    searchInput,
    handleSearchChange,
    setModuleFilter,
    clearAllFilters,
    sheetOpen,
    openSheet,
    closeSheet,
    draftFilters,
    setDraftFilters,
    resetDraft,
    applyDraft,
    customRangeError,
    pendingCount,
    pendingCountCapped,
    loadingPendingCount,
    logs,
    loadingLogs,
    loadingMoreLogs,
    hasMoreLogs,
    logsError,
    refreshLogs,
    loadMoreLogs,
    availableUsers,
    activeSheetFilterCount,
    activeSheetSummaryText,
    hasAnyActiveFilter,
  } = useAuditFilters(isAdmin);

  if (!isAdmin) {
    return (
      <div className="rounded-[14px] border border-theme-danger-border bg-theme-surface p-6 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-theme-danger-soft text-theme-danger border border-theme-danger-border flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-base font-bold text-theme-text-primary">
          প্রবেশাধিকার সংরক্ষিত
        </h2>
        <p className="text-xs text-theme-text-secondary">
          অডিট লগ শুধুমাত্র অ্যাডমিন (Course Director) দেখতে পারবেন।
        </p>
      </div>
    );
  }

  return (
    <AuditLogList
      logs={logs}
      loadingLogs={loadingLogs}
      loadingMoreLogs={loadingMoreLogs}
      hasMoreLogs={hasMoreLogs}
      logsError={logsError}
      searchInput={searchInput}
      selectedModule={appliedFilters.module}
      activeSheetFilterCount={activeSheetFilterCount}
      activeSheetSummaryText={activeSheetSummaryText}
      hasAnyActiveFilter={hasAnyActiveFilter}
      sheetOpen={sheetOpen}
      draftFilters={draftFilters}
      availableUsers={availableUsers}
      customRangeError={customRangeError}
      pendingCount={pendingCount}
      pendingCountCapped={pendingCountCapped}
      loadingPendingCount={loadingPendingCount}
      isAdmin={isAdmin}
      actor={actor}
      onSearchChange={handleSearchChange}
      onSelectModule={setModuleFilter}
      onOpenSheet={openSheet}
      onCloseSheet={closeSheet}
      onChangeDraft={setDraftFilters}
      onResetDraft={resetDraft}
      onApplyDraft={applyDraft}
      onClearAllFilters={clearAllFilters}
      onRefreshLogs={refreshLogs}
      onLoadMore={loadMoreLogs}
      onActionSuccess={async (msg) => {
        await refreshLogs();
        if (onActionSuccess) {
          await onActionSuccess(msg);
        }
      }}
      onNavigateToData={onNavigateToData}
    />
  );
};
