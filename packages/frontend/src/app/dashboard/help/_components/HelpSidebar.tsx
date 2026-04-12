'use client';
import { useState } from 'react';
import type { HelpCategory } from '../_lib/help-data';

interface Props {
  categories: HelpCategory[];
  catColors: Record<string, { accent: string; gradient: string }>;
  activeArticleId: string | null;
  activeCatId: string | null;
  onSelect: (catId: string, artId: string) => void;
  lang: string;
  t: (key: string) => string;
}

export function HelpSidebar({ categories, catColors, activeArticleId, activeCatId, onSelect, lang, t }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const cat of categories) {
      if (cat.articles.some(a => a.id === activeArticleId)) {
        init[cat.id] = true;
      }
    }
    return init;
  });

  const toggle = (catId: string) => {
    setExpanded(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <nav className="space-y-0.5">
      {/* Search-like header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)]">
        <svg className="w-3.5 h-3.5 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <span className="text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">
          {lang === 'ru' ? 'Разделы' : 'Topics'}
        </span>
        <span className="ml-auto text-[10px] text-[var(--th-text-muted)] tabular-nums">
          {categories.reduce((sum, c) => sum + c.articles.length, 0)}
        </span>
      </div>

      {categories.map(cat => {
        const isOpen = expanded[cat.id] ?? false;
        const isActiveCat = cat.id === activeCatId;
        const colors = catColors[cat.id] || catColors['getting-started'];

        return (
          <div key={cat.id}>
            <button
              onClick={() => toggle(cat.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                isActiveCat
                  ? 'text-[var(--th-text)] shadow-[0_1px_3px_var(--th-shadow)]'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)]'
              }`}
              style={isActiveCat ? { background: colors.gradient } : undefined}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ background: `${colors.accent}${isActiveCat ? '20' : '10'}` }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: colors.accent, fontVariationSettings: `'FILL' ${isActiveCat ? 1 : 0}, 'wght' 400` }}>
                  {cat.icon}
                </span>
              </div>
              <span className="flex-1 text-left truncate">{t(cat.titleKey)}</span>
              <span className="text-[10px] text-[var(--th-text-muted)] tabular-nums mr-1">{cat.articles.length}</span>
              <svg
                className={`w-3 h-3 shrink-0 text-[var(--th-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Expandable article list */}
            <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="ml-[22px] mt-0.5 mb-1 space-y-px border-l-2 pl-3" style={{ borderColor: `${colors.accent}25` }}>
                {cat.articles.map((art, idx) => {
                  const isActive = art.id === activeArticleId;
                  return (
                    <button
                      key={art.id}
                      onClick={() => onSelect(cat.id, art.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] leading-relaxed transition-all duration-150 flex items-center gap-2 ${
                        isActive
                          ? 'font-semibold'
                          : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)]'
                      }`}
                      style={isActive ? { color: colors.accent, background: `${colors.accent}10` } : undefined}
                    >
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colors.accent, boxShadow: `0 0 6px ${colors.accent}60` }} />
                      ) : (
                        <span className="w-1 h-1 rounded-full shrink-0 bg-[var(--th-text-muted)] opacity-30" />
                      )}
                      {t(art.titleKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
