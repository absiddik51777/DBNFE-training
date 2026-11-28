import type { Trainee } from '../types';

const BENGALI_CHAR_RE = /[\u0980-\u09FF]/;

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const ADMIN_PHRASE_MAP: ReadonlyArray<[RegExp, string]> = [
  [/পোস্ট\s*অফিস\s*[ঃ:]?/g, 'P.O:'],
  [/সিটি\s*কর্পোরেশন/g, 'City Corporation'],
  [/ডাকঘর\s*[ঃ:]?/g, 'P.O:'],
  [/ডাক\s*[ঃ:]/g, 'P.O:'],
  [/পোস্ট\s*[ঃ:]?/g, 'P.O:'],
  [/পো\s*[ঃ:]/g, 'P.O:'],
  [/গ্রাম\s*[ঃ:]?/g, 'Vill:'],
  [/উপজেলা\s*[ঃ:]?/g, 'Upazila:'],
  [/থানা\s*[ঃ:]?/g, 'P.S:'],
  [/জেলা\s*[ঃ:]?/g, 'Dist:'],
  [/বিভাগ\s*[ঃ:]?/g, 'Division:'],
  [/মহল্লা\s*[ঃ:]?/g, 'Mahalla:'],
  [/ওয়ার্ড\s*নং/g, 'Ward No.'],
  [/ওয়ার্ড\s*নং/g, 'Ward No.'],
  [/ওয়ার্ড/g, 'Ward'],
  [/ওয়ার্ড/g, 'Ward'],
  [/ইউনিয়ন\s*পরিষদ/g, 'Union Parishad'],
  [/ইউনিয়ন\s*পরিষদ/g, 'Union Parishad'],
  [/ইউনিয়ন/g, 'Union'],
  [/ইউনিয়ন/g, 'Union'],
  [/পৌরসভা/g, 'Municipality'],
  [/সড়ক/g, 'Road'],
  [/সড়ক/g, 'Road'],
  [/রোড/g, 'Road'],
  [/লেন/g, 'Lane'],
  [/বাসা\s*নং/g, 'House No.'],
  [/বাড়ি\s*নং/g, 'House No.'],
  [/বাড়ি\s*নং/g, 'House No.'],
  [/বাসা/g, 'House'],
  [/বাড়ি/g, 'House'],
  [/বাড়ি/g, 'House'],
  [/সেক্টর/g, 'Sector'],
  [/ব্লক/g, 'Block'],
  [/নং/g, 'No.'],
  [/সদর/g, 'Sadar'],
  [/বাজার/g, 'Bazar'],
  [/পূর্ব/g, 'Purbo'],
  [/পশ্চিম/g, 'Paschim'],
  [/উত্তর/g, 'Uttar'],
  [/দক্ষিণ/g, 'Dakshin'],
  [/মধ্য/g, 'Madhya'],
  [/নতুন/g, 'Natun'],
  [/পুরাতন/g, 'Puraton'],
  [/বাংলাদেশ/g, 'Bangladesh'],
  // Common districts & upazilas for exact official spellings
  [/ময়মনসিংহ/g, 'Mymensingh'],
  [/ময়মনসিংহ/g, 'Mymensingh'],
  [/হালুয়াঘাট/g, 'Haluaghat'],
  [/হালুয়াঘাট/g, 'Haluaghat'],
  [/ধোবাউড়া/g, 'Dhobaura'],
  [/ধোবাউড়া/g, 'Dhobaura'],
  [/ফুলপুর/g, 'Phulpur'],
  [/ত্রিশাল/g, 'Trishal'],
  [/ভালুকা/g, 'Bhaluka'],
  [/গফরগাঁও/g, 'Gaffargaon'],
  [/নান্দাইল/g, 'Nandail'],
  [/ঈশ্বরগঞ্জ/g, 'Ishwarganj'],
  [/গৌরীপুর/g, 'Gouripur'],
  [/মুক্তাগাছা/g, 'Muktagacha'],
  [/তারাকান্দা/g, 'Tarakanda'],
  [/ফুলবাড়িয়া/g, 'Phulbaria'],
  [/ফুলবাড়িয়া/g, 'Phulbaria'],
  [/ঢাকা/g, 'Dhaka'],
  [/চট্টগ্রাম/g, 'Chattogram'],
  [/রাজশাহী/g, 'Rajshahi'],
  [/খুলনা/g, 'Khulna'],
  [/সিলেট/g, 'Sylhet'],
  [/বরিশাল/g, 'Barishal'],
  [/রংপুর/g, 'Rangpur'],
  [/কুমিল্লা/g, 'Cumilla'],
  [/গাজীপুর/g, 'Gazipur'],
  [/নারায়ণগঞ্জ/g, 'Narayanganj'],
  [/নারায়ণগঞ্জ/g, 'Narayanganj'],
  [/টাঙ্গাইল/g, 'Tangail'],
  [/জামালপুর/g, 'Jamalpur'],
  [/শেরপুর/g, 'Sherpur'],
  [/নেত্রকোনা/g, 'Netrokona'],
  [/কিশোরগঞ্জ/g, 'Kishoreganj'],
  [/বগুড়া/g, 'Bogra'],
  [/বগুড়া/g, 'Bogra'],
  [/যশোর/g, 'Jashore'],
  [/দিনাজপুর/g, 'Dinajpur'],
  [/পাবনা/g, 'Pabna'],
  [/নোয়াখালী/g, 'Noakhali'],
  [/নোয়াখালী/g, 'Noakhali'],
  [/ফরিদপুর/g, 'Faridpur'],
  [/কাচারি/g, 'Kachari'],
];

