import html2canvas from 'html2canvas';

type Html2CanvasOptions = NonNullable<Parameters<typeof html2canvas>[1]>;

const MODERN_COLOR_HINT_RE = /\b(?:oklch|oklab|color-mix|lch|lab|color)\s*\(/i;
const COLOR_FN_NAMES = ['color-mix', 'oklch', 'oklab', 'lch', 'lab', 'color'] as const;

const colorCache = new Map<string, string | null>();
let scratchCtx: CanvasRenderingContext2D | null = null;

function getColorCanvasCtx(): CanvasRenderingContext2D | null {
  if (scratchCtx) return scratchCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  scratchCtx = canvas.getContext('2d', { willReadFrequently: true });
  return scratchCtx;
}

function containsModernColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return MODERN_COLOR_HINT_RE.test(value);
}

/**
 * Converts any single browser-supported CSS color expression (e.g. oklch(...),
 * oklab(...), color-mix(...)) into legacy hex or rgb()/rgba() using Canvas 2D.
 */
function convertCssColorToLegacy(expr: string): string | null {
  const key = expr.trim();
  if (!key) return null;
  if (colorCache.has(key)) return colorCache.get(key) ?? null;

  const ctx = getColorCanvasCtx();
  if (!ctx) return null;

  try {
    ctx.fillStyle = '#010203';
    ctx.fillStyle = key;
    const first = ctx.fillStyle;

    if (first === '#010203') {
      ctx.fillStyle = '#040506';
      ctx.fillStyle = key;
      if (ctx.fillStyle === '#040506') {
        colorCache.set(key, null);
        return null;
      }
    }

    const serialized = String(ctx.fillStyle || '');
    if (/^#[0-9a-f]{3,8}$/i.test(serialized) || /^rgba?\(/i.test(serialized)) {
      colorCache.set(key, serialized);
      return serialized;
    }

    // Fallback: rasterize 1x1 pixel so CSS Color 4 strings (e.g. color(srgb ...))
    // always become explicit legacy rgb()/rgba().
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const alpha = +(data[3] / 255).toFixed(4);
    const legacy =
      alpha >= 1
        ? `rgb(${data[0]}, ${data[1]}, ${data[2]})`
        : `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
    colorCache.set(key, legacy);
    return legacy;
  } catch {
    colorCache.set(key, null);
    return null;
  }
}

function findMatchingParen(str: string, openParenIdx: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = openParenIdx; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelComma(str: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts;
}

function resolveCssVariablesInExpr(
  expr: string,
  cssVars: Map<string, string>,
  depth = 0
): string {
  if (depth > 8 || !expr.includes('var(')) return expr;

  let out = '';
  let i = 0;
  while (i < expr.length) {
    const idx = expr.indexOf('var(', i);
    if (idx === -1) {
      out += expr.slice(i);
      break;
    }
    const prev = idx > 0 ? expr[idx - 1] : '';
    if (prev && /[a-zA-Z0-9_-]/.test(prev)) {
      out += expr.slice(i, idx + 4);
      i = idx + 4;
      continue;
    }
    const closeIdx = findMatchingParen(expr, idx + 3);
    if (closeIdx === -1) {
      out += expr.slice(i);
      break;
    }

    out += expr.slice(i, idx);
    const inner = expr.slice(idx + 4, closeIdx);
    const [rawName, ...rest] = splitTopLevelComma(inner);
    const fallback = rest.join(', ').trim();
    const resolvedVar = cssVars.get(rawName.trim());
    const chosen = resolvedVar && resolvedVar.length > 0 ? resolvedVar : fallback;

    if (chosen) {
      out += resolveCssVariablesInExpr(chosen, cssVars, depth + 1);
    } else {
      out += expr.slice(idx, closeIdx + 1);
    }
    i = closeIdx + 1;
  }
  return out;
}

function resolveLightDarkCalls(expr: string): string {
  if (!expr.toLowerCase().includes('light-dark(')) return expr;
  let out = '';
  let i = 0;
  const lower = expr.toLowerCase();
  while (i < expr.length) {
    const idx = lower.indexOf('light-dark(', i);
    if (idx === -1) {
      out += expr.slice(i);
      break;
    }
    const closeIdx = findMatchingParen(expr, idx + 10);
    if (closeIdx === -1) {
      out += expr.slice(i);
      break;
    }
    out += expr.slice(i, idx);
    const args = splitTopLevelComma(expr.slice(idx + 11, closeIdx));
    out += resolveLightDarkCalls(args[0] || 'transparent');
    i = closeIdx + 1;
  }
  return out;
}

function findNextModernColorCall(
  input: string,
  fromIndex: number
): { start: number; end: number; name: string } | null {
  const lower = input.toLowerCase();
  let bestStart = -1;
  let bestOpenParen = -1;
  let bestName = '';

  for (const fnName of COLOR_FN_NAMES) {
    let searchFrom = fromIndex;
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(fnName, searchFrom);
      if (idx === -1) break;

      const prevChar = idx > 0 ? input[idx - 1] : '';
      if (prevChar && /[a-zA-Z0-9_-]/.test(prevChar)) {
        searchFrom = idx + fnName.length;
        continue;
      }

      let cursor = idx + fnName.length;
      while (cursor < input.length && /\s/.test(input[cursor])) {
        cursor++;
      }
      if (input[cursor] !== '(') {
        searchFrom = idx + fnName.length;
        continue;
      }

      if (bestStart === -1 || idx < bestStart) {
        bestStart = idx;
        bestOpenParen = cursor;
        bestName = fnName;
      }
      break;
    }
  }

  if (bestStart === -1 || bestOpenParen === -1) return null;
  const end = findMatchingParen(input, bestOpenParen);
  if (end === -1) return null;
  return { start: bestStart, end, name: bestName };
}

/**
 * Replaces every oklch(), oklab(), color-mix(), lch(), lab(), and color() call
 * (including nested parentheses) in a CSS value or stylesheet string with
 * legacy hex / rgb() / rgba() colors safe for html2canvas.
 */
export function replaceModernColorFunctions(
  input: string,
  cssVars: Map<string, string> = new Map(),
  fallbackColor = 'transparent'
): string {
  if (!containsModernColor(input)) return input;

  let result = '';
  let cursor = 0;

  while (cursor < input.length) {
    const match = findNextModernColorCall(input, cursor);
    if (!match) {
      result += input.slice(cursor);
      break;
    }

    result += input.slice(cursor, match.start);
    const rawCall = input.slice(match.start, match.end + 1);

    let prepared = resolveCssVariablesInExpr(rawCall, cssVars);
    prepared = resolveLightDarkCalls(prepared);
    prepared = prepared.replace(/\bcurrentColor\b/gi, '#000000');

    let converted = convertCssColorToLegacy(prepared);
    if (!converted && match.name === 'color-mix') {
      // Fallback: convert inner color arguments if one component was unresolved
      const innerStart = rawCall.indexOf('(') + 1;
      const args = splitTopLevelComma(rawCall.slice(innerStart, -1));
      for (let a = 1; a < args.length; a++) {
        const cleanedArg = resolveCssVariablesInExpr(args[a], cssVars)
          .replace(/\bcurrentColor\b/gi, '#000000')
          .replace(/\s+\d+(?:\.\d+)?%\s*$/i, '')
          .trim();
        if (cleanedArg && cleanedArg !== 'transparent') {
          converted = convertCssColorToLegacy(
            containsModernColor(cleanedArg)
              ? replaceModernColorFunctions(cleanedArg, cssVars, fallbackColor)
              : cleanedArg
          );
          if (converted) break;
        }
      }
    }

    result += converted ?? fallbackColor;
    cursor = match.end + 1;
  }

  return result;
}

function collectCssVariables(doc: Document): Map<string, string> {
  const vars = new Map<string, string>();
  const cssDeclRe = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}{]+);/g;

  const extractFromCssText = (text: string) => {
    if (!text.includes('--')) return;
    cssDeclRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = cssDeclRe.exec(text)) !== null) {
      const name = m[1].trim();
      const val = m[2].trim();
      if (name && val && !vars.has(name)) {
        vars.set(name, val);
      }
    }
  };

  // 1. Scan raw CSS custom property declarations from <style> and accessible stylesheets
  doc.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent) extractFromCssText(styleEl.textContent);
  });

  try {
    Array.from(doc.styleSheets).forEach((sheet) => {
      try {
        const rules = sheet.cssRules;
        if (!rules) return;
        for (let i = 0; i < rules.length; i++) {
          extractFromCssText(rules[i].cssText);
        }
      } catch {
        // Cross-origin stylesheet; skip
      }
    });
  } catch {
    // Ignore stylesheet enumeration failures
  }

  // 2. Override with computed :root & body custom properties (host doc first, cloned doc wins)
  const readComputedVarsFromDoc = (targetDoc: Document | undefined) => {
    const view = targetDoc?.defaultView;
    if (!targetDoc || !view) return;
    const roots = [targetDoc.documentElement, targetDoc.body].filter(Boolean) as Element[];
    for (const root of roots) {
      const cs = view.getComputedStyle(root);
      for (let i = 0; i < cs.length; i++) {
        const prop = cs[i];
        if (!prop.startsWith('--')) continue;
        const val = cs.getPropertyValue(prop).trim();
        if (val) vars.set(prop, val);
      }
    }
  };

  if (typeof document !== 'undefined' && document !== doc) {
    readComputedVarsFromDoc(document);
  }
  readComputedVarsFromDoc(doc);

  return vars;
}

const COMPUTED_COLOR_PROPS: ReadonlyArray<{
  domProp: keyof CSSStyleDeclaration;
  cssProp: string;
  fallback: string;
}> = [
  { domProp: 'color', cssProp: 'color', fallback: '#000000' },
  { domProp: 'backgroundColor', cssProp: 'background-color', fallback: 'transparent' },
  { domProp: 'backgroundImage', cssProp: 'background-image', fallback: 'none' },
  { domProp: 'borderTopColor', cssProp: 'border-top-color', fallback: '#000000' },
  { domProp: 'borderRightColor', cssProp: 'border-right-color', fallback: '#000000' },
  { domProp: 'borderBottomColor', cssProp: 'border-bottom-color', fallback: '#000000' },
  { domProp: 'borderLeftColor', cssProp: 'border-left-color', fallback: '#000000' },
  { domProp: 'outlineColor', cssProp: 'outline-color', fallback: '#000000' },
  { domProp: 'textDecorationColor', cssProp: 'text-decoration-color', fallback: '#000000' },
  { domProp: 'columnRuleColor', cssProp: 'column-rule-color', fallback: '#000000' },
  { domProp: 'caretColor', cssProp: 'caret-color', fallback: '#000000' },
  { domProp: 'webkitTextStrokeColor', cssProp: '-webkit-text-stroke-color', fallback: '#000000' },
  { domProp: 'boxShadow', cssProp: 'box-shadow', fallback: 'none' },
  { domProp: 'textShadow', cssProp: 'text-shadow', fallback: 'none' },
  { domProp: 'fill', cssProp: 'fill', fallback: '#000000' },
  { domProp: 'stroke', cssProp: 'stroke', fallback: 'none' },
  { domProp: 'stopColor', cssProp: 'stop-color', fallback: '#000000' },
  { domProp: 'floodColor', cssProp: 'flood-color', fallback: '#000000' },
  { domProp: 'lightingColor', cssProp: 'lighting-color', fallback: '#ffffff' },
];

function collectSubtreeAndAncestors(rootEl: HTMLElement, doc: Document): Element[] {
  const seen = new Set<Element>();
  const list: Element[] = [];

  const push = (el: Element | null | undefined) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    list.push(el);
  };

  push(doc.documentElement);
  push(doc.body);

  let anc: Element | null = rootEl.parentElement;
  while (anc) {
    push(anc);
    anc = anc.parentElement;
  }

  push(rootEl);
  rootEl.querySelectorAll('*').forEach((child) => push(child));

  return list;
}

/**
 * 1) Bakes any computed oklch/oklab/color-mix styles on the cloned DOM subtree
 *    to legacy rgb()/rgba()/#hex BEFORE mutating stylesheets (preserving exact colors).
 * 2) Scrubs all <style> and same-origin <link rel="stylesheet"> sheets in clonedDoc
 *    so html2canvas's CSS parser never encounters unsupported color functions.
 */
export function sanitizeClonedDocumentForHtml2Canvas(
  clonedDoc: Document,
  clonedEl: HTMLElement
): void {
  const view = clonedDoc.defaultView;
  const cssVars = collectCssVariables(clonedDoc);

  // Step 1: Bake computed colors onto elements while stylesheets are still active
  if (view) {
    const targets = collectSubtreeAndAncestors(clonedEl, clonedDoc);
    for (const el of targets) {
      const styleDecl = (el as HTMLElement | SVGElement).style;
      if (!styleDecl) continue;

      const cs = view.getComputedStyle(el);
      for (const { domProp, cssProp, fallback } of COMPUTED_COLOR_PROPS) {
        const val = cs[domProp] as string | undefined;
        if (val && containsModernColor(val)) {
          const safeVal = replaceModernColorFunctions(val, cssVars, fallback);
          styleDecl.setProperty(cssProp, safeVal, 'important');
        }
      }

      // Also sanitize any inline style attribute or custom CSS properties on this node
      const inlineAttr = el.getAttribute('style');
      if (inlineAttr && containsModernColor(inlineAttr)) {
        el.setAttribute('style', replaceModernColorFunctions(inlineAttr, cssVars, 'transparent'));
      }
    }
  }

  // Step 2: Replace same-origin <link rel="stylesheet"> sheets that contain modern color functions
  const sheets = Array.from(clonedDoc.styleSheets);
  for (const sheet of sheets) {
    const owner = sheet.ownerNode;
    if (!owner || owner.nodeName !== 'LINK') continue;

    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      let rawCss = '';
      for (let i = 0; i < rules.length; i++) {
        rawCss += `${rules[i].cssText}\n`;
      }
      if (!containsModernColor(rawCss)) continue;

      const sanitizedCss = replaceModernColorFunctions(rawCss, cssVars, 'transparent');
      const replacement = clonedDoc.createElement('style');
      replacement.setAttribute('data-html2canvas-sanitized', 'true');
      replacement.textContent = sanitizedCss;
      owner.parentNode?.insertBefore(replacement, owner);
      owner.parentNode?.removeChild(owner);
    } catch {
      // Cross-origin stylesheet (e.g. Google Fonts) cannot be read; safe to skip
    }
  }

  // Step 3: Scrub all <style> elements in clonedDoc
  clonedDoc.querySelectorAll('style').forEach((styleEl) => {
    const text = styleEl.textContent;
    if (text && containsModernColor(text)) {
      styleEl.textContent = replaceModernColorFunctions(text, cssVars, 'transparent');
    }
  });
}

/**
 * Drop-in wrapper around html2canvas that automatically converts Tailwind v4
 * modern CSS color functions (oklch, oklab, color-mix, etc.) to legacy sRGB
 * colors inside html2canvas's cloned document so PDF/image export never fails.
 */
export async function safeHtml2Canvas(
  element: HTMLElement,
  options: Html2CanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const userOnClone = options.onclone;
  const safeBackground =
    typeof options.backgroundColor === 'string' && containsModernColor(options.backgroundColor)
      ? replaceModernColorFunctions(options.backgroundColor, new Map(), '#ffffff')
      : options.backgroundColor;

  return html2canvas(element, {
    ...options,
    ...(safeBackground !== undefined ? { backgroundColor: safeBackground } : {}),
    onclone: (clonedDoc, clonedEl) => {
      const maybePromise = userOnClone?.(clonedDoc, clonedEl) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        return (maybePromise as Promise<void>).then(() => {
          sanitizeClonedDocumentForHtml2Canvas(clonedDoc, clonedEl);
        });
      }
      sanitizeClonedDocumentForHtml2Canvas(clonedDoc, clonedEl);
    },
  });
}
