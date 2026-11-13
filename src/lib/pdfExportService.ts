import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Trainee, Institute, Trade, Batch } from '../types';
import { toBn, safeFormatDate } from './dateUtils';
import { saveFileToDevice, shareExportedFile, FileExportResult } from './fileExportService';

export interface TraineePdfExportOptions {
  trainees: Trainee[];
  institutes: Institute[];
  trades: Trade[];
  batches: Batch[];
  filterDetails?: string;
  generatedBy?: string;
  onProgress?: (current: number, total: number, message: string, percent?: number) => void;
}

/**
 * Format age at batch start date
 */
function calculateTraineeAge(t: Trainee, batches: Batch[]): string {
  if (!t.dateOfBirth) return '-';
  const birthDate = new Date(t.dateOfBirth);
  if (isNaN(birthDate.getTime())) return '-';

  const batch = batches.find(b => b.id === t.batchId);
  const refDateMs = batch?.startDate || t.trainingStartDate;
  const refDate = refDateMs ? new Date(refDateMs) : new Date();
  if (isNaN(refDate.getTime())) return '-';

  let years = refDate.getFullYear() - birthDate.getFullYear();
  let months = refDate.getMonth() - birthDate.getMonth();
  let days = refDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return '-';
  if (years === 0 && months === 0) return '১ মাসের কম';
  if (years === 0) return `${toBn(months)} মাস`;
  if (months === 0) return `${toBn(years)} বছর`;
  return `${toBn(years)} বছর ${toBn(months)} মাস`;
}

/**
 * Save a generated PDF Blob via the centralized export service.
 * On Android APK: writes directly into public Downloads via MediaStore.
 * On Web: performs clean Blob URL anchor download.
 */
export async function downloadPdfBlob(
  blob: Blob,
  filename: string,
  title: string = 'প্রশিক্ষণার্থী তালিকা'
): Promise<FileExportResult> {
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  return saveFileToDevice({
    fileName: safeFilename,
    content: blob,
    mimeType: 'application/pdf',
    category: 'pdf',
    title
  });
}

/**
 * Share a generated PDF Blob via Capacitor Share (Android/iOS) or Web Share API.
 */
export async function sharePdfBlob(
  blob: Blob,
  filename: string,
  title: string = 'প্রশিক্ষণার্থী তালিকা'
): Promise<FileExportResult> {
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  return shareExportedFile({
    fileName: safeFilename,
    content: blob,
    mimeType: 'application/pdf',
    category: 'pdf',
    title
  });
}

/**
 * Generates an official Trainee List PDF file with clean typography, guaranteed bottom margin,
 * no badges/icons, no status column, direct BRN/NID rendering, and batch/general logic.
 */
