import React, { useState, useEffect, useRef } from 'react';
import { 
  HeartPulse, Thermometer, Wind, Activity, Bone, Globe, Volume2, VolumeX, 
  Mic, MicOff, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, 
  Sparkles, ShieldAlert, Upload, Camera, FileText, FlaskConical, Check, 
  RotateCcw, Leaf, Layers, AlertCircle, Pill, ChevronRight,
  ShieldCheck, UserCheck, Smartphone, Key, Lock, XCircle, User, QrCode, Edit3,
  Stethoscope, Settings, WifiOff, Wifi, ClipboardList, Moon, Sun
} from 'lucide-react';
import { speakText, cancelSpeech, startListening, isSTTSupported, getSpeechProvider, getRecoveryPrompt } from '../services/speechService.js';
import AudioWaveformVisualizer from '../components/AudioWaveformVisualizer.jsx';
import { checkRedFlagCondition } from '../services/redFlagDetector.js';
import { extractDocumentWithDocAI, getLabFlagBadgeClass } from '../services/docAiService.js';
import { AYUSH_COMPLAINT_META, AYUSH_QUESTIONS, compileAyushSummary } from '../services/ayushFlowData.js';
import html2pdf from 'html2pdf.js';
import { 
  loginPatient, 
  signupPatient,
  sendOtp,
  verifyOtp,
  updateAdminPatient,
  clearStaffSession
} from '../services/authService.js';
import LiveCameraModal from '../components/LiveCameraModal.jsx';
import DigitizedDocumentTable from '../components/DigitizedDocumentTable.jsx';
import { generatePatientReadBackSummary } from '../services/clinicalSummaryGenerator.js';

