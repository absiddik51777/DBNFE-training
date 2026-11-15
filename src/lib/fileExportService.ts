import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type ExportFileCategory =
  | 'pdf'
  | 'excel'
  | 'csv'
  | 'text'
  | 'template'
  | 'document';

export interface FileExportInput {
  fileName: string;
  content: Blob | ArrayBuffer | Uint8Array | string;
  mimeType: string;
  category?: ExportFileCategory;
  title?: string;
}

export interface FileExportResult {
  success: boolean;
  cancelled?: boolean;
  fileName: string;
  savedPath?: string;
  uri?: string;
  platform: 'android' | 'ios' | 'web';
  method: string;
  message: string;
  error?: string;
}

const activeExportLocks = new Set<string>();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function saveFile(fileName: string, blob: Blob) {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const data = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data,
    directory: Directory.Cache,
  });
  await Share.share({ title: fileName, url: uri });
}

export function getRuntimePlatform(): 'android' | 'ios' | 'web' {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
}

export function isNativeCapacitorApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function sanitizeExportFileName(rawName: string, fallback = 'BNFE_Export'): string {
  const trimmed = (rawName || '').trim();
  const safe = (trimmed || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/^\.+/, '');
  return safe || `${fallback}_${Date.now()}`;
}

export function isExportLocked(fileName: string): boolean {
  return activeExportLocks.has(sanitizeExportFileName(fileName).toLowerCase());
}

function normalizeContentToBlob(
  content: Blob | ArrayBuffer | Uint8Array | string,
  mimeType: string
): Blob {
  if (content instanceof Blob) {
    return content.type === mimeType ? content : new Blob([content], { type: mimeType });
  }
  if (content instanceof Uint8Array) {
    const copy = new Uint8Array(content.byteLength);
    copy.set(content);
    return new Blob([copy.buffer], { type: mimeType });
  }
  return new Blob([content], { type: mimeType });
}

function extractReadableError(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: string; errorMessage?: string };
    const msg = anyErr.errorMessage || anyErr.message || '';
    if (msg.trim()) return msg.trim();
  }
  if (typeof err === 'string' && err.trim()) return err.trim();
  return 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
}

function isCancelError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { name?: string; message?: string };
  if (anyErr.name === 'AbortError') return true;
  const msg = (anyErr.message || String(err)).toLowerCase();
  return (
    msg.includes('cancel') ||
    msg.includes('canceled') ||
    msg.includes('cancelled') ||
    msg.includes('dismiss')
  );
}

/**
 * Primary centralized export & download API across Web Browsers and Capacitor Native Apps.
 * Delegates all actual file saving/sharing to saveFile(fileName, blob).
 */
export async function saveFileToDevice(input: FileExportInput): Promise<FileExportResult> {
  const platform = getRuntimePlatform();
  const safeFileName = sanitizeExportFileName(input.fileName);
  const lockKey = safeFileName.toLowerCase();

  if (activeExportLocks.has(lockKey)) {
    return {
      success: false,
      fileName: safeFileName,
      platform,
      method: 'locked',
      message: 'এই ফাইলটি সংরক্ষণ প্রক্রিয়াধীন রয়েছে, অনুগ্রহ করে একটু অপেক্ষা করুন।'
    };
  }

  activeExportLocks.add(lockKey);

  try {
    const blob = normalizeContentToBlob(input.content, input.mimeType);
    if (blob.size === 0) {
      throw new Error('তৈরিকৃত ফাইলটি খালি পাওয়া গেছে।');
    }

    await saveFile(safeFileName, blob);

    const native = isNativeCapacitorApp();
    return {
      success: true,
      fileName: safeFileName,
      platform,
      method: native ? 'capacitor_filesystem_share' : 'web_blob_anchor',
      message: native
        ? `ফাইলটি সংরক্ষণ ও শেয়ারের জন্য প্রস্তুত হয়েছে: ${safeFileName}`
        : `ফাইলটি সফলভাবে ডাউনলোড হয়েছে: ${safeFileName}`
    };
  } catch (err) {
    if (isCancelError(err)) {
      return {
        success: false,
        cancelled: true,
        fileName: safeFileName,
        platform,
        method: 'share_cancelled',
        message: 'ফাইল সংরক্ষণ / শেয়ার বাতিল করা হয়েছে।'
      };
    }

    console.error(`[FileExportService] Failed to save ${safeFileName}:`, err);
    const errMsg = extractReadableError(err);
    return {
      success: false,
      fileName: safeFileName,
      platform,
      method: isNativeCapacitorApp() ? 'native_export_error' : 'web_download_error',
      message:
        errMsg.includes('ফাইল') || errMsg.includes('ডিভাইস')
          ? errMsg
          : 'ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: errMsg
    };
  } finally {
    activeExportLocks.delete(lockKey);
  }
}

/**
 * Convenience helper for saving UTF-8 text or template files.
 */
export async function saveTextFile(
  fileName: string,
  textContent: string,
  mimeType = 'text/plain;charset=utf-8;',
  category: ExportFileCategory = 'text'
): Promise<FileExportResult> {
  const blob = new Blob([textContent], { type: mimeType });
  return saveFileToDevice({
    fileName,
    content: blob,
    mimeType,
    category
  });
}

/**
 * Convenience helper for saving CSV files with guaranteed UTF-8 BOM (\uFEFF) for Bengali Excel compatibility.
 */
export async function saveCsvFile(
  fileName: string,
  csvContent: string,
  category: ExportFileCategory = 'csv'
): Promise<FileExportResult> {
  const safeName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
  const withBom = csvContent.startsWith('\uFEFF') ? csvContent : `\uFEFF${csvContent}`;
  const blob = new Blob([withBom], { type: 'text/csv' });
  return saveFileToDevice({
    fileName: safeName,
    content: blob,
    mimeType: 'text/csv',
    category
  });
}

