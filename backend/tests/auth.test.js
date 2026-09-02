import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registerPatient, loginPatient, loginStaff } = require('../services/authService');

describe('Authentication, Passwords & RBAC Suite', () => {
  const testMobile = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
  const testPassword = 'SecurePassword123!';
  let createdPatientId = null;

  beforeAll(async () => {
    // Seed doctor and admin staff accounts for role-based authentication tests
    const hashedPassword = await bcrypt.hash('DoctorPass2026!', 10);
    const hashedAdminPassword = await bcrypt.hash('AdminMaster2026!', 10);

    await prisma.staffUser.upsert({
      where: { username: 'doctor' },
      update: { password: hashedPassword },
      create: {
        username: 'doctor',
        name: 'Dr. Sunita Rao',
        password: hashedPassword,
        role: 'DOCTOR'
      }
    });

    await prisma.staffUser.upsert({
      where: { username: 'admin' },
      update: { password: hashedAdminPassword },
      create: {
        username: 'admin',
        name: 'Super Admin',
        password: hashedAdminPassword,
        role: 'ADMIN'
      }
    });
  });

  afterAll(async () => {
    if (createdPatientId) {
      await prisma.patient.delete({ where: { id: createdPatientId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('Registers a new patient and stores password as salted bcrypt hash (never plaintext)', async () => {
    const profile = await registerPatient({
      name: 'Anjali Verma',
      mobile: testMobile,
      password: testPassword,
      age: 29,
      gender: 'Female',
      address: 'Indore, MP'
    });

    expect(profile).toBeDefined();
    expect(profile.id).toBeDefined();
    createdPatientId = profile.id;
    expect(profile.name).toBe('Anjali Verma');
    expect(profile.mobile).toBe(testMobile);
    expect(profile.token).toBeDefined();

    // Verify in database that password is cryptographically hashed
    const rawDbRecord = await prisma.patient.findUnique({ where: { id: profile.id } });
    expect(rawDbRecord.password).not.toBe(testPassword);
    expect(rawDbRecord.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
    const matches = await bcrypt.compare(testPassword, rawDbRecord.password);
    expect(matches).toBe(true);
  });

  it('Successfully logs in patient with correct credentials and returns JWT', async () => {
    const loggedIn = await loginPatient({
      mobile: testMobile,
      password: testPassword
    });

    expect(loggedIn).toBeDefined();
    expect(loggedIn.name).toBe('Anjali Verma');
    expect(loggedIn.token).toBeDefined();

    // Verify JWT payload
    const decoded = jwt.verify(loggedIn.token, process.env.JWT_SECRET || 'dev_secret_key_change_in_prod');
    expect(decoded.role).toBe('PATIENT');
    expect(decoded.id).toBe(createdPatientId);
  });

  it('Rejects login attempt with incorrect password', async () => {
    await expect(loginPatient({
      mobile: testMobile,
      password: 'WrongPassword999'
    })).rejects.toThrow(/incorrect password/i);
  });

  it('Authenticates staff members with DOCTOR and ADMIN roles', async () => {
    const doctorAuth = await loginStaff({
      username: 'doctor',
      password: 'DoctorPass2026!'
    });
    expect(doctorAuth.role).toBe('DOCTOR');
    expect(doctorAuth.token).toBeDefined();

    const adminAuth = await loginStaff({
      username: 'admin',
      password: 'AdminMaster2026!'
    });
    expect(adminAuth.role).toBe('ADMIN');
    expect(adminAuth.token).toBeDefined();
  });
});