// Fallback Dialogue Flows JSON
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
  // Steps: 'patient_auth' | 'dpdp_consent' | 'complaint_selection' | 'doc_digitization' | 'questions' | 'ayush_questions' | 'summary_readback' | 'submitted'
  const [step, setStep] = useState('patient_auth');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [pendingSubmissionData, setPendingSubmissionData] = useState(null);
  const [patientReadBackText, setPatientReadBackText] = useState('');
  const [isPlayingReadBack, setIsPlayingReadBack] = useState(false);

  // Hospital Hallway Offline & Network Resilience State (Phase 10)
  const [isOfflineMode, setIsOfflineMode] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Granular DPDP Consent Toggles (Module D - Phase 8)
  const [consentToggles, setConsentToggles] = useState({
    allowDataCapture: true,
    allowHisSharing: true,
    allowAbdmLinking: true
  });

  // Patient Auth State
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'signup'
  const [loginForm, setLoginForm] = useState({ mobile: '', email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    age: '',
    gender: 'Male',
    address: ''
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState(null);
  const [verifiedPatient, setVerifiedPatient] = useState(null);
  
  // OTP State
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpAction, setOtpAction] = useState('login'); // 'login' | 'signup'

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({ name: '', age: '', gender: 'Male', address: '', mobile: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  // Live Camera Scanner State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState('document'); // 'document' | 'face'
  const [patientFacePhoto, setPatientFacePhoto] = useState(null);

  // Patient Input Data for Allopathic SOCRATES
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentDynamicQuestion, setCurrentDynamicQuestion] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [answers, setAnswers] = useState({});

  // Patient Input Data for AYUSH Dashavidha Pariksha
  const [ayushQuestionIndex, setAyushQuestionIndex] = useState(0);
  const [ayushAnswers, setAyushAnswers] = useState({});
  const [ayushClarifyingQuestion, setAyushClarifyingQuestion] = useState(null);
  const [hasAskedAyushClarify, setHasAskedAyushClarify] = useState(false);
  const [isAyushThinking, setIsAyushThinking] = useState(false);
  const [ayushClarifyingHistory, setAyushClarifyingHistory] = useState('');

  // Voice Interaction State
  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const recognitionRef = useRef(null);

  // Red Flag Alert State
  const [activeRedFlag, setActiveRedFlag] = useState(null);
  const [redFlagsHistory, setRedFlagsHistory] = useState([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSession, setSubmittedSession] = useState(null);
  const [sessionId] = useState(() => `sess_${Date.now()}`);

  // Vitals State
  const [vitalsData, setVitalsData] = useState(null);
  const [isScanningVitals, setIsScanningVitals] = useState(false);

  // Patient Care Plan State
  const [prescriptionToken, setPrescriptionToken] = useState('');
  const [carePlanData, setCarePlanData] = useState(null);
  const [isFetchingCarePlan, setIsFetchingCarePlan] = useState(false);
  const [carePlanError, setCarePlanError] = useState('');
  const pushTelemetry = async (type, text) => {
    try {
      await fetch('http://localhost:3000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text })
      });
    } catch (e) {}
  };

  const fetchCarePlan = async (e) => {
    e.preventDefault();
    if (!prescriptionToken) return;
    setIsFetchingCarePlan(true);
    setCarePlanError('');
    try {
      const res = await fetch(`http://localhost:3000/api/sessions/token/${prescriptionToken.trim().toUpperCase()}/care-plan`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCarePlanData(data);
        setStep('view_care_plan');
      } else {
        setCarePlanError(data.message || data.error || 'Failed to fetch care plan');
      }
    } catch (err) {
      setCarePlanError('Network error connecting to server');
    } finally {
      setIsFetchingCarePlan(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('care-plan-content');
    if (element) {
      const opt = {
        margin:       0.5,
        filename:     `Prescription_${prescriptionToken.toUpperCase()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    }
  };

  // Fetch dialogue flows & clear staff session on mount
  useEffect(() => {
    clearStaffSession();

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

    // Offline / Online network listeners
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
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

  // Simulate Hardware Vitals Scanning via AI
  useEffect(() => {
    if (step === 'vitals_scan') {
      setIsScanningVitals(true);
      setVitalsData(null);
      
      const fetchAiVitals = async () => {
        try {
          const complaintTitle = isAyushFlow 
            ? 'AYUSH General Assessment' 
            : (selectedComplaint?.titleEn || 'General Consultation');
            
          const answers = pendingSubmissionData?.finalAnswers || [];
          
          const response = await fetch('http://localhost:3000/api/vitals/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaintTitle, answers })
          });
          
          if (!response.ok) throw new Error('Failed to fetch AI vitals');
          
          const data = await response.json();
          setVitalsData(data);
        } catch (error) {
          console.error("AI Vitals Error:", error);
          // Fallback to random if server fails
          setVitalsData({
            heartRate: Math.floor(Math.random() * (100 - 65 + 1)) + 65,
            bloodPressure: `${Math.floor(Math.random() * (130 - 110 + 1)) + 110}/${Math.floor(Math.random() * (85 - 70 + 1)) + 70}`,
            temperature: (Math.random() * (99.2 - 97.5) + 97.5).toFixed(1),
            oxygenSat: Math.floor(Math.random() * (100 - 95 + 1)) + 95,
          });
        } finally {
          setIsScanningVitals(false);
          if (ttsEnabled) {
            speakText(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi' ? 'स्कैनिंग पूरी हो गई है।' : 'Scanning complete.', selectedLanguage);
          }
        }
      };
      
      // Add minimum 3s delay for the animation effect, even if API is fast
      const timer = setTimeout(() => {
        fetchAiVitals();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [step, ttsEnabled, selectedLanguage, selectedComplaint, pendingSubmissionData, isAyushFlow]);

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

  // ============================================================================
  // PATIENT LOGIN & SIGN-UP HANDLERS
  // ============================================================================

  // 1. Initiate Log In (Sends OTP)
  const handlePatientLogin = async (e) => {
    if (e) e.preventDefault();
    cancelSpeech();
    if (!loginForm.mobile || !loginForm.email || !loginForm.password) {
      setAuthError('Please enter Mobile Number, Email, and Password.');
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      await sendOtp(loginForm.email);
      setOtpAction('login');
      setShowOtpStep(true);
      setAuthSuccessMessage(`OTP sent to ${loginForm.email}`);
    } catch (err) {
      setAuthError(err.message || 'Failed to send OTP.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // 2. Initiate Sign Up (Sends OTP)
  const handlePatientSignup = async (e) => {
    if (e) e.preventDefault();
    cancelSpeech();
    if (!signupForm.name || !signupForm.mobile || !signupForm.email || !signupForm.password) {
      setAuthError('Please fill in Name, Mobile, Email, and Password.');
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      await sendOtp(signupForm.email);
      setOtpAction('signup');
      setShowOtpStep(true);
      setAuthSuccessMessage(`OTP sent to ${signupForm.email}`);
    } catch (err) {
      setAuthError(err.message || 'Failed to send OTP.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // 3. Verify OTP and finalize login/signup
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpValue || otpValue.length < 6) {
      setAuthError('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsOtpLoading(true);
    setAuthError(null);
    try {
      const emailToVerify = otpAction === 'login' ? loginForm.email : signupForm.email;
      await verifyOtp(emailToVerify, otpValue);
      
      // If OTP is valid, proceed with actual login or signup
      if (otpAction === 'login') {
        const profile = await loginPatient(loginForm);
        setVerifiedPatient(profile);
        setShowOtpStep(false);
        setOtpValue('');
        narrate(
          selectedLanguage === 'हिंदी'
            ? `नमस्ते ${profile.name} जी! आपका स्वागत है।`
            : `Welcome back, ${profile.name}! You are logged in.`
        );
      } else {
        const profile = await signupPatient(signupForm);
        setShowOtpStep(false);
        setOtpValue('');
        setLoginForm({ mobile: profile.mobile, email: profile.email || '', password: '' });
        setAuthTab('login');
        setAuthSuccessMessage(`Account registered successfully for ${profile.name}! Please enter your password to log in.`);
        setSignupForm({ name: '', mobile: '', email: '', password: '', age: '', gender: 'Male', address: '' });
        narrate(
          selectedLanguage === 'हिंदी'
            ? `बधाई हो ${profile.name} जी! आपका खाता बन गया है। कृपया अपना पासवर्ड दर्ज करके लॉगिन करें।`
            : `Registration successful for ${profile.name}! Please enter your password to log in.`
        );
      }
    } catch (err) {
      setAuthError(err.message || 'Invalid OTP or Action Failed.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  // 3. Profile Edit Handler
  const handleSaveProfileEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editProfileForm.name) {
      setAuthError('Name cannot be empty.');
      return;
    }
    setIsSavingEdit(true);
    setAuthError(null);
    try {
      const updated = await updateAdminPatient(verifiedPatient.id, editProfileForm);
      setVerifiedPatient(updated);
      setIsEditingProfile(false);
      narrate(`Patient details updated successfully for ${updated.name}.`);
    } catch (err) {
      setAuthError(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Audio-Guided DPDP Consent Explanation (Phase 8)
  const handleProceedToConsent = () => {
    cancelSpeech();
    setStep('dpdp_consent');
    const consentSpeech = (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
      ? 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 के तहत, आपकी सहमति से ही अस्पताल कियोस्क पर आपके लक्षण व स्वास्थ्य रिकॉर्ड दर्ज किए जाएंगे। यह जानकारी केवल आपके डॉक्टर के परामर्श के लिए सुरक्षित रूप से साझा की जाएगी। आप कभी भी इसे निरस्त कर सकते हैं।'
      : 'Under the Digital Personal Data Protection Act 2023, your symptoms and clinical records are captured only with your explicit consent. This data is securely shared with your consulting physician and optional ABHA health locker. You retain the full right to revoke this consent at any time.';
    if (ttsEnabled) {
      narrate(consentSpeech);
    }
  };

  const handleConsentAccepted = () => {
    cancelSpeech();
    setStep('complaint_selection');
    narrate(
      selectedLanguage === 'हिंदी'
        ? 'कृपया अपनी मुख्य स्वास्थ्य समस्या चुनें।'
        : 'Please select your primary health concern from the options below.'
    );
  };

  // ============================================================================
  // COMPLAINT SELECTION & DIGITIZATION
  // ============================================================================
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
        ? 'यदि आपके पास कोई पुराना डॉक्टर का पर्चा, एक्स-रे या जांच रिपोर्ट है, तो आप उसे यहां अपलोड कर सकते हैं, या सीधे आगे बढ़ सकते हैं।'
        : 'If you have a previous doctor prescription, X-ray, or lab report, you can upload it here, or skip to continue directly.'
    );
  };

  const handleProcessDocument = async (fileName, docType, fileObj = null) => {
    cancelSpeech();
    setIsOcrProcessing(true);
    setUploadedDocName(fileName || 'scanned_report.jpg');
    setExtractedDocData(null);

    narrate(
      selectedLanguage === 'हिंदी'
        ? 'दस्तावेज़ स्कैन हो रहा है। कृपया कुछ क्षण प्रतीक्षा करें।'
        : 'Scanning document. Please wait a moment while AI extracts your details.'
    );

    try {
      const extracted = await extractDocumentWithDocAI({
        fileName: fileName || (fileObj ? fileObj.name : 'upload.jpg'),
        documentType: docType || 'auto',
        complaintId: selectedComplaint?.id || (isAyushFlow ? 'joint_pain' : 'auto'),
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
      narrate(
        selectedLanguage === 'हिंदी'
          ? 'माफ़ करें, दस्तावेज़ को स्कैन करने में कोई समस्या हुई।'
          : 'Sorry, there was an issue scanning your document.'
      );
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleFileUploadChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessDocument(file.name, 'auto', file);
    }
  };

  const handleConfirmDocumentAndProceed = () => {
    cancelSpeech();
    setHasConfirmedDoc(true);
    proceedToQuestions();
  };

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

  // Toggle Voice Input with Live Audio Analysis & Silence Detection
  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current && recognitionRef.current.stop) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      setAudioLevel(0);
      return;
    }

    if (!isSTTSupported()) {
      alert('Voice microphone input is not supported in this browser.');
      return;
    }

    cancelSpeech();
    setShowRecoveryBanner(false);
    setIsListening(true);
    setAudioLevel(0);

    const rec = startListening({
      lang: selectedLanguage,
      onAudioLevel: (lvl) => {
        setAudioLevel(lvl);
      },
      onSilenceDetected: () => {
        console.log('[Kiosk Voice] Auto-stopped after silence detected.');
      },
      onResult: (transcript, isFinal) => {
        if (transcript && transcript.trim()) {
          setVoiceText(transcript);
          setShowRecoveryBanner(false);
          
          if (isFinal) {
            setIsListening(false);
            setAudioLevel(0);
            pushTelemetry('speech', `PATIENT: "${transcript.trim()}"`);
            
            // Auto-submit the voice response to create a continuous conversational flow
            // Check which step we are currently on to route to the correct handler
            if (step === 'questions') {
              handleAnswerQuestion(null, transcript.trim());
            } else if (step === 'ayush_questions') {
              handleAnswerAyushQuestion(null, transcript.trim());
            }
          }
        } else if (isFinal && !transcript) {
          setShowRecoveryBanner(true);
          setIsListening(false);
          setAudioLevel(0);
        }
      },
      onError: (err) => {
        console.warn('[Kiosk Voice] Recognition error:', err);
        setIsListening(false);
        setAudioLevel(0);
        setShowRecoveryBanner(true);
      },
      onEnd: () => {
        setIsListening(false);
        setAudioLevel(0);
      }
    });

    recognitionRef.current = rec;
  };

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

  // SOCRATES Answer
  const handleAnswerQuestion = async (optionObj = null, freeText = '') => {
    cancelSpeech();
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
    }

    const currentQuestion = currentDynamicQuestion || selectedComplaint.questions[currentQuestionIndex];
    const answerEntry = {
      questionId: currentQuestion.id,
      dimension: currentQuestion.dimension || "Adaptive",
      questionText: (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? currentQuestion.questionHi : currentQuestion.questionEn,
      selectedOption: optionObj,
      customVoiceText: freeText,
      timestamp: new Date().toISOString()
    };

    const updatedAnswers = { ...answers, [currentQuestion.id]: answerEntry };
    setAnswers(updatedAnswers);

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
      pushTelemetry('ai', 'AI triggered RED_FLAG check. Status: CRITICAL.');
      logRedFlagToBackend(redFlagCheck, answerEntry);
    } else {
      pushTelemetry('system', `Extracted Keywords: [${answerEntry.customVoiceText ? 'Free_Text' : answerEntry.selectedOption?.labelEn}]`);
      pushTelemetry('ai', 'AI triggered RED_FLAG check. Status: Clear.');
    }

    // Call Backend for Next Adaptive Question
    setIsThinking(true);
    setVoiceText('');
    try {
      const historyArr = Object.values(updatedAnswers).map(a => ({
        question: a.questionText,
        answer: a.customVoiceText || a.selectedOption?.labelEn || a.selectedOption?.labelHi
      }));

      const payload = {
        complaintId: selectedComplaint.id,
        complaintTitle: selectedLanguage === 'हिंदी' ? selectedComplaint.titleHi : selectedComplaint.titleEn,
        history: historyArr,
        patientMetadata: verifiedPatient 
          ? { age: verifiedPatient.age, gender: verifiedPatient.gender, language: selectedLanguage } 
          : { age: 30, gender: 'Male', language: selectedLanguage }
      };

      const res = await fetch('http://localhost:3000/api/dialogue/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();

      if (data.isComplete) {
        triggerPatientReadBack({
          finalAnswers: Object.values(updatedAnswers),
          finalRedFlags: updatedFlags,
          ayushData: null
        });
      } else {
        // We received the next question
        pushTelemetry('ai', `AI generated follow-up: "${selectedLanguage === 'हिंदी' ? data.data.questionHi : data.data.questionEn}"`);
        setCurrentDynamicQuestion(data.data);
        speakCurrentQuestion(data.data);
      }
    } catch (err) {
      console.warn('[Kiosk] Adaptive questioning failed, falling back to local index', err);
      if (currentQuestionIndex < selectedComplaint.questions.length - 1) {
        const nextIdx = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIdx);
        const nextQ = selectedComplaint.questions[nextIdx];
        setCurrentDynamicQuestion(nextQ);
        speakCurrentQuestion(nextQ);
      } else {
        triggerPatientReadBack({
          finalAnswers: Object.values(updatedAnswers),
          finalRedFlags: updatedFlags,
          ayushData: null
        });
      }
    } finally {
      setIsThinking(false);
    }
  };

  // Vitals Scan Intercept
  const triggerPatientReadBack = ({ finalAnswers, finalRedFlags, ayushData }) => {
    cancelSpeech();
    const payload = { finalAnswers, finalRedFlags, ayushData };
    setPendingSubmissionData(payload);

    setStep('vitals_scan');
    if (ttsEnabled) {
      speakText(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi' ? 'कृपया अपनी उंगली पल्स ऑक्सीमीटर में रखें।' : 'Please place your finger in the Pulse Oximeter.', selectedLanguage);
    }
  };

  const proceedToReadBack = () => {
    cancelSpeech();
    const { finalAnswers, ayushData } = pendingSubmissionData;

    const title = isAyushFlow 
      ? ((selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? AYUSH_COMPLAINT_META.titleHi : AYUSH_COMPLAINT_META.titleEn)
      : ((selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? selectedComplaint?.titleHi : selectedComplaint?.titleEn);

    const readBack = generatePatientReadBackSummary({
      complaintTitle: title || 'Consultation',
      answers: finalAnswers,
      digitizedDocument: extractedDocData || null,
      ayushAssessment: ayushData
    }, selectedLanguage);

    setPatientReadBackText(readBack);
    setStep('summary_readback');
    if (ttsEnabled) {
      setIsPlayingReadBack(true);
      speakText(readBack, selectedLanguage);
    }
  };

  // AYUSH Answer with AI Ayurvedic Clarifying Questioning
  const handleAnswerAyushQuestion = async (optionObj = null, freeText = '') => {
    cancelSpeech();
    if (isListening && recognitionRef.current && recognitionRef.current.stop) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
      setAudioLevel(0);
    }

    // Handle answer to active AI clarifying question
    if (ayushClarifyingQuestion) {
      const clarifyAnswer = optionObj 
        ? ((selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? optionObj.labelHi : optionObj.labelEn)
        : freeText;
      const combinedHistory = ayushClarifyingHistory 
        ? `${ayushClarifyingHistory} | Follow-up: ${clarifyAnswer}` 
        : `Clarification: ${clarifyAnswer}`;
      setAyushClarifyingHistory(combinedHistory);
      setAyushClarifyingQuestion(null);
      setVoiceText('');

      if (ayushQuestionIndex < AYUSH_QUESTIONS.length - 1) {
        const nextIdx = ayushQuestionIndex + 1;
        setAyushQuestionIndex(nextIdx);
        speakCurrentAyushQuestion(AYUSH_QUESTIONS[nextIdx]);
      } else {
        const compiledAyush = compileAyushSummary(ayushAnswers);
        compiledAyush.clarifyingHistory = combinedHistory;
        triggerPatientReadBack({
          finalAnswers: Object.values(ayushAnswers),
          finalRedFlags: [],
          ayushData: compiledAyush
        });
      }
      return;
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

    // If patient described custom symptoms in free text, elicit ONE clarifying question from LLM
    if (freeText && freeText.trim() && !hasAskedAyushClarify) {
      setIsAyushThinking(true);
      setVoiceText('');
      try {
        const res = await fetch('http://localhost:3000/api/dialogue/ayush-clarify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            freeText: freeText.trim(),
            complaintTitle: 'Ayurvedic Intake',
            currentAnswers: Object.values(updatedAyushAnswers),
            patientMetadata: {
              age: verifiedPatient?.age || 35,
              gender: verifiedPatient?.gender || 'Unknown',
              language: selectedLanguage
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.question) {
            setAyushClarifyingQuestion(data.question);
            setHasAskedAyushClarify(true);
            setIsAyushThinking(false);
            const qText = (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
              ? data.question.questionHi
              : data.question.questionEn;
            speakText(qText, selectedLanguage);
            return;
          }
        }
      } catch (err) {
        console.warn('[Kiosk] Error fetching Ayurvedic clarification:', err);
      } finally {
        setIsAyushThinking(false);
      }
    }

    if (ayushQuestionIndex < AYUSH_QUESTIONS.length - 1) {
      const nextIdx = ayushQuestionIndex + 1;
      setAyushQuestionIndex(nextIdx);
      setVoiceText('');
      speakCurrentAyushQuestion(AYUSH_QUESTIONS[nextIdx]);
    } else {
      const compiledAyush = compileAyushSummary(updatedAyushAnswers);
      if (ayushClarifyingHistory) {
        compiledAyush.clarifyingHistory = ayushClarifyingHistory;
      }
      triggerPatientReadBack({
        finalAnswers: Object.values(updatedAyushAnswers),
        finalRedFlags: [],
        ayushData: compiledAyush
      });
    }
  };

  const [submissionError, setSubmissionError] = useState(null);

  // Session Submission
  const handleSubmitSession = async ({ finalAnswers, finalRedFlags, ayushData }) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    cancelSpeech();

    const payload = {
      sessionId,
      complaintId: selectedComplaint?.id || (isAyushFlow ? 'ayush_consultation' : 'general'),
      complaintTitle: isAyushFlow 
        ? (selectedLanguage === 'हिंदी' ? AYUSH_COMPLAINT_META.titleHi : AYUSH_COMPLAINT_META.titleEn)
        : ((selectedLanguage === 'हिंदी' ? selectedComplaint?.titleHi : selectedComplaint?.titleEn) || 'General Check-In'),
      language: selectedLanguage,
      patientDetails: verifiedPatient ? {
        id: verifiedPatient.id,
        name: verifiedPatient.name,
        age: verifiedPatient.age,
        gender: verifiedPatient.gender,
        mobile: verifiedPatient.mobile,
        address: verifiedPatient.address
      } : {
        name: 'Walk-in Patient',
        age: 30,
        gender: 'Male',
        mobile: '9898575254',
        address: 'Pune OPD'
      },
      consentStatus: 'GRANTED',
      consentTimestamp: new Date().toISOString(),
      granularConsent: consentToggles,
      answers: finalAnswers,
      redFlagsTriggered: finalRedFlags || [],
      digitizedDocument: extractedDocData || null,
      ayushAssessment: ayushData || null,
      vitals: vitalsData || null
    };

    try {
      const token = localStorage.getItem('patientToken') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('http://localhost:3000/api/session/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setSubmittedSession(data.session);
        setStep('submitted');
        pushTelemetry('success', 'Session sent to Doctor Queue.');
        narrate(
          selectedLanguage === 'हिंदी'
            ? 'धन्यवाद! आपकी जानकारी दर्ज कर ली गई है। कृपया प्रतीक्षा कक्ष में बैठें।'
            : 'Thank you! Your check-in is complete. Please relax in the waiting area until your token is called.'
        );
      } else {
        throw new Error(data.message || 'Failed to persist session record in database');
      }
    } catch (err) {
      console.error('[Kiosk] Backend response issue:', err);
      setSubmissionError(err.message || 'Submission error. Record could not be saved to backend.');
      narrate('Submission failed. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    cancelSpeech();
    setStep('patient_auth');
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
    setVerifiedPatient(null);
    setAuthError(null);
    setAuthSuccessMessage(null);
  };

  return (
    <div className={`min-h-screen flex flex-col p-4 md:p-8 select-none font-sans transition-colors duration-500 ${isDarkMode ? 'dark-theme bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Kiosk Header */}
      <header className="bg-slate-900 text-white p-4 md:p-5 rounded-3xl shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 border-b-2 border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-sm flex items-center justify-center">
            <HeartPulse className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">MediKiosk Touch Portal</h1>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold px-2 py-0.5 rounded">
                Sandbox Mode
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-400/30">
                Self-Service OPD
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium">Multi-lingual triage intake & AYUSH assessment</p>
          </div>
        </div>

        {/* Global Controls: Language & Audio Narration */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'}`}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

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

      {/* Red Flag Alert Banner */}
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
              <p className="text-xs text-red-100 mt-0.5">Duty nurse notified at Counter 1.</p>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Hallway Offline / Graceful Degradation Banner (Phase 10) */}
      {isOfflineMode && (
        <div 
          role="alert" 
          aria-live="polite"
          className="max-w-4xl mx-auto w-full mb-5 bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex items-center justify-between gap-3 text-amber-950 shadow-sm animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200/60 rounded-xl text-amber-800 flex-shrink-0">
              <WifiOff className="w-6 h-6 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                  Hallway Offline Safe Mode
                </span>
                <span className="text-[11px] text-amber-800 font-bold">Kiosk Operational</span>
              </div>
              <p className="text-xs font-semibold text-amber-950 mt-1">
                {selectedLanguage === 'हिंदी'
                  ? 'अस्पताल सर्वर नेटवर्क अस्थाई रूप से अनुपलब्ध है। आपका चेक-इन बिना रुकावट चालू रहेगा — टोकन स्थानीय रूप से सुरक्षित है और सर्वर उपलब्ध होते ही प्रेषित होगा।'
                  : 'Hospital server connection unavailable. Kiosk continues operating in local offline mode — your intake is safely saved and will synchronize automatically.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-black bg-white text-amber-900 px-2.5 py-1 rounded-xl border border-amber-300 flex-shrink-0">
            LOCAL ENGINE
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EXPLICIT AUDIO-NARRATED CONSENT SCREEN                                 */}
      {/* ========================================================================= */}
      {/* 1. PATIENT AUTHENTICATION SCREEN (LOGIN & SIGN UP)                        */}
      {/* ========================================================================= */}
      {step === 'patient_auth' && (
        <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-full mb-2 border border-blue-200">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Patient Access Portal
                </span>
              </div>
              <button
                onClick={() => setStep('enter_token')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer text-sm"
              >
                <ClipboardList className="w-4 h-4" />
                View My Prescription
              </button>
            </div>
            <div className="text-center max-w-xl mx-auto">
              <h2 className="text-2xl font-black text-slate-900">
                {selectedLanguage === 'हिंदी' ? 'रोगी लॉगिन और पंजीकरण' : 'Patient Sign In & Registration'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {selectedLanguage === 'हिंदी'
                  ? 'अपने मोबाइल नंबर और पासवर्ड से लॉगिन करें या नया खाता बनाएं।'
                  : 'Log in with your Mobile Number and Password, or Sign Up to create your patient account.'}
              </p>
            </div>

            {/* Registration Success Banner */}
            {authSuccessMessage && (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 flex items-start gap-3 text-emerald-950 animate-fadeIn shadow-sm max-w-2xl mx-auto w-full">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-extrabold text-emerald-950">
                    {selectedLanguage === 'हिंदी' ? 'सफलतापूर्वक पंजीकृत' : 'Registration Complete'}
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 font-medium leading-relaxed">
                    {authSuccessMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {authError && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 text-red-900 animate-fadeIn shadow-sm max-w-2xl mx-auto w-full">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-extrabold text-red-950">
                    {selectedLanguage === 'हिंदी' ? 'त्रुटि संदेश' : 'Authentication Notice'}
                  </h4>
                  <p className="text-xs text-red-800 mt-1 font-medium leading-relaxed">
                    {authError}
                  </p>
                </div>
              </div>
            )}

            {/* LOGIN, SIGNUP & OTP FORMS (When not authenticated) */}
            {!verifiedPatient && (
              <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
                
                {/* OTP VERIFICATION STEP */}
                {showOtpStep ? (
                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-3xl p-6 animate-fadeIn text-center">
                    <h3 className="text-xl font-black text-slate-800">Enter OTP</h3>
                    <p className="text-sm text-slate-600 mb-2">We sent a 6-digit OTP to your email address.</p>
                    
                    <div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpValue}
                        onChange={(e) => {
                          setOtpValue(e.target.value.replace(/[^0-9]/g, ''));
                          setAuthError(null);
                        }}
                        placeholder="000000"
                        className="w-full text-center p-4 text-2xl font-mono font-bold tracking-[0.5em] bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isOtpLoading || otpValue.length < 6}
                      className="mt-4 py-4 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{isOtpLoading ? 'Verifying...' : 'Verify OTP'}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => { setShowOtpStep(false); setOtpValue(''); }}
                      className="mt-2 text-sm text-slate-500 hover:text-slate-800 font-bold"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    {/* Tabs */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => { setAuthTab('login'); setAuthError(null); }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authTab === 'login' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>🔑 Log In (Existing Patient)</span>
                  </button>
                  <button
                    onClick={() => { setAuthTab('signup'); setAuthError(null); }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authTab === 'signup' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>📝 Sign Up (New Patient)</span>
                  </button>
                </div>

                {/* TAB 1: LOGIN FORM */}
                {authTab === 'login' && (
                  <form onSubmit={handlePatientLogin} className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-3xl p-6 animate-fadeIn">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">Registered Mobile Number *</label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          value={loginForm.mobile}
                          onChange={(e) => {
                            setLoginForm({ ...loginForm, mobile: e.target.value });
                            setAuthError(null);
                          }}
                          placeholder="e.g. 9876543210"
                          className="w-full p-3.5 pl-11 text-sm font-mono font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                        <Smartphone className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">Email Address *</label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={loginForm.email}
                          onChange={(e) => {
                            setLoginForm({ ...loginForm, email: e.target.value });
                            setAuthError(null);
                          }}
                          placeholder="e.g. email@example.com"
                          className="w-full p-3.5 pl-11 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                        <Globe className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">Password *</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={loginForm.password}
                          onChange={(e) => {
                            setLoginForm({ ...loginForm, password: e.target.value });
                            setAuthError(null);
                          }}
                          placeholder="Enter your password"
                          className="w-full p-3.5 pl-11 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                        <Key className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="mt-2 py-4 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isAuthLoading ? 'Authenticating...' : 'Sign In to Patient Portal'}</span>
                    </button>
                  </form>
                )}

                {/* TAB 2: SIGN UP FORM */}
                {authTab === 'signup' && (
                  <form onSubmit={handlePatientSignup} className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-3xl p-6 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Full Patient Name *</label>
                        <input
                          type="text"
                          required
                          value={signupForm.name}
                          onChange={(e) => {
                            setSignupForm({ ...signupForm, name: e.target.value });
                            setAuthError(null);
                          }}
                          placeholder="e.g. Prathamesh Khatri"
                          className="w-full p-3 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number *</label>
                        <input
                          type="tel"
                          required
                          value={signupForm.mobile}
                          onChange={(e) => {
                            setSignupForm({ ...signupForm, mobile: e.target.value });
                            setAuthError(null);
                          }}
                          placeholder="e.g. 9998003660"
                          className="w-full p-3 text-sm font-mono font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={signupForm.email}
                        onChange={(e) => {
                          setSignupForm({ ...signupForm, email: e.target.value });
                          setAuthError(null);
                        }}
                        placeholder="e.g. email@example.com"
                        className="w-full p-3 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Create Password *</label>
                      <input
                        type="password"
                        required
                        value={signupForm.password}
                        onChange={(e) => {
                          setSignupForm({ ...signupForm, password: e.target.value });
                          setAuthError(null);
                        }}
                        placeholder="Choose a secure password (min 4 chars)"
                        className="w-full p-3 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Age (Years)</label>
                        <input
                          type="number"
                          value={signupForm.age}
                          onChange={(e) => setSignupForm({ ...signupForm, age: e.target.value })}
                          placeholder="e.g. 28"
                          className="w-full p-3 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Gender</label>
                        <select
                          value={signupForm.gender}
                          onChange={(e) => setSignupForm({ ...signupForm, gender: e.target.value })}
                          className="w-full p-3 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">City / Residential Address</label>
                      <input
                        type="text"
                        value={signupForm.address}
                        onChange={(e) => setSignupForm({ ...signupForm, address: e.target.value })}
                        placeholder="e.g. Shivaji Nagar, Pune, Maharashtra"
                        className="w-full p-3 text-sm font-bold bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="mt-2 py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isAuthLoading ? 'Creating Account...' : 'Register & Sign In'}</span>
                    </button>
                  </form>
                )}
                </>
                )}
              </div>
            )}

            {/* VERIFIED PATIENT LOGGED-IN CARD */}
            {verifiedPatient && (
              <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full animate-fadeIn">
                <div className="bg-emerald-50/80 border-2 border-emerald-300 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <h3 className="text-base font-extrabold text-emerald-950">Patient Authenticated</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditProfileForm({
                            name: verifiedPatient.name || '',
                            age: verifiedPatient.age || 28,
                            gender: verifiedPatient.gender || 'Male',
                            address: verifiedPatient.address || '',
                            mobile: verifiedPatient.mobile || ''
                          });
                          setIsEditingProfile(!isEditingProfile);
                        }}
                        className="text-xs font-bold bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100 px-3 py-1 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{isEditingProfile ? 'Cancel Edit' : '✏️ Edit Profile'}</span>
                      </button>
                      <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-sm">
                        Active Profile
                      </span>
                    </div>
                  </div>

                  {!isEditingProfile ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="relative group">
                        {patientFacePhoto ? (
                          <img
                            src={patientFacePhoto}
                            alt="Patient KYC"
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-md flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md flex-shrink-0">
                            {verifiedPatient.name ? verifiedPatient.name[0] : 'P'}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setCameraModalMode('face');
                            setIsCameraModalOpen(true);
                          }}
                          title="Take Live Face Photo"
                          className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-full shadow border border-white transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-black text-slate-900">{verifiedPatient.name}</h4>
                          {patientFacePhoto && (
                            <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                              Face Verified
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-700 mt-1">
                          👤 {verifiedPatient.gender}, Age: {verifiedPatient.age} Y • 📱 Mobile: +91 {verifiedPatient.mobile}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 flex items-start gap-1">
                          <span>📍</span>
                          <span><strong>Address:</strong> {verifiedPatient.address || 'Registered Citizen'}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Inline Profile Edit Form */
                    <form onSubmit={handleSaveProfileEdit} className="flex flex-col gap-3 bg-white p-4 rounded-2xl border border-emerald-200">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Update Patient Demographics:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Full Name</label>
                          <input
                            type="text"
                            required
                            value={editProfileForm.name}
                            onChange={(e) => setEditProfileForm({ ...editProfileForm, name: e.target.value })}
                            className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Mobile Number</label>
                          <input
                            type="text"
                            value={editProfileForm.mobile}
                            onChange={(e) => setEditProfileForm({ ...editProfileForm, mobile: e.target.value })}
                            className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Age (Years)</label>
                          <input
                            type="number"
                            value={editProfileForm.age}
                            onChange={(e) => setEditProfileForm({ ...editProfileForm, age: e.target.value })}
                            className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Gender</label>
                          <select
                            value={editProfileForm.gender}
                            onChange={(e) => setEditProfileForm({ ...editProfileForm, gender: e.target.value })}
                            className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Residential Address / City</label>
                        <input
                          type="text"
                          value={editProfileForm.address}
                          onChange={(e) => setEditProfileForm({ ...editProfileForm, address: e.target.value })}
                          className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="submit"
                          disabled={isSavingEdit}
                          className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-lg shadow cursor-pointer disabled:opacity-50"
                        >
                          {isSavingEdit ? 'Saving...' : '💾 Save & Update Database'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleProceedToConsent}
                    className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>{selectedLanguage === 'हिंदी' ? 'सहमति व लक्षण चयन की ओर बढ़ें' : 'Proceed to Consent & Consultation'}</span>
                    <ArrowRight className="w-5 h-5 text-amber-300" />
                  </button>

                  <button
                    onClick={() => { setVerifiedPatient(null); setInputAbhaOrMobile(''); setAbhaError(null); }}
                    className="py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl border border-slate-300 cursor-pointer"
                  >
                    Different Patient
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 1B. AUDIO-GUIDED GRANULAR DPDP ACT CONSENT AUTHORIZATION SCREEN          */}
      {/* ========================================================================= */}
      {step === 'dpdp_consent' && (
        <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 my-auto animate-fadeIn">
          <div className="bg-white border-2 border-emerald-300 rounded-3xl p-8 shadow-xl w-full flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                <ShieldCheck className="w-8 h-8 text-emerald-700" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  DPDP Act 2023 & ABDM Compliance
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                    ? 'रोगी सहमति व डेटा सुरक्षा अधिकार'
                    : 'Patient Consent & Data Protection Authorization'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                    ? 'आपकी सहमति के बिना कोई भी स्वास्थ्य डेटा किसी अन्य पक्ष को नहीं दिया जाएगा।'
                    : 'Your clinical data is protected and never shared without explicit consent.'}
                </p>
              </div>
            </div>

            {/* Audio Explanation Strip */}
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-5 h-5 text-emerald-700 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-emerald-950">
                  {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                    ? 'ऑडियो द्वारा सहमति विवरण सुनें'
                    : 'Audio-guided consent narration available'}
                </span>
              </div>
              <button
                onClick={() => {
                  cancelSpeech();
                  const txt = (selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                    ? 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 के तहत, आपकी सहमति से ही अस्पताल कियोस्क पर आपके लक्षण व स्वास्थ्य रिकॉर्ड दर्ज किए जाएंगे। यह जानकारी केवल आपके डॉक्टर के परामर्श के लिए सुरक्षित रूप से साझा की जाएगी। आप कभी भी इसे निरस्त कर सकते हैं।'
                    : 'Under the Digital Personal Data Protection Act 2023, your symptoms and clinical records are captured only with your explicit consent. This data is securely shared with your consulting physician and optional ABHA health locker. You retain the full right to revoke this consent at any time.';
                  narrate(txt);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" /> Replay Audio
              </button>
            </div>

            {/* Granular Consent Checkbox Toggles */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-emerald-50/40 transition-colors">
                <input
                  type="checkbox"
                  checked={consentToggles.allowDataCapture}
                  onChange={(e) => setConsentToggles({ ...consentToggles, allowDataCapture: e.target.checked })}
                  className="w-5 h-5 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <strong className="text-xs font-black text-slate-900 block">
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? '1. ओपीडी ट्रायज हेतु लक्षण व स्वास्थ्य डेटा संग्रह (आवश्यक)'
                      : '1. Symptom & Clinical Data Intake for OPD Triage (Required)'}
                  </strong>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? 'डॉक्टर को पूर्व-मूल्यांकन नोट तैयार करने के लिए आपके उत्तर व दस्तावेज प्रोसेस किए जाएंगे।'
                      : 'Allows capturing your responses and digitized prescriptions to prepare the physician summary.'}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-emerald-50/40 transition-colors">
                <input
                  type="checkbox"
                  checked={consentToggles.allowHisSharing}
                  onChange={(e) => setConsentToggles({ ...consentToggles, allowHisSharing: e.target.checked })}
                  className="w-5 h-5 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <strong className="text-xs font-black text-slate-900 block">
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? '2. अस्पताल ईएमआर / डॉक्टर डैशबोर्ड के साथ सुरक्षित साझाकरण (अनुशंसित)'
                      : '2. Secure Transmission to Hospital EMR & Doctor Dashboard (Recommended)'}
                  </strong>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? 'परामर्श कक्ष में उपस्थित डॉक्टर के कंप्यूटर पर यह नैदानिक सारांश स्वतः प्रेषित होगा।'
                      : 'Enables your treating doctor in Room 104 to review your findings before you enter the chamber.'}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-emerald-50/40 transition-colors">
                <input
                  type="checkbox"
                  checked={consentToggles.allowAbdmLinking}
                  onChange={(e) => setConsentToggles({ ...consentToggles, allowAbdmLinking: e.target.checked })}
                  className="w-5 h-5 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <strong className="text-xs font-black text-slate-900 block">
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? '3. आयुष्मान भारत (ABHA) हेल्थ लॉकर लिंकेज (वैकल्पिक)'
                      : '3. National Ayushman Bharat (ABHA) Health Locker Linkage (Optional)'}
                  </strong>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? 'आपका यह परामर्श रिकॉर्ड आपके राष्ट्रीय ABHA खाते से लिंक होगा।'
                      : 'Links this OPD consultation record to your ABDM personal health record app.'}
                  </span>
                </div>
              </label>
            </div>

            {/* Action Buttons: Agree vs Decline */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => {
                  cancelSpeech();
                  setVerifiedPatient(null);
                  setStep('patient_auth');
                }}
                className="w-full sm:w-1/3 py-3.5 rounded-2xl font-black text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer text-center"
              >
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? 'अस्वीकार करें व बाहर निकलें' : 'Decline & Exit'}
              </button>

              <button
                disabled={!consentToggles.allowDataCapture}
                onClick={handleConsentAccepted}
                className={`w-full sm:w-2/3 py-3.5 rounded-2xl font-black text-sm text-white transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                  consentToggles.allowDataCapture 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                  ? 'सहमति प्रदान करें और आगे बढ़ें'
                  : 'Grant Consent & Proceed to Consultation'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 3. CHIEF COMPLAINT SELECTION SCREEN                                       */}
      {/* ========================================================================= */}
      {step === 'complaint_selection' && (
        <main className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-full mb-2 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Guided OPD Check-In
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
              {selectedLanguage === 'हिंदी' ? 'अपनी मुख्य समस्या चुनें' : 'What is your main health concern today?'}
            </h2>
            <p className="text-sm text-slate-600">
              {selectedLanguage === 'हिंदी' 
                ? 'नीचे दिए गए 6 विकल्पों में से चुनें। हम आपसे कुछ सरल प्रश्न पूछेंगे।'
                : 'Select one of the 6 options below to begin your consultation intake.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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

            {/* 6th Option: AYUSH Consultation */}
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
        </main>
      )}

      {/* ========================================================================= */}
      {/* 4. OPTIONAL DOCUMENT DIGITIZATION STEP                                    */}
      {/* ========================================================================= */}
      {step === 'doc_digitization' && (
        <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <button 
              onClick={() => setStep('complaint_selection')}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-bold text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Complaints
            </button>
            <span className="text-xs font-bold uppercase bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
              Selected: {isAyushFlow ? 'Ayurvedic Intake' : (selectedLanguage === 'हिंदी' ? selectedComplaint?.titleHi : selectedComplaint?.titleEn)}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-800 text-xs font-bold rounded-full mb-2 border border-purple-200">
                <FileText className="w-3.5 h-3.5 text-purple-600" /> Optional Document OCR Digitization
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                {selectedLanguage === 'हिंदी' 
                  ? 'पिछला पर्चा, एक्स-रे या लैब रिपोर्ट स्कैन करें' 
                  : 'Upload Previous Prescription, X-Ray or Lab Report'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {selectedLanguage === 'हिंदी'
                  ? 'हमारा AI स्कैनर आपकी पिछली दवाइयां, एक्स-रे रिपोर्ट और टेस्ट रिपोर्ट को स्वचालित रूप से पढ़ लेगा।'
                  : 'Our smart OCR engine will extract your medications, dosages, radiology findings, and relevant lab metrics.'}
              </p>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUploadChange} 
              accept="image/*,.pdf" 
              className="hidden" 
            />

            {isOcrProcessing && (
              <div className="p-8 bg-purple-50/70 border-2 border-dashed border-purple-300 rounded-2xl flex flex-col items-center justify-center gap-4 text-center animate-pulse">
                <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg animate-spin">
                  <RefreshCw className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-purple-950">AI Document Engine Extracting Records...</h3>
                  <p className="text-xs text-purple-700 mt-1 font-medium">
                    Scanning {uploadedDocName} • Parsing relevant clinical markers & radiology findings
                  </p>
                </div>
              </div>
            )}

            {!isOcrProcessing && !extractedDocData && (
              <div className="flex flex-col gap-5">
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
                      <span className="text-xs text-slate-500">Supports JPG, PNG, Scanned Reports & X-Rays</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setCameraModalMode('document');
                      setIsCameraModalOpen(true);
                    }}
                    className="p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <span className="text-base font-bold text-emerald-950 block">Capture with Kiosk Camera</span>
                      <span className="text-xs text-slate-500">Live optical scanner with viewfinder</span>
                    </div>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleSkipDocumentAndProceed}
                    className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <span>{selectedLanguage === 'हिंदी' ? 'दस्तावेज़ नहीं है (सीधे प्रश्न पूछें)' : 'Skip Document Upload (Proceed to Questions)'}</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Extracted Data Confirmation Screen with Clean Interactive Tables & Error Eraser */}
            {!isOcrProcessing && extractedDocData && (
              <DigitizedDocumentTable
                documentData={extractedDocData}
                selectedLanguage={selectedLanguage}
                onChange={(updated) => setExtractedDocData(updated)}
                onConfirm={(confirmedData) => {
                  setExtractedDocData(confirmedData);
                  handleConfirmDocumentAndProceed();
                }}
                onRescan={() => {
                  setExtractedDocData(null);
                  setUploadedDocName('');
                }}
              />
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 5A. ALLOPATHIC SOCRATES QUESTIONS                                         */}
      {/* ========================================================================= */}
      {step === 'questions' && selectedComplaint && (
        <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500">
              <button 
                onClick={() => setStep('complaint_selection')}
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Change Complaint
              </button>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 border border-slate-200">
                Question {Object.keys(answers).length + 1} {currentDynamicQuestion ? '' : `of ${selectedComplaint.questions.length}`} • <strong>{(currentDynamicQuestion || selectedComplaint.questions[currentQuestionIndex]).dimension || "Adaptive Check"}</strong>
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / selectedComplaint.questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden">
            {isSubmitting && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4 text-center p-6 animate-fadeIn">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg animate-spin">
                  <RefreshCw className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {selectedLanguage === 'हिंदी' ? 'ओपीडी टोकन दर्ज किया जा रहा है...' : 'Generating Your OPD Consultation Token...'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedLanguage === 'हिंदी' ? 'कृपया प्रतीक्षा करें, डेटाबेस में जानकारी सहेजी जा रही है' : 'Saving your clinical intake responses to the hospital database'}
                  </p>
                </div>
              </div>
            )}

            {isThinking ? (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 animate-pulse">
                <div className="relative">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin-slow" />
                  </div>
                  <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {selectedLanguage === 'हिंदी' ? 'डॉक्टर AI सोच रहा है...' : 'Doctor AI is thinking...'}
                  </h3>
                  <p className="text-slate-500 mt-1">
                    {selectedLanguage === 'हिंदी' 
                      ? 'आपके लक्षणों का विश्लेषण कर अगला प्रासंगिक प्रश्न तैयार किया जा रहा है' 
                      : 'Analyzing your symptoms to ask the most relevant follow-up question'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md mb-2 inline-block border border-blue-200">
                    {(currentDynamicQuestion || selectedComplaint.questions[currentQuestionIndex]).dimension || "Adaptive Check"} Assessment
                  </span>
                  {currentDynamicQuestion && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-1 rounded-md mb-2 inline-block border border-purple-200">
                      AI Generated
                    </span>
                  )}
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {selectedLanguage === 'हिंदी' 
                      ? (currentDynamicQuestion || selectedComplaint.questions[currentQuestionIndex]).questionHi 
                      : (currentDynamicQuestion || selectedComplaint.questions[currentQuestionIndex]).questionEn}
                  </h2>
                </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Touch Option:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentDynamicQuestion || selectedComplaint.questions[currentQuestionIndex]).options.map((opt, i) => (
                  <button
                    key={i}
                    disabled={isSubmitting}
                    onClick={() => handleAnswerQuestion(opt, '')}
                    className={`p-4 rounded-xl text-left font-bold text-sm border-2 transition-all cursor-pointer flex items-center justify-between ${
                      opt.isRedFlag
                        ? 'border-red-300 bg-red-50/50 hover:bg-red-100 text-red-900'
                        : 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-500 text-slate-800'
                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span>{selectedLanguage === 'हिंदी' ? opt.labelHi : opt.labelEn}</span>
                    {opt.isRedFlag && <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Waveform & Voice Visualizer */}
            <AudioWaveformVisualizer
              isListening={isListening}
              audioLevel={audioLevel}
              provider={getSpeechProvider()}
              showRecovery={showRecoveryBanner}
              onRetry={handleToggleVoice}
              lang={selectedLanguage}
              theme="blue"
            />

            {/* Voice section */}
            <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Or Speak Answer:</span>
              <div className="flex items-center gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={handleToggleVoice}
                  className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-slate-800 text-white hover:bg-slate-900'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-400" />}
                  {isListening ? 'Stop' : 'Tap Mic & Speak'}
                </button>

                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 min-h-[46px] flex items-center justify-between">
                  <span>
                    {isListening ? `Listening... ${voiceText}` : voiceText || 'Press mic and speak...'}
                  </span>
                  {voiceText && !isListening && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleAnswerQuestion(null, voiceText)}
                      className="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 5B. AYUSH DASHAVIDHA PARIKSHA QUESTIONS                                   */}
      {/* ========================================================================= */}
      {step === 'ayush_questions' && (
        <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500">
              <button 
                onClick={() => setStep('complaint_selection')}
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Change Path
              </button>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white font-extrabold px-2.5 py-0.5 rounded text-[11px]">
                  🌿 AYUSH Assessment
                </span>
                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 border border-slate-200">
                  Step {ayushQuestionIndex + 1} of {AYUSH_QUESTIONS.length}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${((ayushQuestionIndex + 1) / AYUSH_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden">
            {isSubmitting && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4 text-center p-6 animate-fadeIn">
                <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg animate-spin">
                  <RefreshCw className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {selectedLanguage === 'हिंदी' ? 'आयुष ओपीडी टोकन दर्ज किया जा रहा है...' : 'Generating Your AYUSH OPD Token...'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedLanguage === 'हिंदी' ? 'कृपया प्रतीक्षा करें, जानकारी डेटाबेस में सहेजी जा रही है' : 'Saving your Ayurvedic assessment to the hospital database'}
                  </p>
                </div>
              </div>
            )}

            {/* AI Ayurvedic Thinking State */}
            {isAyushThinking && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 text-emerald-950 animate-pulse">
                <Sparkles className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                <span className="text-xs font-bold">
                  {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                    ? 'आयुर्वेदिक दृष्टि (दोष/अग्नि/प्रकृति) से विश्लेषण किया जा रहा है...' 
                    : 'Analyzing symptoms within classical Ayurvedic framework...'}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                  {ayushClarifyingQuestion
                    ? `🌿 ${ayushClarifyingQuestion.dimension || 'Ayurvedic Clarification'}`
                    : ((selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                        ? AYUSH_QUESTIONS[ayushQuestionIndex].dimensionHi 
                        : AYUSH_QUESTIONS[ayushQuestionIndex].dimensionEn)}
                </span>
                {ayushClarifyingQuestion && (
                  <span className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" /> AI Vaidya Clarification
                  </span>
                )}
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {ayushClarifyingQuestion
                  ? ((selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? ayushClarifyingQuestion.questionHi 
                      : ayushClarifyingQuestion.questionEn)
                  : ((selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                      ? AYUSH_QUESTIONS[ayushQuestionIndex].questionHi 
                      : AYUSH_QUESTIONS[ayushQuestionIndex].questionEn)}
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Finding (Touch):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(ayushClarifyingQuestion ? ayushClarifyingQuestion.options : AYUSH_QUESTIONS[ayushQuestionIndex].options).map((opt, i) => (
                  <button
                    key={i}
                    disabled={isSubmitting || isAyushThinking}
                    onClick={() => handleAnswerAyushQuestion(opt, '')}
                    className={`p-4 rounded-xl text-left border-2 border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 transition-all cursor-pointer flex flex-col justify-between gap-2 group ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-950">
                      {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? opt.labelHi : opt.labelEn}
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

            {/* AYUSH Dynamic Waveform & Voice Visualizer */}
            <AudioWaveformVisualizer
              isListening={isListening}
              audioLevel={audioLevel}
              provider={getSpeechProvider()}
              showRecovery={showRecoveryBanner}
              onRetry={handleToggleVoice}
              lang={selectedLanguage}
              theme="emerald"
            />

            <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Or Speak Ayurvedic Symptoms:</span>
              <div className="flex items-center gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={handleToggleVoice}
                  className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-emerald-800 text-white hover:bg-emerald-900'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-300" />}
                  {isListening ? 'Stop' : 'Speak'}
                </button>

                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 min-h-[46px] flex items-center justify-between">
                  <span>
                    {isListening ? `Listening... ${voiceText}` : voiceText || 'Speak your lifestyle or appetite habits...'}
                  </span>
                  {voiceText && !isListening && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleAnswerAyushQuestion(null, voiceText)}
                      className="px-3 py-1 bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 5B. HARDWARE VITALS MOCKUP SCREEN                                         */}
      {/* ========================================================================= */}
      {step === 'vitals_scan' && (
        <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm w-full flex flex-col items-center gap-6">
            <h2 className="text-2xl font-black text-slate-900 text-center">
              {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? 'हार्डवेयर वाइटल्स स्कैन' : 'Hardware Vitals Scan'}
            </h2>
            <p className="text-slate-500 text-center text-sm mb-4">
              {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') 
                ? 'कृपया अपनी उंगली पल्स ऑक्सीमीटर में रखें और रक्तचाप कफ पहनें।' 
                : 'Please place your finger in the Pulse Oximeter and wear the Blood Pressure cuff.'}
            </p>

            {isScanningVitals ? (
              <div className="flex flex-col items-center gap-6 py-12">
                <div className="relative flex items-center justify-center w-32 h-32">
                  <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                  <div className="relative bg-blue-500 text-white p-6 rounded-full shadow-lg">
                    <Activity className="w-12 h-12 animate-pulse" />
                  </div>
                </div>
                <p className="text-blue-600 font-bold animate-pulse">
                  {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? 'ब्लूटूथ डिवाइस स्कैन हो रहा है...' : 'Scanning Bluetooth Devices...'}
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-6 animate-fadeIn">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-rose-500"><HeartPulse className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs font-bold text-rose-600/70 uppercase">Heart Rate</p>
                      <p className="text-2xl font-black text-slate-900">{vitalsData?.heartRate} <span className="text-sm font-medium text-slate-500">bpm</span></p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-blue-500"><Activity className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs font-bold text-blue-600/70 uppercase">Blood Pressure</p>
                      <p className="text-2xl font-black text-slate-900">{vitalsData?.bloodPressure} <span className="text-sm font-medium text-slate-500">mmHg</span></p>
                    </div>
                  </div>
                  <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-sky-500"><Wind className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs font-bold text-sky-600/70 uppercase">SpO2</p>
                      <p className="text-2xl font-black text-slate-900">{vitalsData?.oxygenSat}<span className="text-sm font-medium text-slate-500">%</span></p>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-amber-500"><Thermometer className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs font-bold text-amber-600/70 uppercase">Temperature</p>
                      <p className="text-2xl font-black text-slate-900">{vitalsData?.temperature} <span className="text-sm font-medium text-slate-500">°F</span></p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mt-4">
                  <button
                    onClick={proceedToReadBack}
                    className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-2"
                  >
                    {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? 'आगे बढ़ें' : 'Proceed'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 5C. PATIENT-FACING AUDIO READ-BACK & SUMMARY CONFIRMATION SCREEN          */}
      {/* ========================================================================= */}
      {step === 'summary_readback' && (
        <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 text-center my-auto animate-fadeIn">
          <div className="bg-white border-2 border-blue-200 rounded-3xl p-8 shadow-xl w-full flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center shadow-inner">
              <Volume2 className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <span className="text-xs font-black text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? 'परामर्श सारांश सत्यापन' : 'Consultation Summary Verification'}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                  ? 'कृपया अपना विवरण जांचें व पुष्टि करें'
                  : "Here's what we understood, please confirm"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                  ? 'ऑडियो सुनें या नीचे दिए गए सारांश की पुष्टि करके टोकन प्राप्त करें'
                  : 'Listen to the audio read-back or confirm below to issue your OPD token'}
              </p>
            </div>

            {/* Read-Back Spoken Speech Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 w-full text-left flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" /> Spoken Verification
                </span>
                <button
                  onClick={() => {
                    cancelSpeech();
                    speakText(patientReadBackText, selectedLanguage);
                    setIsPlayingReadBack(true);
                  }}
                  className="text-xs font-black text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Replay Audio
                </button>
              </div>

              <p className="text-sm font-semibold text-slate-800 leading-relaxed font-sans">
                "{patientReadBackText}"
              </p>
            </div>

            {submissionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-semibold w-full text-left flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Submission Error</strong>
                  <span>{submissionError}</span>
                </div>
              </div>
            )}

            {/* Action Buttons: Confirm vs Go Back to Edit */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                disabled={isSubmitting}
                onClick={() => {
                  cancelSpeech();
                  setStep(isAyushFlow ? 'ayush_questions' : 'questions');
                }}
                className="w-full sm:w-1/3 py-4 rounded-2xl font-black text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi') ? 'संशोधन करें' : 'Edit Responses'}
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => {
                  cancelSpeech();
                  if (pendingSubmissionData) {
                    handleSubmitSession(pendingSubmissionData);
                  }
                }}
                className={`w-full sm:w-2/3 py-4 rounded-2xl font-black text-sm text-white transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                  isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {(selectedLanguage === 'हिंदी' || selectedLanguage === 'Hindi')
                  ? 'पुष्टि करें और टोकन प्राप्त करें'
                  : 'Confirm & Issue OPD Token'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 6. SUBMITTED CONFIRMATION SCREEN (TOKEN & DATABASE DETAILS)               */}
      {/* ========================================================================= */}
      {step === 'submitted' && (
        <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 text-center my-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-lg w-full flex flex-col items-center gap-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                OPD Consultation Token Issued
              </span>
              <h2 className="text-4xl font-black text-slate-900 mt-1 font-mono tracking-tight text-blue-700">
                {submittedSession?.tokenNumber || 'K-104'}
              </h2>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 w-full text-left space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <div>
                  <strong className="text-base text-slate-900 block font-bold">{submittedSession?.patientDetails?.name || 'Registered Citizen'}</strong>
                  <span className="text-xs text-slate-600 font-medium">Mobile: +91 {submittedSession?.patientDetails?.mobile || '9898575254'}</span>
                </div>
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">
                  {submittedSession?.complaintTitle}
                </span>
              </div>

              {submittedSession?.digitizedDocument && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-700 flex-shrink-0" />
                  <span>Attached Records: {submittedSession.digitizedDocument.documentTitle}</span>
                </div>
              )}

              {submittedSession?.ayushAssessment && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <span>AYUSH Dashavidha Pariksha completed</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-semibold bg-emerald-50/60 p-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Synchronized with Hospital OPD EMR & Doctor Dashboard</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 max-w-md">
              {selectedLanguage === 'हिंदी'
                ? 'आपकी जानकारी अस्पताल के डेटाबेस में सुरक्षित रूप से दर्ज कर ली गई है। कृपया प्रतीक्षा कक्ष में बैठें।'
                : 'Your intake responses and patient details have been transmitted directly to the duty physician. Please take a seat in the waiting area.'}
            </p>

            <button
              onClick={handleRestart}
              className="mt-2 w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-base rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" /> Start New Patient Session
            </button>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* ENTER TOKEN FOR PRESCRIPTION                                              */}
      {/* ========================================================================= */}
      {step === 'enter_token' && (
        <main className="max-w-xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-6 text-center">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-lg w-full flex flex-col items-center gap-5">
            <ClipboardList className="w-12 h-12 text-purple-600 mb-2" />
            <h2 className="text-2xl font-black text-slate-900">View Patient Care Plan</h2>
            <p className="text-sm text-slate-600">Enter your Token Number (e.g. K-101) to securely fetch your doctor's prescription and dietary advice.</p>
            
            <form onSubmit={fetchCarePlan} className="w-full flex flex-col gap-4 mt-2">
              <input
                type="text"
                placeholder="Enter Token (K-XXX)"
                value={prescriptionToken}
                onChange={(e) => setPrescriptionToken(e.target.value)}
                className="w-full p-4 text-center text-xl font-bold bg-slate-50 border-2 border-slate-300 rounded-2xl focus:outline-none focus:border-purple-600 uppercase"
                required
              />
              {carePlanError && (
                <div className="bg-red-50 text-red-700 text-sm font-semibold p-3 rounded-xl border border-red-200">
                  {carePlanError}
                </div>
              )}
              <button
                type="submit"
                disabled={isFetchingCarePlan || !prescriptionToken}
                className="w-full py-4 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-base rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isFetchingCarePlan ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {isFetchingCarePlan ? 'Fetching Records...' : 'Access My Prescription'}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="mt-2 text-sm text-slate-500 font-bold hover:text-slate-800"
              >
                Back to Home
              </button>
            </form>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW CARE PLAN & PRESCRIPTION                                             */}
      {/* ========================================================================= */}
      {step === 'view_care_plan' && carePlanData && (
        <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col py-6 gap-6">
          <div className="flex justify-end gap-2 px-2">
            <button
              onClick={handleDownloadPDF}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition-all text-sm flex items-center gap-2 shadow-sm"
            >
              <FileText className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={handleRestart}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2 px-6 rounded-xl transition-all text-sm shadow-sm"
            >
              Close
            </button>
          </div>

          <div id="care-plan-content" className="bg-white border border-slate-200 rounded-lg p-10 md:p-14 shadow-sm flex flex-col gap-6 font-serif relative">
            {/* Header: Clinic/Hospital Info */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-2">
              <div className="flex flex-col">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">MediKiosk Health</h1>
                <p className="text-sm text-slate-600 font-medium">123 Wellness Avenue, Health City</p>
                <p className="text-sm text-slate-600 font-medium">Phone: +1 800 123 4567</p>
              </div>
              <div className="text-right flex flex-col">
                <h2 className="text-xl font-bold text-slate-800">{carePlanData.doctorName || 'Dr. Sunita Rao'}</h2>
                <p className="text-sm text-slate-500 italic">Consulting Physician</p>
              </div>
            </div>

            {/* Patient Details & Date */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-md border border-slate-100">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2 text-sm">
                  <span className="font-bold text-slate-700">Patient Name:</span>
                  <span className="text-slate-900">{carePlanData.patientName || 'Unknown Patient'}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="font-bold text-slate-700">Token Number:</span>
                  <span className="text-slate-900 uppercase font-mono bg-slate-200 px-1.5 rounded">{prescriptionToken}</span>
                </div>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-bold text-slate-700">Date:</span>
                <span className="text-slate-900">{carePlanData.date || new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Rx Symbol */}
            <div className="mt-4 mb-2 text-5xl font-serif text-slate-800 select-none">
              ℞
            </div>

            {/* Medicines List */}
            {carePlanData.carePlan?.medicines && carePlanData.carePlan.medicines.length > 0 && (
              <div className="mb-6">
                <ul className="space-y-4 pl-4">
                  {carePlanData.carePlan.medicines.map((med, idx) => (
                    <li key={idx} className="flex flex-col">
                      <strong className="text-slate-900 text-lg">{idx + 1}. {med.name}</strong>
                      <div className="flex items-center gap-4 text-sm text-slate-700 mt-1 pl-4">
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Dosage: {med.dosage}</span>
                        <span className="italic text-slate-600">Sig: {med.instructions}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 border-t border-slate-200 pt-6">
              {/* Dietary Advice */}
              {carePlanData.carePlan?.dietaryAdvice && carePlanData.carePlan.dietaryAdvice.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">Dietary Advice</h3>
                  <ul className="space-y-1.5 list-disc pl-4">
                    {carePlanData.carePlan.dietaryAdvice.map((advice, idx) => (
                      <li key={idx} className="text-sm text-slate-700">{advice}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* General Care Tips */}
              {carePlanData.carePlan?.careTips && carePlanData.carePlan.careTips.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">General Care & Recovery</h3>
                  <ul className="space-y-1.5 list-disc pl-4">
                    {carePlanData.carePlan.careTips.map((tip, idx) => (
                      <li key={idx} className="text-sm text-slate-700">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Doctor Signature Block */}
            <div className="mt-16 flex justify-end">
              <div className="text-center w-48">
                <div className="border-b border-slate-400 mb-2 h-10"></div>
                <p className="font-bold text-slate-800 text-sm">Signature</p>
                <p className="text-xs text-slate-500 mt-1">{carePlanData.doctorName || 'Dr. Sunita Rao'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Digitally signed & generated via MediKiosk</p>
              </div>
            </div>
            
            {/* Footer watermark or strict instruction */}
            <div className="absolute bottom-4 left-0 right-0 text-center opacity-40 select-none pointer-events-none">
                <p className="text-[10px] font-sans text-slate-400">This is a system generated document based on doctor's consultation.</p>
            </div>
          </div>
        </main>
      )}

      {/* Real Interactive Live Camera Scanner Modal */}
      <LiveCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        mode={cameraModalMode}
        title={
          cameraModalMode === 'face'
            ? 'Patient Live KYC Face Capture'
            : 'Kiosk High-Resolution Document Scanner'
        }
        onCapture={({ file, dataUrl, fileName }) => {
          if (cameraModalMode === 'document') {
            handleProcessDocument(fileName, 'auto', file);
          } else {
            setPatientFacePhoto(dataUrl);
          }
        }}
      />
    </div>
  );
}
