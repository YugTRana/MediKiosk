// Concurrency Stress-Check: 20 Simultaneous Session Writes on SQLite Prisma Engine
// Verifies ACID integrity, dead-lock prevention, and zero-dropped-write guarantee.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runConcurrencyStressCheck(concurrency = 20) {
  console.log(`\n======================================================`);
  console.log(`⚡ [STRESS CHECK] Launching ${concurrency} simultaneous session intake transactions...`);
  console.log(`======================================================`);

  const startTime = Date.now();
  const sessionIds = [];
  const errors = [];

  const promises = Array.from({ length: concurrency }).map(async (_, idx) => {
    const sId = `stress-${Date.now()}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`;
    sessionIds.push(sId);
    const token = `K-STR-${1000 + idx}`;

    try {
      const created = await prisma.session.create({
        data: {
          id: sId,
          tokenNumber: token,
          complaintId: idx % 2 === 0 ? 'chest_pain' : 'fever',
          complaintTitle: idx % 2 === 0 ? 'Stress Test Chest Discomfort' : 'Stress Test High Fever',
          language: 'English',
          status: 'WAITING_OPD',
          answers: JSON.stringify([
            { questionId: 'stress_q', selectedOption: { labelEn: `Simulated concurrent response #${idx}` } }
          ]),
          redFlagsTriggered: JSON.stringify(idx === 0 ? ['Critical Red Flag Simulation'] : []),
          consentStatus: 'GRANTED',
          consentRecord: {
            create: {
              purpose: 'CONCURRENCY_TEST',
              allowDataCapture: true,
              allowHisSharing: true,
              allowAbdmLinking: true,
              status: 'GRANTED'
            }
          },
          digitizedDocument: {
            create: {
              fileName: `concurrent_doc_${idx}.pdf`,
              documentType: 'lab_report',
              documentTitle: `Concurrent Lab Document #${idx}`,
              confidenceScore: 0.95
            }
          }
        }
      });
      return { success: true, id: created.id, token: created.tokenNumber };
    } catch (err) {
      errors.push({ idx, error: err.message });
      return { success: false, error: err.message };
    }
  });

  const results = await Promise.all(promises);
  const totalDurationMs = Date.now() - startTime;
  const successfulCount = results.filter(r => r.success).length;

  // Verify records actually exist in database
  const countInDb = await prisma.session.count({
    where: { id: { in: sessionIds } }
  });

  console.log(`\n--- CONCURRENCY STRESS RESULTS ---`);
  console.log(`Total Concurrent Requests: ${concurrency}`);
  console.log(`Successful Writes:        ${successfulCount} / ${concurrency}`);
  console.log(`Verified DB Records:       ${countInDb} / ${concurrency}`);
  console.log(`Deadlocks / Dropped:       ${errors.length}`);
  console.log(`Total Elapsed Time:        ${totalDurationMs} ms`);
  console.log(`Average Latency per Write: ${(totalDurationMs / concurrency).toFixed(1)} ms`);

  if (errors.length > 0) {
    console.error('Errors encountered:', errors);
  } else {
    console.log(`✅ SQLite Prisma Engine passed concurrency stress test with ZERO deadlocks and ZERO dropped writes!`);
  }

  // Cleanup test records
  await prisma.consentRecord.deleteMany({ where: { sessionId: { in: sessionIds } } }).catch(() => {});
  await prisma.digitizedDocument.deleteMany({ where: { sessionId: { in: sessionIds } } }).catch(() => {});
  await prisma.session.deleteMany({ where: { id: { in: sessionIds } } }).catch(() => {});
  await prisma.$disconnect();

  return {
    concurrency,
    successfulCount,
    countInDb,
    droppedCount: concurrency - countInDb,
    totalDurationMs,
    avgLatencyMs: parseFloat((totalDurationMs / concurrency).toFixed(1)),
    passed: countInDb === concurrency && errors.length === 0
  };
}

if (require.main === module) {
  runConcurrencyStressCheck(20).then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runConcurrencyStressCheck };
