// Utility service for browser Web Speech API (TTS & Speech-to-Text)

// Check TTS availability
export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Speak text using SpeechSynthesis
export function speakText(text, lang = 'English', onEnd = null) {
  if (!isTTSSupported()) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set language code
  const langCode = lang === 'हिंदी' || lang === 'Hindi' ? 'hi-IN' : 'en-US';
  utterance.lang = langCode;
  utterance.rate = 0.95; // Slightly slower, reassuring speed
  utterance.pitch = 1.0;

  // Try to find a natural matching voice if available
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang === langCode || v.lang.startsWith(langCode.substring(0, 2)));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

// Stop any active TTS speech
export function cancelSpeech() {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Check SpeechRecognition availability
export function isSTTSupported() {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

// Start Voice Recognition
export function startListening({ onResult, onError, onEnd, lang = 'English' }) {
  if (!isSTTSupported()) {
    if (onError) onError('Speech recognition is not supported in this browser.');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = lang === 'हिंदी' || lang === 'Hindi' ? 'hi-IN' : 'en-US';

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (onResult) {
      const isFinal = event.results[event.results.length - 1].isFinal;
      onResult(transcript, isFinal);
    }
  };

  recognition.onerror = (event) => {
    console.warn('[SpeechService] Recognition error:', event.error);
    if (onError) onError(event.error);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  try {
    recognition.start();
    return recognition;
  } catch (err) {
    console.error('[SpeechService] Failed to start recognition:', err);
    if (onError) onError(err.message);
    return null;
  }
}
