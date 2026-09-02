import { useState, useCallback } from 'react';
import { LANDING_LANGS } from '@/lib/landingContent';

const KEY = 'aegis_landing_lang';

export default function useLandingLang() {
  const [lang, setLangState] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    return LANDING_LANGS.includes(saved) ? saved : 'ko';
  });
  const setLang = useCallback((l) => {
    if (!LANDING_LANGS.includes(l)) return;
    window.localStorage.setItem(KEY, l);
    setLangState(l);
  }, []);
  return [lang, setLang];
}