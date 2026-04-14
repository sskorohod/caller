'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import en from './i18n/en';
import ru from './i18n/ru';

// ─── Dictionaries ────────────────────────────────────────────────────────────

const dictionaries: Record<string, Record<string, string>> = { en, ru };

export type Lang = 'en' | 'ru';

// ─── Context ─────────────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getBrowserLang(): Lang {
  if (typeof window === 'undefined') return 'ru';
  const stored = localStorage.getItem('caller_lang');
  if (stored === 'en' || stored === 'ru') return stored;
  return 'ru';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getBrowserLang());
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('caller_lang', newLang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>): string => {
      let value = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        }
      }
      return value;
    },
    [lang],
  );

  // Avoid hydration mismatch: render with 'en' on server, update on mount
  const contextValue: I18nContextValue = { lang: mounted ? lang : 'en', setLang, t: mounted ? t : (key, vars) => {
    let value = dictionaries.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      }
    }
    return value;
  }};

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx.t;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useLang() {
  return useI18n().lang;
}
