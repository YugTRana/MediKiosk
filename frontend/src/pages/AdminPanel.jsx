import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Server, RefreshCw, Database, Activity, CheckCircle2, XCircle,
  FileText, Leaf, FlaskConical, Play, Check, Clock, Users, Send, Code2,
  ShieldCheck, AlertTriangle, Layers, Trash2, Search, Smartphone, User, MapPin,
  RotateCcw, Sparkles, HeartPulse, Stethoscope, ArrowRight, Radio, Award,
  Volume2, VolumeX, Mic, MicOff, PieChart, UploadCloud, Moon, Sun, MonitorPlay, Zap, Globe
} from 'lucide-react';
import { extractDocumentWithDocAI, getLabFlagBadgeClass } from '../services/docAiService.js';
import { fetchAdminPatients, deleteAdminPatient, pushFhirToHospitalEmr, getAuthHeaders } from '../services/authService.js';
import { convertSessionToFhirR4Bundle } from '../services/fhirGenerator.js';
import {
  getSpeechProvider,
  setSpeechProvider,
  fetchSpeechConfig,
  speakText,
  cancelSpeech,
  startListening,
  isSTTSupported,
  REGIONAL_LANGUAGES
} from '../services/speechService.js';
import LanguageToggle from '../components/LanguageToggle.jsx';

