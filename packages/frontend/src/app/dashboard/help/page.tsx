'use client';
import { useState, useCallback } from 'react';
import { useT, useI18n } from '@/lib/i18n';
import { HELP_CATEGORIES } from './_lib/help-data';
import { HelpSidebar } from './_components/HelpSidebar';
import { HelpArticle } from './_components/HelpArticle';

export default function HelpPage() {
  const t = useT();
  const { lang } = useI18n();
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  // Mobile: null = category list, 'sidebar' = articles list, 'article' = article view
  const [mobileView, setMobileView] = useState<null | 'sidebar' | 'article'>(null);

  const handleSelect = useCallback((catId: string, artId: string) => {
    setActiveCatId(catId);
    setActiveArticleId(artId);
    setMobileView('article');
  }, []);

  const handleCatSelect = useCallback((catId: string) => {
    setActiveCatId(catId);
    setMobileView('sidebar');
  }, []);

  const handleMobileBack = useCallback(() => {
    if (mobileView === 'article') {
      setMobileView('sidebar');
    } else {
      setMobileView(null);
      setActiveCatId(null);
    }
  }, [mobileView]);

  // Find active article content
  const activeArticle = activeArticleId
    ? HELP_CATEGORIES.flatMap(c => c.articles).find(a => a.id === activeArticleId)
    : null;
  const activeContent = activeArticle?.content[lang as 'ru' | 'en'] || activeArticle?.content.en || '';

  // Active category for mobile sidebar
  const activeCat = activeCatId
    ? HELP_CATEGORIES.find(c => c.id === activeCatId)
    : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Mobile back button */}
        {mobileView && (
          <button
            onClick={handleMobileBack}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--th-card)] border border-[var(--th-card-border-subtle)]"
          >
            <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('help.title')}</h1>
          <p className="text-xs text-[var(--th-text-muted)] mt-0.5">{t('help.subtitle')}</p>
        </div>
      </div>

      {/* Desktop layout: sidebar + content */}
      <div className="hidden md:grid md:grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="col-span-4 lg:col-span-3">
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-3 sticky top-4">
            <HelpSidebar
              categories={HELP_CATEGORIES}
              activeArticleId={activeArticleId}
              onSelect={handleSelect}
              lang={lang}
              t={t}
            />
          </div>
        </div>

        {/* Content */}
        <div className="col-span-8 lg:col-span-9">
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-6 lg:p-8 min-h-[60vh]">
            {activeArticle ? (
              <HelpArticle content={activeContent} />
            ) : (
              <WelcomeScreen categories={HELP_CATEGORIES} onSelect={handleSelect} lang={lang} t={t} />
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout: drill-down */}
      <div className="md:hidden">
        {!mobileView && (
          /* Category cards */
          <div className="grid grid-cols-2 gap-2.5">
            {HELP_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCatSelect(cat.id)}
                className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 text-left hover:bg-[var(--th-card-hover)] transition-colors"
              >
                <span className="material-symbols-outlined text-2xl text-[var(--th-primary-light)] mb-2 block"
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                  {cat.icon}
                </span>
                <div className="text-sm font-semibold text-[var(--th-text)]">{t(cat.titleKey)}</div>
                <div className="text-[10px] text-[var(--th-text-muted)] mt-0.5">{cat.articles.length} {lang === 'ru' ? 'статей' : 'articles'}</div>
              </button>
            ))}
          </div>
        )}

        {mobileView === 'sidebar' && activeCat && (
          /* Article list */
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-3">
            <div className="flex items-center gap-2 px-2 mb-3">
              <span className="material-symbols-outlined text-lg text-[var(--th-primary-light)]"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                {activeCat.icon}
              </span>
              <span className="text-sm font-bold text-[var(--th-text)]">{t(activeCat.titleKey)}</span>
            </div>
            <div className="space-y-0.5">
              {activeCat.articles.map(art => (
                <button
                  key={art.id}
                  onClick={() => handleSelect(activeCat.id, art.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)] transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-[var(--th-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  {t(art.titleKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {mobileView === 'article' && activeArticle && (
          /* Article content */
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4">
            <HelpArticle content={activeContent} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Welcome / landing screen when no article selected ─────────────── */
function WelcomeScreen({
  categories,
  onSelect,
  lang,
  t,
}: {
  categories: typeof HELP_CATEGORIES;
  onSelect: (catId: string, artId: string) => void;
  lang: string;
  t: (key: string) => string;
}) {
  return (
    <div>
      <div className="text-center mb-8">
        <span className="material-symbols-outlined text-4xl text-[var(--th-primary-light)] mb-3 block"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
          help
        </span>
        <h2 className="text-lg font-bold text-[var(--th-text)] mb-1">{t('help.welcomeTitle')}</h2>
        <p className="text-sm text-[var(--th-text-muted)]">{t('help.welcomeSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              if (cat.articles[0]) onSelect(cat.id, cat.articles[0].id);
            }}
            className="rounded-xl border border-[var(--th-card-border-subtle)] p-4 text-left hover:bg-[var(--th-card-hover)] hover:border-[var(--th-primary)]/30 transition-colors group"
          >
            <span className="material-symbols-outlined text-xl text-[var(--th-primary-light)] mb-2 block group-hover:scale-110 transition-transform"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
              {cat.icon}
            </span>
            <div className="text-sm font-semibold text-[var(--th-text)]">{t(cat.titleKey)}</div>
            <div className="text-[10px] text-[var(--th-text-muted)] mt-0.5">
              {cat.articles.length} {lang === 'ru' ? 'статей' : 'articles'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
