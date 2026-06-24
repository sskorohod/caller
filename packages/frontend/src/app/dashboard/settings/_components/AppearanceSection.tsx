'use client';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { SectionCard } from './SectionCard';

function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={on
              ? { background: 'var(--th-card)', color: 'var(--th-text)', boxShadow: '0 1px 2px var(--th-shadow)' }
              : { background: 'transparent', color: 'var(--th-text-muted)' }}
          >
            {o.icon && <span className="material-symbols-outlined text-[16px] leading-none">{o.icon}</span>}
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
    <SectionCard
      id="appearance"
      icon="palette"
      tint="violet"
      title={t('settings.appearance')}
      description={t('settings.appearanceDesc')}
    >
      {/* Theme + Language on a single row (wraps on narrow viewports) */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
        {/* Theme */}
        <div className="min-w-[200px]">
          <div className="text-sm font-medium text-[var(--th-text)]">{t('settings.theme')}</div>
          <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5 mb-2">{t('settings.themeDesc')}</div>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('settings.themeLight'), icon: 'light_mode' },
              { value: 'dark', label: t('settings.themeDark'), icon: 'dark_mode' },
            ]}
          />
        </div>

        {/* Language */}
        <div className="min-w-[200px]">
          <div className="text-sm font-medium text-[var(--th-text)] mb-2">{t('settings.language')}</div>
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
    </SectionCard>
  );
}
