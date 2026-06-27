'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import LanguageDropdown from '@/components/LanguageDropdown';

export type Lang = 'en' | 'ru' | 'es';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (en: string, ru: string, es?: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (en) => en,
});

export function LangProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? 'en');

  useEffect(() => {
    // When the route is locale-authoritative (e.g. /ru/* passes initialLang),
    // the server already rendered the right language — don't override it from
    // localStorage/browser (that would cause a flash and break the canonical URL).
    if (initialLang) return;
    // Otherwise (the default en routes) keep the existing client-side preference.
    const stored = localStorage.getItem('caller_public_lang') as Lang | null;
    if (stored === 'en' || stored === 'ru' || stored === 'es') {
      setLangState(stored);
    } else {
      const browserLang = navigator.language || '';
      if (browserLang.startsWith('ru')) {
        setLangState('ru');
      } else if (browserLang.startsWith('es')) {
        setLangState('es');
      }
    }
  }, [initialLang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('caller_public_lang', l);
  }, []);

  const t = useCallback((en: string, ru: string, es?: string) => {
    if (lang === 'ru') return ru;
    if (lang === 'es') return es ?? en;
    return en;
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

/** Language switcher dropdown (public dark pages) */
export function LangSwitcher({ className = '', align = 'end' }: { className?: string; align?: 'start' | 'end' }) {
  const { lang, setLang } = useLang();
  return (
    <LanguageDropdown
      variant="landing"
      value={lang}
      onChange={(v) => setLang(v as Lang)}
      className={className}
      align={align}
    />
  );
}
