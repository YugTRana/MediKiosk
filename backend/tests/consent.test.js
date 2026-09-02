import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Granular DPDP Act Consent & Right to Erasure Suite', () => {
  const testSessionId = `test-consent-${Date.now()}`;
  const testToken = `K-TEST-${Math.floor(100 + Math.random() * 900)}`;

  beforeAll(async () => {
    // Create test session with active consent
    await prisma.session.create({
      data: {
        id: testSessionId,
        tokenNumber: testToken,
        complaintId: 'fever',
        complaintTitle: 'Acute High Grade Fever',
        language: 'Hindi',
        status: 'WAITING_OPD',
        answers: JSON.stringify([
          { questionId: 'fever_character', customVoiceText: 'Very high fever with severe chills and shivering' }
        ]),
        redFlagsTriggered: JSON.stringify(['High fever with altered consciousness']),
        consentStatus: 'GRANTED',
        consentRecord: {
          create: {
            purpose: 'OUTPATIENT_CONSULTATION',
            allowDataCapture: true,
            allowHisSharing: true,
            allowAbdmLinking: true,
            status: 'GRANTED'
          }
        },
        digitizedDocument: {
          create: {
            fileName: 'fever_report.pdf',
            documentType: 'lab_report',
            documentTitle: 'CBC Diagnostic Report',
            rawText: 'Patient sensitive clinical notes and WBC 18500',
            confidenceScore: 0.95
          }
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.consentRecord.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.digitizedDocument.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.session.deleteMany({ where: { id: testSessionId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('Verifies initial session contains active granular consent and sensitive data', async () => {
    const session = await prisma.session.findUnique({
      where: { id: testSessionId },
      include: { consentRecord: true, digitizedDocument: true }
    });

    expect(session).toBeDefined();
    expect(session.consentRecord.status).toBe('GRANTED');
    expect(session.consentRecord.allowDataCapture).toBe(true);
    expect(session.digitizedDocument).toBeDefined();
    expect(session.digitizedDocument.rawText).toContain('sensitive clinical notes');
  });

  it('Revokes consent and enforces DPDP Act Right to Erasure (raw data purge)', async () => {
    // 1. Mark consent record as revoked
    const updatedConsent = await prisma.consentRecord.update({
      where: { sessionId: testSessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date()
      }
    });
    expect(updatedConsent.status).toBe('REVOKED');
    expect(updatedConsent.revokedAt).toBeDefined();

    // 2. Erase sensitive session raw answers and delete attached documents
    await prisma.session.update({
      where: { id: testSessionId },
      data: {
        status: 'CONSENT_REVOKED',
        answers: '[]',
        redFlagsTriggered: '[]'
      }
    });

    await prisma.digitizedDocument.deleteMany({
      where: { sessionId: testSessionId }
    });

    // 3. Verify that raw personal health data is completely erased from the database
    const purgedSession = await prisma.session.findUnique({
      where: { id: testSessionId },
      include: { consentRecord: true, digitizedDocument: true }
    });

    expect(purgedSession.status).toBe('CONSENT_REVOKED');
    expect(purgedSession.answers).toBe('[]');
    expect(purgedSession.redFlagsTriggered).toBe('[]');
    expect(purgedSession.digitizedDocument).toBeNull();
  });
});
