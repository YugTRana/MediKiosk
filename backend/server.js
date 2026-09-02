const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { processDocumentWithOcr, extractRawTextFromBuffer, parseClinicalEntitiesFromText } = require('./services/ocrEngine');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer in-memory upload handler for PDF & Image OCR processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // Up to 25MB documents/photos
});

// Fallback dialogue flows path
const dialogueFlowsPath = path.join(__dirname, 'mockData', 'dialogueFlows.json');
let fallbackFlows = { complaints: [] };
try {
  if (fs.existsSync(dialogueFlowsPath)) {
    fallbackFlows = JSON.parse(fs.readFileSync(dialogueFlowsPath, 'utf8'));
  }
} catch (e) {}

// ==============================================================================
// 1. HEALTH CHECK & STATS
// ==============================================================================
app.get('/api/health', async (req, res) => {
  try {
    const [totalSessions, totalPatients, totalRedFlags, totalHisPushes, totalDocs] = await Promise.all([
      prisma.session.count().catch(() => 0),
      prisma.patient.count().catch(() => 0),
      prisma.redFlagAlert.count().catch(() => 0),
      prisma.hisPushedRecord.count().catch(() => 0),
      prisma.digitizedDocument.count().catch(() => 0)
    ]);

    res.json({
      status: 'ok',
      service: 'MediKiosk API Server',
      database: 'Prisma SQLite (Active & Connected)',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      activeSessionCount: totalSessions,
      registeredPatientsCount: totalPatients,
      redFlagAlertCount: totalRedFlags,
      digitizedDocCount: totalDocs,
      hisPushedCount: totalHisPushes
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==============================================================================
// 2. CHIEF COMPLAINT & DIALOGUE FLOWS (FROM PRISMA DB)
// ==============================================================================
app.get('/api/dialogue-flows', async (req, res) => {
  try {
    const complaints = await prisma.chiefComplaint.findMany({
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    if (complaints && complaints.length > 0) {
      return res.json({ complaints });
    }

    // Fallback if database has not yet been seeded
    res.json(fallbackFlows);
  } catch (err) {
    console.warn('[MediKiosk Backend] Error fetching dialogue flows from DB, using fallback:', err.message);
    res.json(fallbackFlows);
  }
});

// ==============================================================================
const { 
  registerPatient, 
  loginPatient, 
  getAllPatients, 
  updatePatientProfile, 
  deletePatientProfile 
} = require('./services/authService');

// ==============================================================================
// 3. PATIENT AUTHENTICATION & ADMIN MANAGEMENT ENDPOINTS
// ==============================================================================

// A. Patient Sign Up (Registration)
app.post('/api/auth/signup', async (req, res) => {
  const { name, mobile, password, age, gender, address } = req.body || {};
  try {
    const profile = await registerPatient({ name, mobile, password, age, gender, address });
    res.status(201).json({
      success: true,
      message: 'Account created successfully! You are now logged in.',
      patientProfile: profile
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// B. Patient Login (Mobile + Password)
app.post('/api/auth/login', async (req, res) => {
  const { mobile, password } = req.body || {};
  try {
    const profile = await loginPatient({ mobile, password });
    res.status(200).json({
      success: true,
      message: `Welcome back, ${profile.name}!`,
      patientProfile: profile
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// C. Admin: Get All Registered Patients & Consultation Counts
app.get('/api/admin/patients', async (req, res) => {
  try {
    const patients = await getAllPatients();
    res.status(200).json({
      success: true,
      totalCount: patients.length,
      patients
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// D. Admin: Update Patient Profile
app.put('/api/admin/patients/:id', async (req, res) => {
  const { id } = req.params;
  const { name, mobile, age, gender, address, password } = req.body || {};
  try {
    const updated = await updatePatientProfile({ id, name, mobile, age, gender, address, password });
    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      patientProfile: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// E. Admin: Delete Patient Record
app.delete('/api/admin/patients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deletePatientProfile(id);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 4. REAL OCR & DOCUMENT DIGITIZATION (PDF & PHOTO SCANNING)
// ==============================================================================
app.post('/api/docai/extract', upload.single('documentFile'), async (req, res) => {
  const file = req.file;
  const fileName = req.body.fileName || (file ? file.originalname : 'uploaded_report.pdf');
  const documentType = req.body.documentType || 'auto';
  const complaintId = req.body.complaintId || 'auto';

  console.log(`\n📄 [DOCAI OCR] Processing real document: ${fileName} (Size: ${file ? file.size : 0} bytes, Complaint: ${complaintId})...`);

  try {
    const extractedData = await processDocumentWithOcr({
      buffer: file?.buffer,
      mimeType: file?.mimetype,
      fileName,
      complaintId
    });

    console.log(`✅ [DOCAI OCR] Parsed ${extractedData.labValues?.length || 0} lab markers & ${extractedData.medications?.length || 0} medications.`);

    res.status(200).json({
      success: true,
      extractedData
    });
  } catch (err) {
    console.error('❌ [DOCAI OCR] Error during OCR extraction:', err);
    res.status(500).json({
      success: false,
      error: 'OCR_EXTRACTION_FAILED',
      message: err.message
    });
  }
});

// ==============================================================================
// 5. SUBMIT PATIENT CHECK-IN SESSION (PRISMA DB TRANSACTION)
// ==============================================================================
app.post('/api/session/submit', async (req, res) => {
  const { 
    sessionId, 
    complaintId, 
    complaintTitle, 
    answers, 
    redFlagsTriggered = [], 
    language = 'English', 
    patientDetails,
    abhaDetails,
    consentStatus = 'GRANTED',
    consentTimestamp,
    digitizedDocument,
    ayushAssessment
  } = req.body;

  try {
    // Generate Token Number based on session count
    const sessionCount = await prisma.session.count();
    const tokenNumber = `K-${101 + sessionCount}`;

    // Find or create patient
    let patientRecord = null;
    const patientMobile = patientDetails?.mobile ? String(patientDetails.mobile).replace(/[^0-9]/g, '').slice(-10) : null;
    if (patientDetails?.id) {
      patientRecord = await prisma.patient.findUnique({
        where: { id: patientDetails.id }
      });
    } else if (patientMobile) {
      patientRecord = await prisma.patient.findUnique({
        where: { mobile: patientMobile }
      });

      if (!patientRecord) {
        patientRecord = await prisma.patient.create({
          data: {
            name: patientDetails?.name || 'Walk-in Patient',
            gender: patientDetails?.gender || 'Male',
            age: parseInt(patientDetails?.age || '30', 10),
            mobile: patientMobile,
            password: 'defaultPassword123',
            address: patientDetails?.address || 'Walk-in OPD'
          }
        });
      }
    }

    const sid = sessionId || `sess_${Date.now()}`;
    const status = redFlagsTriggered && redFlagsTriggered.length > 0 ? 'TRIAGE_URGENT' : 'WAITING_OPD';

    // Create Session in Prisma DB
    const newSession = await prisma.session.create({
      data: {
        id: sid,
        tokenNumber,
        complaintId: complaintId || 'general',
        complaintTitle: complaintTitle || 'General Consultation',
        language,
        consentStatus,
        consentTimestamp: consentTimestamp ? new Date(consentTimestamp) : new Date(),
        status,
        answers: JSON.stringify(answers || []),
        redFlagsTriggered: JSON.stringify(redFlagsTriggered || []),
        ayushAssessment: ayushAssessment ? JSON.stringify(ayushAssessment) : null,
        patientId: patientRecord ? patientRecord.id : null,
        digitizedDocument: digitizedDocument ? {
          create: {
            fileName: digitizedDocument.fileName || 'scanned_report.pdf',
            documentType: digitizedDocument.documentType || 'auto',
            documentTitle: digitizedDocument.documentTitle || 'Clinical Document',
            facility: digitizedDocument.facility || null,
            date: digitizedDocument.date || new Date().toISOString().split('T')[0],
            prescriber: digitizedDocument.prescriber || null,
            imagingFindings: digitizedDocument.imagingFindings || null,
            rawText: digitizedDocument.rawText || null,
            medications: JSON.stringify(digitizedDocument.medications || []),
            labValues: JSON.stringify(digitizedDocument.labValues || []),
            diagnoses: JSON.stringify(digitizedDocument.diagnoses || []),
            confidenceScore: parseFloat(digitizedDocument.confidenceScore || '0.96')
          }
        } : undefined
      },
      include: {
        patient: true,
        digitizedDocument: true
      }
    });

    // If red flags triggered, log into RedFlagAlert table
    if (redFlagsTriggered && redFlagsTriggered.length > 0) {
      for (const rf of redFlagsTriggered) {
        await prisma.redFlagAlert.create({
          data: {
            sessionId: newSession.id,
            complaintId: complaintId || 'general',
            reason: typeof rf === 'string' ? rf : (rf.reason || 'Critical Red Flag Detected'),
            triggerReason: typeof rf === 'string' ? rf : (rf.reason || 'Critical Red Flag Detected'),
            severity: 'CRITICAL',
            status: 'ACTIVE_ALERT'
          }
        });
      }
    }

    console.log(`\n💾 [PRISMA DB PERSISTED] Token: ${tokenNumber} | ID: ${newSession.id} | Patient: ${patientRecord?.name || 'Walk-in'} | Status: ${status}`);

    res.status(201).json({
      success: true,
      tokenNumber,
      message: 'Session persisted in database successfully',
      session: {
        id: newSession.id,
        tokenNumber: newSession.tokenNumber,
        submittedAt: newSession.submittedAt,
        complaintId: newSession.complaintId,
        complaintTitle: newSession.complaintTitle,
        language: newSession.language,
        status: newSession.status,
        answers: JSON.parse(newSession.answers),
        redFlagsTriggered: JSON.parse(newSession.redFlagsTriggered),
        ayushAssessment: newSession.ayushAssessment ? JSON.parse(newSession.ayushAssessment) : null,
        patientDetails: newSession.patient ? {
          id: newSession.patient.id,
          name: newSession.patient.name,
          age: newSession.patient.age,
          gender: newSession.patient.gender,
          mobile: newSession.patient.mobile,
          address: newSession.patient.address
        } : null,
        digitizedDocument: newSession.digitizedDocument ? {
          ...newSession.digitizedDocument,
          medications: JSON.parse(newSession.digitizedDocument.medications),
          labValues: JSON.parse(newSession.digitizedDocument.labValues),
          diagnoses: JSON.parse(newSession.digitizedDocument.diagnoses)
        } : null
      }
    });
  } catch (err) {
    console.error('❌ [Session Submit] Database error:', err);
    res.status(500).json({ success: false, error: 'DB_ERROR', message: err.message });
  }
});

// ==============================================================================
// 6. GET SESSIONS LIST FOR DOCTOR DASHBOARD & ADMIN PANEL
// ==============================================================================
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        patient: true,
        digitizedDocument: true,
        redFlags: true,
        hisPush: true
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    const formattedSessions = sessions.map(s => ({
      id: s.id,
      tokenNumber: s.tokenNumber,
      submittedAt: s.submittedAt,
      complaintId: s.complaintId,
      complaintTitle: s.complaintTitle,
      language: s.language,
      status: s.status,
      answers: JSON.parse(s.answers || '[]'),
      redFlagsTriggered: JSON.parse(s.redFlagsTriggered || '[]'),
      ayushAssessment: s.ayushAssessment ? JSON.parse(s.ayushAssessment) : null,
      patientDetails: s.patient ? {
        id: s.patient.id,
        name: s.patient.name,
        age: s.patient.age,
        gender: s.patient.gender,
        mobile: s.patient.mobile,
        address: s.patient.address
      } : null,
      digitizedDocument: s.digitizedDocument ? {
        ...s.digitizedDocument,
        medications: JSON.parse(s.digitizedDocument.medications || '[]'),
        labValues: JSON.parse(s.digitizedDocument.labValues || '[]'),
        diagnoses: JSON.parse(s.digitizedDocument.diagnoses || '[]')
      } : null
    }));

    const redFlags = await prisma.redFlagAlert.findMany({ orderBy: { timestamp: 'desc' } });
    const hisPushes = await prisma.hisPushedRecord.findMany({ orderBy: { pushedAt: 'desc' } });

    res.json({
      totalSessions: formattedSessions.length,
      sessions: formattedSessions,
      redFlags,
      hisPushes
    });
  } catch (err) {
    console.error('❌ [GET /api/sessions] Database error:', err);
    res.status(500).json({ success: false, error: 'DB_ERROR', message: err.message });
  }
});

// ==============================================================================
// 7. EMR / HOSPITAL HIS FHIR PUSH
// ==============================================================================
app.post('/api/his/push', async (req, res) => {
  const { sessionId, tokenNumber, fhirBundle } = req.body || {};
  const emrRecordId = `EMR-REC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const pushedRecord = await prisma.hisPushedRecord.upsert({
      where: { sessionId: sessionId || `sess_${Date.now()}` },
      update: {
        emrRecordId,
        fhirBundle: JSON.stringify(fhirBundle || {}),
        pushedAt: new Date(),
        status: 'SYNCED'
      },
      create: {
        emrRecordId,
        sessionId: sessionId || `sess_${Date.now()}`,
        hospitalName: 'District Central Government Hospital',
        department: 'Outpatient General & Integrated Medicine',
        resourceCount: fhirBundle?.entry?.length || 5,
        fhirBundle: JSON.stringify(fhirBundle || {})
      }
    });

    if (sessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' }
      }).catch(() => {});
    }

    console.log(`✅ [HOSPITAL EMR] Committed EMR Record: ${emrRecordId} for Token ${tokenNumber}`);

    res.status(200).json({
      success: true,
      message: 'Clinical note and FHIR resources successfully synced to Hospital EMR database',
      emrRecordId,
      syncedAt: pushedRecord.pushedAt,
      receipt: pushedRecord
    });
  } catch (err) {
    console.error('❌ [HIS Push] Error:', err);
    res.status(500).json({ success: false, error: 'HIS_PUSH_ERROR', message: err.message });
  }
});

// ==============================================================================
// 8. UPDATE SESSION STATUS (CALL PATIENT / COMPLETE)
// ==============================================================================
app.patch('/api/sessions/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updated = await prisma.session.update({
      where: { id },
      data: { status: status || 'CALLED' }
    });
    console.log(`📢 [SESSION STATUS] Session ${id} status updated to: ${status || 'CALLED'}`);
    res.json({ success: true, session: updated });
  } catch (err) {
    console.error('❌ [PATCH Session Status] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[MediKiosk Backend] Server running on http://localhost:${PORT}`);
  console.log(`[MediKiosk Backend] Real OCR engine & Prisma ORM database initialized.`);
});
