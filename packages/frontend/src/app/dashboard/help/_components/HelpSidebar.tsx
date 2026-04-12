'use client';
import { useState } from 'react';
import type { HelpCategory } from '../_lib/help-data';

interface Props {
  categories: HelpCategory[];
  activeArticleId: string | null;
  onSelect: (catId: string, artId: string) => void;
  lang: string;
  t: (key: string) => string;
}

export function HelpSidebar({ categories, activeArticleId, onSelect, lang, t }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Expand category containing active article
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
    <nav className="space-y-1">
      {categories.map(cat => {
        const isOpen = expanded[cat.id] ?? false;
        const hasActive = cat.articles.some(a => a.id === activeArticleId);

        return (
          <div key={cat.id}>
            <button
              onClick={() => toggle(cat.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                hasActive
                  ? 'text-[var(--th-text)] bg-[var(--th-card-hover)]'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)]'
              }`}
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                {cat.icon}
              </span>
              <span className="flex-1 text-left truncate">{t(cat.titleKey)}</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {isOpen && (
              <div className="ml-7 mt-0.5 space-y-0.5 border-l border-[var(--th-card-border-subtle)] pl-3">
                {cat.articles.map(art => (
                  <button
                    key={art.id}
                    onClick={() => onSelect(cat.id, art.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                      art.id === activeArticleId
                        ? 'text-[var(--th-primary-light)] font-semibold bg-[var(--th-primary)]/10'
                        : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)]'
                    }`}
                  >
                    {t(art.titleKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
