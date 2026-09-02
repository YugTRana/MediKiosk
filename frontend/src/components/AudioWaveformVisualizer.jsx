import React from 'react';
import { Mic, Volume2, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { getRecoveryPrompt } from '../services/speechService';

export default function AudioWaveformVisualizer({
  isListening,
  audioLevel = 0,
  provider = 'browser',
  showRecovery = false,
  onRetry = null,
  lang = 'English',
  theme = 'blue' // 'blue' | 'emerald'
}) {
  // Generate bar heights dynamically from live audioLevel (0-100)
  // 9 equalizer-style bars with distinct harmonic multipliers
  const barMultipliers = [0.35, 0.65, 0.9, 1.2, 1.0, 1.15, 0.85, 0.6, 0.3];

  const recoveryMessage = getRecoveryPrompt(lang);

  const activeColorClasses = theme === 'emerald' 
    ? {
        ring: 'border-emerald-400 bg-emerald-500/10 text-emerald-400',
        bar: 'bg-gradient-to-t from-emerald-500 to-teal-300',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
      }
    : {
        ring: 'border-blue-400 bg-blue-500/10 text-blue-400',
        bar: 'bg-gradient-to-t from-blue-600 to-amber-400',
        badge: 'bg-slate-900 text-amber-300 border-slate-700'
      };

  return (
    <div className="w-full flex flex-col gap-2.5 transition-all">
      {/* 1. Live Listening Waveform Display */}
      {isListening && (
        <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            {/* Pulsing Mic Ring */}
            <div className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center ${activeColorClasses.ring} shrink-0`}>
              <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-current"></span>
              <Mic className="w-6 h-6 animate-pulse" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  {lang === 'हिंदी' || lang === 'Hindi' ? 'सुन रहे हैं... बोलिए' : 'Listening... speak clearly'}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${activeColorClasses.badge}`}>
                  {provider === 'bhashini' ? 'Bhashini AI' : 'Browser Speech'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {audioLevel > 12 
                  ? (lang === 'हिंदी' || lang === 'Hindi' ? 'आवाज़ दर्ज हो रही है' : 'Voice detected') 
                  : (lang === 'हिंदी' || lang === 'Hindi' ? 'माइक के पास बोलें...' : 'Auto-stops after silence...')}
              </p>
            </div>
          </div>

          {/* Dynamic Frequency Bars */}
          <div className="flex items-end justify-center gap-1.5 h-10 px-4 py-1 bg-slate-950/80 rounded-xl border border-slate-800 w-full sm:w-auto min-w-[140px]">
            {barMultipliers.map((multiplier, index) => {
              // Base height 6px, dynamic height scaled by audioLevel (up to 34px)
              const dynamicHeight = Math.max(6, Math.min(34, Math.round((audioLevel * multiplier) / 3)));
              return (
                <div
                  key={index}
                  className={`w-2 rounded-full transition-all duration-75 ${activeColorClasses.bar}`}
                  style={{ 
                    height: `${dynamicHeight}px`,
                    opacity: audioLevel > 5 ? 1 : 0.4
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Low-Literacy Recovery Banner ("I didn't catch that, please try again or tap an option") */}
      {showRecovery && !isListening && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-amber-950">
                {lang === 'हिंदी' || lang === 'Hindi' ? 'आवाज़ साफ़ नहीं मिली' : 'Voice Not Captured'}
              </h5>
              <p className="text-xs text-amber-900 font-medium mt-0.5">
                {recoveryMessage}
              </p>
            </div>
          </div>

          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow flex items-center gap-1.5 cursor-pointer self-end sm:self-auto transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'हिंदी' || lang === 'Hindi' ? 'फिर से बोलें' : 'Retry Voice'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
