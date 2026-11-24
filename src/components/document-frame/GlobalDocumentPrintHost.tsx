import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import type { DocumentPrintConfig } from '../../types';
import {
  normalizeDocumentPrintConfig,
  readLocalDocPrintConfig,
  subscribeGlobalPrint,
  writeLocalDocPrintConfig,
  type GlobalPrintRequest,
} from '../../lib/documentFrameService';
import { DocumentPrintFrame } from './DocumentPrintFrame';

export const GlobalDocumentPrintHost: React.FC = () => {
  const { userProfile } = useAuth();
  const { isCourseDirector } = usePermissions();
  const { settings, updateSettings } = useSystemSettings();
  const canPersistGlobal =
    userProfile?.role === 'Course Director' || isCourseDirector;

  const [activeReq, setActiveReq] = useState<GlobalPrintRequest | null>(null);
  const [sessionConfig, setSessionConfig] = useState<DocumentPrintConfig>(() =>
    normalizeDocumentPrintConfig(settings.documentPrintConfig, 'portrait')
  );
  const [toastMsg, setToastMsg] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    return subscribeGlobalPrint((req) => {
      const localSaved = readLocalDocPrintConfig('global', userProfile?.id);
      const merged = normalizeDocumentPrintConfig(
        {
          ...(settings.documentPrintConfig || {}),
          ...(localSaved || {}),
          // Always respect the document's natural orientation when opening
          orientation: req.defaultOrientation,
        },
        req.defaultOrientation
      );
      setSessionConfig(merged);
      setToastMsg(null);
      setActiveReq(req);
    });
  }, [settings.documentPrintConfig, userProfile?.id]);

  useEffect(() => {
    if (!activeReq) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only close if settings modal isn't open above it (settings modal stops propagation/handles own escape)
        const settingsDialog = document.getElementById('doc-frame-settings-title');
        if (!settingsDialog) {
          setActiveReq(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeReq]);

  if (!activeReq) return null;

  const handleConfigChange = async (nextConfig: DocumentPrintConfig) => {
    setSessionConfig(nextConfig);
    writeLocalDocPrintConfig('global', userProfile?.id, nextConfig);
    if (canPersistGlobal) {
      try {
        await updateSettings({ documentPrintConfig: nextConfig });
      } catch (err) {
        console.warn('Could not persist global documentPrintConfig:', err);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeReq.title}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 md:p-6 print:static print:inset-auto print:bg-white print:p-0 print:block"
    >
      <div className="w-full max-w-6xl h-[92vh] flex flex-col rounded-[16px] shadow-2xl overflow-hidden print:h-auto print:max-w-none print:shadow-none print:rounded-none print:overflow-visible">
        <DocumentPrintFrame
          documentTitle={activeReq.title}
          fileNamePrefix={activeReq.jobName}
          config={sessionConfig}
          defaultOrientation={activeReq.defaultOrientation}
          onConfigChange={handleConfigChange}
          extractedHeaderHtml={activeReq.extracted.headerHtml}
          extractedTableSpec={activeReq.extracted.tableSpec}
          extractedFooterHtml={activeReq.extracted.footerHtml}
          extractedBlocksHtml={activeReq.extracted.fallbackBlocksHtml}
          customScopeCss={activeReq.extracted.stylesCss}
          lightReset={activeReq.extracted.lightReset}
          measureKey={activeReq.id}
          workspaceMaxHeightClass="flex-1 min-h-0"
          onNotify={(toast) => {
            setToastMsg(toast);
            window.setTimeout(() => setToastMsg(null), 4000);
          }}
          toolbarRightExtra={
            <button
              type="button"
              onClick={() => setActiveReq(null)}
              aria-label="প্রিন্ট প্রিভিউ বন্ধ করুন"
              title="বন্ধ করুন"
              className="w-9 h-9 rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-secondary hover:text-theme-text-primary inline-flex items-center justify-center transition cursor-pointer"
            >
              <X size={17} />
            </button>
          }
        />

        {toastMsg && (
          <div
            role="status"
            className={`px-4 py-2 text-xs font-medium border-t border-theme-border print:hidden ${
              toastMsg.type === 'error'
                ? 'bg-theme-danger-soft text-theme-danger'
                : 'bg-theme-success-soft text-theme-success'
            }`}
          >
            {toastMsg.message}
          </div>
        )}
      </div>
    </div>
  );
};
