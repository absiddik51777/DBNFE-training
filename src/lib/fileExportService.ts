import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { FileDownload } from '@bnfe/file-download';

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

const MAX_DIRECT_SAVE_BYTES = 768 * 1024; // 768 KB
const CHUNK_SIZE_BYTES = 393216; // 384 KB (exact multiple of 3 for clean Base64 chunks)
const activeExportLocks = new Set<string>();

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

/**
 * Encodes a Uint8Array cleanly to Base64 without stack overflow on large binaries
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const SLICE_SIZE = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += SLICE_SIZE) {
    const sub = bytes.subarray(i, Math.min(i + SLICE_SIZE, bytes.length));
    parts.push(String.fromCharCode(...sub));
  }
  return btoa(parts.join(''));
}

async function normalizeContentToBytes(
  content: Blob | ArrayBuffer | Uint8Array | string
): Promise<Uint8Array> {
  if (typeof content === 'string') {
    return new TextEncoder().encode(content);
  }
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (content instanceof Blob) {
    const buf = await content.arrayBuffer();
    return new Uint8Array(buf);
  }
  throw new Error('অসমর্থিত ফাইল ফরম্যাট (Unsupported content type)');
}

function normalizeContentToBlob(
  content: Blob | ArrayBuffer | Uint8Array | string,
  mimeType: string
): Blob {
  if (content instanceof Blob) {
    return content.type === mimeType ? content : new Blob([content], { type: mimeType });
  }
  if (content instanceof Uint8Array) {
    // Copy into fresh ArrayBuffer slice to satisfy strict TS BlobPart types
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
  return msg.includes('cancel') || msg.includes('canceled') || msg.includes('cancelled') || msg.includes('dismiss');
}

async function saveViaNativeAndroid(
  safeFileName: string,
  mimeType: string,
  content: Blob | ArrayBuffer | Uint8Array | string,
  destination: 'downloads' | 'cache'
): Promise<{ fileName: string; uri: string; relativePath: string }> {
  // Handle Blob in chunks directly without holding multiple giant strings in memory
  if (content instanceof Blob && content.size > MAX_DIRECT_SAVE_BYTES) {
    if (content.size === 0) {
      throw new Error('তৈরিকৃত ফাইলটি খালি পাওয়া গেছে।');
    }
    const { uploadId, fileName } = await FileDownload.startChunkedSave({
      fileName: safeFileName,
      mimeType,
      destination
    });

    try {
      let offset = 0;
      while (offset < content.size) {
        const end = Math.min(offset + CHUNK_SIZE_BYTES, content.size);
        const sliceBuf = await content.slice(offset, end).arrayBuffer();
        const base64Chunk = uint8ArrayToBase64(new Uint8Array(sliceBuf));
        await FileDownload.appendChunk({ uploadId, base64Chunk });
        offset = end;
      }
      const finalRes = await FileDownload.finishChunkedSave({ uploadId });
      return {
        fileName: finalRes.fileName || fileName,
        uri: finalRes.uri,
        relativePath: finalRes.relativePath
      };
    } catch (err) {
      await FileDownload.abortChunkedSave({ uploadId }).catch(() => {});
      throw err;
    }
  }

  const bytes = await normalizeContentToBytes(content);
  if (bytes.byteLength === 0) {
    throw new Error('তৈরিকৃত ফাইলটি খালি পাওয়া গেছে।');
  }

  if (bytes.byteLength > MAX_DIRECT_SAVE_BYTES) {
    const { uploadId, fileName } = await FileDownload.startChunkedSave({
      fileName: safeFileName,
      mimeType,
      destination
    });

    try {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const end = Math.min(offset + CHUNK_SIZE_BYTES, bytes.byteLength);
        const base64Chunk = uint8ArrayToBase64(bytes.subarray(offset, end));
        await FileDownload.appendChunk({ uploadId, base64Chunk });
        offset = end;
      }
      const finalRes = await FileDownload.finishChunkedSave({ uploadId });
      return {
        fileName: finalRes.fileName || fileName,
        uri: finalRes.uri,
        relativePath: finalRes.relativePath
      };
    } catch (err) {
      await FileDownload.abortChunkedSave({ uploadId }).catch(() => {});
      throw err;
    }
  }

  const base64Data = uint8ArrayToBase64(bytes);
  const res = await FileDownload.saveFile({
    fileName: safeFileName,
    mimeType,
    base64Data,
    destination
  });

  return {
    fileName: res.fileName || safeFileName,
    uri: res.uri,
    relativePath: res.relativePath
  };
}

function triggerWebBlobDownload(blob: Blob, safeFileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    try {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    } catch {
      // ignore DOM detach race
    }
    URL.revokeObjectURL(url);
  }, 4000);
}

/**
 * Primary centralized export & download API across Web Browsers and Capacitor Android APK.
 * On Android APK: Saves directly to the public Downloads folder via Android MediaStore.
 * On Web Browser: Preserves standard Blob URL anchor download with clean revocation.
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
    if (isNativeAndroidApp()) {
      const saved = await saveViaNativeAndroid(
        safeFileName,
        input.mimeType,
        input.content,
        'downloads'
      );

      return {
        success: true,
        fileName: saved.fileName,
        savedPath: saved.relativePath,
        uri: saved.uri,
        platform: 'android',
        method: 'android_mediastore_downloads',
        message: `ফাইলটি সফলভাবে Downloads ফোল্ডারে সংরক্ষণ করা হয়েছে: ${saved.fileName}`
      };
    }

    // Native iOS fallback via share sheet if ever bundled for iOS
    if (isNativeCapacitorApp() && platform === 'ios') {
      return await shareExportedFile(input);
    }

    // Standard Web Browser Download
    const blob = normalizeContentToBlob(input.content, input.mimeType);
    if (blob.size === 0) {
      throw new Error('তৈরিকৃত ফাইলটি খালি পাওয়া গেছে।');
    }

    triggerWebBlobDownload(blob, safeFileName);

    return {
      success: true,
      fileName: safeFileName,
      platform: 'web',
      method: 'web_blob_anchor',
      message: `ফাইলটি সফলভাবে ডাউনলোড হয়েছে: ${safeFileName}`
    };
  } catch (err) {
    console.error(`[FileExportService] Failed to save ${safeFileName}:`, err);
    const errMsg = extractReadableError(err);
    return {
      success: false,
      fileName: safeFileName,
      platform,
      method: isNativeAndroidApp() ? 'android_mediastore_error' : 'web_download_error',
      message: errMsg.includes('ফাইল') || errMsg.includes('ডিভাইস')
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
  return saveFileToDevice({
    fileName,
    content: textContent,
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
  return saveFileToDevice({
    fileName: safeName,
    content: withBom,
    mimeType: 'text/csv;charset=utf-8;',
    category
  });
}

/**
 * Shares an exported document via Android/iOS native Share sheet (using cached file:// URI)
 * or browser Web Share API. Explicitly detects user cancellation and never treats cancel as success.
 */
