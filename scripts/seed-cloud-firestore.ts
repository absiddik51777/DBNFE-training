import { db } from '../src/lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { DEFAULT_INSTITUTES, DEFAULT_TRADES, DEFAULT_BATCHES, generate20TraineesForBatch, generateSampleAttendance } from '../src/lib/demoTraineesSeed';
import { DEFAULT_ROLES } from '../src/lib/permissions';

async function seedAll() {
  console.log('Seeding institutes...');
  for (const inst of DEFAULT_INSTITUTES) {
    await setDoc(doc(db, 'institutes', inst.id), inst, { merge: true });
  }

  console.log('Seeding trades...');
  for (const trade of DEFAULT_TRADES) {
    await setDoc(doc(db, 'trades', trade.id), trade, { merge: true });
  }

  console.log('Seeding batches...');
  for (const batch of DEFAULT_BATCHES) {
    await setDoc(doc(db, 'batches', batch.id), batch, { merge: true });
  }

  console.log('Seeding roles...');
  for (const role of DEFAULT_ROLES) {
    await setDoc(doc(db, 'roles', role.id), role, { merge: true });
  }

  console.log('Seeding 20 trainees for each batch...');
  let globalIndex = 0;
  for (let bIdx = 0; bIdx < DEFAULT_BATCHES.length; bIdx++) {
    const batch = DEFAULT_BATCHES[bIdx];
    const trainees = generate20TraineesForBatch(batch, bIdx, globalIndex);
    globalIndex += 20;

    const wb = writeBatch(db);
    trainees.forEach(t => {
      wb.set(doc(db, 'trainees', t.id), t, { merge: true });
    });
    await wb.commit();

    const att = generateSampleAttendance(batch, trainees);
    const attBatch = writeBatch(db);
    att.forEach(a => {
      const id = a.id || `ATT_${a.batchId}_${a.date}_${a.traineeId}`;
      const cleanA: any = { ...a, id };
      Object.keys(cleanA).forEach(k => {
        if (cleanA[k] === undefined) delete cleanA[k];
      });
      attBatch.set(doc(db, 'attendance', id), cleanA, { merge: true });
    });
    await attBatch.commit();
  }

  console.log('Verifying final cloud counts...');
  const [insts, trds, btcs, rls, trns, atts] = await Promise.all([
    getDocs(collection(db, 'institutes')),
    getDocs(collection(db, 'trades')),
    getDocs(collection(db, 'batches')),
    getDocs(collection(db, 'roles')),
    getDocs(collection(db, 'trainees')),
    getDocs(collection(db, 'attendance'))
  ]);

  console.log(`Cloud Counts:
- Institutes: ${insts.docs.length}
- Trades: ${trds.docs.length}
- Batches: ${btcs.docs.length}
- Roles: ${rls.docs.length}
- Trainees: ${trns.docs.length}
- Attendance: ${atts.docs.length}`);

  process.exit(0);
}

seedAll().catch(e => {
  console.error(e);
  process.exit(1);
});
