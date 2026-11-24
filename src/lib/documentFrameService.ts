import type {
  DocumentPrintConfig,
  WeeklySignatureHeading,
  WeeklySignatureOrientation,
} from '../types';
import {
  DEFAULT_SHEET_HEADING,
  DEFAULT_SHEET_PAGE_CONFIG,
  normalizePageConfig,
} from '../components/weekly-signature/utils';

export const DEFAULT_DOCUMENT_PRINT_CONFIG: DocumentPrintConfig = {
  ...DEFAULT_SHEET_PAGE_CONFIG,
  repeatHeaderOnAllPages: true,
  showPageNumbers: true,
  showSignatures: true,
  showGeneratedDate: true,
};

export function normalizeDocumentPrintConfig(
  raw?: Partial<DocumentPrintConfig> | null,
  fallbackOrientation: WeeklySignatureOrientation = 'portrait'
): DocumentPrintConfig {
  const base = normalizePageConfig({
    paperSize: raw?.paperSize,
    orientation: raw?.orientation || fallbackOrientation,
    margins: raw?.margins,
    fontFamily: raw?.fontFamily,
    fontSizePt: raw?.fontSizePt,
  });

  return {
    ...base,
    repeatHeaderOnAllPages:
      typeof raw?.repeatHeaderOnAllPages === 'boolean'
        ? raw.repeatHeaderOnAllPages
        : DEFAULT_DOCUMENT_PRINT_CONFIG.repeatHeaderOnAllPages,
    showPageNumbers:
      typeof raw?.showPageNumbers === 'boolean'
        ? raw.showPageNumbers
        : DEFAULT_DOCUMENT_PRINT_CONFIG.showPageNumbers,
    showSignatures:
      typeof raw?.showSignatures === 'boolean'
        ? raw.showSignatures
        : DEFAULT_DOCUMENT_PRINT_CONFIG.showSignatures,
    showGeneratedDate:
      typeof raw?.showGeneratedDate === 'boolean'
        ? raw.showGeneratedDate
        : DEFAULT_DOCUMENT_PRINT_CONFIG.showGeneratedDate,
  };
}

const DOC_CONFIG_STORAGE_PREFIX = 'bnfe_doc_print_cfg_';
const DOC_HEADING_STORAGE_PREFIX = 'bnfe_doc_heading_';

export function readLocalDocPrintConfig(
  scopeKey: string,
  userId?: string
): Partial<DocumentPrintConfig> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(
      `${DOC_CONFIG_STORAGE_PREFIX}${scopeKey}_${userId || 'local'}`
    );
    return raw ? (JSON.parse(raw) as Partial<DocumentPrintConfig>) : null;
  } catch {
    return null;
  }
}

