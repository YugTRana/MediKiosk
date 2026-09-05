const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seedDoctors() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const doctors = [
    { username: 'dr.bhavin', name: 'Dr. Bhavin Surti (Dermatology / Skin)', role: 'DOCTOR', password: passwordHash },
    { username: 'dr.kinjal', name: 'Dr. Kinjal Dave (General Medicine / Fever / Cough)', role: 'DOCTOR', password: passwordHash },
    { username: 'dr.abisek', name: 'Dr. Abisek Darjee (Orthopedics / Joint Pain)', role: 'DOCTOR', password: passwordHash },
    { username: 'dr.yashvant', name: 'Dr. Yashvant Trivedi (Ayurvedic)', role: 'DOCTOR', password: passwordHash }
  ];

  for (const doc of doctors) {
    const existing = await prisma.staffUser.findUnique({ where: { username: doc.username } });
    if (!existing) {
      await prisma.staffUser.create({ data: doc });
      console.log(`Created doctor: ${doc.name}`);
    } else {
      console.log(`Doctor ${doc.username} already exists.`);
    }
  }

  console.log('Seeding completed.');
}

seedDoctors()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
