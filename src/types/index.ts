export type UserRole = 'Course Director' | 'FMA' | 'Trainer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
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
  status: 'Active' | 'Inactive';
  createdAt: number;
}

export interface Trade {
  id: string;
  name: string;
  code: string;
  description: string;
  duration: string; // e.g., '6 Months'
  status: 'Active' | 'Inactive';
  createdAt: number;
}

export interface Batch {
  id: string;
  name: string;
  instituteId: string;
  tradeId: string;
  startDate: number;
  endDate: number;
  maxTrainees: number;
  status: 'Upcoming' | 'Active' | 'Completed';
  createdAt: number;
}

export type TraineeStatus = 'Active' | 'Completed' | 'Dropped Out';

export interface Trainee {
  id: string;
  traineeId: string;
  registrationNumber: string;
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
  
  createdAt: number;
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
  minAttendancePercentForCert: number;
  passMarkPercent: number;
  gradingRules: {
    grade: string;
    minPercent: number;
  }[];
}
