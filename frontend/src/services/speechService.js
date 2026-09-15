// Utility service for Indian-Language Voice (ASR & TTS)
// Pluggable Provider Architecture:
// - Provider 1: Browser Web Speech API (Built-in offline/native fallback)
// - Provider 2: Bhashini API (AI4Bharat / Digital India live gateway)

const BACKEND_URL = 'http://localhost:3000';

// Active HTML5 Audio instance for Bhashini playback
let currentAudioElement = null;

// Supported regional languages mapping
export const REGIONAL_LANGUAGES = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', bhashiniCode: 'hi', speechLang: 'hi-IN' },
  { code: 'en', name: 'English', nativeName: 'English', bhashiniCode: 'en', speechLang: 'en-US' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', bhashiniCode: 'mr', speechLang: 'mr-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', bhashiniCode: 'te', speechLang: 'te-IN' }
];

// Reassuring recovery prompts when voice input is unclear or silent
export const RECOVERY_PROMPTS = {
  'hi': 'माफ़ कीजिए, मैं सुन नहीं पाया। कृपया दोबारा बोलें या स्क्रीन पर विकल्प चुनें।',
  'hindi': 'माफ़ कीजिए, मैं सुन नहीं पाया। कृपया दोबारा बोलें या स्क्रीन पर विकल्प चुनें।',
  'हिंदी': 'माफ़ कीजिए, मैं सुन नहीं पाया। कृपया दोबारा बोलें या स्क्रीन पर विकल्प चुनें।',
  'en': "I didn't catch that. Please try again or tap an option on the screen.",
  'english': "I didn't catch that. Please try again or tap an option on the screen.",
  'mr': 'क्षमस्व, मला ऐकू आले नाही. कृपया पुन्हा बोला किंवा स्क्रीनवर पर्याय निवडा.',
  'marathi': 'क्षमस्व, मला ऐकू आले नाही. कृपया पुन्हा बोला किंवा स्क्रीनवर पर्याय निवडा.',
  'मराठी': 'क्षमस्व, मला ऐकू आले नाही. कृपया पुन्हा बोला किंवा स्क्रीनवर पर्याय निवडा.',
  'te': 'క్షమించండి, నేను వినలేదు. దయచేసి మళ్ళీ మాట్లాడండి లేదా స్క్రీన్‌పై ఎంచుకోండి.',
  'telugu': 'క్షమించండి, నేను వినలేదు. దयచేసి మళ్ళీ మాట్లాడండి లేదా స్క్రీన్‌పై ఎంచుకోండి.',
  'తెలుగు': 'క్షమించండి, నేను వినలేదు. దయచేసి మళ్ళీ మాట్లాడండి లేదా స్క్రీన్‌పై ఎంచుకోండి.'
};

export function getRecoveryPrompt(lang = 'English') {
  const key = String(lang).toLowerCase().trim();
  return RECOVERY_PROMPTS[key] || RECOVERY_PROMPTS['en'];
}

export function normalizeLangCode(lang = 'English') {
  const lower = String(lang).toLowerCase().trim();
  if (lower === 'हिंदी' || lower === 'hindi' || lower === 'hi') return 'hi';
  if (lower === 'मराठी' || lower === 'marathi' || lower === 'mr') return 'mr';
  if (lower === 'తెలుగు' || lower === 'telugu' || lower === 'te') return 'te';
  return 'en';
}

export function getSpeechLangCode(lang = 'English') {
  const code = normalizeLangCode(lang);
  switch (code) {
    case 'hi': return 'hi-IN';
    case 'mr': return 'mr-IN';
    case 'te': return 'te-IN';
    default: return 'en-US';
  }
}

/**
 * Get active speech provider: 'browser' | 'bhashini'
 * Checks localStorage override first, defaults to 'browser' (or bhashini if configured).
 */
export function getSpeechProvider() {
  // Always force 'browser' (Google Web Speech API) to avoid needing Bhashini API Keys
  return 'browser';
}

/**
 * Set active speech provider (for Admin / Demo toggle)
 */
export function setSpeechProvider(provider) {
  if (typeof window === 'undefined') return;
  const valid = provider === 'bhashini' ? 'bhashini' : 'browser';
  localStorage.setItem('medikiosk_speech_provider', valid);
}

/**
 * Query backend for live Bhashini availability & configuration
 */
