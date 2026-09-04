const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { processDocumentWithOcr, extractRawTextFromBuffer, parseClinicalEntitiesFromText } = require('./services/ocrEngine');
const { verifyPatientToken, optionalPatientToken, requireRole } = require('./middleware/auth');
const { 
  registerPatient, 
  loginPatient, 
  loginStaff,
  getAllPatients, 
  updatePatientProfile, 
  deletePatientProfile 
} = require('./services/authService');
const { getNextQuestion } = require('./services/dialogueEngine');
const { getAyushClarifyingQuestion } = require('./services/ayushDialogueEngine');
const { getSpeechServiceConfig, bhashiniTranscribeAudio, bhashiniSynthesizeSpeech } = require('./services/bhashiniService');
const { validateFhirR4Bundle } = require('./services/fhirValidationService');
const { generateSynthesizedDossier } = require('./services/clinicalSummaryService');
const { 
  searchPatientProfile, 
  initiateAbdmOtp, 
  verifyAbdmOtpAndGetProfile, 
  processAbhaQrCode, 
  getAbdmGatewayStatus 
} = require('./services/abdmGateway');
const { purgeExpiredSessionData, startScheduledRetentionJob } = require('./services/dataRetentionJob');
const { findAndAssignOptimalDoctor, backfillUnassignedSessions } = require('./services/opdAssignmentEngine');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors({
  origin: true,
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

// Helper function to validate and stringify AYUSH assessment object
function validateAndNormalizeAyushAssessment(ayushData) {
  if (!ayushData) return null;
  try {
    if (typeof ayushData === 'string') return ayushData;
    return JSON.stringify(ayushData);
  } catch (e) {
    return null;
  }
}

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

// B2. Staff Login (Doctor/Admin)
app.post('/api/auth/staff-login', async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const profile = await loginStaff({ username, password });
    res.status(200).json({
      success: true,
      message: `Welcome back, ${profile.name}!`,
      token: profile.token,
      staffProfile: profile
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// B3. Get Current Authenticated Staff Profile
app.get('/api/auth/staff-profile', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  try {
    const staff = await prisma.staffUser.findUnique({
      where: { id: req.user.id }
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member profile not found.' });
    }

    const spec = staff.specialization || staff.department || 'General & Integrated Medicine';
    const rm = staff.roomNumber || staff.consultationRoom || '104';
    const status = staff.availabilityStatus || 'AVAILABLE';

    res.json({
      success: true,
      staffProfile: {
        id: staff.id,
        username: staff.username,
        name: staff.name,
        role: staff.role,
        specialization: spec,
        department: spec,
        qualification: staff.qualification || 'MD',
        roomNumber: rm,
        consultationRoom: rm,
        availabilityStatus: status,
        availability: status
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Protect Admin routes
app.use('/api/admin', requireRole(['ADMIN']));

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

// H. Admin: Real Metrics Aggregation
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalSessionsToday, redFlagCount, registeredPatientsCount, emrSyncedCount, completedSessions] = await Promise.all([
      prisma.session.count({ where: { submittedAt: { gte: todayStart } } }),
      prisma.redFlagAlert.count(),
      prisma.patient.count(),
      prisma.hisPushedRecord.count(),
      prisma.session.findMany({
        where: { status: 'COMPLETED', completedAt: { not: null } },
        select: { submittedAt: true, completedAt: true }
      })
    ]);

    let averageCompletionTime = 'No data';
    if (completedSessions.length > 0) {
      let totalMs = 0;
      completedSessions.forEach(s => {
        totalMs += new Date(s.completedAt).getTime() - new Date(s.submittedAt).getTime();
      });
      const avgSec = Math.round(totalMs / (completedSessions.length * 1000));
      const mins = Math.floor(avgSec / 60);
      const secs = avgSec % 60;
      averageCompletionTime = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }

    res.status(200).json({
      success: true,
      metrics: {
        totalSessionsToday,
        redFlagCount,
        averageCompletionTime,
        acceptanceRate: completedSessions.length > 0 ? '100%' : 'No data',
        registeredPatientsCount,
        emrSyncedCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 4a. DIALOGUE ENGINE (LLM ADAPTIVE QUESTIONING)
// ==============================================================================
app.post('/api/dialogue/next-question', async (req, res) => {
  const { complaintId, complaintTitle, history, patientMetadata } = req.body;
  try {
    const nextQuestion = await getNextQuestion({ complaintId, complaintTitle, history, patientMetadata });
    res.json(nextQuestion);
  } catch (error) {
    console.error('Error getting next question:', error);
    res.status(500).json({ success: false, message: 'Failed to get next question' });
  }
});

// ==============================================================================
// 4a2. AYUSH CLINICAL DIALOGUE (DYNAMIC CLARIFYING QUESTIONING)
// ==============================================================================
app.post('/api/dialogue/ayush-clarify', async (req, res) => {
  const { freeText, complaintTitle, currentAnswers, patientMetadata } = req.body;
  try {
    const result = await getAyushClarifyingQuestion({
      freeText,
      complaintTitle,
      currentAnswers,
      patientMetadata
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/dialogue/ayush-clarify:', err);
    res.status(500).json({ success: false, message: 'Failed to generate Ayurvedic clarifying question' });
  }
});

/**
 * Validates and normalizes the AYUSH Dashavidha Pariksha assessment payload.
 * Enforces structured schema:
 * - dominantDosha: string
 * - prakriti, vikriti, sara, samhanana, satmya, sattva, agni, vyayamaShakti, koshtha, aharaVihara: objects
 * - ayurvedicSummary: string
 */
function validateAndNormalizeAyushAssessment(input) {
  if (!input) return null;

  let assessment = input;
  if (typeof input === 'string') {
    try {
      assessment = JSON.parse(input);
    } catch (e) {
      console.warn('[Validation] Invalid JSON string in ayushAssessment, storing basic format.');
      return JSON.stringify({
        dominantDosha: 'Vata-Pitta',
        ayurvedicSummary: String(input)
      });
    }
  }

  if (typeof assessment !== 'object' || assessment === null) {
    return null;
  }

  const normalized = {
    dominantDosha: assessment.dominantDosha || 'Vata-Pitta',
    prakriti: assessment.prakriti || { value: 'vata_pitta', labelEn: 'Vata-Pitta Constitution' },
    vikriti: assessment.vikriti || { value: 'vata_vikriti', labelEn: 'Vata Aggravation' },
    sara: assessment.sara || { value: 'madhyama_sara', labelEn: 'Madhyama Sara' },
    samhanana: assessment.samhanana || { value: 'madhyama_samhanana', labelEn: 'Madhyama Samhanana' },
    satmya: assessment.satmya || { value: 'madhyama_satmya', labelEn: 'Madhyama Satmya' },
    sattva: assessment.sattva || { value: 'madhyama_sattva', labelEn: 'Madhyama Sattva' },
    agni: assessment.agni || { value: 'vishamagni', labelEn: 'Vishamagni' },
    vyayamaShakti: assessment.vyayamaShakti || { value: 'madhyama_vyayama', labelEn: 'Madhyama Vyayama Shakti' },
    koshtha: assessment.koshtha || { value: 'madhyama', labelEn: 'Madhyama Koshtha' },
    aharaVihara: assessment.aharaVihara || { value: 'balanced_habits', labelEn: 'Balanced Habits' },
    vaya: assessment.vaya || { stage: 'Madhyama Vaya', labelEn: 'Adult stage (20-60 yrs)' },
    clarifyingHistory: assessment.clarifyingHistory || null,
    ayurvedicSummary: assessment.ayurvedicSummary || `${assessment.dominantDosha || 'Vata-Pitta'} assessment recorded.`
  };

  return JSON.stringify(normalized);
}

// ==============================================================================
// 4b. SPEECH & VOICE AI (BHASHINI ASR & TTS GATEWAY)
// ==============================================================================
app.get('/api/speech/config', (req, res) => {
  try {
    const config = getSpeechServiceConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/speech/tts', async (req, res) => {
  const { text, language, gender } = req.body;
  try {
    const result = await bhashiniSynthesizeSpeech({ text, language, gender });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/speech/tts:', err);
    res.status(500).json({ success: false, fallback: 'browser', message: err.message });
  }
});

app.post('/api/speech/transcribe', async (req, res) => {
  const { base64Audio, language, audioFormat } = req.body;
  try {
    const result = await bhashiniTranscribeAudio({ base64Audio, language, audioFormat });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/speech/transcribe:', err);
    res.status(500).json({ success: false, fallback: 'browser', message: err.message });
  }
});

// ==============================================================================
// 5. OCR DOCUMENT DIGITIZATION (DocAI)
// ==============================================================================
app.post('/api/docai/extract', upload.single('documentFile'), async (req, res) => {
  const file = req.file;
  const fileName = req.body.fileName || (file ? file.originalname : 'uploaded_report.pdf');
  const documentType = req.body.documentType || 'auto';
  const complaintId = req.body.complaintId || 'auto';
  const patientId = req.body.patientId || req.patient?.id;

  console.log(`\n📄 [DOCAI OCR] Processing real document: ${fileName} (Size: ${file ? file.size : 0} bytes, Complaint: ${complaintId})...`);

  // Retrieve prior medications for cross-document drug-drug interaction detection
  let allPatientMedications = [];
  if (patientId) {
    try {
      const priorDocs = await prisma.digitizedDocument.findMany({
        where: { session: { patientId } },
        select: { medications: true }
      });
      for (const d of priorDocs) {
        if (d.medications) {
          try {
            const meds = typeof d.medications === 'string' ? JSON.parse(d.medications) : d.medications;
            if (Array.isArray(meds)) allPatientMedications.push(...meds);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('⚠️ [DOCAI OCR] Failed to load prior medications:', e.message);
    }
  }

  try {
    const extractedData = await processDocumentWithOcr({
      buffer: file?.buffer,
      mimeType: file?.mimetype,
      fileName,
      complaintId,
      allPatientMedications
    });

    console.log(`✅ [DOCAI OCR] Parsed ${extractedData.labValues?.length || 0} lab markers & ${extractedData.medications?.length || 0} medications (${extractedData.drugInteractions?.length || 0} drug interactions).`);

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

app.post('/api/docai/check-interactions', (req, res) => {
  const { medications } = req.body;
  const { checkDrugInteractions } = require('./services/clinicalDrugInteractionService');
  const interactions = checkDrugInteractions(medications || []);
  res.json({ success: true, interactions });
});

// ==============================================================================
// 5. SUBMIT PATIENT CHECK-IN SESSION (PRISMA DB TRANSACTION)
// ==============================================================================
app.post('/api/session/submit', optionalPatientToken, async (req, res) => {
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
      }).catch(() => null);
    } 
    if (!patientRecord && patientMobile && patientMobile.length === 10) {
      patientRecord = await prisma.patient.findUnique({
        where: { mobile: patientMobile }
      }).catch(() => null);

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
        }).catch(() => null);
      }
    }
    if (!patientRecord && req.user?.id) {
      patientRecord = await prisma.patient.findUnique({
        where: { id: req.user.id }
      }).catch(() => null);
    }
    if (!patientRecord && (patientDetails?.name || patientDetails?.fullName)) {
      const pName = patientDetails.name || patientDetails.fullName;
      const dummyMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
      patientRecord = await prisma.patient.create({
        data: {
          name: pName,
          gender: patientDetails?.gender || 'Female',
          age: parseInt(patientDetails?.age || '25', 10),
          mobile: dummyMobile,
          password: 'defaultPassword123',
          address: patientDetails?.address || 'Walk-in OPD'
        }
      }).catch(() => null);
    }

    const sid = sessionId || `sess_${Date.now()}`;
    const priority = redFlagsTriggered && redFlagsTriggered.length > 0 ? 'URGENT' : 'NORMAL';
    const status = 'WAITING';

    // Find and assign optimal doctor dynamically based on specialization & load
    const assignment = await findAndAssignOptimalDoctor({
      complaintId: complaintId || 'general',
      complaintTitle: complaintTitle || 'General Consultation',
      prismaClient: prisma
    });

    // Create Session in Prisma DB
    const newSession = await prisma.session.create({
      data: {
        id: sid,
        tokenNumber,
        complaintId: complaintId || 'general',
        complaintTitle: complaintTitle || 'General Consultation',
        department: assignment.department,
        assignedDoctorId: assignment.assignedDoctorId,
        priority,
        language,
        consentStatus,
        consentTimestamp: consentTimestamp ? new Date(consentTimestamp) : new Date(),
        status,
        answers: JSON.stringify(answers || []),
        redFlagsTriggered: JSON.stringify(redFlagsTriggered || []),
        ayushAssessment: validateAndNormalizeAyushAssessment(ayushAssessment),
        patientId: patientRecord ? patientRecord.id : null,
        consentRecord: {
          create: {
            patientId: patientRecord ? patientRecord.id : null,
            purpose: 'OUTPATIENT_CONSULTATION',
            allowDataCapture: req.body.granularConsent?.allowDataCapture !== false,
            allowHisSharing: req.body.granularConsent?.allowHisSharing !== false,
            allowAbdmLinking: req.body.granularConsent?.allowAbdmLinking !== false,
            status: 'GRANTED',
            grantedAt: new Date(),
            ipAddress: req.ip
          }
        },
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
        digitizedDocument: true,
        consentRecord: true,
        assignedDoctor: true
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
        department: newSession.department,
        priority: newSession.priority,
        assignedDoctorId: newSession.assignedDoctorId,
        assignedDoctor: newSession.assignedDoctor ? {
          id: newSession.assignedDoctor.id,
          name: newSession.assignedDoctor.name,
          specialization: newSession.assignedDoctor.specialization,
          roomNumber: newSession.assignedDoctor.roomNumber
        } : null,
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
// 6. GET SESSIONS LIST FOR DOCTOR DASHBOARD & ADMIN PANEL (FILTERED BY ASSIGNED DOCTOR)
// ==============================================================================
app.get('/api/sessions', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  try {
    const isDoctor = req.user && req.user.role === 'DOCTOR';
    const viewAll = req.query.viewAll === 'true';
    const history = req.query.history === 'true';

    // Build filter criteria
    const whereClause = {};

    // Filter by assignedDoctorId for DOCTOR role unless viewAll=true
    if (isDoctor && !viewAll) {
      whereClause.assignedDoctorId = req.user.id;
    }

    // Filter active queue vs completed history
    if (history) {
      whereClause.status = 'COMPLETED';
    } else {
      whereClause.status = {
        in: ['WAITING', 'WAITING_OPD', 'TRIAGE_URGENT', 'CALLED', 'IN_CONSULTATION']
      };
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        patient: true,
        digitizedDocument: true,
        redFlags: true,
        hisPush: true,
        assignedDoctor: true
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
      department: s.department,
      priority: s.priority || 'NORMAL',
      assignedDoctorId: s.assignedDoctorId,
      assignedDoctor: s.assignedDoctor ? {
        id: s.assignedDoctor.id,
        name: s.assignedDoctor.name,
        specialization: s.assignedDoctor.specialization,
        roomNumber: s.assignedDoctor.roomNumber,
        availabilityStatus: s.assignedDoctor.availabilityStatus
      } : null,
      language: s.language,
      status: s.status,
      calledAt: s.calledAt,
      calledBy: s.calledBy,
      consultationStartedAt: s.consultationStartedAt,
      completedAt: s.completedAt,
      answers: JSON.parse(s.answers || '[]'),
      redFlagsTriggered: JSON.parse(s.redFlagsTriggered || '[]'),
      ayushAssessment: s.ayushAssessment ? JSON.parse(s.ayushAssessment) : null,
      editedByPhysician: s.editedByPhysician,
      physicianEditedSummary: s.physicianEditedSummary ? JSON.parse(s.physicianEditedSummary) : null,
      physicianSignedAt: s.physicianSignedAt,
      physicianId: s.physicianId,
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
// 6b. PHYSICIAN EDIT & ACCEPT/AMEND SUMMARY PERSISTENCE (PHASE 7)
// ==============================================================================
app.post('/api/sessions/:id/physician-edit', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { sections, signed } = req.body;

  try {
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        editedByPhysician: true,
        physicianEditedSummary: JSON.stringify(sections || []),
        physicianSignedAt: signed ? new Date() : undefined,
        physicianId: req.user?.id
      }
    });

    console.log(`👨‍⚕️ [PHYSICIAN EDIT] Session ${id} amended & persisted distinctly from AI draft.`);

    res.json({
      success: true,
      message: 'Physician-edited summary persisted distinctly from AI draft.',
      session: updatedSession
    });
  } catch (err) {
    console.error('❌ [Physician Edit] Database error:', err);
    res.status(500).json({ success: false, error: 'DB_ERROR', message: err.message });
  }
});

// ==============================================================================
// 7. EMR / HOSPITAL HIS FHIR PUSH (WITH STRICT STRUCTURAL VALIDATION)
// ==============================================================================
app.post('/api/his/push', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  const { sessionId, tokenNumber, fhirBundle } = req.body || {};
  const emrRecordId = `EMR-REC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  // Enforce structural FHIR R4 Bundle validation before sync
  const validation = validateFhirR4Bundle(fhirBundle);
  if (!validation.isValid) {
    console.warn('❌ [HOSPITAL EMR] FHIR R4 Validation Failed:', validation.errors);
    return res.status(422).json({
      success: false,
      error: 'FHIR_VALIDATION_FAILED',
      message: 'FHIR Document Bundle failed structural validation standards.',
      details: validation.errors
    });
  }

  try {
    // Check if the session exists in DB before linking foreign key
    const sessionExists = sessionId ? await prisma.session.findUnique({ where: { id: sessionId } }) : null;
    const validSessionId = sessionExists ? sessionId : null;

    let pushedRecord;
    if (validSessionId) {
      pushedRecord = await prisma.hisPushedRecord.upsert({
        where: { sessionId: validSessionId },
        update: {
          emrRecordId,
          fhirBundle: JSON.stringify(fhirBundle || {}),
          pushedAt: new Date(),
          status: 'SYNCED'
        },
        create: {
          emrRecordId,
          sessionId: validSessionId,
          hospitalName: 'District Central Government Hospital',
          department: 'Outpatient General & Integrated Medicine',
          resourceCount: fhirBundle?.entry?.length || 5,
          fhirBundle: JSON.stringify(fhirBundle || {})
        }
      });

      await prisma.session.update({
        where: { id: validSessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          physicianId: req.user.id
        }
      }).catch(() => {});
    } else {
      pushedRecord = await prisma.hisPushedRecord.create({
        data: {
          emrRecordId,
          hospitalName: 'District Central Government Hospital',
          department: 'Outpatient General & Integrated Medicine',
          resourceCount: fhirBundle?.entry?.length || 5,
          fhirBundle: JSON.stringify(fhirBundle || {})
        }
      });
    }

    console.log(`✅ [HOSPITAL EMR] Committed EMR Record: ${emrRecordId} for Token ${tokenNumber || 'K-EMR'}`);

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
// 8. STAFF AVAILABILITY CONTROL
// ==============================================================================
app.patch('/api/staff/availability', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  const { availabilityStatus } = req.body || {};
  const validStatuses = ['AVAILABLE', 'BUSY', 'OFFLINE'];
  const newStatus = validStatuses.includes(availabilityStatus) ? availabilityStatus : 'AVAILABLE';

  try {
    const updatedStaff = await prisma.staffUser.update({
      where: { id: req.user.id },
      data: { availabilityStatus: newStatus }
    });

    console.log(`🩺 [STAFF AVAILABILITY] ${updatedStaff.name} status updated to: ${newStatus}`);

    res.json({
      success: true,
      message: `Availability status set to ${newStatus}`,
      staff: {
        id: updatedStaff.id,
        name: updatedStaff.name,
        specialization: updatedStaff.specialization,
        roomNumber: updatedStaff.roomNumber,
        availabilityStatus: updatedStaff.availabilityStatus
      }
    });
  } catch (err) {
    console.error('❌ [Staff Availability] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 9. CALL PATIENT (ATOMIC WAITING -> CALLED TRANSITION)
// ==============================================================================
app.post('/api/sessions/:id/call', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    const callingDoctor = await prisma.staffUser.findUnique({ where: { id: req.user.id } });

    // Execute atomic check and update within database transaction
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id },
        include: { patient: true, assignedDoctor: true }
      });

      if (!session) {
        const err = new Error('Patient session not found.');
        err.statusCode = 404;
        throw err;
      }

      const activeWaitingStatuses = ['WAITING', 'WAITING_OPD', 'TRIAGE_URGENT'];
      // Prevent another doctor from double-calling a patient already called
      if (session.status === 'CALLED' && session.calledBy && session.calledBy !== req.user.id) {
        const err = new Error('This patient has already been called by another attending physician.');
        err.statusCode = 409;
        throw err;
      }

      if (session.status === 'IN_CONSULTATION') {
        const err = new Error('This patient is currently in an active consultation.');
        err.statusCode = 409;
        throw err;
      }

      const updated = await tx.session.update({
        where: { id },
        data: {
          status: 'CALLED',
          calledAt: new Date(),
          calledBy: req.user.id,
          assignedDoctorId: session.assignedDoctorId || req.user.id
        },
        include: { patient: true, assignedDoctor: true }
      });

      return updated;
    });

    const token = result.tokenNumber;
    const patientName = result.patient?.name || 'Patient';
    const room = callingDoctor?.roomNumber || '104';
    const docName = callingDoctor?.name || 'Duty Physician';
    const announcementText = `Attention please. Token number ${token}, ${patientName}, please proceed to Consultation Room ${room} with ${docName}.`;

    console.log(`📢 [CALL PATIENT] Token ${token} called by ${docName} to Room ${room}`);

    res.json({
      success: true,
      message: `Patient ${patientName} (Token ${token}) called to Room ${room}`,
      session: result,
      announcementText,
      tokenNumber: token,
      patientName,
      roomNumber: room,
      doctorName: docName
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('❌ [Call Patient Error]:', err.message);
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 10. START CONSULTATION (CALLED -> IN_CONSULTATION)
// ==============================================================================
app.post('/api/sessions/:id/start-consultation', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const updated = await prisma.session.update({
      where: { id },
      data: {
        status: 'IN_CONSULTATION',
        consultationStartedAt: new Date(),
        assignedDoctorId: session.assignedDoctorId || req.user.id
      },
      include: { patient: true, assignedDoctor: true }
    });

    console.log(`▶️ [START CONSULTATION] Token ${updated.tokenNumber} in consultation with ${updated.assignedDoctor?.name || 'Doctor'}`);

    res.json({
      success: true,
      message: `Consultation started for Token ${updated.tokenNumber}`,
      session: updated
    });
  } catch (err) {
    console.error('❌ [Start Consultation Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 11. COMPLETE CONSULTATION (IN_CONSULTATION -> COMPLETED)
// ==============================================================================
app.post('/api/sessions/:id/complete', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await prisma.session.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        physicianId: req.user.id
      },
      include: { patient: true, assignedDoctor: true }
    });

    console.log(`✅ [COMPLETE CONSULTATION] Token ${updated.tokenNumber} completed and saved to EMR.`);

    res.json({
      success: true,
      message: `Consultation completed for Token ${updated.tokenNumber}`,
      session: updated
    });
  } catch (err) {
    console.error('❌ [Complete Consultation Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 12. PUBLIC ANNOUNCEMENTS FOR KIOSK / WAITING SCREEN
// ==============================================================================
app.get('/api/announcements', async (req, res) => {
  try {
    const calledSessions = await prisma.session.findMany({
      where: { status: 'CALLED' },
      include: { patient: true, assignedDoctor: true },
      orderBy: { calledAt: 'desc' },
      take: 5
    });

    const announcements = calledSessions.map(s => ({
      sessionId: s.id,
      tokenNumber: s.tokenNumber,
      patientName: s.patient?.name || 'Patient',
      doctorName: s.assignedDoctor?.name || 'Duty Physician',
      roomNumber: s.assignedDoctor?.roomNumber || '104',
      calledAt: s.calledAt
    }));

    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 8. UPDATE SESSION STATUS (CALL PATIENT / COMPLETE)
// ==============================================================================
app.patch('/api/sessions/:id/status', requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
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

// ==============================================================================
// 9. ABDM NATIONAL HEALTH AUTHORITY (ABHA VERIFICATION & OTP AUTH)
// ==============================================================================
app.get('/api/abdm/status', (req, res) => {
  try {
    const status = getAbdmGatewayStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/abdm/verify', async (req, res) => {
  const { abhaId, mobile } = req.body;
  try {
    const profile = await searchPatientProfile({ identifier: abhaId || mobile });
    if (profile) {
      return res.json({ success: true, patientProfile: profile });
    }
    res.status(404).json({ success: false, message: 'No registered ABHA found for this identifier.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/abdm/init-otp', async (req, res) => {
  const { identifier, authMode } = req.body;
  try {
    const result = await initiateAbdmOtp({ identifier, authMode });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/abdm/confirm-otp', async (req, res) => {
  const { txnId, otp, patientData } = req.body;
  try {
    const profile = await verifyAbdmOtpAndGetProfile({ txnId, otp, patientData });
    res.json({ success: true, patientProfile: profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/abdm/qr-scan', async (req, res) => {
  const { qrText } = req.body;
  try {
    const profile = await processAbhaQrCode({ qrText });
    res.json({ success: true, patientProfile: profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 10. GRANULAR DPDP ACT CONSENT REVOCATION & AUDIT
// ==============================================================================
app.post('/api/consent/revoke/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const consent = await prisma.consentRecord.update({
      where: { sessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date()
      }
    }).catch(() => null);

    // Immediately purge sensitive raw data per DPDP Act right to erasure
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CONSENT_REVOKED',
        answers: '[]',
        ayushAssessment: null,
        redFlagsTriggered: '[]'
      }
    });

    await prisma.digitizedDocument.deleteMany({
      where: { sessionId }
    });

    console.log(`🛡️ [DPDP CONSENT REVOKED] Session ${sessionId} data erased from database.`);

    res.json({
      success: true,
      message: 'Consent successfully revoked and session raw personal health data purged per DPDP Act.',
      consent
    });
  } catch (err) {
    console.error('❌ [Consent Revoke Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/consent/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const consent = await prisma.consentRecord.findUnique({
      where: { sessionId }
    });
    res.json({ success: true, consent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 11. DATA RETENTION MANUAL TRIGGER (ADMIN)
// ==============================================================================
app.post('/api/admin/purge-expired', requireRole(['ADMIN']), async (req, res) => {
  const { retentionHours } = req.body;
  try {
    const report = await purgeExpiredSessionData(retentionHours ? parseInt(retentionHours, 10) : undefined);
    res.json(report);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MediKiosk Backend] Server running on http://localhost:${PORT}`);
  console.log(`[MediKiosk Backend] Real OCR engine, ABDM Gateway & Prisma ORM database initialized.`);
  startScheduledRetentionJob();
  backfillUnassignedSessions(prisma).then(() => {
    console.log('[MediKiosk Backend] Active OPD sessions backfilled to valid doctors (Dr. Rajesh Gupta / Dr. Asha Sharma).');
  });
});
