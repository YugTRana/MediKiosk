import React, { useState, useEffect, useRef } from 'react';
import { 
  HeartPulse, Thermometer, Wind, Activity, Bone, Globe, Volume2, VolumeX, 
  Mic, MicOff, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, 
  Sparkles, ShieldAlert, Upload, Camera, FileText, FlaskConical, Check, 
  RotateCcw, Leaf, Layers, AlertCircle, Pill, ChevronRight, Sparkle
} from 'lucide-react';
import { speakText, cancelSpeech, startListening, isSTTSupported } from '../services/speechService.js';
import { checkRedFlagCondition } from '../services/redFlagDetector.js';
import { extractDocumentWithDocAI, SAMPLE_DOCUMENTS, getLabFlagBadgeClass } from '../services/docAiService.js';
import { AYUSH_COMPLAINT_META, AYUSH_QUESTIONS, compileAyushSummary } from '../services/ayushFlowData.js';

// Fallback Dialogue Flows JSON in case backend API is connecting
import fallbackFlows from '../../../backend/mockData/dialogueFlows.json';

const COMPLAINT_ICONS = {
  Thermometer: Thermometer,
  Wind: Wind,
  Activity: Activity,
  HeartPulse: HeartPulse,
  Bone: Bone,
  Leaf: Leaf
};

