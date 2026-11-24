import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type {
  Batch,
  Institute,
  Trade,
  Trainee,
  UserProfile,
} from '../../../types';
import { downloadCSV, printCurrentDocument } from '../../../lib/exportUtils';
import { formatBengaliDate, safeFormatDate, toBn } from '../../../lib/dateUtils';
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

export const BatchTraineesReport: React.FC<BatchTraineesReportProps> = ({
  userProfile,
  institutes,
  trades,
  batches,
  trainees,
  canExport,
  onNotify,
}) => {
  const isTrainer = userProfile?.role === 'Trainer';

  const [filterInstitute, setFilterInstitute] = useState<string>(() =>
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : ''
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() =>
    isTrainer && userProfile?.batchId ? userProfile.batchId : ''
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const effectiveInstitute =
    isTrainer && userProfile?.instituteId ? userProfile.instituteId : filterInstitute;

  const availableBatches = useMemo(() => {
    const filtered = batches.filter((b) => {
      if (b.isArchived) return false;
      if (isTrainer && userProfile?.batchId) return b.id === userProfile.batchId;
      if (effectiveInstitute && b.instituteId !== effectiveInstitute) return false;
      return true;
    });
    return filtered;
  }, [batches, isTrainer, userProfile?.batchId, effectiveInstitute]);

  // Default to the first batch so a clear batch-wise directory shows right away
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
    if (exporting || !selectedBatch) return;
    setExporting(true);
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
      setExporting(false);
    }
  };

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* Filter & Export Controls */}
      <div className="rounded-[14px] border border-theme-border bg-theme-surface p-4 space-y-4 print:hidden">
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
                className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm disabled:opacity-70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
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
              className="w-full min-h-[44px] px-3 bg-theme-surface-subtle text-theme-text-primary border border-theme-border rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary cursor-pointer"
            >
              <option value="all">সকল ({toBn(counts.total)})</option>
              <option value="Active">সক্রিয় ({toBn(counts.active)})</option>
              <option value="Completed">সম্পন্ন ({toBn(counts.completed)})</option>
              <option value="Dropped Out">ঝরে পড়া ({toBn(counts.dropped)})</option>
            </select>
          </div>
        </div>

        {canExport && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-theme-border">
            <button
              type="button"
              disabled={exporting || !selectedBatch}
              onClick={handleExportCSV}
              className="min-h-[44px] px-4 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <Download size={16} />
              <span>{exporting ? 'সংরক্ষণ হচ্ছে...' : 'CSV এক্সপোর্ট'}</span>
            </button>
            <button
              type="button"
              disabled={!selectedBatch}
              onClick={() =>
                printCurrentDocument({
                  jobName: `BNFE_Batch_Trainees_${selectedBatch?.name || 'List'}`,
                  landscape: true,
                })
              }
              className="min-h-[44px] px-4 rounded-xl border border-theme-border-strong bg-theme-elevated hover:bg-theme-surface-hover text-theme-text-primary text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-primary"
            >
              <Printer size={16} />
              <span>প্রিন্ট করুন</span>
            </button>
          </div>
        )}
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

      {/* Official Printable Sheet */}
      <div className="bg-theme-surface text-theme-text-primary p-5 sm:p-8 rounded-[14px] border border-theme-border print:bg-white print:text-slate-900 print:border-none print:p-0">
        <div className="text-center border-b-2 border-theme-border-strong print:border-slate-800 pb-4 mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-theme-text-primary print:text-slate-900">
            গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
          </h2>
          <h3 className="text-base sm:text-lg font-semibold text-theme-text-primary print:text-slate-800 mt-0.5">
            উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
          </h3>
          <p className="text-xs text-theme-text-secondary print:text-slate-600 mt-0.5">
            ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ কর্মসূচি
          </p>
          <div className="mt-3 inline-block px-4 py-1 bg-theme-surface-subtle print:bg-slate-100 rounded-md font-semibold text-sm text-theme-text-primary print:text-slate-900">
            ব্যাচ ভিত্তিক প্রশিক্ষণার্থীদের তালিকা
          </div>
          {selectedBatch && (
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-theme-text-secondary print:text-slate-600">
              <span>
                প্রতিষ্ঠান:{' '}
                <strong className="text-theme-text-primary print:text-slate-900">
                  {getInstituteName(selectedBatch.instituteId)}
                </strong>
              </span>
              <span>
                ট্রেড:{' '}
                <strong className="text-theme-text-primary print:text-slate-900">
                  {getTradeName(selectedBatch.tradeId)}
                </strong>
              </span>
              <span>
                ব্যাচ:{' '}
                <strong className="text-theme-text-primary print:text-slate-900">
                  {selectedBatch.name}
                </strong>
              </span>
              <span className="tabular-nums">তারিখ: {formatBengaliDate(todayIso)}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-theme-border-strong print:border-slate-400 text-xs">
            <thead className="bg-theme-surface-subtle print:bg-slate-100 text-theme-text-primary print:text-slate-900">
              <tr>
                <th className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2.5 text-center w-12">
                  ক্রঃ
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left">
                  রেজিঃ নম্বর
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left min-w-[160px]">
                  প্রশিক্ষণার্থীর নাম
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left min-w-[150px]">
                  পিতা ও মাতা
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-center whitespace-nowrap">
                  জন্ম তারিখ ও লিঙ্গ
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-left">
                  জন্ম নিবন্ধন / NID
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-center">
                  মোবাইল
                </th>
                <th className="border border-theme-border-strong print:border-slate-400 px-3 py-2.5 text-center">
                  স্ট্যাটাস
                </th>
              </tr>
            </thead>
            <tbody>
              {batchTrainees.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="border border-theme-border-strong print:border-slate-400 py-8 text-center text-theme-text-muted print:text-slate-500"
                  >
                    এই ব্যাচে কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                batchTrainees.map((t, idx) => (
                  <tr
                    key={t.id}
                    className="hover:bg-theme-surface-hover print:hover:bg-transparent"
                  >
                    <td className="border border-theme-border-strong print:border-slate-400 px-2.5 py-2 text-center tabular-nums">
                      {toBn(idx + 1)}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 font-mono font-semibold tabular-nums whitespace-nowrap">
                      {t.registrationNumber || t.traineeId || '—'}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2">
                      <div className="font-medium text-theme-text-primary print:text-slate-900">
                        {t.nameBn || '—'}
                      </div>
                      {t.nameEn && (
                        <div className="text-[11px] text-theme-text-secondary print:text-slate-500">
                          {t.nameEn}
                        </div>
                      )}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2">
                      <div>পিতা: {t.fatherNameBn || t.fatherNameEn || '—'}</div>
                      <div className="text-theme-text-secondary print:text-slate-600">
                        মাতা: {t.motherNameBn || t.motherNameEn || '—'}
                      </div>
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 text-center tabular-nums whitespace-nowrap">
                      <div>{t.dateOfBirth || '—'}</div>
                      <div className="text-[11px] text-theme-text-secondary print:text-slate-600">
                        {getGenderLabelBn(t.gender)}
                      </div>
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                      {t.nidOrBirthRegistration || '—'}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 text-center font-mono tabular-nums whitespace-nowrap">
                      {t.mobileNumber || '—'}
                    </td>
                    <td className="border border-theme-border-strong print:border-slate-400 px-3 py-2 text-center font-medium whitespace-nowrap">
                      {getTraineeStatusLabelBn(t.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Official Print Signatures */}
        <div className="grid grid-cols-3 gap-6 pt-14 text-center text-xs mt-6">
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              প্রশিক্ষক
            </div>
          </div>
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              প্রতিষ্ঠান প্রধান
            </div>
          </div>
          <div>
            <div className="border-t border-theme-border-strong print:border-slate-500 pt-1.5 font-medium text-theme-text-secondary print:text-slate-700">
              কোর্স পরিচালক
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
