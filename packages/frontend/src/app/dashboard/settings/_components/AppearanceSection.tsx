'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { ACCENT_COLORS } from '../_lib/constants';
import { IconCheck } from '../_lib/icons';

export function AppearanceSection() {
  const { t, lang: language, setLang: setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const [selectedAccent, setSelectedAccent] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('caller_accent') || 'indigo';
    return 'indigo';
  });

  function handleAccent(id: string) {
    setSelectedAccent(id);
    localStorage.setItem('caller_accent', id);
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-[0_2px_8px_rgba(168,85,247,0.3)]">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.appearance')}</h2>
          <p className="text-xs text-[var(--th-text-muted)]">{t('settings.appearanceHint')}</p>
        </div>
      </div>

      {/* Theme Card */}
      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.theme')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Light theme card */}
          <button
            onClick={() => setTheme('light')}
            className={`relative group p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
              theme === 'light'
                ? 'border-[var(--th-primary)] shadow-[0_0_0_2px_rgba(99,102,241,0.15)] scale-[1.01]'
                : 'border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary-muted)] hover:shadow-md'
            }`}
            style={theme === 'light' ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(59,130,246,0.04))' } : {}}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-[var(--th-text)]">{t('settings.themeLight')}</span>
                <p className="text-[10px] text-[var(--th-text-muted)]">Clean & bright</p>
              </div>
            </div>
            {/* Mini preview */}
            <div className="bg-white rounded-lg border border-gray-200 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <div className="h-1.5 w-16 rounded bg-gray-300" />
              </div>
              <div className="h-1.5 w-full rounded bg-gray-200" />
              <div className="h-1.5 w-3/4 rounded bg-gray-100" />
              <div className="h-1.5 w-1/2 rounded bg-gray-100" />
            </div>
            {theme === 'light' && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-md">
                <IconCheck className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>

          {/* Dark theme card */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative group p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
              theme === 'dark'
                ? 'border-[var(--th-primary)] shadow-[0_0_0_2px_rgba(99,102,241,0.15)] scale-[1.01]'
                : 'border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary-muted)] hover:shadow-md'
            }`}
            style={theme === 'dark' ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04))' } : {}}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-[var(--th-text)]">{t('settings.themeDark')}</span>
                <p className="text-[10px] text-[var(--th-text-muted)]">Easy on the eyes</p>
              </div>
            </div>
            {/* Mini preview */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <div className="h-1.5 w-16 rounded bg-gray-600" />
              </div>
              <div className="h-1.5 w-full rounded bg-gray-700" />
              <div className="h-1.5 w-3/4 rounded bg-gray-800" />
              <div className="h-1.5 w-1/2 rounded bg-gray-800" />
            </div>
            {theme === 'dark' && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-md">
                <IconCheck className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Language + Accent Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Language Card */}
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
            </svg>
            <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.language')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { code: 'en' as const, label: 'English', sub: 'United States', flag: '🇺🇸' },
              { code: 'ru' as const, label: 'Русский', sub: 'Россия', flag: '🇷🇺' },
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  language === lang.code
                    ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] shadow-[0_0_0_2px_rgba(99,102,241,0.1)]'
                    : 'border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary-muted)] hover:shadow-sm'
                }`}
              >
                <span className="text-2xl leading-none">{lang.flag}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold text-[var(--th-text)]">{lang.label}</div>
                  <div className="text-[10px] text-[var(--th-text-muted)]">{lang.sub}</div>
                </div>
                {language === lang.code && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center">
                    <IconCheck className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color Card */}
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.accentColor')}</h3>
          </div>
          <div className="flex items-center gap-3">
            {ACCENT_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => handleAccent(color.id)}
                className="group flex flex-col items-center gap-1.5"
                title={color.label}
              >
                <div className={`relative w-11 h-11 rounded-xl transition-all duration-200 ${
                  selectedAccent === color.id
                    ? 'scale-110 shadow-lg'
                    : 'hover:scale-110 hover:shadow-md'
                }`}
                  style={{
                    backgroundColor: color.value,
                    boxShadow: selectedAccent === color.id ? `0 0 0 2px var(--th-bg), 0 0 0 4px ${color.value}` : undefined,
                  }}
                >
                  {selectedAccent === color.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconCheck className="w-4 h-4 text-white drop-shadow-sm" />
                    </div>
                  )}
                </div>
                <span className={`text-[10px] transition-colors ${
                  selectedAccent === color.id ? 'text-[var(--th-text)] font-semibold' : 'text-[var(--th-text-muted)]'
                }`}>{color.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--th-text-muted)] mt-3 leading-relaxed">
            {t('settings.accentColorHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
