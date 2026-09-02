import React, { useState, useEffect, useMemo } from 'react';
import { 
  Stethoscope, Users, CheckCircle2, AlertTriangle, RefreshCw, Clock, 
  FileText, Leaf, FlaskConical, Pill, AlertCircle, X, ChevronRight, 
  Activity, HeartPulse, Edit3, Check, ThumbsUp, ThumbsDown, Copy, 
  Sparkles, ShieldAlert, Award, FileCheck, CheckCheck, Code2, Send,
  Layers, Database, ArrowRight, ShieldCheck, UserCheck
} from 'lucide-react';
import { compileClinicalDossier } from '../services/clinicalSummaryGenerator.js';
import { convertSessionToFhirR4Bundle } from '../services/fhirGenerator.js';
import { pushFhirToHospitalEmr } from '../services/abdmService.js';
import { getLabFlagBadgeClass } from '../services/docAiService.js';

export default function DoctorDashboard() {
  const [sessionsData, setSessionsData] = useState({ sessions: [], redFlags: [] });
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Editable sections dictionary mapped by sessionId -> array of sections
  const [sessionSectionsMap, setSessionSectionsMap] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // FHIR Modal State
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [fhirTab, setFhirTab] = useState('bundle');
  const [fhirCopyFeedback, setFhirCopyFeedback] = useState(false);

  // EMR Push State
  const [isPushingEmr, setIsPushingEmr] = useState(false);
  const [emrPushSuccess, setEmrPushSuccess] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessionsData(data);

        if (!selectedSessionId && data.sessions && data.sessions.length > 0) {
          const firstRed = data.sessions.find(s => s.redFlagsTriggered && s.redFlagsTriggered.length > 0);
          setSelectedSessionId(firstRed ? firstRed.id : data.sessions[0].id);
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

  // Sort sessions: Red Flags prioritized to top in red, then by recent timestamp
  const sortedSessions = useMemo(() => {
    if (!sessionsData.sessions) return [];
    return [...sessionsData.sessions].sort((a, b) => {
      const aIsRed = a.redFlagsTriggered && a.redFlagsTriggered.length > 0 ? 1 : 0;
      const bIsRed = b.redFlagsTriggered && b.redFlagsTriggered.length > 0 ? 1 : 0;
      if (aIsRed !== bIsRed) return bIsRed - aIsRed;
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });
  }, [sessionsData.sessions]);

  const currentSession = useMemo(() => {
    if (!selectedSessionId) return sortedSessions[0] || null;
    return sortedSessions.find((s) => s.id === selectedSessionId) || sortedSessions[0] || null;
  }, [selectedSessionId, sortedSessions]);

  // Generate FHIR R4 Bundle for current session
  const fhirBundle = useMemo(() => {
    if (!currentSession) return null;
    return convertSessionToFhirR4Bundle(currentSession);
  }, [currentSession]);

  // Filtered FHIR resource for modal tabs
  const activeFhirView = useMemo(() => {
    if (!fhirBundle) return null;
    if (fhirTab === 'bundle') return fhirBundle;
    
    const entries = fhirBundle.entry || [];
    if (fhirTab === 'composition') return entries.find(e => e.resource.resourceType === 'Composition')?.resource;
    if (fhirTab === 'patient') return entries.find(e => e.resource.resourceType === 'Patient')?.resource;
    if (fhirTab === 'condition') return entries.filter(e => e.resource.resourceType === 'Condition').map(e => e.resource);
    if (fhirTab === 'observation') return entries.filter(e => e.resource.resourceType === 'Observation').map(e => e.resource);
    if (fhirTab === 'medication') return entries.filter(e => e.resource.resourceType === 'MedicationStatement').map(e => e.resource);
    return fhirBundle;
  }, [fhirBundle, fhirTab]);

  useEffect(() => {
    if (!currentSession) return;
    if (!sessionSectionsMap[currentSession.id]) {
      const initialSections = compileClinicalDossier(currentSession);
      setSessionSectionsMap((prev) => ({
        ...prev,
        [currentSession.id]: initialSections
      }));
    }
  }, [currentSession, sessionSectionsMap]);

  const currentSections = sessionSectionsMap[currentSession?.id] || [];

  const updateSection = (sectionId, updaterFn) => {
    if (!currentSession) return;
    setSessionSectionsMap((prev) => {
      const sections = prev[currentSession.id] || [];
      const updated = sections.map((sec) => {
        if (sec.id === sectionId) return updaterFn(sec);
        return sec;
      });
      return { ...prev, [currentSession.id]: updated };
    });
  };

  const handleAcceptSection = (sec) => {
    updateSection(sec.id, (s) => ({
      ...s,
      status: 'accepted',
      isEditing: false,
      reviewedAt: new Date().toISOString()
    }));
    logAuditAction(currentSession.id, sec.id, 'ACCEPTED');
  };

  const handleAmendSection = (sec, newContent) => {
    updateSection(sec.id, (s) => ({
      ...s,
      content: newContent,
      status: 'amended',
      isEditing: false,
      reviewedAt: new Date().toISOString()
    }));
    logAuditAction(currentSession.id, sec.id, 'AMENDED');
  };

  const handleRejectSection = (sec) => {
    updateSection(sec.id, (s) => ({
      ...s,
      status: 'rejected',
      isEditing: false,
      reviewedAt: new Date().toISOString()
    }));
    logAuditAction(currentSession.id, sec.id, 'REJECTED');
  };

  const toggleEditSection = (sec) => {
    updateSection(sec.id, (s) => ({
      ...s,
      isEditing: !s.isEditing
    }));
  };

  const handleAcceptAllSections = () => {
    if (!currentSession) return;
    setSessionSectionsMap((prev) => {
      const sections = prev[currentSession.id] || [];
      const updated = sections.map((sec) => ({
        ...sec,
        status: sec.status === 'amended' ? 'amended' : 'accepted',
        isEditing: false,
        reviewedAt: new Date().toISOString()
      }));
      return { ...prev, [currentSession.id]: updated };
    });
    logAuditAction(currentSession.id, 'ALL_SECTIONS', 'ACCEPTED_ALL');
  };

  const logAuditAction = (sessionId, sectionId, action) => {
    setAuditLog((prev) => [
      { id: `audit_${Date.now()}_${Math.random()}`, sessionId, sectionId, action, timestamp: new Date().toISOString() },
      ...prev
    ]);
  };

  // Physician Acceptance Rate Demo Metric
  const metrics = useMemo(() => {
    let accepted = 0;
    let amended = 0;
    let rejected = 0;
    let pending = 0;

    Object.values(sessionSectionsMap).forEach((sections) => {
      sections.forEach((sec) => {
        if (sec.status === 'accepted') accepted++;
        else if (sec.status === 'amended') amended++;
        else if (sec.status === 'rejected') rejected++;
        else pending++;
      });
    });

    const totalReviewed = accepted + amended + rejected;
    const acceptanceRate = totalReviewed > 0 
      ? Math.round(((accepted + (amended * 0.8)) / totalReviewed) * 100) 
      : 96;

    return { accepted, amended, rejected, pending, totalReviewed, acceptanceRate };
  }, [sessionSectionsMap]);

  const handleCopyNote = () => {
    if (!currentSections || currentSections.length === 0) return;
    const cleanNote = currentSections
      .filter((s) => s.status !== 'rejected')
      .map((s) => `[${s.title.toUpperCase()}]\n${s.content}`)
      .join('\n\n');

    navigator.clipboard.writeText(cleanNote);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleCopyFhirJson = () => {
    if (!fhirBundle) return;
    navigator.clipboard.writeText(JSON.stringify(activeFhirView, null, 2));
    setFhirCopyFeedback(true);
    setTimeout(() => setFhirCopyFeedback(false), 2000);
  };

  // Send to EMR Action (POST /api/his/push)
  const handleSendToEmr = async () => {
    if (!currentSession || isPushingEmr) return;
    setIsPushingEmr(true);
    setEmrPushSuccess(null);

    try {
      const res = await pushFhirToHospitalEmr({
        sessionId: currentSession.id,
        tokenNumber: currentSession.tokenNumber,
        fhirBundle
      });
      setEmrPushSuccess(res);
    } catch (err) {
      console.error('Failed to push to EMR:', err);
    } finally {
      setIsPushingEmr(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6 select-none font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-sm">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Physician Review Dashboard</h1>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5" /> FHIR R4 & ABDM Ready
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium">Dr. Sunita Rao (MD, General & Integrated Medicine) • Room 104</p>
          </div>
        </div>

        {/* Global Acceptance Rate & Actions */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Acceptance Rate</span>
              <span className="text-sm font-black text-amber-400 font-mono leading-tight">{metrics.acceptanceRate}%</span>
            </div>
          </div>

          <button
            onClick={fetchSessions}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="Refresh patient queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {/* Main Grid: Left Session List (1 col) + Right Clinical Review Workspace (2 cols) */}
      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ========================================================================= */}
        {/* 1. COMPLETED PATIENT SESSIONS LIST (RED FLAGS AT TOP IN RED)               */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 h-fit max-h-[850px]">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Patient Queue ({sortedSessions.length})
            </h3>
            <span className="text-[11px] font-bold text-slate-500">Sorted by Priority</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-[750px]">
            {sortedSessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-medium">
                No patient sessions recorded yet.<br />
                Perform a check-in at <span className="font-mono text-blue-600">/kiosk</span> to view live records.
              </div>
            ) : (
              sortedSessions.map((sess) => {
                const isSelected = currentSession?.id === sess.id;
                const isRedFlag = sess.redFlagsTriggered && sess.redFlagsTriggered.length > 0;
                const isAyush = !!sess.ayushAssessment || sess.complaintId === 'ayush_consultation';
                const hasDoc = !!sess.digitizedDocument;

                return (
                  <button
                    key={sess.id}
                    onClick={() => { setSelectedSessionId(sess.id); setEmrPushSuccess(null); }}
                    className={`w-full p-3.5 rounded-xl text-left border-2 transition-all cursor-pointer flex flex-col gap-1.5 relative ${
                      isRedFlag
                        ? isSelected
                          ? 'border-red-600 bg-red-50 text-red-950 shadow-md ring-2 ring-red-400'
                          : 'border-red-300 bg-red-50/60 hover:bg-red-50 text-red-900'
                        : isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-slate-900 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-black text-sm px-2 py-0.5 rounded ${
                          isRedFlag ? 'bg-red-600 text-white' : 'bg-blue-700 text-white'
                        }`}>
                          {sess.tokenNumber}
                        </span>
                        {isRedFlag && (
                          <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> TRIAGE ALERT
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {sess.submittedAt ? new Date(sess.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                      </span>
                    </div>

                    <div className="text-xs font-extrabold line-clamp-1 mt-0.5">
                      {sess.complaintTitle}
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                      <span>{sess.patientDetails?.name || 'Ramesh Chandra Sharma'}</span>
                      <div className="flex items-center gap-1">
                        {isAyush && (
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                            AYUSH
                          </span>
                        )}
                        {hasDoc && (
                          <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                            OCR Doc
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CLINICAL SUMMARY & INLINE PHYSICIAN REVIEW WORKSPACE (2 COLS)          */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {currentSession ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
              
              {/* PROMINENT RED BANNER FOR ACTIVE RED-FLAGS */}
              {currentSession.redFlagsTriggered && currentSession.redFlagsTriggered.length > 0 && (
                <div className="bg-red-600 text-white p-4 rounded-2xl shadow-lg border-2 border-red-700 flex items-start gap-4 animate-pulse">
                  <div className="p-2.5 bg-white/20 rounded-xl flex-shrink-0">
                    <ShieldAlert className="w-8 h-8 text-amber-300" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded uppercase">
                        CRITICAL TRIAGE RED FLAG DETECTED
                      </span>
                      <span className="text-xs text-red-100 font-semibold">Immediate Physician Review Required</span>
                    </div>
                    <div className="text-base font-black text-white mt-1.5">
                      {currentSession.redFlagsTriggered.join(' • ')}
                    </div>
                    <p className="text-xs text-red-100 mt-0.5">
                      Patient identified high-acuity warning signs. Nursing triage has been alerted.
                    </p>
                  </div>
                </div>
              )}

              {/* SUCCESS TOAST FOR EMR PUSH */}
              {emrPushSuccess && (
                <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md border-2 border-emerald-700 flex items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider bg-emerald-800 px-2 py-0.5 rounded">
                        EMR Sync Confirmed • Sandbox
                      </span>
                      <p className="text-sm font-bold mt-0.5">
                        Record #{emrPushSuccess.emrRecordId} committed to Hospital Information System
                      </p>
                      <span className="text-xs text-emerald-100 font-mono">
                        Synced At: {new Date(emrPushSuccess.syncedAt).toLocaleTimeString()} ({emrPushSuccess.receipt?.resourceCount} FHIR resources)
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setEmrPushSuccess(null)} className="text-emerald-200 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Patient Header Bar & Rapid Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-blue-700 text-white rounded-lg text-sm font-black font-mono shadow-sm">
                      Token {currentSession.tokenNumber}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                      ABHA: {currentSession.patientDetails?.abhaNumber || '91-8472-1029-4821'}
                    </span>
                    {currentSession.ayushAssessment && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md border border-emerald-200 flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5 text-emerald-700" /> AYUSH Intake
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mt-2">
                    {currentSession.patientDetails?.name || 'Ramesh Chandra Sharma'}
                  </h2>
                  <p className="text-slate-500 text-xs font-semibold mt-0.5">
                    Age: {currentSession.patientDetails?.age || 68} Y • Gender: {currentSession.patientDetails?.gender || 'Male'} • Language: {currentSession.language || 'English'}
                  </p>
                </div>

                {/* 10-Second Action Toolbar (FHIR Bundle + EMR Push + Approve All) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowFhirModal(true)}
                    className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 text-xs font-extrabold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Inspect HL7 FHIR R4 Bundle"
                  >
                    <Code2 className="w-4 h-4 text-purple-700" /> View FHIR Bundle
                  </button>

                  <button
                    onClick={handleSendToEmr}
                    disabled={isPushingEmr}
                    className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-extrabold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Send FHIR payload to Hospital EMR"
                  >
                    <Send className={`w-4 h-4 text-blue-700 ${isPushingEmr ? 'animate-spin' : ''}`} />
                    {isPushingEmr ? 'Pushing to EMR...' : 'Send to EMR'}
                  </button>

                  <button
                    onClick={handleAcceptAllSections}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Accept all draft sections in 1 click"
                  >
                    <CheckCheck className="w-4 h-4" /> Accept All
                  </button>

                  <button
                    onClick={handleCopyNote}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Copy EHR ready clinical note"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copyFeedback ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Patient Vitals Quick Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Blood Pressure</span>
                  <strong className="text-sm text-slate-900 font-mono">138/86 <span className="text-[10px] text-slate-500 font-normal">mmHg</span></strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Heart Rate</span>
                  <strong className="text-sm text-slate-900 font-mono">74 <span className="text-[10px] text-slate-500 font-normal">bpm</span></strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">SpO2</span>
                  <strong className="text-sm text-slate-900 font-mono">97%</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Temperature</span>
                  <strong className="text-sm text-slate-900 font-mono">98.4 <span className="text-[10px] text-slate-500 font-normal">°F</span></strong>
                </div>
              </div>

              {/* =================================================================== */}
              {/* COMPILED CLINICAL SUMMARY SECTIONS (EDITABLE INLINE)                */}
              {/* =================================================================== */}
              <div className="space-y-4">
                {currentSections.map((sec) => {
                  const isAccepted = sec.status === 'accepted';
                  const isAmended = sec.status === 'amended';
                  const isRejected = sec.status === 'rejected';

                  return (
                    <div
                      key={sec.id}
                      className={`border-2 rounded-2xl p-5 transition-all ${
                        sec.isAyush
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : isRejected
                            ? 'border-red-200 bg-red-50/30 opacity-70'
                            : isAmended
                              ? 'border-amber-300 bg-amber-50/30 shadow-sm'
                              : isAccepted
                                ? 'border-slate-200 bg-white shadow-sm'
                                : 'border-blue-200 bg-blue-50/20'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-black font-mono ${
                            sec.isAyush ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'
                          }`}>
                            {sec.shortCode}
                          </span>
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {sec.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                            isAccepted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isAmended
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isRejected
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {isAccepted ? '✓ Accepted' : isAmended ? '✎ Amended' : isRejected ? '✕ Rejected' : '⏳ Pending'}
                          </span>

                          <button
                            onClick={() => handleAcceptSection(sec)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                              isAccepted 
                                ? 'bg-emerald-700 text-white' 
                                : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200'
                            }`}
                            title="Accept section"
                          >
                            <ThumbsUp className="w-3 h-3" /> Accept
                          </button>

                          <button
                            onClick={() => toggleEditSection(sec)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                              sec.isEditing
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200'
                            }`}
                            title="Edit text inline"
                          >
                            <Edit3 className="w-3 h-3" /> {sec.isEditing ? 'Close' : 'Amend'}
                          </button>

                          <button
                            onClick={() => handleRejectSection(sec)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                              isRejected 
                                ? 'bg-red-700 text-white' 
                                : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200'
                            }`}
                            title="Reject section"
                          >
                            <ThumbsDown className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        {sec.isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              id={`textarea-${sec.id}`}
                              defaultValue={sec.content}
                              rows={4}
                              className="w-full p-3 text-xs font-sans text-slate-900 bg-white border-2 border-amber-400 rounded-xl focus:outline-none font-medium"
                              placeholder="Edit clinical text..."
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => toggleEditSection(sec)}
                                className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  const textEl = document.getElementById(`textarea-${sec.id}`);
                                  handleAmendSection(sec, textEl?.value || sec.content);
                                }}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                              >
                                Save Amendment
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                            {sec.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Sign-off Bar */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-xs text-slate-500 font-semibold">
                  EHR Note generated for Token <strong>{currentSession.tokenNumber}</strong>. Ready for EMR sync & prescription sign-off.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert(`Calling Patient Token ${currentSession.tokenNumber} to Room 104!`)}
                    className="px-5 py-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold rounded-xl shadow-sm cursor-pointer transition-all"
                  >
                    📢 Call Patient
                  </button>

                  <button
                    onClick={handleSendToEmr}
                    className="px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" /> Finalize & Push to EMR
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm text-slate-500">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Patient Selected</h3>
              <p className="text-xs mt-1">Select a patient token from the left queue to review their clinical dossier.</p>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. FHIR R4 RESOURCE VIEWER MODAL                                          */}
      {/* ========================================================================= */}
      {showFhirModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600 rounded-xl">
                  <Code2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">HL7 FHIR R4 Clinical Document Bundle</h3>
                    <span className="bg-purple-500/30 text-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-purple-400/30">
                      SANDBOX MODE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Bundle ID: {fhirBundle?.identifier?.value} • Profile: OPConsultRecord
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyFhirJson}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" /> {fhirCopyFeedback ? 'Copied JSON!' : 'Copy JSON'}
                </button>
                <button
                  onClick={() => setShowFhirModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Resource Filter Tabs */}
            <div className="bg-slate-100 px-5 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 text-xs font-bold">
              {[
                { id: 'bundle', label: 'Full Document Bundle' },
                { id: 'composition', label: 'Composition' },
                { id: 'patient', label: 'Patient (ABHA)' },
                { id: 'condition', label: 'Condition (SNOMED)' },
                { id: 'observation', label: 'Observation (LOINC)' },
                { id: 'medication', label: 'MedicationStatement' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFhirTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    fhirTab === tab.id
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Code Viewer Box */}
            <div className="p-5 flex-1 overflow-y-auto bg-slate-950 font-mono text-xs text-emerald-400 leading-relaxed max-h-[60vh]">
              <pre className="whitespace-pre-wrap">{JSON.stringify(activeFhirView, null, 2)}</pre>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Standard: HL7 FHIR Release 4 • India ABDM OPConsultRecord Specification</span>
              <button
                onClick={() => setShowFhirModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