export async function shareExportedFile(input: FileExportInput): Promise<FileExportResult> {
  const platform = getRuntimePlatform();
  const safeFileName = sanitizeExportFileName(input.fileName);

  try {
    if (isNativeCapacitorApp()) {
      const cached = await saveViaNativeAndroid(
        safeFileName,
        input.mimeType,
        input.content,
        'cache'
      );

      await Share.share({
        title: input.title || safeFileName,
        text: input.title ? `${input.title} (${safeFileName})` : safeFileName,
        files: [cached.uri],
        dialogTitle: input.title || 'ফাইল শেয়ার করুন'
      });

      return {
        success: true,
        fileName: cached.fileName,
        uri: cached.uri,
        savedPath: cached.relativePath,
        platform,
        method: 'capacitor_share',
        message: `ফাইলটি সফলভাবে শেয়ার করা হয়েছে: ${cached.fileName}`
      };
    }

    // Web Share API check
    const blob = normalizeContentToBlob(input.content, input.mimeType);
    if (typeof navigator !== 'undefined' && navigator.share && typeof File !== 'undefined') {
      const file = new File([blob], safeFileName, { type: input.mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: input.title || safeFileName,
          text: `${input.title || safeFileName}`
        });
        return {
          success: true,
          fileName: safeFileName,
          platform: 'web',
          method: 'web_share_api',
          message: `ফাইলটি সফলভাবে শেয়ার করা হয়েছে: ${safeFileName}`
        };
      }
    }

    // Fallback to standard download on desktop browsers without file share support
    return await saveFileToDevice(input);
  } catch (err) {
    if (isCancelError(err)) {
      return {
        success: false,
        cancelled: true,
        fileName: safeFileName,
        platform,
        method: 'share_cancelled',
        message: 'ফাইল শেয়ার করা বাতিল করা হয়েছে।'
      };
    }

    const errMsg = extractReadableError(err);
    console.error(`[FileExportService] Share failed for ${safeFileName}:`, err);
    return {
      success: false,
      fileName: safeFileName,
      platform,
      method: 'share_error',
      message: 'ফাইল শেয়ার করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: errMsg
    };
  }
}

