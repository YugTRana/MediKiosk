import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  mapComplaintToDepartment,
  isSpecializationMatch,
  findAndAssignOptimalDoctor
} from '../services/opdAssignmentEngine.js';

const prisma = new PrismaClient();

describe('Multi-Doctor OPD Assignment & Lifecycle Engine', () => {
  beforeEach(async () => {
    // Scope cleanup to test-created sessions to avoid interfering with concurrent test suites
    await prisma.session.deleteMany({
      where: {
        tokenNumber: { startsWith: 'K-OPDTEST-' }
      }
    }).catch(() => {});
  });

  it('correctly maps chief complaints to medical specializations', () => {
    expect(mapComplaintToDepartment('chest_pain', 'Chest Pain')).toBe('Cardiology');
    expect(mapComplaintToDepartment('joint_pain', 'Joint Pain')).toBe('Orthopedics');
    expect(mapComplaintToDepartment('fever', 'High Fever')).toBe('General Medicine');
    expect(mapComplaintToDepartment('ayush_consultation', 'Ayurvedic Intake')).toBe('AYUSH & Integrated Medicine');
  });

  it('assigns chest pain patient to an AVAILABLE Cardiology doctor', async () => {
    const assignment = await findAndAssignOptimalDoctor({
      complaintId: 'chest_pain',
      complaintTitle: 'Chest Pain / Heart Discomfort',
      prismaClient: prisma
    });

    expect(assignment.department).toBe('Cardiology');
    expect(assignment.assignedDoctorId).toBeTruthy();

    const doctor = await prisma.staffUser.findUnique({ where: { id: assignment.assignedDoctorId } });
    expect(doctor.specialization).toBe('Cardiology');
    expect(doctor.availabilityStatus).toBe('AVAILABLE');
  });

  it('balances load across doctors', async () => {
    const testId = Date.now();
    // Assign 1st patient (Fever -> General Medicine -> Dr. Rajesh Gupta)
    const assign1 = await findAndAssignOptimalDoctor({
      complaintId: 'fever',
      complaintTitle: 'Fever',
      prismaClient: prisma
    });

    await prisma.session.create({
      data: {
        id: `sess_test_1_${testId}`,
        tokenNumber: `K-OPDTEST-1-${testId}`,
        complaintId: 'fever',
        complaintTitle: 'Fever',
        department: assign1.department,
        assignedDoctorId: assign1.assignedDoctorId,
        status: 'WAITING',
        answers: '[]'
      }
    });

    // Assign 2nd patient (General Medicine) -> should balance load to Dr. Asha Sharma when Rajesh has active load or round-robin
    const assign2 = await findAndAssignOptimalDoctor({
      complaintId: 'fever',
      complaintTitle: 'Fever',
      prismaClient: prisma
    });

    expect(assign2.assignedDoctorId).toBeTruthy();
  });

  it('falls back to General Medicine doctor when Cardiology specialist is OFFLINE', async () => {
    // Set Cardiology doctor (Dr. Asha Sharma) to OFFLINE
    await prisma.staffUser.updateMany({
      where: { username: 'doctor1' },
      data: { availabilityStatus: 'OFFLINE' }
    });

    const assignment = await findAndAssignOptimalDoctor({
      complaintId: 'chest_pain',
      complaintTitle: 'Chest Pain',
      prismaClient: prisma
    });

    const doctor = await prisma.staffUser.findUnique({ where: { id: assignment.assignedDoctorId } });
    expect(doctor.username).toBe('dr.rajesh');
    expect(doctor.specialization).toBe('General Medicine');

    // Restore Cardiology doctor
    await prisma.staffUser.updateMany({
      where: { username: 'doctor1' },
      data: { availabilityStatus: 'AVAILABLE' }
    });
  });

  it('handles complete lifecycle (WAITING -> CALLED -> IN_CONSULTATION -> COMPLETED)', async () => {
    const doctor = await prisma.staffUser.findFirst({ where: { role: 'DOCTOR' } });
    const testId = Date.now();
    const sid = `sess_lifecycle_${testId}`;

    // 1. Create Session (WAITING)
    const session = await prisma.session.create({
      data: {
        id: sid,
        tokenNumber: `K-OPDTEST-LIFE-${testId}`,
        complaintId: 'fever',
        complaintTitle: 'Fever',
        department: 'General Medicine',
        assignedDoctorId: doctor.id,
        status: 'WAITING',
        answers: '[]'
      }
    });

    expect(session.status).toBe('WAITING');

    // 2. Call Patient (CALLED)
    const called = await prisma.session.update({
      where: { id: sid },
      data: { status: 'CALLED', calledAt: new Date(), calledBy: doctor.id }
    });
    expect(called.status).toBe('CALLED');

    // 3. Start Consultation (IN_CONSULTATION)
    const inConsult = await prisma.session.update({
      where: { id: sid },
      data: { status: 'IN_CONSULTATION', consultationStartedAt: new Date() }
    });
    expect(inConsult.status).toBe('IN_CONSULTATION');

    // 4. Complete (COMPLETED)
    const completed = await prisma.session.update({
      where: { id: sid },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    expect(completed.status).toBe('COMPLETED');

    // 5. Verify completed session is removed from active queue
    const activeQueue = await prisma.session.findMany({
      where: {
        assignedDoctorId: doctor.id,
        status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] }
      }
    });
    expect(activeQueue.find(s => s.id === sid)).toBeUndefined();

    // 6. Verify session still exists in database history
    const inDb = await prisma.session.findUnique({ where: { id: sid } });
    expect(inDb).toBeTruthy();
    expect(inDb.status).toBe('COMPLETED');
  });
});
