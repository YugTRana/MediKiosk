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

// Simulated In-Memory Storage & Initial Data Loader
const sessionsPath = path.join(__dirname, 'mockData', 'patientSessions.json');
let inMemorySessions = [];
try {
  if (fs.existsSync(sessionsPath)) {
    const rawSessions = fs.readFileSync(sessionsPath, 'utf8');
    const parsed = JSON.parse(rawSessions);
    if (Array.isArray(parsed)) {
      inMemorySessions = parsed.map(s => ({
        id: s.sessionId || s.id || `sess_${Date.now()}`,
        tokenNumber: s.tokenNumber || 'K-100',
        submittedAt: s.checkInTime || new Date().toISOString(),
        complaintId: s.chiefComplaint ? s.chiefComplaint.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'fever',
        complaintTitle: s.chiefComplaint || 'General OPD Intake',
        patientDetails: {
          name: s.patientName || 'Patient',
          age: s.age || 45,
          gender: s.gender || 'Male',
          abhaNumber: s.abhaId || '91-8472-1029-4821'
        },
        abhaDetails: {
          name: s.patientName || 'Patient',
          age: s.age || 45,
          gender: s.gender || 'Male',
          abhaNumber: s.abhaId || '91-8472-1029-4821',
          verified: true
        },
        consentStatus: 'GRANTED',
        digitizedDocument: s.digitizedDocument || null,
        ayushAssessment: s.ayushAssessment || null,
        answers: s.answers || [],
        redFlagsTriggered: s.redFlagsTriggered || [],
        status: s.status === 'Checked-in' ? 'WAITING_OPD' : (s.status || 'WAITING_OPD')
      }));
      console.log(`[MediKiosk Backend] Loaded ${inMemorySessions.length} initial patient records from database.`);
    }
  }
} catch (err) {
  console.error('[MediKiosk Backend] Error loading patientSessions.json:', err.message);
}

const redFlagAlerts = [];
const hisPushedRecords = [];
let tokenCounter = 100 + inMemorySessions.length;

// Health check endpoint
app.get('/api/health', (req, res) => {
  const ayushCount = inMemorySessions.filter(s => s.ayushAssessment || s.complaintId === 'ayush_consultation').length;
  const digitizedDocsCount = inMemorySessions.filter(s => s.digitizedDocument).length;
  const abdmVerifiedCount = inMemorySessions.filter(s => s.abhaDetails && s.abhaDetails.verified).length;

  res.json({
    status: 'ok',
    service: 'MediKiosk API Server',
    sandboxMode: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSessionCount: inMemorySessions.length,
    redFlagAlertCount: redFlagAlerts.length,
    ayushSessionCount: ayushCount,
    digitizedDocCount: digitizedDocsCount,
    abdmVerifiedCount: abdmVerifiedCount,
    hisPushedCount: hisPushedRecords.length
  });
});

// Endpoint: GET /api/dialogue-flows
app.get('/api/dialogue-flows', (req, res) => {
  res.json(dialogueFlows);
});

