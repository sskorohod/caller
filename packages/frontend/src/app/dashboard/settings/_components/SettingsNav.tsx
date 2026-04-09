'use client';
import { useT } from '@/lib/i18n';
import { SECTIONS, TRANSLATOR_SECTIONS } from '../_lib/constants';
import type { SectionId } from '../_lib/types';

export function SettingsNav({
  activeSection,
  onSelect,
  plan,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  plan: string;
}) {
  const t = useT();
  const visible = SECTIONS.filter(s =>
    plan === 'translator' ? TRANSLATOR_SECTIONS.includes(s.id) : true
  );

  return (
    <div className="md:w-52 shrink-0">
      <nav className="md:space-y-0.5 md:sticky md:top-0 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1 md:gap-0 pb-2 md:pb-0">
        <p className="hidden md:block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-widest px-3 mb-2">
          {t('settings.title')}
        </p>
        {visible.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-xl text-sm whitespace-nowrap transition-colors shrink-0 md:w-full md:text-left ${
                active
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.25)]'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] hover:text-[var(--th-text)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {t(s.labelKey)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
