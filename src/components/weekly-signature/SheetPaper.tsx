import React from 'react';
import {
  toBnDigits,
  type SignatureSheetMeta,
  type SignatureTrainee,
  type WeekDayInfo,
} from './utils';
import { TruncatedText } from '../ui/TruncatedText';

interface SheetPaperProps {
  paperRef: React.RefObject<HTMLDivElement | null>;
  days: WeekDayInfo[];
  trainees: SignatureTrainee[];
  meta: SignatureSheetMeta;
}

export const SheetPaper: React.FC<SheetPaperProps> = ({
  paperRef,
  days,
  trainees,
  meta,
}) => {
  // Fixed column width allocation on paper (total 100%)
  const slWidthPct = 6;
  const commentWidthPct = 15;
  const nameWidthPct = days.length <= 3 ? 31 : 23;
  const dayColWidthPct =
    days.length > 0 ? (100 - slWidthPct - nameWidthPct - commentWidthPct) / days.length : 0;

  return (
    <div className="weekly-sheet-print-root min-[700px]:max-w-[210mm] mx-auto bg-white text-black rounded-[12px] border border-slate-300 shadow-md print:border-none print:shadow-none print:rounded-none">
      <div className="weekly-sheet-paper-scroll overflow-x-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
        <div
          ref={paperRef}
          className="weekly-sheet-paper-inner min-w-[600px] bg-white text-black font-sans"
        >
          {/* Centered Official Header */}
          <div className="text-center pb-2.5">
            <p className="text-[11px] leading-tight text-black">
              গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
            </p>
            <h2 className="text-[16px] font-bold leading-snug text-black mt-0.5">
              উপানুষ্ঠানিক শিক্ষা ব্যুরো
            </h2>
            <div className="mt-1 inline-block border-b-2 border-black pb-0.5 px-3">
              <h3 className="text-[14px] font-bold text-black leading-snug">
                প্রশিক্ষণার্থী হাজিরা সিট
              </h3>
            </div>
          </div>

          {/* Info line: Institution left, Trade right */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[12px] text-black mb-2.5">
            <div className="border-b border-dotted border-black pb-0.5">
              <span className="font-semibold">প্রতিষ্ঠান:</span>{' '}
              <span>{meta.instituteName}</span>
            </div>
            <div className="ml-auto border-b border-dotted border-black pb-0.5 text-right">
              <span className="font-semibold">ট্রেড:</span>{' '}
              <span>{meta.tradeName}</span>
            </div>
          </div>

          {/* Attendance Signature Table (table-layout: fixed, 1px black borders, NO ID column) */}
          <table className="weekly-sheet-table w-full table-fixed border-collapse border border-black text-[11.5px] text-black">
            <colgroup>
              <col style={{ width: `${slWidthPct}%` }} />
              <col style={{ width: `${nameWidthPct}%` }} />
              {days.map((d) => (
                <col key={d.iso} style={{ width: `${dayColWidthPct}%` }} />
              ))}
              <col style={{ width: `${commentWidthPct}%` }} />
            </colgroup>

            <thead>
              <tr className="bg-[#e5e7eb] h-[12mm]">
                <th className="border border-black px-1 py-1 text-center font-bold align-middle">
                  ক্রমিক
                </th>
                <th className="border border-black px-1.5 py-1 text-left font-bold align-middle">
                  প্রশিক্ষণার্থীর নাম
                </th>
                {days.map((d) => (
                  <th
                    key={d.iso}
                    className="border border-black px-1 py-1 text-center font-bold align-middle"
                  >
                    <div className="leading-tight">{d.weekdayBn}</div>
                    <div className="text-[9.5px] font-normal leading-tight mt-0.5 tabular-nums">
                      {d.slashDateBn}
                    </div>
                  </th>
                ))}
                <th className="border border-black px-1.5 py-1 text-center font-bold align-middle">
                  মন্তব্য
                </th>
              </tr>
            </thead>

            <tbody>
              {trainees.map((trainee, index) => (
                <tr key={trainee.id} className="h-[8.2mm]">
                  <td className="border border-black px-1 text-center align-middle tabular-nums">
                    {toBnDigits(index + 1)}
                  </td>
                  <td className="border border-black px-1.5 text-left align-middle">
                    <TruncatedText
                      as="div"
                      text={trainee.name}
                      mode="pop"
                      className="w-full print:no-underline"
                    />
                  </td>
                  {days.map((d) => (
                    <td key={d.iso} className="border border-black px-1 align-middle" />
                  ))}
                  <td className="border border-black px-1.5 align-middle" />
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer: Totals + 3 Signature Blocks + Handwritten Note */}
          <div className="weekly-sheet-footer mt-2.5 text-black space-y-2">
            <p className="text-[11.5px] leading-snug">
              <strong className="font-bold">
                মোট প্রশিক্ষণার্থী: {toBnDigits(trainees.length)} জন
              </strong>
              <span>
                {' '}
                · প্রতিদিনের স্বাক্ষরের সংখ্যা গণনা করে দৈনিক উপস্থিতি হিসাব করতে হবে।
              </span>
            </p>

            <div className="weekly-sheet-signatures mt-[11mm] grid grid-cols-3 gap-6 text-[11px] text-center">
              <div className="pt-1.5 border-t border-black">প্রশিক্ষকের স্বাক্ষর</div>
              <div className="pt-1.5 border-t border-black">
                ফিল্ড মনিটরিং অ্যাসিস্ট্যান্ট
              </div>
              <div className="pt-1.5 border-t border-black">প্রতিষ্ঠান প্রধান</div>
            </div>

            <p className="text-[10px] leading-snug text-black pt-1">
              বিঃদ্রঃ উপস্থিতির স্বাক্ষর অবশ্যই হাতে কলমে করতে হবে। কোনো প্রশিক্ষণার্থী অনুপস্থিত থাকলে
              স্বাক্ষরের ঘরটি ফাঁকা রাখুন এবং মন্তব্য কলামে কারণ লিখুন।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
