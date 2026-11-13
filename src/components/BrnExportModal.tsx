import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  Filter, 
  Sparkles,
  ShieldCheck,
  FileDown
} from 'lucide-react';
import { Trainee, Institute, Trade, Batch } from '../types';
import {
  downloadCSV,
  downloadExcel,
  generateBRNReportPDF,
  printBRNReportPDF,
  BRNPrintReportTraineeItem,
  downloadPdfBlob,
  FileExportResult
} from '../lib/exportUtils';
import { toBn, normalizeUBRN, normalizeBirthDate } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useModalViewportPosition } from '../hooks/useModalViewportPosition';

export type ExportScope = 'pending' | 'verified' | 'invalid' | 'all' | 'filtered';
export type ExportFormat = 'excel' | 'csv' | 'pdf';

interface BrnExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTrainees: Trainee[];
  filteredTrainees: Trainee[];
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  initialScope?: ExportScope;
  activeFilterSummary?: string;
}

export const BrnExportModal: React.FC<BrnExportModalProps> = ({
  isOpen,
  onClose,
  allTrainees,
  filteredTrainees,
  institutes,
  trades,
  batches,
  initialScope = 'pending',
  activeFilterSummary
}) => {
  const { userProfile } = useAuth();
  const [selectedScope, setSelectedScope] = useState<ExportScope>(initialScope);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dynamic viewport & modal height calculation hook for mobile & desktop positioning
  const { modalRef, alignmentClasses, backdropClasses } = useModalViewportPosition<HTMLDivElement>(isOpen, {
    marginThreshold: 60,
    mobileBreakpoint: 640
  });

  if (!isOpen) return null;

  const getInstituteName = (instId?: string) => institutes.find(i => i.id === instId)?.name || instId || '—';
  const getTradeName = (tradeId?: string) => trades.find(t => t.id === tradeId)?.name || tradeId || '—';
  const getBatchName = (batchId?: string) => batches.find(b => b.id === batchId)?.name || batchId || '—';

  // Compute counts for scopes
  const pendingTrainees = allTrainees.filter(t => t.is_brn_verified === undefined || t.is_brn_verified === null);
  const verifiedTrainees = allTrainees.filter(t => t.is_brn_verified === true);
  const invalidTrainees = allTrainees.filter(t => t.is_brn_verified === false);

  const getTargetTrainees = (scope: ExportScope): Trainee[] => {
    switch (scope) {
      case 'pending':
        return pendingTrainees;
      case 'verified':
        return verifiedTrainees;
      case 'invalid':
        return invalidTrainees;
      case 'all':
        return allTrainees;
      case 'filtered':
        return filteredTrainees;
      default:
        return allTrainees;
    }
  };

  const targetList = getTargetTrainees(selectedScope);

  const getScopeLabel = (scope: ExportScope): string => {
    switch (scope) {
      case 'pending':
        return 'অপেক্ষমাণ শিক্ষার্থী (Pending Trainees)';
      case 'verified':
        return 'বৈধ ও যাচাইকৃত শিক্ষার্থী (Valid / Verified Trainees)';
      case 'invalid':
        return 'অবৈধ / তথ্যে অমিল শিক্ষার্থী (Invalid Trainees)';
      case 'all':
        return 'সকল শিক্ষার্থী (All Trainees)';
      case 'filtered':
        return 'বর্তমান ফিল্টারকৃত তালিকা (Current Filtered List)';
      default:
        return 'শিক্ষার্থী তালিকা';
    }
  };

  const handleExport = async (formatToUse: ExportFormat = selectedFormat) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportStatus(null);

    try {
      const targetData = getTargetTrainees(selectedScope);
      if (targetData.length === 0) {
        setExportStatus({
          type: 'error',
          message: 'এক্সপোর্ট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।'
        });
        setIsExporting(false);
        return;
      }

      const scopeLabel = getScopeLabel(selectedScope);
      const dateTag = new Date().toISOString().split('T')[0];
      const baseFilename = `BNFE_BRN_${selectedScope.toUpperCase()}_TRAINEES_${dateTag}`;

      // Headers for CSV & Excel
      const headers = [
        'ক্রমিক',
        'প্রশিক্ষণার্থী আইডি',
        'রেজিস্ট্রেশন নম্বর',
        'শিক্ষার্থীর নাম (বাংলা)',
        'শিক্ষার্থীর নাম (ইংরেজি)',
        'জন্ম নিবন্ধন নম্বর (UBRN)',
        '১৭ ডিজিট যাচাই',
        'জন্ম তারিখ',
        'লিঙ্গ',
        'মোবাইল নম্বর',
        'প্রশিক্ষণ কেন্দ্র / প্রতিষ্ঠান',
        'বৃত্তিমূলক ট্রেড',
        'প্রশিক্ষণ ব্যাচ',
        'অনলাইন যাচাই অবস্থা',
        'যাচাই মন্তব্য (Remark)',
        'যাচাইয়ের তারিখ',
        'যাচাইকারী'
      ];

      const rows = targetData.map((t, idx) => {
        const rawUbrn = normalizeUBRN(t.nidOrBirthRegistration);
        const is17 = rawUbrn.length === 17 ? '১৭ ডিজিট সঠিক' : `${rawUbrn.length} ডিজিট (১৭ নয়)`;
        const dob = normalizeBirthDate(t.dateOfBirth);
        const statusStr = t.is_brn_verified === true 
          ? 'Valid (যাচাইকৃত)' 
          : t.is_brn_verified === false 
            ? 'Invalid (অবৈধ)' 
            : 'Pending (অপেক্ষমাণ)';
        const verifiedAtStr = t.brn_verified_at 
          ? new Date(t.brn_verified_at).toLocaleDateString('bn-BD') 
          : '—';

        return [
          idx + 1,
          t.traineeId || '',
          t.registrationNumber || 'অপেক্ষমাণ',
          t.nameBn || '',
          t.nameEn || '',
          rawUbrn || t.nidOrBirthRegistration || 'অনুপস্থিত',
          is17,
          dob || '',
          t.gender === 'Female' ? 'নারী' : 'পুরুষ',
          t.mobileNumber || '',
          getInstituteName(t.instituteId),
          getTradeName(t.tradeId),
          getBatchName(t.batchId),
          statusStr,
          t.brn_remark || '',
          verifiedAtStr,
          t.brn_verified_by || '—'
        ];
      });

      let exportResult: FileExportResult;

      if (formatToUse === 'excel') {
        const colWidths = [8, 16, 18, 24, 24, 22, 16, 14, 10, 16, 26, 20, 18, 20, 28, 16, 18];
        exportResult = await downloadExcel(baseFilename, 'BRN_Verification', headers, rows, colWidths);
      } else if (formatToUse === 'csv') {
        exportResult = await downloadCSV(baseFilename, headers, rows);
      } else {
        const printableItems: BRNPrintReportTraineeItem[] = targetData.map((t, idx) => {
          const rawUbrn = normalizeUBRN(t.nidOrBirthRegistration);
          const is17 = rawUbrn.length === 17 ? '✓ ১৭ ডিজিট সঠিক' : `⚠️ ${toBn(rawUbrn.length)} ডিজিট`;
          const status = t.is_brn_verified === true 
            ? 'Verified' 
            : t.is_brn_verified === false 
              ? 'Invalid' 
              : 'Pending';

          return {
            sl: toBn(idx + 1),
            id: t.traineeId || '',
            regNo: t.registrationNumber || 'অপেক্ষমাণ',
            nameBn: t.nameBn || '',
            nameEn: t.nameEn || '',
            ubrn: rawUbrn || t.nidOrBirthRegistration || 'অনুপস্থিত',
            ubrnValidation: is17,
            dob: normalizeBirthDate(t.dateOfBirth) || '—',
            gender: t.gender === 'Female' ? 'নারী' : 'পুরুষ',
            institute: getInstituteName(t.instituteId),
            batch: getBatchName(t.batchId),
            status,
            remark: t.brn_remark || '—',
            verifiedAt: t.brn_verified_at ? new Date(t.brn_verified_at).toLocaleDateString('bn-BD') : undefined,
            verifiedBy: t.brn_verified_by
          };
        });

        const pdfFilename = `BRN_Report_${selectedScope}_${dateTag}.pdf`;
        const pdfBlob = await generateBRNReportPDF({
          scopeLabel,
          filterDetails: activeFilterSummary,
          generatedBy: userProfile?.name || 'কোর্স পরিচালক',
          stats: {
            total: allTrainees.length,
            verified: verifiedTrainees.length,
            invalid: invalidTrainees.length,
            pending: pendingTrainees.length
          },
          trainees: printableItems
        });

        exportResult = await downloadPdfBlob(pdfBlob, pdfFilename, 'জন্ম নিবন্ধন যাচাই প্রতিবেদন');
      }

      if (exportResult.success) {
        setExportStatus({
          type: 'success',
          message: exportResult.message
        });
        setTimeout(() => {
          setIsExporting(false);
          setExportStatus(null);
          onClose();
        }, 1200);
      } else {
        setExportStatus({
          type: 'error',
          message: exportResult.message || 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
        });
        setIsExporting(false);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      setExportStatus({
        type: 'error',
        message: err?.message || "এক্সপোর্ট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
      });
      setIsExporting(false);
    }
  };

  return (
    <div 
      className={`${backdropClasses} animate-fadeIn`}
      onClick={onClose}
    >
      <div className={alignmentClasses}>
        <div 
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
          className="bg-theme-elevated rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-theme-border space-y-5 sm:space-y-6"
        >
          {/* Header */}
        <div className="flex items-start justify-between border-b border-theme-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold shadow-xs">
              <Download size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-theme-text-primary">
                জন্ম নিবন্ধন ডেটা এক্সপোর্ট (Export BRN Data)
              </h3>
              <p className="text-xs text-theme-text-secondary">
                বৈধ (Valid), অবৈধ (Invalid) ও অপেক্ষমাণ (Pending) শিক্ষার্থীদের তালিকা ডাউনলোড করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text-primary p-1.5 rounded-xl hover:bg-theme-surface-hover transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Select Trainee Category / Scope */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider">
            ১. কোন ক্যাটাগরি এক্সপোর্ট করতে চান? (Select Scope)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Pending */}
            <button
              type="button"
              onClick={() => setSelectedScope('pending')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                selectedScope === 'pending'
                  ? 'border-theme-warning bg-theme-warning-soft ring-2 ring-theme-warning/25'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-theme-warning-soft text-theme-warning border border-theme-warning-border flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <span className="font-bold text-xs text-theme-text-primary block">অপেক্ষমাণ (Pending)</span>
                  <span className="text-[10px] text-theme-warning font-semibold">যাচাই বাকি রয়েছে</span>
                </div>
              </div>
              <span className="font-mono tabular-nums font-bold text-xs bg-theme-surface-subtle px-2 py-0.5 rounded-md border border-theme-border text-theme-warning">
                {toBn(pendingTrainees.length)} জন
              </span>
            </button>

            {/* Valid / Verified */}
            <button
              type="button"
              onClick={() => setSelectedScope('verified')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                selectedScope === 'verified'
                  ? 'border-theme-success bg-theme-success-soft ring-2 ring-theme-success/25'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-theme-success-soft text-theme-success border border-theme-success-border flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <span className="font-bold text-xs text-theme-text-primary block">বৈধ / যাচাইকৃত (Valid)</span>
                  <span className="text-[10px] text-theme-success font-semibold">BDRIS অনলাইন সঠিক</span>
                </div>
              </div>
              <span className="font-mono tabular-nums font-bold text-xs bg-theme-surface-subtle px-2 py-0.5 rounded-md border border-theme-border text-theme-success">
                {toBn(verifiedTrainees.length)} জন
              </span>
            </button>

            {/* Invalid */}
            <button
              type="button"
              onClick={() => setSelectedScope('invalid')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                selectedScope === 'invalid'
                  ? 'border-theme-danger bg-theme-danger-soft ring-2 ring-theme-danger/25'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-theme-danger-soft text-theme-danger border border-theme-danger-border flex items-center justify-center shrink-0">
                  <XCircle size={16} />
                </div>
                <div>
                  <span className="font-bold text-xs text-theme-text-primary block">অবৈধ / অমিল (Invalid)</span>
                  <span className="text-[10px] text-theme-danger font-semibold">বাতিল বা সার্ভারে অমিল</span>
                </div>
              </div>
              <span className="font-mono tabular-nums font-bold text-xs bg-theme-surface-subtle px-2 py-0.5 rounded-md border border-theme-border text-theme-danger">
                {toBn(invalidTrainees.length)} জন
              </span>
            </button>

            {/* All */}
            <button
              type="button"
              onClick={() => setSelectedScope('all')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                selectedScope === 'all'
                  ? 'border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/25'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <span className="font-bold text-xs text-theme-text-primary block">সকল শিক্ষার্থী (All)</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-300 font-semibold">সম্পূর্ণ ডাটাবেজ</span>
                </div>
              </div>
              <span className="font-mono tabular-nums font-bold text-xs bg-theme-surface-subtle px-2 py-0.5 rounded-md border border-theme-border text-purple-600 dark:text-purple-300">
                {toBn(allTrainees.length)} জন
              </span>
            </button>
          </div>

          {/* Current Filtered Option if filters are applied */}
          {filteredTrainees.length !== allTrainees.length && (
            <button
              type="button"
              onClick={() => setSelectedScope('filtered')}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer text-xs ${
                selectedScope === 'filtered'
                  ? 'border-theme-info bg-theme-info-soft ring-2 ring-theme-info/25 text-theme-info font-bold'
                  : 'border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary font-medium'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Filter size={14} className="text-theme-info" />
                <span className="tabular-nums">বর্তমান ফিল্টারকৃত তালিকা ({toBn(filteredTrainees.length)} জন)</span>
              </div>
              <span className="text-[11px] text-theme-text-secondary">{activeFilterSummary || 'নির্দিষ্ট ফিল্টার'}</span>
            </button>
          )}
        </div>

        {/* Step 2: Select Format (Excel, CSV, PDF) */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider">
            ২. এক্সপোর্ট ফরম্যাট নির্বাচন করুন (Select Format)
          </label>

          <div className="grid grid-cols-3 gap-3">
            {/* Excel (.xlsx) */}
            <button
              type="button"
              onClick={() => setSelectedFormat('excel')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center space-y-1.5 transition cursor-pointer ${
                selectedFormat === 'excel'
                  ? 'border-theme-success bg-theme-success-soft ring-2 ring-theme-success/30 text-theme-success font-bold shadow-xs'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                selectedFormat === 'excel' ? 'bg-theme-success text-theme-success-fg' : 'bg-theme-success-soft text-theme-success'
              }`}>
                <FileSpreadsheet size={20} />
              </div>
              <span className="text-xs font-bold block">Excel (.xlsx)</span>
              <span className="text-[10px] text-theme-text-muted block">মাইক্রোসফট স্প্রেডশিট</span>
            </button>

            {/* CSV (.csv) */}
            <button
              type="button"
              onClick={() => setSelectedFormat('csv')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center space-y-1.5 transition cursor-pointer ${
                selectedFormat === 'csv'
                  ? 'border-theme-info bg-theme-info-soft ring-2 ring-theme-info/30 text-theme-info font-bold shadow-xs'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                selectedFormat === 'csv' ? 'bg-theme-info text-theme-info-fg' : 'bg-theme-info-soft text-theme-info'
              }`}>
                <FileText size={20} />
              </div>
              <span className="text-xs font-bold block">CSV (.csv)</span>
              <span className="text-[10px] text-theme-text-muted block">UTF-8 BOM এনকোডেড</span>
            </button>

            {/* PDF (.pdf) */}
            <button
              type="button"
              onClick={() => setSelectedFormat('pdf')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center space-y-1.5 transition cursor-pointer ${
                selectedFormat === 'pdf'
                  ? 'border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/30 text-purple-600 dark:text-purple-300 font-bold shadow-xs'
                  : 'border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                selectedFormat === 'pdf' ? 'bg-purple-600 text-white' : 'bg-purple-500/15 text-purple-600 dark:text-purple-300'
              }`}>
                <Printer size={20} />
              </div>
              <span className="text-xs font-bold block">PDF / Print</span>
              <span className="text-[10px] text-theme-text-muted block">অফিসিয়াল BNFE সিলযুক্ত</span>
            </button>
          </div>
        </div>

        {/* Export Preview Notice */}
        <div className="p-3 bg-theme-surface-subtle rounded-2xl border border-theme-border text-xs flex items-center justify-between text-theme-text-secondary">
          <div>
            <span>নির্বাচিত ক্যাটাগরি: <strong className="text-theme-text-primary">{getScopeLabel(selectedScope)}</strong></span>
            <div className="text-[11px] text-theme-text-muted mt-0.5">১৭ ডিজিটের UBRN, জন্ম তারিখ, প্রতিষ্ঠান ও যাচাই মন্তব্য অন্তর্ভুক্ত থাকবে</div>
          </div>
          <span className="text-sm font-extrabold text-purple-600 dark:text-purple-300 bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-xl shrink-0 tabular-nums">
            {toBn(targetList.length)} জন
          </span>
        </div>

        {/* Inline Export Feedback Banner */}
        {exportStatus && (
          <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center space-x-2 ${
            exportStatus.type === 'success'
              ? 'bg-theme-success-soft border-theme-success-border text-theme-success'
              : 'bg-theme-danger-soft border-theme-danger-border text-theme-danger'
          }`}>
            {exportStatus.type === 'success' ? (
              <CheckCircle2 size={16} className="text-theme-success shrink-0" />
            ) : (
              <XCircle size={16} className="text-theme-danger shrink-0" />
            )}
            <span>{exportStatus.message}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-theme-border gap-3">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-theme-text-secondary hover:bg-theme-surface-hover rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            বাতিল (Cancel)
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={isExporting || targetList.length === 0}
              onClick={() => handleExport(selectedFormat)}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center space-x-2 shadow-sm hover:shadow transition disabled:opacity-40 cursor-pointer active:scale-95 tabular-nums"
            >
              <Download size={15} />
              <span>
                {isExporting 
                  ? 'প্রসেসিং হচ্ছে...' 
                  : selectedFormat === 'pdf' 
                    ? `PDF রিপোর্ট প্রস্তুত (${toBn(targetList.length)} জন)` 
                    : `ডাউনলোড (${toBn(targetList.length)} জন)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default BrnExportModal;
