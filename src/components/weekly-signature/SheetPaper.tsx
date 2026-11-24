import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SHEET_HEADING,
  DEFAULT_SHEET_PAGE_CONFIG,
  PX_PER_MM,
  computeSheetPageSlices,
  getFontCssStack,
  getPaperDimensionsMm,
  normalizePageConfig,
  toBnDigits,
  type SheetPageSlice,
  type SignatureSheetMeta,
  type SignatureTrainee,
  type WeekDayInfo,
} from './utils';

interface SheetPaperProps {
  paperRef: React.RefObject<HTMLDivElement | null>;
  days: WeekDayInfo[];
  trainees: SignatureTrainee[];
  meta: SignatureSheetMeta;
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

export const SheetPaper: React.FC<SheetPaperProps> = ({
  paperRef,
  days,
  trainees,
  meta,
}) => {
  const heading = meta.heading || DEFAULT_SHEET_HEADING;
  const pageConfig = normalizePageConfig(meta.pageConfig);
  const dims = getPaperDimensionsMm(pageConfig.paperSize, pageConfig.orientation);
  const fontCssStack = getFontCssStack(pageConfig.fontFamily);
  const scale = pageConfig.fontSizePt / DEFAULT_SHEET_PAGE_CONFIG.fontSizePt;
  const px = (basePx: number) => `${(basePx * scale).toFixed(2)}px`;

  const paperWidthPx = Math.round(dims.widthMm * PX_PER_MM);
  const paperHeightPx = Math.round(dims.heightMm * PX_PER_MM);
  const padTopPx = Math.round(pageConfig.margins.top * PX_PER_MM);
  const padRightPx = Math.round(pageConfig.margins.right * PX_PER_MM);
  const padBottomPx = Math.round(pageConfig.margins.bottom * PX_PER_MM);
  const padLeftPx = Math.round(pageConfig.margins.left * PX_PER_MM);

  const usableWidthPx = Math.max(200, paperWidthPx - padLeftPx - padRightPx);
  const usableHeightPx = Math.max(180, paperHeightPx - padTopPx - padBottomPx);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const [stackHeight, setStackHeight] = useState<number>(paperHeightPx);

  const defaultSingleSlice = useMemo<SheetPageSlice[]>(
    () => [
      {
        rowIndices: trainees.map((_, i) => i),
        includeHeader: true,
        includeTable: true,
        includeFooter: true,
      },
    ],
    [trainees]
  );

  const [pages, setPages] = useState<SheetPageSlice[]>(defaultSingleSlice);

  useEffect(() => {
    setPages(defaultSingleSlice);
  }, [defaultSingleSlice]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const measure = () => {
      const next = vp.clientWidth;
      if (next > 0) setAvailableWidth(next);
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

  const isLandscape = pageConfig.orientation === 'landscape';
  const slWidthPct = isLandscape ? 5 : 6;
  const commentWidthPct = 13;
  const nameWidthPct = days.length <= 3 ? (isLandscape ? 31 : 33) : isLandscape ? 27 : 25;
  const dayColWidthPct =
    days.length > 0 ? (100 - slWidthPct - nameWidthPct - commentWidthPct) / days.length : 0;

  const theadRowHeightPx = Math.max(36, Math.round(46 * Math.max(0.85, scale)));
  const tbodyRowHeightPx = Math.max(24, Math.round(32 * Math.max(0.82, scale)));

  useLayoutEffect(() => {
    const root = paperRef.current;
    if (!root) return;

    const calculatePages = () => {
      const tableEl = root.querySelector('table.weekly-sheet-table') as HTMLTableElement | null;
      const theadEl = tableEl?.querySelector('thead') as HTMLElement | null;
      const tbodyRows =
        trainees.length > 0 && tableEl ? Array.from(tableEl.querySelectorAll('tbody tr')) : [];
      const footerEl = root.querySelector('.weekly-sheet-footer') as HTMLElement | null;

      const topChildren = Array.from(root.children).filter(
        (el) => el !== tableEl && el !== footerEl
      ) as HTMLElement[];

      const topExtrasH = topChildren.reduce((sum, el) => {
        const cs = window.getComputedStyle(el);
        return (
          sum +
          el.offsetHeight +
          (parseFloat(cs.marginTop) || 0) +
          (parseFloat(cs.marginBottom) || 0)
        );
      }, 0);

      const theadH = theadEl ? theadEl.offsetHeight : theadRowHeightPx;
      const rowHeights = tbodyRows.map(
        (tr) => (tr as HTMLElement).offsetHeight || tbodyRowHeightPx
      );
      const footerH = footerEl ? footerEl.offsetHeight + 16 : 0;

      const nextSlices = computeSheetPageSlices({
        usableHeightPx,
        topExtrasH,
        theadH,
        rowHeights,
        footerH,
      });

      setPages((prev) => (slicesEqual(prev, nextSlices) ? prev : nextSlices));
    };

    calculatePages();

    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) calculatePages();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    paperRef,
    days,
    trainees,
    heading,
    meta.instituteName,
    meta.tradeName,
    pageConfig.paperSize,
    pageConfig.orientation,
    pageConfig.fontFamily,
    pageConfig.fontSizePt,
    usableWidthPx,
    usableHeightPx,
    theadRowHeightPx,
    tbodyRowHeightPx,
  ]);

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
  }, [paperWidthPx, paperHeightPx, pages, trainees.length, days.length, pageConfig]);

