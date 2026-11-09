import { PermissionDefinition, Role } from '../types';

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Dashboard
  {
    key: 'view_dashboard',
    nameBn: 'ড্যাশবোর্ড পেজ প্রদর্শন',
    nameEn: 'View Dashboard Page',
    descriptionBn: 'মূল ড্যাশবোর্ড ও প্রাথমিক তথ্য প্রদর্শন করার অনুমতি',
    module: 'dashboard',
    moduleBn: 'ড্যাশবোর্ড',
    isPageView: true,
  },
  {
    key: 'view_dashboard_stats',
    nameBn: 'বিস্তারিত পরিসংখ্যান ও উপস্থিতি দেখা',
    nameEn: 'View Detailed Stats & Attendance',
    descriptionBn: 'ড্যাশবোর্ডে ব্যাচভিত্তিক উপস্থিতি ও প্রতিষ্ঠানের পরিসংখ্যান দেখা',
    module: 'dashboard',
    moduleBn: 'ড্যাশবোর্ড',
  },

  // Institutes
  {
    key: 'view_institutes',
    nameBn: 'প্রতিষ্ঠান পেজ ও তালিকা প্রদর্শন',
    nameEn: 'View Institutes Page',
    descriptionBn: 'প্রশিক্ষণ প্রতিষ্ঠানের তালিকা ও তথ্য দেখার অনুমতি',
    module: 'institutes',
    moduleBn: 'প্রতিষ্ঠান ব্যবস্থাপনা',
    isPageView: true,
  },
  {
    key: 'create_institute',
    nameBn: 'নতুন প্রতিষ্ঠান যোগ করা',
    nameEn: 'Create Institute',
    descriptionBn: 'নতুন প্রশিক্ষণ কেন্দ্র বা প্রতিষ্ঠান যুক্ত করার অনুমতি',
    module: 'institutes',
    moduleBn: 'প্রতিষ্ঠান ব্যবস্থাপনা',
  },
  {
    key: 'edit_institute',
    nameBn: 'প্রতিষ্ঠানের তথ্য সম্পাদনা',
    nameEn: 'Edit Institute',
    descriptionBn: 'প্রতিষ্ঠানের নাম, ঠিকানা, যোগাযোগ ইত্যাদি সংশোধন করার অনুমতি',
    module: 'institutes',
    moduleBn: 'প্রতিষ্ঠান ব্যবস্থাপনা',
  },
  {
    key: 'delete_institute',
    nameBn: 'প্রতিষ্ঠান মুছে ফেলা',
    nameEn: 'Delete Institute',
    descriptionBn: 'প্রতিষ্ঠান সিস্টেম থেকে অপসারণ করার অনুমতি',
    module: 'institutes',
    moduleBn: 'প্রতিষ্ঠান ব্যবস্থাপনা',
  },

  // Trades
  {
    key: 'view_trades',
    nameBn: 'ট্রেড পেজ ও তালিকা প্রদর্শন',
    nameEn: 'View Trades Page',
    descriptionBn: 'সকল ট্রেডের তালিকা ও বিবরণ দেখার অনুমতি',
    module: 'trades',
    moduleBn: 'ট্রেড ব্যবস্থাপনা',
    isPageView: true,
  },
  {
    key: 'create_trade',
    nameBn: 'নতুন ট্রেড তৈরি করা',
    nameEn: 'Create Trade',
    descriptionBn: 'নতুন প্রশিক্ষণ ট্রেড ও কোর্স যুক্ত করার অনুমতি',
    module: 'trades',
    moduleBn: 'ট্রেড ব্যবস্থাপনা',
  },
  {
    key: 'edit_trade',
    nameBn: 'ট্রেড সম্পাদনা করা',
    nameEn: 'Edit Trade',
    descriptionBn: 'ট্রেডের নাম, কোড ও সময়কাল পরিবর্তন করার অনুমতি',
    module: 'trades',
    moduleBn: 'ট্রেড ব্যবস্থাপনা',
  },
  {
    key: 'delete_trade',
    nameBn: 'ট্রেড মুছে ফেলা',
    nameEn: 'Delete Trade',
    descriptionBn: 'ট্রেড সিস্টেম থেকে অপসারণ করার অনুমতি',
    module: 'trades',
    moduleBn: 'ট্রেড ব্যবস্থাপনা',
  },

  // Batches
  {
    key: 'view_batches',
    nameBn: 'ব্যাচ পেজ ও তালিকা প্রদর্শন',
    nameEn: 'View Batches Page',
    descriptionBn: 'সকল প্রশিক্ষণ ব্যাচের তালিকা ও বিবরণ দেখার অনুমতি',
    module: 'batches',
    moduleBn: 'প্রশিক্ষণ ব্যাচ',
    isPageView: true,
  },
  {
    key: 'create_batch',
    nameBn: 'নতুন ব্যাচ তৈরি করা',
    nameEn: 'Create Batch',
    descriptionBn: 'প্রতিষ্ঠান ও ট্রেডের অধীনে নতুন ব্যাচ চালুকরণ',
    module: 'batches',
    moduleBn: 'প্রশিক্ষণ ব্যাচ',
  },
  {
    key: 'edit_batch',
    nameBn: 'ব্যাচ সম্পাদনা করা',
    nameEn: 'Edit Batch',
    descriptionBn: 'ব্যাচের তারিখ, আসন ও স্ট্যাটাস সংশোধন করার অনুমতি',
    module: 'batches',
    moduleBn: 'প্রশিক্ষণ ব্যাচ',
  },
  {
    key: 'delete_batch',
    nameBn: 'ব্যাচ মুছে ফেলা',
    nameEn: 'Delete Batch',
    descriptionBn: 'ব্যাচ সিস্টেম থেকে অপসারণ করার অনুমতি',
    module: 'batches',
    moduleBn: 'প্রশিক্ষণ ব্যাচ',
  },
  {
    key: 'seed_demo_trainees',
    nameBn: 'ডেমো শিক্ষার্থী যুক্তকরণ',
    nameEn: 'Seed Demo Trainees',
    descriptionBn: 'ব্যাচে এক ক্লিকে ২০ জন ডেমো শিক্ষার্থী যুক্ত করার অনুমতি',
    module: 'batches',
    moduleBn: 'প্রশিক্ষণ ব্যাচ',
  },

  // Trainees
  {
    key: 'view_trainees',
    nameBn: 'প্রশিক্ষণার্থী পেজ ও তালিকা প্রদর্শন',
    nameEn: 'View Trainees Page',
    descriptionBn: 'প্রশিক্ষণার্থীদের তালিকা ও সার্চ ফিল্টার দেখার অনুমতি',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
    isPageView: true,
  },
  {
    key: 'view_trainee_details',
    nameBn: 'প্রশিক্ষণার্থীর প্রোফাইল দেখা',
    nameEn: 'View Trainee Profile',
    descriptionBn: 'প্রশিক্ষণার্থীর ব্যক্তিগত, অভিভাবক ও ড্রপআউট তথ্যাদি বিস্তারিত দেখা',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
  },
  {
    key: 'create_trainee',
    nameBn: 'নতুন প্রশিক্ষণার্থী ভর্তি ও নিবন্ধন',
    nameEn: 'Register New Trainee',
    descriptionBn: 'নতুন প্রশিক্ষণার্থী ফর্ম পূরণ করে ভর্তি করার অনুমতি',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
  },
  {
    key: 'edit_trainee',
    nameBn: 'প্রশিক্ষণার্থী তথ্য সংশোধন',
    nameEn: 'Edit Trainee',
    descriptionBn: 'শিক্ষার্থীর নাম, ঠিকানা ও প্রাতিষ্ঠানিক তথ্য সম্পাদনা',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
  },
  {
    key: 'delete_trainee',
    nameBn: 'প্রশিক্ষণার্থী রেকর্ড মুছে ফেলা',
    nameEn: 'Delete Trainee',
    descriptionBn: 'প্রশিক্ষণার্থী সিস্টেম থেকে অপসারণ করার অনুমতি',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
  },
  {
    key: 'export_trainees',
    nameBn: 'প্রশিক্ষণার্থী তালিকা এক্সপোর্ট/ডাউনলোড',
    nameEn: 'Export Trainees CSV/Excel',
    descriptionBn: 'শিক্ষার্থীদের তালিকা সিএসভি ফাইলে ডাউনলোড করার অনুমতি',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
  },
  {
    key: 'view_brn_verification',
    nameBn: 'জন্ম নিবন্ধন যাচাই পেজ প্রদর্শন (Course Director)',
    nameEn: 'View BRN Verification Page',
    descriptionBn: 'শিক্ষার্থীদের জন্ম নিবন্ধন অনলাইন যাচাই ও তথ্য তদারকি করার অনুমতি (কোর্স পরিচালক)',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
    isPageView: true,
  },
  {
    key: 'manage_brn_verification',
    nameBn: 'জন্ম নিবন্ধন যাচাইকরণ স্ট্যাটাস ও মন্তব্য সংরক্ষণ',
    nameEn: 'Manage BRN Verification',
    descriptionBn: 'জন্ম নিবন্ধন অনলাইন ভেরিফিকেশন স্ট্যাটাস ও মন্তব্য নির্ধারণ করার অনুমতি',
    module: 'trainees',
    moduleBn: 'প্রশিক্ষণার্থী',
  },

  // Daily Attendance
  {
    key: 'view_attendance',
    nameBn: 'দৈনিক হাজিরা পেজ প্রদর্শন',
    nameEn: 'View Attendance Page',
    descriptionBn: 'দৈনিক হাজিরা গ্রহণের ইন্টারফেস দেখার অনুমতি',
    module: 'attendance',
    moduleBn: 'দৈনিক হাজিরা',
    isPageView: true,
  },
  {
    key: 'take_attendance',
    nameBn: 'হাজিরা গ্রহণ ও সংরক্ষণ',
    nameEn: 'Take & Save Attendance',
    descriptionBn: 'উপস্থিতি (P), অনুপস্থিতি (A) বা ছুটি (L) মার্ক করে সংরক্ষণ করার অনুমতি',
    module: 'attendance',
    moduleBn: 'দৈনিক হাজিরা',
  },
  {
    key: 'edit_attendance',
    nameBn: 'পূর্ববর্তী হাজিরা সংশোধন',
    nameEn: 'Edit Past Attendance',
    descriptionBn: 'বিগত তারিখের সংরক্ষিত হাজিরা পুনরায় পরিবর্তনের অনুমতি',
    module: 'attendance',
    moduleBn: 'দৈনিক হাজিরা',
  },

  // Attendance Sheet
  {
    key: 'view_attendance_sheet',
    nameBn: 'হাজিরা শিট (খাতা) পেজ প্রদর্শন',
    nameEn: 'View Attendance Sheet Page',
    descriptionBn: 'মাসিক হাজিরা খাতা গ্রিড ভিউ দেখার অনুমতি',
    module: 'attendance_sheet',
    moduleBn: 'হাজিরা শিট',
    isPageView: true,
  },
  {
    key: 'export_attendance_sheet',
    nameBn: 'হাজিরা শিট প্রিন্ট ও ডাউনলোড',
    nameEn: 'Print & Export Attendance Sheet',
    descriptionBn: 'মাসিক হাজিরা রেজিস্টার প্রিন্ট বা পিডিএফ সংরক্ষণের অনুমতি',
    module: 'attendance_sheet',
    moduleBn: 'হাজিরা শিট',
  },

  // Exams
  {
    key: 'view_exams',
    nameBn: 'পরীক্ষা পেজ ও তালিকা প্রদর্শন',
    nameEn: 'View Exams Page',
    descriptionBn: 'পরীক্ষা সমূহের তালিকা ও তারিখ দেখার অনুমতি',
    module: 'exams',
    moduleBn: 'পরীক্ষা ও মূল্যায়ন',
    isPageView: true,
  },
  {
    key: 'create_exam',
    nameBn: 'নতুন পরীক্ষা নির্ধারণ ও তৈরি',
    nameEn: 'Create Exam',
    descriptionBn: 'বিষয়, পূর্ণমান ও পাসমার্ক নির্ধারণ করে পরীক্ষা চালুকরণ',
    module: 'exams',
    moduleBn: 'পরীক্ষা ও মূল্যায়ন',
  },
  {
    key: 'edit_exam',
    nameBn: 'পরীক্ষার তথ্য সম্পাদনা',
    nameEn: 'Edit Exam',
    descriptionBn: 'পরীক্ষার বিষয়, পূর্ণমান বা তারিখ সংশোধন করার অনুমতি',
    module: 'exams',
    moduleBn: 'পরীক্ষা ও মূল্যায়ন',
  },
  {
    key: 'delete_exam',
    nameBn: 'পরীক্ষা বাতিল বা মুছে ফেলা',
    nameEn: 'Delete Exam',
    descriptionBn: 'পরীক্ষা সিস্টেম থেকে বাতিল করার অনুমতি',
    module: 'exams',
    moduleBn: 'পরীক্ষা ও মূল্যায়ন',
  },

  // Results
  {
    key: 'view_results',
    nameBn: 'ফলাফল পেজ প্রদর্শন',
    nameEn: 'View Results Page',
    descriptionBn: 'পরীক্ষার ফলাফল ও গ্রেড শিট দেখার অনুমতি',
    module: 'results',
    moduleBn: 'ফলাফল ও মূল্যায়ন',
    isPageView: true,
  },
  {
    key: 'enter_marks',
    nameBn: 'নম্বর এন্ট্রি ও প্রকাশ',
    nameEn: 'Enter & Save Marks',
    descriptionBn: 'শিক্ষার্থীদের প্রাপ্ত নম্বর ইনপুট ও গ্রেড সংরক্ষণ করার অনুমতি',
    module: 'results',
    moduleBn: 'ফলাফল ও মূল্যায়ন',
  },
  {
    key: 'edit_marks',
    nameBn: 'ফলাফল ও নম্বর সংশোধন',
    nameEn: 'Edit Exam Marks',
    descriptionBn: 'পূর্বে ইনপুটকৃত প্রাপ্ত নম্বর সংশোধন করার অনুমতি',
    module: 'results',
    moduleBn: 'ফলাফল ও মূল্যায়ন',
  },

  // Reports
  {
    key: 'view_reports',
    nameBn: 'প্রতিবেদন পেজ প্রদর্শন',
    nameEn: 'View Reports Page',
    descriptionBn: 'প্রশিক্ষণ, হাজিরা ও ফলাফলের প্রতিবেদন দেখার অনুমতি',
    module: 'reports',
    moduleBn: 'প্রতিবেদন',
    isPageView: true,
  },
  {
    key: 'export_reports',
    nameBn: 'প্রতিবেদন এক্সপোর্ট ও ডাউনলোড',
    nameEn: 'Export Reports',
    descriptionBn: 'প্রতিবেদন প্রিন্ট বা ডাউনলোড করার অনুমতি',
    module: 'reports',
    moduleBn: 'প্রতিবেদন',
  },

  // Certificates
  {
    key: 'view_certificates',
    nameBn: 'সার্টিফিকেট পেজ প্রদর্শন',
    nameEn: 'View Certificates Page',
    descriptionBn: 'যোগ্য শিক্ষার্থীদের সনদপত্র দেখার ইন্টারফেস',
    module: 'certificates',
    moduleBn: 'সার্টিফিকেট',
    isPageView: true,
  },
  {
    key: 'generate_certificate',
    nameBn: 'সনদ তৈরি ও মুদ্রণ',
    nameEn: 'Generate & Print Certificate',
    descriptionBn: 'শিক্ষার্থীর জন্য অফিশিয়াল সনদ প্রস্তুত ও প্রিন্ট করার অনুমতি',
    module: 'certificates',
    moduleBn: 'সার্টিফিকেট',
  },

  // Users
  {
    key: 'view_users',
    nameBn: 'ব্যবহারকারী পেজ প্রদর্শন',
    nameEn: 'View Users Page',
    descriptionBn: 'সকল কর্মকর্তা ও প্রশিক্ষকদের তালিকা দেখার অনুমতি',
    module: 'users',
    moduleBn: 'ব্যবহারকারী ব্যবস্থাপনা',
    isPageView: true,
  },
  {
    key: 'create_user',
    nameBn: 'নতুন ব্যবহারকারী তৈরি',
    nameEn: 'Create New User',
    descriptionBn: 'নতুন কর্মকর্তা বা প্রশিক্ষক অ্যাকাউন্ট যোগ করার অনুমতি',
    module: 'users',
    moduleBn: 'ব্যবহারকারী ব্যবস্থাপনা',
  },
  {
    key: 'edit_user',
    nameBn: 'ব্যবহারকারী তথ্য সম্পাদনা',
    nameEn: 'Edit User Info',
    descriptionBn: 'ব্যবহারকারীর প্রোফাইল ও ভূমিকা পরিবর্তন করার অনুমতি',
    module: 'users',
    moduleBn: 'ব্যবহারকারী ব্যবস্থাপনা',
  },
  {
    key: 'toggle_user_status',
    nameBn: 'ব্যবহারকারী সক্রিয়/নিষ্ক্রিয়করণ',
    nameEn: 'Toggle User Status',
    descriptionBn: 'ব্যবহারকারীর লগইন সাময়িক বন্ধ বা পুনরায় চালু করার অনুমতি',
    module: 'users',
    moduleBn: 'ব্যবহারকারী ব্যবস্থাপনা',
  },

  // Roles & Permissions (Course Director Only)
  {
    key: 'view_roles',
    nameBn: 'রোল ও পারমিশন পেজ প্রদর্শন (Course Director)',
    nameEn: 'View Roles & Permissions Page',
    descriptionBn: 'রোল তালিকা ও পারমিশন ম্যাট্রিক্স দেখার অনুমতি (শুধুমাত্র কোর্স পরিচালক)',
    module: 'roles',
    moduleBn: 'রোল ও পারমিশন ব্যবস্থাপনা',
    isPageView: true,
  },
  {
    key: 'manage_roles',
    nameBn: 'রোল তৈরি ও পারমিশন কনফিগারেশন',
    nameEn: 'Manage Roles & Permissions',
    descriptionBn: 'নতুন রোল যোগ, মুছা ও যেকোনো রোলের পারমিশন পরিবর্তন করার অনুমতি',
    module: 'roles',
    moduleBn: 'রোল ও পারমিশন ব্যবস্থাপনা',
  },

  // Shikhon Calendar (Learning Calendar)
  {
    key: 'view_shikhon_calendar',
    nameBn: 'শিখন ক্যালেন্ডার প্রদর্শন',
    nameEn: 'View Shikhon Calendar Page',
    descriptionBn: '৯২ দিনের সরকারি শিখন ক্যালেন্ডার ও পাঠ পরিকল্পনা দেখার অনুমতি',
    module: 'calendar',
    moduleBn: 'শিখন ক্যালেন্ডার',
    isPageView: true,
  },
  {
    key: 'update_shikhon_calendar',
    nameBn: 'ক্লাস অগ্রগতি ও সম্পাদন আপডেট',
    nameEn: 'Update Shikhon Calendar Progress',
    descriptionBn: 'ক্লাস সম্পন্ন মার্ক করা, তারিখ নির্ধারণ ও মন্তব্য সংরক্ষণের অনুমতি',
    module: 'calendar',
    moduleBn: 'শিখন ক্যালেন্ডার',
  },

  // Settings
  {
    key: 'view_settings',
    nameBn: 'সেটিংস পেজ প্রদর্শন',
    nameEn: 'View Settings Page',
    descriptionBn: 'সিস্টেম সেটিংস পেজ দেখার অনুমতি',
    module: 'settings',
    moduleBn: 'সিস্টেম সেটিংস',
    isPageView: true,
  },
  {
    key: 'edit_settings',
    nameBn: 'সিস্টেম সেটিংস ও গ্রেডিং পরিবর্তন',
    nameEn: 'Edit System Settings',
    descriptionBn: 'পাসমার্ক, নূন্যতম হাজিরা শতকরা হার ও গ্রেডিং নিয়মাবলী পরিবর্তন',
    module: 'settings',
    moduleBn: 'সিস্টেম সেটিংস',
  },
  {
    key: 'manage_data',
    nameBn: 'সিস্টেম ডেটা ব্যাকআপ ও রিসেট',
    nameEn: 'Manage & Reset System Data',
    descriptionBn: 'ক্যাশ ডেটা রিসেট বা নমুনা ডেটা ক্লিয়ার করার মতো স্পর্শকাতর অনুমতি',
    module: 'settings',
    moduleBn: 'সিস্টেম সেটিংস',
  },
];

