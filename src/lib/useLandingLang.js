import { useState, useEffect } from 'react';
import { LANDING_LANGS } from '@/lib/landingContent';

const KEY = 'aegis_landing_lang';

export default function useLandingLang() {
  const [lang, setLang] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    return LANDING_LANGS.includes(saved) ? saved : 'ko';
  });
  useEffect(() => {
    window.localStorage.setItem(KEY, lang);
  }, [lang]);
  return [lang, setLang];
}