import { Institute, Trade, Batch, Trainee, AttendanceRecord, AttendanceStatus } from '../types';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export const DEFAULT_INSTITUTES: Institute[] = [
  {
    id: 'INS-HLG-01',
    code: 'INS-01',
    name: 'হালুয়াঘাট কারিগরি প্রশিক্ষণ কেন্দ্র',
    address: 'উপজেলা পরিষদ সংলগ্ন, হালুয়াঘাট, ময়মনসিংহ',
    contactPerson: 'মোঃ সাইফুল ইসলাম (টিসি ইনচার্জ)',
    phone: '01712-345678',
    email: 'haluaghat.tc@bnfe.gov.bd',
    status: 'Active',
    createdAt: Date.now() - 90 * 86400000
  },
  {
    id: 'INS-DHB-02',
    code: 'INS-02',
    name: 'ধোবাউড়া বৃত্তিমূলক প্রশিক্ষণ কেন্দ্র',
    address: 'ডাকবাংলো মোড়, ধোবাউড়া, ময়মনসিংহ',
    contactPerson: 'আনিসুর রহমান (সমন্বয়ক)',
    phone: '01819-876543',
    email: 'dhobaura.vtc@bnfe.gov.bd',
    status: 'Active',
    createdAt: Date.now() - 90 * 86400000
  }
];

export const DEFAULT_TRADES: Trade[] = [
  {
    id: 'TRD-CAG-01',
    name: 'কম্পিউটার অফিস অ্যাপ্লিকেশান ও গ্রাফিক্স ডিজাইন',
    code: 'TRD-01',
    description: 'কম্পিউটার বেসিক, মাইক্রোসফট অফিস, ইন্টারনেট ব্রাউজিং ও গ্রাফিক্স ডিজাইন',
    duration: '৬ মাস (৩৬০ ঘণ্টা)',
    status: 'Active',
    createdAt: Date.now() - 90 * 86400000
  },
  {
    id: 'TRD-HWE-02',
    name: 'ইলেকট্রিক্যাল হাউজ ওয়্যারিং ও মোটর ওয়াইন্ডিং',
    code: 'TRD-02',
    description: 'গৃহস্থালি ও বাণিজ্যিক বৈদ্যুতিক সংযোগ, লোড ক্যালকুলেশন ও সার্কিট ওয়্যারিং',
    duration: '৬ মাস (৩৬০ ঘণ্টা)',
    status: 'Active',
    createdAt: Date.now() - 90 * 86400000
  },
  {
    id: 'TRD-TLS-03',
    name: 'টেইলারিং, কাটিং ও সুইং মেশিন অপারেশন',
    code: 'TRD-03',
    description: 'পোশাক তৈরি, প্যাটার্ন কাটিং ও আধুনিক সেলাই মেশিন পরিচালনা ও রক্ষণাবেক্ষণ',
    duration: '৬ মাস (৩৬০ ঘণ্টা)',
    status: 'Active',
    createdAt: Date.now() - 90 * 86400000
  }
];

export const DEFAULT_BATCHES: Batch[] = [
  {
    id: 'BAT-01',
    name: 'ব্যাচ ০১ (কম্পিউটার অ্যাপ্লিকেশান - হালুয়াঘাট)',
    instituteId: 'INS-HLG-01',
    tradeId: 'TRD-CAG-01',
    startDate: new Date(new Date().getFullYear(), 0, 1).getTime(),
    endDate: new Date(new Date().getFullYear(), 5, 30).getTime(),
    maxTrainees: 30,
    status: 'Active',
    createdAt: Date.now() - 80 * 86400000
  },
  {
    id: 'BAT-02',
    name: 'ব্যাচ ০২ (ইলেকট্রিক্যাল ওয়্যারিং - হালুয়াঘাট)',
    instituteId: 'INS-HLG-01',
    tradeId: 'TRD-HWE-02',
    startDate: new Date(new Date().getFullYear(), 0, 1).getTime(),
    endDate: new Date(new Date().getFullYear(), 5, 30).getTime(),
    maxTrainees: 30,
    status: 'Active',
    createdAt: Date.now() - 80 * 86400000
  },
  {
    id: 'BAT-03',
    name: 'ব্যাচ ০১ (টেইলারিং ও সেলাই - ধোবাউড়া)',
    instituteId: 'INS-DHB-02',
    tradeId: 'TRD-TLS-03',
    startDate: new Date(new Date().getFullYear(), 0, 1).getTime(),
    endDate: new Date(new Date().getFullYear(), 5, 30).getTime(),
    maxTrainees: 30,
    status: 'Active',
    createdAt: Date.now() - 80 * 86400000
  }
];

