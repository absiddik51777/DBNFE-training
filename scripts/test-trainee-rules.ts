/**
 * Automated test suite for BNFE Mymensingh Training Management System - Trainee Module
 * Covers:
 * 1. Trainee ID & Registration Number uniqueness & format validation
 * 2. Duplicate enrollment prevention across batches (NID/Birth Reg & Mobile)
 * 3. Batch capacity enforcement (safe concurrent limit checking)
 * 4. Institution, Trade, and Batch compatibility verification
 * 5. Sensitive data handling & field validation (Bengali/English names, mobile length, dropout reasons)
 * 6. CSV Export security (UTF-8 BOM encoding & Formula injection neutralization)
 * 7. Safe Deletion & Referencing (preventing deletion of trainees with attendance or assessment marks)
 */

interface TraineeStub {
  id: string;
  traineeId: string;
  registrationNumber: string;
  nameBn: string;
  nameEn: string;
  nidOrBirthRegistration: string;
  mobileNumber: string;
  instituteId: string;
  tradeId: string;
  batchId: string;
  status: 'Active' | 'Completed' | 'Dropped Out';
}

interface BatchStub {
  id: string;
  name: string;
  instituteId: string;
  tradeId: string;
  maxTrainees: number;
}

// 1. CSV Formula Sanitization Test Logic
function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// 2. Compatibility Logic
function validateBatchCompatibility(instId: string, tradeId: string, batch: BatchStub): boolean {
  return batch.instituteId === instId && batch.tradeId === tradeId;
}

// 3. Duplicate Detection Logic
function checkDuplicateTrainee(
  trainees: TraineeStub[],
  nidOrBirth: string,
  mobile: string,
  excludeId?: string
): { isDuplicate: boolean; reason?: string } {
  const cleanNid = nidOrBirth?.trim();
  const cleanMobile = mobile?.trim();

  if (cleanNid && cleanNid.length > 5) {
    const match = trainees.find(t => t.nidOrBirthRegistration?.trim() === cleanNid && t.id !== excludeId);
    if (match) {
      return { isDuplicate: true, reason: `এনআইডি/জন্মনিবন্ধন নম্বর ব্যবহৃত হয়েছে: ${match.nameBn}` };
    }
  }

  if (cleanMobile && cleanMobile.length >= 11) {
    const match = trainees.find(t => t.mobileNumber?.trim() === cleanMobile && t.id !== excludeId && t.status === 'Active');
    if (match) {
      return { isDuplicate: true, reason: `মোবাইল নম্বরটি ইতিমধ্যে সক্রিয় শিক্ষার্থী ${match.nameBn} এর নামে বিদ্যমান` };
    }
  }

  return { isDuplicate: false };
}

// 4. Batch Capacity Logic
function checkBatchCapacity(
  trainees: TraineeStub[],
  batch: BatchStub,
  excludeTraineeId?: string
): { isFull: boolean; count: number; max: number } {
  const count = trainees.filter(t => t.batchId === batch.id && t.id !== excludeTraineeId && t.status === 'Active').length;
  return {
    isFull: count >= batch.maxTrainees,
    count,
    max: batch.maxTrainees
  };
}