// ==============================================================================
// 1. MOCK ABDM FLOW: POST /api/abdm/verify
// ==============================================================================
app.post('/api/abdm/verify', (req, res) => {
  const { abhaId, mobile } = req.body || {};
  const inputStr = String(abhaId || mobile || '').trim();
  console.log(`\n🇮🇳 [ABDM GATEWAY (SANDBOX)] Verifying ABHA / Mobile: "${inputStr}"...`);

  setTimeout(() => {
    if (!inputStr) {
      console.log(`❌ [ABDM GATEWAY (SANDBOX)] Verification FAILED: Empty input provided.`);
      return res.status(400).json({
        success: false,
        error: 'EMPTY_INPUT',
        message: 'Please enter a valid 14-digit ABHA ID or 10-digit mobile number.'
      });
    }

    const rawNumber = inputStr.replace(/[^0-9]/g, '');
    const isSunita = rawNumber.includes('3829') || rawNumber.includes('1928') || rawNumber === '9845211928' || inputStr.toLowerCase().includes('sunita');
    const isAmit = rawNumber.includes('5555') || rawNumber.includes('1234') || rawNumber === '9711233455' || inputStr.toLowerCase().includes('amit');
    const isRamesh = rawNumber.includes('8472') || rawNumber.includes('4821') || rawNumber === '9876543210' || inputStr.toLowerCase().includes('ramesh') || rawNumber === '91847210294821';

    let patientProfile;
    if (isSunita) {
      patientProfile = {
        verified: true,
        abhaNumber: '91-3829-1928-4019',
        abhaAddress: 'sunita.devi@abdm',
        name: 'Sunita Devi',
        gender: 'Female',
        dob: '1964-08-22',
        age: 62,
        mobile: '+91 98452 11928',
        address: 'Plot 14, Gandhi Nagar, Bhopal, MP',
        kycStatus: 'VERIFIED_AADHAAR_OTP',
        healthLockerLinked: true,
        verificationTimestamp: new Date().toISOString()
      };
    } else if (isAmit) {
      patientProfile = {
        verified: true,
        abhaNumber: '91-5555-1234-8890',
        abhaAddress: 'amit.verma@abdm',
        name: 'Amit Kumar Verma',
        gender: 'Male',
        dob: '1992-11-04',
        age: 34,
        mobile: '+91 97112 33455',
        address: 'Sector 62, Noida, UP',
        kycStatus: 'VERIFIED_AADHAAR_DEMOGRAPHIC',
        healthLockerLinked: true,
        verificationTimestamp: new Date().toISOString()
      };
    } else if (isRamesh) {
      patientProfile = {
        verified: true,
        abhaNumber: '91-8472-1029-4821',
        abhaAddress: 'ramesh.sharma@abdm',
        name: 'Ramesh Chandra Sharma',
        gender: 'Male',
        dob: '1958-04-12',
        age: 68,
        mobile: '+91 98765 43210',
        address: 'House 42, Sector 9, Jaipur, Rajasthan',
        kycStatus: 'VERIFIED_AADHAAR_BIO',
        healthLockerLinked: true,
        verificationTimestamp: new Date().toISOString()
      };
    } else {
      // Reject any random unregistered number / invalid ID
      console.log(`❌ [ABDM GATEWAY (SANDBOX)] Verification REJECTED: No ABHA record found for "${inputStr}".`);
      return res.status(404).json({
        success: false,
        error: 'ABHA_NOT_FOUND',
        message: 'No registered ABHA record found with this ID or Mobile Number. Please check your credentials or choose one of the demo profiles.'
      });
    }

    console.log(`✅ [ABDM GATEWAY (SANDBOX)] Verified Profile for ${patientProfile.name} (${patientProfile.abhaNumber})`);

    res.status(200).json({
      success: true,
      sandbox: true,
      message: 'ABHA demographic records verified via ABDM sandbox gateway',
      patientProfile
    });
  }, 1200);
});

