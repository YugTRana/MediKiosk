const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [MediKiosk DB] Seeding database...');

  // 1. Seed Verified Genuine Patients
  const patients = [
    {
      name: 'Nidhi Kharva',
      gender: 'Female',
      age: 28,
      mobile: '9876543210',
      password: await bcrypt.hash('password123', 10),
      address: 'Plot 42, Civil Lines, Mumbai'
    },
    {
      name: 'Vishal Kharva',
      gender: 'Male',
      age: 32,
      mobile: '9845211928',
      password: await bcrypt.hash('password123', 10),
      address: 'Sector 5, Bandra West, Mumbai'
    },
    {
      name: 'Pratham Kharva',
      gender: 'Male',
      age: 22,
      mobile: '9711233455',
      password: await bcrypt.hash('password123', 10),
      address: 'Linking Road, Santa Cruz, Mumbai'
    }
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { mobile: p.mobile },
      update: p,
      create: p
    });
  }
  console.log(`✅ Seeded ${patients.length} genuine patient accounts.`);

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

  // 3. Seed Default Staff Users
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const hashedDoctorPassword = await bcrypt.hash('doctor123', 10);
  const hashedRajeshPassword = await bcrypt.hash('Doctor@123', 10);
  
  await prisma.staffUser.upsert({
    where: { username: 'admin1' },
    update: {
      name: 'System Admin',
      role: 'ADMIN',
      specialization: 'General Medicine',
      roomNumber: '100',
      availabilityStatus: 'AVAILABLE'
    },
    create: {
      username: 'admin1',
      password: hashedAdminPassword,
      role: 'ADMIN',
      name: 'System Admin',
      specialization: 'General Medicine',
      roomNumber: '100',
      availabilityStatus: 'AVAILABLE'
    }
  });

  await prisma.staffUser.upsert({
    where: { username: 'doctor1' },
    update: {
      name: 'Dr. Asha Sharma',
      role: 'DOCTOR',
      specialization: 'Cardiology',
      roomNumber: '104',
      availabilityStatus: 'AVAILABLE'
    },
    create: {
      username: 'doctor1',
      password: hashedDoctorPassword,
      role: 'DOCTOR',
      name: 'Dr. Asha Sharma',
      specialization: 'Cardiology',
      roomNumber: '104',
      availabilityStatus: 'AVAILABLE'
    }
  });

  await prisma.staffUser.upsert({
    where: { username: 'dr.rajesh' },
    update: {
      name: 'Dr. Rajesh Gupta',
      role: 'DOCTOR',
      specialization: 'General Medicine',
      roomNumber: '104',
      availabilityStatus: 'AVAILABLE'
    },
    create: {
      username: 'dr.rajesh',
      password: hashedRajeshPassword,
      role: 'DOCTOR',
      name: 'Dr. Rajesh Gupta',
      specialization: 'General Medicine',
      roomNumber: '104',
      availabilityStatus: 'AVAILABLE'
    }
  });

  console.log(`✅ Seeded default Staff Users (admin1, doctor1, dr.rajesh).`);

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
