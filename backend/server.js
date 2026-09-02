const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend on port 5173
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Load dialogue flows from mockData/dialogueFlows.json
const dialogueFlowsPath = path.join(__dirname, 'mockData', 'dialogueFlows.json');
let dialogueFlows = { complaints: [] };

try {
  const data = fs.readFileSync(dialogueFlowsPath, 'utf8');
  dialogueFlows = JSON.parse(data);
  console.log(`[MediKiosk Backend] Loaded ${dialogueFlows.complaints.length} chief complaint dialogue flows.`);
} catch (err) {
  console.error('[MediKiosk Backend] Error loading dialogueFlows.json:', err.message);
}

// Simulated In-Memory Storage (Zero disk persistence requirement)
const inMemorySessions = [];
const redFlagAlerts = [];
let tokenCounter = 100;

// Health check endpoint
app.get('/api/health', (req, res) => {
  const ayushCount = inMemorySessions.filter(s => s.ayushAssessment || s.complaintId === 'ayush_consultation').length;
  const digitizedDocsCount = inMemorySessions.filter(s => s.digitizedDocument).length;

  res.json({
    status: 'ok',
    service: 'MediKiosk API Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSessionCount: inMemorySessions.length,
    redFlagAlertCount: redFlagAlerts.length,
    ayushSessionCount: ayushCount,
    digitizedDocCount: digitizedDocsCount
  });
});

// Endpoint: GET /api/dialogue-flows
app.get('/api/dialogue-flows', (req, res) => {
  res.json(dialogueFlows);
});