export const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.map(p => p.key);

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-cd',
    name: 'Course Director',
    nameBn: 'কোর্স পরিচালক',
    code: 'course_director',
    description: 'সর্বময় ক্ষমতাপ্রাপ্ত প্রশাসক। সিস্টেমের সকল পেজ, অপারেশন, রোল ও পারমিশন নিয়ন্ত্রণের একক অধিকারী।',
    isSystem: true,
    permissions: [...ALL_PERMISSION_KEYS],
    defaultLandingRoute: '/',
    createdAt: 1715000000000,
  },
  {
    id: 'role-fma',
    name: 'FMA',
    nameBn: 'ফিল্ড মনিটরিং অফিসার (FMA)',
    code: 'fma',
    description: 'মাঠ পর্যায়ের কার্যক্রম ও প্রতিষ্ঠান তদারককারী। ড্যাশবোর্ড, প্রতিষ্ঠান, ব্যাচ, শিক্ষার্থী ও ফলাফল পর্যবেক্ষণ করতে পারেন।',
    isSystem: true,
    permissions: [
      'view_dashboard',
      'view_dashboard_stats',
      'view_institutes',
      'create_institute',
      'edit_institute',
      'view_trades',
      'create_trade',
      'edit_trade',
      'view_batches',
      'create_batch',
      'edit_batch',
      'seed_demo_trainees',
      'view_trainees',
      'view_trainee_details',
      'create_trainee',
      'edit_trainee',
      'export_trainees',
      'view_attendance',
      'take_attendance',
      'edit_attendance',
      'view_attendance_sheet',
      'export_attendance_sheet',
      'view_exams',
      'create_exam',
      'edit_exam',
      'view_results',
      'enter_marks',
      'edit_marks',
      'view_reports',
      'export_reports',
      'view_certificates',
      'generate_certificate',
      'view_shikhon_calendar',
      'update_shikhon_calendar',
      'view_users',
      'create_user',
      'edit_user',
      'toggle_user_status',
    ],
    defaultLandingRoute: '/',
    createdAt: 1715000000000,
  },
  {
    id: 'role-trainer',
    name: 'Trainer',
    nameBn: 'প্রশিক্ষক (Trainer)',
    code: 'trainer',
    description: 'নির্দিষ্ট ব্যাচের প্রশিক্ষণ প্রদানকারী। দৈনিক হাজিরা গ্রহণ, পরীক্ষার নম্বর প্রদান ও নিজ ব্যাচের প্রশিক্ষণার্থী পরিচালনা করেন।',
    isSystem: true,
    permissions: [
      'view_dashboard',
      'view_dashboard_stats',
      'view_batches',
      'view_trainees',
      'view_trainee_details',
      'create_trainee',
      'edit_trainee',
      'view_attendance',
      'take_attendance',
      'view_attendance_sheet',
      'view_shikhon_calendar',
      'update_shikhon_calendar',
      'view_exams',
      'view_results',
      'enter_marks',
      'view_certificates',
    ],
    defaultLandingRoute: '/trainer-dashboard',
    createdAt: 1715000000000,
  },
];