  const fitScale =
    availableWidth > 0 && availableWidth < paperWidthPx
      ? Math.max(0.25, availableWidth / paperWidthPx)
      : 1;

  const scaledOuterWidth = Math.floor(paperWidthPx * fitScale);
  const scaledOuterHeight =
    fitScale < 1 && stackHeight > 0 ? Math.ceil(stackHeight * fitScale) : undefined;

  const renderHeaderAndMeta = () => (
    <>
      {/* Centered Official Header */}
      <div className="text-center pb-3">
        {heading.govtTitle.trim() && (
          <p style={{ fontSize: px(11) }} className="leading-[1.35] text-black">
            {heading.govtTitle.trim()}
          </p>
        )}
        {heading.officeTitle.trim() && (
          <h2
            style={{ fontSize: px(15.5) }}
            className="font-bold leading-[1.35] text-black mt-0.5"
          >
            {heading.officeTitle.trim()}
          </h2>
        )}
        {heading.officeAddress.trim() && (
          <p
            style={{ fontSize: px(12) }}
            className="font-medium leading-[1.35] text-black"
          >
            {heading.officeAddress.trim()}
          </p>
        )}
        {heading.programTitle.trim() && (
          <p
            style={{ fontSize: px(11.5) }}
            className="font-semibold leading-[1.4] text-black max-w-[92%] mx-auto mt-1.5"
          >
            {heading.programTitle.trim()}
          </p>
        )}
        {heading.sheetTitle.trim() && (
          <div className="mt-1.5 inline-block border-b-2 border-black pb-1 px-3">
            <h3
              style={{ fontSize: px(14) }}
              className="font-bold text-black leading-[1.35]"
            >
              {heading.sheetTitle.trim()}
            </h3>
          </div>
        )}
      </div>

      {/* Info line: Institution left, Trade right */}
      <div
        style={{ fontSize: px(12) }}
        className="w-full flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 leading-normal text-black mb-3"
      >
        <div className="border-b border-dotted border-black pb-1">
          <span className="font-semibold">প্রতিষ্ঠান:</span>{' '}
          <span>{meta.instituteName}</span>
        </div>
        <div className="ml-auto border-b border-dotted border-black pb-1 text-right">
          <span className="font-semibold">ট্রেড:</span>{' '}
          <span>{meta.tradeName}</span>
        </div>
      </div>
    </>
  );