const VOWELS: Record<string, string> = {
  'অ': 'O',
  'আ': 'A',
  'ই': 'I',
  'ঈ': 'I',
  'উ': 'U',
  'ঊ': 'U',
  'ঋ': 'Ri',
  'এ': 'E',
  'ঐ': 'Oi',
  'ও': 'O',
  'ঔ': 'Ou',
};

const CONSONANTS: Record<string, string> = {
  'ক': 'k',
  'খ': 'kh',
  'গ': 'g',
  'ঘ': 'gh',
  'ঙ': 'ng',
  'চ': 'ch',
  'ছ': 'chh',
  'জ': 'j',
  'ঝ': 'jh',
  'ঞ': 'n',
  'ট': 't',
  'ঠ': 'th',
  'ড': 'd',
  'ঢ': 'dh',
  'ণ': 'n',
  'ত': 't',
  'থ': 'th',
  'দ': 'd',
  'ধ': 'dh',
  'ন': 'n',
  'প': 'p',
  'ফ': 'ph',
  'ব': 'b',
  'ভ': 'bh',
  'ম': 'm',
  'য': 'j',
  'র': 'r',
  'ল': 'l',
  'শ': 'sh',
  'ষ': 'sh',
  'স': 's',
  'হ': 'h',
  'ড়': 'r',
  'ঢ়': 'rh',
  'য়': 'y',
  'ৎ': 't',
};

const KARS: Record<string, string> = {
  'া': 'a',
  'ি': 'i',
  'ী': 'i',
  'ু': 'u',
  'ূ': 'u',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
};

const CONJUNCTS: Record<string, string> = {
  'ক্ষ': 'ksh',
  'জ্ঞ': 'gy',
  'ঞ্জ': 'nj',
  'ঙ্গ': 'ng',
  'ঙ্ক': 'nk',
  'ন্দ': 'nd',
  'ন্ত': 'nt',
  'ন্থ': 'nth',
  'ন্ধ': 'ndh',
  'ম্প': 'mp',
  'ম্ব': 'mb',
  'ম্ভ': 'mbh',
  'স্ত': 'st',
  'স্থ': 'sth',
  'ষ্ট': 'sht',
  'ষ্ঠ': 'shth',
  'স্ক': 'sk',
  'স্প': 'sp',
  'স্ম': 'sm',
  'ত্র': 'tr',
  'শ্র': 'shr',
  'দ্র': 'dr',
  'প্র': 'pr',
  'ব্র': 'br',
  'ক্র': 'kr',
  'গ্র': 'gr',
  'ক্ত': 'kt',
  'ত্ত': 'tt',
  'ন্ন': 'nn',
  'ম্ম': 'mm',
  'ল্ল': 'll',
  'জ্জ': 'jj',
  'চ্চ': 'cch',
  'দ্দ': 'dd',
  'ব্দ': 'bd',
};

const HASANTA = '্';