// Endpoint: POST /api/docai/extract
// Simulates realistic DocAI OCR extraction with a 2-second processing delay
app.post('/api/docai/extract', async (req, res) => {
  const { fileName, documentType, imagePreview } = req.body || {};
  console.log(`\n📄 [DOCAI OCR] Processing document: ${fileName || 'Uploaded image'} (Type: ${documentType || 'auto-detect'})...`);

  // Simulate 2000ms AI extraction latency
  setTimeout(() => {
    // Generate realistic simulated extraction based on document intent or type
    const isLabReport = documentType === 'lab_report' || (fileName && /lab|blood|cbc|test|report/i.test(fileName));

    let extractedData;

    if (isLabReport) {
      extractedData = {
        documentType: 'lab_report',
        documentTitle: 'Comprehensive Clinical Pathology Report',
        facility: 'City Central Diagnostic Center',
        date: '2026-06-15',
        patientName: 'Patient Check-In',
        medications: [],
        labValues: [
          { test: 'Fasting Blood Sugar', value: 142, unit: 'mg/dL', referenceRange: '70 - 100', flag: 'HIGH' },
          { test: 'HbA1c (Glycated Hemoglobin)', value: 7.4, unit: '%', referenceRange: '4.0 - 5.6', flag: 'HIGH' },
          { test: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.2', flag: 'NORMAL' },
          { test: 'Total Cholesterol', value: 215, unit: 'mg/dL', referenceRange: '125 - 200', flag: 'HIGH' },
          { test: 'Hemoglobin (Hb)', value: 10.8, unit: 'g/dL', referenceRange: '12.0 - 16.0', flag: 'LOW' }
        ],
        diagnoses: ['Impaired Fasting Glucose', 'Mild Anemia'],
        confidenceScore: 0.94,
        rawNotes: 'Fasting blood sugar and HbA1c elevated. Recommend physician consultation for glycemic management.'
      };
    } else {
      // Default: Prescription
      extractedData = {
        documentType: 'prescription',
        documentTitle: 'Physician Outpatient Prescription',
        facility: 'District Government Hospital OPD',
        date: '2026-06-15',
        prescriber: 'Dr. S. K. Mehta (MD, Gen Med)',
        medications: [
          { name: 'Metformin', dose: '500mg', frequency: 'twice daily (after meals)', duration: '30 days', instructions: 'Oral' },
          { name: 'Amlodipine', dose: '5mg', frequency: 'once daily (morning)', duration: '30 days', instructions: 'Oral' },
          { name: 'Paracetamol', dose: '650mg', frequency: 'as needed for fever/pain', duration: '5 days', instructions: 'Oral SOS' }
        ],
        labValues: [
          { test: 'Fasting Blood Sugar', value: 142, unit: 'mg/dL', referenceRange: '70 - 100', flag: 'HIGH' },
          { test: 'Blood Pressure (Systolic/Diastolic)', value: '140/90', unit: 'mmHg', referenceRange: '120/80', flag: 'HIGH' }
        ],
        diagnoses: ['Type 2 Diabetes Mellitus', 'Stage 1 Essential Hypertension'],
        confidenceScore: 0.96,
        rawNotes: 'Review in 1 month with updated Fasting/PP blood sugar profile.'
      };
    }

    console.log(`✅ [DOCAI OCR] Successfully extracted ${extractedData.medications.length} meds, ${extractedData.labValues.length} lab tests.`);

    res.status(200).json({
      success: true,
      processingTimeMs: 2000,
      extractedData
    });
  }, 2000);
});

// Endpoint: POST /api/redflag
app.post('/api/redflag', (req, res) => {
  const { sessionId, complaintId, triggerReason, answerData, timestamp } = req.body;
  const redFlagEntry = {
    id: `rf_${Date.now()}`,
    sessionId: sessionId || `sess_${Date.now()}`,
    complaintId: complaintId || 'unknown',
    triggerReason: triggerReason || 'Red Flag Condition Met',
    answerData: answerData || {},
    loggedAt: timestamp || new Date().toISOString(),
    status: 'ACTIVE_ALERT'
  };

  redFlagAlerts.unshift(redFlagEntry);
  console.log(`\n🚨 [RED FLAG ALERT] Triage Alert logged for Session ${redFlagEntry.sessionId}:`);
  console.log(`   Reason: ${redFlagEntry.triggerReason}`);

  res.status(201).json({
    success: true,
    message: 'Red-flag triage alert logged successfully',
    alert: redFlagEntry
  });
});

// Endpoint: POST /api/session/submit
app.post('/api/session/submit', (req, res) => {
  tokenCounter += 1;
  const tokenNumber = `K-${tokenCounter}`;
  
  const { 
    sessionId, 
    complaintId, 
    complaintTitle, 
    answers, 
    redFlagsTriggered, 
    language, 
    patientDetails,
    digitizedDocument,
    ayushAssessment
  } = req.body;

  const newSession = {
    id: sessionId || `sess_${Date.now()}`,
    tokenNumber,
    submittedAt: new Date().toISOString(),
    complaintId,
    complaintTitle,
    answers: answers || [],
    redFlagsTriggered: redFlagsTriggered || [],
    language: language || 'English',
    patientDetails: patientDetails || {
      name: 'Anonymous Patient',
      age: 45,
      gender: 'Unspecified'
    },
    // New Feature Fields: Document Digitization & AYUSH
    digitizedDocument: digitizedDocument || null,
    ayushAssessment: ayushAssessment || null,
    status: redFlagsTriggered && redFlagsTriggered.length > 0 ? 'TRIAGE_URGENT' : 'WAITING_OPD'
  };

  // In-memory store only
  inMemorySessions.unshift(newSession);

  console.log(`\n✅ [SESSION SUBMITTED] Token: ${tokenNumber} | Complaint: ${complaintTitle} | AYUSH: ${!!ayushAssessment} | Digitized Doc: ${!!digitizedDocument} | Red Flags: ${newSession.redFlagsTriggered.length}`);

  res.status(201).json({
    success: true,
    tokenNumber,
    message: 'Session completed successfully',
    session: newSession
  });
});

// Endpoint: GET /api/sessions (For Doctor & Admin views)
app.get('/api/sessions', (req, res) => {
  res.json({
    totalSessions: inMemorySessions.length,
    sessions: inMemorySessions,
    redFlags: redFlagAlerts
  });
});

app.listen(PORT, () => {
  console.log(`[MediKiosk Backend] Server running on http://localhost:${PORT}`);
});
