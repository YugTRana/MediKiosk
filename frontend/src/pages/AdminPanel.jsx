import React, { useState, useEffect } from 'react';
import { 
  Settings, Server, RefreshCw, Database, Activity, CheckCircle2, XCircle, 
  FileText, Leaf, FlaskConical, Play, Check, Clock, Users, Send, Code2, 
  ShieldCheck, AlertTriangle, Layers, Trash2, Search, Smartphone, User, MapPin,
  RotateCcw, Sparkles, HeartPulse, Stethoscope, ArrowRight, Radio, Award
} from 'lucide-react';
import { extractDocumentWithDocAI } from '../services/docAiService.js';
import { fetchAdminPatients, deleteAdminPatient, pushFhirToHospitalEmr } from '../services/authService.js';
import { convertSessionToFhirR4Bundle } from '../services/fhirGenerator.js';

export default function AdminPanel() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

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
  const [testingHis, setTestingHis] = useState(false);
  const [hisResult, setHisResult] = useState(null);

  // Check Backend Health & Live Metrics
  const fetchMetricsAndHealth = async () => {
    setIsLoadingMetrics(true);
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch('http://localhost:3000/api/health'),
        fetch('http://localhost:3000/api/admin/metrics')
      ]);

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthStatus(hData);
      }
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        if (mData.metrics) setMetrics(mData.metrics);
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
      const res = await fetch('http://localhost:3000/api/admin/reset', { method: 'POST' });
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

  // Generate Sample Patient Session
  const handleGenerateSample = async (sampleType = 'random') => {
    setIsGeneratingSample(true);
    setGeneratedSessionNotice(null);
    try {
      const res = await fetch('http://localhost:3000/api/admin/generate-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        fileName: selectedDocType === 'lab_report' ? 'test_lab_panel.pdf' : 'test_prescription.jpg',
        documentType: selectedDocType
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
      setHisResult(data);
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
    const interval = setInterval(fetchMetricsAndHealth, 5000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 flex flex-col gap-6 select-none font-sans">
      
      {/* Top Header with MediKiosk Branding & Demo Status */}
      <header className="bg-slate-900 text-white p-5 md:p-6 rounded-3xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-sm flex items-center justify-center">
            <HeartPulse className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">MediKiosk Demo Control & Administration</h1>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Sandbox & Mock Demo Mode
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium mt-0.5">
              Rapid demo scenarios, live clinical triage metrics & patient records management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => { fetchMetricsAndHealth(); loadPatients(); }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh database and metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMetrics ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <a
            href="/doctor"
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
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
      {/* 2. REAL METRICS VIEW ROW                                                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Sessions Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sessions Today</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 font-mono">
              {metrics.totalSessionsToday}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Recorded OPD intakes</span>
          </div>
        </div>

        {/* Metric 2: Red Flag Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Critical Red-Flags</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-red-600 font-mono">
              {metrics.redFlagCount}
            </span>
            <span className="text-[11px] text-red-500 font-bold block mt-0.5">High-acuity triage alerts</span>
          </div>
        </div>

        {/* Metric 3: Avg Completion Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Check-In Time</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 font-mono">
              {metrics.averageCompletionTime}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">SOCRATES & AYUSH dialogue</span>
          </div>
        </div>

        {/* Metric 4: Physician Acceptance Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Physician Accept Rate</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-emerald-700 font-mono">
              {metrics.acceptanceRate}
            </span>
            <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">Clinical section sign-off</span>
          </div>
        </div>

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

          <div className="flex gap-2">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 flex-1"
            >
              <option value="prescription">Prescription (Rx Medications)</option>
              <option value="lab_report">Diagnostic Lab Report (Blood/Urine Panel)</option>
            </select>

            <button
              onClick={runDocAiTest}
              disabled={testingOcr}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${testingOcr ? 'animate-spin' : ''}`} />
              <span>{testingOcr ? 'Extracting...' : 'Run Test'}</span>
            </button>
          </div>

          {ocrResult && (
            <div className="bg-slate-950 text-emerald-400 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
              <pre>{JSON.stringify(ocrResult, null, 2)}</pre>
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
            <div className="bg-slate-950 text-purple-300 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
              <pre>{JSON.stringify(hisResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
