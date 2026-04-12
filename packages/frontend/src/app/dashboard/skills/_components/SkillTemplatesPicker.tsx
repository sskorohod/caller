'use client';
import { useT, useLang } from '@/lib/i18n';
import { SKILL_TEMPLATES, type SkillTemplate } from '../_lib/constants';

interface SkillTemplatesPickerProps {
  onSelect: (template: SkillTemplate) => void;
  onScratch: () => void;
}

export default function SkillTemplatesPicker({ onSelect, onScratch }: SkillTemplatesPickerProps) {
  const t = useT();
  const lang = useLang();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Header */}
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center mb-4 shadow-[0_4px_16px_var(--th-shadow-primary)]">
        <span className="material-symbols-outlined text-white text-2xl">auto_awesome</span>
      </div>
      <h2 className="text-xl font-bold text-[var(--th-text)] mb-1">{t('skills.templates')}</h2>
      <p className="text-sm text-[var(--th-text-muted)] mb-8">{t('skills.templatesDesc')}</p>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
        {SKILL_TEMPLATES.map(tpl => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 text-left hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-all group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `linear-gradient(135deg, ${tpl.color}, ${tpl.color}88)` }}
            >
              <span className="material-symbols-outlined text-white text-xl">{tpl.icon}</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--th-text)] group-hover:text-[var(--th-primary-text)] transition-colors">
              {lang === 'ru' ? tpl.nameRu : tpl.nameEn}
            </h3>
            <p className="text-xs text-[var(--th-text-muted)] mt-1 line-clamp-2">
              {lang === 'ru' ? tpl.descRu : tpl.descEn}
            </p>
          </button>
        ))}
      </div>

      {/* Start from scratch */}
      <button
        type="button"
        onClick={onScratch}
        className="mt-6 px-6 py-2.5 text-sm font-medium text-[var(--th-text-secondary)] hover:text-[var(--th-text)] border border-[var(--th-card-border-subtle)] hover:border-[var(--th-border)] rounded-xl transition-all"
      >
        {t('skills.startFromScratch')}
      </button>
    </div>
  );
}
