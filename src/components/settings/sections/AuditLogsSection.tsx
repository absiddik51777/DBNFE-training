import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { ActivityLog } from '../../../types';
import type { AuditActor } from '../../../lib/auditLog';
import { AuditLogList } from '../../audit/AuditLogList';

interface AuditLogsSectionProps {
  isAdmin: boolean;
  actor?: AuditActor;
  logs: ActivityLog[];
  loadingLogs: boolean;
  loadingMoreLogs: boolean;
  hasMoreLogs: boolean;
  moduleFilter: string;
  availableModules: string[];
  onChangeModuleFilter: (module: string) => void;
  onRefreshLogs: () => Promise<void>;
  onLoadMore: () => Promise<void>;
  onActionSuccess?: (message: string) => Promise<void> | void;
  onNavigateToData?: () => void;
}

export const AuditLogsSection: React.FC<AuditLogsSectionProps> = ({
  isAdmin,
  actor,
  logs,
  loadingLogs,
  loadingMoreLogs,
  hasMoreLogs,
  moduleFilter,
  availableModules,
  onChangeModuleFilter,
  onRefreshLogs,
  onLoadMore,
  onActionSuccess,
  onNavigateToData,
}) => {
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
      moduleFilter={moduleFilter}
      availableModules={availableModules}
      isAdmin={isAdmin}
      actor={actor}
      onChangeModuleFilter={onChangeModuleFilter}
      onRefreshLogs={onRefreshLogs}
      onLoadMore={onLoadMore}
      onActionSuccess={onActionSuccess}
      onNavigateToData={onNavigateToData}
    />
  );
};

