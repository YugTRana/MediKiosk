import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HeartPulse, Stethoscope, Activity, ArrowRight, Monitor, 
  CheckCircle2, ShieldCheck, Lock, UserCheck, Star, Award,
  Volume2, Sparkles, Users, Zap
} from 'lucide-react';
import LanguageToggle from '../components/LanguageToggle.jsx';

function RevealOnScroll({ children, className = "", delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${className}`}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    patientsServed: 0,
    totalSessions: 0,
    avgWaitTime: '< 2 mins',
    rating: '4.9/5'
  });

  const playAiGreeting = () => {
    const msg = new SpeechSynthesisUtterance("Welcome to Medi Kiosk. How can I help you today?");
    
    // Find a sweet/female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      v.name.includes('Female') || 
      v.name.includes('Zira') || 
      v.name.includes('Samantha') || 
      v.name.includes('Victoria') ||
      (v.name.includes('Google') && v.name.includes('UK English'))
    );
    
    if (femaleVoice) {
      msg.voice = femaleVoice;
    }
    
    // Higher pitch and slightly slower rate for a sweeter, friendly tone
    msg.rate = 0.95;
    msg.pitch = 1.3;
    window.speechSynthesis.speak(msg);
  };

  useEffect(() => {
    // Fetch dynamic stats from the backend API
    fetch('http://localhost:3000/api/public/stats')
      .then(res => res.json())
      .then(data => {
        if (data.patientsServed !== undefined) {
          setStats(data);
        }
      })
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      <div className="absolute top-4 right-4 z-50">
        <LanguageToggle />
      </div>
      
      {/* HERO SECTION - Enhanced with glowing orbs */}
      <section className="relative bg-slate-950 text-white overflow-hidden py-28 sm:py-40">
        {/* Animated glowing background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/30 rounded-full blur-[120px] opacity-60 animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-emerald-500/20 rounded-full blur-[100px] opacity-50 pointer-events-none"></div>
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[90px] opacity-40 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <RevealOnScroll>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-sm font-bold mb-8 shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Secure & HIPAA Compliant Platform</span>
            </div>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8">
              Smart Care, <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-teal-300 drop-shadow-sm">Zero Wait Time.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
              Experience the fastest, most secure clinic check-in. Our intelligent AI listens to your symptoms and prepares your doctor instantly—so you get better care, faster.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button
                onClick={() => navigate('/kiosk')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer hover:scale-105 border border-blue-400/50"
              >
                Start My Check-In
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={playAiGreeting}
                className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 font-bold rounded-2xl transition-all border border-amber-500/30 w-full sm:w-auto cursor-pointer hover:scale-105 backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2"
              >
                <Volume2 className="w-5 h-5" />
                Hear the AI Demo
              </button>
              <a
                href="#how-it-works"
                className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-bold rounded-2xl transition-all border border-slate-700 w-full sm:w-auto cursor-pointer hover:scale-105 backdrop-blur-sm shadow-lg"
              >
                See How It Works
              </a>
            </div>
          </RevealOnScroll>
        </div>

        {/* Marquee Ticker Bottom of Hero */}
        <div className="absolute bottom-0 left-0 w-full bg-blue-600/20 backdrop-blur-md border-t border-blue-500/30 overflow-hidden py-3">
          <div className="whitespace-nowrap flex items-center w-[200%] animate-marquee">
            <div className="flex items-center justify-around w-1/2 text-blue-200 font-black text-sm uppercase tracking-widest">
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Powered by AI</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> 10+ Regional Languages</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Secure FHIR Integration</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Zero-Wait Triage</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Voice Enabled</span>
            </div>
            <div className="flex items-center justify-around w-1/2 text-blue-200 font-black text-sm uppercase tracking-widest">
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Powered by AI</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> 10+ Regional Languages</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Secure FHIR Integration</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Zero-Wait Triage</span>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Voice Enabled</span>
            </div>
          </div>
        </div>
      </section>



      {/* SECURITY HIGHLIGHT */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <RevealOnScroll className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 sm:p-12 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-700">
            <div className="md:w-2/3">
              <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
                <Lock className="w-8 h-8 text-emerald-400" />
                Your Health Data is Safe with Us
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed">
                We employ military-grade 256-bit encryption and strict FHIR R4 compliance to ensure your personal health information never falls into the wrong hands. Your trust and privacy are our absolute highest priorities.
              </p>
            </div>
            <div className="md:w-1/3 flex justify-center">
              <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                <ShieldCheck className="w-16 h-16 text-emerald-400 relative z-10" />
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* HOW IT WORKS / STEPS GUIDE */}
      <section id="how-it-works" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <RevealOnScroll className="text-center mb-24">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-6">How to use MediKiosk</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">A seamless 3-step process designed to put you, the patient, first. Say goodbye to clipboards and crowded waiting rooms.</p>
          </RevealOnScroll>

          <div className="space-y-32">
            {/* Step 1 */}
            <RevealOnScroll className="flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/2">
                <div className="w-16 h-16 bg-slate-900 text-white font-black text-2xl rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-slate-900/20">1</div>
                <h3 className="text-3xl sm:text-4xl font-bold mb-6 text-slate-900">Effortless Patient Check-In</h3>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Walk up to the kiosk and securely sign in with your mobile number. We use ultra-secure OTP verification to pull up your profile instantly.
                </p>
                <ul className="space-y-5">
                  <li className="flex items-center gap-4 text-slate-800 font-bold text-lg bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-emerald-100 rounded-lg"><Lock className="w-5 h-5 text-emerald-600" /></div>
                    Ultra-Secure OTP Login
                  </li>
                  <li className="flex items-center gap-4 text-slate-800 font-bold text-lg bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-blue-100 rounded-lg"><UserCheck className="w-5 h-5 text-blue-600" /></div>
                    Instant Profile Retrieval
                  </li>
                </ul>
              </div>
              <div className="md:w-1/2 w-full group">
                <div className="bg-slate-100 p-2 sm:p-4 rounded-[2rem] shadow-2xl shadow-blue-900/10 border border-slate-200 transform group-hover:-translate-y-2 group-hover:shadow-3xl transition-all duration-500 relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-emerald-500/10 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <img src="/assets/step1.jpg" alt="Step 1 Login" className="w-full h-auto rounded-3xl border border-slate-200 object-cover aspect-video relative z-10" />
                </div>
              </div>
            </RevealOnScroll>

            {/* Step 2 */}
            <RevealOnScroll className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="md:w-1/2">
                <div className="w-16 h-16 bg-blue-600 text-white font-black text-2xl rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-900/30">2</div>
                <h3 className="text-3xl sm:text-4xl font-bold mb-6 text-slate-900">Intelligent AI Triage</h3>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Simply speak to our AI about how you're feeling. It dynamically adjusts its questions to build a comprehensive medical history, saving you the hassle of explaining everything twice.
                </p>
                <ul className="space-y-5">
                  <li className="flex items-center gap-4 text-slate-800 font-bold text-lg bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-blue-100 rounded-lg"><Monitor className="w-5 h-5 text-blue-600" /></div>
                    Conversational Voice Input
                  </li>
                  <li className="flex items-center gap-4 text-slate-800 font-bold text-lg bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-purple-100 rounded-lg"><HeartPulse className="w-5 h-5 text-purple-600" /></div>
                    Instant Emergency Detection
                  </li>
                </ul>
              </div>
              <div className="md:w-1/2 w-full group">
                <div className="bg-slate-100 p-2 sm:p-4 rounded-[2rem] shadow-2xl shadow-blue-900/10 border border-slate-200 transform group-hover:-translate-y-2 group-hover:shadow-3xl transition-all duration-500 relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <img src="/assets/step2.jpg" alt="Step 2 AI Questions" className="w-full h-auto rounded-3xl border border-slate-200 object-cover aspect-video relative z-10" />
                </div>
              </div>
            </RevealOnScroll>

            {/* Step 3 */}
            <RevealOnScroll className="flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/2">
                <div className="w-16 h-16 bg-emerald-600 text-white font-black text-2xl rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-emerald-900/30">3</div>
                <h3 className="text-3xl sm:text-4xl font-bold mb-6 text-slate-900">Faster Doctor Consultations</h3>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  By the time you sit down with the doctor, they already have a highly organized summary of your symptoms and vitals on their dashboard. Consultations are faster, and care is more focused.
                </p>
                <ul className="space-y-5">
                  <li className="flex items-center gap-4 text-slate-800 font-bold text-lg bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-emerald-100 rounded-lg"><Stethoscope className="w-5 h-5 text-emerald-600" /></div>
                    Highly Personalized Care
                  </li>
                  <li className="flex items-center gap-4 text-slate-800 font-bold text-lg bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-amber-100 rounded-lg"><Award className="w-5 h-5 text-amber-600" /></div>
                    Better Health Outcomes
                  </li>
                </ul>
              </div>
              <div className="md:w-1/2 w-full group">
                <div className="bg-slate-100 p-2 sm:p-4 rounded-[2rem] shadow-2xl shadow-blue-900/10 border border-slate-200 transform group-hover:-translate-y-2 group-hover:shadow-3xl transition-all duration-500 relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <img src="/assets/step3.jpg" alt="Step 3 Doctor Dashboard" className="w-full h-auto rounded-3xl border border-slate-200 object-cover aspect-video relative z-10" />
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 bg-white text-center">
        <RevealOnScroll className="max-w-4xl mx-auto px-6">
          <div className="bg-blue-600 rounded-[3rem] p-12 sm:p-20 shadow-2xl shadow-blue-600/30 border border-blue-500 relative overflow-hidden text-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400/50 via-transparent to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-4xl font-black mb-6">Ready to prioritize your health?</h2>
              <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">Skip the lines, keep your data secure, and get better care with MediKiosk.</p>
              <button
                onClick={() => navigate('/kiosk')}
                className="px-10 py-5 bg-white text-blue-700 hover:bg-slate-50 font-extrabold text-xl rounded-2xl shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-3 mx-auto w-full sm:w-auto"
              >
                Book an Appointment
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-12 text-center border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-white font-bold text-xl">
            <HeartPulse className="w-6 h-6 text-blue-500" /> MediKiosk
          </div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Providing smart, secure, and rapid healthcare solutions. Your health data is encrypted and HIPAA compliant.
          </p>
          <p className="text-xs text-slate-600 mt-4">© {new Date().getFullYear()} MediKiosk Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
