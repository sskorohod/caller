'use client';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { ACCENT_COLORS } from '../_lib/constants';
import { IconCheck } from '../_lib/icons';

export function AppearanceSection() {
  const { t, lang: language, setLang: setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.appearance')}</h3>
        <p className="text-xs text-[var(--th-text-muted)] mt-1">
          {t('settings.appearanceHint') || 'Customize the look and feel of your dashboard.'}
        </p>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.theme')}</p>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('light')}
            className={`relative p-5 rounded-xl border-2 transition-all text-left ${
              theme === 'light'
                ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] shadow-sm'
                : 'border-[var(--th-card-border-subtle)] bg-[var(--th-card)] hover:border-[var(--th-primary-muted)]'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-[var(--th-text)]">{t('settings.themeLight')}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded bg-gray-200" />
              <div className="h-2 w-3/4 rounded bg-gray-100" />
              <div className="h-2 w-1/2 rounded bg-gray-100" />
            </div>
            {theme === 'light' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--th-primary)] flex items-center justify-center">
                <IconCheck className="w-3 h-3 text-white" />
              </div>
            )}
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`relative p-5 rounded-xl border-2 transition-all text-left ${
              theme === 'dark'
                ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] shadow-sm'
                : 'border-[var(--th-card-border-subtle)] bg-[var(--th-card)] hover:border-[var(--th-primary-muted)]'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-[var(--th-text)]">{t('settings.themeDark')}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded bg-gray-700" />
              <div className="h-2 w-3/4 rounded bg-gray-800" />
              <div className="h-2 w-1/2 rounded bg-gray-800" />
            </div>
            {theme === 'dark' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--th-primary)] flex items-center justify-center">
                <IconCheck className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.language')}</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { code: 'en' as const, label: 'English', flag: '🇺🇸' },
            { code: 'ru' as const, label: 'Русский', flag: '🇷🇺' },
          ].map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                language === lang.code
                  ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] shadow-sm'
                  : 'border-[var(--th-card-border-subtle)] bg-[var(--th-card)] hover:border-[var(--th-primary-muted)]'
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-sm font-semibold text-[var(--th-text)]">{lang.label}</span>
              {language === lang.code && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--th-primary)] flex items-center justify-center">
                  <IconCheck className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
          {t('settings.accentColor') || 'Accent Color'}
        </p>
        <div className="flex items-center gap-3">
          {ACCENT_COLORS.map(color => (
            <button
              key={color.id}
              onClick={() => {
                // Store accent preference — for now just visual feedback
                // Future: persist via workspace settings or localStorage
              }}
              className="group relative"
              title={color.label}
            >
              <div
                className="w-10 h-10 rounded-xl border-2 border-transparent transition-all hover:scale-110 hover:shadow-lg"
                style={{ backgroundColor: color.value }}
              />
              <span className="text-[10px] text-[var(--th-text-muted)] mt-1 block text-center">{color.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--th-text-muted)]">
          {t('settings.accentColorHint') || 'Accent color customization coming soon.'}
        </p>
      </div>
    </div>
  );
}