/**
 * Shares/saves an exported document using saveFile(fileName, blob).
 */
export async function shareExportedFile(input: FileExportInput): Promise<FileExportResult> {
  return saveFileToDevice(input);
}

/**
 * Renders an HTML element into a paginated A4 jsPDF Blob using html2canvas + jsPDF.
 */
async function renderElementToPdfBlob(
  element: HTMLElement,
  options: { landscape?: boolean; cloneLightMode?: boolean } = {}
): Promise<Blob> {
  const landscape = options.landscape ?? false;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    ignoreElements: (el) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      if (el.classList.contains('print:hidden')) return true;
      if (el.getAttribute('role') === 'status') return true;
      return false;
    },
    onclone: (clonedDoc, clonedEl) => {
      if (options.cloneLightMode) {
        clonedDoc.documentElement.classList.remove('dark');
        clonedDoc.documentElement.setAttribute('data-theme', 'light');
      }
      clonedEl.querySelectorAll('[class*="print:hidden"]').forEach((node) => {
        (node as HTMLElement).style.display = 'none';
      });
      clonedEl.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-hidden').forEach((node) => {
        const htmlNode = node as HTMLElement;
        htmlNode.style.overflow = 'visible';
        htmlNode.style.maxHeight = 'none';
      });
      clonedEl.style.backgroundColor = '#ffffff';
      clonedEl.style.color = '#0f172a';
    }
  });

  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const marginMm = 10;
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;

  const pageSliceHeightPx = Math.floor((canvas.width * contentHeightMm) / contentWidthMm);
  const totalHeightPx = canvas.height;

  if (totalHeightPx <= pageSliceHeightPx || pageSliceHeightPx <= 0) {
    const imgWidthMm = contentWidthMm;
    const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', marginMm, marginMm, imgWidthMm, imgHeightMm, undefined, 'FAST');
    return pdf.output('blob');
  }

  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < totalHeightPx) {
    const sliceHeight = Math.min(pageSliceHeightPx, totalHeightPx - offsetY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );
    }

    const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.94);
    const sliceImgHeightMm = (sliceHeight / canvas.width) * contentWidthMm;

    if (pageIndex > 0) {
      pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
    }
    pdf.addImage(
      sliceImgData,
      'JPEG',
      marginMm,
      marginMm,
      contentWidthMm,
      sliceImgHeightMm,
      undefined,
      'FAST'
    );

    offsetY += sliceHeight;
    pageIndex++;
  }

  return pdf.output('blob');
}

/**
 * Generates a PDF file from the current visible document (excluding .print:hidden UI controls)
 * using jsPDF + html2canvas and saves/shares it via saveFile(fileName, blob).
 */
export async function printCurrentDocument(options?: {
  jobName?: string;
  landscape?: boolean;
}): Promise<FileExportResult> {
  const platform = getRuntimePlatform();
  const baseName = sanitizeExportFileName(options?.jobName || 'BNFE_Document');
  const pdfFileName = baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;

  try {
    if (typeof document === 'undefined') {
      throw new Error('পিডিএফ সেবা উপলব্ধ নয়।');
    }

    const targetEl =
      (document.querySelector('main') as HTMLElement | null) || document.body;

    const pdfBlob = await renderElementToPdfBlob(targetEl, {
      landscape: options?.landscape ?? false,
      cloneLightMode: true
    });

    return await saveFileToDevice({
      fileName: pdfFileName,
      content: pdfBlob,
      mimeType: 'application/pdf',
      category: 'pdf',
      title: options?.jobName || 'BNFE Document'
    });
  } catch (err) {
    const errMsg = extractReadableError(err);
    console.error('[FileExportService] printCurrentDocument failed:', err);
    return {
      success: false,
      fileName: pdfFileName,
      platform,
      method: 'pdf_error',
      message: 'পিডিএফ ফাইল তৈরি বা সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: errMsg
    };
  }
}

/**
 * Renders custom HTML report content into a PDF Blob via jsPDF and saves/shares via saveFile(fileName, blob).
 */
export async function printCustomHtmlDocument(options: {
  html: string;
  jobName?: string;
  landscape?: boolean;
  iframeId?: string;
}): Promise<FileExportResult> {
  const platform = getRuntimePlatform();
  const baseName = sanitizeExportFileName(options.jobName || 'BNFE_Report');
  const pdfFileName = baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = options.landscape ? '1140px' : '820px';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-999';

  try {
    const cleanHtml = options.html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const parsed = new DOMParser().parseFromString(cleanHtml, 'text/html');
    const styleTags = Array.from(parsed.querySelectorAll('style'))
      .map((s) => s.outerHTML)
      .join('\n');
    container.innerHTML = `${styleTags}<div class="bnfe-custom-pdf-root">${parsed.body?.innerHTML || cleanHtml}</div>`;
    document.body.appendChild(container);

    const pdfBlob = await renderElementToPdfBlob(container, {
      landscape: options.landscape ?? true,
      cloneLightMode: false
    });

    return await saveFileToDevice({
      fileName: pdfFileName,
      content: pdfBlob,
      mimeType: 'application/pdf',
      category: 'pdf',
      title: options.jobName || 'BNFE Report'
    });
  } catch (err) {
    const errMsg = extractReadableError(err);
    console.error('[FileExportService] printCustomHtmlDocument failed:', err);
    return {
      success: false,
      fileName: pdfFileName,
      platform,
      method: 'pdf_error',
      message: 'পিডিএফ ফাইল তৈরি বা সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: errMsg
    };
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
