const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [MediKiosk DB] Seeding database...');

  // 1. Seed Verified ABHA Patients
  const patients = [
    {
      name: 'Ramesh Chandra Sharma',
      gender: 'Male',
      age: 68,
      mobile: '9876543210',
      password: await bcrypt.hash('password123', 10),
      address: 'House 42, Sector 9, Jaipur, Rajasthan'
    },
    {
      name: 'Sunita Devi',
      gender: 'Female',
      age: 62,
      mobile: '9845211928',
      password: await bcrypt.hash('password123', 10),
      address: 'Plot 14, Gandhi Nagar, Bhopal, MP'
    },
    {
      name: 'Amit Kumar Verma',
      gender: 'Male',
      age: 34,
      mobile: '9711233455',
      password: await bcrypt.hash('password123', 10),
      address: 'Sector 62, Noida, UP'
    }
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { mobile: p.mobile },
      update: p,
      create: p
    });
  }
  console.log(`✅ Seeded ${patients.length} ABHA patient accounts.`);

  // 2. Seed Chief Complaints & Dialogue Flows from mockData/dialogueFlows.json if present
  // (Currently models ChiefComplaint, Question, Option are missing from schema, relies on fallback)
  /*
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
  */

  // 3. Seed Default Staff Users (Phase 1)
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const hashedDoctorPassword = await bcrypt.hash('doctor123', 10);
  
  await prisma.staffUser.upsert({
    where: { username: 'admin1' },
    update: {},
    create: {
      username: 'admin1',
      password: hashedAdminPassword,
      role: 'ADMIN',
      name: 'System Admin'
    }
  });

  await prisma.staffUser.upsert({
    where: { username: 'doctor1' },
    update: {},
    create: {
      username: 'doctor1',
      password: hashedDoctorPassword,
      role: 'DOCTOR',
      name: 'Dr. Asha Sharma'
    }
  });
  console.log(`✅ Seeded default Staff Users (admin1, doctor1).`);

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
