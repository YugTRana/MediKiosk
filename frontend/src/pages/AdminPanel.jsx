import React, { useState, useEffect } from 'react';
import { 
  Settings, Server, RefreshCw, Database, Activity, CheckCircle2, XCircle, 
  FileText, Leaf, FlaskConical, Play, Check, Clock
} from 'lucide-react';
import { extractDocumentWithDocAI, getLabFlagBadgeClass } from '../services/docAiService.js';

export default function AdminPanel() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // DocAI Simulator State
  const [testingOcr, setTestingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('prescription');

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

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6 select-none">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex justify-between items-center border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2.5 rounded-xl text-white shadow-sm">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">MediKiosk Admin & Control Panel</h1>
            <p className="text-slate-400 text-xs">System Health, DocAI OCR Simulation & AYUSH Analytics</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* Server Status Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <Server className="w-7 h-7 text-purple-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Backend API Health Connection</h2>
                <p className="text-xs text-slate-500">
                  Testing CORS & Express Endpoint <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-purple-700 font-semibold">http://localhost:3000/api/health</span>
                </p>
              </div>
            </div>
            <button
              onClick={checkBackendHealth}
              disabled={loading}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Re-check Status
            </button>
          </div>

          {/* Connection Result */}
          {loading ? (
            <div className="p-4 bg-slate-50 text-slate-600 rounded-xl text-sm font-medium animate-pulse">
              Pinging Express server on port 3000...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold">Backend Not Reachable</h3>
                <p className="text-xs font-medium text-red-800">{error}</p>
                <p className="text-xs mt-1 text-red-700">Make sure the Express server is running on port 3000.</p>
              </div>
            </div>
          ) : healthStatus ? (
            <div className="p-4 bg-emerald-50/60 border border-emerald-300 rounded-xl text-emerald-950 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Backend Express Server Operational</h3>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-200">
                  Status: {healthStatus.status}
                </span>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Sessions</span>
                  <strong className="text-lg text-slate-900">{healthStatus.activeSessionCount || 0}</strong>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">AYUSH Consultations</span>
                  <strong className="text-lg text-emerald-700">{healthStatus.ayushSessionCount || 0}</strong>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Digitized Docs</span>
                  <strong className="text-lg text-purple-700">{healthStatus.digitizedDocCount || 0}</strong>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Red Flags</span>
                  <strong className="text-lg text-red-600">{healthStatus.redFlagAlertCount || 0}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* FEATURE 1 ADMIN TOOL: DOCAI OCR SIMULATION TESTER */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">DocAI OCR Mock Endpoint Simulator</h2>
                <p className="text-xs text-slate-500">Test <span className="font-mono text-purple-700">POST /api/docai/extract</span> with 2-second AI processing delay</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="prescription">Prescription (Meds & Diagnoses)</option>
                <option value="lab_report">Lab Pathology Report (HIGH/LOW Flags)</option>
              </select>

              <button
                onClick={runDocAiTest}
                disabled={testingOcr}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${testingOcr ? 'animate-spin' : ''}`} />
                {testingOcr ? 'Simulating 2s OCR...' : 'Run Extraction Test'}
              </button>
            </div>
          </div>

          {testingOcr && (
            <div className="p-6 bg-purple-50 rounded-xl border border-purple-200 text-center animate-pulse">
              <Clock className="w-8 h-8 text-purple-600 mx-auto mb-2 animate-spin" />
              <strong className="text-xs text-purple-950 block">AI Neural OCR Model Ingesting Document...</strong>
              <span className="text-[11px] text-purple-700">Simulating 2000ms latency on /api/docai/extract</span>
            </div>
          )}

          {ocrResult && (
            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-72">
              <div className="text-slate-400 mb-2">// 200 OK — Extracted JSON Response:</div>
              <pre>{JSON.stringify(ocrResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Architecture & Mock Data Schemas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Database className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="text-base font-bold text-slate-900">patientSessions.json</h3>
            <p className="text-slate-500 text-xs mt-0.5">Now stores digitizedDocument & ayushAssessment fields</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Leaf className="w-6 h-6 text-emerald-600 mb-2" />
            <h3 className="text-base font-bold text-slate-900">AYUSH Flow Engine</h3>
            <p className="text-slate-500 text-xs mt-0.5">Prakriti, Agni, Koshtha & Ahara-Vihara</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Server className="w-6 h-6 text-purple-600 mb-2" />
            <h3 className="text-base font-bold text-slate-900">DocAI OCR Mock API</h3>
            <p className="text-slate-500 text-xs mt-0.5">Automated medication and lab value extraction</p>
          </div>
        </div>
      </main>
    </div>
  );
}