/**
 * Path to Page View permission mapping
 */
export const PATH_TO_PAGE_PERMISSION: Record<string, string> = {
  '/': 'view_dashboard',
  '/trainer-dashboard': 'view_dashboard',
  '/institutes': 'view_institutes',
  '/trades': 'view_trades',
  '/trade-calendar': 'view_trades',
  '/batches': 'view_batches',
  '/trainees': 'view_trainees',
  '/brn-verification': 'view_brn_verification',
  '/shikhon-calendar': 'view_shikhon_calendar',
  '/attendance': 'view_attendance',
  '/attendance-sheet': 'view_attendance_sheet',
  '/exams': 'view_exams',
  '/results': 'view_results',
  '/reports': 'view_reports',
  '/certificates': 'view_certificates',
  '/users': 'view_users',
  '/roles': 'view_roles',
  '/settings': 'view_settings',
};

/**
 * Groups permissions by module for the UI
 */
export interface ModuleGroup {
  module: string;
  moduleBn: string;
  permissions: PermissionDefinition[];
}

export function getGroupedPermissions(): ModuleGroup[] {
  const map = new Map<string, ModuleGroup>();
  for (const perm of ALL_PERMISSIONS) {
    if (!map.has(perm.module)) {
      map.set(perm.module, {
        module: perm.module,
        moduleBn: perm.moduleBn,
        permissions: [],
      });
    }
    map.get(perm.module)!.permissions.push(perm);
  }
  return Array.from(map.values());
}
