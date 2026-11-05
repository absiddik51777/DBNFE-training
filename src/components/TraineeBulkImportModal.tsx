import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Layers, 
  Users, 
  ArrowRight, 
  Check, 
  HelpCircle,
  FileCheck,
  AlertCircle,
  LayoutGrid,
  List,
  Phone,
  Calendar,
  MapPin,
  GraduationCap
} from 'lucide-react';
import { Trainee, Batch, Institute, Trade } from '../types';
import { dataService } from '../lib/dataService';
import { logActivity } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toBn, toEnDigits } from '../lib/dateUtils';

interface TraineeBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
  batches: Batch[];
  institutes: Institute[];
  trades: Trade[];
  existingTrainees: Trainee[];
}

interface ParsedTraineeRow {
  rowNumber: number;
  traineeId: string;
  registrationNumber: string;
  nameBn: string;
  nameEn: string;
  fatherNameBn: string;
  fatherNameEn: string;
  motherNameBn: string;
  motherNameEn: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  nidOrBirthRegistration: string;
  mobileNumber: string;
  permanentAddress: string;
  presentAddress: string;
  sameAsPermanentAddress: boolean;
  batchIdentifier: string;
  resolvedBatchId: string;
  resolvedBatchName: string;
  resolvedTradeId: string;
  resolvedInstituteId: string;
  lastClassCompleted: string;
  previousSchoolName: string;
  yearOfDropout: string;
  reasonForDropout: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportSummaryData {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  successfulRows: ParsedTraineeRow[];
  failedRows: ParsedTraineeRow[];
  timestamp: number;
}

export const TraineeBulkImportModal: React.FC<TraineeBulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  batches,
  institutes,
  trades,
  existingTrainees,
}) => {
  const { userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [defaultBatchId, setDefaultBatchId] = useState<string>(batches[0]?.id || '');
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedTraineeRow[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); // Grid view is primary
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Post-import summary modal state
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);
  const [summaryFilterTab, setSummaryFilterTab] = useState<'all' | 'success' | 'failed'>('all');

  // Reset when dialog is closed
  React.useEffect(() => {
    if (!isOpen) {
      setImportSummary(null);
      setSelectedFile(null);
      setParsedRows([]);
      setErrorMessage('');
      setFilterTab('all');
      setSummaryFilterTab('all');
    }
  }, [isOpen]);

  // Active batches map for quick lookup (supporting Bengali numerals and clean keys)
  const batchLookup = useMemo(() => {
    const map = new Map<string, Batch>();
    batches.forEach(b => {
      if (b.id) {
        map.set(b.id.toLowerCase(), b);
        map.set(toEnDigits(b.id).toLowerCase(), b);
      }
      if (b.batchCode) {
        map.set(b.batchCode.toLowerCase(), b);
        map.set(toEnDigits(b.batchCode).toLowerCase(), b);
        map.set(b.batchCode.replace(/[\s-_]/g, '').toLowerCase(), b);
      }
      if (b.name) {
        map.set(b.name.toLowerCase(), b);
        map.set(toEnDigits(b.name).toLowerCase(), b);
        map.set(b.name.replace(/[\s-_]/g, '').toLowerCase(), b);
      }
    });
    return map;
  }, [batches]);

  // Download Sample Template (Excel or CSV)
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const defaultBatch = batches.find(b => b.id === defaultBatchId) || batches[0];
    const sampleBatchCode = defaultBatch?.batchCode || defaultBatch?.name || 'BATCH-01';

    const headers = [
      'প্রশিক্ষণার্থী আইডি (Trainee ID)',
      'রেজিস্ট্রেশন নম্বর (Registration No)',
      'পূর্ণ নাম বাংলা (Name Bn)',
      'পূর্ণ নাম ইংরেজি (Name En)',
      'পিতার নাম (Father Name)',
      'মাতার নাম (Mother Name)',
      'জন্ম তারিখ (YYYY-MM-DD)',
      'লিঙ্গ (Male/Female/Other)',
      'এনআইডি বা জন্ম নিবন্ধন',
      'মোবাইল নম্বর (11 Digits)',
      'স্থায়ী ঠিকানা (Permanent Address)',
      'বর্তমান ঠিকানা (Present Address)',
      'ব্যাচ কোড বা নাম (Batch)',
      'সর্বশেষ পাসকৃত শ্রেণি (Last Class)',
      'পূর্ববর্তী স্কুল (Previous School)',
      'ড্রপআউটের বছর (Dropout Year)',
      'ড্রপআউটের কারণ (Dropout Reason)'
    ];

    const sampleRow1 = [
      'TR-1001',
      'REG-2026-001',
      'রাকিব হাসান',
      'Rakib Hasan',
      'মোঃ রফিকুল ইসলাম',
      'মোসাঃ রহিমা বেগম',
      '2008-03-15',
      'Male',
      '20081234567890123',
      '01711223344',
      'গ্রাম: চরকালীবাড়ি, ডাকঘর: হালুয়াঘাট, ময়মনসিংহ',
      'গ্রাম: চরকালীবাড়ি, ডাকঘর: হালুয়াঘাট, ময়মনসিংহ',
      sampleBatchCode,
      'Class 7 (৭ম শ্রেণি)',
      'হালুয়াঘাট আদর্শ উচ্চ বিদ্যালয়',
      '2023',
      'আর্থিক অসচ্ছলতা ও পারিবারিক সমস্যা'
    ];

    const sampleRow2 = [
      '', // Auto-generated ID
      '', // Optional registration
      'ফাতেমা আক্তার',
      'Fatema Akter',
      'আব্দুল জলিল',
      'আমেনা খাতুন',
      '2008-07-20',
      'Female',
      '20089876543210987',
      '01922334455',
      'পৌরসভা রোড, হালুয়াঘাট, ময়মনসিংহ',
      '', // Will copy permanent address
      sampleBatchCode,
      'Class 8 (৮ম শ্রেণি)',
      'নকলা বালিকা উচ্চ বিদ্যালয়',
      '2023',
      'পারিবারিক অসচ্ছলতা'
    ];

    if (format === 'csv') {
      const csvString = '\uFEFF' + [
        headers.join(','),
        sampleRow1.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','),
        sampleRow2.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
      ].join('\n');

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BNFE_Trainee_Bulk_Import_Template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const worksheetData = [headers, sampleRow1, sampleRow2];
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
        { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
        { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 30 },
        { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 25 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Trainees_Template');
      XLSX.writeFile(wb, `BNFE_Trainee_Bulk_Import_Template.xlsx`);
    }
  };

  // Helper to extract sequential number for auto ID generation
  const nextAutoIdBase = useMemo(() => {
    const existingNums = existingTrainees
      .map(t => {
        const m = t.traineeId?.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      })
      .filter(n => !isNaN(n) && n > 0);
    const max = existingNums.length > 0 ? Math.max(...existingNums) : 1000;
    return max >= 1000 ? max + 1 : 1001;
  }, [existingTrainees]);

  // Parse and validate rows from file
  const processUploadedFile = async (file: File) => {
    setSelectedFile(file);
    setParsing(true);
    setErrorMessage('');
    setParsedRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const fileNameLower = file.name.toLowerCase();
      const isCsvOrText = fileNameLower.endsWith('.csv') || 
                          fileNameLower.endsWith('.tsv') || 
                          fileNameLower.endsWith('.txt') ||
                          file.type.includes('csv') || 
                          file.type.includes('text');

      let workbook: XLSX.WorkBook;

      if (isCsvOrText) {
        let text = '';
        // Detect UTF-16 LE BOM (0xFF, 0xFE) - common in Excel Unicode CSV export
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
          text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
        }
        // Detect UTF-16 BE BOM (0xFE, 0xFF)
        else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
          text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
        }
        // Detect UTF-8 BOM (0xEF, 0xBB, 0xBF)
        else if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
          text = new TextDecoder('utf-8').decode(bytes.subarray(3));
        }
        // Standard UTF-8
        else {
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          } catch {
            text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
          }
        }

        // Clean leading BOM or invisible artifacts
        text = text.replace(/^[\uFEFF\u00EF\u00BB\u00BF]+/, '');

        // Pass decoded Unicode string directly to SheetJS
        workbook = XLSX.read(text, { type: 'string', raw: true });
      } else {
        // Binary Excel (.xlsx, .xls)
        workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
      }

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setErrorMessage('ফাইলের মধ্যে কোনো শিট (Sheet) পাওয়া যায়নি।');
        setParsing(false);
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (rawData.length === 0) {
        setErrorMessage('ফাইলে কোনো তথ্য পাওয়া যায়নি (খালি স্প্রেডশিট)।');
        setParsing(false);
        return;
      }

      // Helper to clean invisible characters and trim
      const cleanString = (val: any): string => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .trim();
      };

      // Helper to parse date formats
      const normalizeDate = (val: any): { date: string; warning?: string } => {
        const raw = cleanString(val);
        if (!raw) {
          return { date: '2008-01-01', warning: 'জন্ম তারিখ উল্লেখ না থাকায় আনুমানিক ২০০৮-০১-০১ ধরা হয়েছে।' };
        }
        const clean = toEnDigits(raw);

        // Check Excel serial (e.g. 39522)
        if (/^\d{4,5}$/.test(clean)) {
          const serial = parseInt(clean, 10);
          const utcDays = serial - 25569;
          const dateObj = new Date(utcDays * 86400 * 1000);
          if (!isNaN(dateObj.getTime())) {
            return { date: dateObj.toISOString().split('T')[0] };
          }
        }

        // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
        const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (ymdMatch) {
          const [, y, m, d] = ymdMatch;
          return { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` };
        }

        // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
        const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (dmyMatch) {
          const [, d, m, y] = dmyMatch;
          return { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` };
        }

        return { date: clean, warning: undefined };
      };

      // Keyword indicators to locate the actual header row (in case row 1 is a title or empty)
      const headerKeywords = [
        'নাম', 'name', 'student', 'শিক্ষার্থী', 'ছাত্র', 'প্রশিক্ষণার্থী',
        'মোবাইল', 'phone', 'mobile', 'যোগাযোগ', 'ফোন',
        'আইডি', 'id', 'trainee', 'রোল', 'roll',
        'ব্যাচ', 'batch',
        'রেজিস্ট্রেশন', 'reg',
        'পিতা', 'father', 'মাতা', 'mother',
        'জন্ম', 'birth', 'dob',
        'ঠিকানা', 'address', 'স্থায়ী', 'বর্তমান',
        'লিঙ্গ', 'gender', 'sex',
        'এনআইডি', 'nid'
      ];

      let bestHeaderRowIdx = 0;
      let maxKeywordMatches = 0;

      const scanLimit = Math.min(10, rawData.length);
      for (let r = 0; r < scanLimit; r++) {
        const rowCells = rawData[r];
        if (!Array.isArray(rowCells) || rowCells.length === 0) continue;

        let matchCount = 0;
        for (const cell of rowCells) {
          const str = cleanString(cell).toLowerCase();
          if (str && headerKeywords.some(kw => str.includes(kw))) {
            matchCount++;
          }
        }

        if (matchCount > maxKeywordMatches) {
          maxKeywordMatches = matchCount;
          bestHeaderRowIdx = r;
        }
      }

      const headerRow = (rawData[bestHeaderRowIdx] || []).map(h => cleanString(h).toLowerCase());
      const dataRows = rawData.slice(bestHeaderRowIdx + 1).filter(r => 
        Array.isArray(r) && r.some(cell => cleanString(cell) !== '')
      );

      if (dataRows.length === 0) {
        setErrorMessage('ফাইলে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি। অনুগ্রহ করে নমুনা টেমপ্লেট দেখে অন্তত একটি সারিতে তথ্য প্রদান করুন।');
        setParsing(false);
        return;
      }

      // Flexible column index finder with exclusion support
      const findColIdx = (keywords: string[], excludeKeywords: string[] = []): number => {
        return headerRow.findIndex(h => {
          if (!h) return false;
          const matches = keywords.some(k => h.includes(k.toLowerCase()));
          if (!matches) return false;
          if (excludeKeywords.length > 0) {
            return !excludeKeywords.some(ex => h.includes(ex.toLowerCase()));
          }
          return true;
        });
      };

      // 1. Trainee ID
      const colTraineeId = findColIdx(
        ['trainee id', 'trainee_id', 'প্রশিক্ষণার্থী আইডি', 'শিক্ষার্থী আইডি', 'ছাত্র আইডি', 'আইডি', 'student id', 'id'],
        ['national', 'nid', 'জাতীয়', 'জাতীয়']
      );

      // 2. Registration Number
      const colRegNo = findColIdx([
        'registration', 'reg no', 'reg_no', 'reg. no', 'reg number', 'registration no',
        'রেজিস্ট্রেশন নম্বর', 'রেজিস্ট্রেশন নং', 'রেজিস্ট্রেশন', 'রেজি নম্বর', 'রেজি নং', 'রেজি'
      ]);

      // 3. Name Bangla (Explicit vs General)
      let colNameBn = findColIdx([
        'পূর্ণ নাম বাংলা', 'নাম বাংলা', 'বাংলা নাম', 'নাম (বাংলা)', 'নাম(বাংলা)', 
        'name bn', 'name_bn', 'name bangla', 'name (bangla)'
      ]);
      if (colNameBn === -1) {
        // Look for general trainee name
        colNameBn = findColIdx(
          ['প্রশিক্ষণার্থীর নাম', 'প্রশিক্ষণার্থী নাম', 'শিক্ষার্থীর নাম', 'শিক্ষার্থী নাম', 'ছাত্র/ছাত্রীর নাম', 'ছাত্রের নাম', 'ছাত্রীর নাম', 'পূর্ণ নাম', 'নাম'],
          ['ইংরেজি', 'english', 'en', 'পিতা', 'father', 'মাতা', 'mother', 'স্কুল', 'school', 'প্রতিষ্ঠান', 'institute', 'ব্যাচ', 'batch']
        );
      }

      // 4. Name English (Explicit vs General)
      let colNameEn = findColIdx([
        'name en', 'name_en', 'name english', 'name (english)', 'নাম ইংরেজি', 'ইংরেজি নাম', 'নাম (ইংরেজি)', 'নাম(ইংরেজি)'
      ]);
      if (colNameEn === -1) {
        colNameEn = findColIdx(
          ['full name', 'student name', 'trainee name', 'name'],
          ['bangla', 'বাংলা', 'father', 'mother', 'school', 'institute']
        );
        // Avoid pointing to the exact same column as colNameBn if colNameBn is already set
        if (colNameEn === colNameBn) {
          colNameEn = -1;
        }
      }

      // 5. Father's Name
      const colFatherBn = findColIdx(['father name', 'father', 'পিতার নাম', 'বাবার নাম', 'পিতা', 'বাবা']);

      // 6. Mother's Name
      const colMotherBn = findColIdx(['mother name', 'mother', 'মাতার নাম', 'মায়ের নাম', 'মা এর নাম', 'মাতা', 'মা']);

      // 7. Date of birth
      const colDob = findColIdx(['date of birth', 'birth date', 'dob', 'birth', 'জন্ম তারিখ', 'জন্মতারিখ', 'জন্ম']);

      // 8. Gender
      const colGender = findColIdx(['gender', 'sex', 'লিঙ্গ']);

      // 9. NID / Birth Reg
      const colNid = findColIdx(['nid', 'birth registration', 'national id', 'জাতীয় পরিচয়পত্র', 'জাতীয় পরিচয়', 'এনআইডি', 'জন্ম নিবন্ধন', 'জন্মনিবন্ধন']);

      // 10. Mobile Number
      const colMobile = findColIdx(['mobile number', 'mobile no', 'mobile', 'phone number', 'phone no', 'phone', 'contact', 'মোবাইল নম্বর', 'মোবাইল নং', 'মোবাইল', 'ফোন নম্বর', 'ফোন নং', 'ফোন', 'যোগাযোগ']);

      // 11. Permanent Address
      const colPermAddr = findColIdx(['permanent address', 'permanent', 'স্থায়ী ঠিকানা', 'স্থায়ী', 'ঠিকানা', 'address']);

      // 12. Present Address
      let colPresAddr = findColIdx(['present address', 'present', 'বর্তমান ঠিকানা', 'বর্তমান']);
      if (colPresAddr === colPermAddr) {
        colPresAddr = -1;
      }

      // 13. Batch
      const colBatch = findColIdx(['batch code', 'batch name', 'batch', 'ব্যাচ কোড', 'ব্যাচ নাম', 'ব্যাচ নং', 'ব্যাচ']);

      // 14. Last Class
      const colLastClass = findColIdx(['last class', 'class completed', 'class', 'সর্বশেষ শ্রেণি', 'সর্বশেষ শ্রেণী', 'পাসকৃত শ্রেণি', 'শ্রেণি', 'শ্রেণী']);

      // 15. Previous School
      const colPrevSchool = findColIdx(['previous school', 'school name', 'school', 'পূর্ববর্তী স্কুল', 'বিদ্যালয়', 'স্কুল']);

      // 16. Dropout Year
      const colDropoutYear = findColIdx(['dropout year', 'year of dropout', 'dropout', 'ঝরে পড়ার বছর', 'ঝরে পড়ার বছর', 'ড্রপআউটের বছর', 'ড্রপআউট বছর']);

      // 17. Dropout Reason
      const colDropoutReason = findColIdx(['dropout reason', 'reason of dropout', 'reason', 'ড্রপআউটের কারণ', 'ঝরে পড়ার কারণ', 'ঝরে পড়ার কারণ', 'কারণ']);

      // Track uniqueness within the uploaded file
      const seenFileTraineeIds = new Set<string>();
      const seenFileRegNumbers = new Set<string>();
      const seenFileMobiles = new Set<string>();

      // Track capacity usage per batch within file
      const batchEnrolledCount = new Map<string, number>();
      batches.forEach(b => {
        const count = existingTrainees.filter(t => t.batchId === b.id && (!t.status || t.status === 'Active')).length;
        batchEnrolledCount.set(b.id, count);
      });

      let autoIdCounter = nextAutoIdBase;
      const parsed: ParsedTraineeRow[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = bestHeaderRowIdx + 1 + i + 1; // 1-based spreadsheet line
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Name Resolution (Bengali or English or Single Name column)
        const rawBn = cleanString(colNameBn !== -1 ? row[colNameBn] : '');
        const rawEn = cleanString(colNameEn !== -1 ? row[colNameEn] : '');
        const nameBn = rawBn || rawEn;
        const nameEn = rawEn || rawBn;

        if (!nameBn) {
          errors.push('প্রশিক্ষণার্থীর নাম থাকা আবশ্যক।');
        }

        // 2. Mobile number (supports Bengali numerals, Excel truncated leading zero, +88 prefix)
        let rawMobile = cleanString(colMobile !== -1 ? row[colMobile] : '');
        // Convert any Bengali numerals (০-৯) to Western (0-9)
        rawMobile = toEnDigits(rawMobile);
        // Remove spaces, hyphens, and non-digit characters
        rawMobile = rawMobile.replace(/[^\d]/g, '');
        // Strip Bangladesh country code if 13 digits starting with 8801
        if (rawMobile.startsWith('8801') && rawMobile.length === 13) {
          rawMobile = rawMobile.slice(2);
        }
        // If 10 digits starting with 1 (Excel stripped leading 0)
        if (rawMobile.length === 10 && rawMobile.startsWith('1')) {
          rawMobile = '0' + rawMobile;
        }

        if (!rawMobile || rawMobile.length !== 11 || !rawMobile.startsWith('01')) {
          errors.push(`মোবাইল নম্বর অবশ্যই সঠিক ১১ ডিজিটের হতে হবে (০১ দিয়ে শুরু), পাওয়া গেছে: "${rawMobile || 'খালি'}"।`);
        } else {
          // Check intra-file duplicate mobile
          if (seenFileMobiles.has(rawMobile)) {
            errors.push(`এই মোবাইল নম্বরটি (${rawMobile}) ফাইলের একাধিক সারিতে ব্যবহৃত হয়েছে।`);
          } else {
            seenFileMobiles.add(rawMobile);
          }

          // Check database duplicate mobile for active trainees
          const duplicateMobileTrainee = existingTrainees.find(
            t => t.mobileNumber?.trim() === rawMobile && (!t.status || t.status === 'Active')
          );
          if (duplicateMobileTrainee) {
            errors.push(`এই মোবাইল নম্বরটি ইতোমধ্যে সক্রিয় শিক্ষার্থী "${duplicateMobileTrainee.nameBn || duplicateMobileTrainee.nameEn}" এর নামে ডাটাবেজে নিবন্ধিত।`);
          }
        }

        // 3. Batch resolution (supports Bengali numerals, codes, names, or fallback to default)
        let batchIdentifier = cleanString(colBatch !== -1 ? row[colBatch] : '');
        let targetBatch: Batch | undefined;

        if (batchIdentifier) {
          const normKey = batchIdentifier.toLowerCase();
          const normEnKey = toEnDigits(batchIdentifier).toLowerCase();
          const cleanKey = normKey.replace(/[\s-_]/g, '');

          targetBatch = batchLookup.get(normKey) || 
                        batchLookup.get(normEnKey) || 
                        batchLookup.get(cleanKey);

          if (!targetBatch) {
            // Partial match search
            targetBatch = batches.find(b => 
              b.name?.toLowerCase().includes(normKey) ||
              b.batchCode?.toLowerCase().includes(normKey) ||
              (b.name && normKey.includes(b.name.toLowerCase()))
            );
          }
        }

        // If not specified or not found in file, use the selected default batch
        if (!targetBatch && defaultBatchId) {
          targetBatch = batches.find(b => b.id === defaultBatchId);
          if (!batchIdentifier) {
            warnings.push(`ব্যাচ নির্ধারিত না থাকায় ডিফল্ট ব্যাচ (${targetBatch?.name || 'নির্বাচিত'}) বরাদ্দ করা হয়েছে।`);
          } else {
            warnings.push(`ফাইলের ব্যাচ '${batchIdentifier}' পাওয়া যায়নি; ডিফল্ট ব্যাচ (${targetBatch?.name || 'নির্বাচিত'}) বরাদ্দ করা হয়েছে।`);
          }
        }

        if (!targetBatch) {
          errors.push('কোনো বৈধ প্রশিক্ষণ ব্যাচ পাওয়া যায়নি বা নির্বাচন করা হয়নি।');
        }

        const resolvedBatchId = targetBatch?.id || '';
        const resolvedBatchName = targetBatch?.name || 'N/A';
        const resolvedTradeId = targetBatch?.tradeId || '';
        const resolvedInstituteId = targetBatch?.instituteId || '';

        // Batch Capacity Check
        if (targetBatch) {
          const currentCount = batchEnrolledCount.get(targetBatch.id) || 0;
          const maxCapacity = targetBatch.maxTrainees || 30;
          if (currentCount >= maxCapacity) {
            errors.push(`ব্যাচ "${targetBatch.name}" এর নির্ধারিত আসন (${maxCapacity} জন) পূর্ণ হয়ে গেছে।`);
          } else {
            batchEnrolledCount.set(targetBatch.id, currentCount + 1);
          }
        }

        // 4. Trainee ID (auto-generates if empty, supports Bengali digits)
        let traineeId = cleanString(colTraineeId !== -1 ? row[colTraineeId] : '');
        traineeId = toEnDigits(traineeId);
        if (!traineeId) {
          traineeId = `TR-${autoIdCounter++}`;
          warnings.push(`আইডি খালি থাকায় স্বয়ংক্রিয়ভাবে "${traineeId}" তৈরি করা হয়েছে।`);
        } else {
          const normalizedId = traineeId.toLowerCase();
          if (seenFileTraineeIds.has(normalizedId)) {
            errors.push(`প্রশিক্ষণার্থী আইডি '${traineeId}' ফাইলের একাধিক সারিতে ডুপ্লিকেট হিসেবে এসেছে।`);
          } else {
            seenFileTraineeIds.add(normalizedId);
          }

          const isDbIdTaken = existingTrainees.some(
            t => t.traineeId?.trim().toLowerCase() === normalizedId
          );
          if (isDbIdTaken) {
            errors.push(`প্রশিক্ষণার্থী আইডি '${traineeId}' ইতোমধ্যে ডাটাবেজে বিদ্যমান।`);
          }
        }

        // 5. Registration Number (Nullable / Optional, but unique if provided)
        let regNo = cleanString(colRegNo !== -1 ? row[colRegNo] : '');
        regNo = toEnDigits(regNo);
        if (regNo) {
          const normalizedReg = regNo.toLowerCase();
          if (seenFileRegNumbers.has(normalizedReg)) {
            errors.push(`রেজিস্ট্রেশন নম্বর '${regNo}' ফাইলের একাধিক সারিতে ডুপ্লিকেট হিসেবে এসেছে।`);
          } else {
            seenFileRegNumbers.add(normalizedReg);
          }

          const isDbRegTaken = existingTrainees.some(
            t => t.registrationNumber?.trim().toLowerCase() === normalizedReg
          );
          if (isDbRegTaken) {
            errors.push(`রেজিস্ট্রেশন নম্বর '${regNo}' ইতোমধ্যে অন্য শিক্ষার্থীর জন্য ব্যবহৃত হয়েছে।`);
          }
        }

        // 6. Address
        const permanentAddress = cleanString(colPermAddr !== -1 ? row[colPermAddr] : '');
        let presentAddress = cleanString(colPresAddr !== -1 ? row[colPresAddr] : '');
        
        let finalPerm = permanentAddress;
        let finalPres = presentAddress;

        if (!finalPerm && finalPres) {
          finalPerm = finalPres;
        } else if (finalPerm && !finalPres) {
          finalPres = finalPerm;
        }

        if (!finalPerm) {
          errors.push('ঠিকানা পূরণ করা আবশ্যক।');
        }

        const sameAsPermanentAddress = !presentAddress || presentAddress === permanentAddress;

        // 7. Gender (Bengali and English)
        const rawGender = cleanString(colGender !== -1 ? row[colGender] : '').toLowerCase();
        let gender: 'Male' | 'Female' | 'Other' = 'Male';
        if (
          rawGender.includes('female') || 
          rawGender === 'f' || 
          rawGender.includes('নারী') || 
          rawGender.includes('মহিলা') || 
          rawGender.includes('মেয়ে') || 
          rawGender.includes('মেয়ে')
        ) {
          gender = 'Female';
        } else if (
          rawGender.includes('other') || 
          rawGender.includes('অন্যান্য') || 
          rawGender.includes('হিজড়া') || 
          rawGender.includes('তৃতীয়') || 
          rawGender.includes('তৃতীয়')
        ) {
          gender = 'Other';
        }

        // 8. Date of Birth (handles serial, YYYY-MM-DD, DD/MM/YYYY, Bengali digits)
        const dobResult = normalizeDate(colDob !== -1 ? row[colDob] : '');
        const dob = dobResult.date;
        if (dobResult.warning) {
          warnings.push(dobResult.warning);
        }

        // 9. NID / Birth Reg (supports Bengali digits)
        let nidOrBirth = cleanString(colNid !== -1 ? row[colNid] : '');
        nidOrBirth = toEnDigits(nidOrBirth).replace(/[^\d]/g, '');
        if (nidOrBirth && nidOrBirth.length > 5) {
          const duplicateNid = existingTrainees.find(
            t => t.nidOrBirthRegistration?.trim() === nidOrBirth
          );
          if (duplicateNid) {
            errors.push(`এনআইডি/জন্মনিবন্ধন নম্বরটি ইতোমধ্যে শিক্ষার্থী "${duplicateNid.nameBn || duplicateNid.nameEn}" এর নামে ডাটাবেজে রয়েছে।`);
          }
        }

        // 10. Educational & Dropout info
        const fatherNameBn = cleanString(colFatherBn !== -1 ? row[colFatherBn] : '');
        const motherNameBn = cleanString(colMotherBn !== -1 ? row[colMotherBn] : '');
        const lastClass = cleanString(colLastClass !== -1 ? row[colLastClass] : '') || 'Class 7 (৭ম শ্রেণি)';
        const prevSchool = cleanString(colPrevSchool !== -1 ? row[colPrevSchool] : '');
        let yearOfDropout = cleanString(colDropoutYear !== -1 ? row[colDropoutYear] : '');
        yearOfDropout = toEnDigits(yearOfDropout).replace(/[^\d]/g, '') || '2023';
        const reasonForDropout = cleanString(colDropoutReason !== -1 ? row[colDropoutReason] : '') || 'আর্থিক অসচ্ছলতা ও পারিবারিক সমস্যা';

        parsed.push({
          rowNumber: rowNum,
          traineeId,
          registrationNumber: regNo,
          nameBn: nameBn,
          nameEn: nameEn,
          fatherNameBn,
          fatherNameEn: fatherNameBn,
          motherNameBn,
          motherNameEn: motherNameBn,
          dateOfBirth: dob,
          gender,
          nidOrBirthRegistration: nidOrBirth,
          mobileNumber: rawMobile,
          permanentAddress: finalPerm,
          presentAddress: finalPres,
          sameAsPermanentAddress,
          batchIdentifier,
          resolvedBatchId,
          resolvedBatchName,
          resolvedTradeId,
          resolvedInstituteId,
          lastClassCompleted: lastClass,
          previousSchoolName: prevSchool,
          yearOfDropout,
          reasonForDropout,
          isValid: errors.length === 0,
          errors,
          warnings
        });
      }

      setParsedRows(parsed);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(err?.message || 'ফাইলটি পড়তে সমস্যা হয়েছে। দয়া করে বৈধ .xlsx বা .csv ফাইল আপলোড করুন।');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Stats
  const validRows = useMemo(() => parsedRows.filter(r => r.isValid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter(r => !r.isValid), [parsedRows]);

  const displayedRows = useMemo(() => {
    if (filterTab === 'valid') return validRows;
    if (filterTab === 'invalid') return invalidRows;
    return parsedRows;
  }, [filterTab, parsedRows, validRows, invalidRows]);

  // Execute Bulk Save to Firestore
  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      setErrorMessage('আমদানি করার মতো কোনো বৈধ শিক্ষার্থী পাওয়া যায়নি।');
      return;
    }

    setImporting(true);
    setErrorMessage('');

    try {
      const traineesToSave: Trainee[] = validRows.map(r => {
        const targetBatch = batches.find(b => b.id === r.resolvedBatchId);
        return {
          id: `TRN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`,
          traineeId: r.traineeId,
          registrationNumber: r.registrationNumber || '',
          nameBn: r.nameBn,
          nameEn: r.nameEn,
          fatherNameBn: r.fatherNameBn,
          fatherNameEn: r.fatherNameEn,
          motherNameBn: r.motherNameBn,
          motherNameEn: r.motherNameEn,
          dateOfBirth: r.dateOfBirth,
          gender: r.gender,
          nidOrBirthRegistration: r.nidOrBirthRegistration,
          mobileNumber: r.mobileNumber,
          address: r.permanentAddress,
          permanentAddress: r.permanentAddress,
          presentAddress: r.presentAddress,
          sameAsPermanentAddress: r.sameAsPermanentAddress,
          lastClassCompleted: r.lastClassCompleted,
          previousSchoolName: r.previousSchoolName,
          yearOfDropout: r.yearOfDropout,
          reasonForDropout: r.reasonForDropout,
          batchId: r.resolvedBatchId,
          tradeId: r.resolvedTradeId || targetBatch?.tradeId || '',
          instituteId: r.resolvedInstituteId || targetBatch?.instituteId || '',
          admissionDate: Date.now(),
          trainingStartDate: targetBatch?.startDate ? new Date(targetBatch.startDate).getTime() : Date.now(),
          trainingEndDate: targetBatch?.endDate ? new Date(targetBatch.endDate).getTime() : Date.now() + 180 * 86400000,
          status: 'Active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      });

      const result = await dataService.saveTraineeBatch(traineesToSave);

      if (!result.success) {
        throw new Error(result.error || 'বাল্ক ডাটাবেজ সংরক্ষণ ব্যর্থ হয়েছে।');
      }

      await logActivity(
        userProfile?.id || '',
        userProfile?.name || 'User',
        `বাল্ক এক্সেল/সিএসভি আপলোডের মাধ্যমে ${result.count} জন শিক্ষার্থী সফলভাবে নিবন্ধন করা হয়েছে।`,
        'Trainees',
        'bulk_import'
      );

      // Refresh parent list in background
      onSuccess(result.count);

      // Present Post-Import Summary Modal
      setImportSummary({
        totalRows: parsedRows.length,
        importedCount: result.count,
        failedCount: invalidRows.length,
        successfulRows: validRows,
        failedRows: invalidRows,
        timestamp: Date.now()
      });

      // Default to failed tab if there are failed rows, otherwise all
      setSummaryFilterTab(invalidRows.length > 0 ? 'failed' : 'all');
    } catch (err: any) {
      console.error('Bulk import error:', err);
      setErrorMessage(err?.message || 'ডাটাবেজে সংরক্ষণ করার সময় ত্রুটি ঘটেছে।');
    } finally {
      setImporting(false);
    }
  };

  // Close summary modal and reset file import state
  const handleCloseSummary = () => {
    setImportSummary(null);
    setSelectedFile(null);
    setParsedRows([]);
    setErrorMessage('');
    onClose();
  };

  // Download Failed Rows CSV Report
  const handleDownloadFailedReport = () => {
    if (!importSummary || importSummary.failedRows.length === 0) return;
    
    const headers = [
      'সারি নং (Row)',
      'প্রশিক্ষণার্থী আইডি (Trainee ID)',
      'রেজিস্ট্রেশন নম্বর (Reg No)',
      'নাম বাংলা (Name Bn)',
      'নাম ইংরেজি (Name En)',
      'মোবাইল নম্বর (Mobile)',
      'ব্যাচ (Batch)',
      'ব্যর্থ হওয়ার কারণ ও ত্রুটি (Error Reasons)'
    ];

    const rows = importSummary.failedRows.map(r => [
      r.rowNumber,
      r.traineeId,
      r.registrationNumber || '',
      r.nameBn,
      r.nameEn,
      r.mobileNumber,
      r.resolvedBatchName,
      r.errors.join('; ')
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Failed_Trainees_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered rows for the post-import summary modal
  const filteredSummaryRows = useMemo(() => {
    if (!importSummary) return [];
    if (summaryFilterTab === 'success') return importSummary.successfulRows;
    if (summaryFilterTab === 'failed') return importSummary.failedRows;
    return [...importSummary.failedRows, ...importSummary.successfulRows].sort((a, b) => a.rowNumber - b.rowNumber);
  }, [importSummary, summaryFilterTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {importSummary ? (
          /* ========================================================= */
          /* POST-IMPORT SUMMARY SCREEN (Displays specifically which   */
          /* rows failed validation with error messages & which passed)*/
          /* ========================================================= */
          <div className="flex flex-col h-full max-h-[92vh] overflow-hidden">
            {/* Summary Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/70">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
                  importSummary.failedCount > 0 
                    ? 'bg-amber-600 text-white shadow-amber-600/30' 
                    : 'bg-emerald-600 text-white shadow-emerald-600/30'
                }`}>
                  {importSummary.failedCount > 0 ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-800">
                      বাল্ক আপলোড ফলাফল ও সারাংশ (Post-Import Summary)
                    </h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      importSummary.failedCount === 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {importSummary.failedCount === 0 ? 'সবগুলো সফল' : 'আংশিক সফল'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    মোট {toBn(importSummary.totalRows)} টি সারির মধ্যে সফলভাবে ডাটাবেজে সংরক্ষিত ও ব্যর্থ সারির ফলাফল
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseSummary}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X size={20} />
              </button>
            </div>

            {/* Summary Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* 3 Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">মোট সারি (Total Rows)</span>
                    <span className="w-8 h-8 rounded-xl bg-slate-200/60 text-slate-700 flex items-center justify-center">
                      <FileSpreadsheet size={16} />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-800 font-mono">
                    {toBn(importSummary.totalRows)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    আপলোডকৃত ফাইলের মোট শিক্ষার্থীর সারি
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">সফলভাবে সংরক্ষিত (Saved)</span>
                    <span className="w-8 h-8 rounded-xl bg-emerald-200/80 text-emerald-800 flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                    {toBn(importSummary.importedCount)}
                  </div>
                  <span className="text-[11px] text-emerald-700/80 mt-0.5 block font-medium">
                    সক্রিয় শিক্ষার্থী হিসেবে ডাটাবেজে সংরক্ষিত হয়েছে
                  </span>
                </div>

                <div className={`p-4 rounded-2xl border shadow-2xs ${
                  importSummary.failedCount > 0 
                    ? 'bg-rose-50/80 border-rose-200' 
                    : 'bg-slate-50/60 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${
                      importSummary.failedCount > 0 ? 'text-rose-800' : 'text-slate-500'
                    }`}>
                      ব্যর্থ / বাতিল সারি (Failed)
                    </span>
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      importSummary.failedCount > 0 
                        ? 'bg-rose-200 text-rose-800' 
                        : 'bg-slate-200/60 text-slate-500'
                    }`}>
                      <XCircle size={16} />
                    </span>
                  </div>
                  <div className={`mt-2 text-2xl font-black font-mono ${
                    importSummary.failedCount > 0 ? 'text-rose-700' : 'text-slate-600'
                  }`}>
                    {toBn(importSummary.failedCount)}
                  </div>
                  <span className={`text-[11px] mt-0.5 block ${
                    importSummary.failedCount > 0 ? 'text-rose-700/80 font-medium' : 'text-slate-400'
                  }`}>
                    {importSummary.failedCount > 0 
                      ? 'ভ্যালিডেশন শর্ত পূরণ না করায় ডাটাবেজে যুক্ত হয়নি' 
                      : 'কোনো ত্রুটি পাওয়া যায়নি'}
                  </span>
                </div>
              </div>

              {/* Notice Banner if there are failed rows */}
              {importSummary.failedCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        {toBn(importSummary.failedCount)} টি সারিতে ত্রুটি থাকায় ডাটাবেজে সংরক্ষণ করা হয়নি:
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        নিচের তালিকা থেকে প্রতিটি সারির নির্দিষ্ট ত্রুটির বিবরণ দেখুন। প্রয়োজনে ত্রুটিযুক্ত সারির তালিকা ডাউনলোড করে স্প্রেডশিটে সংশোধন করে পুনরায় আপলোড করতে পারেন।
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadFailedReport}
                    className="px-3.5 py-2 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <Download size={14} className="text-amber-700" />
                    <span>ব্যর্থ সারির রিপোর্ট (.csv)</span>
                  </button>
                </div>
              )}

              {/* Tabs: All / Failed / Successful */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-100">
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSummaryFilterTab('all')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      summaryFilterTab === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    সবগুলো ({toBn(importSummary.totalRows)})
                  </button>

                  {importSummary.failedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSummaryFilterTab('failed')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer ${
                        summaryFilterTab === 'failed'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <XCircle size={13} />
                      <span>ব্যর্থ সারি ({toBn(importSummary.failedCount)})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSummaryFilterTab('success')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer ${
                      summaryFilterTab === 'success'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>সফল সারি ({toBn(importSummary.importedCount)})</span>
                  </button>
                </div>

                <span className="text-xs text-slate-400">
                  প্রদর্শিত হচ্ছে: {toBn(filteredSummaryRows.length)} টি সারি
                </span>
              </div>

              {/* List of Processed & Failed Rows */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredSummaryRows.map((r) => (
                  <div
                    key={r.rowNumber}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      !r.isValid
                        ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                        : 'bg-white border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      {/* Row identifier & Details */}
                      <div className="flex items-start space-x-3">
                        <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 ${
                          !r.isValid 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          সারি #{toBn(r.rowNumber)}
                        </span>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              {r.nameBn || r.nameEn || '(নাম পাওয়া যায়নি)'}
                            </span>
                            {r.nameEn && r.nameEn !== r.nameBn && (
                              <span className="text-xs text-slate-500 font-medium">({r.nameEn})</span>
                            )}
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              আইডি: {r.traineeId || 'N/A'}
                            </span>
                            {r.registrationNumber && (
                              <span className="font-mono text-xs text-slate-500">
                                রেজি: {r.registrationNumber}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 pt-0.5">
                            <span className="flex items-center space-x-1">
                              <Phone size={12} className="text-slate-400" />
                              <span className="font-mono">{toBn(r.mobileNumber) || 'মোবাইল নেই'}</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <Layers size={12} className="text-slate-400" />
                              <span>{r.resolvedBatchName}</span>
                            </span>
                            {r.permanentAddress && (
                              <>
                                <span>•</span>
                                <span className="flex items-center space-x-1 truncate max-w-[260px]">
                                  <MapPin size={12} className="text-slate-400" />
                                  <span className="truncate">{r.permanentAddress}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 self-start sm:self-auto">
                        {r.isValid ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={13} />
                            <span>ডাটাবেজে সংরক্ষিত</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle size={13} />
                            <span>ভ্যালিডেশন ব্যর্থ</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specific Error Messages for Failed Rows */}
                    {!r.isValid && r.errors.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-rose-100/70 border border-rose-200 text-rose-900 text-xs space-y-1.5">
                        <span className="font-bold flex items-center space-x-1 text-rose-800 text-[11px] uppercase tracking-wide">
                          <AlertCircle size={14} className="text-rose-600 shrink-0" />
                          <span>ভ্যালিডেশন ব্যর্থ হওয়ার নির্দিষ্ট কারণসমূহ ({toBn(r.errors.length)} টি):</span>
                        </span>
                        <div className="space-y-1 pl-4">
                          {r.errors.map((err, idx) => (
                            <div key={idx} className="font-semibold text-rose-900 leading-snug flex items-start space-x-1.5">
                              <span className="text-rose-500 font-bold">•</span>
                              <span>{err}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings Box if any */}
                    {r.isValid && r.warnings.length > 0 && (
                      <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                        {r.warnings.map((warn, idx) => (
                          <div key={idx} className="flex items-center space-x-1">
                            <Info size={11} className="text-amber-600 shrink-0" />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">
                  আমদানি সম্পন্ন: <strong className="text-emerald-700">{toBn(importSummary.importedCount)} জন</strong> শিক্ষার্থী সফলভাবে ডাটাবেজে অন্তর্ভুক্ত হয়েছে।
                </span>
                {importSummary.failedCount > 0 && (
                  <span className="text-rose-700 ml-1 font-medium">
                    (বাদ পড়া {toBn(importSummary.failedCount)} টি সারি সংশোধনের প্রয়োজন)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2.5 self-end sm:self-auto">
                {importSummary.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadFailedReport}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download size={14} className="text-rose-600" />
                    <span>ব্যর্থ সারির রিপোর্ট (.csv)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseSummary}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer"
                >
                  <Check size={16} />
                  <span>ঠিক আছে, সম্পন্ন করুন</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* REGULAR UPLOAD & PREVIEW SCREEN                           */
          /* ========================================================= */
          <div className="flex flex-col h-full max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                    <span>প্রশিক্ষণার্থী বাল্ক ইনপুট (Excel / CSV Bulk Import)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Data Consistency Assured
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    এক্সেল (.xlsx, .xls) অথবা সিএসভি (.csv) ফাইলের মাধ্যমে একযোগে একাধিক শিক্ষার্থীর তথ্য নির্ভুলভাবে আমদানি করুন
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X size={20} />
              </button>
            </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Top Instruction & Template Download Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 text-xs text-slate-600 flex-1">
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5 text-emerald-900">
                <Info size={16} className="text-emerald-600" />
                <span>সঠিক তথ্য কাঠামোর নিয়মাবলী (Data Structure Guidelines)</span>
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                ডাটাবেজের ধারাবাহিকতা রক্ষায় টেমপ্লেটের কলামের নাম ও ক্রম অক্ষুণ্ণ রাখুন। 
                বাধ্যতামূলক ফিল্ড: <strong>নাম</strong>, <strong>১১ ডিজিটের মোবাইল নম্বর</strong> এবং <strong>স্থায়ী ঠিকানা</strong>।
                আইডি খালি থাকলে স্বয়ংক্রিয়ভাবে সিকোয়েন্সিয়াল আইডি দেওয়া হবে।
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadTemplate('xlsx')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="Excel টেমপ্লেট ডাউনলোড"
              >
                <Download size={14} />
                <span>টেমপ্লেট (Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate('csv')}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="CSV টেমপ্লেট ডাউনলোড"
              >
                <Download size={14} className="text-emerald-700" />
                <span>টেমপ্লেট (CSV)</span>
              </button>
            </div>
          </div>

          {/* Upload & Configuration Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Default Batch Selector */}
            <div className="md:col-span-1 space-y-1.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Layers size={14} className="text-emerald-600" />
                  <span>ডিফল্ট প্রশিক্ষণ ব্যাচ (Fallback Batch)</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  স্প্রেডশিটের কোনো সারিতে ব্যাচ উল্লেখ না থাকলে বা অমিল থাকলে এই ব্যাচে ভর্তি হবে:
                </p>
              </div>

              <select
                value={defaultBatchId}
                onChange={(e) => setDefaultBatchId(e.target.value)}
                className="w-full mt-2 px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.batchCode || 'No Code'})
                  </option>
                ))}
              </select>
            </div>

            {/* Drag & Drop File Zone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`md:col-span-2 border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition text-center ${
                dragOver 
                  ? 'border-emerald-500 bg-emerald-50/60' 
                  : selectedFile 
                  ? 'border-emerald-300 bg-emerald-50/20' 
                  : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange}
                className="hidden" 
              />
              
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 shadow-2xs">
                <Upload size={22} className={parsing ? 'animate-bounce' : ''} />
              </div>

              {selectedFile ? (
                <div>
                  <div className="flex items-center justify-center space-x-1.5 text-slate-800 font-bold text-sm">
                    <FileCheck size={16} className="text-emerald-600" />
                    <span>{selectedFile.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ফাইলের সাইজ: {(selectedFile.size / 1024).toFixed(1)} KB • নতুন ফাইল দিতে ক্লিক করুন
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-bold text-slate-700 block">
                    এক্সেল বা সিএসভি ফাইল এখানে ড্র্যাগ করে ছাড়ুন অথবা ক্লিক করুন
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    সমর্থিত ফরম্যাট: .xlsx, .xls, .csv (সর্বোচ্চ ৫০০ সারি প্রতি ফাইলে)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start space-x-2.5 animate-in fade-in">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-sm block">আমদানি সংক্রান্ত ত্রুটি:</span>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Validation & Preview Section (When rows are parsed) */}
          {parsedRows.length > 0 && (
            <div className="space-y-3.5 pt-2 border-t border-slate-100">
              {/* Controls Bar: Stats, Filter Tabs, and View Toggle */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                {/* Stats */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                  <span className="text-slate-600 font-semibold">
                    মোট সারি: <strong className="text-slate-800">{toBn(parsedRows.length)}</strong> টি
                  </span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="text-emerald-700 font-bold flex items-center space-x-1">
                    <CheckCircle2 size={13} />
                    <span>সঠিক: {toBn(validRows.length)} টি</span>
                  </span>
                  {invalidRows.length > 0 && (
                    <>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="text-rose-600 font-bold flex items-center space-x-1">
                        <XCircle size={13} />
                        <span>ত্রুটিযুক্ত: {toBn(invalidRows.length)} টি</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Filters and View Mode Controls */}
                <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                  {/* Status Filter Tabs */}
                  <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                        filterTab === 'all' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      সবগুলো ({toBn(parsedRows.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('valid')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                        filterTab === 'valid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                      }`}
                    >
                      সঠিক ({toBn(validRows.length)})
                    </button>
                    {invalidRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterTab('invalid')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          filterTab === 'invalid' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:text-rose-900'
                        }`}
                      >
                        ত্রুটিযুক্ত ({toBn(invalidRows.length)})
                      </button>
                    )}
                  </div>

                  {/* View Mode Switcher (Grid as Primary) */}
                  <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                      title="গ্রিড বা কার্ড ভিউ (প্রাথমিক ভিউ)"
                    >
                      <LayoutGrid size={14} />
                      <span>গ্রিড ভিউ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                      title="টেবিল ভিউ (সম্পূর্ণ অনুভূমিক স্ক্রোলসহ)"
                    >
                      <List size={14} />
                      <span>টেবিল ভিউ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* View 1: PRIMARY GRID VIEW */}
              {viewMode === 'grid' ? (
                <div className="max-h-[500px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {displayedRows.map((r) => (
                      <div
                        key={r.rowNumber}
                        className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                          !r.isValid
                            ? 'bg-rose-50/30 border-rose-200 shadow-2xs hover:border-rose-300'
                            : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-300'
                        }`}
                      >
                        {/* Card Header: Row Number, ID, Reg No, Status */}
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                              #{toBn(r.rowNumber)}
                            </span>
                            <div>
                              <span className="font-mono font-bold text-xs text-slate-900 block">
                                {r.traineeId}
                              </span>
                              {r.registrationNumber ? (
                                <span className="font-mono text-[10px] text-slate-500 block">
                                  রেজি: {r.registrationNumber}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic block">
                                  রেজিঃ নম্বর নেই (ঐচ্ছিক)
                                </span>
                              )}
                            </div>
                          </div>

                          {r.isValid ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                              <CheckCircle2 size={12} />
                              <span>আমদানিযোগ্য</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                              <XCircle size={12} />
                              <span>ত্রুটিযুক্ত ({toBn(r.errors.length)})</span>
                            </span>
                          )}
                        </div>

                        {/* Trainee Details */}
                        <div className="py-3 space-y-2.5 text-xs flex-1">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-snug">
                              {r.nameBn}
                            </h4>
                            {r.nameEn && r.nameEn !== r.nameBn && (
                              <p className="text-[11px] text-slate-500 font-medium">
                                {r.nameEn}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="flex items-center space-x-1.5 text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                              <Phone size={12} className="text-emerald-600 shrink-0" />
                              <span className="font-mono font-semibold truncate">{toBn(r.mobileNumber)}</span>
                            </div>

                            <div className="flex items-center space-x-1.5 text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                              <Layers size={12} className="text-teal-600 shrink-0" />
                              <span className="font-semibold truncate" title={r.resolvedBatchName}>
                                {r.resolvedBatchName}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5 text-slate-600 bg-slate-50/60 px-2.5 py-1.5 rounded-xl border border-slate-100">
                              <Calendar size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">
                                {toBn(r.dateOfBirth)} ({r.gender === 'Female' ? 'নারী' : r.gender === 'Other' ? 'অন্যান্য' : 'পুরুষ'})
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5 text-slate-600 bg-slate-50/60 px-2.5 py-1.5 rounded-xl border border-slate-100">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate" title={r.permanentAddress}>
                                {r.permanentAddress || 'ঠিকানা নেই'}
                              </span>
                            </div>
                          </div>

                          {/* Parents and additional info summary */}
                          {(r.fatherNameBn || r.motherNameBn) && (
                            <div className="text-[10px] text-slate-500 pt-0.5 truncate bg-slate-50/40 px-2 py-1 rounded-lg">
                              {r.fatherNameBn && <span>পিতা: {r.fatherNameBn}</span>}
                              {r.fatherNameBn && r.motherNameBn && <span className="mx-1">•</span>}
                              {r.motherNameBn && <span>মাতা: {r.motherNameBn}</span>}
                            </div>
                          )}

                          {/* Last class / Dropout summary if present */}
                          {(r.lastClassCompleted || r.previousSchoolName) && (
                            <div className="text-[10px] text-slate-500 flex items-center space-x-1 truncate">
                              <GraduationCap size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">
                                {r.lastClassCompleted} {r.previousSchoolName ? `• ${r.previousSchoolName}` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Status / Errors / Warnings Footer */}
                        <div className="pt-2 border-t border-slate-100">
                          {r.errors.length > 0 ? (
                            <div className="bg-rose-100/70 border border-rose-200/80 rounded-xl p-2.5 space-y-1">
                              {r.errors.map((err, idx) => (
                                <div key={idx} className="text-[11px] font-semibold text-rose-800 flex items-start space-x-1.5">
                                  <XCircle size={12} className="text-rose-600 shrink-0 mt-0.5" />
                                  <span className="leading-tight">{err}</span>
                                </div>
                              ))}
                            </div>
                          ) : r.warnings.length > 0 ? (
                            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2 space-y-0.5">
                              {r.warnings.map((warn, idx) => (
                                <div key={idx} className="text-[10px] font-medium text-amber-800 flex items-start space-x-1">
                                  <Info size={11} className="text-amber-600 shrink-0 mt-0.5" />
                                  <span className="leading-tight">{warn}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-xl border border-emerald-100">
                              <Check size={12} className="text-emerald-600 shrink-0" />
                              <span>সকল তথ্য সঠিক ও ডাটাবেজে যুক্ত করার উপযোগী</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* View 2: HORIZONTALLY SCROLLABLE TABLE VIEW */
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="min-w-[1300px] w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-100/95 sticky top-0 z-10 text-slate-700 text-left font-bold backdrop-blur-xs">
                        <tr>
                          <th className="py-2.5 px-3 whitespace-nowrap">সারি</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">স্ট্যাটাস</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">আইডি</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">রেজিস্ট্রেশন নং</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[180px]">নাম (বাংলা ও ইংরেজি)</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">মোবাইল নম্বর</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">প্রশিক্ষণ ব্যাচ</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">লিঙ্গ ও জন্ম তারিখ</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[180px]">পিতা ও মাতার নাম</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[200px]">স্থায়ী ঠিকানা</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">শ্রেণি ও ড্রপআউট</th>
                          <th className="py-2.5 px-3 whitespace-nowrap min-w-[240px]">যাচাই ফলাফল ও ত্রুটি</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {displayedRows.map((r) => (
                          <tr
                            key={r.rowNumber}
                            className={!r.isValid ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/60'}
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                              #{toBn(r.rowNumber)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {r.isValid ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 size={11} />
                                  <span>সঠিক</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <XCircle size={11} />
                                  <span>ত্রুটি</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                              {r.traineeId}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                              {r.registrationNumber || <span className="text-slate-400 italic">ঐচ্ছিক/খালি</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <strong className="text-slate-900 block">{r.nameBn}</strong>
                              {r.nameEn && r.nameEn !== r.nameBn && (
                                <span className="text-[10px] text-slate-500 block">{r.nameEn}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                              {toBn(r.mobileNumber)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block" title={r.resolvedBatchName}>
                                {r.resolvedBatchName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              <div>{toBn(r.dateOfBirth)}</div>
                              <span className="text-[10px] text-slate-400">
                                {r.gender === 'Female' ? 'নারী' : r.gender === 'Other' ? 'অন্যান্য' : 'পুরুষ'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {r.fatherNameBn && <div>পিতা: {r.fatherNameBn}</div>}
                              {r.motherNameBn && <div className="text-[10px] text-slate-500">মাতা: {r.motherNameBn}</div>}
                              {!r.fatherNameBn && !r.motherNameBn && <span className="text-slate-400 italic">-</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate" title={r.permanentAddress}>
                              {r.permanentAddress}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              <div>{r.lastClassCompleted}</div>
                              {r.yearOfDropout && (
                                <span className="text-[10px] text-slate-400">ড্রপআউট: {toBn(r.yearOfDropout)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.errors.length > 0 ? (
                                <div className="space-y-0.5">
                                  {r.errors.map((err, idx) => (
                                    <span key={idx} className="block text-[10px] font-bold text-rose-700 leading-tight">
                                      • {err}
                                    </span>
                                  ))}
                                </div>
                              ) : r.warnings.length > 0 ? (
                                <div className="space-y-0.5">
                                  {r.warnings.map((warn, idx) => (
                                    <span key={idx} className="block text-[10px] font-medium text-amber-700 leading-tight">
                                      ℹ {warn}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1 whitespace-nowrap">
                                  <Check size={12} />
                                  <span>সঠিক ও অনুমোদিত</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {validRows.length > 0 ? (
              <span>
                আমদানির জন্য প্রস্তুত: <strong className="text-emerald-700 font-bold">{toBn(validRows.length)} জন</strong> শিক্ষার্থী।
                {invalidRows.length > 0 && (
                  <span className="text-amber-700 ml-1">
                    (ত্রুটিযুক্ত {toBn(invalidRows.length)} টি সারি স্বয়ংক্রিয়ভাবে বাদ দেওয়া হবে)
                  </span>
                )}
              </span>
            ) : (
              <span>ফাইল আপলোড করে ডাটা যাচাই করুন।</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              বাতিল
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={validRows.length === 0 || importing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer"
            >
              <CheckCircle2 size={16} className={importing ? 'animate-spin' : ''} />
              <span>
                {importing 
                  ? 'ডাটাবেজে সংরক্ষণ হচ্ছে...' 
                  : `আমদানি সম্পন্ন করুন (${toBn(validRows.length)} জন)`}
              </span>
            </button>
          </div>
        </div>

        {/* End of regular screen */}
        </div>
      )}

      </div>
    </div>
  );
};