export async function generateTraineesPDF(options: TraineePdfExportOptions): Promise<Blob> {
  const {
    trainees,
    institutes,
    trades,
    batches,
    filterDetails,
    generatedBy = 'কোর্স পরিচালক',
    onProgress
  } = options;

  if (!trainees || trainees.length === 0) {
    throw new Error('এক্সপোর্ট করার মতো কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।');
  }

  // 8 rows per page guarantees generous bottom margin and prevents any clipping
  const ROWS_PER_PAGE = 8;
  const totalPages = Math.ceil(trainees.length / ROWS_PER_PAGE);

  // Initialize jsPDF in A4 Landscape format (297mm x 210mm)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const getInstName = (id?: string) => institutes.find(i => i.id === id)?.name || id || '-';
  const getTrdName = (id?: string) => trades.find(t => t.id === id)?.name || id || '-';

  // Check if exporting a specific batch (Requirement 5.2)
  const uniqueBatchIds = Array.from(new Set(trainees.map(t => t.batchId).filter(Boolean)));
  const isSingleBatch = uniqueBatchIds.length === 1 && uniqueBatchIds[0];

  let singleBatchInfo: { batchName: string; tradeName: string; instituteName: string } | null = null;
  if (isSingleBatch) {
    const bId = uniqueBatchIds[0];
    const bObj = batches.find(b => b.id === bId);
    const instName = getInstName(bObj?.instituteId || trainees[0]?.instituteId);
    const trdName = getTrdName(bObj?.tradeId || trainees[0]?.tradeId);
    const btcName = bObj?.name || bObj?.batchCode || bId;
    singleBatchInfo = {
      batchName: btcName,
      tradeName: trdName,
      instituteName: instName
    };
  }

  const dateNowBn = new Date().toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeNowBn = new Date().toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Create temporary offscreen container
  const container = document.createElement('div');
  container.id = 'trainee-pdf-offscreen-container';
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '1140px';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-999';
  document.body.appendChild(container);

  try {
    if (onProgress) {
      onProgress(0, totalPages, 'পিডিএফ ইঞ্জিন শুরু হচ্ছে...', 5);
      await new Promise(r => setTimeout(r, 60));
    }

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const curPage = pageIdx + 1;
      const startPercent = Math.round(8 + (pageIdx / totalPages) * 78);
      if (onProgress) {
        onProgress(curPage, totalPages, `পৃষ্ঠা ${toBn(curPage)} / ${toBn(totalPages)} রেন্ডার হচ্ছে...`, startPercent);
      }
      // Brief yield so the UI bar can animate smoothly
      await new Promise(r => setTimeout(r, 70));

      const startIdx = pageIdx * ROWS_PER_PAGE;
      const pageTrainees = trainees.slice(startIdx, startIdx + ROWS_PER_PAGE);

      // Construct HTML for the page
      // Width 1100px with 25px horizontal padding allows safe 1050px content box
      const pageEl = document.createElement('div');
      pageEl.style.width = '1100px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = '18px 25px 22px 25px';
      pageEl.style.backgroundColor = '#ffffff';
      pageEl.style.fontFamily = "'Noto Sans Bengali', Arial, sans-serif";
      pageEl.style.color = '#000000';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'flex-start';
      pageEl.style.overflow = 'visible';

      // Rows HTML - All text and borders set to black (#000000), right border ensured
      const rowsHtml = pageTrainees.map((t, rowIdx) => {
        const sl = startIdx + rowIdx + 1;
        const inst = getInstName(t.instituteId);
        const trd = getTrdName(t.tradeId);
        const age = calculateTraineeAge(t, batches);
        const dob = t.dateOfBirth ? safeFormatDate(t.dateOfBirth, 'dd-MM-yyyy') : '-';
        
        // Render BRN/NID directly without hesitation, badges or placeholders (Requirement 4)
        const rawDoc = (t.nidOrBirthRegistration || (t as any).ubrn || (t as any).birthRegistration || (t as any).nid || '').trim();
        const docNum = rawDoc || '—';

        const traineeName = (t.nameBn || t.nameEn || '-').replace(/^[\s\uFEFF\xA0]+/, '').trim();
        const address = (t.presentAddress || t.address || '-').trim();
        const edu = (t.lastClassCompleted || '-').trim();
        const dropoutNote = t.yearOfDropout ? ` (ঝরে পড়া: ${toBn(t.yearOfDropout)})` : '';
        const father = (t.fatherNameBn || t.fatherNameEn || '-').trim();
        const mobile = (t.mobileNumber || '-').trim();

        return `
          <tr style="border-bottom: 1px solid #94a3b8; font-size: 10px; background-color: #ffffff; color: #000000;">
            <!-- 1. SL -->
            <td style="padding: 7px 5px; text-align: center; font-weight: bold; width: 40px; color: #000000; border-right: 1px solid #94a3b8;">
              ${toBn(sl)}
            </td>

            <!-- 2. ID & Reg -->
            <td style="padding: 7px 8px; width: 120px; border-right: 1px solid #94a3b8; color: #000000;">
              <div style="font-weight: bold; color: #000000; font-family: monospace; font-size: 10.5px; margin: 0; padding: 0;">${(t.traineeId || '-').trim()}</div>
              <div style="color: #000000; font-size: 9.5px; font-family: monospace; margin-top: 2px; margin: 0; padding: 0;">${(t.registrationNumber || '-').trim()}</div>
            </td>

            <!-- 3. Trainee Info (Name, Mobile, Father) - Solid Black Text, Gray Border -->
            <td style="padding: 7px 8px; width: 190px; border-right: 1px solid #94a3b8; text-align: left; color: #000000;">
              <div style="font-weight: bold; color: #000000; font-size: 11px; line-height: 1.25; margin: 0; padding: 0; text-align: left;">${traineeName}</div>
              <div style="color: #000000; font-size: 9.5px; margin-top: 2px; font-family: monospace; margin: 0; padding: 0; text-align: left;">${mobile}</div>
              <div style="color: #000000; font-size: 9px; margin-top: 1px; margin: 0; padding: 0; text-align: left;">পিতা: ${father}</div>
            </td>

            <!-- 4. Institute & Trade - Solid Black Text, Gray Border -->
            <td style="padding: 7px 8px; width: 190px; border-right: 1px solid #94a3b8; text-align: left; color: #000000;">
              <div style="font-weight: 600; color: #000000; font-size: 10px; line-height: 1.25; margin: 0; padding: 0;">${inst.trim()}</div>
              <div style="color: #000000; font-size: 9.5px; margin-top: 2px; font-weight: 500; margin: 0; padding: 0;">${trd.trim()}</div>
            </td>

            <!-- 5. ID Document & Age - Solid Black Text, Gray Border -->
            <td style="padding: 7px 8px; width: 165px; border-right: 1px solid #94a3b8; text-align: left; color: #000000;">
              <div style="font-weight: bold; font-family: monospace; font-size: 10.5px; color: #000000; letter-spacing: 0.2px; margin: 0; padding: 0;">${docNum}</div>
              <div style="color: #000000; font-size: 9.5px; margin-top: 2px; margin: 0; padding: 0;">জন্ম: <span style="font-family: monospace;">${toBn(dob)}</span></div>
              <div style="color: #000000; font-size: 9px; margin-top: 1px; margin: 0; padding: 0;">বয়স: <strong style="color: #000000;">${age}</strong></div>
            </td>

            <!-- 6. Present Address - Solid Black Text, Gray Border -->
            <td style="padding: 7px 8px; width: 180px; color: #000000; font-size: 9.5px; line-height: 1.35; border-right: 1px solid #94a3b8; text-align: left;">
              ${address}
            </td>

            <!-- 7. Previous Education - Solid Black Text, Gray Border -->
            <td style="padding: 7px 8px; width: 165px; color: #000000; font-size: 9.5px; line-height: 1.3; text-align: left; border-right: 1px solid #94a3b8;">
              <div style="font-weight: 600; color: #000000; margin: 0; padding: 0;">${edu}</div>
              ${dropoutNote ? `<div style="color: #000000; font-size: 8.5px; margin-top: 1px; margin: 0; padding: 0;">${dropoutNote}</div>` : ''}
              ${t.previousSchoolName ? `<div style="color: #000000; font-size: 8.5px; margin-top: 1px; margin: 0; padding: 0;">বিদ্যালয়: ${t.previousSchoolName.trim()}</div>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      // Top metadata bar logic - Solid Black
      let metaBarLeftHtml = '';
      if (singleBatchInfo) {
        metaBarLeftHtml = `
          <div style="display: flex; align-items: center; gap: 4px; font-size: 10px; color: #000000;">
            <strong style="color: #000000; font-size: 10.5px;">ব্যাচ:</strong>
            <span style="font-weight: bold; color: #000000; font-size: 10.5px;">${singleBatchInfo.tradeName}, ${singleBatchInfo.instituteName}</span>
            <span style="margin-left: 8px; color: #000000; font-size: 9.5px;">• মোট শিক্ষার্থী: <strong style="color: #000000;">${toBn(trainees.length)} জন</strong></span>
          </div>
        `;
      } else {
        metaBarLeftHtml = `
          <div style="font-size: 10px; color: #000000;">
            <strong style="color: #000000;">মোট শিক্ষার্থী:</strong>
            <span style="font-weight: bold; color: #000000; margin-left: 3px;">${toBn(trainees.length)} জন</span>
            ${filterDetails ? `<span style="margin-left: 8px; color: #000000;">• ${filterDetails}</span>` : ''}
          </div>
        `;
      }

      pageEl.innerHTML = `
        <div>
          <!-- Header Box - Gray / Light Black Bottom Horizontal Line -->
          <div style="text-align: center; border-bottom: 1.5px solid #94a3b8; padding-bottom: 6px; margin-bottom: 6px;">
            <div style="font-size: 15px; font-weight: 900; color: #000000; letter-spacing: 0.3px;">
              গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
            </div>
            <div style="font-size: 12.5px; font-weight: bold; color: #000000; margin-top: 2px;">
              উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE), প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
            </div>
            <div style="font-size: 12px; font-weight: 800; color: #000000; margin-top: 3px;">
              প্রশিক্ষণার্থী তালিকা (Trainee List Report)
            </div>
          </div>

          <!-- Metadata Summary Bar - Solid Black, No Border -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0px 6px 0px; margin-bottom: 6px; font-size: 10px; color: #000000;">
            ${metaBarLeftHtml}
            <div style="color: #000000; font-size: 9.5px;">
              <strong>তারিখ:</strong> ${dateNowBn}
            </div>
          </div>

          <!-- Main Table - Gray / Light Black Borders (#94a3b8) and Solid Black Text -->
          <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #94a3b8; background-color: #ffffff; table-layout: fixed; box-sizing: border-box;">
            <thead>
              <tr style="background-color: #ffffff; color: #000000; font-size: 9.5px; text-align: left; font-weight: bold; border-bottom: 1.5px solid #94a3b8;">
                <th style="padding: 7px 5px; text-align: center; border: 1px solid #94a3b8; width: 40px; color: #000000;">ক্রমিক</th>
                <th style="padding: 7px 8px; border: 1px solid #94a3b8; width: 120px; color: #000000;">আইডি ও রেজিঃ</th>
                <th style="padding: 7px 8px; border: 1px solid #94a3b8; width: 190px; color: #000000;">প্রশিক্ষণার্থী (নাম ও যোগাযোগ)</th>
                <th style="padding: 7px 8px; border: 1px solid #94a3b8; width: 190px; color: #000000;">প্রতিষ্ঠান ও ট্রেড</th>
                <th style="padding: 7px 8px; border: 1px solid #94a3b8; width: 165px; color: #000000;">পরিচয়পত্র ও বয়স</th>
                <th style="padding: 7px 8px; border: 1px solid #94a3b8; width: 180px; color: #000000;">বর্তমান ঠিকানা</th>
                <th style="padding: 7px 8px; border: 1px solid #94a3b8; width: 165px; color: #000000;">পূর্ববর্তী শিক্ষা</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Footer Bar with Preparer Name, Timestamp, Note and Page Number - Gray Border -->
        <div style="margin-top: 12px; border-top: 1px solid #94a3b8; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #000000;">
          <div>
            * BNFE প্রশিক্ষণার্থী তথ্য ব্যবস্থাপনা সিস্টেম হতে প্রস্তুতকৃত
          </div>
          <div>
            <strong>প্রস্তুতকারী:</strong> ${generatedBy}
            <span style="margin: 0 5px; color: #94a3b8;">|</span>
            মুদ্রণের সময়: ${dateNowBn}, ${timeNowBn}
          </div>
          <div style="font-weight: bold; color: #000000; font-size: 9.5px;">
            পৃষ্ঠা ${toBn(pageIdx + 1)} এর ${toBn(totalPages)}
          </div>
        </div>
      `;

      container.replaceChildren(pageEl);

      // Render DOM element to canvas via html2canvas with scale: 2 for ultra crisp borders
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Calculate dimensions in mm for A4 landscape (297mm x 210mm)
      // Exactly 12mm left and 12mm right margins: (297 - 273) / 2 = 12mm
      // Together with 25px container padding, right border is completely protected from clipping
      const imgWidthMm = 273;
      const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;
      const leftOffsetMm = 12;
      const topOffsetMm = 10;

      if (pageIdx === 0) {
        pdf.addImage(imgData, 'JPEG', leftOffsetMm, topOffsetMm, imgWidthMm, imgHeightMm, undefined, 'FAST');
      } else {
        pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', leftOffsetMm, topOffsetMm, imgWidthMm, imgHeightMm, undefined, 'FAST');
      }

      const endPercent = Math.round(8 + (curPage / totalPages) * 78);
      if (onProgress) {
        onProgress(curPage, totalPages, `পৃষ্ঠা ${toBn(curPage)} / ${toBn(totalPages)} প্রস্তুত সম্পন্ন`, endPercent);
      }
      await new Promise(r => setTimeout(r, 40));
    }

    if (onProgress) {
      onProgress(totalPages, totalPages, 'পিডিএফ ফাইল তৈরি ও কম্প্রেস সম্পন্ন হচ্ছে...', 92);
      await new Promise(r => setTimeout(r, 120));
    }

    const pdfBlob = pdf.output('blob');

    if (onProgress) {
      onProgress(totalPages, totalPages, 'ডাউনলোড প্রস্তুত হচ্ছে...', 100);
      await new Promise(r => setTimeout(r, 80));
    }

    return pdfBlob;
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
