import React, { useState, useEffect } from 'react';
import { 
  Settings, Server, RefreshCw, Database, Activity, CheckCircle2, XCircle, 
  FileText, Leaf, FlaskConical, Play, Check, Clock, QrCode, Send, Code2, 
  ShieldCheck, AlertTriangle, Layers
} from 'lucide-react';
import { extractDocumentWithDocAI } from '../services/docAiService.js';
import { verifyAbhaWithAbdm, pushFhirToHospitalEmr, SAMPLE_ABHA_ACCOUNTS } from '../services/abdmService.js';
import { convertSessionToFhirR4Bundle } from '../services/fhirGenerator.js';

export default function AdminPanel() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // DocAI Simulator State
  const [testingOcr, setTestingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('prescription');

  // ABDM Simulator State
  const [testingAbdm, setTestingAbdm] = useState(false);
  const [abdmResult, setAbdmResult] = useState(null);
  const [testAbhaInput, setTestAbhaInput] = useState('91-8472-1029-4821');

  // HIS EMR Push Simulator State
  const [testingHis, setTestingHis] = useState(false);
  const [hisResult, setHisResult] = useState(null);

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to Express backend at http://localhost:3000');
    } finally {
      setLoading(false);
    }
  };

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

  const runAbdmTest = async () => {
    setTestingAbdm(true);
    setAbdmResult(null);
    try {
      const data = await verifyAbhaWithAbdm({ abhaId: testAbhaInput });
      setAbdmResult(data);
    } catch (err) {
      console.error('ABDM Test Failed:', err);
    } finally {
      setTestingAbdm(false);
    }
  };

  const runHisTest = async () => {
    setTestingHis(true);
    setHisResult(null);
    try {
      const mockSession = {
        id: `sess_admin_test_${Date.now()}`,
        tokenNumber: 'K-999',
        complaintTitle: 'Hypertension Follow-Up',
        submittedAt: new Date().toISOString(),
        patientDetails: { name: 'Ramesh Chandra Sharma', age: 68, gender: 'Male', abhaNumber: '91-8472-1029-4821' }
      };
      const bundle = convertSessionToFhirR4Bundle(mockSession);
      const data = await pushFhirToHospitalEmr({
        sessionId: mockSession.id,
        tokenNumber: mockSession.tokenNumber,
        fhirBundle: bundle
      });
      setHisResult(data);
    } catch (err) {
      console.error('HIS Test Failed:', err);
    } finally {
      setTestingHis(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6 select-none font-sans">
      {/* Header with Sandbox Banner */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2.5 rounded-xl text-white shadow-sm">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">MediKiosk Admin & Sandbox Control</h1>
              <span className="bg-amber-400 text-slate-950 text-[11px] font-black uppercase px-2.5 py-0.5 rounded shadow-sm">
                SANDBOX MODE — simulated for demo
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium">System Health, ABDM Gateway, FHIR R4 & EMR Integration Testers</p>
          </div>
        </div>

        <button
          onClick={checkBackendHealth}
          disabled={loading}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-check System Status
        </button>
      </header>

      <main className="max-w-6xl mx-auto w-full flex flex-col gap-6">
        
        {/* Sandbox Notice Callout */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-950">
          <ShieldCheck className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <strong className="font-extrabold block">SANDBOX TRANSPARENCY NOTICE:</strong>
            All ABDM ABHA verification endpoints, DocAI OCR parsing models, and Hospital EMR sync queues operate in <strong>SANDBOX SIMULATION MODE</strong> for demonstration safety. No real-world Aadhaar or hospital servers are impacted.
          </div>
        </div>

        {/* Server Status Card & Metrics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900">Backend Server Status (Port 3000)</h2>
            </div>
            {healthStatus && (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-0.5 rounded-full border border-emerald-200">
                ● STATUS: {healthStatus.status.toUpperCase()}
              </span>
            )}
          </div>

          {/* Stats Counters */}
          {healthStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sessions</span>
                <strong className="text-xl text-slate-900 font-mono">{healthStatus.activeSessionCount || 0}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">ABHA Verified</span>
                <strong className="text-xl text-emerald-700 font-mono">{healthStatus.abdmVerifiedCount || 0}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">AYUSH Consults</span>
                <strong className="text-xl text-teal-700 font-mono">{healthStatus.ayushSessionCount || 0}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Digitized Docs</span>
                <strong className="text-xl text-purple-700 font-mono">{healthStatus.digitizedDocCount || 0}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">HIS EMR Pushes</span>
                <strong className="text-xl text-blue-700 font-mono">{healthStatus.hisPushedCount || 0}</strong>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================================= */}
        {/* INTERACTIVE SANDBOX SIMULATION TESTERS GRID                             */}
        {/* ======================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* 1. ABDM ABHA Verification Simulator */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                  SANDBOX
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">ABDM ABHA Verification Simulator</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tests <span className="font-mono text-emerald-700">POST /api/abdm/verify</span> with 1.5s gateway delay.
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={testAbhaInput}
                onChange={(e) => setTestAbhaInput(e.target.value)}
                placeholder="14-digit ABHA Number"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <button
                onClick={runAbdmTest}
                disabled={testingAbdm}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${testingAbdm ? 'animate-spin' : ''}`} />
                {testingAbdm ? 'Verifying 1.5s...' : 'Test ABHA Lookup'}
              </button>
            </div>

            {abdmResult && (
              <div className="bg-slate-950 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                <pre>{JSON.stringify(abdmResult, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* 2. DocAI OCR Extraction Simulator */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                  SANDBOX
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">DocAI OCR Extraction Simulator</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tests <span className="font-mono text-purple-700">POST /api/docai/extract</span> with 2.0s AI processing.
              </p>
            </div>

            <div className="space-y-2">
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="prescription">Prescription (Meds + Vitals)</option>
                <option value="lab_report">Lab Pathology (HIGH/LOW Flags)</option>
              </select>
              <button
                onClick={runDocAiTest}
                disabled={testingOcr}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${testingOcr ? 'animate-spin' : ''}`} />
                {testingOcr ? 'Extracting 2.0s...' : 'Test OCR Extraction'}
              </button>
            </div>

            {ocrResult && (
              <div className="bg-slate-950 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                <pre>{JSON.stringify(ocrResult, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* 3. Hospital HIS / EMR Push Simulator */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                  SANDBOX
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">Hospital EMR / HIS Push Simulator</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tests <span className="font-mono text-blue-700">POST /api/his/push</span> with FHIR R4 Bundle commitment.
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium">
                Generates sample FHIR R4 Bundle & commits transaction.
              </div>
              <button
                onClick={runHisTest}
                disabled={testingHis}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${testingHis ? 'animate-spin' : ''}`} />
                {testingHis ? 'Pushing 1.2s...' : 'Test EMR Push'}
              </button>
            </div>

            {hisResult && (
              <div className="bg-slate-950 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                <pre>{JSON.stringify(hisResult, null, 2)}</pre>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
