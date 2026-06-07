'use client';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={on
              ? { background: 'var(--th-card)', color: 'var(--th-text)', boxShadow: '0 1px 2px var(--th-shadow)' }
              : { background: 'transparent', color: 'var(--th-text-muted)' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AppearanceSection() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3 md:space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.appearance')}</h2>
      </div>

      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="p-4 md:p-6 divide-y" style={{ borderColor: 'var(--th-card-border-subtle)' }}>
          {/* Theme */}
          <div className="flex items-center justify-between gap-4 pb-4 md:pb-5">
            <div className="text-sm font-medium text-[var(--th-text)]">{t('settings.theme')}</div>
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
            />
          </div>

          {/* Language */}
          <div className="flex items-center justify-between gap-4 pt-4 md:pt-5">
            <div className="text-sm font-medium text-[var(--th-text)]">{t('settings.language')}</div>
            <Segmented
              value={lang}
              onChange={setLang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ru', label: 'Русский' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