export const DEMO_TRAINEE_TEMPLATES = [
  {
    nameBn: 'মোঃ রাকিবুল হাসান',
    nameEn: 'Md. Rakibul Hasan',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ আব্দুল জলিল',
    fatherNameEn: 'Md. Abdul Jalil',
    motherNameBn: 'রোকেয়া বেগম',
    motherNameEn: 'Rokeya Begum',
    dateOfBirth: '2006-03-15',
    mobileNumber: '01712-458901',
    village: 'ধারা বাজার',
    previousSchool: 'ধারা আদর্শ উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'জান্নাতুল ফেরদৌস',
    nameEn: 'Jannatul Ferdous',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ রফিকুল ইসলাম',
    fatherNameEn: 'Md. Rafiqul Islam',
    motherNameBn: 'জাহানারা বেগম',
    motherNameEn: 'Jahanara Begum',
    dateOfBirth: '2007-06-20',
    mobileNumber: '01819-334512',
    village: 'খয়রাকুড়ি',
    previousSchool: 'হালুয়াঘাট বালিকা উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ তানভীর আহমেদ',
    nameEn: 'Md. Tanvir Ahmed',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ নূরুল ইসলাম',
    fatherNameEn: 'Md. Nurul Islam',
    motherNameBn: 'আমেনা খাতুন',
    motherNameEn: 'Amena Khatun',
    dateOfBirth: '2006-08-10',
    mobileNumber: '01914-789023',
    village: 'বিলডোরা',
    previousSchool: 'বিলডোরা বহুমুখী উচ্চ বিদ্যালয়',
    lastClass: 'Class 7 (৭ম শ্রেণি)',
  },
  {
    nameBn: 'ফাতেমা আক্তার',
    nameEn: 'Fatema Akhter',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ আব্দুল মান্নান',
    fatherNameEn: 'Md. Abdul Mannan',
    motherNameBn: 'ফরিদা ইয়াসমিন',
    motherNameEn: 'Farida Yasmin',
    dateOfBirth: '2006-11-25',
    mobileNumber: '01733-567890',
    village: 'নড়াইল',
    previousSchool: 'নড়াইল মডেল হাই স্কুল',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ সোহেল রানা',
    nameEn: 'Md. Sohel Rana',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ মোজাম্মেল হক',
    fatherNameEn: 'Md. Mozammel Haque',
    motherNameBn: 'নাজমা আক্তার',
    motherNameEn: 'Najma Akhter',
    dateOfBirth: '2005-12-05',
    mobileNumber: '01845-678912',
    village: 'শাকুয়াই',
    previousSchool: 'শাকুয়াই ইউনিয়ন উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'রুমানা আক্তার',
    nameEn: 'Rumana Akhter',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ মজিবুর রহমান',
    fatherNameEn: 'Md. Mojibur Rahman',
    motherNameBn: 'মরিয়ম বেগম',
    motherNameEn: 'Moriyom Begum',
    dateOfBirth: '2007-04-18',
    mobileNumber: '01923-890123',
    village: 'গাজিরভিটা',
    previousSchool: 'গাজিরভিটা হাই স্কুল',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ আরিফুল ইসলাম',
    nameEn: 'Md. Ariful Islam',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ শাহ আলম',
    fatherNameEn: 'Md. Shah Alam',
    motherNameBn: 'সুলতানা রাজিয়া',
    motherNameEn: 'Sultana Razia',
    dateOfBirth: '2006-07-22',
    mobileNumber: '01711-234567',
    village: 'আমতৈল',
    previousSchool: 'আমতৈল উচ্চ বিদ্যালয়',
    lastClass: 'Class 7 (৭ম শ্রেণি)',
  },
  {
    nameBn: 'সাদিয়া আফরিন',
    nameEn: 'Sadia Afrin',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ কামাল হোসেন',
    fatherNameEn: 'Md. Kamal Hossain',
    motherNameBn: 'শাহানাজ পারভীন',
    motherNameEn: 'Shahanaj Parvin',
    dateOfBirth: '2007-02-14',
    mobileNumber: '01867-890123',
    village: 'কৈচাপুর',
    previousSchool: 'কৈচাপুর বালিকা বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ শামীম হোসেন',
    nameEn: 'Md. Shamim Hossain',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ জহিরুল ইসলাম',
    fatherNameEn: 'Md. Johirul Islam',
    motherNameBn: 'পারভীন আক্তার',
    motherNameEn: 'Parvin Akhter',
    dateOfBirth: '2006-09-30',
    mobileNumber: '01955-432109',
    village: 'বাঘাইতলা',
    previousSchool: 'বাঘাইতলা উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'নাছরিন জাহান',
    nameEn: 'Nasrin Jahan',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ মোশাররফ হোসেন',
    fatherNameEn: 'Md. Mosharraf Hossain',
    motherNameBn: 'হাসিনা বানু',
    motherNameEn: 'Hasina Banu',
    dateOfBirth: '2007-05-12',
    mobileNumber: '01777-654321',
    village: 'পোড়াকান্দুলিয়া',
    previousSchool: 'পোড়াকান্দুলিয়া উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ মেহেদী হাসান',
    nameEn: 'Md. Mehedi Hasan',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ সিরাজুল ইসলাম',
    fatherNameEn: 'Md. Sirajul Islam',
    motherNameBn: 'রেহেনা পারভীন',
    motherNameEn: 'Rehena Parvin',
    dateOfBirth: '2006-01-19',
    mobileNumber: '01822-112233',
    village: 'ঘোষগাঁও',
    previousSchool: 'ঘোষগাঁও বহুমুখী উচ্চ বিদ্যালয়',
    lastClass: 'Class 7 (৭ম শ্রেণি)',
  },
  {
    nameBn: 'সুমাইয়া আক্তার',
    nameEn: 'Sumaiya Akhter',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ আনোয়ার হোসেন',
    fatherNameEn: 'Md. Anwar Hossain',
    motherNameBn: 'কুলসুম বেগম',
    motherNameEn: 'Kulsum Begum',
    dateOfBirth: '2007-08-08',
    mobileNumber: '01988-776655',
    village: 'ভূঁইয়াপাড়া',
    previousSchool: 'হালুয়াঘাট মডেল হাই স্কুল',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ নাঈমুল ইসলাম',
    nameEn: 'Md. Naimul Islam',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ ফরহাদ আলী',
    fatherNameEn: 'Md. Farhad Ali',
    motherNameBn: 'মোর্শেদা বেগম',
    motherNameEn: 'Morsheda Begum',
    dateOfBirth: '2006-10-15',
    mobileNumber: '01744-998877',
    village: 'জুগরী',
    previousSchool: 'জুগরী উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'শারমিন সুলতানা',
    nameEn: 'Sharmin Sultana',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ তোফাজ্জল হোসেন',
    fatherNameEn: 'Md. Tofazzal Hossain',
    motherNameBn: 'আলেয়া বেগম',
    motherNameEn: 'Aleya Begum',
    dateOfBirth: '2007-03-27',
    mobileNumber: '01855-334455',
    village: 'মাইজপাড়া',
    previousSchool: 'মাইজপাড়া উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ আল-আমিন',
    nameEn: 'Md. Al-Amin',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ লাল মিয়া',
    fatherNameEn: 'Md. Lal Mia',
    motherNameBn: 'শহীদা বেগম',
    motherNameEn: 'Shohida Begum',
    dateOfBirth: '2005-09-09',
    mobileNumber: '01966-223344',
    village: 'ধারা মধ্যপাড়া',
    previousSchool: 'ধারা আদর্শ উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'খাদিজা খাতুন',
    nameEn: 'Khadija Khatun',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ জসিম উদ্দিন',
    fatherNameEn: 'Md. Jasim Uddin',
    motherNameBn: 'মাহমুদা আক্তার',
    motherNameEn: 'Mahmuda Akhter',
    dateOfBirth: '2007-11-11',
    mobileNumber: '01788-114477',
    village: 'তেলিগাঁও',
    previousSchool: 'তেলিগাঁও উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ শাকিল আহমেদ',
    nameEn: 'Md. Shakil Ahmed',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ ইউনুস আলী',
    fatherNameEn: 'Md. Younus Ali',
    motherNameBn: 'রাশিদা বেগম',
    motherNameEn: 'Rashida Begum',
    dateOfBirth: '2006-02-28',
    mobileNumber: '01833-889900',
    village: 'উত্তর খয়রাকুড়ি',
    previousSchool: 'হালুয়াঘাট আদর্শ উচ্চ বিদ্যালয়',
    lastClass: 'Class 7 (৭ম শ্রেণি)',
  },
  {
    nameBn: 'তানজিলা আক্তার',
    nameEn: 'Tanjila Akhter',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ খলিলুর রহমান',
    fatherNameEn: 'Md. Khalilur Rahman',
    motherNameBn: 'সেলিনা বেগম',
    motherNameEn: 'Selina Begum',
    dateOfBirth: '2007-09-17',
    mobileNumber: '01911-556677',
    village: 'বড়ইকান্দি',
    previousSchool: 'ধোবাউড়া বালিকা বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মোঃ ইমরান হোসেন',
    nameEn: 'Md. Imran Hossain',
    gender: 'Male' as const,
    fatherNameBn: 'মোঃ সাইদুর রহমান',
    fatherNameEn: 'Md. Saidur Rahman',
    motherNameBn: 'মনোয়ারা বেগম',
    motherNameEn: 'Monowara Begum',
    dateOfBirth: '2005-10-24',
    mobileNumber: '01722-667788',
    village: 'ঘোষগাঁও বাজার',
    previousSchool: 'ঘোষগাঁও বহুমুখী উচ্চ বিদ্যালয়',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  },
  {
    nameBn: 'মারুফা আক্তার',
    nameEn: 'Marufa Akhter',
    gender: 'Female' as const,
    fatherNameBn: 'মোঃ বাবুল মিয়া',
    fatherNameEn: 'Md. Babul Mia',
    motherNameBn: 'রোকেয়া সুলতানা',
    motherNameEn: 'Rokeya Sultana',
    dateOfBirth: '2007-07-07',
    mobileNumber: '01899-445566',
    village: 'গোয়াতলা',
    previousSchool: 'ধোবাউড়া আদর্শ স্কুল',
    lastClass: 'Class 8 (৮ম শ্রেণি)',
  }
];