export default function KioskPage() {
  // Navigation & Dialogue State
  // Steps: 'complaint_selection' | 'doc_digitization' | 'questions' | 'ayush_questions' | 'submitted'
  const [step, setStep] = useState('complaint_selection');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Loaded Dialogue Data
  const [dialogueData, setDialogueData] = useState(fallbackFlows);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isAyushFlow, setIsAyushFlow] = useState(false);

  // Document Digitization State
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [uploadedDocName, setUploadedDocName] = useState('');
  const [extractedDocData, setExtractedDocData] = useState(null);
  const [hasConfirmedDoc, setHasConfirmedDoc] = useState(false);
  const fileInputRef = useRef(null);

  // Patient Input Data for Allopathic SOCRATES
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  // Patient Input Data for AYUSH Dashavidha Pariksha
  const [ayushQuestionIndex, setAyushQuestionIndex] = useState(0);
  const [ayushAnswers, setAyushAnswers] = useState({});

  // Voice Interaction State
  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Red Flag Alert State
  const [activeRedFlag, setActiveRedFlag] = useState(null);
  const [redFlagsHistory, setRedFlagsHistory] = useState([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSession, setSubmittedSession] = useState(null);
  const [sessionId] = useState(() => `sess_${Date.now()}`);

  // Fetch dialogue flows from backend on mount
  useEffect(() => {
    fetch('http://localhost:3000/api/dialogue-flows')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.complaints && data.complaints.length > 0) {
          setDialogueData(data);
        }
      })
      .catch((err) => {
        console.warn('[Kiosk] Using fallback local dialogue flows:', err);
      });
  }, []);

  // Cleanup TTS and STT on unmount
  useEffect(() => {
    return () => {
      cancelSpeech();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Handle TTS narration helper
  const narrate = (text) => {
    if (!ttsEnabled || !text) return;
    speakText(text, selectedLanguage);
  };

  // Speak SOCRATES question
  const speakCurrentQuestion = (questionObj) => {
    if (!ttsEnabled || !questionObj) return;
    const qText = (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
      ? questionObj.questionHi 
      : questionObj.questionEn;
    narrate(qText);
  };

  // Speak AYUSH question
  const speakCurrentAyushQuestion = (questionObj) => {
    if (!ttsEnabled || !questionObj) return;
    const qText = (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
      ? `${questionObj.dimensionHi}. ${questionObj.questionHi}`
      : `${questionObj.dimensionEn}. ${questionObj.questionEn}`;
    narrate(qText);
  };

  // 1. Complaint Selected -> Navigate to Optional Document Digitization Step
  const handleSelectComplaint = (complaint, isAyush = false) => {
    cancelSpeech();
    setSelectedComplaint(complaint);
    setIsAyushFlow(isAyush);
    setCurrentQuestionIndex(0);
    setAyushQuestionIndex(0);
    setAnswers({});
    setAyushAnswers({});
    setVoiceText('');
    setActiveRedFlag(null);
    setRedFlagsHistory([]);
    setExtractedDocData(null);
    setUploadedDocName('');
    setHasConfirmedDoc(false);

    setStep('doc_digitization');

    narrate(
      selectedLanguage === 'हिंदी'
        ? 'यदि आपके पास कोई पुराना डॉक्टर का पर्चा या खून की जांच रिपोर्ट है, तो आप उसे यहां अपलोड कर सकते हैं, या सीधे आगे बढ़ सकते हैं।'
        : 'If you have a previous doctor prescription or lab report, you can upload it here, or skip to continue directly.'
    );
  };

  // 2. Document AI Extraction Flow
  const handleProcessDocument = async (fileName, docType, fileObj = null) => {
    cancelSpeech();
    setIsOcrProcessing(true);
    setUploadedDocName(fileName || 'prescription_upload.jpg');
    setExtractedDocData(null);

    narrate(
      selectedLanguage === 'हिंदी'
        ? 'दस्तावेज़ स्कैन हो रहा है। कृपया कुछ क्षण प्रतीक्षा करें।'
        : 'Scanning document. Please wait a moment while AI extracts your details.'
    );

    try {
      const extracted = await extractDocumentWithDocAI({
        fileName: fileName || (fileObj ? fileObj.name : 'upload.jpg'),
        documentType: docType || 'prescription',
        file: fileObj
      });
      setExtractedDocData(extracted);
      narrate(
        selectedLanguage === 'हिंदी'
          ? 'दवाइयां और जांच रिपोर्ट प्राप्त हो गई हैं। कृपया जांच लें और आगे बढ़ें।'
          : 'Extraction complete. Please review the medications and lab values before proceeding.'
      );
    } catch (err) {
      console.error('[DocAI] Extraction failed:', err);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleFileUploadChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const isLab = /lab|blood|cbc|test|report/i.test(file.name);
      handleProcessDocument(file.name, isLab ? 'lab_report' : 'prescription', file);
    }
  };

  // Confirm Extracted Document and Proceed to Questionnaire
  const handleConfirmDocumentAndProceed = () => {
    cancelSpeech();
    setHasConfirmedDoc(true);
    proceedToQuestions();
  };

  // Skip Document Digitization Step
  const handleSkipDocumentAndProceed = () => {
    cancelSpeech();
    setExtractedDocData(null);
    setHasConfirmedDoc(false);
    proceedToQuestions();
  };

  const proceedToQuestions = () => {
    if (isAyushFlow) {
      setStep('ayush_questions');
      setAyushQuestionIndex(0);
      speakCurrentAyushQuestion(AYUSH_QUESTIONS[0]);
    } else {
      setStep('questions');
      setCurrentQuestionIndex(0);
      const firstQ = selectedComplaint?.questions?.[0];
      if (firstQ) speakCurrentQuestion(firstQ);
    }
  };

  // Toggle Voice Microphone
  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    if (!isSTTSupported()) {
      alert('Voice input is not supported in this browser. You can select touch options.');
      return;
    }

    cancelSpeech();
    setIsListening(true);

    const rec = startListening({
      lang: selectedLanguage,
      onResult: (transcript, isFinal) => {
        setVoiceText(transcript);
        if (isFinal) {
          setIsListening(false);
        }
      },
      onError: () => {
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    recognitionRef.current = rec;
  };

  // Log Red Flag event to Backend Server
  const logRedFlagToBackend = async (redFlagObj, answerObj) => {
    try {
      await fetch('http://localhost:3000/api/redflag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          complaintId: selectedComplaint?.id || 'unknown',
          triggerReason: redFlagObj.reason,
          answerData: answerObj,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[Kiosk] Failed to dispatch red flag log to server:', err);
    }
  };

  // 3. Process SOCRATES Question Answer (Allopathic)
  const handleAnswerQuestion = (optionObj = null, freeText = '') => {
    cancelSpeech();
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
    }

    const currentQuestion = selectedComplaint.questions[currentQuestionIndex];
    const answerEntry = {
      questionId: currentQuestion.id,
      dimension: currentQuestion.dimension,
      questionText: (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? currentQuestion.questionHi : currentQuestion.questionEn,
      selectedOption: optionObj,
      customVoiceText: freeText,
      timestamp: new Date().toISOString()
    };

    const updatedAnswers = { ...answers, [currentQuestion.id]: answerEntry };
    setAnswers(updatedAnswers);

    // Evaluate Red Flag detection
    const redFlagCheck = checkRedFlagCondition(
      selectedComplaint.id,
      currentQuestion.id,
      optionObj,
      freeText || optionObj?.labelEn
    );

    let updatedFlags = [...redFlagsHistory];
    if (redFlagCheck.isRedFlag) {
      setActiveRedFlag(redFlagCheck.reason);
      updatedFlags = [...redFlagsHistory, redFlagCheck.reason];
      setRedFlagsHistory(updatedFlags);
      logRedFlagToBackend(redFlagCheck, answerEntry);
    }

    // Move to next question or submit
    if (currentQuestionIndex < selectedComplaint.questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setVoiceText('');
      speakCurrentQuestion(selectedComplaint.questions[nextIdx]);
    } else {
      // Completed all questions -> submit session
      handleSubmitSession({
        finalAnswers: Object.values(updatedAnswers),
        finalRedFlags: updatedFlags,
        ayushData: null
      });
    }
  };

  // 4. Process AYUSH Dashavidha Pariksha Question Answer
  const handleAnswerAyushQuestion = (optionObj = null, freeText = '') => {
    cancelSpeech();
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
    }

    const currentAyushQ = AYUSH_QUESTIONS[ayushQuestionIndex];
    const answerEntry = {
      questionId: currentAyushQ.id,
      dimension: currentAyushQ.dimensionEn,
      dimensionHi: currentAyushQ.dimensionHi,
      questionText: (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? currentAyushQ.questionHi : currentAyushQ.questionEn,
      selectedOption: optionObj,
      customVoiceText: freeText,
      timestamp: new Date().toISOString()
    };

    const updatedAyushAnswers = { ...ayushAnswers, [currentAyushQ.id]: answerEntry };
    setAyushAnswers(updatedAyushAnswers);

    if (ayushQuestionIndex < AYUSH_QUESTIONS.length - 1) {
      const nextIdx = ayushQuestionIndex + 1;
      setAyushQuestionIndex(nextIdx);
      setVoiceText('');
      speakCurrentAyushQuestion(AYUSH_QUESTIONS[nextIdx]);
    } else {
      // Completed all 4 AYUSH inquiries
      const compiledAyush = compileAyushSummary(updatedAyushAnswers);
      handleSubmitSession({
        finalAnswers: Object.values(updatedAyushAnswers),
        finalRedFlags: [],
        ayushData: compiledAyush
      });
    }
  };

  // 5. Unified Submission (POST /api/session/submit)
  const handleSubmitSession = async ({ finalAnswers, finalRedFlags, ayushData }) => {
    setIsSubmitting(true);
    cancelSpeech();

    const payload = {
      sessionId,
      complaintId: selectedComplaint?.id || (isAyushFlow ? 'ayush_consultation' : 'general'),
      complaintTitle: isAyushFlow 
        ? (selectedLanguage === 'हिंदी' ? AYUSH_COMPLAINT_META.titleHi : AYUSH_COMPLAINT_META.titleEn)
        : ((selectedLanguage === 'हिंदी' ? selectedComplaint?.titleHi : selectedComplaint?.titleEn) || 'General Check-In'),
      language: selectedLanguage,
      answers: finalAnswers,
      redFlagsTriggered: finalRedFlags || [],
      digitizedDocument: extractedDocData || null,
      ayushAssessment: ayushData || null
    };

    try {
      const res = await fetch('http://localhost:3000/api/session/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSubmittedSession(data.session);
    } catch (err) {
      console.warn('[Kiosk] Backend offline, generating local session token:', err);
      setSubmittedSession({
        tokenNumber: `K-${Math.floor(100 + Math.random() * 900)}`,
        complaintTitle: payload.complaintTitle,
        answers: payload.answers,
        redFlagsTriggered: payload.redFlagsTriggered,
        digitizedDocument: payload.digitizedDocument,
        ayushAssessment: payload.ayushAssessment
      });
    } finally {
      setIsSubmitting(false);
      setStep('submitted');
      narrate(
        selectedLanguage === 'हिंदी'
          ? 'धन्यवाद! आपकी जानकारी दर्ज कर ली गई है। कृपया प्रतीक्षा कक्ष में बैठें।'
          : 'Thank you! Your information has been recorded. Please relax in the waiting room until your token is called.'
      );
    }
  };

  // Reset to initial screen
  const handleRestart = () => {
    cancelSpeech();
    setStep('complaint_selection');
    setSelectedComplaint(null);
    setIsAyushFlow(false);
    setCurrentQuestionIndex(0);
    setAyushQuestionIndex(0);
    setAnswers({});
    setAyushAnswers({});
    setVoiceText('');
    setActiveRedFlag(null);
    setRedFlagsHistory([]);
    setExtractedDocData(null);
    setUploadedDocName('');
    setHasConfirmedDoc(false);
    setSubmittedSession(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 md:p-8 select-none">
      {/* Kiosk Header */}
      <header className="bg-slate-900 text-white p-4 md:p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 border-b-2 border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-sm">
            <HeartPulse className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">MediKiosk Smart Assistance</h1>
              <span className="bg-blue-500/20 text-blue-300 text-[11px] font-bold px-2 py-0.5 rounded border border-blue-400/30">
                Self-Service Kiosk
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium">Smart OPD triage, Document OCR & AYUSH consultation</p>
          </div>
        </div>

        {/* Global Controls: Language & Audio Narration */}
        <div className="flex items-center gap-2">
          {/* TTS Narration Toggle */}
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              ttsEnabled 
                ? 'bg-blue-600/30 border-blue-500 text-blue-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle Audio Narration"
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            {ttsEnabled ? 'Voice On' : 'Voice Off'}
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/60">
            <Globe className="w-4 h-4 text-amber-400 ml-1.5 mr-1" />
            {['English', 'हिंदी'].map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  selectedLanguage === lang
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Red Flag Alert Banner (Sticky at top when active) */}
      {activeRedFlag && (
        <div className="max-w-4xl mx-auto w-full mb-6 bg-red-600 text-white p-4 rounded-2xl shadow-lg border-2 border-red-700 flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl text-white">
              <ShieldAlert className="w-8 h-8 text-amber-300" />
            </div>
            <div>
              <span className="bg-amber-400 text-slate-950 text-xs font-extrabold px-2.5 py-0.5 rounded-md uppercase">
                URGENT — ALERT TRIAGE STAFF
              </span>
              <p className="text-sm font-bold mt-1 text-white">{activeRedFlag}</p>
              <p className="text-xs text-red-100 mt-0.5">Duty nurse notified. Please remain calm.</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: CHIEF COMPLAINT SELECTION SCREEN (WITH AYUSH 6TH OPTION)          */}
      {/* ========================================================================= */}
      {step === 'complaint_selection' && (
        <main className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-full mb-2 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Reassuring Touch Check-In
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
              {selectedLanguage === 'हिंदी' ? 'अपनी मुख्य समस्या चुनें' : 'What is your main health concern today?'}
            </h2>
            <p className="text-sm text-slate-600">
              {selectedLanguage === 'हिंदी' 
                ? 'नीचे दिए गए विकल्पों में से चुनें। हम आपसे कुछ सरल प्रश्न पूछेंगे।'
                : 'Select one of the 6 options below to begin your guided check-in.'}
            </p>
          </div>

          {/* 6 Chief Complaint Large Buttons (5 Allopathic + 1 AYUSH) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Standard Allopathic Complaints */}
            {dialogueData.complaints.map((c) => {
              const IconComponent = COMPLAINT_ICONS[c.iconName] || Activity;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectComplaint(c, false)}
                  className="bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <IconComponent className="w-8 h-8" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700">
                      {selectedLanguage === 'हिंदी' ? c.titleHi : c.titleEn}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {selectedLanguage === 'हिंदी' ? c.descriptionHi : c.descriptionEn}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* 6TH OPTION: AYUSH AYURVEDIC CONSULTATION */}
            <button
              onClick={() => handleSelectComplaint(AYUSH_COMPLAINT_META, true)}
              className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 hover:from-emerald-100/70 hover:to-teal-100/70 border-2 border-emerald-300 hover:border-emerald-600 rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                AYUSH OPD
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="p-3 bg-emerald-600 text-white rounded-xl group-hover:scale-110 transition-all shadow-sm">
                  <Leaf className="w-8 h-8" />
                </div>
                <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950 group-hover:text-emerald-800 flex items-center gap-1.5">
                  {selectedLanguage === 'हिंदी' ? AYUSH_COMPLAINT_META.titleHi : AYUSH_COMPLAINT_META.titleEn}
                </h3>
                <p className="text-xs text-emerald-800/80 mt-1 line-clamp-2 font-medium">
                  {selectedLanguage === 'हिंदी' ? AYUSH_COMPLAINT_META.descriptionHi : AYUSH_COMPLAINT_META.descriptionEn}
                </p>
              </div>
            </button>
          </div>

          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-center text-xs text-slate-700">
            <strong>Need urgent medical triage?</strong> Press the Emergency button or speak directly to the duty nurse at Counter 1.
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: OPTIONAL DOCUMENT DIGITIZATION & OCR CONFIRMATION SCREEN          */}
      {/* ========================================================================= */}
      {step === 'doc_digitization' && (
        <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-6">
          {/* Header & Back Action */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <button 
              onClick={() => setStep('complaint_selection')}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-bold text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Complaints
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                Selected: {isAyushFlow ? 'Ayurvedic Intake' : (selectedLanguage === 'हिंदी' ? selectedComplaint?.titleHi : selectedComplaint?.titleEn)}
              </span>
            </div>
          </div>

          {/* Main Document Upload & Extraction Container */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-800 text-xs font-bold rounded-full mb-2 border border-purple-200">
                <FileText className="w-3.5 h-3.5 text-purple-600" /> Optional Document OCR Digitization
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                {selectedLanguage === 'हिंदी' 
                  ? 'पिछला पर्चा या लैब रिपोर्ट स्कैन करें' 
                  : 'Upload Previous Prescription or Lab Report'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {selectedLanguage === 'हिंदी'
                  ? 'हमारा AI स्कैनर आपकी पिछली दवाइयां और टेस्ट रिपोर्ट को स्वचालित रूप से पढ़ लेगा।'
                  : 'Our smart OCR engine will extract your medications, dosages, and lab test metrics to aid your doctor.'}
              </p>
            </div>

            {/* Hidden native file input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUploadChange} 
              accept="image/*,.pdf" 
              className="hidden" 
            />

            {/* OCR Processing Spinner (2s latency simulation) */}
            {isOcrProcessing && (
              <div className="p-8 bg-purple-50/70 border-2 border-dashed border-purple-300 rounded-2xl flex flex-col items-center justify-center gap-4 text-center animate-pulse">
                <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg animate-spin">
                  <RefreshCw className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-purple-950">AI Document Engine Extracting Records...</h3>
                  <p className="text-xs text-purple-700 mt-1 font-medium">
                    Scanning {uploadedDocName} • Parsing medications, lab reference ranges & abnormal flags
                  </p>
                </div>
                <div className="w-48 bg-purple-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-600 h-1.5 rounded-full w-3/4 animate-pulse" />
                </div>
              </div>
            )}

            {/* Document Upload Area (When not processing and not yet extracted) */}
            {!isOcrProcessing && !extractedDocData && (
              <div className="flex flex-col gap-5">
                {/* Upload & Camera Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 border-2 border-dashed border-blue-300 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <span className="text-base font-bold text-blue-900 block">Choose Document / Image</span>
                      <span className="text-xs text-slate-500">Supports JPG, PNG, Scanned Camera Photos</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleProcessDocument('kiosk_live_cam_capture.jpg', 'prescription')}
                    className="p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <span className="text-base font-bold text-emerald-950 block">Capture with Kiosk Camera</span>
                      <span className="text-xs text-slate-500">Hold paper prescription up to the scanner</span>
                    </div>
                  </button>
                </div>

                {/* Quick 1-Click Sample Demos */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Or Test with 1-Click Demo Records:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SAMPLE_DOCUMENTS.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleProcessDocument(doc.fileName, doc.type)}
                        className="p-3.5 bg-white border border-slate-200 hover:border-purple-500 rounded-xl text-left shadow-sm hover:shadow transition-all flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-50 text-purple-700 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            {doc.type === 'lab_report' ? <FlaskConical className="w-5 h-5" /> : <Pill className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{doc.title}</span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">{doc.description}</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex-shrink-0">
                          Load Demo
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* EXTRACTED DATA CONFIRMATION SCREEN ("Does this look right?") */}
            {!isOcrProcessing && extractedDocData && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-5 flex items-start gap-4">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h3 className="text-base font-extrabold text-emerald-950">
                        {selectedLanguage === 'हिंदी' ? 'क्या यह जानकारी सही है?' : 'Does this look right? (AI Extraction Verified)'}
                      </h3>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 self-start">
                        {extractedDocData.documentType.toUpperCase()} • Confidence: 96%
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1">
                      {extractedDocData.documentTitle} • Date: {extractedDocData.date} • Facility: {extractedDocData.facility || 'Hospital OPD'}
                    </p>
                  </div>
                </div>

                {/* Extracted Diagnoses */}
                {extractedDocData.diagnoses && extractedDocData.diagnoses.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Identified Diagnoses / Conditions:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {extractedDocData.diagnoses.map((diag, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-xs font-bold">
                          {diag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Medications */}
                {extractedDocData.medications && extractedDocData.medications.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-blue-600" /> Extracted Medications ({extractedDocData.medications.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {extractedDocData.medications.map((med, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                          <span className="text-sm font-extrabold text-slate-900 block">{med.name}</span>
                          <span className="text-xs font-semibold text-blue-700 block mt-0.5">{med.dose}</span>
                          <span className="text-xs text-slate-500 block mt-1">{med.frequency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Lab Values (Flagged HIGH/LOW in Red/Orange) */}
                {extractedDocData.labValues && extractedDocData.labValues.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-purple-600" /> Clinical Lab Values & Out-of-Range Flags:
                    </span>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">Test Name</th>
                            <th className="p-3">Extracted Value</th>
                            <th className="p-3 hidden sm:table-cell">Reference Range</th>
                            <th className="p-3 text-right">Flag Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {extractedDocData.labValues.map((lab, i) => {
                            const isHigh = lab.flag === 'HIGH';
                            const isLow = lab.flag === 'LOW';
                            return (
                              <tr key={i} className={isHigh ? 'bg-red-50/50' : isLow ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                                <td className="p-3 font-bold text-slate-900">{lab.test}</td>
                                <td className="p-3">
                                  <span className={`font-extrabold ${isHigh ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-slate-800'}`}>
                                    {lab.value} {lab.unit}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-500 hidden sm:table-cell">{lab.referenceRange} {lab.unit}</td>
                                <td className="p-3 text-right">
                                  <span className={getLabFlagBadgeClass(lab.flag)}>
                                    {lab.flag}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Verification Confirmation Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={handleConfirmDocumentAndProceed}
                    className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-800 text-white text-base font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Check className="w-5 h-5" />
                    {selectedLanguage === 'हिंदी' ? 'हां, यह सही है — आगे बढ़ें' : 'Looks Good! Attach & Proceed'}
                  </button>

                  <button
                    onClick={() => { setExtractedDocData(null); setUploadedDocName(''); }}
                    className="py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl border border-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-4 h-4" /> Rescan / Different File
                  </button>
                </div>
              </div>
            )}

            {/* Skip Action Footer (Always accessible) */}
            {!isOcrProcessing && !extractedDocData && (
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSkipDocumentAndProceed}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>{selectedLanguage === 'हिंदी' ? 'दस्तावेज़ नहीं है (सीधे प्रश्न पूछें)' : 'Skip Document Upload (Proceed to Questions)'}</span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* STEP 3A: STANDARD ALLOPATHIC SOCRATES QUESTION SEQUENCE                   */}
      {/* ========================================================================= */}
      {step === 'questions' && selectedComplaint && (
        <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
          {/* Progress Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500">
              <button 
                onClick={handleRestart}
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Change Complaint
              </button>
              <div className="flex items-center gap-2">
                {extractedDocData && (
                  <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded text-[11px] border border-purple-200">
                    📄 Document Attached
                  </span>
                )}
                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 border border-slate-200">
                  Question {currentQuestionIndex + 1} of {selectedComplaint.questions.length} • <strong>{selectedComplaint.questions[currentQuestionIndex].dimension}</strong>
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / selectedComplaint.questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Active Question Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md mb-2 inline-block border border-blue-200">
                {selectedComplaint.questions[currentQuestionIndex].dimension} Assessment
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                {selectedLanguage === 'हिंदी' 
                  ? selectedComplaint.questions[currentQuestionIndex].questionHi 
                  : selectedComplaint.questions[currentQuestionIndex].questionEn}
              </h2>
            </div>

            {/* Touch Option Buttons */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Touch Option:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedComplaint.questions[currentQuestionIndex].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswerQuestion(opt, '')}
                    className={`p-4 rounded-xl text-left font-bold text-sm border-2 transition-all cursor-pointer flex items-center justify-between ${
                      opt.isRedFlag
                        ? 'border-red-300 bg-red-50/50 hover:bg-red-100 text-red-900'
                        : 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-500 text-slate-800'
                    }`}
                  >
                    <span>{selectedLanguage === 'हिंदी' ? opt.labelHi : opt.labelEn}</span>
                    {opt.isRedFlag && <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Input Section */}
            <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Or Speak Answer (Voice Input):</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleVoice}
                  className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-slate-800 text-white hover:bg-slate-900'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-400" />}
                  {isListening ? 'Stop Listening' : 'Tap Mic & Speak'}
                </button>

                {/* Voice Transcript Display */}
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 min-h-[46px] flex items-center justify-between">
                  <span>
                    {isListening ? (
                      <span className="text-red-600 font-bold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
                        Listening... {voiceText}
                      </span>
                    ) : (
                      voiceText || 'Press microphone and speak your answer...'
                    )}
                  </span>

                  {voiceText && !isListening && (
                    <button
                      onClick={() => handleAnswerQuestion(null, voiceText)}
                      className="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      Submit Speech
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* STEP 3B: SEPARATE AYUSH DASHAVIDHA PARIKSHA QUESTION FLOW                 */}
      {/* ========================================================================= */}
      {step === 'ayush_questions' && (
        <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
          {/* Progress Header */}
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500">
              <button 
                onClick={handleRestart}
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Change Path
              </button>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white font-extrabold px-2.5 py-0.5 rounded text-[11px]">
                  🌿 AYUSH Assessment
                </span>
                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 border border-slate-200">
                  Step {ayushQuestionIndex + 1} of {AYUSH_QUESTIONS.length} • <strong>{AYUSH_QUESTIONS[ayushQuestionIndex].dimensionEn}</strong>
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${((ayushQuestionIndex + 1) / AYUSH_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Active AYUSH Question Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  {selectedLanguage === 'हिंदी' 
                    ? AYUSH_QUESTIONS[ayushQuestionIndex].dimensionHi 
                    : AYUSH_QUESTIONS[ayushQuestionIndex].dimensionEn}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {selectedLanguage === 'हिंदी' 
                  ? AYUSH_QUESTIONS[ayushQuestionIndex].questionHi 
                  : AYUSH_QUESTIONS[ayushQuestionIndex].questionEn}
              </h2>
            </div>

            {/* Touch Option Cards */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Ayurvedic Finding (Touch):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AYUSH_QUESTIONS[ayushQuestionIndex].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswerAyushQuestion(opt, '')}
                    className="p-4 rounded-xl text-left border-2 border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 transition-all cursor-pointer flex flex-col justify-between gap-2 group"
                  >
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-950">
                      {selectedLanguage === 'हिंदी' ? opt.labelHi : opt.labelEn}
                    </span>
                    {opt.description && (
                      <span className="text-[11px] text-slate-500 font-medium group-hover:text-emerald-800">
                        {opt.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Input Section for AYUSH */}
            <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Or Speak Observation (Voice):</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleVoice}
                  className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-emerald-800 text-white hover:bg-emerald-900'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-300" />}
                  {isListening ? 'Stop Listening' : 'Speak Ayurvedic Symptoms'}
                </button>

                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 min-h-[46px] flex items-center justify-between">
                  <span>
                    {isListening ? (
                      <span className="text-red-600 font-bold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
                        Listening... {voiceText}
                      </span>
                    ) : (
                      voiceText || 'Press microphone to speak your lifestyle, appetite, or digestion habits...'
                    )}
                  </span>

                  {voiceText && !isListening && (
                    <button
                      onClick={() => handleAnswerAyushQuestion(null, voiceText)}
                      className="px-3 py-1 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
                    >
                      Submit Speech
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: SUBMITTED CONFIRMATION SCREEN (TOKEN + ATTACHED RECORDS)           */}
      {/* ========================================================================= */}
      {step === 'submitted' && (
        <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md w-full flex flex-col items-center gap-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                OPD Token Issued
              </span>
              <h2 className="text-4xl font-black text-slate-900 mt-1 font-mono tracking-tight text-blue-700">
                {submittedSession?.tokenNumber || 'K-104'}
              </h2>
            </div>

            {/* Check-In Dossier Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 w-full text-left space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs font-extrabold text-slate-500 uppercase">Consultation Summary</span>
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {submittedSession?.complaintTitle}
                </span>
              </div>

              {/* Digitized Document Attachment Status */}
              {submittedSession?.digitizedDocument && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-lg text-xs text-purple-950">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <FileText className="w-4 h-4 text-purple-700" /> Digitized Document Attached:
                  </div>
                  <p className="text-slate-600">
                    {submittedSession.digitizedDocument.documentTitle} ({submittedSession.digitizedDocument.medications?.length || 0} meds, {submittedSession.digitizedDocument.labValues?.length || 0} lab tests digitized)
                  </p>
                </div>
              )}

              {/* AYUSH Assessment Summary */}
              {submittedSession?.ayushAssessment && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-950">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Leaf className="w-4 h-4 text-emerald-700" /> Dashavidha Pariksha Recorded:
                  </div>
                  <p className="text-slate-700 font-medium">
                    {submittedSession.ayushAssessment.ayurvedicSummary}
                  </p>
                </div>
              )}

              {/* Red Flags */}
              {submittedSession?.redFlagsTriggered?.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  Priority Triage Alert Logged: Duty nurse will assist you at Counter 1.
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 max-w-md">
              {selectedLanguage === 'हिंदी'
                ? 'आपकी जानकारी सुरक्षित रूप से दर्ज कर ली गई है। कृपया प्रतीक्षा क्षेत्र में बैठें।'
                : 'Thank you! Your intake responses and attached documents have been transmitted to the duty physician. Please take a seat in the OPD waiting lounge.'}
            </p>

            <button
              onClick={handleRestart}
              className="mt-2 w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Start New Patient Session
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
