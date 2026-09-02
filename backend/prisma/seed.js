const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [MediKiosk DB] Seeding database...');

  // 1. Seed Verified ABHA Patients
  const patients = [
    {
      abhaNumber: '91-8472-1029-4821',
      abhaAddress: 'ramesh.sharma@abdm',
      name: 'Ramesh Chandra Sharma',
      gender: 'Male',
      dob: '1958-04-12',
      age: 68,
      mobile: '9876543210',
      address: 'House 42, Sector 9, Jaipur, Rajasthan',
      kycStatus: 'VERIFIED_AADHAAR_BIO',
      healthLockerLinked: true
    },
    {
      abhaNumber: '91-3829-1928-4019',
      abhaAddress: 'sunita.devi@abdm',
      name: 'Sunita Devi',
      gender: 'Female',
      dob: '1964-08-22',
      age: 62,
      mobile: '9845211928',
      address: 'Plot 14, Gandhi Nagar, Bhopal, MP',
      kycStatus: 'VERIFIED_AADHAAR_OTP',
      healthLockerLinked: true
    },
    {
      abhaNumber: '91-5555-1234-8890',
      abhaAddress: 'amit.verma@abdm',
      name: 'Amit Kumar Verma',
      gender: 'Male',
      dob: '1992-11-04',
      age: 34,
      mobile: '9711233455',
      address: 'Sector 62, Noida, UP',
      kycStatus: 'VERIFIED_AADHAAR_DEMOGRAPHIC',
      healthLockerLinked: true
    }
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { abhaNumber: p.abhaNumber },
      update: p,
      create: p
    });
  }
  console.log(`✅ Seeded ${patients.length} ABHA patient accounts.`);

  // 2. Seed Chief Complaints & Dialogue Flows from mockData/dialogueFlows.json if present
  const dialogueFlowsPath = path.join(__dirname, '..', 'mockData', 'dialogueFlows.json');
  if (fs.existsSync(dialogueFlowsPath)) {
    const raw = fs.readFileSync(dialogueFlowsPath, 'utf8');
    const data = JSON.parse(raw);
    if (data && data.complaints) {
      for (const c of data.complaints) {
        await prisma.chiefComplaint.upsert({
          where: { id: c.id },
          update: {
            titleEn: c.titleEn,
            titleHi: c.titleHi,
            iconName: c.iconName,
            descriptionEn: c.descriptionEn,
            descriptionHi: c.descriptionHi,
            color: c.color
          },
          create: {
            id: c.id,
            titleEn: c.titleEn,
            titleHi: c.titleHi,
            iconName: c.iconName,
            descriptionEn: c.descriptionEn,
            descriptionHi: c.descriptionHi,
            color: c.color
          }
        });

        if (c.questions && Array.isArray(c.questions)) {
          for (const q of c.questions) {
            await prisma.question.upsert({
              where: { id: q.id },
              update: {
                complaintId: c.id,
                dimension: q.dimension,
                questionEn: q.questionEn,
                questionHi: q.questionHi
              },
              create: {
                id: q.id,
                complaintId: c.id,
                dimension: q.dimension,
                questionEn: q.questionEn,
                questionHi: q.questionHi
              }
            });

            // Delete old options and re-create to keep in sync
            await prisma.option.deleteMany({ where: { questionId: q.id } });
            if (q.options && Array.isArray(q.options)) {
              for (const opt of q.options) {
                await prisma.option.create({
                  data: {
                    questionId: q.id,
                    labelEn: opt.labelEn,
                    labelHi: opt.labelHi,
                    value: opt.value,
                    isRedFlag: Boolean(opt.isRedFlag),
                    anatomicalPart: opt.anatomicalPart || null
                  }
                });
              }
            }
          }
        }
      }
      console.log(`✅ Seeded ${data.complaints.length} chief complaint dialogue flows.`);
    }
  }

  console.log('🎉 [MediKiosk DB] Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