export function writeLocalDocPrintConfig(
  scopeKey: string,
  userId: string | undefined,
  config: DocumentPrintConfig
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${DOC_CONFIG_STORAGE_PREFIX}${scopeKey}_${userId || 'local'}`,
      JSON.stringify(config)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function readLocalDocHeading(
  scopeKey: string,
  userId?: string
): Partial<WeeklySignatureHeading> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(
      `${DOC_HEADING_STORAGE_PREFIX}${scopeKey}_${userId || 'local'}`
    );
    return raw ? (JSON.parse(raw) as Partial<WeeklySignatureHeading>) : null;
  } catch {
    return null;
  }
}

export function writeLocalDocHeading(
  scopeKey: string,
  userId: string | undefined,
  heading: WeeklySignatureHeading
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${DOC_HEADING_STORAGE_PREFIX}${scopeKey}_${userId || 'local'}`,
      JSON.stringify(heading)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeHeadingWithDefault(
  baseDefault: Partial<WeeklySignatureHeading>,
  globalHeading?: Partial<WeeklySignatureHeading> | null,
  localOverride?: Partial<WeeklySignatureHeading> | null
): WeeklySignatureHeading {
  return {
    govtTitle:
      localOverride?.govtTitle ??
      globalHeading?.govtTitle ??
      baseDefault.govtTitle ??
      DEFAULT_SHEET_HEADING.govtTitle,
    officeTitle:
      localOverride?.officeTitle ??
      globalHeading?.officeTitle ??
      baseDefault.officeTitle ??
      DEFAULT_SHEET_HEADING.officeTitle,
    officeAddress:
      localOverride?.officeAddress ??
      globalHeading?.officeAddress ??
      baseDefault.officeAddress ??
      DEFAULT_SHEET_HEADING.officeAddress,
    programTitle:
      localOverride?.programTitle ??
      globalHeading?.programTitle ??
      baseDefault.programTitle ??
      DEFAULT_SHEET_HEADING.programTitle,
    sheetTitle:
      localOverride?.sheetTitle ??
      baseDefault.sheetTitle ??
      globalHeading?.sheetTitle ??
      DEFAULT_SHEET_HEADING.sheetTitle,
  };
}

export interface ExtractedTableSpec {
  tableClass: string;
  tableStyle: string;
  colgroupHtml: string;
  theadHtml: string;
  rowHtmls: string[];
  tfootHtml: string;
  tbodyClass: string;
}

export interface ExtractedDocument {
  stylesCss: string;
  headerHtml: string;
  tableSpec: ExtractedTableSpec | null;
  footerHtml: string;
  fallbackBlocksHtml: string[];
  lightReset: boolean;
}

export interface GlobalPrintRequest {
  id: string;
  title: string;
  jobName: string;
  defaultOrientation: WeeklySignatureOrientation;
  extracted: ExtractedDocument;
  onSettled?: (result: {
    success: boolean;
    message: string;
  }) => void;
}

type GlobalPrintListener = (req: GlobalPrintRequest) => void;
const globalPrintListeners = new Set<GlobalPrintListener>();

export function subscribeGlobalPrint(listener: GlobalPrintListener): () => void {
  globalPrintListeners.add(listener);
  return () => {
    globalPrintListeners.delete(listener);
  };
}

export function hasGlobalPrintHost(): boolean {
  return globalPrintListeners.size > 0;
}

export function openGlobalDocumentPrintPreview(
  req: Omit<GlobalPrintRequest, 'id'>
): boolean {
  if (globalPrintListeners.size === 0) return false;
  const fullReq: GlobalPrintRequest = {
    ...req,
    id: `doc-print-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  globalPrintListeners.forEach((listener) => listener(fullReq));
  return true;
}

function splitTopLevelCssRules(css: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  let inString: string | null = null;
  let inComment = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString && ch === '/' && next === '*') {
      inComment = true;
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        blocks.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }

  return blocks.filter(Boolean);
}

function prefixSelectorList(selectorText: string, scopeClass: string): string {
  return selectorText
    .split(',')
    .map((sel) => {
      const s = sel.trim();
      if (!s) return '';
      if (s === '*' || s === 'html' || s === 'body' || s === 'html, body' || s === ':root') {
        return scopeClass;
      }
      if (/^(html|body)\b/i.test(s)) {
        return s.replace(/^(html|body)\b/i, scopeClass);
      }
      return `${scopeClass} ${s}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function scopeCssForDocFrame(
  rawCss: string,
  scopeClass = '.doc-print-content-scope'
): string {
  if (!rawCss.trim()) return '';
  const cleaned = rawCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@page\b[^{]*\{[\s\S]*?\}/gi, '');

  const blocks = splitTopLevelCssRules(cleaned);
  const out: string[] = [];

  for (const block of blocks) {
    const braceIdx = block.indexOf('{');
    if (braceIdx === -1) continue;
    const header = block.slice(0, braceIdx).trim();
    const body = block.slice(braceIdx + 1, -1).trim();

    if (!header) continue;

    if (header.startsWith('@')) {
      const lower = header.toLowerCase();
      if (lower.startsWith('@page')) continue;
      if (lower.startsWith('@font-face') || lower.startsWith('@keyframes')) {
        out.push(block);
        continue;
      }
      if (lower.startsWith('@media')) {
        if (lower.includes('print')) {
          // Skip nested @media print overrides; frame handles @media print layout cleanly
          continue;
        }
        const innerScoped = scopeCssForDocFrame(body, scopeClass);
        if (innerScoped) {
          out.push(`${header} {\n${innerScoped}\n}`);
        }
        continue;
      }
      continue;
    }

    const prefixed = prefixSelectorList(header, scopeClass);
    if (prefixed) {
      // Avoid setting fixed outer body margin/background on inner paper scope
      let safeBody = body;
      if (prefixed === scopeClass) {
        safeBody = safeBody
          .replace(/(^|;)\s*margin\s*:[^;]+;?/gi, '$1')
          .replace(/(^|;)\s*padding\s*:[^;]+;?/gi, '$1')
          .replace(/(^|;)\s*background(?:-color)?\s*:[^;]+;?/gi, '$1');
      }
      if (safeBody.trim()) {
        out.push(`${prefixed} { ${safeBody} }`);
      }
    }
  }

  return out.join('\n');
}

function findPrimarySplittableTable(
  container: HTMLElement
): {
  headerElements: Element[];
  table: HTMLTableElement;
  footerElements: Element[];
} | null {
  let current: HTMLElement | null = container;

  // Walk down single-child wrapper divs up to 3 levels to reach top-level sections
  for (let depth = 0; depth < 3; depth++) {
    const children = Array.from(current.children).filter(
      (el) => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
    );
    if (children.length === 1 && children[0].tagName === 'DIV') {
      current = children[0] as HTMLElement;
    } else {
      break;
    }
  }

  const children = Array.from(current.children).filter(
    (el) => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
  );

  // Case 1: direct child table
  const directTableIdx = children.findIndex((el) => el.tagName === 'TABLE');
  if (directTableIdx !== -1) {
    const tbl = children[directTableIdx] as HTMLTableElement;
    return {
      headerElements: children.slice(0, directTableIdx),
      table: tbl,
      footerElements: children.slice(directTableIdx + 1),
    };
  }

  // Case 2: table wrapped inside a single scroll container (e.g. .overflow-x-auto)
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tablesInside = child.querySelectorAll('table');
    if (tablesInside.length === 1 && child.children.length === 1) {
      return {
        headerElements: children.slice(0, i),
        table: tablesInside[0] as HTMLTableElement,
        footerElements: children.slice(i + 1),
      };
    }
  }

  return null;
}

function buildTableSpec(table: HTMLTableElement): ExtractedTableSpec {
  const colgroup = table.querySelector(':scope > colgroup');
  const thead = table.querySelector(':scope > thead');
  const tbody = table.querySelector(':scope > tbody');
  const tfoot = table.querySelector(':scope > tfoot');

  const rows = tbody
    ? Array.from(tbody.querySelectorAll(':scope > tr')).map((tr) => tr.outerHTML)
    : Array.from(table.querySelectorAll(':scope > tr')).map((tr) => tr.outerHTML);

  return {
    tableClass: table.getAttribute('class') || '',
    tableStyle: table.getAttribute('style') || '',
    colgroupHtml: colgroup ? colgroup.outerHTML : '',
    theadHtml: thead ? thead.outerHTML : '',
    rowHtmls: rows,
    tfootHtml: tfoot ? tfoot.outerHTML : '',
    tbodyClass: tbody?.getAttribute('class') || '',
  };
}

function collectFallbackBlocks(container: HTMLElement): string[] {
  let current: HTMLElement = container;
  for (let depth = 0; depth < 3; depth++) {
    const children = Array.from(current.children).filter(
      (el) => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
    );
    if (children.length === 1 && children[0].tagName === 'DIV') {
      current = children[0] as HTMLElement;
    } else {
      break;
    }
  }

  const children = Array.from(current.children).filter(
    (el) => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
  );

  if (children.length === 0) {
    return container.innerHTML.trim() ? [container.innerHTML] : [];
  }

  return children.map((el) => el.outerHTML);
}

export function extractStructuredDocumentFromHtml(html: string): ExtractedDocument {
  if (typeof DOMParser === 'undefined') {
    return {
      stylesCss: '',
      headerHtml: '',
      tableSpec: null,
      footerHtml: '',
      fallbackBlocksHtml: [html],
      lightReset: false,
    };
  }

  const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const parsed = new DOMParser().parseFromString(cleanHtml, 'text/html');

  const rawCss = Array.from(parsed.querySelectorAll('style'))
    .map((s) => s.textContent || '')
    .join('\n');
  const stylesCss = scopeCssForDocFrame(rawCss);

  // Strip embedded toolbar/print buttons if an HTML template included one
  parsed.body
    .querySelectorAll('.toolbar, .print\\:hidden, [class*="print:hidden"]')
    .forEach((el) => el.remove());

  const split = findPrimarySplittableTable(parsed.body);
  if (split && buildTableSpec(split.table).rowHtmls.length > 0) {
    const tableSpec = buildTableSpec(split.table);
    return {
      stylesCss,
      headerHtml: split.headerElements.map((el) => el.outerHTML).join('\n'),
      tableSpec,
      footerHtml: split.footerElements.map((el) => el.outerHTML).join('\n'),
      fallbackBlocksHtml: [],
      lightReset: false,
    };
  }

  return {
    stylesCss,
    headerHtml: '',
    tableSpec: null,
    footerHtml: '',
    fallbackBlocksHtml: collectFallbackBlocks(parsed.body),
    lightReset: false,
  };
}

export function extractStructuredDocumentFromDom(targetEl: HTMLElement): ExtractedDocument {
  const clone = targetEl.cloneNode(true) as HTMLElement;

  // Convert any live <canvas> charts in the source into static images inside the clone
  const liveCanvases = Array.from(targetEl.querySelectorAll('canvas'));
  const clonedCanvases = Array.from(clone.querySelectorAll('canvas'));
  liveCanvases.forEach((liveCanvas, idx) => {
    const clonedCanvas = clonedCanvases[idx];
    if (!clonedCanvas || !clonedCanvas.parentNode) return;
    try {
      const dataUrl = liveCanvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = liveCanvas.getAttribute('aria-label') || 'Chart';
      img.style.width = '100%';
      img.style.maxWidth = `${liveCanvas.width}px`;
      img.style.height = 'auto';
      clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
    } catch {
      // Ignore tainted canvases
    }
  });

  // Remove interactive/non-print elements
  clone
    .querySelectorAll(
      '[class*="print:hidden"], .print\\:hidden, [role="status"], script, .doc-frame-root'
    )
    .forEach((el) => el.remove());

  // Make horizontal scroll tables unclipped for print/frame view
  clone
    .querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-hidden')
    .forEach((el) => {
      const h = el as HTMLElement;
      h.style.overflow = 'visible';
      h.style.maxHeight = 'none';
    });

  // Detect if there is a splittable primary table inside the visible page
  const split = findPrimarySplittableTable(clone);
  if (split) {
    const spec = buildTableSpec(split.table);
    if (spec.rowHtmls.length > 0) {
      return {
        stylesCss: '',
        headerHtml: split.headerElements.map((el) => el.outerHTML).join('\n'),
        tableSpec: spec,
        footerHtml: split.footerElements.map((el) => el.outerHTML).join('\n'),
        fallbackBlocksHtml: [],
        lightReset: true,
      };
    }
  }

  return {
    stylesCss: '',
    headerHtml: '',
    tableSpec: null,
    footerHtml: '',
    fallbackBlocksHtml: collectFallbackBlocks(clone),
    lightReset: true,
  };
}
