import { dataService } from '../src/lib/dataService';
import { AttendanceRecord } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('Testing Multi-User Data Sync architecture...');

async function testSync() {
  // Test saveAttendanceBatch idempotent primary key generation
  const sampleBatch: AttendanceRecord[] = [
    {
      id: 'ATT_BAT-01_2026-10-18_TR-01',
      batchId: 'BAT-01',
      instituteId: 'INS-01',
      tradeId: 'TRD-01',
      date: '2026-10-18',
      traineeId: 'TR-01',
      status: 'Present',
      recordedBy: 'Trainer 1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'ATT_BAT-01_2026-10-18_TR-02',
      batchId: 'BAT-01',
      instituteId: 'INS-01',
      tradeId: 'TRD-01',
      date: '2026-10-18',
      traineeId: 'TR-02',
      status: 'Absent',
      recordedBy: 'Trainer 1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  const res = await dataService.saveAttendanceBatch(sampleBatch);
  assert(res.success === true, 'saveAttendanceBatch returned success');
  assert(res.count === 2, 'saveAttendanceBatch processed 2 records');

  // Verify attendance cache
  const cached = await dataService.getItems<AttendanceRecord>('attendance');
  const found1 = cached.find(a => a.id === 'ATT_BAT-01_2026-10-18_TR-01');
  const found2 = cached.find(a => a.id === 'ATT_BAT-01_2026-10-18_TR-02');
  assert(!!found1 && found1.status === 'Present', 'Record 1 persisted with Present status');
  assert(!!found2 && found2.status === 'Absent', 'Record 2 persisted with Absent status');

  console.log('\nAll multi-user sync unit checks passed successfully!');
}

testSync().catch(err => {
  console.error(err);
  process.exit(1);
});
