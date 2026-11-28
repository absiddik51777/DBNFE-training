import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type {
  Batch,
  DocumentPrintConfig,
  Institute,
  Trade,
  Trainee,
  UserProfile,
  WeeklySignatureHeading,
} from '../../../types';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { downloadCSV } from '../../../lib/exportUtils';
import { formatBengaliDate, safeFormatDate, toBn } from '../../../lib/dateUtils';
import {
  mergeHeadingWithDefault,
  normalizeDocumentPrintConfig,
  readLocalDocHeading,
  readLocalDocPrintConfig,
  writeLocalDocHeading,
  writeLocalDocPrintConfig,
} from '../../../lib/documentFrameService';
import { DocumentPrintFrame } from '../../document-frame/DocumentPrintFrame';
import { ReportHeaderBanner } from '../ReportHeaderBanner';
import { DEFAULT_SHEET_PAGE_CONFIG } from '../../weekly-signature/utils';
import {
  getGenderLabelBn,
  getTraineeStatusLabelBn,
  ReportsToast,
} from '../types';

interface BatchTraineesReportProps {
  userProfile: UserProfile | null;
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  trainees: Trainee[];
  canExport: boolean;
  onNotify: (toast: ReportsToast) => void;
}

const DEFAULT_BATCH_REPORT_HEADING: WeeklySignatureHeading = {
  govtTitle: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  officeTitle: 'জেলা উপানুষ্ঠানিক শিক্ষা ব্যুরো',
  officeAddress: 'কালেক্টরেট ভবন, ময়মনসিংহ',
  programTitle:
    "উপানুষ্ঠানিক শিক্ষা ব্যুরো'র বিশেষ কার্যক্রম কার্যকর সাক্ষরতা ও ব্যবহারিক কর্মদক্ষতা প্রশিক্ষণ প্রাক বৃত্তিমূলক পর্যায়",
  sheetTitle: 'ব্যাচ ভিত্তিক প্রশিক্ষণার্থীদের তালিকা',
};

