import React, { useState, useEffect, useRef } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' }
];

export default function LanguageToggle({ className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const dropdownRef = useRef(null);

  // Parse current language from cookie on mount
  useEffect(() => {
    const match = document.cookie.match(/(^|;) ?googtrans=([^;]*)(;|$)/);
    if (match && match[2]) {
      const parts = match[2].split('/');
      const lang = parts[parts.length - 1];
      if (lang) {
        setCurrentLang(lang);
      }
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode) => {
    setCurrentLang(langCode);
    setIsOpen(false);
    
    // Interact with the hidden Google Translate select dropdown
    const gtSelect = document.querySelector('.goog-te-combo');
    if (gtSelect) {
      gtSelect.value = langCode;
      gtSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const selectedLangName = SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.name || 'Language';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
        title="Translate Page"
      >
        <Languages className="w-4 h-4 text-blue-600" />
        <span className="hidden sm:inline-block max-w-[100px] truncate">{selectedLangName}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-80 overflow-y-auto">
          <div className="py-1">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center justify-between w-full px-4 py-2 text-sm text-left ${
                  currentLang === lang.code 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {lang.name}
                {currentLang === lang.code && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
