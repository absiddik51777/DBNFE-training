export type UserRole = 'Course Director' | 'FMA' | 'Trainer' | string;

export interface PermissionDefinition {
  key: string;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
  module: string;
  moduleBn: string;
  isPageView?: boolean;
}

export interface Role {
  id: string;
  name: string;
  nameBn: string;
  code: string;
  description: string;
  isSystem: boolean; // System roles cannot be deleted
  permissions: string[];
  defaultLandingRoute?: string;
  createdAt: number;
  updatedAt?: number;
}

export type TrainerType = 'Skill Trainer' | 'Literacy Trainer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  trainerType?: TrainerType; // 'Skill Trainer' (স্কিল ট্রেইনার) or 'Literacy Trainer' (লিটারেসি ট্রেইনার)
  instituteId?: string;
  instituteName?: string;
  batchId?: string;
  batchName?: string;
  status: 'Active' | 'Inactive';
  createdAt: number;
}

export interface Institute {
  id: string;
  code?: string;
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive' | 'Archived';
  isArchived?: boolean;
  archivedAt?: number;
  archivedReason?: string;
  createdAt: number;
}

export interface Trade {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  description: string;
  duration: string; // e.g., '৬ মাস (৩৬০ ঘণ্টা)'
  status: 'Active' | 'Inactive' | 'Archived';
  isArchived?: boolean;
  archivedAt?: number;
  archivedReason?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Batch {
  id: string;
  name: string;
  batchCode?: string;
  instituteId: string;
  tradeId: string;
  skillTrainerId?: string; // স্কিল ট্রেইনার আইডি
  skillTrainerName?: string; // স্কিল ট্রেইনার নাম
  literacyTrainerId?: string; // লিটারেসি ট্রেইনার আইডি
  literacyTrainerName?: string; // লিটারেসি ট্রেইনার নাম
  fiscalYear?: string; // e.g., '2025-2026'
  startDate: number;
  endDate: number;
  maxTrainees: number;
  status: 'Upcoming' | 'Active' | 'Completed' | 'Archived' | 'Cancelled';
  cancellationReason?: string;
  isArchived?: boolean;
  archivedAt?: number;
  archivedReason?: string;
  createdAt: number;
  updatedAt?: number;
}

export type TraineeStatus = 'Active' | 'Completed' | 'Dropped Out' | 'Archived';

export interface Trainee {
  id: string;
  traineeId: string;
  registrationNumber?: string;
  nameEn: string;
  nameBn: string;
  fatherNameEn: string;
  fatherNameBn: string;
  motherNameEn: string;
  motherNameBn: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  nidOrBirthRegistration: string;
  mobileNumber: string;
  address: string;
  permanentAddress?: string;
  presentAddress?: string;
  sameAsPermanentAddress?: boolean;
  photoUrl?: string;

  lastClassCompleted: string;
  previousSchoolName: string;
  yearOfDropout: string;
  reasonForDropout: string;

  instituteId: string;
  tradeId: string;
  batchId: string;
  admissionDate: number;
  trainingStartDate: number;
  trainingEndDate: number;
  status: TraineeStatus;
  isArchived?: boolean;
  archivedAt?: number;
  archivedReason?: string;
  
  createdAt: number;
  updatedAt?: number;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Leave';

export interface AttendanceRecord {
  id: string;
  batchId: string;
  instituteId: string;
  tradeId: string;
  date: string; // YYYY-MM-DD
  traineeId: string;
  status: AttendanceStatus;
  remarks?: string;
  recordedBy: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Exam {
  id: string;
  name: string;
  type: string;
  instituteId: string;
  tradeId: string;
  batchId: string;
  date: number;
  totalMarks: number;
  passMarks: number;
  subject: string;
  description?: string;
  status?: 'Active' | 'Archived';
  isArchived?: boolean;
  archivedAt?: number;
  archivedReason?: string;
  createdAt: number;
}

export interface ExamMark {
  id: string;
  examId: string;
  traineeId: string;
  batchId: string;
  marksObtained: number;
  percentage: number;
  grade: string;
  result: 'Pass' | 'Fail' | 'Absent';
  enteredBy: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  recordId: string;
  details?: string;
  timestamp: number;
}

export interface SystemSettings {
  allowDataDeletion: boolean; // Controls whether deletion of data (trainees, batches, trades, institutes, attendance, exams) is permitted
  deletionLockedReason?: string;
  minAttendancePercentForCert: number;
  passMarkPercent: number;
  gradingRules?: {
    grade: string;
    minPercent: number;
  }[];
  updatedAt?: number;
  updatedBy?: string;
}

