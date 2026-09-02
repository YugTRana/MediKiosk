import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, Users, CheckCircle2, AlertTriangle, RefreshCw, Clock, 
  FileText, Leaf, FlaskConical, Pill, AlertCircle, X, ChevronRight, Activity, HeartPulse
} from 'lucide-react';
import { getLabFlagBadgeClass } from '../services/docAiService.js';

export default function DoctorDashboard() {
  const [sessionsData, setSessionsData] = useState({ sessions: [], redFlags: [] });
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessionsData(data);
        // Default to first session if none selected
        if (!selectedSession && data.sessions && data.sessions.length > 0) {
          setSelectedSession(data.sessions[0]);
        }
      }
    } catch (err) {
      console.warn('[DoctorDashboard] Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6 select-none">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Physician OPD & Clinical Dossier</h1>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded text-xs font-semibold">
                Live Sync
              </span>
            </div>
            <p className="text-slate-400 text-xs">Dr. Sunita Rao • General & Integrated OPD (Room 104)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Queue
          </button>
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Users className="w-4 h-4" /> {sessionsData.sessions.length} In Queue
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Active Patient Clinical Dossier */}
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
                  <div key={rf.id} className="bg-white p-3.5 rounded-xl border border-red-200 text-xs text-slate-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-red-700 block">Session: {rf.sessionId}</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{rf.triggerReason}</p>
                    </div>
                    <span className="text-slate-400 text-[11px]">{new Date(rf.loggedAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Patient Dossier View */}
          {selectedSession ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-black font-mono shadow-sm">
                      {selectedSession.tokenNumber}
                    </span>
                    {selectedSession.ayushAssessment ? (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md border border-emerald-200 flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5 text-emerald-700" /> AYUSH OPD
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 text-xs font-bold rounded-md border border-blue-200">
                        Allopathic OPD
                      </span>
                    )}
                    {selectedSession.digitizedDocument && (
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-md border border-purple-200 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-purple-700" /> Digitized Doc
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mt-2">
                    {selectedSession.patientDetails?.name || 'Self Check-In Patient'}
                  </h2>
                  <p className="text-slate-500 text-xs font-medium mt-0.5">
                    Age: {selectedSession.patientDetails?.age || 45} • Gender: {selectedSession.patientDetails?.gender || 'Unspecified'} • Submitted: {new Date(selectedSession.submittedAt).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    selectedSession.status === 'TRIAGE_URGENT'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedSession.status === 'TRIAGE_URGENT' ? '⚠️ Urgent Triage' : 'Waiting for Consultation'}
                  </span>
                </div>
              </div>

              {/* Chief Complaint Focus */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Main Health Concern:</span>
                <span className="text-base font-extrabold text-slate-900 block mt-0.5">{selectedSession.complaintTitle}</span>
              </div>

              {/* FEATURE 1 DISPLAY: DIGITIZED PREVIOUS PRESCRIPTION & LAB REPORT */}
              {selectedSession.digitizedDocument && (
                <div className="bg-purple-50/50 border-2 border-purple-200 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-purple-950">Digitized Previous Medical Records (AI OCR)</h3>
                        <p className="text-[11px] text-purple-700 font-medium">
                          {selectedSession.digitizedDocument.documentTitle} • Date: {selectedSession.digitizedDocument.date}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-purple-200/70 text-purple-900 px-2 py-0.5 rounded">
                      Confidence 96%
                    </span>
                  </div>

                  {/* Diagnoses */}
                  {selectedSession.digitizedDocument.diagnoses && selectedSession.digitizedDocument.diagnoses.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-purple-900 uppercase block mb-1">Previous Diagnoses:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSession.digitizedDocument.diagnoses.map((d, i) => (
                          <span key={i} className="px-2.5 py-0.5 bg-white border border-purple-200 rounded-md text-xs font-bold text-purple-950">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medications List */}
                  {selectedSession.digitizedDocument.medications && selectedSession.digitizedDocument.medications.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-purple-900 uppercase block mb-2 flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5 text-purple-700" /> Active Medications Extracted:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedSession.digitizedDocument.medications.map((m, i) => (
                          <div key={i} className="bg-white border border-purple-100 p-2.5 rounded-lg text-xs">
                            <strong className="text-slate-900 block">{m.name} {m.dose}</strong>
                            <span className="text-slate-500">{m.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lab Values Table with Red/Orange Flags */}
                  {selectedSession.digitizedDocument.labValues && selectedSession.digitizedDocument.labValues.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-purple-900 uppercase block mb-2 flex items-center gap-1">
                        <FlaskConical className="w-3.5 h-3.5 text-purple-700" /> Extracted Lab Tests & Clinical Flags:
                      </span>
                      <div className="bg-white border border-purple-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-purple-100/60 text-purple-900 font-bold border-b border-purple-200">
                            <tr>
                              <th className="p-2.5">Test Name</th>
                              <th className="p-2.5">Extracted Value</th>
                              <th className="p-2.5 hidden sm:table-cell">Reference Range</th>
                              <th className="p-2.5 text-right">Flag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50">
                            {selectedSession.digitizedDocument.labValues.map((lab, i) => (
                              <tr key={i} className={lab.flag === 'HIGH' ? 'bg-red-50/70' : lab.flag === 'LOW' ? 'bg-amber-50/60' : ''}>
                                <td className="p-2.5 font-bold text-slate-900">{lab.test}</td>
                                <td className="p-2.5 font-extrabold text-slate-800">{lab.value} {lab.unit}</td>
                                <td className="p-2.5 text-slate-500 hidden sm:table-cell">{lab.referenceRange} {lab.unit}</td>
                                <td className="p-2.5 text-right">
                                  <span className={getLabFlagBadgeClass(lab.flag)}>
                                    {lab.flag}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FEATURE 2 DISPLAY: AYUSH DASHAVIDHA PARIKSHA FINDINGS */}
              {selectedSession.ayushAssessment && (
                <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-emerald-200 pb-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg">
                      <Leaf className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-emerald-950">AYUSH Dashavidha Pariksha Clinical Findings</h3>
                      <p className="text-[11px] text-emerald-800 font-medium">Ayurvedic constitution & lifestyle evaluation</p>
                    </div>
                  </div>

                  {/* Summary Callout */}
                  <div className="p-3 bg-white border border-emerald-200 rounded-xl text-xs">
                    <span className="text-xs font-bold text-emerald-900 uppercase block mb-1">Clinical Assessment Summary:</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {selectedSession.ayushAssessment.ayurvedicSummary}
                    </p>
                  </div>

                  {/* 4 Pillars Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white border border-emerald-100 p-3 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase block">1. Prakriti (Constitution)</span>
                      <strong className="text-xs text-slate-900 block mt-1">
                        {selectedSession.ayushAssessment.prakriti?.labelEn || selectedSession.ayushAssessment.prakriti?.labelHi}
                      </strong>
                    </div>

                    <div className="bg-white border border-emerald-100 p-3 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase block">2. Agni (Digestive Fire)</span>
                      <strong className="text-xs text-slate-900 block mt-1">
                        {selectedSession.ayushAssessment.agni?.labelEn || selectedSession.ayushAssessment.agni?.labelHi}
                      </strong>
                    </div>

                    <div className="bg-white border border-emerald-100 p-3 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase block">3. Koshtha (Elimination)</span>
                      <strong className="text-xs text-slate-900 block mt-1">
                        {selectedSession.ayushAssessment.koshtha?.labelEn || selectedSession.ayushAssessment.koshtha?.labelHi}
                      </strong>
                    </div>

                    <div className="bg-white border border-emerald-100 p-3 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase block">4. Ahara-Vihara (Diet & Habits)</span>
                      <strong className="text-xs text-slate-900 block mt-1">
                        {selectedSession.ayushAssessment.aharaVihara?.labelEn || selectedSession.ayushAssessment.aharaVihara?.labelHi}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Allopathic SOCRATES Q&A History */}
              {selectedSession.answers && selectedSession.answers.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                    Patient Intake Q&A History ({selectedSession.answers.length} Responses):
                  </span>
                  <div className="space-y-2.5">
                    {selectedSession.answers.map((ans, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-blue-700 uppercase text-[11px]">{ans.dimension}</span>
                          <span className="text-slate-400 text-[10px]">{new Date(ans.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="font-semibold text-slate-800">{ans.questionText}</p>
                        <div className="mt-1.5 p-2 bg-white rounded-lg border border-slate-200 font-bold text-slate-900">
                          {ans.selectedOption?.labelEn || ans.selectedOption?.labelHi || ans.customVoiceText || 'Option selected'}
                          {ans.customVoiceText && (
                            <span className="ml-2 text-xs font-normal text-slate-500 italic">(via voice recording)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consultation Action Controls */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => alert(`Calling Patient Token ${selectedSession.tokenNumber} to Room 104!`)}
                  className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  📢 Call Patient to Room 104
                </button>
                <button 
                  onClick={() => alert(`Prescription & EHR updated for Token ${selectedSession.tokenNumber}`)}
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  ✍️ Complete & Issue Prescription
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm text-slate-500">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Patient Selected</h3>
              <p className="text-xs mt-1">Select a patient token from the queue on the right to inspect clinical records.</p>
            </div>
          )}
        </div>

        {/* Right Column: Live Kiosk Patient Queue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Patient Queue
            </h3>
            <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full font-bold text-xs border border-blue-200">
              {sessionsData.sessions.length} Live
            </span>
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
            {sessionsData.sessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-medium">
                No active kiosk check-ins in queue.<br />
                Perform a check-in at <span className="font-mono text-blue-600">/kiosk</span> to view live tokens here.
              </div>
            ) : (
              sessionsData.sessions.map((sess) => {
                const isSelected = selectedSession?.id === sess.id;
                const isAyush = !!sess.ayushAssessment;
                const hasDoc = !!sess.digitizedDocument;
                const isRedFlag = sess.redFlagsTriggered && sess.redFlagsTriggered.length > 0;

                return (
                  <button
                    key={sess.id}
                    onClick={() => setSelectedSession(sess)}
                    className={`w-full p-4 rounded-xl text-left border-2 transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-black text-base font-mono text-blue-800">{sess.tokenNumber}</span>
                      <span className="text-[11px] text-slate-400">{new Date(sess.submittedAt).toLocaleTimeString()}</span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {sess.complaintTitle}
                    </div>

                    {/* Tag Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {isAyush && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded flex items-center gap-1">
                          <Leaf className="w-3 h-3 text-emerald-700" /> AYUSH
                        </span>
                      )}
                      {hasDoc && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded flex items-center gap-1">
                          <FileText className="w-3 h-3 text-purple-700" /> Doc Attached
                        </span>
                      )}
                      {isRedFlag && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-extrabold rounded">
                          ⚠️ RED FLAG
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