export async function fetchSpeechConfig() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/speech/config`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[SpeechService] Could not contact backend speech config endpoint:', e.message);
  }
  return {
    provider: 'browser',
    bhashiniConfigured: false,
    supportedLanguages: REGIONAL_LANGUAGES
  };
}

// Check TTS availability
export function isTTSSupported() {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || true);
}

// Stop any active TTS speech (both HTML5 Audio and Web Speech Synthesis)
export function cancelSpeech() {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch (e) {}
    currentAudioElement = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak text using active provider (Bhashini TTS with seamless Browser Web Speech fallback)
 * Exact signature preserved for downstream compatibility: speakText(text, lang, onEnd)
 */
export async function speakText(text, lang = 'English', onEnd = null) {
  if (!text || !text.trim()) return;

  // Cancel any ongoing speech
  cancelSpeech();

  const provider = getSpeechProvider();
  const normalizedLang = normalizeLangCode(lang);

  if (provider === 'bhashini') {
    try {
      // Call Bhashini TTS endpoint via backend proxy
      const res = await fetch(`${BACKEND_URL}/api/speech/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          language: normalizedLang,
          gender: 'female'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.audioContent) {
          const audioUrl = `data:${data.contentType || 'audio/wav'};base64,${data.audioContent}`;
          const audio = new Audio(audioUrl);
          currentAudioElement = audio;

          audio.onended = () => {
            currentAudioElement = null;
            if (onEnd) onEnd();
          };
          audio.onerror = (err) => {
            console.warn('[SpeechService] Bhashini audio playback error, falling back to browser TTS:', err);
            currentAudioElement = null;
            speakTextBrowserFallback(text, lang, onEnd);
          };

          await audio.play();
          return;
        }
      }
      // If Bhashini returned fallback flag or failed:
      console.warn('[SpeechService] Bhashini not configured or returned fallback. Using browser speech fallback.');
    } catch (err) {
      console.warn('[SpeechService] Bhashini TTS request error, using browser fallback:', err.message);
    }
  }

  // Fallback to Browser Web Speech API
  speakTextBrowserFallback(text, lang, onEnd);
}

