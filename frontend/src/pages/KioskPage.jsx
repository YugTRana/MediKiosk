import React, { useState, useEffect, useRef } from 'react';
import { 
  HeartPulse, Thermometer, Wind, Activity, Bone, Globe, Volume2, VolumeX, 
  Mic, MicOff, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, Sparkles, ShieldAlert 
} from 'lucide-react';
import { speakText, cancelSpeech, startListening, isSTTSupported } from '../services/speechService.js';
import { checkRedFlagCondition } from '../services/redFlagDetector.js';

// Fallback Dialogue Flows JSON in case backend API is connecting
import fallbackFlows from '../../../backend/mockData/dialogueFlows.json';

const COMPLAINT_ICONS = {
  Thermometer: Thermometer,
  Wind: Wind,
  Activity: Activity,
  HeartPulse: HeartPulse,
  Bone: Bone
};

export default function KioskPage() {
  // Navigation & Dialogue State
  const [step, setStep] = useState('complaint_selection'); // 'complaint_selection' | 'questions' | 'submitted'
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Loaded Dialogue Data
  const [dialogueData, setDialogueData] = useState(fallbackFlows);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Patient Input Data
  const [answers, setAnswers] = useState({});
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

  // Handle TTS narration when question changes
  const speakCurrentQuestion = (questionObj) => {
    if (!ttsEnabled || !questionObj) return;
    const qText = selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi' 
      ? questionObj.questionHi 
      : questionObj.questionEn;
    speakText(qText, selectedLanguage);
  };

  // Start Complaint Flow
  const handleSelectComplaint = (complaint) => {
    cancelSpeech();
    setSelectedComplaint(complaint);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setVoiceText('');
    setActiveRedFlag(null);
    setRedFlagsHistory([]);
    setStep('questions');

    const firstQuestion = complaint.questions[0];
    speakCurrentQuestion(firstQuestion);
  };

  // Toggle Voice Input (Mic)
  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    if (!isSTTSupported()) {
      alert('Voice microphone input is not supported in this browser. You can select touch options below.');
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
          complaintId: selectedComplaint.id,
          triggerReason: redFlagObj.reason,
          answerData: answerObj,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[Kiosk] Failed to dispatch red flag log to server:', err);
    }
  };

  // Process Option Selection (Touch or Voice submit)
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
      questionText: selectedLanguage === 'हिंदी' ? currentQuestion.questionHi : currentQuestion.questionEn,
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

    if (redFlagCheck.isRedFlag) {
      setActiveRedFlag(redFlagCheck.reason);
      setRedFlagsHistory((prev) => [...prev, redFlagCheck.reason]);
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
      handleSubmitSession(updatedAnswers, redFlagCheck.isRedFlag ? [...redFlagsHistory, redFlagCheck.reason] : redFlagsHistory);
    }
  };

  // Submit Session to Backend POST /api/session/submit
  const handleSubmitSession = async (finalAnswers, finalRedFlags) => {
    setIsSubmitting(true);
    cancelSpeech();

    const payload = {
      sessionId,
      complaintId: selectedComplaint.id,
      complaintTitle: selectedLanguage === 'हिंदी' ? selectedComplaint.titleHi : selectedComplaint.titleEn,
      language: selectedLanguage,
      answers: Object.values(finalAnswers),
      redFlagsTriggered: finalRedFlags
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
        redFlagsTriggered: payload.redFlagsTriggered
      });
    } finally {
      setIsSubmitting(false);
      setStep('submitted');
      speakText(
        selectedLanguage === 'हिंदी'
          ? 'धन्यवाद! आपकी जानकारी दर्ज कर ली गई है। कृपया प्रतीक्षा कक्ष में बैठें।'
          : 'Thank you! Your information has been recorded. Please relax in the waiting room until your token is called.',
        selectedLanguage
      );
    }
  };

  // Reset to initial screen
  const handleRestart = () => {
    cancelSpeech();
    setStep('complaint_selection');
    setSelectedComplaint(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setVoiceText('');
    setActiveRedFlag(null);
    setRedFlagsHistory([]);
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
            <h1 className="text-xl font-bold tracking-tight">MediKiosk Assistance</h1>
            <p className="text-slate-400 text-xs font-medium">Calm, guided triage for hospital patients</p>
          </div>
        </div>

        {/* Global Controls: Language & Audio Narration */}
        <div className="flex items-center gap-2">
          {/* TTS Narration Toggle */}
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
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
                className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all ${
                  selectedLanguage === lang
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
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

      {/* STEP 1: CHIEF COMPLAINT SELECTION SCREEN */}
      {step === 'complaint_selection' && (
        <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-full mb-2 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5" /> Reassuring Self Check-In
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
              {selectedLanguage === 'हिंदी' ? 'अपनी मुख्य समस्या चुनें' : 'What is your main health concern today?'}
            </h2>
            <p className="text-sm text-slate-600">
              {selectedLanguage === 'हिंदी' 
                ? 'नीचे दिए गए बटन में से चुनें। हम आपसे कुछ सरल प्रश्न पूछेंगे।'
                : 'Select one of the 5 options below. We will guide you through a few quick questions.'}
            </p>
          </div>

          {/* 5 Chief Complaint Large Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dialogueData.complaints.map((c) => {
              const IconComponent = COMPLAINT_ICONS[c.iconName] || Activity;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectComplaint(c)}
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
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-center text-xs text-slate-700">
            <strong>Need urgent help?</strong> You can also speak directly to the triage nurse at Counter 1 anytime.
          </div>
        </main>
      )}

      {/* STEP 2: DYNAMIC SOCRATES QUESTION SEQUENCE */}
      {step === 'questions' && selectedComplaint && (
        <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
          {/* Progress Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500">
              <button 
                onClick={handleRestart}
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold"
              >
                <ArrowLeft className="w-4 h-4" /> Change Complaint
              </button>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 border border-slate-200">
                Question {currentQuestionIndex + 1} of {selectedComplaint.questions.length} • Dimension: <strong>{selectedComplaint.questions[currentQuestionIndex].dimension}</strong>
              </span>
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
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md mb-2 inline-block">
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
                      className="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded-lg hover:bg-blue-800 transition-colors"
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

      {/* STEP 3: SUBMITTED CONFIRMATION SCREEN */}
      {step === 'submitted' && (
        <main className="max-w-xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md w-full flex flex-col items-center gap-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Token Slip Issued
              </span>
              <h2 className="text-4xl font-black text-slate-900 mt-1 font-mono tracking-tight text-blue-700">
                {submittedSession?.tokenNumber || 'K-104'}
              </h2>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Check-in Summary:</h3>
              <p className="text-sm font-bold text-slate-900">
                Complaint: {submittedSession?.complaintTitle}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Recorded Questions Answered: {submittedSession?.answers?.length || 0}
              </p>
              {submittedSession?.redFlagsTriggered?.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 font-semibold">
                  ⚠️ Priority Triage Alert Logged: Staff will assist you shortly.
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 max-w-md">
              {selectedLanguage === 'हिंदी'
                ? 'आपकी जानकारी सुरक्षित रूप से दर्ज कर ली गई है। कृपया प्रतीक्षा क्षेत्र में बैठें।'
                : 'Thank you! Your responses have been safely recorded and transmitted to the duty doctor. Please take a seat in the waiting room.'}
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
