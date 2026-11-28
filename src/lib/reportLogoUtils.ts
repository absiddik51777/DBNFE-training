export const DEFAULT_REPORT_LOGO_SIZE_PX = 60;
export const MIN_REPORT_LOGO_SIZE_PX = 36;
export const MAX_REPORT_LOGO_SIZE_PX = 110;
export const MAX_LOGO_URL_LENGTH = 160000;

const SAVED_LOGOS_STORAGE_KEY = 'bnfe_saved_report_logos_v1';
const MAX_SAVED_LOGOS = 12;

export interface SavedReportLogo {
  id: string;
  label: string;
  url: string;
  slotHint?: 'left' | 'right';
  createdAt: number;
}

export function clampReportLogoSize(value?: number | null): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_REPORT_LOGO_SIZE_PX;
  return Math.min(MAX_REPORT_LOGO_SIZE_PX, Math.max(MIN_REPORT_LOGO_SIZE_PX, Math.round(num)));
}

export function isSafeLogoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_LOGO_URL_LENGTH) return false;

  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  if (/^data:image\/svg\+xml;(?:base64,[a-zA-Z0-9+/=]+|utf8,.+)$/i.test(trimmed)) {
    return !/<script|on\w+=/i.test(trimmed);
  }
  return false;
}

export function sanitizeLogoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  return isSafeLogoUrl(trimmed) ? trimmed : '';
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('লোগোর ছবি লোড করা যায়নি।'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ফাইল পড়া যায়নি।'));
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes any user-selected logo image (PNG/JPG/WebP/SVG) into a crisp
 * transparent-friendly data URL guaranteed to fit safely within Firestore limits.
 */
export async function optimizeLogoFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('শুধুমাত্র ছবি ফাইল (PNG, JPG, WebP, SVG) নির্বাচন করুন।');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('ছবির আকার ১০ মেগাবাইটের কম হতে হবে।');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (!rawDataUrl) {
    throw new Error('ছবির তথ্য খালি পাওয়া গেছে।');
  }

  // If SVG or tiny clean PNG/WebP is already safely compact, check SVG rasterization
  // Note: rasterizing SVG to crisp 240x240 PNG ensures html2canvas PDF & HTML exports
  // always render identically across Android WebView & desktop browsers.
  const img = await loadImageElement(rawDataUrl);
  const srcW = Math.max(1, img.naturalWidth || img.width || 240);
  const srcH = Math.max(1, img.naturalHeight || img.height || 240);

  const renderAtMaxDim = (maxDim: number, mime: 'image/png' | 'image/webp', quality?: number): string => {
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    // For tiny SVGs with small intrinsic boxes, upscale gently to crisp 220px
    const targetScale = srcW < 120 && srcH < 120 ? maxDim / Math.max(srcW, srcH) : scale;
    const w = Math.max(1, Math.round(srcW * targetScale));
    const h = Math.max(1, Math.round(srcH * targetScale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return quality !== undefined ? canvas.toDataURL(mime, quality) : canvas.toDataURL(mime);
  };

  // Preserve original tiny raster PNG/WebP/JPEG if <= 90KB and dimensions <= 320px
  if (
    file.type !== 'image/svg+xml' &&
    rawDataUrl.length <= 90000 &&
    srcW <= 320 &&
    srcH <= 320 &&
    isSafeLogoUrl(rawDataUrl)
  ) {
    return rawDataUrl;
  }

  const attempts: Array<{ maxDim: number; mime: 'image/png' | 'image/webp'; quality?: number }> = [
    { maxDim: 240, mime: 'image/png' },
    { maxDim: 220, mime: 'image/webp', quality: 0.9 },
    { maxDim: 180, mime: 'image/webp', quality: 0.84 },
    { maxDim: 140, mime: 'image/webp', quality: 0.78 },
  ];

  for (const step of attempts) {
    const candidate = renderAtMaxDim(step.maxDim, step.mime, step.quality);
    if (candidate.length <= 140000 && isSafeLogoUrl(candidate)) {
      return candidate;
    }
  }

  throw new Error('লোগোর ছবিটি অনেক বড়; অনুগ্রহ করে তুলনামূলক ছোট বা কম রেজোলিউশনের ছবি দিন।');
}

export function readSavedReportLogos(): SavedReportLogo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_LOGOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedReportLogo =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        isSafeLogoUrl(item.url)
    );
  } catch {
    return [];
  }
}

export function saveReportLogoPreset(input: {
  label: string;
  url: string;
  slotHint?: 'left' | 'right';
}): SavedReportLogo[] {
  const safeUrl = sanitizeLogoUrl(input.url);
  if (!safeUrl || typeof window === 'undefined') return readSavedReportLogos();

  const existing = readSavedReportLogos().filter((item) => item.url !== safeUrl);
  const cleanLabel = (input.label || 'লোগো').replace(/\.[^.]+$/, '').trim().slice(0, 40) || 'লোগো';
  const next: SavedReportLogo[] = [
    {
      id: `logo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: cleanLabel,
      url: safeUrl,
      slotHint: input.slotHint,
      createdAt: Date.now(),
    },
    ...existing,
  ].slice(0, MAX_SAVED_LOGOS);

  try {
    localStorage.setItem(SAVED_LOGOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function removeSavedReportLogo(id: string): SavedReportLogo[] {
  if (typeof window === 'undefined') return [];
  const next = readSavedReportLogos().filter((item) => item.id !== id);
  try {
    localStorage.setItem(SAVED_LOGOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}
