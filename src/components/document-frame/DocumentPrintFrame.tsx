import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  Download,
  FileCode2,
  FileText,
  Loader2,
  Printer,
  Settings,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { safeHtml2Canvas } from '../../lib/safeHtml2Canvas';
import type { DocumentPrintConfig, WeeklySignatureHeading } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getAppFontCssStack, getGoogleFontsStylesheetUrl } from '../../lib/theme';
import {
  DEFAULT_SHEET_PAGE_CONFIG,
  PX_PER_MM,
  computeSheetPageSlices,
  getPaperDimensionsMm,
  toBnDigits,
  type SheetPageSlice,
} from '../weekly-signature/utils';
import { saveFile } from '../../lib/fileExportService';
import {
  normalizeDocumentPrintConfig,
  type ExtractedTableSpec,
} from '../../lib/documentFrameService';
import { DocumentSettingsModal } from './DocumentSettingsModal';

export interface ExtraDownloadItem {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => Promise<void> | void;
}

export interface DocumentRenderContext {
  config: DocumentPrintConfig;
  scale: number;
  px: (basePx: number) => string;
}

export interface DocumentTableRenderContext extends DocumentRenderContext {
  rowIndices: number[];
  includeTableFooter: boolean;
}

interface DocumentPrintFrameProps {
  documentTitle: string;
  fileNamePrefix: string;
  config: DocumentPrintConfig;
  defaultOrientation?: 'portrait' | 'landscape';
  onConfigChange: (next: DocumentPrintConfig) => Promise<void> | void;

  heading?: WeeklySignatureHeading;
  defaultHeading?: WeeklySignatureHeading;
  onHeadingChange?: (next: WeeklySignatureHeading) => Promise<void> | void;

  supportsSignatures?: boolean;
  supportsGeneratedDate?: boolean;

  // Structured mode (React JSX)
  rowCount?: number;
  renderHeader?: (ctx: DocumentRenderContext) => React.ReactNode;
  renderTable?: (ctx: DocumentTableRenderContext) => React.ReactNode;
  renderFooter?: (ctx: DocumentRenderContext) => React.ReactNode;

  // Extracted HTML / DOM mode (used by GlobalDocumentPrintHost)
  extractedHeaderHtml?: string;
  extractedTableSpec?: ExtractedTableSpec | null;
  extractedFooterHtml?: string;
  extractedBlocksHtml?: string[];
  customScopeCss?: string;
  lightReset?: boolean;

  // Re-pagination key
  measureKey?: string | number;

  // Extra controls & downloads
  toolbarLeftExtra?: React.ReactNode;
  toolbarRightExtra?: React.ReactNode;
  extraDownloadItems?: ExtraDownloadItem[];
  canExport?: boolean;
  workspaceMaxHeightClass?: string;
  printActionRef?: React.MutableRefObject<(() => void) | null>;

  onNotify?: (toast: { type: 'success' | 'error'; message: string }) => void;
}

function slicesEqual(a: SheetPageSlice[], b: SheetPageSlice[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i];
    const sb = b[i];
    if (
      sa.includeHeader !== sb.includeHeader ||
      sa.includeTable !== sb.includeTable ||
      sa.includeFooter !== sb.includeFooter ||
      sa.rowIndices.length !== sb.rowIndices.length
    ) {
      return false;
    }
    for (let j = 0; j < sa.rowIndices.length; j++) {
      if (sa.rowIndices[j] !== sb.rowIndices[j]) return false;
    }
  }
  return true;
}

function blockSlicesEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExtractedTableMarkup(
  spec: ExtractedTableSpec,
  rowIndices: number[],
  includeTableFooter: boolean
): string {
  const rowsMarkup = rowIndices.map((idx) => spec.rowHtmls[idx] || '').join('\n');
  return `<table class="${escapeHtml(spec.tableClass)} w-full" style="${escapeHtml(
    spec.tableStyle
  )};width:100%;">
    ${spec.colgroupHtml}
    ${spec.theadHtml}
    <tbody class="${escapeHtml(spec.tbodyClass)}">${rowsMarkup}</tbody>
    ${includeTableFooter ? spec.tfootHtml : ''}
  </table>`;
}

