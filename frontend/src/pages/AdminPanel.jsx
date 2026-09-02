import React, { useState, useEffect } from 'react';
import { 
  Settings, Server, RefreshCw, Database, Activity, CheckCircle2, XCircle, 
  FileText, Leaf, FlaskConical, Play, Check, Clock, Users, Send, Code2, 
  ShieldCheck, AlertTriangle, Layers, Trash2, Search, Smartphone, User, MapPin
} from 'lucide-react';
import { extractDocumentWithDocAI } from '../services/docAiService.js';
import { fetchAdminPatients, deleteAdminPatient, pushFhirToHospitalEmr } from '../services/authService.js';
import { convertSessionToFhirR4Bundle } from '../services/fhirGenerator.js';

export default function AdminPanel() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  // Registered Patients Directory State
  const [patients, setPatients] = useState([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // DocAI Simulator State
  const [testingOcr, setTestingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('prescription');

  // HIS EMR Push Simulator State
  const [testingHis, setTestingHis] = useState(false);
  const [hisResult, setHisResult] = useState(null);

  // Check Backend Health
  const checkBackendHealth = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await fetch('http://localhost:3000/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setHealthError(err.message || 'Failed to connect to backend at http://localhost:3000');
    } finally {
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

  // Delete Patient Record
  const handleDeletePatient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete patient record for "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteAdminPatient(id);
      setStatusMessage(`Patient "${name}" record successfully deleted.`);
      setTimeout(() => setStatusMessage(null), 4000);
      loadPatients();
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
    } catch (err) {
      console.error('HIS Test Failed:', err);
    } finally {
      setTestingHis(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
    loadPatients();
  }, []);

  // Filtered Patients by Search
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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">MediKiosk Administration & Records Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">Patient database records, consultation history, and backend diagnostics</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { checkBackendHealth(); loadPatients(); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh All Records</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-950 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* System Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Backend Server</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${healthStatus?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-base font-black text-slate-900">
                {healthStatus?.status === 'ok' ? 'Express Online (Port 3000)' : 'Connecting...'}
              </span>
            </div>
          </div>
          <Server className="w-8 h-8 text-slate-400" />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Registered Patients</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {patients.length} Citizens
            </span>
          </div>
          <Users className="w-8 h-8 text-blue-600" />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Database Storage</span>
            <span className="text-base font-black text-slate-900 mt-1 block">
              Prisma ORM (SQLite)
            </span>
          </div>
          <Database className="w-8 h-8 text-purple-600" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REGISTERED PATIENT DIRECTORY & RECORDS TABLE                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-black text-slate-900">Registered Patient Records Directory</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              All citizens registered via Kiosk with full demographic records & consultation count
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
      {/* 2. DIAGNOSTICS & SYSTEM SIMULATORS                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DocAI OCR Simulator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">DocAI OCR Extraction Diagnostics</h3>
          </div>
          <p className="text-xs text-slate-500">
            Execute a test run against Google Document AI OCR engine to verify lab report and prescription parsing.
          </p>

          <div className="flex gap-2">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 flex-1"
            >
              <option value="prescription">Prescription (Rx)</option>
              <option value="lab_report">Diagnostic Lab Report</option>
            </select>

            <button
              onClick={runDocAiTest}
              disabled={testingOcr}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testingOcr ? 'Processing...' : 'Run Test'}</span>
            </button>
          </div>

          {ocrResult && (
            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
              <pre>{JSON.stringify(ocrResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Hospital EMR FHIR Push Simulator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-black text-slate-900">Hospital EMR FHIR R4 Push Diagnostics</h3>
          </div>
          <p className="text-xs text-slate-500">
            Simulate pushing a standardized FHIR R4 Bundle into Hospital Information System (HIS).
          </p>

          <button
            onClick={runHisTest}
            disabled={testingHis}
            className="py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-auto"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{testingHis ? 'Pushing FHIR Bundle...' : 'Simulate FHIR EMR Sync'}</span>
          </button>

          {hisResult && (
            <div className="bg-slate-900 text-purple-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
              <pre>{JSON.stringify(hisResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