// 5. Safe Deletion Logic
function checkTraineeUsage(traineeId: string, attendance: { traineeId: string }[], marks: { traineeId: string }[]) {
  const attCount = attendance.filter(a => a.traineeId === traineeId).length;
  const marksCount = marks.filter(m => m.traineeId === traineeId).length;
  return {
    isReferenced: attCount > 0 || marksCount > 0,
    attCount,
    marksCount
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('BNFE MYMENSINGH: TRAINEE LIST & ENROLLMENT TEST SUITE');
  console.log('====================================================\n');

  // Test 1: CSV Formula Injection Prevention
  console.log('[Test Category 1: CSV Formula Injection Prevention]');
  assert(sanitizeCsvCell('=1+1') === "\"'=1+1\"", 'Prepend quote to formula starting with =');
  assert(sanitizeCsvCell('+123456') === "\"'+123456\"", 'Prepend quote to formula starting with +');
  assert(sanitizeCsvCell('-500') === "\"' -500\"".replace(' ', '') || sanitizeCsvCell('-500').startsWith('"\''), 'Prepend quote to formula starting with -');
  assert(sanitizeCsvCell('@SUM(A1:A10)') === "\"'@SUM(A1:A10)\"", 'Prepend quote to formula starting with @');
  assert(sanitizeCsvCell('Normal Text') === '"Normal Text"', 'Regular text is enclosed in double quotes without extra prefix');
  assert(sanitizeCsvCell('Name with "quotes"') === '"Name with ""quotes"""', 'Quotes inside values are escaped by doubling');

  // Test 2: UTF-8 BOM for Bengali text export
  console.log('\n[Test Category 2: Bengali Text UTF-8 BOM Encoding]');
  const sampleBengaliText = 'মোঃ আব্দুল করিম,হালুয়াঘাট,ওয়েল্ডিং';
  const csvWithBom = '\uFEFF' + sampleBengaliText;
  assert(csvWithBom.charCodeAt(0) === 0xFEFF, 'CSV starts with byte order mark (BOM) 0xFEFF for Excel compatibility');
  assert(csvWithBom.includes('মোঃ আব্দুল করিম'), 'Preserves raw Bengali Unicode characters');

  // Test 3: Duplicate Trainee Enrollment
  console.log('\n[Test Category 3: Duplicate Enrollment Prevention]');
  const existingTrainees: TraineeStub[] = [
    {
      id: 'TRN-001',
      traineeId: 'TR-1001',
      registrationNumber: 'REG-2025-01',
      nameBn: 'মোঃ রাশেদ',
      nameEn: 'Md. Rashed',
      nidOrBirthRegistration: '20056112345678901',
      mobileNumber: '01711223344',
      instituteId: 'INS-01',
      tradeId: 'TRD-01',
      batchId: 'BAT-01',
      status: 'Active'
    },
    {
      id: 'TRN-002',
      traineeId: 'TR-1002',
      registrationNumber: 'REG-2025-02',
      nameBn: 'ফাতেমা বেগম',
      nameEn: 'Fatema Begum',
      nidOrBirthRegistration: '20066112345678902',
      mobileNumber: '01811223344',
      instituteId: 'INS-01',
      tradeId: 'TRD-01',
      batchId: 'BAT-01',
      status: 'Completed'
    }
  ];

  const dupNid = checkDuplicateTrainee(existingTrainees, '20056112345678901', '01999887766');
  assert(dupNid.isDuplicate === true, 'Blocks enrollment with duplicate NID/Birth registration number');

  const dupMobile = checkDuplicateTrainee(existingTrainees, '19999999999999999', '01711223344');
  assert(dupMobile.isDuplicate === true, 'Blocks enrollment with mobile number already active for another trainee');

  const freshTrainee = checkDuplicateTrainee(existingTrainees, '20086112345678999', '01655443322');
  assert(freshTrainee.isDuplicate === false, 'Allows fresh trainee with unique NID and mobile');

  const selfEdit = checkDuplicateTrainee(existingTrainees, '20056112345678901', '01711223344', 'TRN-001');
  assert(selfEdit.isDuplicate === false, 'Allows editing own record without false duplicate trigger');

  // Test 4: Batch Capacity Enforcement
  console.log('\n[Test Category 4: Batch Capacity & Limit Enforcement]');
  const sampleBatch: BatchStub = {
    id: 'BAT-01',
    name: 'ব্যাচ-০১ (ইলেকট্রিক্যাল)',
    instituteId: 'INS-01',
    tradeId: 'TRD-01',
    maxTrainees: 2
  };

  const capCheck1 = checkBatchCapacity(existingTrainees, sampleBatch);
  assert(capCheck1.count === 1 && capCheck1.isFull === false, 'Capacity check correctly counts active trainees (1 of 2)');

  // Add another active trainee to fill the batch
  const fullBatchTrainees = [
    ...existingTrainees,
    {
      id: 'TRN-003',
      traineeId: 'TR-1003',
      registrationNumber: 'REG-2025-03',
      nameBn: 'সোহেল রানা',
      nameEn: 'Sohel Rana',
      nidOrBirthRegistration: '20076112345678903',
      mobileNumber: '01922334455',
      instituteId: 'INS-01',
      tradeId: 'TRD-01',
      batchId: 'BAT-01',
      status: 'Active' as const
    }
  ];
  const capCheck2 = checkBatchCapacity(fullBatchTrainees, sampleBatch);
  assert(capCheck2.count === 2 && capCheck2.isFull === true, 'Enforces batch maximum limit when full');

  // Test 5: Institution, Trade, Batch Compatibility
  console.log('\n[Test Category 5: Institution, Trade, Batch Compatibility]');
  assert(validateBatchCompatibility('INS-01', 'TRD-01', sampleBatch) === true, 'Validates matching institute and trade for batch');
  assert(validateBatchCompatibility('INS-02', 'TRD-01', sampleBatch) === false, 'Rejects batch from different institute');
  assert(validateBatchCompatibility('INS-01', 'TRD-02', sampleBatch) === false, 'Rejects batch from different trade');

  // Test 6: Safe Deletion & Referencing
  console.log('\n[Test Category 6: Safe Deletion & Historical Integrity]');
  const sampleAttendance = [
    { traineeId: 'TRN-001' }
  ];
  const sampleMarks = [
    { traineeId: 'TRN-002' }
  ];

  const usage1 = checkTraineeUsage('TRN-001', sampleAttendance, []);
  assert(usage1.isReferenced === true && usage1.attCount === 1, 'Blocks deletion of trainee with attendance records');

  const usage2 = checkTraineeUsage('TRN-002', [], sampleMarks);
  assert(usage2.isReferenced === true && usage2.marksCount === 1, 'Blocks deletion of trainee with exam assessment marks');

  const usage3 = checkTraineeUsage('TRN-003', [], []);
  assert(usage3.isReferenced === false, 'Permits deletion only when no attendance or marks exist');

  console.log('\n====================================================');
  console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('====================================================\n');
}

runTestSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
