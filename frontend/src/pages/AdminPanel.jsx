import React, { useState, useEffect } from 'react';
import { Settings, Server, RefreshCw, Database, Activity, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminPanel() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex justify-between items-center border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2.5 rounded-xl text-white">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">MediKiosk Admin & Control Panel</h1>
            <p className="text-slate-400 text-xs">System Status, Mock API Controls & Demo Simulations</p>
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
                <p className="text-xs text-slate-500">Testing CORS & Express Endpoint <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-purple-700 font-semibold">http://localhost:3000/api/health</span></p>
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
                <p className="text-xs mt-1 text-red-700">Make sure the Express server is running on port 3000 (<span className="font-mono font-bold">cd backend && npm start</span>).</p>
              </div>
            </div>
          ) : healthStatus ? (
            <div className="p-4 bg-emerald-50/60 border border-emerald-300 rounded-xl text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="w-full">
                <div className="flex justify-between items-center mb-1.5">
                  <h3 className="text-sm font-bold text-slate-900">Backend Server Connected Successfully</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-200">
                    Status: {healthStatus.status}
                  </span>
                </div>
                <div className="bg-white/90 p-3 rounded-lg border border-emerald-200/60 font-mono text-xs text-slate-700 space-y-0.5">
                  <div><strong className="text-slate-900">Service:</strong> {healthStatus.service}</div>
                  <div><strong className="text-slate-900">Timestamp:</strong> {healthStatus.timestamp}</div>
                  <div><strong className="text-slate-900">Uptime:</strong> {healthStatus.uptime?.toFixed(2)} seconds</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mock Data Inspector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Database className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="text-base font-bold text-slate-900">patientSessions.json</h3>
            <p className="text-slate-500 text-xs mt-0.5">Simulated check-in records & vitals logs</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Activity className="w-6 h-6 text-emerald-600 mb-2" />
            <h3 className="text-base font-bold text-slate-900">abdmResponses.json</h3>
            <p className="text-slate-500 text-xs mt-0.5">ABHA verification & health record payloads</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Server className="w-6 h-6 text-purple-600 mb-2" />
            <h3 className="text-base font-bold text-slate-900">hisResponses.json</h3>
            <p className="text-slate-500 text-xs mt-0.5">Hospital Information System queue sync</p>
          </div>
        </div>
      </main>
    </div>
  );
}