export const BatchTraineesReport: React.FC<BatchTraineesReportProps> = ({
  userProfile,
  institutes,
  trades,
  batches,
  trainees,
  canExport,
  onNotify,
}) => {
  const { isCourseDirector } = usePermissions();
  const { settings, updateSettings } = useSystemSettings();
  const isTrainer = userProfile?.role === 'Trainer';
  const canPersistGlobal =
    userProfile?.role === 'Course Director' || isCourseDirector;

  const [filterInstitute, setFilterInstitute] = useState<string>(() =>
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : ''
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() =>
    isTrainer && userProfile?.batchId ? userProfile.batchId : ''
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exportingCsv, setExportingCsv] = useState(false);

  const [localConfigOverride, setLocalConfigOverride] =
    useState<Partial<DocumentPrintConfig> | null>(() =>
      readLocalDocPrintConfig('batch_trainees', userProfile?.id)
    );
  const [localHeadingOverride, setLocalHeadingOverride] =
    useState<Partial<WeeklySignatureHeading> | null>(() =>
      readLocalDocHeading('batch_trainees', userProfile?.id)
    );

  const activeConfig = useMemo<DocumentPrintConfig>(
    () =>
      normalizeDocumentPrintConfig(
        {
          ...(settings.documentPrintConfig || {}),
          ...(localConfigOverride || {}),
          margins: {
            ...(settings.documentPrintConfig?.margins || {}),
            ...(localConfigOverride?.margins || {}),
          },
        } as Partial<DocumentPrintConfig>,
        'landscape'
      ),
    [settings.documentPrintConfig, localConfigOverride]
  );

  const activeHeading = useMemo<WeeklySignatureHeading>(
    () =>
      mergeHeadingWithDefault(
        DEFAULT_BATCH_REPORT_HEADING,
        settings.weeklySignatureHeading,
        localHeadingOverride
      ),
    [settings.weeklySignatureHeading, localHeadingOverride]
  );

  const handleConfigChange = async (nextConfig: DocumentPrintConfig) => {
    setLocalConfigOverride(nextConfig);
    writeLocalDocPrintConfig('batch_trainees', userProfile?.id, nextConfig);
    if (canPersistGlobal) {
      try {
        await updateSettings({ documentPrintConfig: nextConfig });
      } catch (err) {
        console.warn('Could not save documentPrintConfig globally:', err);
      }
    }
  };

  const handleHeadingChange = async (nextHeading: WeeklySignatureHeading) => {
    setLocalHeadingOverride(nextHeading);
    writeLocalDocHeading('batch_trainees', userProfile?.id, nextHeading);
    if (canPersistGlobal) {
      try {
        await updateSettings({
          weeklySignatureHeading: {
            ...(settings.weeklySignatureHeading || DEFAULT_BATCH_REPORT_HEADING),
            govtTitle: nextHeading.govtTitle,
            officeTitle: nextHeading.officeTitle,
            officeAddress: nextHeading.officeAddress,
            programTitle: nextHeading.programTitle,
            sheetTitle:
              settings.weeklySignatureHeading?.sheetTitle ||
              'প্রশিক্ষণার্থী হাজিরা সিট',
            leftLogoUrl: nextHeading.leftLogoUrl || '',
            rightLogoUrl: nextHeading.rightLogoUrl || '',
            logoSizePx: nextHeading.logoSizePx,
          },
        });
      } catch (err) {
        console.warn('Could not save heading globally:', err);
      }
    }
  };

  const effectiveInstitute =
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : filterInstitute;

  const availableBatches = useMemo(() => {
    return batches.filter((b) => {
      if (b.isArchived) return false;
      if (isTrainer && userProfile?.batchId) return b.id === userProfile.batchId;
      if (effectiveInstitute && b.instituteId !== effectiveInstitute) return false;
      return true;
    });
  }, [batches, isTrainer, userProfile?.batchId, effectiveInstitute]);

  useEffect(() => {
    if (isTrainer && userProfile?.batchId) {
      setSelectedBatchId(userProfile.batchId);
      return;
    }
    if (!selectedBatchId && availableBatches.length > 0) {
      setSelectedBatchId(availableBatches[0].id);
    } else if (
      selectedBatchId &&
      availableBatches.length > 0 &&
      !availableBatches.some((b) => b.id === selectedBatchId)
    ) {
      setSelectedBatchId(availableBatches[0].id);
    }
  }, [availableBatches, selectedBatchId, isTrainer, userProfile?.batchId]);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const getInstituteName = (id?: string) =>
    institutes.find((i) => i.id === id)?.name || '—';
  const getTradeName = (id?: string) =>
    trades.find((t) => t.id === id)?.name || '—';

  const batchTrainees = useMemo(() => {
    if (!selectedBatchId) return [];
    return trainees
      .filter((t) => {
        if (t.batchId !== selectedBatchId) return false;
        if (t.status === 'Archived') return false;
        if (statusFilter !== 'all' && (t.status || 'Active') !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.registrationNumber || a.traineeId || a.id).localeCompare(
          b.registrationNumber || b.traineeId || b.id,
          undefined,
          { numeric: true }
        )
      );
  }, [trainees, selectedBatchId, statusFilter]);

  const counts = useMemo(() => {
    const allInBatch = trainees.filter(
      (t) => t.batchId === selectedBatchId && t.status !== 'Archived'
    );
    return {
      total: allInBatch.length,
      active: allInBatch.filter((t) => !t.status || t.status === 'Active').length,
      completed: allInBatch.filter((t) => t.status === 'Completed').length,
      dropped: allInBatch.filter((t) => t.status === 'Dropped Out').length,
    };
  }, [trainees, selectedBatchId]);

  const handleExportCSV = async () => {
    if (exportingCsv || !selectedBatch) return;
    setExportingCsv(true);
    try {
      const headers = [
        'ক্রঃ',
        'রেজিঃ নম্বর',
        'নাম (বাংলা)',
        'নাম (ইংরেজি)',
        'পিতার নাম',
        'মাতার নাম',
        'জন্ম তারিখ',
        'লিঙ্গ',
        'জন্ম নিবন্ধন / এনআইডি',
        'মোবাইল নম্বর',
        'ঠিকানা',
        'ব্যাচ',
        'ট্রেড',
        'প্রতিষ্ঠান',
        'স্ট্যাটাস',
      ];

      const csvRows = batchTrainees.map((t, idx) => [
        idx + 1,
        t.registrationNumber || t.traineeId || '',
        t.nameBn || '',
        t.nameEn || '',
        t.fatherNameBn || t.fatherNameEn || '',
        t.motherNameBn || t.motherNameEn || '',
        t.dateOfBirth || '',
        getGenderLabelBn(t.gender),
        t.nidOrBirthRegistration || '',
        t.mobileNumber || '',
        t.presentAddress || t.address || '',
        selectedBatch.name,
        getTradeName(selectedBatch.tradeId),
        getInstituteName(selectedBatch.instituteId),
        getTraineeStatusLabelBn(t.status),
      ]);

      const safeBatchCode = (selectedBatch.batchCode || selectedBatch.name || 'batch')
        .replace(/[^\w\u0980-\u09FF-]+/g, '_');

      const res = await downloadCSV(
        `bnfe_batch_trainees_${safeBatchCode}`,
        headers,
        csvRows
      );
      onNotify({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। আবার চেষ্টা করুন।';
      onNotify({ type: 'error', message });
    } finally {
      setExportingCsv(false);
    }
  };

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!isTrainer && (
            <div>
              <label
                htmlFor="batch-rep-inst"
                className="block text-xs font-medium text-theme-text-secondary mb-1.5"
              >
                প্রতিষ্ঠান
              </label>
              <select
                id="batch-rep-inst"
                value={effectiveInstitute}
                onChange={(e) => {
                  setFilterInstitute(e.target.value);
                  setSelectedBatchId('');
                }}
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer"
              >
                <option value="">সকল প্রতিষ্ঠান</option>
                {institutes.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="batch-rep-batch"
              className="block text-xs font-medium text-theme-text-secondary mb-1.5"
            >
              ব্যাচ নির্বাচন
            </label>
            <select
              id="batch-rep-batch"
              value={selectedBatchId}
              disabled={isTrainer && Boolean(userProfile?.batchId)}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 cursor-pointer"
            >
              {availableBatches.length === 0 ? (
                <option value="">কোনো ব্যাচ নেই</option>
              ) : (
                availableBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {getTradeName(b.tradeId)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="batch-rep-status"
              className="block text-xs font-medium text-theme-text-secondary mb-1.5"
            >
              স্ট্যাটাস ফিল্টার
            </label>
            <select
              id="batch-rep-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm cursor-pointer"
            >
              <option value="all">সকল ({toBn(counts.total)})</option>
              <option value="Active">সক্রিয় ({toBn(counts.active)})</option>
              <option value="Completed">সম্পন্ন ({toBn(counts.completed)})</option>
              <option value="Dropped Out">ঝরে পড়া ({toBn(counts.dropped)})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Summary Cards */}
      {selectedBatch && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
            <div className="text-xs text-theme-text-secondary">নির্বাচিত ব্যাচ</div>
            <div className="text-sm sm:text-base font-semibold text-theme-text-primary mt-1 truncate">
              {selectedBatch.name}
            </div>
          </div>
          <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
            <div className="text-xs text-theme-text-secondary">ট্রেড</div>
            <div className="text-sm sm:text-base font-semibold text-theme-primary mt-1 truncate">
              {getTradeName(selectedBatch.tradeId)}
            </div>
          </div>
          <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
            <div className="text-xs text-theme-text-secondary">তালিকাভুক্ত প্রশিক্ষণার্থী</div>
            <div className="text-xl font-semibold text-theme-text-primary mt-1 tabular-nums">
              {toBn(batchTrainees.length)} জন
            </div>
          </div>
          <div className="rounded-[14px] border border-theme-border bg-theme-surface p-3.5">
            <div className="text-xs text-theme-text-secondary">সময়কাল</div>
            <div className="text-xs sm:text-sm font-medium text-theme-text-primary mt-1.5 tabular-nums">
              {safeFormatDate(selectedBatch.startDate, 'dd/MM/yyyy')} –{' '}
              {safeFormatDate(selectedBatch.endDate, 'dd/MM/yyyy')}
            </div>
          </div>
        </div>
      )}

      {/* MS-Word-Style Paginated Document Frame */}
      <DocumentPrintFrame
        documentTitle={`ব্যাচ ভিত্তিক প্রশিক্ষণার্থীদের তালিকা${
          selectedBatch ? ` — ${selectedBatch.name}` : ''
        }`}
        fileNamePrefix={`BNFE_Batch_Trainees_${selectedBatch?.name || 'List'}`}
        config={activeConfig}
        defaultOrientation="landscape"
        onConfigChange={handleConfigChange}
        heading={activeHeading}
        defaultHeading={DEFAULT_BATCH_REPORT_HEADING}
        onHeadingChange={handleHeadingChange}
        supportsSignatures
        supportsGeneratedDate
        canExport={canExport && Boolean(selectedBatch)}
        rowCount={batchTrainees.length}
        measureKey={`${selectedBatchId}|${statusFilter}|${batchTrainees.length}|${activeHeading.leftLogoUrl || ''}|${activeHeading.rightLogoUrl || ''}|${activeHeading.logoSizePx || ''}|${activeHeading.programTitle}`}
        onNotify={onNotify}
        extraDownloadItems={
          canExport && selectedBatch
            ? [
                {
                  id: 'csv',
                  label: exportingCsv ? 'CSV তৈরি হচ্ছে...' : 'CSV স্প্রেডশিট (.csv)',
                  subtitle: 'Excel-এ খোলার উপযোগী',
                  icon: <FileSpreadsheet size={16} />,
                  disabled: exportingCsv,
                  onClick: handleExportCSV,
                },
              ]
            : []
        }
        renderHeader={({ config, px }) => (
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-3.5 text-black">
            <ReportHeaderBanner
              leftLogoUrl={activeHeading.leftLogoUrl}
              rightLogoUrl={activeHeading.rightLogoUrl}
              logoSizePx={activeHeading.logoSizePx}
              scale={config.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt}
            >
              {activeHeading.govtTitle.trim() && (
                <p style={{ fontSize: px(10.5) }} className="leading-[1.35]">
                  {activeHeading.govtTitle.trim()}
                </p>
              )}
              {activeHeading.officeTitle.trim() && (
                <h2
                  style={{ fontSize: px(15) }}
                  className="font-bold leading-[1.35] mt-0.5"
                >
                  {activeHeading.officeTitle.trim()}
                </h2>
              )}
              {activeHeading.officeAddress.trim() && (
                <p style={{ fontSize: px(11.5) }} className="font-medium leading-[1.35]">
                  {activeHeading.officeAddress.trim()}
                </p>
              )}
              {activeHeading.programTitle.trim() && (
                <p
                  style={{ fontSize: px(11) }}
                  className="font-semibold leading-[1.35] max-w-[92%] mx-auto mt-1"
                >
                  {activeHeading.programTitle.trim()}
                </p>
              )}
            </ReportHeaderBanner>
            <div className="mt-2 inline-block px-3.5 py-1 bg-slate-100 border border-slate-300 rounded font-bold leading-[1.3]">
              <span style={{ fontSize: px(12.5) }}>
                {activeHeading.sheetTitle.trim() || 'ব্যাচ ভিত্তিক প্রশিক্ষণার্থীদের তালিকা'}
              </span>
            </div>
            {selectedBatch && (
              <div
                style={{ fontSize: px(10.5) }}
                className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-slate-700"
              >
                <span>
                  প্রতিষ্ঠান:{' '}
                  <strong className="text-black">
                    {getInstituteName(selectedBatch.instituteId)}
                  </strong>
                </span>
                <span>
                  ট্রেড:{' '}
                  <strong className="text-black">
                    {getTradeName(selectedBatch.tradeId)}
                  </strong>
                </span>
                <span>
                  ব্যাচ: <strong className="text-black">{selectedBatch.name}</strong>
                </span>
                {config.showGeneratedDate && (
                  <span className="tabular-nums">
                    তারিখ: <strong className="text-black">{formatBengaliDate(todayIso)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        renderTable={({ rowIndices, px }) => (
          <table
            style={{ fontSize: px(10) }}
            className="w-full table-fixed border-collapse border border-slate-700 text-black"
          >
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead className="bg-slate-100 text-black">
              <tr>
                <th className="border border-slate-700 px-1 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  ক্রঃ
                </th>
                <th className="border border-slate-700 px-1.5 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  রেজিঃ নম্বর
                </th>
                <th className="border border-slate-700 px-2 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  প্রশিক্ষণার্থীর নাম
                </th>
                <th className="border border-slate-700 px-2 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  পিতা ও মাতা
                </th>
                <th className="border border-slate-700 px-1.5 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  জন্ম তারিখ ও লিঙ্গ
                </th>
                <th className="border border-slate-700 px-1.5 pt-1.5 pb-2 text-left align-middle leading-[1.25]">
                  জন্ম নিবন্ধন / NID
                </th>
                <th className="border border-slate-700 px-1.5 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  মোবাইল
                </th>
                <th className="border border-slate-700 px-1.5 pt-1.5 pb-2 text-center align-middle leading-[1.25]">
                  স্ট্যাটাস
                </th>
              </tr>
            </thead>
            <tbody>
              {batchTrainees.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="border border-slate-700 py-8 text-center align-middle text-slate-600"
                  >
                    এই ব্যাচে কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                rowIndices.map((idx) => {
                  const t = batchTrainees[idx];
                  if (!t) return null;
                  return (
                    <tr key={t.id}>
                      <td className="border border-slate-700 px-1 pt-[4px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                        {toBn(idx + 1)}
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[4px] pb-[6px] font-mono font-semibold align-middle leading-[1.25] tabular-nums break-all">
                        {t.registrationNumber || t.traineeId || '—'}
                      </td>
                      <td className="border border-slate-700 px-2 pt-[4px] pb-[6px] align-middle">
                        <div className="font-medium text-black leading-[1.25] break-words">
                          {t.nameBn || '—'}
                        </div>
                        {t.nameEn && (
                          <div
                            style={{ fontSize: px(8.8) }}
                            className="text-slate-600 leading-[1.2] break-words"
                          >
                            {t.nameEn}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-700 px-2 pt-[4px] pb-[6px] align-middle">
                        <div className="leading-[1.25] break-words">
                          পিতা: {t.fatherNameBn || t.fatherNameEn || '—'}
                        </div>
                        <div className="text-slate-600 leading-[1.25] break-words">
                          মাতা: {t.motherNameBn || t.motherNameEn || '—'}
                        </div>
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[4px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                        <div>{t.dateOfBirth || '—'}</div>
                        <div
                          style={{ fontSize: px(8.8) }}
                          className="text-slate-600"
                        >
                          {getGenderLabelBn(t.gender)}
                        </div>
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[4px] pb-[6px] font-mono align-middle leading-[1.25] tabular-nums break-all">
                        {t.nidOrBirthRegistration || '—'}
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[4px] pb-[6px] text-center font-mono align-middle leading-[1.25] tabular-nums break-all">
                        {t.mobileNumber || '—'}
                      </td>
                      <td className="border border-slate-700 px-1.5 pt-[4px] pb-[6px] text-center font-medium align-middle leading-[1.25]">
                        {getTraineeStatusLabelBn(t.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
        renderFooter={({ config, px }) =>
          config.showSignatures ? (
            <div
              style={{ fontSize: px(10.5) }}
              className="grid grid-cols-3 gap-6 pt-12 text-center mt-4 text-black"
            >
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  প্রশিক্ষক
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  প্রতিষ্ঠান প্রধান
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-medium">
                  কোর্স পরিচালক
                </div>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
};
