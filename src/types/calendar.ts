export interface DayCompletionStatus {
  isCompleted: boolean;
  completedAt?: string; // YYYY-MM-DD
  trainerName?: string;
  trainerId?: string;
  trainerType?: 'Skill Trainer' | 'Literacy Trainer';
  attendanceSessionDate?: string;
  remarks?: string;
  updatedAt?: number;
}

export interface BatchCalendarProgress {
  id: string; // progress_${batchId}
  batchId: string;
  tradeId?: string;
  instituteId?: string;
  currentDay: number; // overall active day
  currentSkillDay: number; // active day for Skill Trainer
  currentLiteracyDay: number; // active day for Literacy Trainer
  skillProgress: Record<number, DayCompletionStatus>; // dayNumber -> status (Marked by Skill Trainer)
  literacyProgress: Record<number, DayCompletionStatus>; // dayNumber -> status (Marked by Literacy Trainer)
  completedDays?: Record<number, DayCompletionStatus>; // legacy fallback
  startDate?: string;
  targetEndDate?: string;
  updatedAt: number;
}

/**
 * ট্রেড ভিত্তিক স্কিল ফোকাসড মডিউল (Trade-Based Skill Focused Module)
 */
export interface TradeSkillModule {
  id: string;
  tradeId?: string;
  batchId?: string;
  dayNumber: number; // কার্যদিবস নং (১ - ৯২)
  moduleName: string; // মডিউলের নাম (যেমন: স্কিন কেয়ার, হেয়ার কাট)
  taskNo: string; // কাজ নং (যেমন: কাজ ০১)
  topic: string; // পঠিত বিষয় / শিখন ফল
  theoryMinutes: number; // তাত্ত্বিক সময় (মিনিট)
  practicalMinutes: number; // ব্যবহারিক সময় (মিনিট)
  totalMinutes: number; // মোট সময় (মিনিট)
  phaseGroup: string; // বিভাগ / ক্যাটাগরি
  toolsRequired?: string; // প্রয়োজনীয় যন্ত্রপাতি ও উপকরণ
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * ট্রেড ভিত্তিক লিটারেসি ফোকাসড মডিউল (Trade-Based Literacy Focused Module)
 */
export interface TradeLiteracyModule {
  id: string;
  tradeId?: string;
  batchId?: string;
  dayNumber: number; // কার্যদিবস নং (১ - ৯২)
  moduleName: string; // মডিউলের নাম (যেমন: মৌলিক বাংলা দক্ষতা)
  taskNo: string; // কাজ নং (যেমন: কাজ ০১)
  topic: string; // পঠিত বিষয় / শিরোনাম
  startTime?: string; // শুরুর সময় (যেমন: ০৯:০০)
  endTime?: string; // শেষের সময় (যেমন: ১১:০০)
  totalMinutes: number; // মোট সময় (মিনিট)
  category: string; // বিভাগ (বাংলা, ইংরেজি, গণিত, ইত্যাদি)
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Backward compatibility aliases
export type BatchSkillModule = TradeSkillModule;
export type BatchLiteracyModule = TradeLiteracyModule;

export interface ShikhonDayPlan {
  dayNumber: number;
  dayBn: string;
  skillModule: string;
  skillTaskNo: string;
  skillTopic: string;
  skillTheoryMinutes: number;
  skillPracticalMinutes: number;
  skillTotalMinutes: number;
  literacyModule: string;
  literacyTaskNo: string;
  literacyTopic: string;
  literacyStartTime?: string;
  literacyEndTime?: string;
  literacyTotalMinutes: number;
  dailyTotalMinutes: number;
  theoryMinutesTotal: number;
  practicalMinutesTotal: number;
  phaseGroup: string;
  notes?: string;
}

export interface IntegratedDayView {
  dayNumber: number;
  dayBn: string;
  skill: TradeSkillModule | null;
  literacy: TradeLiteracyModule | null;
  skillStatus: DayCompletionStatus | null;
  literacyStatus: DayCompletionStatus | null;
  overallStatus: 'fully_completed' | 'skill_completed' | 'literacy_completed' | 'pending';
}

/**
 * শিখন ক্যালেন্ডার অগ্রগতি ও সম্পাদন অডিট লগ (Calendar Progress Log Table)
 */
export interface CalendarProgressLog {
  id: string; // `cpl_${batchId}_${moduleType}_d${dayNumber}_${timestamp}`
  batchId: string;
  batchName?: string;
  tradeId?: string;
  tradeName?: string;
  instituteId?: string;
  dayNumber: number;
  moduleType: 'skill' | 'literacy' | 'integrated';
  moduleId?: string;
  taskNo?: string;
  topic?: string;
  isCompleted: boolean;
  completedAt: string; // YYYY-MM-DD
  trainerId?: string;
  trainerName?: string;
  trainerType?: 'Skill Trainer' | 'Literacy Trainer' | 'Course Director' | 'FMA';
  remarks?: string;
  createdAt: number;
  updatedAt?: number;
}