// ==============================================================================
// 2. MOCK HIS/EMR PUSH: POST /api/his/push
// ==============================================================================
app.post('/api/his/push', (req, res) => {
  const { sessionId, tokenNumber, fhirBundle } = req.body || {};
  console.log(`\n🏥 [HOSPITAL EMR (SANDBOX)] Receiving FHIR Bundle for Token ${tokenNumber || sessionId}...`);

  setTimeout(() => {
    const emrRecordId = `EMR-REC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const syncTimestamp = new Date().toISOString();

    const pushedEntry = {
      emrRecordId,
      sessionId: sessionId || `sess_${Date.now()}`,
      tokenNumber: tokenNumber || 'K-100',
      syncedAt: syncTimestamp,
      resourceCount: fhirBundle?.entry?.length || 5,
      status: 'COMMITTED_TO_EHR',
      hospitalName: 'District Central Government Hospital',
      department: 'Outpatient General & Integrated Medicine'
    };

    hisPushedRecords.unshift(pushedEntry);
    console.log(`✅ [HOSPITAL EMR (SANDBOX)] Committed EMR Record: ${emrRecordId} for Token ${tokenNumber}`);

    res.status(200).json({
      success: true,
      sandbox: true,
      message: 'Clinical note and FHIR resources successfully synced to Hospital EMR database',
      emrRecordId,
      syncedAt: syncTimestamp,
      receipt: pushedEntry
    });
  }, 1200);
});

// ==============================================================================
// 3. CLINICALLY-TAILORED DOCAI OCR: POST /api/docai/extract
// Extracts context-appropriate lab & radiology values based on chief complaint
// ==============================================================================
app.post('/api/docai/extract', async (req, res) => {
  const { fileName, documentType, complaintId } = req.body || {};
  console.log(`\n📄 [DOCAI OCR] Processing document: ${fileName || 'Uploaded scan'} (Complaint: ${complaintId || 'auto'}, Type: ${documentType || 'auto'})...`);

  setTimeout(() => {
    const fnLower = (fileName || '').toLowerCase();
    const docTypeLower = (documentType || '').toLowerCase();

    // 1. Direct match by documentType or fileName keywords FIRST
    const isExplicitDiabetesBP = 
      docTypeLower === 'prescription' || 
      docTypeLower === 'diabetes_metabolic_rx' || 
      docTypeLower === 'hypertension_prescription' ||
      /diabetes|hypertension|sugar|glucose|hba1c|blood_pressure|bp|pressure|metformin|amlodipine|telmisartan|metabolic|endocrine|prescription|rx/i.test(fnLower);

    const isExplicitJoint = 
      docTypeLower === 'orthopedic_rheumatology_report' || 
      /joint|knee|ortho|rheumat|uric|xray|arthritis|swelling|esr|crp|gout/i.test(fnLower);

    const isExplicitCough = 
      docTypeLower === 'pulmonology_report' || 
      /cough|breath|chest|pulmo|asthma|eosinophil|spo2|inhaler/i.test(fnLower);

    const isExplicitAbdo = 
      docTypeLower === 'gastroenterology_report' || 
      /abdo|stomach|ultrasound|usg|liver|lft|gastric|gallbladder|bilirubin/i.test(fnLower);

    const isExplicitFever = 
      docTypeLower === 'lab_report' || 
      docTypeLower === 'cbc_infection_panel' || 
      /dengue|malaria|cbc|platelet|widal|infection|typhoid|hematology/i.test(fnLower);

    // If explicit type/name matches, prioritize it. Otherwise fallback to complaintId.
    const isDiabetesBP = isExplicitDiabetesBP;
    const isJointPain = !isDiabetesBP && (isExplicitJoint || (!isExplicitFever && !isExplicitCough && !isExplicitAbdo && (complaintId === 'joint_pain' || complaintId === 'ayush_consultation')));
    const isFever = !isDiabetesBP && !isJointPain && (isExplicitFever || (!isExplicitCough && !isExplicitAbdo && complaintId === 'fever'));
    const isCough = !isDiabetesBP && !isJointPain && !isFever && (isExplicitCough || (!isExplicitAbdo && complaintId === 'cough_breathlessness'));
    const isAbdominal = !isDiabetesBP && !isJointPain && !isFever && !isCough && (isExplicitAbdo || complaintId === 'abdominal_pain');

    let extractedData;

    // A. DIABETES & BLOOD PRESSURE / HYPERTENSION (METABOLIC)
    if (isDiabetesBP) {
      extractedData = {
        documentType: 'prescription',
        documentTitle: 'Endocrine & Metabolic Outpatient Record (Diabetes & BP)',
        facility: 'District Government Hospital OPD',
        date: '2026-06-15',
        prescriber: 'Dr. S. K. Mehta (MD, Gen Med)',
        medications: [
          { name: 'Metformin', dose: '500mg', frequency: 'twice daily (after meals)', duration: '30 days', instructions: 'Oral anti-diabetic' },
          { name: 'Amlodipine', dose: '5mg', frequency: 'once daily (morning)', duration: '30 days', instructions: 'Oral anti-hypertensive' },
          { name: 'Telmisartan', dose: '40mg', frequency: 'once daily (morning)', duration: '30 days', instructions: 'Blood pressure control' }
        ],
        labValues: [
          { test: 'Fasting Blood Sugar (FBS)', value: 142, unit: 'mg/dL', referenceRange: '70 - 100', flag: 'HIGH' },
          { test: 'Post-Prandial Blood Sugar (PPBS)', value: 198, unit: 'mg/dL', referenceRange: '< 140', flag: 'HIGH' },
          { test: 'HbA1c (Glycated Hemoglobin)', value: 7.4, unit: '%', referenceRange: '4.0 - 5.6', flag: 'HIGH' },
          { test: 'Blood Pressure (Systolic/Diastolic)', value: '140/90', unit: 'mmHg', referenceRange: '120/80', flag: 'HIGH' },
          { test: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.2', flag: 'NORMAL' }
        ],
        diagnoses: ['Type 2 Diabetes Mellitus (Uncontrolled)', 'Stage 1 Essential Hypertension'],
        confidenceScore: 0.98,
        rawNotes: 'Routine metabolic follow-up. Elevated FBS (142) and HbA1c (7.4%) with stage-1 hypertension (140/90 mmHg).'
      };
    }
    // B. JOINT PAIN & SWELLING: Orthopedic & Rheumatology Panel (Uric acid, CRP, ESR, RA Factor, Knee X-Ray)
    else if (isJointPain) {
      extractedData = {
        documentType: 'orthopedic_rheumatology_report',
        documentTitle: 'Orthopedic Joint Radiology & Rheumatology Panel',
        facility: 'City Orthopedic & Joint Imaging Center',
        date: '2026-06-15',
        affectedAnatomicalPart: 'Bilateral Knee Joints & 1st Metatarsophalangeal Joint',
        imagingFindings: 'X-Ray Bilateral Knees (AP/Lateral): Medial joint space narrowing (Grade 3 Osteoarthritis), marginal osteophytes & suprapatellar joint effusion.',
        medications: [
          { name: 'Etoricoxib', dose: '90mg', frequency: 'once daily (after meals for 10 days)', duration: '10 days', instructions: 'Oral for joint swelling & pain' },
          { name: 'Febuxostat', dose: '40mg', frequency: 'once daily (morning)', duration: '30 days', instructions: 'Oral for elevated Uric Acid' },
          { name: 'Calcium Carbonate + Vitamin D3', dose: '500mg/1000IU', frequency: 'once daily (night)', duration: '30 days', instructions: 'Oral supplement' },
          { name: 'Tramadol + Paracetamol', dose: '37.5/325mg', frequency: 'as needed for severe knee pain flare', duration: 'SOS', instructions: 'Oral SOS' }
        ],
        labValues: [
          { test: 'Serum Uric Acid', value: 8.6, unit: 'mg/dL', referenceRange: '3.5 - 7.2', flag: 'HIGH' },
          { test: 'C-Reactive Protein (CRP)', value: 24.5, unit: 'mg/L', referenceRange: '< 5.0', flag: 'HIGH' },
          { test: 'Erythrocyte Sedimentation Rate (ESR)', value: 48, unit: 'mm/hr', referenceRange: '0 - 20', flag: 'HIGH' },
          { test: 'Rheumatoid Factor (RA Factor)', value: 45, unit: 'IU/mL', referenceRange: '< 14', flag: 'HIGH' },
          { test: 'Serum Calcium', value: 9.2, unit: 'mg/dL', referenceRange: '8.5 - 10.5', flag: 'NORMAL' },
          { test: 'Vitamin D3 (25-OH)', value: 16.4, unit: 'ng/mL', referenceRange: '30.0 - 100.0', flag: 'LOW' }
        ],
        diagnoses: [
          'Bilateral Knee Osteoarthritis with Active Synovial Joint Effusion',
          'Hyperuricemic Arthropathy (Gouty Flare)',
          'Vitamin D Deficiency'
        ],
        confidenceScore: 0.97,
        rawNotes: 'High Serum Uric Acid (8.6) and elevated inflammatory markers (CRP 24.5, ESR 48) confirming active joint inflammation with bilateral knee effusion.'
      };
    } 
    // C. FEVER / INFECTION: Complete Blood Count & Serology
    else if (isFever) {
      extractedData = {
        documentType: 'lab_report',
        documentTitle: 'Hematology & Acute Infection Diagnostic Panel',
        facility: 'District Hospital Pathology Lab',
        date: '2026-06-15',
        medications: [
          { name: 'Paracetamol', dose: '650mg', frequency: 'thrice daily for fever spikes', duration: '5 days' },
          { name: 'Doxycycline', dose: '100mg', frequency: 'twice daily (after food)', duration: '7 days' },
          { name: 'Oral Rehydration Salts (ORS)', dose: '1 sachet', frequency: 'dissolved in 1L water daily', duration: '3 days' }
        ],
        labValues: [
          { test: 'Platelet Count', value: 85000, unit: '/uL', referenceRange: '150,000 - 450,000', flag: 'LOW' },
          { test: 'Total Leukocyte Count (TLC)', value: 14200, unit: '/uL', referenceRange: '4,000 - 11,000', flag: 'HIGH' },
          { test: 'Dengue NS1 Antigen', value: 'Positive', unit: 'Index', referenceRange: 'Negative', flag: 'HIGH' },
          { test: 'Hemoglobin (Hb)', value: 12.8, unit: 'g/dL', referenceRange: '12.0 - 16.0', flag: 'NORMAL' },
          { test: 'Serum Bilirubin (Total)', value: 1.1, unit: 'mg/dL', referenceRange: '0.2 - 1.2', flag: 'NORMAL' }
        ],
        diagnoses: ['Acute Viral Syndrome / Suspected Dengue Fever', 'Thrombocytopenia'],
        confidenceScore: 0.95
      };
    }
    // D. COUGH & BREATHLESSNESS: Pulmonology & Allergy Panel
    else if (isCough) {
      extractedData = {
        documentType: 'pulmonology_report',
        documentTitle: 'Pulmonary Diagnostic & Allergy Evaluation Report',
        facility: 'Chest & Respiratory Clinic',
        date: '2026-06-15',
        imagingFindings: 'Chest X-Ray (PA View): Mild bilateral peribronchial thickening. No focal consolidation or pleural effusion.',
        medications: [
          { name: 'Montelukast + Levocetirizine', dose: '10mg/5mg', frequency: 'once daily (bedtime)', duration: '14 days' },
          { name: 'Budesonide + Formoterol Inhaler', dose: '200mcg/6mcg', frequency: '2 puffs twice daily with spacer', duration: '30 days' },
          { name: 'Amoxicillin + Clavulanic Acid', dose: '625mg', frequency: 'twice daily', duration: '5 days' }
        ],
        labValues: [
          { test: 'Absolute Eosinophil Count (AEC)', value: 680, unit: '/uL', referenceRange: '20 - 500', flag: 'HIGH' },
          { test: 'Oxygen Saturation (SpO2 Resting)', value: 94, unit: '%', referenceRange: '95 - 100', flag: 'LOW' },
          { test: 'Total Serum IgE', value: 420, unit: 'IU/mL', referenceRange: '< 100', flag: 'HIGH' },
          { test: 'Total Leukocyte Count (TLC)', value: 8900, unit: '/uL', referenceRange: '4,000 - 11,000', flag: 'NORMAL' }
        ],
        diagnoses: ['Hyper-reactive Airway Disease / Allergic Bronchitis', 'Mild Exertional Hypoxemia'],
        confidenceScore: 0.94
      };
    }
    // E. ABDOMINAL PAIN: Gastroenterology & Ultrasound
    else if (isAbdominal) {
      extractedData = {
        documentType: 'gastroenterology_report',
        documentTitle: 'Abdominal Ultrasound & Hepato-Pancreatic Panel',
        facility: 'Gastroenterology Diagnostic Wing',
        date: '2026-06-15',
        imagingFindings: 'Ultrasound Whole Abdomen: Single 8mm non-obstructing calculus in gallbladder. Normal common bile duct diameter (4mm). Mild grade 1 fatty liver.',
        medications: [
          { name: 'Pantoprazole', dose: '40mg', frequency: 'once daily before breakfast', duration: '14 days' },
          { name: 'Drotaverine + Mefenamic Acid', dose: '80mg/250mg', frequency: 'as needed for spasmodic pain', duration: 'SOS' },
          { name: 'Ursodeoxycholic Acid', dose: '300mg', frequency: 'twice daily after food', duration: '30 days' }
        ],
        labValues: [
          { test: 'Serum Bilirubin (Total)', value: 1.8, unit: 'mg/dL', referenceRange: '0.2 - 1.2', flag: 'HIGH' },
          { test: 'SGPT / ALT (Liver Enzyme)', value: 78, unit: 'U/L', referenceRange: '10 - 40', flag: 'HIGH' },
          { test: 'Serum Amylase', value: 85, unit: 'U/L', referenceRange: '28 - 100', flag: 'NORMAL' },
          { test: 'Serum Lipase', value: 42, unit: 'U/L', referenceRange: '10 - 60', flag: 'NORMAL' }
        ],
        diagnoses: ['Symptomatic Cholelithiasis (Gallbladder Stone)', 'Mild Transaminitis / Dyspepsia'],
        confidenceScore: 0.96
      };
    }
    // F. DEFAULT GENERAL / METABOLIC
    else {
      extractedData = {
        documentType: 'prescription',
        documentTitle: 'General Outpatient Prescription Record',
        facility: 'District Government Hospital OPD',
        date: '2026-06-15',
        prescriber: 'Dr. S. K. Mehta (MD, Gen Med)',
        medications: [
          { name: 'Metformin', dose: '500mg', frequency: 'twice daily (after meals)', duration: '30 days' },
          { name: 'Amlodipine', dose: '5mg', frequency: 'once daily (morning)', duration: '30 days' }
        ],
        labValues: [
          { test: 'Fasting Blood Sugar', value: 142, unit: 'mg/dL', referenceRange: '70 - 100', flag: 'HIGH' },
          { test: 'HbA1c (Glycated Hemoglobin)', value: 7.4, unit: '%', referenceRange: '4.0 - 5.6', flag: 'HIGH' },
          { test: 'Blood Pressure (Systolic/Diastolic)', value: '140/90', unit: 'mmHg', referenceRange: '120/80', flag: 'HIGH' },
          { test: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.2', flag: 'NORMAL' }
        ],
        diagnoses: ['Type 2 Diabetes Mellitus', 'Stage 1 Essential Hypertension'],
        confidenceScore: 0.96
      };
    }

    console.log(`✅ [DOCAI OCR] Context extraction generated for ${extractedData.documentTitle} (${extractedData.labValues.length} lab tests).`);

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
    abhaDetails,
    consentStatus,
    consentTimestamp,
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
    patientDetails: patientDetails || (abhaDetails ? {
      name: abhaDetails.name,
      age: abhaDetails.age,
      gender: abhaDetails.gender,
      abhaNumber: abhaDetails.abhaNumber,
      abhaAddress: abhaDetails.abhaAddress
    } : {
      name: 'Ramesh Chandra Sharma',
      age: 68,
      gender: 'Male',
      abhaNumber: '91-8472-1029-4821'
    }),
    abhaDetails: abhaDetails || null,
    consentStatus: consentStatus || 'GRANTED',
    consentTimestamp: consentTimestamp || new Date().toISOString(),
    digitizedDocument: digitizedDocument || null,
    ayushAssessment: ayushAssessment || null,
    status: redFlagsTriggered && redFlagsTriggered.length > 0 ? 'TRIAGE_URGENT' : 'WAITING_OPD'
  };

  inMemorySessions.unshift(newSession);

  console.log(`\n✅ [SESSION SUBMITTED] Token: ${tokenNumber} | Complaint: ${complaintTitle} | Doc: ${digitizedDocument ? digitizedDocument.documentTitle : 'None'} | Red Flags: ${newSession.redFlagsTriggered.length}`);

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
    redFlags: redFlagAlerts,
    hisPushes: hisPushedRecords
  });
});

app.listen(PORT, () => {
  console.log(`[MediKiosk Backend] Server running on http://localhost:${PORT}`);
});