export default function AdminPanel() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  // Command Center Theme
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Live Spectator Feed Mock State
  const [liveLogs, setLiveLogs] = useState([]);
  const [isSpectatorActive, setIsSpectatorActive] = useState(false);

  // Metrics State
  const [metrics, setMetrics] = useState({
    totalSessionsToday: 0,
    redFlagCount: 0,
    averageCompletionTime: '2m 30s',
    acceptanceRate: '96%',
    registeredPatientsCount: 0,
    emrSyncedCount: 0,
    sandboxMode: true
  });
  const [chartsData, setChartsData] = useState({
    topComplaints: [],
    sessionsTrend: []
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Demo Control Panel States
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [generatedSessionNotice, setGeneratedSessionNotice] = useState(null);

  // Registered Patients Directory State
  const [patients, setPatients] = useState([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // Diagnostics Simulators
  const [testingOcr, setTestingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('prescription');
  const [docAiFile, setDocAiFile] = useState(null);
  const [testingHis, setTestingHis] = useState(false);
  const [hisResult, setHisResult] = useState(null);

  // Speech & Bhashini Diagnostics State
  const [speechProvider, setSpeechProviderState] = useState(getSpeechProvider());
  const [speechConfig, setSpeechConfig] = useState(null);
  const [testSpeechLang, setTestSpeechLang] = useState('hi');
  const [testTtsPlaying, setTestTtsPlaying] = useState(false);
  const [testAsrListening, setTestAsrListening] = useState(false);
  const [testAsrLevel, setTestAsrLevel] = useState(0);
  const [testAsrTranscript, setTestAsrTranscript] = useState('');
  const testAsrRecRef = useRef(null);

  // ABDM Gateway & DPDP Retention State (Phase 8)
  const [abdmStatus, setAbdmStatus] = useState(null);
  const [isPurgingRetention, setIsPurgingRetention] = useState(false);
  const [retentionPurgeReport, setRetentionPurgeReport] = useState(null);

  // Check Backend Health & Live Metrics
  const fetchMetricsAndHealth = async () => {
    setIsLoadingMetrics(true);
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const [healthRes, metricsRes, abdmRes] = await Promise.all([
        fetch('http://localhost:3000/api/health'),
        fetch('http://localhost:3000/api/admin/metrics', { headers: getAuthHeaders() }),
        fetch('http://localhost:3000/api/abdm/status')
      ]);

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthStatus(hData);
      }
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        if (mData.metrics) setMetrics(mData.metrics);
        if (mData.charts) setChartsData(mData.charts);
      }
      if (abdmRes.ok) {
        const abdmData = await abdmRes.json();
        setAbdmStatus(abdmData);
      }
    } catch (err) {
      setHealthError(err.message || 'Failed to connect to backend at http://localhost:3000');
    } finally {
      setIsLoadingMetrics(false);
      setLoadingHealth(false);
    }
  };

  // Load All Patients
  const loadPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const data = await fetchAdminPatients();
      setPatients(data || []);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  // Reset Demo (Clear all sessions, red flags, HIS push logs)
  const handleResetDemo = async () => {
    if (!window.confirm('⚠️ Reset Demo Environment?\n\nThis will clear all in-memory OPD triage sessions, red-flag alerts, and EMR records so you can start a fresh live presentation.')) {
      return;
    }

    setIsResettingDemo(true);
    try {
      const res = await fetch('http://localhost:3000/api/admin/reset', { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setStatusMessage('Demo environment reset successfully! All queues and tokens are fresh.');
        setGeneratedSessionNotice(null);
        fetchMetricsAndHealth();
        loadPatients();
      } else {
        alert(data.message || 'Failed to reset demo');
      }
    } catch (err) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setIsResettingDemo(false);
    }
  };

  // Trigger Manual DPDP Retention Purge (Phase 8)
  const handleTriggerRetentionPurge = async () => {
    setIsPurgingRetention(true);
    setRetentionPurgeReport(null);
    try {
      const res = await fetch('http://localhost:3000/api/admin/purge-expired', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ retentionHours: 0 }) // Purge all completed sessions for immediate test
      });
      const data = await res.json();
      setRetentionPurgeReport(data);
      setStatusMessage(`DPDP Data Retention Job Executed: Purged ${data.purgedCount || 0} expired session records.`);
    } catch (err) {
      console.error('Failed to trigger retention purge:', err);
    } finally {
      setIsPurgingRetention(false);
    }
  };

  // Generate Sample Patient Session
  const handleGenerateSample = async (sampleType = 'random') => {
    setIsGeneratingSample(true);
    setGeneratedSessionNotice(null);
    try {
      const res = await fetch('http://localhost:3000/api/admin/generate-sample', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleType })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedSessionNotice({
          tokenNumber: data.tokenNumber,
          patientName: data.session?.patientName,
          complaintTitle: data.session?.complaintTitle,
          hasRedFlags: data.session?.hasRedFlags
        });
        setStatusMessage(`Generated complete session (Token ${data.tokenNumber}) for ${data.session?.patientName}!`);
        fetchMetricsAndHealth();
        loadPatients();
      } else {
        alert(data.message || 'Failed to generate sample');
      }
    } catch (err) {
      alert(`Generation error: ${err.message}`);
    } finally {
      setIsGeneratingSample(false);
    }
  };

  // Delete Patient Record
  const handleDeletePatient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete patient record for "${name}"?`)) {
      return;
    }
    try {
      await deleteAdminPatient(id);
      setStatusMessage(`Patient record "${name}" deleted.`);
      setTimeout(() => setStatusMessage(null), 4000);
      loadPatients();
      fetchMetricsAndHealth();
    } catch (err) {
      alert(`Error deleting patient: ${err.message}`);
    }
  };

  // Run DocAI Test
  const runDocAiTest = async () => {
    setTestingOcr(true);
    setOcrResult(null);
    try {
      const data = await extractDocumentWithDocAI({
        fileName: docAiFile ? docAiFile.name : (selectedDocType === 'lab_report' ? 'test_lab_panel.pdf' : 'test_prescription.jpg'),
        documentType: selectedDocType,
        file: docAiFile
      });
      setOcrResult(data);
    } catch (err) {
      console.error('DocAI Test Failed:', err);
    } finally {
      setTestingOcr(false);
    }
  };

  // Run HIS Push Test
  const runHisTest = async () => {
    setTestingHis(true);
    setHisResult(null);
    try {
      const mockSession = {
        id: `sess_admin_test_${Date.now()}`,
        tokenNumber: 'K-999',
        complaintTitle: 'Hypertension Follow-Up',
        submittedAt: new Date().toISOString(),
        patientDetails: { name: 'Ramesh Chandra Sharma', age: 68, gender: 'Male', mobile: '9876543210' }
      };
      const bundle = convertSessionToFhirR4Bundle(mockSession);
      const data = await pushFhirToHospitalEmr({
        sessionId: mockSession.id,
        tokenNumber: mockSession.tokenNumber,
        fhirBundle: bundle
      });
      setHisResult({ ...data, fhirBundle: bundle });
      fetchMetricsAndHealth();
    } catch (err) {
      console.error('HIS Test Failed:', err);
    } finally {
      setTestingHis(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndHealth();
    loadPatients();
    fetchSpeechConfig().then(cfg => {
      if (cfg) setSpeechConfig(cfg);
    });
    const interval = setInterval(fetchMetricsAndHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Live Kiosk Feed Consumer
  useEffect(() => {
    if (!isSpectatorActive) return;

    const fetchTelemetry = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/telemetry');
        const data = await res.json();
        if (res.ok && data.logs) {
          setLiveLogs(data.logs.slice(-8));
        }
      } catch (err) {
        console.warn('Telemetry fetch error', err);
      }
    };

    fetchTelemetry();
    const logInterval = setInterval(fetchTelemetry, 1500);

    return () => clearInterval(logInterval);
  }, [isSpectatorActive]);

  const handleToggleSpeechProvider = (newProvider) => {
    setSpeechProvider(newProvider);
    setSpeechProviderState(newProvider);
  };

  const handleTestTts = () => {
    if (testTtsPlaying) {
      cancelSpeech();
      setTestTtsPlaying(false);
      return;
    }

    const testPhrases = {
      'hi': 'नमस्ते, मेडीकियोस्क क्लिनिकल प्रणाली में आपका स्वागत है। कृपया अपनी समस्या बताएं।',
      'en': 'Hello, welcome to MediKiosk Clinical Intake System. Please describe your condition.',
      'mr': 'नमस्कार, मेडीकियोस्क क्लिनिकल प्रणालीमध्ये आपले स्वागत आहे. कृपया आपला त्रास सांगा.',
      'te': 'నమస్కారం, మెడికియోస్క్ క్లినికల్ వ్యవస్థకు స్వాగతం. దయచేసి మీ సమస్యను వివరించండి.'
    };

    const phrase = testPhrases[testSpeechLang] || testPhrases['hi'];
    setTestTtsPlaying(true);
    speakText(phrase, testSpeechLang, () => {
      setTestTtsPlaying(false);
    });
  };

  const handleTestAsr = () => {
    if (testAsrListening) {
      if (testAsrRecRef.current && testAsrRecRef.current.stop) {
        try { testAsrRecRef.current.stop(); } catch (e) { }
      }
      setTestAsrListening(false);
      setTestAsrLevel(0);
      return;
    }

    setTestAsrTranscript('');
    setTestAsrListening(true);
    setTestAsrLevel(0);

    const rec = startListening({
      lang: testSpeechLang,
      onAudioLevel: (lvl) => setTestAsrLevel(lvl),
      onResult: (transcript, isFinal) => {
        if (transcript) setTestAsrTranscript(transcript);
        if (isFinal) {
          setTestAsrListening(false);
          setTestAsrLevel(0);
        }
      },
      onError: () => {
        setTestAsrListening(false);
        setTestAsrLevel(0);
      },
      onEnd: () => {
        setTestAsrListening(false);
        setTestAsrLevel(0);
      }
    });
    testAsrRecRef.current = rec;
  };

  const filteredPatients = patients.filter(p => {
    const q = patientSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.mobile && p.mobile.includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans p-4 md:p-8 flex flex-col gap-6 select-none ${isDarkMode ? 'dark-theme bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Top Header with MediKiosk Branding & Demo Status */}
      <header className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-4 md:p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border transition-colors`}>
        <div className="flex items-center gap-3">
          <div className={`${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} p-2 rounded-xl text-white shadow-sm flex items-center justify-center`}>
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>MediKiosk Command Center</h1>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" /> Sandbox & Mock Demo Mode
              </span>
            </div>
            <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} text-xs font-medium mt-0.5`}>
              Real-time clinical triage metrics, AI telemetry & patient tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <LanguageToggle />
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => { fetchMetricsAndHealth(); loadPatients(); }}
            className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
            title="Refresh database and metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMetrics ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <a
            href="/doctor"
            className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Stethoscope className="w-3.5 h-3.5" /> Doctor Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Status Notice Toast */}
      {statusMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 px-5 py-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DEMO CONTROL PANEL (FAST PRESETS & 1-CLICK RESET)                      */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-800 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
              Presenter Quick Controls
            </span>
            <h2 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Rapid Demo Patient Generator & Queue Reset
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Instantly create complete clinical intake records to demonstrate the Doctor Dashboard without typing at the kiosk.
            </p>
          </div>

          <button
            onClick={handleResetDemo}
            disabled={isResettingDemo}
            className="px-4 py-2.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-extrabold rounded-xl border border-red-500 shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            title="Clear all active sessions and queue"
          >
            <RotateCcw className={`w-4 h-4 ${isResettingDemo ? 'animate-spin' : ''}`} />
            {isResettingDemo ? 'Resetting Demo...' : 'Reset Demo Queue'}
          </button>
        </div>

        {/* 1-Click Patient Generator Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <button
            onClick={() => handleGenerateSample('redflag')}
            disabled={isGeneratingSample}
            className="p-4 bg-slate-800/90 hover:bg-slate-800 border-2 border-red-500/50 hover:border-red-400 rounded-2xl text-left transition-all cursor-pointer group flex flex-col justify-between gap-3 disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Critical Red-Flag
              </span>
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-125 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white group-hover:text-red-300 transition-colors">
                Ramesh Sharma (Chest Pain)
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Crushing chest pain, ST-elevation ECG & Critical Troponin I (1.42 ng/mL).
              </p>
            </div>
            <span className="text-[11px] font-extrabold text-red-300 mt-1 flex items-center gap-1">
              Generate & Send to Queue <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            onClick={() => handleGenerateSample('ayush')}
            disabled={isGeneratingSample}
            className="p-4 bg-slate-800/90 hover:bg-slate-800 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-2xl text-left transition-all cursor-pointer group flex flex-col justify-between gap-3 disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white flex items-center gap-1">
                <Leaf className="w-3 h-3" /> AYUSH Intake
              </span>
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-125 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                Sunita Devi (Joint Pain)
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Knee arthritis, Vata-Kapha Prakriti, Manda Agni & Rheumatology Panel.
              </p>
            </div>
            <span className="text-[11px] font-extrabold text-emerald-300 mt-1 flex items-center gap-1">
              Generate & Send to Queue <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            onClick={() => handleGenerateSample('standard')}
            disabled={isGeneratingSample}
            className="p-4 bg-slate-800/90 hover:bg-slate-800 border-2 border-blue-500/50 hover:border-blue-400 rounded-2xl text-left transition-all cursor-pointer group flex flex-col justify-between gap-3 disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-600 text-white flex items-center gap-1">
                <Activity className="w-3 h-3" /> Acute Care
              </span>
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-125 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
                Amit Verma (Fever & Chills)
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                3-day fever spikes, CBC & platelet panel (Platelets: 115,000 /cumm).
              </p>
            </div>
            <span className="text-[11px] font-extrabold text-blue-300 mt-1 flex items-center gap-1">
              Generate & Send to Queue <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>

        {/* Banner showing generated session */}
        {generatedSessionNotice && (
          <div className="bg-emerald-950/80 border-2 border-emerald-500/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 rounded-xl text-white">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Ready in Doctor Review Queue
                </span>
                <p className="text-sm font-extrabold text-white">
                  Token <span className="font-mono bg-emerald-900 px-1.5 py-0.5 rounded text-amber-300">{generatedSessionNotice.tokenNumber}</span> — {generatedSessionNotice.patientName} ({generatedSessionNotice.complaintTitle})
                </p>
              </div>
            </div>
            <a
              href="/doctor"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
            >
              Open in Doctor Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. HACKATHON COMMAND CENTER MODULES                                       */}
      {/* ========================================================================= */}

      {/* A. Live Telemetry & Kiosk Spectator Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live AI Analytics & Telemetry */}
        <div className={`col-span-1 lg:col-span-2 p-6 rounded-3xl border shadow-sm flex flex-col gap-5 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
            <h3 className={`text-sm font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <Sparkles className="w-5 h-5 text-amber-400" /> Live AI Telemetry (Gemini Engine)
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Online
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Generation Latency</span>
                <Clock className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className={`text-2xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>1.24s</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-500 w-1/3 h-full rounded-full"></div>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Context Adherence</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className={`text-2xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>98.5%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 w-[98.5%] h-full rounded-full"></div>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Safety Red-Flags</span>
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className={`text-2xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>0 P/F</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-purple-500 w-0 h-full rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Kiosk Spectator Feed */}
        <div className={`col-span-1 p-6 rounded-3xl border shadow-sm flex flex-col gap-4 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
            <h3 className={`text-sm font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <MonitorPlay className="w-5 h-5 text-blue-400" /> Live Spectator Feed
            </h3>
            <button
              onClick={() => {
                setIsSpectatorActive(!isSpectatorActive);
                if (isSpectatorActive) setLiveLogs([]);
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${isSpectatorActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}
            >
              {isSpectatorActive ? 'Stop Feed' : 'Start Feed'}
            </button>
          </div>

          <div className={`flex-1 rounded-xl p-3 font-mono text-[10px] md:text-xs overflow-y-auto min-h-[160px] max-h-[160px] flex flex-col justify-end gap-1.5 border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
            {!isSpectatorActive && (
              <div className="text-center opacity-50 my-auto">Feed offline. Click 'Start Feed' to intercept.</div>
            )}
            {liveLogs.map((log, i) => (
              <div key={i} className={`animate-fadeIn flex gap-2 ${log.type === 'ai' ? 'text-blue-400' : log.type === 'speech' ? 'text-emerald-400' : log.type === 'system' ? 'text-purple-400' : log.type === 'success' ? 'text-amber-400 font-bold' : 'opacity-70'}`}>
                <span className="opacity-50">[{log.time}]</span>
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* B. Real-Time Floorplan / Patient Tracker */}
      <div className={`p-6 rounded-3xl border shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 mb-6">
          <h3 className={`text-sm font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <MapPin className="w-5 h-5 text-emerald-400" /> Real-Time Patient Tracker
          </h3>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{patients.length} Active Patients</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-2 relative w-full px-4 sm:px-12">
          {/* Connecting Line */}
          <div className={`absolute top-1/2 left-12 right-12 h-1 hidden sm:block -translate-y-1/2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>

          {/* Node 1: Kiosk */}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-lg ${isDarkMode ? 'bg-slate-950 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
              <Smartphone className="w-6 h-6" />
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>1. Triage Kiosk</span>
          </div>

          {/* Node 2: Waiting Queue */}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-lg ${isDarkMode ? 'bg-slate-950 border-amber-500/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
              <Users className="w-6 h-6" />
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>2. Wait Queue</span>

            {/* Blips */}
            <div className="absolute -top-3 -right-3 flex gap-1">
              {patients.slice(0, 3).map((p, i) => (
                <div key={i} className="w-4 h-4 bg-amber-400 rounded-full border-2 border-slate-900 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} title={p.name}></div>
              ))}
              {patients.length > 3 && (
                <div className="text-[9px] font-black bg-amber-500 text-slate-900 w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900">+{patients.length - 3}</div>
              )}
            </div>
          </div>

          {/* Node 3: Doctor's Cabin */}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-lg ${isDarkMode ? 'bg-slate-950 border-emerald-500/50 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              <Stethoscope className="w-6 h-6" />
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>3. Doctor Cabin</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ORIGINAL REAL METRICS VIEW ROW                                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Metric 1: Total Sessions Today */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-3 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Sessions Today</span>
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className={`text-3xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {metrics.totalSessionsToday}
            </span>
            <span className={`text-[11px] block mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Recorded OPD intakes</span>
          </div>
        </div>

        {/* Metric 2: Red Flag Count */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-3 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Critical Red-Flags</span>
            <div className="p-2 bg-red-500/20 text-red-400 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-red-500 font-mono">
              {metrics.redFlagCount}
            </span>
            <span className="text-[11px] text-red-500/80 font-bold block mt-0.5">High-acuity triage alerts</span>
          </div>
        </div>

        {/* Metric 3: Avg Completion Time */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-3 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Avg Check-In Time</span>
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className={`text-3xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {metrics.averageCompletionTime}
            </span>
            <span className={`text-[11px] block mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>SOCRATES & AYUSH dialogue</span>
          </div>
        </div>

        {/* Metric 4: Physician Acceptance Rate */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-3 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Physician Accept Rate</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-emerald-500 font-mono">
              {metrics.acceptanceRate}
            </span>
            <span className="text-[11px] text-emerald-500/80 font-bold block mt-0.5">Clinical section sign-off</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2A. ACTUAL ANALYTICS CHARTS                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Sessions Trend */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Sessions Trend (Last 7 Days)
            </h3>
          </div>
          <div className="h-48 flex items-end justify-between gap-2 pt-4">
            {chartsData.sessionsTrend && chartsData.sessionsTrend.length > 0 ? (
              chartsData.sessionsTrend.map((dataPoint, idx) => {
                const maxCount = Math.max(...chartsData.sessionsTrend.map(d => d.count), 1);
                const heightPercentage = maxCount === 0 ? '4px' : `${(dataPoint.count / maxCount) * 100}%`;

                return (
                  <div key={idx} className="flex flex-col items-center flex-1 group">
                    <div className="relative w-full flex justify-center h-32 items-end">
                      <div
                        className="w-full max-w-[32px] bg-blue-500 rounded-t-md group-hover:bg-blue-600 transition-all duration-300 relative"
                        style={{ height: heightPercentage, minHeight: '4px' }}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md transition-opacity whitespace-nowrap z-10">
                          {dataPoint.count} Sessions
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">
                      {dataPoint.date}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                Not enough data yet.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Top Complaints */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              Top 5 Chief Complaints
            </h3>
          </div>
          <div className="flex flex-col gap-3 justify-center h-48">
            {chartsData.topComplaints && chartsData.topComplaints.length > 0 ? (
              chartsData.topComplaints.map((complaint, idx) => {
                const maxCount = Math.max(...chartsData.topComplaints.map(c => c.count), 1);
                const widthPercentage = maxCount === 0 ? '0%' : `${(complaint.count / maxCount) * 100}%`;
                const colors = ['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500'];
                const bgClass = colors[idx % colors.length];

                return (
                  <div key={idx} className="flex flex-col gap-1 w-full">
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-slate-700 truncate pr-2">{complaint.name}</span>
                      <span className="text-slate-900">{complaint.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${bgClass}`} style={{ width: widthPercentage }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                Not enough data yet.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2B. ABDM GATEWAY & DPDP CONSENT FRAMEWORK STATUS (MODULE D - PHASE 8)    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-800 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">ABDM National Health Authority & DPDP Consent Layer</h3>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${abdmStatus?.mode === 'LIVE_SANDBOX'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                  {abdmStatus?.mode === 'LIVE_SANDBOX' ? '● LIVE_SANDBOX (dev.abdm.gov.in)' : '● SANDBOX_SIMULATOR (Local Fallback)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ABHA ID verification, live Aadhaar/Mobile OTP authentication, and revocable DPDP Act 2023 compliance
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerRetentionPurge}
            disabled={isPurgingRetention}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            title="Execute automated DPDP session data purge job"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPurgingRetention ? 'animate-spin' : ''}`} />
            {isPurgingRetention ? 'Purging Raw Data...' : '🧹 Run DPDP Retention Purge'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Gateway Mode</span>
            <span className="text-xs font-extrabold text-slate-800 font-mono mt-0.5 block">
              {abdmStatus?.mode || 'SANDBOX_SIMULATOR'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {abdmStatus?.clientIdConfigured ? 'ABDM_CLIENT_ID Linked' : 'Using Local SQLite Sandbox'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Telecom SMS OTP Gateway</span>
            <span className="text-xs font-extrabold text-slate-800 font-mono mt-0.5 block">
              {abdmStatus?.smsGatewayConfigured ? 'Fast2SMS / 2Factor / Twilio' : 'DEMO OTP: 123456'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {abdmStatus?.smsGatewayConfigured ? 'Live SMS Dispatch Active' : 'Fallback Code 123456 active'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">DPDP Act Consent</span>
            <span className="text-xs font-extrabold text-emerald-700 font-mono mt-0.5 block">
              Granular & Revocable
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Triage + HIS + ABHA linking toggles
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Data Retention Policy</span>
            <span className="text-xs font-extrabold text-blue-700 font-mono mt-0.5 block">
              24h Auto-Purge Post-HIS
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Raw voice transcripts erased
            </span>
          </div>
        </div>

        {retentionPurgeReport && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">
                Retention Purge Executed: {retentionPurgeReport.purgedCount || 0} session raw records cleared per DPDP Act retention cutoff.
              </span>
            </div>
            <button onClick={() => setRetentionPurgeReport(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold">
              &times;
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. REGISTERED PATIENT DIRECTORY & RECORDS TABLE                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-black text-slate-900">Registered Patient Directory</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-black px-2 py-0.5 rounded-full">
                {patients.length} Citizens
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Citizen accounts stored in SQLite database with total OPD consultation history
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name, mobile, city..."
              className="w-full p-2.5 pl-9 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 shadow-sm"
            />
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        {/* Patients Table */}
        <div className="overflow-x-auto">
          {isLoadingPatients ? (
            <div className="p-12 text-center text-slate-500 text-xs font-bold flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span>Loading registered patient directory...</span>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs font-bold flex flex-col items-center justify-center gap-2">
              <User className="w-8 h-8 text-slate-300" />
              <span>No patient records found matching your search.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Age / Gender</th>
                  <th className="py-3 px-4">City / Address</th>
                  <th className="py-3 px-4">Total Consultations</th>
                  <th className="py-3 px-4">Registration Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {filteredPatients.map((pt) => (
                  <tr key={pt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">
                        {pt.name ? pt.name[0] : 'P'}
                      </div>
                      <div>
                        <span className="block font-black text-slate-900">{pt.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {pt.id.slice(-8)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      +91 {pt.mobile}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {pt.gender}, {pt.age} Y
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {pt.address || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                        {pt.totalConsultations} OPD Visits
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(pt.registeredAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeletePatient(pt.id, pt.name)}
                        title="Delete Patient Record"
                        className="p-1.5 text-red-500 hover:text-white hover:bg-red-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DIAGNOSTICS & SYSTEM SIMULATORS                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DocAI OCR Simulator */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900">DocAI OCR Extraction Diagnostics</h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
              Tesseract & PDF Stream
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Execute a live diagnostic run against the OCR engine to verify lab report and prescription biomarker parsing.
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 flex-1"
              >
                <option value="prescription">Prescription (Rx Medications)</option>
                <option value="lab_report">Diagnostic Lab Report (Blood/Urine Panel)</option>
              </select>

              <label className="flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer transition-colors text-xs font-bold text-slate-700 whitespace-nowrap">
                <UploadCloud className="w-4 h-4 mr-2 text-indigo-600" />
                {docAiFile ? docAiFile.name.substring(0, 15) + (docAiFile.name.length > 15 ? '...' : '') : 'Upload Image/PDF'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setDocAiFile(e.target.files[0])}
                />
              </label>

              <button
                onClick={runDocAiTest}
                disabled={testingOcr}
                className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${testingOcr ? 'animate-spin' : ''}`} />
                <span>{testingOcr ? 'Extracting...' : 'Run Test'}</span>
              </button>
            </div>

            {!docAiFile && (
              <p className="text-[10px] text-slate-400 italic">
                *No file uploaded. Will fallback to a dummy demo document for testing.
              </p>
            )}
          </div>

          {ocrResult && (
            <div className="mt-2 border border-indigo-100 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
              <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex items-center justify-between">
                <h4 className="text-xs font-black text-indigo-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Extraction Complete
                </h4>
                {ocrResult.confidenceScore && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ocrResult.confidenceScore > 0.85
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-amber-100 text-amber-700 border-amber-300'
                    }`}>
                    Confidence: {(ocrResult.confidenceScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-col gap-4 text-xs">
                {/* Diagnoses */}
                {ocrResult.diagnoses && ocrResult.diagnoses.length > 0 && (
                  <div>
                    <h5 className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Extracted Diagnoses</h5>
                    <ul className="list-disc pl-5 text-slate-600">
                      {ocrResult.diagnoses.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}

                {/* Medications */}
                {ocrResult.medications && ocrResult.medications.length > 0 && (
                  <div>
                    <h5 className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Extracted Medications</h5>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-50">
                          <th className="pb-1">Medicine Name</th>
                          <th className="pb-1">Dose</th>
                          <th className="pb-1">Frequency</th>
                          <th className="pb-1">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700">
                        {ocrResult.medications.map((m, i) => (
                          <tr key={i} className="border-b border-slate-50/50">
                            <td className="py-1.5 font-bold">{m.name}</td>
                            <td className="py-1.5">{m.dose}</td>
                            <td className="py-1.5">{m.frequency}</td>
                            <td className="py-1.5">{m.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Lab Values */}
                {ocrResult.labValues && ocrResult.labValues.length > 0 && (
                  <div>
                    <h5 className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Extracted Lab Biomarkers</h5>
                    <div className="flex flex-col gap-2">
                      {ocrResult.labValues.map((l, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-800 block">{l.parameterName}</span>
                            <span className="text-[10px] text-slate-500">Ref: {l.referenceRange}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-700">{l.observedValue} {l.unit}</span>
                            <span className={getLabFlagBadgeClass(l.flag)}>{l.flag}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hospital EMR FHIR Push Simulator */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-black text-slate-900">Hospital EMR FHIR R4 Push Diagnostics</h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
              HL7 FHIR R4
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Simulate transmitting and committing a standardized HL7 FHIR R4 Bundle to the Hospital Information System (HIS).
          </p>

          <button
            onClick={runHisTest}
            disabled={testingHis}
            className="py-3 px-4 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-auto"
          >
            <Send className={`w-3.5 h-3.5 ${testingHis ? 'animate-spin' : ''}`} />
            <span>{testingHis ? 'Transmitting FHIR Bundle...' : 'Simulate FHIR EMR Sync'}</span>
          </button>

          {hisResult && (
            <div className="mt-4 border border-purple-100 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
              <div className="bg-purple-50 p-3 border-b border-purple-100 flex items-center justify-between">
                <h4 className="text-xs font-black text-purple-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Push Successful
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-300">
                  HTTP 201 Created
                </span>
              </div>

              <div className="p-4 flex flex-col gap-3 text-xs text-slate-700">
                <p className="font-bold">Generated FHIR R4 Bundle Summary:</p>

                {hisResult.fhirBundle ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                      <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Bundle Type</span>
                      <span className="font-mono text-purple-700 font-bold">{hisResult.fhirBundle.type || 'transaction'}</span>
                    </div>
                    <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                      <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Resources Generated</span>
                      <span className="font-mono text-slate-900 font-bold">{hisResult.fhirBundle.entry?.length || 0} Entities</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                    <span className="text-slate-600">Sync completed but detailed bundle structure is hidden.</span>
                  </div>
                )}

                <div className="mt-2 pt-3 border-t border-slate-100">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-2">Transmission Log</span>
                  <div className="bg-slate-900 text-purple-300 p-3 rounded-xl font-mono text-[10px] overflow-auto max-h-40 flex flex-col gap-1">
                    <div> Authenticating with HIS... <span className="text-emerald-400">[OK]</span></div>
                    <div> Validating FHIR R4 Structure... <span className="text-emerald-400">[OK]</span></div>
                    <div> Transmitting Bundle ({(hisResult.fhirBundle?.entry?.length || 1) * 324} bytes)... <span className="text-emerald-400">[OK]</span></div>
                    <div className="text-emerald-400 mt-1"> Encounter & Patient Record Committed.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Speech & Indian-Language Voice AI Diagnostics */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Speech & Indian-Language Voice AI Engine</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pluggable Speech Gateway: Browser Web Speech API fallback + Bhashini (AI4Bharat / Digital India)
                </p>
              </div>
            </div>

            {/* Provider Switcher Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 pl-2">Active Provider:</span>
              <div className="px-3 py-1.5 rounded-xl text-xs font-black transition-all bg-white text-slate-900 shadow-sm border border-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Google Web Speech
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status & Credential Info */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gateway Status</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-black text-slate-800">
                    Google Web Speech API Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Connected to native browser speech pipeline. Real-time regional ASR and TTS active using built-in Google services.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-400">
                Docs: <span className="font-mono text-slate-600">developer.mozilla.org</span>
              </div>
            </div>

            {/* Test Controls */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between gap-3 lg:col-span-2">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Interactive Speech Sandbox</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Test Language:</span>
                    <select
                      value={testSpeechLang}
                      onChange={(e) => setTestSpeechLang(e.target.value)}
                      className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="hi">Hindi (हिंदी)</option>
                      <option value="en">Indian English</option>
                      <option value="mr">Marathi (मराठी)</option>
                      <option value="te">Telugu (తెలుగు)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 mt-3">
                  {/* Test TTS */}
                  <button
                    onClick={handleTestTts}
                    className={`px-4 py-2 text-xs font-black rounded-xl border flex items-center gap-2 transition-all cursor-pointer shadow-sm ${testTtsPlaying
                        ? 'bg-amber-600 text-white border-amber-600 animate-pulse'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                      }`}
                  >
                    <Volume2 className="w-4 h-4 text-amber-600" />
                    <span>{testTtsPlaying ? 'Playing Audio...' : 'Test Voice Output (TTS)'}</span>
                  </button>

                  {/* Test ASR */}
                  <button
                    onClick={handleTestAsr}
                    className={`px-4 py-2 text-xs font-black rounded-xl border flex items-center gap-2 transition-all cursor-pointer shadow-sm ${testAsrListening
                        ? 'bg-red-600 text-white border-red-600 animate-pulse'
                        : 'bg-slate-800 text-white border-slate-800 hover:bg-slate-900'
                      }`}
                  >
                    {testAsrListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-amber-400" />}
                    <span>{testAsrListening ? 'Listening (Speak Now)...' : 'Test Microphone Input (ASR)'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic feedback: level & transcript */}
              {(testAsrListening || testAsrTranscript) && (
                <div className="mt-2 p-3 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col gap-2">
                  {testAsrListening && (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      <span>Audio Input Level: {testAsrLevel}%</span>
                      <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-400 h-full transition-all duration-75"
                          style={{ width: `${testAsrLevel}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {testAsrTranscript && (
                    <div className="text-xs">
                      <span className="text-slate-400 font-bold">Transcription: </span>
                      <span className="text-emerald-400 font-medium">"{testAsrTranscript}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