/**
 * Generate 20 demo trainees for a specific batch.
 */
export function generate20TraineesForBatch(
  batch: Batch,
  batchIndex: number,
  globalStartIndex: number
): Trainee[] {
  const currentYear = new Date().getFullYear();
  const cleanBatchId = batch.id.replace(/[^A-Za-z0-9]/g, '');

  return DEMO_TRAINEE_TEMPLATES.map((tmpl, idx) => {
    const traineeNumber = globalStartIndex + idx + 1;
    const serialFormatted = String(idx + 1).padStart(2, '0');
    const regFormatted = String(idx + 1).padStart(3, '0');
    
    // Auto-generated Trainee ID
    const autoTraineeId = `TR-${1000 + traineeNumber}`;
    // Registration Number (user specified: separate field)
    const regNumber = `REG-${currentYear}-${cleanBatchId}-${regFormatted}`;

    const upazila = batch.instituteId === 'INS-DHB-02' ? 'ধোবাউড়া' : 'হালুয়াঘাট';
    const addressStr = `গ্রাম: ${tmpl.village}, ডাকঘর: ${upazila}, উপজেলা: ${upazila}, জেলা: ময়মনসিংহ`;

    const traineeObj: Trainee = {
      id: `TRN-${batch.id}-${serialFormatted}`,
      traineeId: autoTraineeId,
      registrationNumber: regNumber,
      nameEn: tmpl.nameEn,
      nameBn: tmpl.nameBn,
      fatherNameEn: tmpl.fatherNameEn,
      fatherNameBn: tmpl.fatherNameBn,
      motherNameEn: tmpl.motherNameEn,
      motherNameBn: tmpl.motherNameBn,
      dateOfBirth: tmpl.dateOfBirth,
      gender: tmpl.gender,
      nidOrBirthRegistration: `2006611382400${batchIndex + 1}${regFormatted}`,
      mobileNumber: tmpl.mobileNumber,
      address: addressStr,
      permanentAddress: addressStr,
      presentAddress: addressStr,
      sameAsPermanentAddress: true,
      
      lastClassCompleted: tmpl.lastClass,
      previousSchoolName: tmpl.previousSchool,
      yearOfDropout: '2023',
      reasonForDropout: 'পারিবারিক অসচ্ছলতা ও কর্মসংস্থান',

      instituteId: batch.instituteId,
      tradeId: batch.tradeId,
      batchId: batch.id,
      admissionDate: batch.startDate || Date.now() - 30 * 86400000,
      trainingStartDate: batch.startDate || Date.now() - 30 * 86400000,
      trainingEndDate: batch.endDate || Date.now() + 150 * 86400000,
      status: 'Active',
      createdAt: Date.now() - (20 - idx) * 3600000
    };

    return traineeObj;
  });
}

