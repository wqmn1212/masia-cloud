import React, { useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { cnOrKo } from '@/lib/contentLanguage';
import { translations } from '@/lib/translations';
import LanguageContext from '@/lib/language-context';

export function LanguageProvider({ children, user }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('masia_lang') || user?.preferred_language || 'ko');

  useEffect(() => {
    if (!localStorage.getItem('masia_lang') && user?.preferred_language) setLangState(user.preferred_language);
  }, [user?.preferred_language]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'ko';
    document.documentElement.classList.toggle('lang-zh', lang === 'zh');
  }, [lang]);

  const setLang = (next) => {
    setLangState(next);
    localStorage.setItem('masia_lang', next);
    base44.auth.updateMe({ preferred_language: next }).catch(() => {});
  };

  const toggleLang = () => setLang(lang === 'ko' ? 'zh' : 'ko');

  const t = (key, fallback) => {
    return translations[lang]?.[key] ?? fallback ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, content: (record, field) => cnOrKo(record, field, lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}