function transliterateBengaliWord(word: string): string {
  if (!BENGALI_CHAR_RE.test(word)) return word;

  const chars = Array.from(word);
  let out = '';
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    // Digits
    if (ch in BN_TO_EN_DIGITS) {
      out += BN_TO_EN_DIGITS[ch];
      i += 1;
      continue;
    }

    // Independent vowels
    if (ch in VOWELS) {
      out += i === 0 ? VOWELS[ch] : VOWELS[ch].toLowerCase();
      i += 1;
      continue;
    }

    // Check 3-char conjunct (C + hasanta + C)
    if (i + 2 < chars.length && chars[i + 1] === HASANTA) {
      const triple = ch + HASANTA + chars[i + 2];
      if (triple in CONJUNCTS) {
        out += CONJUNCTS[triple];
        i += 3;
        // Check trailing kar or inherent vowel
        if (i < chars.length && chars[i] in KARS) {
          out += KARS[chars[i]];
          i += 1;
        } else if (i < chars.length && chars[i] === HASANTA) {
          i += 1;
        } else if (i < chars.length && chars[i] in CONSONANTS) {
          out += 'a';
        }
        continue;
      }
    }

    // Regular consonant
    if (ch in CONSONANTS) {
      let piece = CONSONANTS[ch];
      const next = chars[i + 1];

      // Ya-phala / Ra-phala / Ba-phala
      if (next === HASANTA && i + 2 < chars.length) {
        const afterHasanta = chars[i + 2];
        if (afterHasanta === 'য') {
          piece = i === 0 ? piece + 'y' : piece + piece;
          i += 3;
          if (i < chars.length && chars[i] in KARS) {
            out += piece + KARS[chars[i]];
            i += 1;
          } else {
            out += piece + (i < chars.length ? 'a' : '');
          }
          continue;
        }
        if (afterHasanta === 'র') {
          out += piece + 'r';
          i += 3;
          if (i < chars.length && chars[i] in KARS) {
            out += KARS[chars[i]];
            i += 1;
          } else if (i < chars.length) {
            out += 'a';
          }
          continue;
        }
        if (afterHasanta === 'ব') {
          out += piece + (i === 0 ? '' : 'w');
          i += 3;
          if (i < chars.length && chars[i] in KARS) {
            out += KARS[chars[i]];
            i += 1;
          } else if (i < chars.length) {
            out += 'a';
          }
          continue;
        }
        // Generic consonant cluster: emit base without inherent vowel
        out += piece;
        i += 2;
        continue;
      }

      out += piece;
      i += 1;

      if (i < chars.length && chars[i] in KARS) {
        out += KARS[chars[i]];
        i += 1;
      } else if (i < chars.length && chars[i] === HASANTA) {
        i += 1;
      } else if (
        i < chars.length &&
        (chars[i] in CONSONANTS || chars[i] === 'ং')
      ) {
        // Inherent vowel inside word
        out += chars[i] === 'ং' ? 'o' : 'a';
      }
      continue;
    }

    // Modifiers & punctuation
    if (ch === 'ং') {
      out += 'ng';
      i += 1;
      continue;
    }
    if (ch === 'ঃ') {
      out += i === chars.length - 1 ? ':' : 'h';
      i += 1;
      continue;
    }
    if (ch === 'ঁ' || ch === HASANTA || ch === '়') {
      i += 1;
      continue;
    }
    if (ch === '।') {
      out += '.';
      i += 1;
      continue;
    }
    if (ch in KARS) {
      out += KARS[ch];
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  if (!out) return '';
  // Capitalize first ASCII letter of Bengali-transliterated word
  return out.replace(/^([a-z])/, (m) => m.toUpperCase());
}

/**
 * Converts a Bengali address or text into clean, readable Title-Case English.
 * Preserves existing English words and numbers.
 */
export function transliterateBengaliToEnglish(input?: string | null): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  if (!BENGALI_CHAR_RE.test(raw)) return raw;

  let text = raw
    .replace(/[\u09E6-\u09EF]/g, (d) => BN_TO_EN_DIGITS[d] ?? d)
    .replace(/।/g, '.')
    .replace(/ঃ/g, ':');

  // Apply administrative label & place dictionary replacements
  for (const [pattern, replacement] of ADMIN_PHRASE_MAP) {
    text = text.replace(pattern, replacement);
  }

  // Transliterate any remaining Bengali word tokens
  const converted = text.replace(/[\u0980-\u09FF]+/g, (bnToken) =>
    transliterateBengaliWord(bnToken)
  );

  // Clean spacing around colons and commas
  return converted
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getTraineePresentAddressEn(t: Partial<Trainee>): string {
  const explicit =
    t.presentAddressEn?.trim() ||
    t.addressEn?.trim() ||
    (t.sameAsPermanentAddress ? t.permanentAddressEn?.trim() : '');
  if (explicit) return explicit;
  const bnSource = t.presentAddress || t.permanentAddress || t.address || '';
  return transliterateBengaliToEnglish(bnSource);
}

export function getTraineePermanentAddressEn(t: Partial<Trainee>): string {
  const explicit = t.permanentAddressEn?.trim();
  if (explicit) return explicit;
  const bnSource = t.permanentAddress || t.address || '';
  return transliterateBengaliToEnglish(bnSource);
}
