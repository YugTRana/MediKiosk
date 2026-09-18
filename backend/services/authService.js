const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

/**
 * Authentication & Patient Profile Management Service
 * Manages standard patient registration, secure password login, and admin records.
 */

// Helper to clean mobile
function cleanMobileDigits(mobile) {
  return String(mobile || '').replace(/[^0-9]/g, '').slice(-10);
}

/**
 * 1. Register a New Patient (Sign Up)
 */
async function registerPatient({ name, mobile, email, password, age, gender, address }) {
  if (!name || !name.trim()) {
    throw new Error('Please enter your full name.');
  }

  const cleanMobile = cleanMobileDigits(mobile);
  if (!cleanMobile || cleanMobile.length !== 10) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }

  if (!password || password.trim().length < 4) {
    throw new Error('Please enter a password with at least 4 characters.');
  }

  if (email) {
    const existingEmail = await prisma.patient.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
    if (existingEmail) {
      throw new Error(`An account with email ${email} is already registered.`);
    }
  }

  // Check if mobile already registered
  const existing = await prisma.patient.findUnique({
    where: { mobile: cleanMobile }
  });

  if (existing) {
    throw new Error(`A patient account with mobile number +91 ${cleanMobile} is already registered. Please Log In.`);
  }

  const parsedAge = parseInt(age, 10) || 28;
  const patientGender = gender || 'Male';
  const patientAddress = address && address.trim() ? address.trim() : 'Registered MediKiosk User';

  const newPatient = await prisma.patient.create({
    data: {
      name: name.trim(),
      mobile: cleanMobile,
      email: email ? email.trim().toLowerCase() : null,
      password: await bcrypt.hash(password.trim(), 10), // Stored securely
      age: parsedAge,
      gender: patientGender,
      address: patientAddress
    }
  });

  const token = jwt.sign(
    { id: newPatient.id, mobile: newPatient.mobile, role: 'PATIENT' },
    JWT_SECRET,
    { expiresIn: '4h' }
  );

  console.log(`🎉 [Auth Service] New Patient Registered: ${newPatient.name} (+91 ${newPatient.mobile})`);

  return {
    id: newPatient.id,
    name: newPatient.name,
    mobile: newPatient.mobile,
    age: newPatient.age,
    gender: newPatient.gender,
    address: newPatient.address,
    createdAt: newPatient.createdAt,
    token
  };
}

/**
 * 2. Patient Login (Mobile + Password)
 */
async function loginPatient({ mobile, password }) {
  const cleanMobile = cleanMobileDigits(mobile);
  if (!cleanMobile || cleanMobile.length !== 10) {
    throw new Error('Please enter your registered 10-digit mobile number.');
  }

  if (!password) {
    throw new Error('Please enter your password.');
  }

  const patient = await prisma.patient.findUnique({
    where: { mobile: cleanMobile }
  });

  if (!patient) {
    throw new Error(`No account found with mobile +91 ${cleanMobile}. Please Sign Up first.`);
  }

  const isMatch = await bcrypt.compare(password.trim(), patient.password);
  if (!isMatch) {
    throw new Error('Incorrect password entered. Please try again.');
  }

  const token = jwt.sign(
    { id: patient.id, mobile: patient.mobile, role: 'PATIENT' },
    JWT_SECRET,
    { expiresIn: '4h' }
  );

  console.log(`🔑 [Auth Service] Patient Logged In: ${patient.name} (+91 ${patient.mobile})`);

  return {
    id: patient.id,
    name: patient.name,
    mobile: patient.mobile,
    age: patient.age,
    gender: patient.gender,
    address: patient.address,
    createdAt: patient.createdAt,
    token
  };
}

/**
 * 3. Get All Registered Patients (For Admin Panel Records)
 */
async function getAllPatients() {
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { sessions: true }
      },
      sessions: {
        select: {
          id: true,
          tokenNumber: true,
          complaintTitle: true,
          status: true,
          submittedAt: true
        },
        orderBy: { submittedAt: 'desc' },
        take: 5
      }
    }
  });

  return patients.map(p => ({
    id: p.id,
    name: p.name,
    mobile: p.mobile,
    age: p.age,
    gender: p.gender,
    address: p.address,
    totalConsultations: p._count.sessions,
    recentSessions: p.sessions,
    registeredAt: p.createdAt
  }));
}

/**
 * 4. Update Patient Profile (Admin or Patient Edit)
 */
async function updatePatientProfile({ id, name, mobile, age, gender, address, password }) {
  const dataToUpdate = {};
  if (name && name.trim()) dataToUpdate.name = name.trim();
  if (age) dataToUpdate.age = parseInt(age, 10);
  if (gender) dataToUpdate.gender = gender;
  if (address !== undefined) dataToUpdate.address = address.trim();
  if (password && password.trim()) dataToUpdate.password = password.trim();
  if (mobile) {
    const cleanMobile = cleanMobileDigits(mobile);
    if (cleanMobile.length === 10) dataToUpdate.mobile = cleanMobile;
  }

  const updated = await prisma.patient.update({
    where: { id },
    data: dataToUpdate
  });

  console.log(`✏️ [Auth Service] Patient Record Updated: ${updated.name} (${updated.id})`);

  return {
    id: updated.id,
    name: updated.name,
    mobile: updated.mobile,
    age: updated.age,
    gender: updated.gender,
    address: updated.address,
    createdAt: updated.createdAt
  };
}

/**
 * 5. Delete Patient Record (Admin Action)
 */
async function deletePatientProfile(id) {
  const deleted = await prisma.patient.delete({
    where: { id }
  });

  console.log(`🗑️ [Auth Service] Deleted Patient Record: ${deleted.name} (${deleted.id})`);

  return {
    success: true,
    message: `Patient ${deleted.name} record deleted successfully.`
  };
}

/**
 * 6. Staff Login (Doctor/Admin)
 */
async function loginStaff({ username, password }) {
  if (!username || !password) {
    throw new Error('Please enter username and password.');
  }

  const cleanUsername = username.trim().toLowerCase();
  let staff = await prisma.staffUser.findFirst({
    where: {
      OR: [
        { username: cleanUsername },
        { username: username.trim() }
      ]
    }
  });

  if (!staff) {
    throw new Error('Invalid username or password.');
  }

  const isMatch = await bcrypt.compare(password.trim(), staff.password);
  if (!isMatch) {
    throw new Error('Invalid username or password.');
  }

  const token = jwt.sign(
    { id: staff.id, username: staff.username, role: staff.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  console.log(`🔑 [Auth Service] Staff Logged In: ${staff.username} (${staff.role})`);

  return {
    id: staff.id,
    username: staff.username,
    name: staff.name,
    role: staff.role,
    specialization: staff.specialization || 'General & Integrated Medicine',
    qualification: staff.qualification || 'MD',
    roomNumber: staff.roomNumber || '104',
    token
  };
}

module.exports = {
  registerPatient,
  loginPatient,
  getAllPatients,
  updatePatientProfile,
  deletePatientProfile,
  loginStaff
};