export const DocumentPrintFrame: React.FC<DocumentPrintFrameProps> = ({
  documentTitle,
  fileNamePrefix,
  config: rawConfig,
  defaultOrientation = 'portrait',
  onConfigChange,
  heading,
  defaultHeading,
  onHeadingChange,
  supportsSignatures = false,
  supportsGeneratedDate = false,
  rowCount = 0,
  renderHeader,
  renderTable,
  renderFooter,
  extractedHeaderHtml,
  extractedTableSpec,
  extractedFooterHtml,
  extractedBlocksHtml,
  customScopeCss,
  lightReset = false,
  measureKey,
  toolbarLeftExtra,
  toolbarRightExtra,
  extraDownloadItems = [],
  canExport = true,
  workspaceMaxHeightClass = 'max-h-[76vh]',
  printActionRef,
  onNotify,
}) => {
  const frameId = useId().replace(/:/g, '_');
  const { fontFamily: globalFont } = useTheme();
  const config = useMemo(
    () => normalizeDocumentPrintConfig(rawConfig, defaultOrientation),
    [rawConfig, defaultOrientation]
  );

  const dims = useMemo(
    () => getPaperDimensionsMm(config.paperSize, config.orientation),
    [config.paperSize, config.orientation]
  );
  const fontCssStack = useMemo(() => getAppFontCssStack(globalFont), [globalFont]);
  const scale = config.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;
  const px = useCallback((basePx: number) => `${(basePx * scale).toFixed(2)}px`, [scale]);

  const paperWidthPx = Math.round(dims.widthMm * PX_PER_MM);
  const paperHeightPx = Math.round(dims.heightMm * PX_PER_MM);
  const padTopPx = Math.round(config.margins.top * PX_PER_MM);
  const padRightPx = Math.round(config.margins.right * PX_PER_MM);
  const padBottomPx = Math.round(config.margins.bottom * PX_PER_MM);
  const padLeftPx = Math.round(config.margins.left * PX_PER_MM);

  const usableWidthPx = Math.max(200, paperWidthPx - padLeftPx - padRightPx);
  const usableHeightPx = Math.max(180, paperHeightPx - padTopPx - padBottomPx);

  const isBlocksMode =
    !renderTable && !extractedTableSpec && Boolean(extractedBlocksHtml?.length);
  const effectiveRowCount = extractedTableSpec
    ? extractedTableSpec.rowHtmls.length
    : rowCount;

  // Refs for frame, viewport, measurement, and rendered paper stack
  const frameRootRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const [stackHeight, setStackHeight] = useState<number>(paperHeightPx);
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [manualZoom, setManualZoom] = useState<number>(1);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [generating, setGenerating] = useState<'pdf' | 'html' | string | null>(null);

  const defaultSlices = useMemo<SheetPageSlice[]>(
    () => [
      {
        rowIndices: Array.from({ length: effectiveRowCount }, (_, i) => i),
        includeHeader: true,
        includeTable: Boolean(renderTable || extractedTableSpec),
        includeFooter: true,
      },
    ],
    [effectiveRowCount, renderTable, extractedTableSpec]
  );

  const [tablePages, setTablePages] = useState<SheetPageSlice[]>(defaultSlices);
  const [blockPages, setBlockPages] = useState<number[][]>(() =>
    extractedBlocksHtml?.length ? [extractedBlocksHtml.map((_, i) => i)] : [[]]
  );

  useEffect(() => {
    setTablePages(defaultSlices);
  }, [defaultSlices]);

  useEffect(() => {
    if (extractedBlocksHtml?.length) {
      setBlockPages([extractedBlocksHtml.map((_, i) => i)]);
    } else {
      setBlockPages([[]]);
    }
  }, [extractedBlocksHtml]);

  // Measure workspace width for Fit zoom
  useEffect(() => {
    const vp = workspaceRef.current;
    if (!vp) return;
    const measure = () => {
      // Subtract workspace horizontal padding (~32px-48px)
      const pad = window.innerWidth >= 640 ? 48 : 28;
      const next = Math.max(220, vp.clientWidth - pad);
      setAvailableWidth(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  // Measure hidden unsplit content & paginate across pages
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;

    const calculate = () => {
      if (isBlocksMode) {
        const blockEls = Array.from(root.querySelectorAll(':scope > .doc-measure-block')) as HTMLElement[];
        if (blockEls.length === 0) {
          setBlockPages([[]]);
          return;
        }
        const heights = blockEls.map((el) => {
          const cs = window.getComputedStyle(el);
          return (
            el.offsetHeight +
            (parseFloat(cs.marginTop) || 0) +
            (parseFloat(cs.marginBottom) || 0)
          );
        });

        const pack = (reserveBottom: number): number[][] => {
          const limit = Math.max(120, usableHeightPx - reserveBottom - 6);
          const pagesOut: number[][] = [[]];
          let used = 0;
          for (let i = 0; i < heights.length; i++) {
            const cur = pagesOut[pagesOut.length - 1];
            if (cur.length > 0 && used + heights[i] > limit) {
              pagesOut.push([i]);
              used = heights[i];
            } else {
              cur.push(i);
              used += heights[i];
            }
          }
          return pagesOut;
        };

        const firstPass = pack(0);
        const finalPass =
          firstPass.length > 1 && config.showPageNumbers ? pack(30) : firstPass;
        setBlockPages((prev) => (blockSlicesEqual(prev, finalPass) ? prev : finalPass));
        return;
      }

      const headerWrap = root.querySelector('.doc-measure-header') as HTMLElement | null;
      const tableWrap = root.querySelector('.doc-measure-table') as HTMLElement | null;
      const footerWrap = root.querySelector('.doc-measure-footer') as HTMLElement | null;

      const tableEl = tableWrap?.querySelector('table') as HTMLTableElement | null;
      const theadEl = tableEl?.querySelector(':scope > thead') as HTMLElement | null;
      const tfootEl = tableEl?.querySelector(':scope > tfoot') as HTMLElement | null;
      const tbodyRows =
        effectiveRowCount > 0 && tableEl
          ? Array.from(tableEl.querySelectorAll(':scope > tbody > tr'))
          : [];

      const topExtrasH = headerWrap ? headerWrap.offsetHeight : 0;
      const theadH = theadEl ? theadEl.offsetHeight : 38;
      const tfootH = tfootEl ? tfootEl.offsetHeight : 0;
      const rowHeights = tbodyRows.map((tr) => (tr as HTMLElement).offsetHeight || 28);
      const footerH = (footerWrap ? footerWrap.offsetHeight + 12 : 0) + tfootH;

      const nextSlices = computeSheetPageSlices({
        usableHeightPx,
        topExtrasH,
        theadH,
        rowHeights,
        footerH,
        pageNumberFooterH: config.showPageNumbers ? 30 : 0,
        repeatHeaderOnAllPages: config.repeatHeaderOnAllPages,
      });

      setTablePages((prev) => (slicesEqual(prev, nextSlices) ? prev : nextSlices));
    };

    calculate();

    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) calculate();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    isBlocksMode,
    effectiveRowCount,
    usableWidthPx,
    usableHeightPx,
    config.repeatHeaderOnAllPages,
    config.showPageNumbers,
    config.showSignatures,
    config.showGeneratedDate,
    globalFont,
    config.fontSizePt,
    measureKey,
    extractedHeaderHtml,
    extractedTableSpec,
    extractedFooterHtml,
    extractedBlocksHtml,
  ]);

  // Measure rendered vertical stack height for accurate zoom bounding box
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const measureHeight = () => {
      const next = stack.offsetHeight;
      if (next > 0) setStackHeight(next);
    };
    measureHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureHeight);
      return () => window.removeEventListener('resize', measureHeight);
    }
    const ro = new ResizeObserver(measureHeight);
    ro.observe(stack);
    return () => ro.disconnect();
  }, [paperWidthPx, paperHeightPx, tablePages, blockPages, config]);

  // Close download dropdown on outside click or Escape
  useEffect(() => {
    if (!downloadOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        downloadBtnRef.current &&
        !downloadBtnRef.current.contains(target)
      ) {
        setDownloadOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDownloadOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [downloadOpen]);

  const fitScale =
    availableWidth > 0 && availableWidth < paperWidthPx
      ? Math.max(0.3, availableWidth / paperWidthPx)
      : 1;

  const effectiveZoom = zoomMode === 'fit' ? fitScale : manualZoom;
  const zoomPercent = Math.round(effectiveZoom * 100);

  const scaledOuterWidth = Math.floor(paperWidthPx * effectiveZoom);
  const scaledOuterHeight =
    stackHeight > 0 ? Math.ceil(stackHeight * effectiveZoom) : undefined;

  const handleZoomOut = () => {
    const next = Math.max(0.4, Math.round((effectiveZoom - 0.1) * 10) / 10);
    setManualZoom(next);
    setZoomMode('manual');
  };

  const handleZoomIn = () => {
    const next = Math.min(1.8, Math.round((effectiveZoom + 0.1) * 10) / 10);
    setManualZoom(next);
    setZoomMode('manual');
  };

  const handleToggleFit = () => {
    if (zoomMode === 'fit') {
      setManualZoom(1);
      setZoomMode('manual');
    } else {
      setZoomMode('fit');
    }
  };

  const totalPageCount = isBlocksMode ? blockPages.length : tablePages.length;

  const handleSaveSettings = async ({
    config: nextConfig,
    heading: nextHeading,
  }: {
    config: DocumentPrintConfig;
    heading?: WeeklySignatureHeading;
  }) => {
    setSettingsError('');
    setSavingSettings(true);
    try {
      await onConfigChange(nextConfig);
      if (nextHeading && onHeadingChange) {
        await onHeadingChange(nextHeading);
      }
      setSettingsOpen(false);
    } catch (err: unknown) {
      setSettingsError(
        err instanceof Error ? err.message : 'সেটিংস সংরক্ষণ করা যায়নি।'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePrint = useCallback(() => {
    setDownloadOpen(false);
    const frameEl = frameRootRef.current;
    if (!frameEl || typeof document === 'undefined') {
      window.print();
      return;
    }

    const markedHidden: HTMLElement[] = [];
    const markedAncestors: HTMLElement[] = [];

    let curr: HTMLElement | null = frameEl;
    while (curr && curr.parentElement && curr !== document.body) {
      const parent: HTMLElement = curr.parentElement;
      Array.from(parent.children).forEach((sib) => {
        if (sib !== curr && sib instanceof HTMLElement) {
          const tag = sib.tagName;
          if (tag !== 'STYLE' && tag !== 'LINK' && tag !== 'SCRIPT') {
            sib.setAttribute('data-doc-print-hide', 'true');
            markedHidden.push(sib);
          }
        }
      });
      if (parent !== document.body) {
        parent.classList.add('doc-print-ancestor');
        markedAncestors.push(parent);
      }
      curr = parent;
    }

    frameEl.setAttribute('data-doc-print-target', 'true');
    document.body.classList.add('doc-print-active');

    const styleEl = document.createElement('style');
    styleEl.id = `doc-print-style-${frameId}`;
    styleEl.textContent = `@media print {
      @page {
        size: ${dims.cssPageSize} ${config.orientation};
        margin: ${config.margins.top}mm ${config.margins.right}mm ${config.margins.bottom}mm ${config.margins.left}mm;
      }
    }`;
    document.head.appendChild(styleEl);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('doc-print-active');
      frameEl.removeAttribute('data-doc-print-target');
      markedHidden.forEach((el) => el.removeAttribute('data-doc-print-hide'));
      markedAncestors.forEach((el) => el.classList.remove('doc-print-ancestor'));
      if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
      // Fallback cleanup for environments where afterprint doesn't fire
      window.setTimeout(cleanup, 4000);
    }, 50);
  }, [frameId, dims.cssPageSize, config.orientation, config.margins]);

  useEffect(() => {
    if (!printActionRef) return;
    printActionRef.current = handlePrint;
    return () => {
      printActionRef.current = null;
    };
  }, [printActionRef, handlePrint]);

  const handleDownloadPdf = async () => {
    if (generating || !stackRef.current) return;
    setDownloadOpen(false);
    setGenerating('pdf');

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-99999px';
    host.style.top = '0';
    host.style.width = `${paperWidthPx}px`;
    host.style.backgroundColor = '#ffffff';
    host.style.color = '#000000';
    host.style.fontFamily = fontCssStack;
    host.style.zIndex = '-9999';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const paperEls = Array.from(
        stackRef.current.querySelectorAll(':scope > .doc-frame-page-item > .doc-frame-paper')
      ) as HTMLElement[];

      if (paperEls.length === 0) {
        throw new Error('প্রিন্ট করার মতো কোনো পেইজ পাওয়া যায়নি।');
      }

      const pdf = new jsPDF({
        orientation: config.orientation,
        unit: 'mm',
        format: dims.jsPdfFormat,
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < paperEls.length; i++) {
        const clone = paperEls[i].cloneNode(true) as HTMLElement;
        clone.style.width = `${paperWidthPx}px`;
        clone.style.minHeight = `${paperHeightPx}px`;
        clone.style.margin = '0';
        clone.style.border = 'none';
        clone.style.borderRadius = '0';
        clone.style.boxShadow = 'none';
        clone.style.transform = 'none';
        clone.style.backgroundColor = '#ffffff';
        clone.style.color = '#000000';
        clone.style.fontFamily = fontCssStack;

        host.innerHTML = '';
        if (customScopeCss) {
          const st = document.createElement('style');
          st.textContent = customScopeCss;
          host.appendChild(st);
        }
        host.appendChild(clone);

        const canvas = await safeHtml2Canvas(host, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          width: paperWidthPx,
          windowWidth: Math.max(paperWidthPx + 120, 1024),
          scrollX: 0,
          scrollY: 0,
        });

        const imgHeightMm = (canvas.height / canvas.width) * pageW;
        const imgData = canvas.toDataURL('image/png');

        if (i > 0) pdf.addPage(dims.jsPdfFormat, config.orientation);
        if (imgHeightMm <= pageH + 1) {
          pdf.addImage(imgData, 'PNG', 0, 0, pageW, Math.min(pageH, imgHeightMm), undefined, 'FAST');
        } else {
          // Safety slice if a single non-table block exceeded 1 page height
          const slicePx = Math.floor((canvas.width * pageH) / pageW);
          let y = 0;
          let subIdx = 0;
          while (y < canvas.height) {
            const h = Math.min(slicePx, canvas.height - y);
            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = h;
            const ctx = subCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, subCanvas.width, subCanvas.height);
              ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            }
            if (subIdx > 0) pdf.addPage(dims.jsPdfFormat, config.orientation);
            pdf.addImage(
              subCanvas.toDataURL('image/png'),
              'PNG',
              0,
              0,
              pageW,
              (h / canvas.width) * pageW,
              undefined,
              'FAST'
            );
            y += h;
            subIdx++;
          }
        }
      }

      const blob = pdf.output('blob');
      const safeName = fileNamePrefix.toLowerCase().endsWith('.pdf')
        ? fileNamePrefix
        : `${fileNamePrefix}.pdf`;
      await saveFile(safeName, blob);
      onNotify?.({
        type: 'success',
        message: `PDF ফাইল সফলভাবে ডাউনলোড হয়েছে: ${safeName}`,
      });
    } catch (err) {
      console.error('[DocumentPrintFrame] PDF export failed:', err);
      onNotify?.({
        type: 'error',
        message: 'PDF তৈরি করা যায়নি। প্রিন্ট বাটন থেকে Save as PDF চেষ্টা করুন।',
      });
    } finally {
      if (host.parentNode) host.parentNode.removeChild(host);
      setGenerating(null);
    }
  };

  const handleDownloadHtml = async () => {
    if (generating || !stackRef.current) return;
    setDownloadOpen(false);
    setGenerating('html');
    try {
      const pageItems = Array.from(
        stackRef.current.querySelectorAll(':scope > .doc-frame-page-item')
      );
      const pagesHtml = pageItems.map((el) => el.outerHTML).join('\n');
      const safeTitle = escapeHtml(documentTitle);
      const { margins } = config;
      const fontOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const googleFontHref = getGoogleFontsStylesheetUrl(globalFont);
      const googleFontLinks = googleFontHref
        ? `\n  <link rel="preconnect" href="https://fonts.googleapis.com" />\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n  <link rel="stylesheet" href="${googleFontHref}" />`
        : '';

      const htmlDoc = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>${googleFontLinks}
  <style>
    @font-face {
      font-family: 'Nikosh';
      src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Nikosh';
      src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh');
      font-weight: 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'Nikosh';
      src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh');
      font-weight: 600;
      font-style: normal;
    }
    @font-face {
      font-family: 'Nikosh';
      src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'Nikosh';
      src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh');
      font-weight: 800;
      font-style: normal;
    }
    @font-face {
      font-family: 'Nikosh';
      src: url('${fontOrigin}/fonts/Nikosh.ttf') format('truetype'), local('Nikosh');
      font-weight: 900;
      font-style: normal;
    }
    @page {
      size: ${dims.cssPageSize} ${config.orientation};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #dde3ea;
      color: #000000;
      font-family: ${fontCssStack};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      max-width: ${dims.widthMm}mm;
      margin: 14px auto 0;
      padding: 0 12px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .print-btn {
      min-height: 40px;
      padding: 8px 16px;
      border: 1px solid #059669;
      border-radius: 10px;
      background: #059669;
      color: #ffffff;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .doc-wrapper {
      width: 100%;
      overflow-x: auto;
      padding: 16px 12px 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    .doc-frame-page-item {
      display: flex;
      flex-direction: column;
    }
    .doc-frame-paper {
      width: ${dims.widthMm}mm !important;
      min-height: ${dims.heightMm}mm !important;
      padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 6px 22px rgba(15, 23, 42, 0.14);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .doc-print-content-scope table {
      width: 100% !important;
      border-collapse: collapse;
    }
    .doc-print-content-scope th,
    .doc-print-content-scope td {
      border: 1px solid #475569;
      vertical-align: middle;
      padding: 4px 6px;
    }
    .doc-print-content-scope thead th {
      background: #f1f5f9;
      font-weight: 700;
    }
    .doc-frame-page-footer {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: ${px(10)};
      color: #0f172a;
    }
    ${customScopeCss || ''}
    @media print {
      html, body { background: #ffffff !important; }
      .toolbar { display: none !important; }
      .doc-wrapper { display: block !important; padding: 0 !important; overflow: visible !important; }
      .doc-frame-page-item { display: block !important; break-after: page; page-break-after: always; }
      .doc-frame-page-item:last-child { break-after: auto; page-break-after: auto; }
      .doc-frame-paper {
        display: block !important;
        width: 100% !important;
        min-height: 0 !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="print-btn" onclick="window.print()">প্রিন্ট করুন</button>
  </div>
  <div class="doc-wrapper">
    ${pagesHtml}
  </div>
</body>
</html>`;

      const safeName = fileNamePrefix.toLowerCase().endsWith('.html')
        ? fileNamePrefix
        : `${fileNamePrefix}.html`;
      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      await saveFile(safeName, blob);
      onNotify?.({
        type: 'success',
        message: `HTML ফাইল ডাউনলোড হয়েছে: ${safeName}`,
      });
    } catch (err) {
      console.error('[DocumentPrintFrame] HTML export failed:', err);
      onNotify?.({
        type: 'error',
        message: 'HTML ফাইল তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setGenerating(null);
    }
  };

  const renderCtx: DocumentRenderContext = { config, scale, px };
  const orientationLabel = config.orientation === 'landscape' ? 'আড়াআড়ি' : 'লম্বালম্বি';

  const renderPageContent = (slice: SheetPageSlice) => (
    <div
      style={{ fontFamily: fontCssStack, fontSize: px(11.5) }}
      className={`doc-print-content-scope w-full bg-white text-black ${
        lightReset ? 'doc-print-light-reset' : ''
      }`}
    >
      {slice.includeHeader && (
        renderHeader ? (
          renderHeader(renderCtx)
        ) : extractedHeaderHtml ? (
          <div dangerouslySetInnerHTML={{ __html: extractedHeaderHtml }} />
        ) : null
      )}

      {slice.includeTable && (
        renderTable ? (
          renderTable({
            ...renderCtx,
            rowIndices: slice.rowIndices,
            includeTableFooter: slice.includeFooter,
          })
        ) : extractedTableSpec ? (
          <div
            dangerouslySetInnerHTML={{
              __html: buildExtractedTableMarkup(
                extractedTableSpec,
                slice.rowIndices,
                slice.includeFooter
              ),
            }}
          />
        ) : null
      )}

      {slice.includeFooter && (
        renderFooter ? (
          <div className="doc-frame-doc-footer">{renderFooter(renderCtx)}</div>
        ) : extractedFooterHtml ? (
          <div
            className="doc-frame-doc-footer"
            dangerouslySetInnerHTML={{ __html: extractedFooterHtml }}
          />
        ) : null
      )}
    </div>
  );

  return (
    <div
      ref={frameRootRef}
      data-doc-frame-id={frameId}
      className="doc-frame-root flex flex-col rounded-[14px] border border-theme-border bg-theme-surface overflow-hidden shadow-xs print:border-none print:shadow-none print:rounded-none print:bg-white print:overflow-visible"
    >
      {customScopeCss && <style>{customScopeCss}</style>}

      {/* Hidden off-screen full unsplit DOM for exact height measurement */}
      <div
        aria-hidden="true"
        className="print:hidden"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          width: `${usableWidthPx}px`,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={measureRef}
          style={{ fontFamily: fontCssStack, fontSize: px(11.5) }}
          className={`doc-print-content-scope w-full bg-white text-black ${
            lightReset ? 'doc-print-light-reset' : ''
          }`}
        >
          {isBlocksMode ? (
            extractedBlocksHtml?.map((blockHtml, idx) => (
              <div
                key={idx}
                className="doc-measure-block"
                dangerouslySetInnerHTML={{ __html: blockHtml }}
              />
            ))
          ) : (
            <>
              {(renderHeader || extractedHeaderHtml) && (
                <div className="doc-measure-header">
                  {renderHeader ? (
                    renderHeader(renderCtx)
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{ __html: extractedHeaderHtml || '' }}
                    />
                  )}
                </div>
              )}

              {(renderTable || extractedTableSpec) && (
                <div className="doc-measure-table">
                  {renderTable ? (
                    renderTable({
                      ...renderCtx,
                      rowIndices: Array.from({ length: effectiveRowCount }, (_, i) => i),
                      includeTableFooter: true,
                    })
                  ) : extractedTableSpec ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: buildExtractedTableMarkup(
                          extractedTableSpec,
                          Array.from({ length: effectiveRowCount }, (_, i) => i),
                          true
                        ),
                      }}
                    />
                  ) : null}
                </div>
              )}

              {(renderFooter || extractedFooterHtml) && (
                <div className="doc-measure-footer">
                  {renderFooter ? (
                    renderFooter(renderCtx)
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{ __html: extractedFooterHtml || '' }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MS-Word-Style Frame Toolbar */}
      <div className="doc-frame-toolbar px-3 sm:px-4 py-2.5 border-b border-theme-border bg-theme-surface flex flex-wrap items-center justify-between gap-2.5 shrink-0 print:hidden">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {toolbarLeftExtra}
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-theme-text-primary truncate">
              {documentTitle}
            </div>
            <div className="text-[11px] text-theme-text-secondary tabular-nums">
              {dims.label} · {orientationLabel} · {toBnDigits(config.fontSizePt)} pt ·{' '}
              {toBnDigits(totalPageCount)} পৃষ্ঠা
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Zoom Controls */}
          <div
            role="group"
            aria-label="জুম নিয়ন্ত্রণ"
            className="inline-flex items-center rounded-xl border border-theme-border bg-theme-surface-subtle p-0.5"
          >
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={effectiveZoom <= 0.4}
              aria-label="জুম কমান"
              title="জুম কমান"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface transition disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              onClick={handleToggleFit}
              title={zoomMode === 'fit' ? '১০০% জুম করুন' : 'ফ্রেমে ফিট করুন'}
              className="h-8 px-2 rounded-lg text-[11.5px] font-semibold text-theme-text-primary hover:bg-theme-surface tabular-nums transition cursor-pointer min-w-[54px]"
            >
              {zoomMode === 'fit' ? `ফিট (${toBnDigits(zoomPercent)}%)` : `${toBnDigits(zoomPercent)}%`}
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={effectiveZoom >= 1.8}
              aria-label="জুম বাড়ান"
              title="জুম বাড়ান"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface transition disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              setSettingsError('');
              setSettingsOpen(true);
            }}
            aria-label="ডকুমেন্ট ও পেইজ সেটিংস"
            title="পেপার সাইজ, মার্জিন, ফন্ট ও হেডিং সেটিংস"
            className="h-9 px-2.5 sm:px-3 rounded-xl border border-theme-border bg-theme-surface-subtle hover:bg-theme-surface-hover text-theme-text-primary text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">সেটিংস</span>
          </button>

          {/* Download Dropdown */}
          {canExport && (
            <div className="relative">
              <button
                ref={downloadBtnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={downloadOpen}
                disabled={Boolean(generating)}
                onClick={() => setDownloadOpen((prev) => !prev)}
                className="h-9 px-3 rounded-xl border border-theme-border-strong bg-theme-elevated hover:bg-theme-surface-hover text-theme-text-primary text-xs font-medium inline-flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
              >
                {generating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>{generating ? 'প্রস্তুত হচ্ছে...' : 'ডাউনলোড'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${downloadOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {downloadOpen && (
                <div
                  ref={dropdownRef}
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-theme-border bg-theme-surface shadow-xl p-1.5 z-50 space-y-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDownloadPdf}
                    className="w-full px-3 py-2 rounded-lg text-left hover:bg-theme-surface-hover flex items-start gap-2.5 transition cursor-pointer"
                  >
                    <FileText size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-theme-text-primary">
                        PDF ডকুমেন্ট (.pdf)
                      </div>
                      <div className="text-[11px] text-theme-text-secondary">
                        প্রিন্ট-রেডি মাল্টি-পেইজ PDF
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDownloadHtml}
                    className="w-full px-3 py-2 rounded-lg text-left hover:bg-theme-surface-hover flex items-start gap-2.5 transition cursor-pointer"
                  >
                    <FileCode2 size={16} className="text-sky-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-theme-text-primary">
                        HTML ডকুমেন্ট (.html)
                      </div>
                      <div className="text-[11px] text-theme-text-secondary">
                        ব্রাউজারে প্রিন্টযোগ্য ফাইল
                      </div>
                    </div>
                  </button>

                  {extraDownloadItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={async () => {
                        setDownloadOpen(false);
                        await item.onClick();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left hover:bg-theme-surface-hover flex items-start gap-2.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      <span className="shrink-0 mt-0.5 text-theme-primary">
                        {item.icon || <Download size={16} />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-theme-text-primary">
                          {item.label}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-theme-text-secondary">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="h-9 px-3.5 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Printer size={15} />
            <span>প্রিন্ট</span>
          </button>

          {toolbarRightExtra}
        </div>
      </div>

      {/* MS-Word Scrollable Workspace Backdrop */}
      <div
        ref={workspaceRef}
        className={`doc-frame-backdrop w-full overflow-auto bg-[#dde3ea] dark:bg-[#1a2433] p-3.5 sm:p-6 md:p-7 ${workspaceMaxHeightClass} print:bg-white print:p-0 print:max-h-none print:overflow-visible`}
      >
        <div
          className="doc-frame-scale-frame mx-auto print:w-full print:h-auto"
          style={{
            width: `${scaledOuterWidth}px`,
            height: scaledOuterHeight ? `${scaledOuterHeight}px` : undefined,
          }}
        >
          <div
            ref={stackRef}
            className="doc-frame-pages-stack flex flex-col gap-[24px] print:gap-0 print:block"
            style={{
              width: `${paperWidthPx}px`,
              transform: effectiveZoom !== 1 ? `scale(${effectiveZoom})` : undefined,
              transformOrigin: 'top left',
            }}
          >
            {isBlocksMode
              ? blockPages.map((blockIndices, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="doc-frame-page-item flex flex-col print:block"
                  >
                    <div
                      style={{
                        width: `${paperWidthPx}px`,
                        minHeight: `${paperHeightPx}px`,
                        padding: `${padTopPx}px ${padRightPx}px ${padBottomPx}px ${padLeftPx}px`,
                        boxSizing: 'border-box',
                      }}
                      className="doc-frame-paper flex flex-col justify-between bg-white text-black rounded-[6px] border border-slate-300/90 shadow-[0_6px_22px_rgba(15,23,42,0.16)] print:border-none print:shadow-none print:rounded-none print:w-full print:min-h-0 print:p-0 print:block"
                    >
                      <div
                        style={{ fontFamily: fontCssStack, fontSize: px(11.5) }}
                        className={`doc-print-content-scope w-full bg-white text-black ${
                          lightReset ? 'doc-print-light-reset' : ''
                        }`}
                      >
                        {blockIndices.map((bIdx) => (
                          <div
                            key={bIdx}
                            dangerouslySetInnerHTML={{
                              __html: extractedBlocksHtml?.[bIdx] || '',
                            }}
                          />
                        ))}
                      </div>

                      {blockPages.length > 1 && config.showPageNumbers && (
                        <div
                          style={{ fontFamily: fontCssStack, fontSize: px(10) }}
                          className="doc-frame-page-footer mt-3 pt-1.5 border-t border-slate-300 flex items-center justify-between text-slate-700"
                        >
                          <span className="truncate pr-4">{documentTitle}</span>
                          <span className="font-semibold tabular-nums shrink-0">
                            পৃষ্ঠা {toBnDigits(pageIdx + 1)} / {toBnDigits(blockPages.length)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              : tablePages.map((slice, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="doc-frame-page-item flex flex-col print:block"
                  >
                    <div
                      style={{
                        width: `${paperWidthPx}px`,
                        minHeight: `${paperHeightPx}px`,
                        padding: `${padTopPx}px ${padRightPx}px ${padBottomPx}px ${padLeftPx}px`,
                        boxSizing: 'border-box',
                      }}
                      className="doc-frame-paper flex flex-col justify-between bg-white text-black rounded-[6px] border border-slate-300/90 shadow-[0_6px_22px_rgba(15,23,42,0.16)] print:border-none print:shadow-none print:rounded-none print:w-full print:min-h-0 print:p-0 print:block"
                    >
                      <div className="w-full">{renderPageContent(slice)}</div>

                      {tablePages.length > 1 && config.showPageNumbers && (
                        <div
                          style={{ fontFamily: fontCssStack, fontSize: px(10) }}
                          className="doc-frame-page-footer mt-3 pt-1.5 border-t border-slate-300 flex items-center justify-between text-slate-700"
                        >
                          <span className="truncate pr-4">
                            {heading?.sheetTitle?.trim() || documentTitle}
                          </span>
                          <span className="font-semibold tabular-nums shrink-0">
                            পৃষ্ঠা {toBnDigits(pageIdx + 1)} / {toBnDigits(tablePages.length)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Document & Page Settings Modal */}
      <DocumentSettingsModal
        open={settingsOpen}
        config={config}
        defaultOrientation={defaultOrientation}
        heading={heading}
        defaultHeading={defaultHeading}
        supportsSignatures={supportsSignatures}
        supportsGeneratedDate={supportsGeneratedDate}
        saving={savingSettings}
        errorMessage={settingsError}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};
