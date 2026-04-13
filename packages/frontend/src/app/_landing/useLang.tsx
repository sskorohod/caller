'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type Lang = 'en' | 'ru';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (en: string, ru: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (en) => en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    // Detect from localStorage or browser language
    const stored = localStorage.getItem('caller_public_lang') as Lang | null;
    if (stored === 'en' || stored === 'ru') {
      setLangState(stored);
    } else {
      const browserLang = navigator.language || '';
      if (browserLang.startsWith('ru')) {
        setLangState('ru');
      }
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('caller_public_lang', l);
  }, []);

  const t = useCallback((en: string, ru: string) => {
    return lang === 'ru' ? ru : en;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/** Language switcher button component */
export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${className}`}
      style={{
        background: 'rgba(140,144,159,0.08)',
        border: '1px solid rgba(140,144,159,0.1)',
        color: '#a0a8c0',
      }}
      title={lang === 'en' ? 'Switch to Russian' : 'Switch to English'}
    >
      <span className="material-symbols-outlined text-sm">language</span>
      {lang === 'en' ? 'RU' : 'EN'}
    </button>
  );
}
