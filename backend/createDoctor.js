/**
 * Helper Script to Add a New Doctor to MediKiosk
 * Usage:
 *   node createDoctor.js "<Doctor Full Name>" "<username>" "<password>"
 * 
 * Example:
 *   node createDoctor.js "Dr. Rajesh Gupta" "dr.rajesh" "Doctor@123"
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  const name = args[0] || 'Dr. Rajesh Gupta (General Medicine)';
  const username = args[1] || 'dr.rajesh';
  const password = args[2] || 'Doctor@123';

  console.log(`\n🩺 Creating New Doctor Account:`);
  console.log(`- Full Name: ${name}`);
  console.log(`- Username:  ${username}`);
  console.log(`- Password:  ${password}`);

  const hashedPassword = await bcrypt.hash(password.trim(), 10);

  const doctor = await prisma.staffUser.upsert({
    where: { username: username.trim().toLowerCase() },
    update: {
      name,
      password: hashedPassword,
      role: 'DOCTOR'
    },
    create: {
      name,
      username: username.trim().toLowerCase(),
      password: hashedPassword,
      role: 'DOCTOR'
    }
  });

  console.log(`\n✅ Doctor account created successfully!`);
  console.log(`ID:       ${doctor.id}`);
  console.log(`Name:     ${doctor.name}`);
  console.log(`Username: ${doctor.username}`);
  console.log(`Role:     ${doctor.role}`);
  console.log(`\nYou can now log in at: http://localhost:5173/staff-login or http://localhost:5173/doctor\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error creating doctor:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