/**
 * Triggers printing cleanly across both Web browser (window.print)
 * and Capacitor Android APK (Android PrintManager PrintDocumentAdapter).
 */
export async function printCurrentDocument(options?: {
  jobName?: string;
  landscape?: boolean;
}): Promise<FileExportResult> {
  const platform = getRuntimePlatform();
  const jobName = options?.jobName || 'BNFE Document';

  try {
    if (isNativeAndroidApp()) {
      const res = await FileDownload.printCurrentView({
        jobName,
        landscape: options?.landscape ?? false
      });
      return {
        success: res.success,
        fileName: res.jobName || jobName,
        platform: 'android',
        method: 'android_print_manager',
        message: 'প্রিন্ট / PDF সংরক্ষণ ডায়ালগ খোলা হয়েছে।'
      };
    }

    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return {
        success: true,
        fileName: jobName,
        platform: 'web',
        method: 'web_window_print',
        message: 'প্রিন্ট ডায়ালগ খোলা হয়েছে।'
      };
    }

    throw new Error('প্রিন্ট সেবা উপলব্ধ নয়।');
  } catch (err) {
    const errMsg = extractReadableError(err);
    console.error('[FileExportService] printCurrentDocument failed:', err);
    return {
      success: false,
      fileName: jobName,
      platform,
      method: 'print_error',
      message: 'প্রিন্ট ডায়ালগ খোলা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: errMsg
    };
  }
}

/**
 * Prints custom HTML report content across Web (invisible iframe) and Android APK (native WebView PrintManager).
 */
export async function printCustomHtmlDocument(options: {
  html: string;
  jobName?: string;
  landscape?: boolean;
  iframeId?: string;
}): Promise<FileExportResult> {
  const platform = getRuntimePlatform();
  const jobName = options.jobName || 'BNFE Report';

  try {
    if (isNativeAndroidApp()) {
      const cleanHtml = options.html.replace(/<script[\s\S]*?<\/script>/gi, '');
      const res = await FileDownload.printHtml({
        html: cleanHtml,
        jobName,
        landscape: options.landscape ?? true
      });
      return {
        success: res.success,
        fileName: res.jobName || jobName,
        platform: 'android',
        method: 'android_print_html',
        message: 'প্রিন্ট ডায়ালগ খোলা হয়েছে।'
      };
    }

    const frameId = options.iframeId || 'bnfe-print-iframe';
    let printFrame = document.getElementById(frameId) as HTMLIFrameElement | null;
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = frameId;
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc || !printFrame.contentWindow) {
      throw new Error('প্রিন্ট ফ্রেম তৈরি করা যায়নি।');
    }

    const targetWin = printFrame.contentWindow;
    const htmlWithoutAutoScript = options.html.replace(/<script[\s\S]*?<\/script>/gi, '');

    await new Promise<void>((resolve) => {
      let triggered = false;
      const triggerPrint = () => {
        if (triggered) return;
        triggered = true;
        setTimeout(() => {
          try {
            targetWin.focus();
            targetWin.print();
          } finally {
            resolve();
          }
        }, 250);
      };

      printFrame!.onload = triggerPrint;
      frameDoc.open();
      frameDoc.write(htmlWithoutAutoScript);
      frameDoc.close();
      // Safety fallback in case onload doesn't fire synchronously for document.write
      setTimeout(triggerPrint, 450);
    });

    return {
      success: true,
      fileName: jobName,
      platform: 'web',
      method: 'web_iframe_print',
      message: 'প্রিন্ট ডায়ালগ খোলা হয়েছে।'
    };
  } catch (err) {
    const errMsg = extractReadableError(err);
    console.error('[FileExportService] printCustomHtmlDocument failed:', err);
    return {
      success: false,
      fileName: jobName,
      platform,
      method: 'print_error',
      message: 'প্রিন্ট ডায়ালগ খোলা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: errMsg
    };
  }
}
