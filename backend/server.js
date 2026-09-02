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

app.use(express.json());

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
  res.json({
    status: 'ok',
    service: 'MediKiosk API Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSessionCount: inMemorySessions.length,
    redFlagAlertCount: redFlagAlerts.length
  });
});

// Endpoint: GET /api/dialogue-flows
app.get('/api/dialogue-flows', (req, res) => {
  res.json(dialogueFlows);
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
  
  const { sessionId, complaintId, complaintTitle, answers, redFlagsTriggered, language, patientDetails } = req.body;

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
    status: redFlagsTriggered && redFlagsTriggered.length > 0 ? 'TRIAGE_URGENT' : 'WAITING_OPD'
  };

  // In-memory store only
  inMemorySessions.unshift(newSession);

  console.log(`\n✅ [SESSION SUBMITTED] Token: ${tokenNumber} | Complaint: ${complaintTitle} | Red Flags: ${newSession.redFlagsTriggered.length}`);

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