/**
 * Generate sample monthly attendance records for a batch and its trainees
 * so that the attendance register has realistic "P", "A", and "L" entries.
 */
export function generateSampleAttendance(
  batch: Batch,
  trainees: Trainee[],
  yearMonth?: string // format: YYYY-MM
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  const year = yearMonth ? parseInt(yearMonth.split('-')[0], 10) : now.getFullYear();
  const month = yearMonth ? parseInt(yearMonth.split('-')[1], 10) - 1 : now.getMonth();
  
  // Total days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxDay = (year === now.getFullYear() && month === now.getMonth()) 
    ? Math.min(now.getDate(), daysInMonth) 
    : daysInMonth;

  for (let day = 1; day <= maxDay; day++) {
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay(); // 5 = Friday in JS (0=Sun, 5=Fri, 6=Sat)
    if (dayOfWeek === 5) continue; // Skip Friday (Govt weekly holiday)

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    trainees.forEach((trainee, traineeIdx) => {
      // Deterministic pseudo-random status
      const seed = (day * 13 + traineeIdx * 17 + dayOfWeek * 7) % 100;
      let status: AttendanceStatus = 'Present';
      if (seed > 92) {
        status = 'Absent';
      } else if (seed > 86) {
        status = 'Leave';
      }

      records.push({
        id: `ATT-${batch.id}-${dateStr}-${trainee.id}`,
        batchId: batch.id,
        instituteId: batch.instituteId,
        tradeId: batch.tradeId,
        date: dateStr,
        traineeId: trainee.id,
        status,
        remarks: status === 'Leave' ? 'অনুমোদিত ছুটি' : undefined,
        recordedBy: 'Trainer',
        createdAt: d.getTime()
      });
    });
  }

  return records;
}
