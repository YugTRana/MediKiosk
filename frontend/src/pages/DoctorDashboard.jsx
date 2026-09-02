import React, { useState, useEffect } from 'react';
import { Stethoscope, Users, CheckCircle2, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

export default function DoctorDashboard() {
  const [sessionsData, setSessionsData] = useState({ sessions: [], redFlags: [] });
  const [loading, setLoading] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessionsData(data);
      }
    } catch (err) {
      console.warn('[DoctorDashboard] Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex justify-between items-center border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Physician OPD Dashboard</h1>
            <p className="text-slate-400 text-xs">Dr. Sunita Rao • General Medicine (Room 104)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> OPD Live
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Triage Red Flags & Active Patient */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Active Red Flags Alert Banner */}
          {sessionsData.redFlags && sessionsData.redFlags.length > 0 && (
            <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-red-900 font-bold text-base mb-3">
                <AlertTriangle className="w-6 h-6 text-red-600 animate-bounce" />
                <span>Active Triage Red Flags ({sessionsData.redFlags.length})</span>
              </div>
              <div className="space-y-2">
                {sessionsData.redFlags.map((rf) => (
                  <div key={rf.id} className="bg-white p-3.5 rounded-xl border border-red-200 text-xs text-slate-800">
                    <div className="flex justify-between font-bold text-red-700 mb-1">
                      <span>Session ID: {rf.sessionId}</span>
                      <span>{new Date(rf.loggedAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="font-semibold text-slate-900">{rf.triggerReason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Patient Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-bold uppercase border border-blue-200">
                  Serving Token #A-12
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-2">Ramesh Chandra Sharma</h2>
                <p className="text-slate-500 text-sm font-medium">Male, 68 Years • ABHA: 91-8472-1029-4821</p>
              </div>
              <span className="bg-emerald-50 text-emerald-800 font-semibold px-3 py-1 rounded-lg text-xs border border-emerald-200">
                Kiosk Vitals Logged
              </span>
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 font-bold text-xs uppercase block">BP</span>
                <span className="text-lg font-extrabold text-slate-900">138/86 <span className="text-xs font-normal text-slate-500">mmHg</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 font-bold text-xs uppercase block">HEART RATE</span>
                <span className="text-lg font-extrabold text-slate-900">74 <span className="text-xs font-normal text-slate-500">bpm</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 font-bold text-xs uppercase block">SPO2</span>
                <span className="text-lg font-extrabold text-slate-900">97%</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 font-bold text-xs uppercase block">TEMP</span>
                <span className="text-lg font-extrabold text-slate-900">98.4 <span className="text-xs font-normal text-slate-500">°F</span></span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button className="px-5 py-2.5 bg-blue-700 text-white text-sm font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-sm">
                Open EHR / ABDM Records
              </button>
              <button className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-300">
                Call Next Patient
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Submitted Kiosk Sessions Queue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Kiosk Queue
            </h3>
            <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full font-bold text-xs border border-blue-200">
              {sessionsData.sessions.length} Live Sessions
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {sessionsData.sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No submitted kiosk sessions yet.<br />Complete a kiosk check-in to view queue records.
              </div>
            ) : (
              sessionsData.sessions.map((sess) => (
                <div key={sess.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex justify-between font-bold text-sm text-slate-900">
                    <span className="text-blue-700 font-mono">{sess.tokenNumber}</span>
                    <span className="text-xs text-slate-400 font-normal">{new Date(sess.submittedAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">{sess.complaintTitle}</p>
                  <p className="text-xs text-slate-500">{sess.answers.length} SOCRATES answers logged</p>
                  {sess.redFlagsTriggered.length > 0 && (
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 font-bold text-[10px] rounded mt-1">
                      ⚠️ RED FLAG TRIAGE
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
