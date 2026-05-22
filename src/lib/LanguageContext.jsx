import React, { createContext, useContext, useState } from 'react';
import { translations } from './translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('masia_lang') || 'ko');

  const toggleLang = () => {
    const next = lang === 'ko' ? 'zh' : 'ko';
    setLang(next);
    localStorage.setItem('masia_lang', next);
  };

  const t = (key, fallback) => {
    return translations[lang]?.[key] ?? fallback ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}