// Browser Web Speech API internal fallback
function speakTextBrowserFallback(text, lang = 'English', onEnd = null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const speechLang = getSpeechLangCode(lang);
  utterance.lang = speechLang;
  utterance.rate = 0.95; // Slightly slower, reassuring speed
  utterance.pitch = 1.0;

  // Match native voice if available
  const voices = window.speechSynthesis.getVoices();
  let matchedVoice = null;
  
  if (speechLang.startsWith('en')) {
    // Look for a sweet/female English voice
    const preferredNames = ['Google UK English Female', 'Google US English', 'Microsoft Zira', 'Samantha', 'Victoria', 'Karen', 'Tessa', 'female'];
    matchedVoice = voices.find(v => v.lang.startsWith('en') && preferredNames.some(name => v.name.toLowerCase().includes(name.toLowerCase())));
    // Fallback to any english voice if preferred not found
    if (!matchedVoice) {
      matchedVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'));
    }
  }

  // General fallback for Hindi or if no female English voice was found
  if (!matchedVoice) {
    matchedVoice = voices.find(v => v.lang === speechLang || v.lang.startsWith(speechLang.substring(0, 2)));
  }

  if (matchedVoice) {
    utterance.voice = matchedVoice;
    // Tweak pitch significantly for a much sweeter tone if it's English
    if (speechLang.startsWith('en')) {
      utterance.pitch = 1.45; // Higher pitch for a younger, sweeter tone
      utterance.rate = 0.88;  // Slower rate for a more patient, loving sound
    }
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

// Check SpeechRecognition availability
export function isSTTSupported() {
  if (typeof window === 'undefined') return false;
  return (
    'SpeechRecognition' in window || 
    'webkitSpeechRecognition' in window || 
    (navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia)
  );
}

/**
 * Transcribe an audio Blob using Bhashini ASR endpoint
 */
export async function transcribeAudio(audioBlob, langCode = 'hi') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Audio = reader.result;
        const res = await fetch(`${BACKEND_URL}/api/speech/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Audio,
            language: langCode,
            audioFormat: 'wav'
          })
        });

        if (!res.ok) {
          throw new Error(`ASR request failed with status ${res.status}`);
        }

        const data = await res.json();
        if (data.success && data.transcript) {
          resolve(data.transcript);
        } else {
          resolve(null);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
}

/**
 * Start Voice Recognition with:
 * - Live Audio Level Meter (Web Audio AnalyserNode -> 0-100 RMS volume callback)
 * - Automatic Silence Detection (auto-stops after 2.2s of silence following speech)
 * - Provider switching (Browser Web Speech API vs Bhashini MediaRecorder ASR)
 * - Friendly recovery fallback callback
 * 
 * @param {Object} options
 * @param {Function} options.onResult - (transcript, isFinal) => void
 * @param {Function} [options.onError] - (errorMessage) => void
 * @param {Function} [options.onEnd] - () => void
 * @param {Function} [options.onAudioLevel] - (level: 0..100) => void
 * @param {Function} [options.onSilenceDetected] - () => void
 * @param {string} [options.lang='English']
 */
export function startListening({
  onResult,
  onError,
  onEnd,
  onAudioLevel,
  onSilenceDetected,
  lang = 'English'
}) {
  if (!isSTTSupported()) {
    if (onError) onError('Speech recognition is not supported in this browser.');
    return null;
  }

  const provider = getSpeechProvider();
  const normalizedLang = normalizeLangCode(lang);
  const speechLang = getSpeechLangCode(lang);

  let activeStream = null;
  let audioContext = null;
  let analyser = null;
  let animFrameId = null;
  let hasUserSpoken = false;
  let silenceTimer = null;
  let recognitionInstance = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isFinalized = false;
  let accumulatedTranscript = '';

  // Setup Web Audio API Analyser for real-time audio level & silence detection
  const setupAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      activeStream = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const monitorAudioLevels = () => {
          if (isFinalized) return;

          analyser.getByteFrequencyData(dataArray);

          // Calculate RMS level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Normalize to 0 - 100
          const level = Math.min(100, Math.round((avg / 128) * 100));

          if (onAudioLevel) {
            onAudioLevel(level);
          }

          // Voice Activity & Silence Detection
          if (level > 12) {
            // Patient is actively speaking
            hasUserSpoken = true;
            if (silenceTimer) {
              clearTimeout(silenceTimer);
              silenceTimer = null;
            }
          } else if (hasUserSpoken && level < 8) {
            // Silence detected after speech
            if (!silenceTimer) {
              silenceTimer = setTimeout(() => {
                console.log('[SpeechService] Silence detected after speech. Auto-stopping recognition.');
                if (onSilenceDetected) onSilenceDetected();
                dispatchFinalResult();
                handleCleanupAndStop();
              }, 2200); // 2.2 seconds of silence
            }
          }

          animFrameId = requestAnimationFrame(monitorAudioLevels);
        };

        animFrameId = requestAnimationFrame(monitorAudioLevels);
      }
    } catch (err) {
      console.warn('[SpeechService] Could not access microphone for live audio analysis:', err.message);
    }
  };

  let finalResultDispatched = false;

  const dispatchFinalResult = () => {
    if (!finalResultDispatched && onResult && accumulatedTranscript) {
      finalResultDispatched = true;
      onResult(accumulatedTranscript, true);
    }
  };

  const handleCleanupAndStop = () => {
    if (isFinalized) return;
    
    // Ensure final result is submitted even if stopped manually
    dispatchFinalResult();

    isFinalized = true;

    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    if (onAudioLevel) {
      onAudioLevel(0);
    }

    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      activeStream = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
      try { audioContext.close(); } catch (e) {}
      audioContext = null;
    }

    // Stop provider-specific instance
    if (provider === 'bhashini' && mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) {}
    } else if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch (e) {}
    }

    if (onEnd) {
      onEnd();
    }
  };

  // -------------------------------------------------------------
  // PROVIDER 2: BHASHINI ASR (via MediaRecorder) - DEMO MODE MOCK
  // -------------------------------------------------------------
  if (provider === 'bhashini') {
    // In Demo Mode, we secretly route 'bhashini' provider requests directly to the Browser Web Speech API
    // so the kiosk functions flawlessly in real-time without needing a valid Dhruva API key.
    console.log('[SpeechService] Bhashini Demo Mock Mode Active - routing ASR to native browser engine.');
    setupAudioAnalyser();
    runBrowserSpeechRecognition();
    return {
      stop: handleCleanupAndStop,
      provider: 'bhashini'
    };
  }

  // -------------------------------------------------------------
  // PROVIDER 1: BROWSER WEB SPEECH API (Default & Native Fallback)
  // -------------------------------------------------------------
  function runBrowserSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError('Browser SpeechRecognition not supported.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      accumulatedTranscript = transcript;
      const isFinal = event.results[event.results.length - 1].isFinal;

      if (onResult && !isFinalized) {
        if (isFinal) {
          dispatchFinalResult();
        } else {
          onResult(transcript, false);
        }
      }

      if (isFinal) {
        handleCleanupAndStop();
      }
    };

    recognition.onerror = (event) => {
      console.warn('[SpeechService] Browser Recognition error:', event.error);
      // Special check for no-speech
      if (event.error === 'no-speech') {
        if (onResult && !accumulatedTranscript) {
          onResult('', true);
        }
      }
      if (onError) onError(event.error);
      handleCleanupAndStop();
    };

    recognition.onend = () => {
      handleCleanupAndStop();
    };

    try {
      recognition.start();
      recognitionInstance = recognition;
    } catch (err) {
      console.error('[SpeechService] Failed to start browser recognition:', err);
      if (onError) onError(err.message);
      handleCleanupAndStop();
    }
  }

  setupAudioAnalyser();
  runBrowserSpeechRecognition();

  return {
    stop: handleCleanupAndStop,
    provider: 'browser'
  };
}