  const renderTable = (rowIndices: number[]) => (
    <table
      style={{ fontSize: px(11.5) }}
      className="weekly-sheet-table w-full table-fixed border-collapse border border-black text-black"
    >
      <colgroup>
        <col style={{ width: `${slWidthPct}%` }} />
        <col style={{ width: `${nameWidthPct}%` }} />
        {days.map((d) => (
          <col key={d.iso} style={{ width: `${dayColWidthPct}%` }} />
        ))}
        <col style={{ width: `${commentWidthPct}%` }} />
      </colgroup>

      <thead>
        <tr style={{ height: `${theadRowHeightPx}px` }} className="bg-[#e5e7eb]">
          <th className="border border-black px-1 pt-1 pb-2 text-center font-bold align-middle leading-[1.25]">
            ক্রমিক
          </th>
          <th className="border border-black px-1.5 pt-1 pb-2 text-left font-bold align-middle leading-[1.25]">
            প্রশিক্ষণার্থীর নাম
          </th>
          {days.map((d) => (
            <th
              key={d.iso}
              className="border border-black px-1 pt-1 pb-2 text-center font-bold align-middle"
            >
              <div className="leading-[1.25]">{d.weekdayBn}</div>
              <div
                style={{ fontSize: px(9.5) }}
                className="font-normal leading-[1.25] mt-0.5 tabular-nums"
              >
                {d.slashDateBn}
              </div>
            </th>
          ))}
          <th className="border border-black px-1.5 pt-1 pb-2 text-center font-bold align-middle leading-[1.25]">
            মন্তব্য
          </th>
        </tr>
      </thead>

      <tbody>
        {trainees.length === 0 ? (
          <tr style={{ height: `${theadRowHeightPx}px` }}>
            <td
              colSpan={days.length + 3}
              className="border border-black px-3 pt-2 pb-2.5 text-center align-middle leading-[1.3] text-slate-600"
            >
              এই ব্যাচে কোনো সক্রিয় প্রশিক্ষণার্থী পাওয়া যায়নি।
            </td>
          </tr>
        ) : (
          rowIndices.map((index) => {
            const trainee = trainees[index];
            if (!trainee) return null;
            return (
              <tr key={trainee.id} style={{ height: `${tbodyRowHeightPx}px` }}>
                <td className="border border-black px-1 pt-[3px] pb-[6px] text-center align-middle leading-[1.25] tabular-nums">
                  {toBnDigits(index + 1)}
                </td>
                <td className="border border-black px-1.5 pt-[3px] pb-[6px] text-left align-middle">
                  <div className="w-full whitespace-normal break-words leading-[1.25]">
                    {trainee.name}
                  </div>
                </td>
                {days.map((d) => (
                  <td
                    key={d.iso}
                    className="border border-black px-1 pt-[3px] pb-[6px] align-middle"
                  />
                ))}
                <td className="border border-black px-1.5 pt-[3px] pb-[6px] align-middle" />
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  const renderFooter = () => (
    <div className="weekly-sheet-footer w-full mt-3 text-black space-y-2">
      <p style={{ fontSize: px(11.5) }} className="leading-normal">
        <strong className="font-bold">
          মোট প্রশিক্ষণার্থী: {toBnDigits(trainees.length)} জন
        </strong>
        <span>
          {' '}
          · প্রতিদিনের স্বাক্ষরের সংখ্যা গণনা করে দৈনিক উপস্থিতি হিসাব করতে হবে।
        </span>
      </p>

      <div
        style={{ fontSize: px(11) }}
        className="weekly-sheet-signatures mt-[11mm] grid grid-cols-2 gap-16 max-w-[88%] mx-auto text-center"
      >
        <div className="pt-1.5 border-t border-black leading-normal">
          প্রশিক্ষকের স্বাক্ষর
        </div>
        <div className="pt-1.5 border-t border-black leading-normal">
          ফিল্ড মনিটরিং অ্যাসিস্ট্যান্ট
        </div>
      </div>

      <p style={{ fontSize: px(10) }} className="leading-normal text-black pt-1">
        বিঃদ্রঃ উপস্থিতির স্বাক্ষর অবশ্যই হাতে কলমে করতে হবে। কোনো প্রশিক্ষণার্থী অনুপস্থিত থাকলে
        স্বাক্ষরের ঘরটি ফাঁকা রাখুন এবং মন্তব্য কলামে কারণ লিখুন।
      </p>
    </div>
  );

  return (
    <div ref={viewportRef} className="w-full overflow-x-hidden print:overflow-visible">
      {/* Hidden full unsplit DOM used both for height measurement & buildPdf() capture */}
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
          ref={paperRef}
          style={{ fontFamily: fontCssStack }}
          className="weekly-sheet-paper-inner w-full bg-white text-black"
        >
          {renderHeaderAndMeta()}
          {renderTable(trainees.map((_, idx) => idx))}
          {renderFooter()}
        </div>
      </div>

      <div
        className="weekly-sheet-scale-frame mx-auto print:w-full print:h-auto"
        style={{
          width: `${scaledOuterWidth}px`,
          height: scaledOuterHeight ? `${scaledOuterHeight}px` : undefined,
        }}
      >
        <div
          ref={stackRef}
          className="weekly-sheet-pages-stack flex flex-col gap-[24px]"
          style={{
            width: `${paperWidthPx}px`,
            transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {pages.map((slice, pageIdx) => (
            <div key={pageIdx} className="weekly-sheet-page-item flex flex-col">
              <div
                style={{
                  width: `${paperWidthPx}px`,
                  minHeight: `${paperHeightPx}px`,
                  padding: `${padTopPx}px ${padRightPx}px ${padBottomPx}px ${padLeftPx}px`,
                  boxSizing: 'border-box',
                }}
                className="weekly-sheet-print-root flex flex-col justify-between bg-white text-black rounded-[12px] border border-slate-300 shadow-md print:border-none print:shadow-none print:rounded-none"
              >
                <div className="weekly-sheet-paper-scroll print:overflow-visible">
                  <div
                    style={{ fontFamily: fontCssStack }}
                    className="weekly-sheet-paper-inner w-full bg-white text-black"
                  >
                    {slice.includeHeader && renderHeaderAndMeta()}
                    {slice.includeTable && renderTable(slice.rowIndices)}
                    {slice.includeFooter && renderFooter()}
                  </div>
                </div>

                {pages.length > 1 && (
                  <div
                    style={{ fontFamily: fontCssStack, fontSize: px(10) }}
                    className="weekly-sheet-page-footer mt-2 pt-1.5 border-t border-slate-300 flex items-center justify-between text-black"
                  >
                    <span>{heading.sheetTitle.trim() || 'প্রশিক্ষণার্থী হাজিরা সিট'}</span>
                    <span className="font-semibold tabular-nums">
                      পৃষ্ঠা {toBnDigits(pageIdx + 1)} / {toBnDigits(pages.length)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
