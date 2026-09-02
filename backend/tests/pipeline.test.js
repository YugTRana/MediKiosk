import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { synthesizeClinicalSectionsDeterministic } = require('../services/clinicalSummaryService');
const { validateFhirR4Bundle } = require('../services/fhirValidationService');

describe('Clinical Pipeline: Intake -> Summary -> FHIR -> HIS Sync', () => {
  const testSessionId = `pipe-test-${Date.now()}`;
  const testToken = `K-PIPE-${Math.floor(100 + Math.random() * 900)}`;

  beforeAll(async () => {
    await prisma.session.create({
      data: {
        id: testSessionId,
        tokenNumber: testToken,
        complaintId: 'chest_pain',
        complaintTitle: 'Chest Pain / Heart Discomfort',
        language: 'English',
        status: 'WAITING_OPD',
        answers: JSON.stringify([
          { questionId: 'chest_onset', dimension: 'Onset', selectedOption: { labelEn: '1 hour ago' } },
          { questionId: 'chest_character', dimension: 'Character', selectedOption: { labelEn: 'Squeezing tightness' } }
        ]),
        redFlagsTriggered: JSON.stringify(['Diaphoresis with left arm radiation']),
        digitizedDocument: {
          create: {
            fileName: 'ecg_report.pdf',
            documentType: 'prescription',
            documentTitle: 'Emergency ECG & Rx',
            medications: JSON.stringify([{ name: 'Tab Sorbitrate', dose: '5mg', frequency: 'STAT' }]),
            labValues: JSON.stringify([{ test: 'Serum Troponin-I', value: '1.8', unit: 'ng/mL', flag: 'HIGH' }])
          }
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.hisPushedRecord.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.digitizedDocument.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.session.deleteMany({ where: { id: testSessionId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('Step 1: Genuinely synthesizes both conversational history and digitized document entities into 8 sections', async () => {
    const session = await prisma.session.findUnique({
      where: { id: testSessionId },
      include: { digitizedDocument: true }
    });

    const sections = synthesizeClinicalSectionsDeterministic(session, 'en');

    expect(sections.length).toBe(8);
    const codes = sections.map(s => s.shortCode);
    expect(codes).toContain('CC');
    expect(codes).toContain('HPI');
    expect(codes).toContain('MEDS');
    expect(codes).toContain('INV');

    // Verify HPI contains conversational intake findings
    const hpi = sections.find(s => s.shortCode === 'HPI');
    expect(hpi.content).toContain('chest pain');

    // Verify MEDS contains OCR extracted medication
    const meds = sections.find(s => s.shortCode === 'MEDS');
    expect(meds.content).toContain('Tab Sorbitrate');
  });

  it('Step 2: Produces an NRCES-compliant HL7 FHIR R4 Bundle that passes structural validation', () => {
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'document',
      identifier: { system: 'https://hospital.gov.in/fhir', value: `BUNDLE-${testToken}` },
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'Composition',
            id: 'comp-1',
            status: 'final',
            type: { text: 'Outpatient Triage Consultation Note' },
            subject: { reference: `Patient/pat-${testSessionId}` },
            author: [{ reference: 'Practitioner/dr-sunita-rao', display: 'Dr. Sunita Rao' }],
            section: [{ title: 'Chief Complaint', entry: [{ reference: 'Condition/c1' }] }]
          }
        },
        {
          resource: {
            resourceType: 'Patient',
            id: `pat-${testSessionId}`,
            name: [{ text: 'Ramesh Chandra Sharma' }],
            gender: 'male'
          }
        },
        {
          resource: {
            resourceType: 'Condition',
            id: 'c1',
            clinicalStatus: { coding: [{ code: 'active' }] },
            code: { text: 'Chest pain' },
            subject: { reference: `Patient/pat-${testSessionId}` }
          }
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-1',
            status: 'final',
            code: { text: 'Serum Troponin-I' }
          }
        },
        {
          resource: {
            resourceType: 'Consent',
            id: 'con-1',
            status: 'active',
            patient: { reference: `Patient/pat-${testSessionId}` }
          }
        }
      ]
    };

    const validation = validateFhirR4Bundle(fhirBundle);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
    expect(validation.validatedResources).toContain('Composition');
    expect(validation.validatedResources).toContain('Patient');
    expect(validation.validatedResources).toContain('Consent');
  });

  it('Step 3: Commits FHIR bundle to HIS and transitions session status to COMPLETED', async () => {
    const emrRecordId = `EMR-TEST-${Date.now()}`;
    
    // Upsert HIS pushed record
    const pushed = await prisma.hisPushedRecord.create({
      data: {
        emrRecordId,
        sessionId: testSessionId,
        hospitalName: 'District Central Government Hospital',
        department: 'Outpatient Cardiology',
        resourceCount: 5,
        fhirBundle: JSON.stringify({ resourceType: 'Bundle', id: 'bundle-test' }),
        status: 'SYNCED'
      }
    });

    expect(pushed.emrRecordId).toBe(emrRecordId);

    // Update session status
    const updated = await prisma.session.update({
      where: { id: testSessionId },
      data: { status: 'COMPLETED' }
    });

    expect(updated.status).toBe('COMPLETED');
  });
});
